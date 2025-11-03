from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse, HTMLResponse
from datetime import datetime, timedelta
import os
import secrets

from ..adapters.linkedin_adapter import LinkedInAdapter

router = APIRouter(prefix="/linkedin", tags=["linkedin_auth"])

def get_db():
    from motor.motor_asyncio import AsyncIOMotorClient
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    return client[os.environ['DB_NAME']]

async def get_linkedin_credentials_for_user(user_id: str) -> tuple:
    """Get LinkedIn credentials from user settings
    Returns: (client_id, client_secret, redirect_uri)
    """
    from ..routes.settings import decrypt_value
    from cryptography.fernet import Fernet
    
    db = get_db()
    settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})
    
    # Helper to decrypt system keys
    def decrypt_system_value(encrypted_value: str) -> str:
        if not encrypted_value or encrypted_value.strip() == '':
            return ''
        try:
            ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', '')
            if not ENCRYPTION_KEY:
                return ''
            cipher_suite = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
            decrypted = cipher_suite.decrypt(encrypted_value.encode())
            return decrypted.decode()
        except Exception:
            return ''
    
    # Helper to get system keys
    async def get_system_credentials():
        system_settings = await db.system_settings.find_one({"_id": "api_keys"})
        if system_settings:
            client_id = decrypt_system_value(system_settings.get('linkedin_client_id', ''))
            client_secret = decrypt_system_value(system_settings.get('linkedin_client_secret', ''))
            if client_id and client_secret:
                return (client_id, client_secret, None)
        return (None, None, None)
    
    if not settings:
        # Try system settings, then env vars
        sys_client_id, sys_client_secret, _ = await get_system_credentials()
        if sys_client_id and sys_client_secret:
            return (sys_client_id, sys_client_secret, os.getenv('LINKEDIN_REDIRECT_URI', 'http://localhost:8000/api/linkedin/callback'))
        return (
            os.getenv('LINKEDIN_CLIENT_ID'),
            os.getenv('LINKEDIN_CLIENT_SECRET'),
            os.getenv('LINKEDIN_REDIRECT_URI', 'http://localhost:8000/api/linkedin/callback')
        )
    
    # Decrypt credentials
    client_id = decrypt_value(settings.get('linkedin_client_id', ''))
    client_secret = decrypt_value(settings.get('linkedin_client_secret', ''))
    redirect_uri = decrypt_value(settings.get('linkedin_redirect_uri', ''))
    
    # If user-provided credentials are empty, fall back to system or env vars
    if not client_id or not client_secret:
        sys_client_id, sys_client_secret, _ = await get_system_credentials()
        if sys_client_id and sys_client_secret:
            redirect_uri = redirect_uri or os.getenv('LINKEDIN_REDIRECT_URI', 'http://localhost:8000/api/linkedin/callback')
            return (sys_client_id, sys_client_secret, redirect_uri)
        return (
            os.getenv('LINKEDIN_CLIENT_ID'),
            os.getenv('LINKEDIN_CLIENT_SECRET'),
            os.getenv('LINKEDIN_REDIRECT_URI', 'http://localhost:8000/api/linkedin/callback')
        )
    
    # Use default redirect URI if not provided
    if not redirect_uri:
        redirect_uri = os.getenv('LINKEDIN_REDIRECT_URI', 'http://localhost:8000/api/linkedin/callback')
    
    return (client_id, client_secret, redirect_uri)

@router.get("/auth/start")
async def start_linkedin_auth(user_id: str, org_id: str = None):
    """Start LinkedIn OAuth flow - user_id is required, org_id is optional"""
    # Get user-specific LinkedIn credentials
    client_id, client_secret, redirect_uri = await get_linkedin_credentials_for_user(user_id)
    
    linkedin = LinkedInAdapter(client_id=client_id, client_secret=client_secret)
    if redirect_uri:
        linkedin.redirect_uri = redirect_uri
    
    # Generate state token
    state = secrets.token_urlsafe(32)
    
    # Store state in session/db
    db = get_db()
    await db.oauth_states.insert_one({
        "state": state,
        "org_id": org_id,  # Optional - can be None
        "user_id": user_id,  # Required
        "created_at": datetime.utcnow().isoformat(),
        "expires_at": (datetime.utcnow() + timedelta(minutes=10)).isoformat()
    })
    
    # Get auth URL
    auth_url = linkedin.get_auth_url(state)
    
    return {"auth_url": auth_url, "state": state}

@router.get("/callback")
async def linkedin_callback(code: str, state: str):
    """Handle LinkedIn OAuth callback"""
    db = get_db()
    
    # Verify state
    state_doc = await db.oauth_states.find_one({"state": state})
    if not state_doc:
        # Return error page that closes popup
        html_content = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>LinkedIn Connection Error</title>
            <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';">
        </head>
        <body style="font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f0f2f5;">
            <div style="text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                <h2 style="color: #dc2626; margin-bottom: 10px;">Invalid State</h2>
                <p style="color: #6b7280;">This window will close automatically...</p>
            </div>
            <script>
                (function() {
                    try {
                        if (window.opener && !window.opener.closed) {
                            window.opener.postMessage({ type: 'linkedin-oauth-error', error: 'Invalid state' }, '*');
                        }
                        setTimeout(function() {
                            window.close();
                        }, 1500);
                    } catch (e) {
                        console.error('Error in OAuth callback:', e);
                        window.close();
                    }
                })();
            </script>
        </body>
        </html>
        """
        return HTMLResponse(content=html_content)
    
    # Check expiration
    expires_at = datetime.fromisoformat(state_doc['expires_at'])
    if datetime.utcnow() > expires_at:
        html_content = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>LinkedIn Connection Error</title>
            <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';">
        </head>
        <body style="font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f0f2f5;">
            <div style="text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                <h2 style="color: #dc2626; margin-bottom: 10px;">Token Expired</h2>
                <p style="color: #6b7280;">This window will close automatically...</p>
            </div>
            <script>
                (function() {
                    try {
                        if (window.opener && !window.opener.closed) {
                            window.opener.postMessage({ type: 'linkedin-oauth-error', error: 'Token expired' }, '*');
                        }
                        setTimeout(function() {
                            window.close();
                        }, 1500);
                    } catch (e) {
                        console.error('Error in OAuth callback:', e);
                        window.close();
                    }
                })();
            </script>
        </body>
        </html>
        """
        return HTMLResponse(content=html_content)
    
    org_id = state_doc['org_id']
    user_id = state_doc.get('user_id')
    
    try:
        # Get user-specific LinkedIn credentials
        client_id, client_secret, redirect_uri = None, None, None
        if user_id:
            client_id, client_secret, redirect_uri = await get_linkedin_credentials_for_user(user_id)
        
        # Exchange code for token
        linkedin = LinkedInAdapter(client_id=client_id, client_secret=client_secret)
        if redirect_uri:
            linkedin.redirect_uri = redirect_uri
        token_data = await linkedin.exchange_code_for_token(code)
        
        # Get user profile info from LinkedIn
        access_token = token_data['access_token']
        profile = await linkedin.get_user_profile(access_token)
        
        # Get person URN and organization IDs for analytics
        person_sub = profile.get('sub')  # LinkedIn person ID
        
        # Fetch managed organizations to get organization ID
        managed_orgs = await linkedin.get_managed_organizations(access_token)
        org_id_linkedin = managed_orgs[0]['id'] if managed_orgs else None
        
        print(f"   [LINKEDIN DATA] Person sub: {person_sub}")
        print(f"   [LINKEDIN DATA] Managed orgs: {len(managed_orgs)}")
        if org_id_linkedin:
            print(f"   [LINKEDIN DATA] First org ID: {org_id_linkedin}")
        
        # Store token and profile
        expires_in = token_data.get('expires_in', 5184000)  # 60 days default
        expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
        
        linkedin_data = {
            "linkedin_access_token": token_data['access_token'],
            "linkedin_token_expires": expires_at.isoformat(),
            "linkedin_profile": {
                "name": profile.get('name', 'LinkedIn User'),
                "email": profile.get('email', ''),
                "picture": profile.get('picture'),
                "sub": person_sub  # LinkedIn user ID
            },
            "linkedin_sub": person_sub,  # Top-level for easy access
            "linkedin_person_urn": f"urn:li:person:{person_sub}" if person_sub else None,
            "linkedin_organization_id": org_id_linkedin,  # For analytics API
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # ALWAYS save to user_settings (shared across all organizations)
        user_id = state_doc.get('user_id')
        print(f"[OAUTH] Saving LinkedIn connection")
        print(f"   user_id from state: {user_id}")
        print(f"   org_id from state: {org_id}")
        
        if user_id:
            print(f"   [SAVING] Updating user_settings for user: {user_id}")
            result = await db.user_settings.update_one(
                {"user_id": user_id},
                {"$set": linkedin_data},
                upsert=True
            )
            print(f"   [SUCCESS] user_settings updated: matched={result.matched_count}, modified={result.modified_count}, upserted_id={result.upserted_id}")
        else:
            print(f"   [ERROR] No user_id found in state - cannot save to user_settings!")
        
        # OPTIONALLY save to organization if org_id was provided
        if org_id:
            print(f"   [SAVING] Also updating organization: {org_id}")
            await db.organizations.update_one(
                {"id": org_id},
                {"$set": linkedin_data}
            )
        
        # Clean up state
        await db.oauth_states.delete_one({"state": state})
        
        # Return success page that closes popup
        org_id_str = str(org_id) if org_id else 'null'
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>LinkedIn Connected</title>
            <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';">
        </head>
        <body style="font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f0f2f5;">
            <div style="text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                <div style="width: 60px; height: 60px; background: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
                <h2 style="color: #1a1a1a; margin-bottom: 10px;">LinkedIn Connected!</h2>
                <p style="color: #6b7280;">This window will close automatically...</p>
            </div>
            <script>
                (function() {{
                    try {{
                        if (window.opener && !window.opener.closed) {{
                            window.opener.postMessage({{ type: 'linkedin-oauth-success', orgId: {org_id_str} }}, '*');
                        }}
                        setTimeout(function() {{
                            window.close();
                        }}, 1000);
                    }} catch (e) {{
                        console.error('Error in OAuth callback:', e);
                        window.close();
                    }}
                }})();
            </script>
        </body>
        </html>
        """
        return HTMLResponse(content=html_content)
    except Exception as e:
        error_msg = str(e).replace("'", "\\'").replace('"', '\\"')
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>LinkedIn Connection Error</title>
            <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';">
        </head>
        <body style="font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f0f2f5;">
            <div style="text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                <h2 style="color: #dc2626; margin-bottom: 10px;">Connection Failed</h2>
                <p style="color: #6b7280;">This window will close automatically...</p>
            </div>
            <script>
                (function() {{
                    try {{
                        if (window.opener && !window.opener.closed) {{
                            window.opener.postMessage({{ type: 'linkedin-oauth-error', error: '{error_msg}' }}, '*');
                        }}
                        setTimeout(function() {{
                            window.close();
                        }}, 1500);
                    }} catch (e) {{
                        console.error('Error in OAuth callback:', e);
                        window.close();
                    }}
                }})();
            </script>
        </body>
        </html>
        """
        return HTMLResponse(content=html_content)

@router.get("/profile")
async def get_linkedin_profile(org_id: str):
    """Get LinkedIn profile info for connected account"""
    db = get_db()
    
    # Get organization
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org or not org.get('linkedin_access_token'):
        raise HTTPException(status_code=404, detail="LinkedIn not connected")
    
    # Return stored profile data
    profile = org.get('linkedin_profile', {})
    
    return {
        "name": profile.get('name', 'LinkedIn User'),
        "email": profile.get('email', ''),
        "picture": profile.get('picture'),
        "sub": profile.get('sub'),
        "mock": False
    }

@router.get("/managed-organizations")
async def get_managed_linkedin_organizations(org_id: str, user_id: str):
    """Get list of LinkedIn organizations/companies that the user can manage"""
    print(f"[MANAGED-ORGS] Called with org_id={org_id}, user_id={user_id}")
    
    db = get_db()
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    
    if not org:
        print(f"[MANAGED-ORGS ERROR] Organization not found: {org_id}")
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # Get LinkedIn access token from user Settings (shared across all organizations)
    if not user_id:
        print(f"[MANAGED-ORGS ERROR] User ID is missing")
        raise HTTPException(status_code=400, detail="User ID is required")
    
    print(f"[MANAGED-ORGS] Fetching user_settings for user_id: {user_id}")
    settings = await db.user_settings.find_one({"user_id": user_id})
    
    if not settings:
        print(f"[MANAGED-ORGS ERROR] No user_settings found for user_id: {user_id}")
        raise HTTPException(status_code=400, detail="LinkedIn not connected. Please connect in Settings.")
    
    print(f"[MANAGED-ORGS] Settings found: {bool(settings)}")
    access_token = settings.get('linkedin_access_token')
    
    # Fallback: Check organization for token if user_settings doesn't have it
    if not access_token:
        print(f"[MANAGED-ORGS WARN] No access_token in user_settings for user_id: {user_id}")
        print(f"[MANAGED-ORGS] Available keys in settings: {list(settings.keys())}")
        # Try to get token from organization as fallback
        org_token = org.get('linkedin_access_token')
        if org_token:
            print(f"[MANAGED-ORGS] Found token in organization, using as fallback")
            access_token = org_token
            # Also copy to user_settings for future use
            await db.user_settings.update_one(
                {"user_id": user_id},
                {"$set": {
                    "linkedin_access_token": org_token,
                    "linkedin_token_expires": org.get('linkedin_token_expires'),
                    "linkedin_profile": org.get('linkedin_profile', {}),
                    "linkedin_sub": org.get('linkedin_sub'),
                    "linkedin_person_urn": org.get('linkedin_person_urn'),
                    "linkedin_organization_id": org.get('linkedin_organization_id'),
                    "updated_at": datetime.utcnow().isoformat()
                }},
                upsert=True
            )
            print(f"[MANAGED-ORGS] Copied token from organization to user_settings")
        else:
            print(f"[MANAGED-ORGS ERROR] No access_token found in user_settings or organization")
            raise HTTPException(status_code=400, detail="LinkedIn not connected. Please connect your LinkedIn account in Settings.")
    
    print(f"[MANAGED-ORGS] Access token found, length: {len(access_token) if access_token else 0}")
    
    # Get profile from settings, with fallback to organization
    linkedin_profile = settings.get('linkedin_profile', {})
    if not linkedin_profile and org.get('linkedin_profile'):
        linkedin_profile = org.get('linkedin_profile', {})
    
    # Initialize with dummy credentials to force real API mode
    linkedin = LinkedInAdapter(client_id="user_provided", client_secret="user_provided")
    linkedin.mock_mode = False  # Force real API calls
    
    managed_orgs = await linkedin.get_managed_organizations(access_token)
    
    # Include manually added companies
    manual_companies = org.get('manual_companies', [])
    
    # Merge auto-discovered and manual companies (avoid duplicates)
    all_orgs = list(managed_orgs)  # Copy auto-discovered
    for manual_org in manual_companies:
        # Check if not already in list
        if not any(org_item['id'] == manual_org['id'] for org_item in all_orgs):
            all_orgs.append(manual_org)
    
    print(f"[INFO] Total organizations: {len(all_orgs)} (auto: {len(managed_orgs)}, manual: {len(manual_companies)})")
    
    return {
        "personal": {
            "id": linkedin_profile.get('sub'),
            "name": linkedin_profile.get('name', 'Personal Profile'),
            "type": "personal"
        },
        "organizations": all_orgs
    }

@router.post("/add-manual-company")
async def add_manual_company(org_id: str, company: dict):
    """Add a manually entered company page"""
    db = get_db()
    
    org = await db.organizations.find_one({"id": org_id})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # Validate company data
    if not company.get('id') or not company.get('name'):
        raise HTTPException(status_code=400, detail="Company must have id and name")
    
    # Add to manual_companies list
    manual_companies = org.get('manual_companies', [])
    
    # Check if already exists
    if any(c['id'] == company['id'] for c in manual_companies):
        raise HTTPException(status_code=400, detail="Company already added")
    
    manual_companies.append({
        "id": company['id'],
        "name": company['name'],
        "vanityName": company.get('vanityName', ''),
        "localizedName": company['name'],
        "manual": True
    })
    
    await db.organizations.update_one(
        {"id": org_id},
        {"$set": {"manual_companies": manual_companies}}
    )
    
    print(f"[SUCCESS] Manual company added: {company['name']} (ID: {company['id']})")
    
    return {"success": True, "company": company}

@router.delete("/remove-manual-company/{company_id}")
async def remove_manual_company(org_id: str, company_id: str):
    """Remove a manually added company page"""
    db = get_db()
    
    org = await db.organizations.find_one({"id": org_id})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    manual_companies = org.get('manual_companies', [])
    manual_companies = [c for c in manual_companies if c['id'] != company_id]
    
    await db.organizations.update_one(
        {"id": org_id},
        {"$set": {"manual_companies": manual_companies}}
    )
    
    print(f"[SUCCESS] Manual company removed: ID {company_id}")
    
    return {"success": True}

    
    # Check if already exists
    if any(c['id'] == company['id'] for c in manual_companies):
        raise HTTPException(status_code=400, detail="Company already added")
    
    manual_companies.append({
        "id": company['id'],
        "name": company['name'],
        "vanityName": company.get('vanityName', ''),
        "localizedName": company['name'],
        "manual": True
    })
    
    await db.organizations.update_one(
        {"id": org_id},
        {"$set": {"manual_companies": manual_companies}}
    )
    
    print(f"[SUCCESS] Manual company added: {company['name']} (ID: {company['id']})")
    
    return {"success": True, "company": company}

@router.delete("/remove-manual-company/{company_id}")
async def remove_manual_company(org_id: str, company_id: str):
    """Remove a manually added company page"""
    db = get_db()
    
    org = await db.organizations.find_one({"id": org_id})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    manual_companies = org.get('manual_companies', [])
    manual_companies = [c for c in manual_companies if c['id'] != company_id]
    
    await db.organizations.update_one(
        {"id": org_id},
        {"$set": {"manual_companies": manual_companies}}
    )
    
    print(f"[SUCCESS] Manual company removed: ID {company_id}")
    
    return {"success": True}

    
    # Check if already exists
    if any(c['id'] == company['id'] for c in manual_companies):
        raise HTTPException(status_code=400, detail="Company already added")
    
    manual_companies.append({
        "id": company['id'],
        "name": company['name'],
        "vanityName": company.get('vanityName', ''),
        "localizedName": company['name'],
        "manual": True
    })
    
    await db.organizations.update_one(
        {"id": org_id},
        {"$set": {"manual_companies": manual_companies}}
    )
    
    print(f"[SUCCESS] Manual company added: {company['name']} (ID: {company['id']})")
    
    return {"success": True, "company": company}

@router.delete("/remove-manual-company/{company_id}")
async def remove_manual_company(org_id: str, company_id: str):
    """Remove a manually added company page"""
    db = get_db()
    
    org = await db.organizations.find_one({"id": org_id})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    manual_companies = org.get('manual_companies', [])
    manual_companies = [c for c in manual_companies if c['id'] != company_id]
    
    await db.organizations.update_one(
        {"id": org_id},
        {"$set": {"manual_companies": manual_companies}}
    )
    
    print(f"[SUCCESS] Manual company removed: ID {company_id}")
    
    return {"success": True}
