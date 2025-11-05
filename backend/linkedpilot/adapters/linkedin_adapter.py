import os
from typing import Optional, Dict
import httpx
from datetime import datetime, timedelta

class LinkedInAdapter:
    """Adapter for LinkedIn API operations"""
    
    def __init__(self, client_id: str = None, client_secret: str = None):
        # Allow override of credentials, otherwise fall back to environment variables
        self.client_id = client_id or os.getenv('LINKEDIN_CLIENT_ID')
        self.client_secret = client_secret or os.getenv('LINKEDIN_CLIENT_SECRET')
        self.redirect_uri = os.getenv('LINKEDIN_REDIRECT_URI')
        # Only use mock mode if explicitly set to true AND no credentials provided
        self.mock_mode = (not self.client_id or not self.client_secret) or os.getenv('LINKEDIN_MOCK', 'false').lower() == 'true'
        self.base_url = "https://api.linkedin.com/v2"
    
    def get_auth_url(self, state: str) -> str:
        """Generate LinkedIn OAuth URL"""
        if self.mock_mode:
            # Use absolute URL for popup compatibility
            return f"http://localhost:8000/api/linkedin/callback?code=mock_code&state={state}"
        
        # Use all approved scopes including organization management
        scopes = [
            "openid",                   # For userinfo endpoint
            "profile",                  # Basic profile info
            "email",                    # User email
            "w_member_social",          # Post as member/user
            "r_organization_admin",     # Read organization admin data - NOW ENABLED!
            "w_organization_social",    # Post to organization pages - NOW ENABLED!
        ]
        scope_str = " ".join(scopes)
        
        return (
            f"https://www.linkedin.com/oauth/v2/authorization?"
            f"response_type=code&client_id={self.client_id}"
            f"&redirect_uri={self.redirect_uri}&state={state}&scope={scope_str}"
        )
    
    async def exchange_code_for_token(self, code: str) -> Dict:
        """Exchange authorization code for access token"""
        if self.mock_mode:
            return {
                "access_token": "mock_access_token_" + code,
                "expires_in": 5184000,  # 60 days
                "refresh_token": "mock_refresh_token"
            }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://www.linkedin.com/oauth/v2/accessToken",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "redirect_uri": self.redirect_uri
                }
            )
            response.raise_for_status()
            return response.json()
    
    async def upload_media(self, access_token: str, org_id: str, media_url: str, media_type: str = "image", is_organization: bool = False) -> str:
        """Upload media to LinkedIn and return asset URN
        
        Args:
            access_token: LinkedIn access token
            org_id: LinkedIn person ID or organization ID
            media_url: URL of the image to upload
            media_type: Type of media (default: image)
            is_organization: True if posting to organization page, False for personal
        
        Returns:
            Asset URN
        """
        if self.mock_mode:
            return f"urn:li:digitalmediaAsset:mock_{media_type}_{datetime.now().timestamp()}"
        
        # Real LinkedIn media upload flow:
        # 1. Register upload
        # 2. Get upload URL
        # 3. PUT media to upload URL
        # 4. Return asset URN
        
        # CRITICAL: Owner URN must match post author type
        owner_urn = f"urn:li:organization:{org_id}" if is_organization else f"urn:li:person:{org_id}"
        
        print(f"   [MEDIA UPLOAD] Owner URN: {owner_urn}")
        print(f"   [MEDIA UPLOAD] Is Organization: {is_organization}")
        
        async with httpx.AsyncClient() as client:
            # Step 1: Register upload
            register_response = await client.post(
                f"{self.base_url}/assets?action=registerUpload",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                },
                json={
                    "registerUploadRequest": {
                        "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
                        "owner": owner_urn,
                        "serviceRelationships": [{
                            "relationshipType": "OWNER",
                            "identifier": "urn:li:userGeneratedContent"
                        }]
                    }
                }
            )
            register_data = register_response.json()
            
            # Step 2 & 3: Upload media
            upload_url = register_data['value']['uploadMechanism']['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']['uploadUrl']
            asset_urn = register_data['value']['asset']
            
            # Prepare bytes to upload: support data URLs and http(s) URLs
            content_bytes = None
            content_type = "image/jpeg"
            try:
                if isinstance(media_url, str) and media_url.startswith("data:") and ";base64," in media_url:
                    header, b64 = media_url.split(",", 1)
                    # Extract content type from header: data:image/png;base64
                    if header.startswith("data:") and ";base64" in header:
                        ct = header[5:header.index(";")]
                        if ct:
                            content_type = ct
                    import base64 as _b64
                    content_bytes = _b64.b64decode(b64)
                else:
            media_response = await client.get(media_url)
                    media_response.raise_for_status()
                    content_bytes = media_response.content
                    # Try to get content type from headers
                    ct = media_response.headers.get("Content-Type")
                    if ct:
                        content_type = ct
            except Exception as e:
                raise Exception(f"Failed to read media: {e}")
            
            # Upload bytes to LinkedIn provided URL
            await client.put(upload_url, content=content_bytes, headers={"Content-Type": content_type})
            
            return asset_urn
    
    async def upload_document(self, access_token: str, document_url: str, author_id: str, title: str = "Document") -> str:
        """Upload document (PDF) to LinkedIn
        
        Args:
            access_token: LinkedIn access token
            document_url: URL of the document to upload
            author_id: LinkedIn person/organization ID
            title: Document title
            
        Returns:
            Document URN
        """
        if self.mock_mode:
            return f"urn:li:document:mock_{datetime.now().timestamp()}"
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            # Step 1: Initialize upload
            init_response = await client.post(
                f"{self.base_url}/assets?action=registerUpload",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                    "X-Restli-Protocol-Version": "2.0.0"
                },
                json={
                    "registerUploadRequest": {
                        "owner": f"urn:li:person:{author_id}",
                        "recipes": ["urn:li:digitalmediaRecipe:feedshare-document"],
                        "serviceRelationships": [{
                            "identifier": "urn:li:userGeneratedContent",
                            "relationshipType": "OWNER"
                        }],
                        "supportedUploadMechanism": ["SYNCHRONOUS_UPLOAD"]
                    }
                }
            )
            init_response.raise_for_status()
            init_data = init_response.json()
            
            # Get upload URL and asset URN
            upload_url = init_data['value']['uploadMechanism']['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']['uploadUrl']
            asset_urn = init_data['value']['asset']
            
            # Step 2: Download document
            doc_response = await client.get(document_url)
            doc_response.raise_for_status()
            
            # Step 3: Upload document binary
            upload_response = await client.put(
                upload_url,
                content=doc_response.content,
                headers={
                    "Content-Type": "application/pdf"  # or detect from document_url
                }
            )
            upload_response.raise_for_status()
            
            return asset_urn
    
    async def create_post_ugc(self, access_token: str, author_id: str, content: Dict, media_urns: list = None, is_organization: bool = False) -> Dict:
        """Create LinkedIn post using legacy UGC Posts API (more stable for organizations with media)"""
        if self.mock_mode:
            return {"id": f"mock_post_{datetime.now().timestamp()}", "url": "https://linkedin.com/feed/update/mock"}
        
        author_urn = f"urn:li:organization:{author_id}" if is_organization else f"urn:li:person:{author_id}"
        
        print(f"[UGC API] Creating post using legacy ugcPosts API...")
        print(f"   Author: {author_urn}")
        
        post_data = {
            "author": author_urn,
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {
                        "text": content.get("body", "")
                    },
                    "shareMediaCategory": "NONE"
                }
            },
            "visibility": {
                "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
            }
        }
        
        # Add media if provided
        if media_urns and len(media_urns) > 0:
            if len(media_urns) == 1:
                post_data["specificContent"]["com.linkedin.ugc.ShareContent"]["shareMediaCategory"] = "IMAGE"
                post_data["specificContent"]["com.linkedin.ugc.ShareContent"]["media"] = [{
                    "status": "READY",
                    "media": media_urns[0]
                }]
            else:
                # Multiple images (carousel)
                post_data["specificContent"]["com.linkedin.ugc.ShareContent"]["shareMediaCategory"] = "IMAGE"
                post_data["specificContent"]["com.linkedin.ugc.ShareContent"]["media"] = [
                    {"status": "READY", "media": urn} for urn in media_urns
                ]
        
        print(f"[UGC] Payload:")
        import json
        print(json.dumps(post_data, indent=2))
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/ugcPosts",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                    "X-Restli-Protocol-Version": "2.0.0"
                },
                json=post_data
            )
            
            print(f"[UGC] Response: {response.status_code}")
            print(f"[UGC] Headers: {dict(response.headers)}")
            print(f"[UGC] Body: {response.text}")
            
            if response.status_code not in [200, 201]:
                response.raise_for_status()
            
            # Get post ID from header
            post_id = response.headers.get("X-RestLi-Id", "")
            share_urn = f"urn:li:share:{post_id}" if post_id else ""
            
            return {
                "id": share_urn,
                "url": f"https://www.linkedin.com/feed/update/{share_urn}/" if share_urn else None
            }
    
    async def create_post(self, access_token: str, author_id: str, content: Dict, media_urns: list = None, is_organization: bool = False, media_category: str = None) -> Dict:
        """Create LinkedIn post
        
        Args:
            access_token: LinkedIn access token
            author_id: LinkedIn user ID (sub) or organization ID
            content: Post content dict with 'body' key
            media_urns: Optional list of media/document URNs
            is_organization: If True, post as organization. If False, post as person.
            media_category: "NONE", "IMAGE" (single/carousel), "ARTICLE", or "DOCUMENT"
        """
        # If we have a real access_token, NEVER use mock mode
        if self.mock_mode and not access_token:
            post_id = f"urn:li:share:mock_{datetime.now().timestamp()}"
            return {
                "id": post_id,
                "url": f"https://www.linkedin.com/feed/update/{post_id}",
                "created_at": datetime.now().isoformat()
            }
        
        # CRITICAL DECISION: LinkedIn's newer Posts API is BROKEN for ALL posts with media
        # Testing shows 500 errors for both personal and organization posts with media
        # Use the proven legacy UGC Posts API for ANY post with media
        if media_urns and len(media_urns) > 0:
            print(f"[STRATEGY] Post with media detected (author: {'org' if is_organization else 'personal'})")
            print(f"[STRATEGY] Using legacy UGC Posts API - Posts API is broken for media")
            return await self.create_post_ugc(access_token, author_id, content, media_urns, is_organization)
        
        # Choose author URN based on type
        if is_organization:
            author_urn = f"urn:li:organization:{author_id}"
        else:
            author_urn = f"urn:li:person:{author_id}"
        
        print(f"[DRAFT] Creating LinkedIn post using modern Posts API...")
        print(f"   Author: {author_urn}")
        print(f"   Content: {content.get('body', '')[:100]}...")
        print(f"   Media URNs: {len(media_urns) if media_urns else 0}")
        
        # Build post using new LinkedIn Posts API format
        # Reference: https://learn.microsoft.com/en-gb/linkedin/marketing/
        post_data = {
            "author": author_urn,
            "commentary": content.get("body", ""),
            "visibility": "PUBLIC",
            "distribution": {
                "feedDistribution": "MAIN_FEED",
                "targetEntities": [],
                "thirdPartyDistributionChannels": []
            },
            "lifecycleState": "PUBLISHED",
            "isReshareDisabledByAuthor": False
        }
        
        # Add media content if provided
        if media_urns and len(media_urns) > 0:
            print(f"   Adding {len(media_urns)} media items...")
            
            # Determine content type
            is_document = any("document" in str(urn) for urn in media_urns)
            
            if is_document:
                # Document/Article post
                post_data["content"] = {
                    "article": {
                        "source": media_urns[0],  # First document
                        "title": content.get("title", "Document"),
                        "description": content.get("body", "")
                    }
                }
            elif len(media_urns) == 1:
                # Single image post - use correct format for Posts API
                # LinkedIn Posts API requires "title" for media
                post_data["content"] = {
                    "media": {
                        "title": "Image",  # Required field
                        "id": media_urns[0]
                    }
                }
            else:
                # Carousel post (multiple images)
                # Each image needs title and id
                post_data["content"] = {
                    "multiImage": {
                        "images": [{"title": f"Slide {i+1}", "id": urn} for i, urn in enumerate(media_urns)]
                    }
                }
        
        print(f"[SEND] Sending to LinkedIn Posts API...")
        print(f"[DEBUG] Full payload:")
        import json
        print(json.dumps(post_data, indent=2))
        
        async with httpx.AsyncClient(timeout=60.0) as client:  # Increased timeout for media posts
            # Use new /posts endpoint (not ugcPosts)
            # According to LinkedIn docs, Linkedin-Version header is required (format: YYYYMM)
            from datetime import datetime
            version_header = datetime.now().strftime("%Y%m")  # e.g., "202510" for October 2025
            
            # Retry logic for media posts (LinkedIn sometimes needs time to process)
            max_retries = 2 if media_urns else 0
            retry_delay = 3  # seconds
            
            for attempt in range(max_retries + 1):
                if attempt > 0:
                    print(f"[RETRY] Attempt {attempt + 1} of {max_retries + 1} after {retry_delay}s delay...")
                    import asyncio
                    await asyncio.sleep(retry_delay)
                
                response = await client.post(
                    f"{self.base_url}/posts",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json",
                        "X-Restli-Protocol-Version": "2.0.0",
                        "Linkedin-Version": version_header  # Required by Posts API
                    },
                    json=post_data
                )
                
                print(f"📬 LinkedIn response: {response.status_code} (attempt {attempt + 1})")
                print(f"📬 Response headers: {dict(response.headers)}")
                print(f"📬 Response body: '{response.text}'")
                
                # Success!
                if response.status_code in [200, 201]:
                    break
                    
                # If this is not the last attempt and we got a 500 (likely media processing), retry
                if attempt < max_retries and response.status_code == 500 and media_urns:
                    print(f"[INFO] Got 500 error with media post. LinkedIn may still be processing the asset. Retrying...")
                    continue
                    
                # If all retries failed with 500 and this is an organization post with media, try UGC API
                if response.status_code == 500 and is_organization and media_urns:
                    print(f"[FALLBACK] Posts API failed for organization with media. Trying legacy UGC API...")
                    try:
                        return await self.create_post_ugc(access_token, author_id, content, media_urns, is_organization)
                    except Exception as ugc_error:
                        print(f"[ERROR] UGC API also failed: {ugc_error}")
                        # Fall through to raise the original error
                    
                # Otherwise, this is an error
                error_detail = response.text
                print(f"[ERROR] LinkedIn API error: {error_detail}")
                response.raise_for_status()
            
            # LinkedIn Posts API returns post ID in X-RestLi-Id header (body is often empty)
            post_id = response.headers.get("X-RestLi-Id", "")
            
            # If no header, try parsing JSON body (fallback)
            if not post_id and response.text:
                try:
                    result = response.json()
                    post_id = result.get("id", "")
                except:
                    pass
            
            if not post_id:
                print(f"[WARNING] Warning: No post ID found in response!")
                post_id = f"unknown_{datetime.now().timestamp()}"
            
            # Extract share URN for URL
            share_urn = post_id
            if ":" in share_urn:
                share_id = share_urn.split(":")[-1]
            else:
                share_id = share_urn
            
            post_url = f"https://www.linkedin.com/feed/update/{share_urn}"
            
            print(f"[SUCCESS] Post created successfully!")
            print(f"   Post ID: {post_id}")
            print(f"   URL: {post_url}")
            
            return {
                "id": post_id,
                "url": post_url,
                "created_at": datetime.now().isoformat()
            }
    
    async def get_user_profile(self, access_token: str) -> Dict:
        """Get LinkedIn user profile using userinfo endpoint"""
        if self.mock_mode:
            return {
                "sub": "mock_user_id_123",
                "name": "Mock LinkedIn User",
                "given_name": "Mock",
                "family_name": "User",
                "picture": None,
                "email": "mock@linkedin.com",
                "email_verified": True,
                "locale": {"country": "US", "language": "en"}
            }
        
        async with httpx.AsyncClient() as client:
            # Use the OpenID Connect userinfo endpoint
            response = await client.get(
                "https://api.linkedin.com/v2/userinfo",
                headers={
                    "Authorization": f"Bearer {access_token}"
                }
            )
            response.raise_for_status()
            return response.json()
    
    async def get_managed_organizations(self, access_token: str) -> list:
        """Get list of organizations/companies that the user can manage
        
        Returns list of dicts with:
        - id: Organization ID (numeric)
        - name: Organization name
        - vanityName: Organization vanity name
        - localizedName: Localized organization name
        """
        if self.mock_mode:
            return []  # Return empty list, not mock data
        
        organizations = []
        
        # Try Method 1: Ad Accounts (works with Advertising API approval)
        try:
            async with httpx.AsyncClient() as client:
                print(f"\n{'='*80}")
                print(f"🔍 COMPANY DISCOVERY DEBUG")
                print(f"{'='*80}")
                print(f"[INFO] Method 1: Fetching organizations via Ad Accounts (Advertising API)...")
                print(f"   Endpoint: {self.base_url}/adAccounts")
                print(f"   Params: q=search, role=ADMINISTRATOR, status=ACTIVE")
                print(f"   Access token: {access_token[:20]}...{access_token[-10:]}")
                
                response = await client.get(
                    f"{self.base_url}/adAccounts",
                    params={
                        "q": "search",
                        "role": "ADMINISTRATOR",
                        "status": "ACTIVE"
                    },
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "LinkedIn-Version": "202304"
                    },
                    timeout=10.0
                )
                
                print(f"   Response status: {response.status_code}")
                print(f"   Response headers: {dict(response.headers)}")
                
                if response.status_code == 200:
                    data = response.json()
                    print(f"   Response body: {data}")
                    elements = data.get('elements', [])
                    print(f"[SUCCESS] Ad Accounts API successful: {len(elements)} accounts found")
                    
                    if len(elements) == 0:
                        print(f"[WARNING] WARNING: Ad Accounts returned 0 accounts!")
                        print(f"   This could mean:")
                        print(f"   1. You don't have any ad accounts set up")
                        print(f"   2. You're not an ADMINISTRATOR on any ad accounts")
                        print(f"   3. All ad accounts are INACTIVE")
                        print(f"   4. The access token doesn't have r_ads scope")
                    
                    for account in elements:
                        print(f"\n   [DATA] Processing ad account: {account}")
                        
                        # Get organization from reference field
                        org_ref = account.get('reference')
                        print(f"      Reference field: {org_ref}")
                        
                        if org_ref and 'organization:' in org_ref:
                            numeric_id = org_ref.split('organization:')[-1]
                            
                            # Fetch organization details
                            try:
                                org_response = await client.get(
                                    f"{self.base_url}/organizations/{numeric_id}",
                                    headers={
                                        "Authorization": f"Bearer {access_token}",
                                        "LinkedIn-Version": "202304"
                                    },
                                    timeout=5.0
                                )
                                
                                if org_response.status_code == 200:
                                    org_data = org_response.json()
                                    org_name = org_data.get('localizedName', 'Unknown Company')
                                    org_vanity = org_data.get('vanityName', '')
                                    
                                    # Avoid duplicates
                                    if not any(o['id'] == numeric_id for o in organizations):
                                        organizations.append({
                                            "id": numeric_id,
                                            "name": org_name,
                                            "vanityName": org_vanity,
                                            "localizedName": org_name
                                        })
                                        print(f"   [SUCCESS] Added: {org_name} (ID: {numeric_id})")
                            except Exception as org_err:
                                print(f"   [WARNING] Could not fetch org details for {numeric_id}: {org_err}")
                    
                    if len(organizations) > 0:
                        print(f"[SUCCESS] Found {len(organizations)} organizations via Ad Accounts")
                        return organizations
                    else:
                        print(f"[WARNING] No organizations found in ad accounts, trying fallback...")
                        
                elif response.status_code == 403:
                    print(f"[WARNING] Ad Accounts returned 403")
                    print(f"   Trying organizationAcls fallback...")
                else:
                    print(f"[WARNING] Ad Accounts returned {response.status_code}")
                    
        except Exception as e:
            print(f"[WARNING] Ad Accounts method failed: {e}")
        
        # Try Method 2: organizationAcls (Community Management API)
        try:
            async with httpx.AsyncClient() as client:
                print(f"[INFO] Fetching managed organizations via organizationAcls...")
                response = await client.get(
                    f"{self.base_url}/organizationAcls",
                    params={
                        "q": "roleAssignee",
                        "projection": "(elements*(organization~(id,localizedName,vanityName),roleAssignee,state))"
                    },
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "LinkedIn-Version": "202304"
                    },
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    print(f"[SUCCESS] organizationAcls successful: {len(data.get('elements', []))} entries")
                    print(f"   Raw response: {data}")
                    
                    for element in data.get('elements', []):
                        print(f"\n   [DATA] Processing element: {element}")
                        print(f"      State: {element.get('state')}")
                        
                        if element.get('state') == 'APPROVED':
                            org_data = element.get('organization~', {})
                            print(f"      Organization data: {org_data}")
                            
                            org_id = org_data.get('id')
                            print(f"      org_id type: {type(org_id)}, value: {org_id}")
                            
                            # Extract numeric ID from URN (urn:li:organization:12345678)
                            if org_id:
                                org_id_str = str(org_id)  # Convert to string first
                                if 'organization:' in org_id_str:
                                    numeric_id = org_id_str.split('organization:')[-1]
                                else:
                                    numeric_id = org_id_str
                            else:
                                print(f"      [WARNING] No org_id found!")
                                continue
                            
                            print(f"      Extracted numeric_id: {numeric_id}")
                            
                            # Avoid duplicates
                            if not any(o['id'] == numeric_id for o in organizations):
                                org_name = org_data.get('localizedName', 'Unknown')
                                organizations.append({
                                    "id": numeric_id,
                                    "name": org_name,
                                    "vanityName": org_data.get('vanityName', ''),
                                    "localizedName": org_name
                                })
                                print(f"      [SUCCESS] Added: {org_name} (ID: {numeric_id})")
                            else:
                                print(f"      [SKIP] Skipped (duplicate)")
                    
                    if len(organizations) > 0:
                        print(f"\n[SUCCESS] Found {len(organizations)} organizations via organizationAcls")
                        return organizations
                    else:
                        print(f"\n[WARNING] No approved organizations found in organizationAcls")
                elif response.status_code == 403:
                    print(f"[WARNING] organizationAcls returned 403 (requires Community Management API)")
                else:
                    print(f"[WARNING] organizationAcls returned {response.status_code}")
                    
        except Exception as e:
            print(f"[WARNING] organizationAcls method failed: {e}")
        
        # Method 2: Try to get organizations from user's profile/companies
        try:
            async with httpx.AsyncClient() as client:
                print(f"[INFO] Fetching organizations via profile companies...")
                
                # Get user's profile which includes company affiliations
                profile_response = await client.get(
                    f"{self.base_url}/me",
                    params={
                        "projection": "(id,localizedFirstName,localizedLastName,positions)"
                    },
                    headers={
                        "Authorization": f"Bearer {access_token}"
                    },
                    timeout=10.0
                )
                
                if profile_response.status_code == 200:
                    profile_data = profile_response.json()
                    print(f"[SUCCESS] Profile data retrieved")
                    
                    # Check if user has positions with companies
                    positions = profile_data.get('positions', {}).get('values', [])
                    for position in positions:
                        if position.get('company'):
                            company = position['company']
                            if company.get('id'):
                                org_id = str(company['id'])
                                org_name = company.get('name', 'Unknown Company')
                                
                                # Avoid duplicates
                                if not any(org['id'] == org_id for org in organizations):
                                    organizations.append({
                                        "id": org_id,
                                        "name": org_name,
                                        "vanityName": "",
                                        "localizedName": org_name
                                    })
                    
                    print(f"[SUCCESS] Found {len(organizations)} companies from profile")
                    return organizations
                    
        except Exception as e:
            print(f"[WARNING] Profile companies method failed: {e}")
        
        # Method 3: Return empty list with helpful message
        print(f"[INFO] No managed organizations found.")
        print(f"   This is normal if:")
        print(f"   1. You don't manage any company pages")
        print(f"   2. Your LinkedIn app needs Marketing Developer Platform approval")
        print(f"   3. You haven't granted r_organization_admin scope")
        
        return []
    
    async def get_user_id(self, access_token: str) -> str:
        """Get LinkedIn user ID (person URN)"""
        if self.mock_mode:
            return "mock_user_id_123"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/me",
                headers={
                    "Authorization": f"Bearer {access_token}"
                }
            )
            response.raise_for_status()
            data = response.json()
            return data.get("id")
    
    async def get_post_reactions(self, access_token: str, post_urn: str) -> int:
        """Get reaction count for a post using REST API
        
        Reference: GET https://api.linkedin.com/rest/reactions?q=entity&entity={shareUrn}
        """
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    "https://api.linkedin.com/rest/reactions",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "LinkedIn-Version": "202410",
                        "X-Restli-Protocol-Version": "2.0.0"
                    },
                    params={
                        "q": "entity",
                        "entity": post_urn
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    # Count total reactions from the paging info
                    return data.get('paging', {}).get('total', 0)
                else:
                    print(f"   [REACTIONS] Error {response.status_code}: {response.text[:200]}")
                    return 0
        except Exception as e:
            print(f"   [REACTIONS] Failed: {e}")
            return 0
    
    async def get_post_comments_count(self, access_token: str, post_urn: str) -> int:
        """Get comment count for a post using REST API
        
        Reference: GET https://api.linkedin.com/rest/socialActions/{shareUrn}/comments
        """
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    f"https://api.linkedin.com/rest/socialActions/{post_urn}/comments",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "LinkedIn-Version": "202410",
                        "X-Restli-Protocol-Version": "2.0.0"
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    # Count total comments from the paging info
                    return data.get('paging', {}).get('total', 0)
                else:
                    print(f"   [COMMENTS] Error {response.status_code}: {response.text[:200]}")
                    return 0
        except Exception as e:
            print(f"   [COMMENTS] Failed: {e}")
            return 0
    
    async def get_post_analytics(self, access_token: str, post_urn: str, organization_id: str = None) -> Dict:
        """Get REAL analytics for a post using LinkedIn REST API
        
        Uses the correct REST API endpoints:
        - GET /rest/reactions?q=entity&entity={shareUrn} for reactions
        - GET /rest/socialActions/{shareUrn}/comments for comments
        
        Requires scopes:
        - r_organization_social (retrieve engagement data)
        - r_organization_admin (retrieve analytics)
        
        Args:
            access_token: LinkedIn OAuth access token
            post_urn: Post URN (urn:li:share:xxx or urn:li:ugcPost:xxx)
            organization_id: Optional organization ID for better analytics accuracy
        """
        if self.mock_mode and not access_token:
            import random
            return {
                "impressions": random.randint(500, 5000),
                "reactions": random.randint(20, 200),
                "comments": random.randint(5, 50),
                "shares": random.randint(2, 30),
                "clicks": random.randint(30, 300)
            }
        
        print(f"\n[ANALYTICS] Fetching real analytics from LinkedIn REST API...")
        print(f"   Post URN: {post_urn}")
        print(f"   Organization ID: {organization_id or 'Not provided'}")
        
        # Use REST API endpoints to get reactions and comments
        try:
            # Get reactions count
            print(f"   [1] Fetching reactions via REST API...")
            reactions = await self.get_post_reactions(access_token, post_urn)
            print(f"   [REACTIONS] Found {reactions} reactions")
            
            # Get comments count
            print(f"   [2] Fetching comments via REST API...")
            comments = await self.get_post_comments_count(access_token, post_urn)
            print(f"   [COMMENTS] Found {comments} comments")
            
            analytics = {
                "impressions": 0,  # Not available via current API
                "reactions": reactions,
                "comments": comments,
                "shares": 0,  # Not available via current API
                "clicks": 0  # Not available via current API
            }
            
            print(f"   [SUCCESS] Analytics: reactions={reactions}, comments={comments}")
            return analytics
            
        except Exception as e:
            print(f"   [ERROR] Failed to fetch analytics: {e}")
            return {
                "impressions": 0,
                "reactions": 0,
                "comments": 0,
                "shares": 0,
                "clicks": 0
            }
        
        # OLD CODE - Keep as fallback (though it doesn't work with current scopes)
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                # Method 1: DEPRECATED - organizationalEntityShareStatistics
                # Reference: https://docs.microsoft.com/linkedin/marketing/integrations/community-management/organizations/share-statistics
                if organization_id:
                    try:
                        print(f"   [1] Trying organizationalEntityShareStatistics endpoint (NEW)...")
                        response = await client.get(
                            f"{self.base_url}/organizationalEntityShareStatistics",
                            headers={
                                "Authorization": f"Bearer {access_token}",
                                "LinkedIn-Version": "202410",  # Latest version
                                "X-Restli-Protocol-Version": "2.0.0"
                            },
                            params={
                                "q": "organizationalEntity",
                                "organizationalEntity": f"urn:li:organization:{organization_id}",
                                "shares": post_urn  # Try without array notation
                            }
                        )
                        
                        print(f"   Response: {response.status_code}")
                        if response.status_code != 200:
                            print(f"   Error Details: {response.text}")
                        
                        if response.status_code == 200:
                            data = response.json()
                            elements = data.get('elements', [])
                            if elements:
                                stats = elements[0]
                                total_share_statistics = stats.get('totalShareStatistics', {})
                                
                                analytics = {
                                    "impressions": total_share_statistics.get('impressionCount', 0) + total_share_statistics.get('uniqueImpressionsCount', 0),
                                    "reactions": total_share_statistics.get('likeCount', 0) + total_share_statistics.get('engagement', 0),
                                    "comments": total_share_statistics.get('commentCount', 0),
                                    "shares": total_share_statistics.get('shareCount', 0),
                                    "clicks": total_share_statistics.get('clickCount', 0)
                                }
                                print(f"   [SUCCESS] Got real analytics from organizationalEntityShareStatistics: {analytics}")
                                return analytics
                    except Exception as e1:
                        print(f"   [1] Failed: {e1}")
                
                # Method 2: organizationShareStatistics (fallback)
                # This is the primary endpoint for post analytics with r_organization_social scope
                try:
                    print(f"   [2] Trying organizationShareStatistics endpoint...")
                    response = await client.get(
                        f"{self.base_url}/organizationShareStatistics",
                        headers={
                            "Authorization": f"Bearer {access_token}",
                            "LinkedIn-Version": "202410",
                            "X-Restli-Protocol-Version": "2.0.0"
                        },
                        params={
                            "q": "share",
                            "share": post_urn
                        }
                    )
                    
                    print(f"   Response: {response.status_code}")
                    if response.status_code != 200:
                        print(f"   Error Details: {response.text}")
                    
                    if response.status_code == 200:
                        data = response.json()
                        elements = data.get('elements', [])
                        if elements:
                            stats = elements[0]
                            total_share_statistics = stats.get('totalShareStatistics', {})
                            
                            analytics = {
                                "impressions": total_share_statistics.get('impressionCount', 0) + total_share_statistics.get('uniqueImpressionsCount', 0),
                                "reactions": total_share_statistics.get('likeCount', 0) + total_share_statistics.get('engagement', 0),
                                "comments": total_share_statistics.get('commentCount', 0),
                                "shares": total_share_statistics.get('shareCount', 0),
                                "clicks": total_share_statistics.get('clickCount', 0)
                            }
                            print(f"   [SUCCESS] Got real analytics from organizationShareStatistics: {analytics}")
                            return analytics
                except Exception as e2:
                    print(f"   [2] Failed: {e2}")
                
                # Method 3: Try Social Actions endpoint (for engagement counts)
                try:
                    print(f"   [3] Trying socialActions endpoint...")
                    response = await client.get(
                        f"{self.base_url}/socialActions/{post_urn}",
                        headers={
                            "Authorization": f"Bearer {access_token}",
                            "LinkedIn-Version": "202410",
                            "X-Restli-Protocol-Version": "2.0.0"
                        }
                    )
                    
                    print(f"   Response: {response.status_code}")
                    if response.status_code != 200:
                        print(f"   Error Details: {response.text}")
                    
                    if response.status_code == 200:
                        data = response.json()
                        analytics = {
                            "impressions": data.get('impressionCount', 0),
                            "reactions": data.get('likeCount', 0) + data.get('praiseCount', 0) + data.get('empathyCount', 0) + data.get('interestCount', 0) + data.get('appreciationCount', 0) + data.get('entertainmentCount', 0),
                            "comments": data.get('commentCount', 0),
                            "shares": data.get('shareCount', 0),
                            "clicks": data.get('clickCount', 0)
                        }
                        print(f"   [SUCCESS] Got real analytics from socialActions: {analytics}")
                        return analytics
                except Exception as e3:
                    print(f"   [3] Failed: {e3}")
                
                # Method 4: Try UGC Post Statistics (legacy API)
                try:
                    print(f"   [4] Trying ugcPosts statistics...")
                    # Extract share ID
                    share_id = post_urn.split(':')[-1] if ':' in post_urn else post_urn
                    
                    response = await client.get(
                        f"{self.base_url}/ugcPosts/{share_id}",
                        headers={
                            "Authorization": f"Bearer {access_token}",
                            "LinkedIn-Version": "202410",
                            "X-Restli-Protocol-Version": "2.0.0"
                        }
                    )
                    
                    print(f"   Response: {response.status_code}")
                    if response.status_code != 200:
                        print(f"   Error Details: {response.text}")
                    
                    if response.status_code == 200:
                        data = response.json()
                        # UGC posts may have embedded stats
                        stats = data.get('statistics', {})
                        analytics = {
                            "impressions": stats.get('viewCount', 0),
                            "reactions": stats.get('numLikes', 0),
                            "comments": stats.get('numComments', 0),
                            "shares": stats.get('numShares', 0),
                            "clicks": stats.get('clickCount', 0)
                        }
                        print(f"   [SUCCESS] Got real analytics from ugcPosts: {analytics}")
                        return analytics
                except Exception as e4:
                    print(f"   [4] Failed: {e4}")
                
        except Exception as e:
            print(f"   [ERROR] All analytics methods failed: {e}")
        
        # If all methods fail, LinkedIn may show analytics on their platform only
        # Return zeros to indicate "no data available via API"
        print(f"   [INFO] Returning zeros - check LinkedIn.com for real analytics")
        return {
            "impressions": 0,
            "reactions": 0,
            "comments": 0,
            "shares": 0,
            "clicks": 0
        }
    
    async def get_all_user_posts(self, access_token: str, author_id: str, count: int = 50) -> list:
        """Fetch all posts from LinkedIn for a user/organization
        
        Uses the r_organization_social scope to retrieve posts.
        Returns list of post objects with URN, content, created time, etc.
        """
        if self.mock_mode and not access_token:
            return []
        
        print(f"\n[LINKEDIN] Fetching all posts from LinkedIn API...")
        print(f"   Author ID: {author_id}")
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # LinkedIn's Posts API - try multiple approaches
                
                # Construct author URN
                if not author_id.startswith('urn:'):
                    # Assume it's just the ID, need to determine if person or org
                    author_urn = f"urn:li:person:{author_id}"
                else:
                    author_urn = author_id
                
                print(f"   Author URN: {author_urn}")
                
                # Method 1: Modern REST API - /rest/posts
                # Docs: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
                try:
                    print(f"   [1] Trying /rest/posts endpoint (Modern REST API)...")
                    response = await client.get(
                        "https://api.linkedin.com/rest/posts",
                        headers={
                            "Authorization": f"Bearer {access_token}",
                            "LinkedIn-Version": "202509",  # September 2025 version
                            "X-Restli-Protocol-Version": "2.0.0"
                        },
                        params={
                            "author": author_urn,
                            "q": "author",
                            "count": count
                        }
                    )
                    
                    print(f"   Response: {response.status_code}")
                    if response.status_code != 200:
                        print(f"   Error: {response.text[:500]}...")
                    
                    if response.status_code == 200:
                        data = response.json()
                        posts = data.get('elements', [])
                        if posts:
                            print(f"   [SUCCESS] Found {len(posts)} posts via REST API")
                            return posts
                        else:
                            print(f"   [INFO] REST API returned 200 but 0 posts")
                except Exception as e1:
                    print(f"   [1] Failed: {e1}")
                
                # Method 3: Try shares API (Community Management API - the correct one!)
                # Reference: https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/share-api
                try:
                    print(f"   [3] Trying /v2/shares endpoint (Community Management API)...")
                    response = await client.get(
                        f"{self.base_url}/shares",
                        headers={
                            "Authorization": f"Bearer {access_token}",
                            "X-Restli-Protocol-Version": "2.0.0"
                        },
                        params={
                            "q": "owners",
                            "owners": author_urn,
                            "count": count,
                            "sortBy": "LAST_MODIFIED"
                        }
                    )
                    
                    print(f"   Response: {response.status_code}")
                    print(f"   Body sample: {response.text[:500]}...")
                    
                    if response.status_code == 200:
                        data = response.json()
                        posts = data.get('elements', [])
                        if posts:
                            print(f"   [SUCCESS] Found {len(posts)} posts via shares API")
                            return posts
                        else:
                            print(f"   [INFO] Shares API returned 200 but 0 posts")
                            print(f"   Full response: {response.text}")
                except Exception as e3:
                    print(f"   [3] Failed: {e3}")
                
                print(f"\n   [WARNING] All methods failed to fetch posts")
                print(f"   [DIAGNOSIS]:")
                print(f"   - If posting as PERSONAL: You need 'r_member_social' scope (restricted - requires LinkedIn approval)")
                print(f"   - If posting as ORGANIZATION: You need 'r_organization_social' AND be an ADMINISTRATOR of that LinkedIn page")
                print(f"   - Check https://www.linkedin.com/developers/apps > Your App > Products")
                print(f"   - Ensure 'Community Management API' or 'Marketing Developer Platform' is approved\n")
                return []
                    
        except Exception as e:
            print(f"   [ERROR] Failed to fetch posts from LinkedIn: {e}")
            return []
    
    async def get_post_comments(self, access_token: str, post_urn: str) -> list:
        """Get comments for a post using r_organization_social scope"""
        if self.mock_mode and not access_token:
            return []
        
        print(f"\n[COMMENTS] Fetching comments for post: {post_urn}")
        
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                # LinkedIn Comments API endpoint
                response = await client.get(
                    f"{self.base_url}/socialActions/{post_urn}/comments",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "LinkedIn-Version": "202304",
                        "X-Restli-Protocol-Version": "2.0.0"
                    }
                )
                
                print(f"   Response: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    comments = data.get('elements', [])
                    print(f"   [SUCCESS] Found {len(comments)} comments")
                    return comments
                else:
                    print(f"   [WARNING] Failed: {response.text[:200]}")
                    return []
                    
        except Exception as e:
            print(f"   [ERROR] Failed to fetch comments: {e}")
            return []
    
    async def post_comment_reply(self, access_token: str, post_urn: str, comment_text: str, parent_comment_urn: str = None) -> Dict:
        """Reply to a post or comment using w_member_social / w_organization_social scope
        
        Args:
            access_token: LinkedIn access token
            post_urn: The post URN to comment on
            comment_text: The comment text
            parent_comment_urn: Optional parent comment URN for replies
        """
        if self.mock_mode and not access_token:
            return {
                "id": f"urn:li:comment:mock_{datetime.now().timestamp()}",
                "created_at": datetime.now().isoformat()
            }
        
        print(f"\n[COMMENT] Posting comment...")
        print(f"   Post: {post_urn}")
        print(f"   Text: {comment_text[:50]}...")
        
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                # LinkedIn Comments API - create comment
                comment_data = {
                    "actor": "urn:li:person:CURRENT",  # LinkedIn will use current authenticated user
                    "object": post_urn,
                    "message": {
                        "text": comment_text
                    }
                }
                
                if parent_comment_urn:
                    comment_data["parentComment"] = parent_comment_urn
                
                response = await client.post(
                    f"{self.base_url}/socialActions/{post_urn}/comments",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json",
                        "LinkedIn-Version": "202304",
                        "X-Restli-Protocol-Version": "2.0.0"
                    },
                    json=comment_data
                )
                
                print(f"   Response: {response.status_code}")
                
                if response.status_code in [200, 201]:
                    # Get comment ID from response header or body
                    comment_id = response.headers.get("X-RestLi-Id", "")
                    if not comment_id and response.text:
                        try:
                            data = response.json()
                            comment_id = data.get("id", "")
                        except:
                            pass
                    
                    print(f"   [SUCCESS] Comment posted! ID: {comment_id}")
                    return {
                        "id": comment_id,
                        "created_at": datetime.now().isoformat(),
                        "text": comment_text
                    }
                else:
                    print(f"   [FAILED] {response.text[:200]}")
                    return {"error": response.text}
                    
        except Exception as e:
            print(f"   [ERROR] Failed to post comment: {e}")
            return {"error": str(e)}

            
    
    async def get_post_comments(self, access_token: str, post_urn: str) -> list:
        """Get comments for a post using r_organization_social scope"""
        if self.mock_mode and not access_token:
            return []
        
        print(f"\n[COMMENTS] Fetching comments for post: {post_urn}")
        
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                # LinkedIn Comments API endpoint
                response = await client.get(
                    f"{self.base_url}/socialActions/{post_urn}/comments",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "LinkedIn-Version": "202304",
                        "X-Restli-Protocol-Version": "2.0.0"
                    }
                )
                
                print(f"   Response: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    comments = data.get('elements', [])
                    print(f"   [SUCCESS] Found {len(comments)} comments")
                    return comments
                else:
                    print(f"   [WARNING] Failed: {response.text[:200]}")
                    return []
                    
        except Exception as e:
            print(f"   [ERROR] Failed to fetch comments: {e}")
            return []
    
    async def post_comment_reply(self, access_token: str, post_urn: str, comment_text: str, parent_comment_urn: str = None) -> Dict:
        """Reply to a post or comment using w_member_social / w_organization_social scope
        
        Args:
            access_token: LinkedIn access token
            post_urn: The post URN to comment on
            comment_text: The comment text
            parent_comment_urn: Optional parent comment URN for replies
        """
        if self.mock_mode and not access_token:
            return {
                "id": f"urn:li:comment:mock_{datetime.now().timestamp()}",
                "created_at": datetime.now().isoformat()
            }
        
        print(f"\n[COMMENT] Posting comment...")
        print(f"   Post: {post_urn}")
        print(f"   Text: {comment_text[:50]}...")
        
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                # LinkedIn Comments API - create comment
                comment_data = {
                    "actor": "urn:li:person:CURRENT",  # LinkedIn will use current authenticated user
                    "object": post_urn,
                    "message": {
                        "text": comment_text
                    }
                }
                
                if parent_comment_urn:
                    comment_data["parentComment"] = parent_comment_urn
                
                response = await client.post(
                    f"{self.base_url}/socialActions/{post_urn}/comments",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json",
                        "LinkedIn-Version": "202304",
                        "X-Restli-Protocol-Version": "2.0.0"
                    },
                    json=comment_data
                )
                
                print(f"   Response: {response.status_code}")
                
                if response.status_code in [200, 201]:
                    # Get comment ID from response header or body
                    comment_id = response.headers.get("X-RestLi-Id", "")
                    if not comment_id and response.text:
                        try:
                            data = response.json()
                            comment_id = data.get("id", "")
                        except:
                            pass
                    
                    print(f"   [SUCCESS] Comment posted! ID: {comment_id}")
                    return {
                        "id": comment_id,
                        "created_at": datetime.now().isoformat(),
                        "text": comment_text
                    }
                else:
                    print(f"   [FAILED] {response.text[:200]}")
                    return {"error": response.text}
                    
        except Exception as e:
            print(f"   [ERROR] Failed to post comment: {e}")
            return {"error": str(e)}

                     
    
    async def get_post_comments(self, access_token: str, post_urn: str) -> list:
        """Get comments for a post using r_organization_social scope"""
        if self.mock_mode and not access_token:
            return []
        
        print(f"\n[COMMENTS] Fetching comments for post: {post_urn}")
        
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                # LinkedIn Comments API endpoint
                response = await client.get(
                    f"{self.base_url}/socialActions/{post_urn}/comments",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "LinkedIn-Version": "202304",
                        "X-Restli-Protocol-Version": "2.0.0"
                    }
                )
                
                print(f"   Response: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    comments = data.get('elements', [])
                    print(f"   [SUCCESS] Found {len(comments)} comments")
                    return comments
                else:
                    print(f"   [WARNING] Failed: {response.text[:200]}")
                    return []
                    
        except Exception as e:
            print(f"   [ERROR] Failed to fetch comments: {e}")
            return []
    
    async def post_comment_reply(self, access_token: str, post_urn: str, comment_text: str, parent_comment_urn: str = None) -> Dict:
        """Reply to a post or comment using w_member_social / w_organization_social scope
        
        Args:
            access_token: LinkedIn access token
            post_urn: The post URN to comment on
            comment_text: The comment text
            parent_comment_urn: Optional parent comment URN for replies
        """
        if self.mock_mode and not access_token:
            return {
                "id": f"urn:li:comment:mock_{datetime.now().timestamp()}",
                "created_at": datetime.now().isoformat()
            }
        
        print(f"\n[COMMENT] Posting comment...")
        print(f"   Post: {post_urn}")
        print(f"   Text: {comment_text[:50]}...")
        
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                # LinkedIn Comments API - create comment
                comment_data = {
                    "actor": "urn:li:person:CURRENT",  # LinkedIn will use current authenticated user
                    "object": post_urn,
                    "message": {
                        "text": comment_text
                    }
                }
                
                if parent_comment_urn:
                    comment_data["parentComment"] = parent_comment_urn
                
                response = await client.post(
                    f"{self.base_url}/socialActions/{post_urn}/comments",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json",
                        "LinkedIn-Version": "202304",
                        "X-Restli-Protocol-Version": "2.0.0"
                    },
                    json=comment_data
                )
                
                print(f"   Response: {response.status_code}")
                
                if response.status_code in [200, 201]:
                    # Get comment ID from response header or body
                    comment_id = response.headers.get("X-RestLi-Id", "")
                    if not comment_id and response.text:
                        try:
                            data = response.json()
                            comment_id = data.get("id", "")
                        except:
                            pass
                    
                    print(f"   [SUCCESS] Comment posted! ID: {comment_id}")
                    return {
                        "id": comment_id,
                        "created_at": datetime.now().isoformat(),
                        "text": comment_text
                    }
                else:
                    print(f"   [FAILED] {response.text[:200]}")
                    return {"error": response.text}
                    
        except Exception as e:
            print(f"   [ERROR] Failed to post comment: {e}")
            return {"error": str(e)}
