from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient
import os
from cryptography.fernet import Fernet
import base64
import hashlib
import httpx

router = APIRouter(prefix="/settings", tags=["settings"])

# Get MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Encryption key (in production, store this securely, not in code)
# ALWAYS use ENCRYPTION_KEY from environment
_env_encryption_key = os.environ.get('ENCRYPTION_KEY')
if not _env_encryption_key:
    raise RuntimeError("ENCRYPTION_KEY not configured in environment")

# Expecting a urlsafe base64-encoded 32-byte key compatible with Fernet
ENCRYPTION_KEY = _env_encryption_key.encode() if isinstance(_env_encryption_key, str) else _env_encryption_key
cipher_suite = Fernet(ENCRYPTION_KEY)


class ApiKeysRequest(BaseModel):
    user_id: str
    openai_api_key: Optional[str] = ''
    linkedin_client_id: Optional[str] = ''
    linkedin_client_secret: Optional[str] = ''
    linkedin_redirect_uri: Optional[str] = ''
    canva_api_key: Optional[str] = ''
    google_ai_api_key: Optional[str] = ''
    unsplash_access_key: Optional[str] = ''
    pexels_api_key: Optional[str] = ''
    text_model: Optional[str] = 'gpt-4o'
    image_model: Optional[str] = 'mock-gemini-3-pro-image-preview'


class ApiKeysResponse(BaseModel):
    openai_api_key: str = ''
    linkedin_client_id: str = ''
    linkedin_client_secret: str = ''
    linkedin_redirect_uri: str = ''
    canva_api_key: str = ''
    google_ai_api_key: str = ''
    unsplash_access_key: str = ''
    pexels_api_key: str = ''
    text_model: str = 'gpt-4o'
    image_model: str = 'mock-gemini-3-pro-image-preview'


def encrypt_value(value: str) -> str:
    """Encrypt a string value"""
    if not value:
        return ''
    encrypted = cipher_suite.encrypt(value.encode())
    return encrypted.decode()


def decrypt_value(encrypted_value: str) -> str:
    """Decrypt an encrypted string value"""
    if not encrypted_value:
        return ''
    try:
        decrypted = cipher_suite.decrypt(encrypted_value.encode())
        return decrypted.decode()
    except Exception:
        return ''


@router.get("/api-keys", response_model=ApiKeysResponse)
async def get_api_keys(user_id: str = Query(...)):
    """Retrieve API keys for a user (returns decrypted values)"""
    try:
        print(f"\n[GET API KEYS] Fetching for user: {user_id}")
        settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})
        
        if not settings:
            print(f"[GET API KEYS] No settings found for user {user_id}")
            return ApiKeysResponse()
        
        # Decrypt values before returning
        decrypted_linkedin_id = decrypt_value(settings.get('linkedin_client_id', ''))
        decrypted_linkedin_secret = decrypt_value(settings.get('linkedin_client_secret', ''))
        
        print(f"[GET API KEYS] Decrypted LinkedIn Client ID: {decrypted_linkedin_id[:20] if decrypted_linkedin_id else 'EMPTY'}...")
        print(f"[GET API KEYS] Decrypted LinkedIn Client Secret: {decrypted_linkedin_secret[:20] if decrypted_linkedin_secret else 'EMPTY'}...")
        
        response = ApiKeysResponse(
            openai_api_key=decrypt_value(settings.get('openai_api_key', '')),
            linkedin_client_id=decrypted_linkedin_id,
            linkedin_client_secret=decrypted_linkedin_secret,
            linkedin_redirect_uri=decrypt_value(settings.get('linkedin_redirect_uri', '')),
            canva_api_key=decrypt_value(settings.get('canva_api_key', '')),
            google_ai_api_key=decrypt_value(settings.get('google_ai_api_key', '')),
            unsplash_access_key=decrypt_value(settings.get('unsplash_access_key', '')),
            pexels_api_key=decrypt_value(settings.get('pexels_api_key', '')),
            text_model=settings.get('text_model', 'gpt-4o'),
            image_model=settings.get('image_model', 'mock-gemini-3-pro-image-preview')
        )
        
        print(f"[GET API KEYS] Response linkedin_client_id: {response.linkedin_client_id[:20] if response.linkedin_client_id else 'EMPTY'}...")
        
        return response
    except Exception as e:
        print(f"[GET API KEYS] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching API keys: {str(e)}")


@router.post("/api-keys")
async def save_api_keys(request: ApiKeysRequest):
    """Save API keys for a user (encrypts values before storage)"""
    try:
        # Get existing settings to preserve unchanged values
        existing_settings = await db.user_settings.find_one({"user_id": request.user_id}, {"_id": 0})
        
        # Start with existing data or empty dict
        encrypted_data = existing_settings.copy() if existing_settings else {"user_id": request.user_id}
        
        # Only update fields that are provided and not empty
        if request.openai_api_key:
            encrypted_data["openai_api_key"] = encrypt_value(request.openai_api_key)
        if request.linkedin_client_id:
            encrypted_data["linkedin_client_id"] = encrypt_value(request.linkedin_client_id)
        if request.linkedin_client_secret:
            encrypted_data["linkedin_client_secret"] = encrypt_value(request.linkedin_client_secret)
        if request.linkedin_redirect_uri:
            encrypted_data["linkedin_redirect_uri"] = encrypt_value(request.linkedin_redirect_uri)
        if request.canva_api_key:
            encrypted_data["canva_api_key"] = encrypt_value(request.canva_api_key)
        if request.google_ai_api_key:
            encrypted_data["google_ai_api_key"] = encrypt_value(request.google_ai_api_key)
        if request.unsplash_access_key:
            encrypted_data["unsplash_access_key"] = encrypt_value(request.unsplash_access_key)
        if request.pexels_api_key:
            encrypted_data["pexels_api_key"] = encrypt_value(request.pexels_api_key)
        
        # Always update these
        encrypted_data["text_model"] = request.text_model or 'gpt-4o'
        encrypted_data["image_model"] = request.image_model or 'google/gemini-3-pro-image-preview'
        encrypted_data["user_id"] = request.user_id
        
        from datetime import datetime, timezone
        encrypted_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        # Upsert (update or insert)
        await db.user_settings.update_one(
            {"user_id": request.user_id},
            {"$set": encrypted_data},
            upsert=True
        )
        
        return {"message": "API keys saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving API keys: {str(e)}")


@router.get("/api-keys/check")
async def check_api_key_availability(user_id: str = Query(...), key_type: str = Query(...)):
    """Check if a specific API key is configured for a user"""
    try:
        settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})
        
        if not settings:
            return {"available": False, "message": f"No {key_type} API key configured"}
        
        key_field = f"{key_type}_api_key" if key_type == "openai" else f"linkedin_{key_type}"
        encrypted_key = settings.get(key_field, '')
        
        if not encrypted_key:
            return {"available": False, "message": f"No {key_type} API key configured"}
        
        # Check if key can be decrypted and is not empty
        decrypted_key = decrypt_value(encrypted_key)
        if decrypted_key:
            return {"available": True, "message": f"{key_type} API key is configured"}
        else:
            return {"available": False, "message": f"{key_type} API key is invalid"}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking API key: {str(e)}")


class TimezoneRequest(BaseModel):
    user_id: str
    timezone: str


class ProfileRequest(BaseModel):
    user_id: str
    full_name: Optional[str] = ''
    title: Optional[str] = ''
    company: Optional[str] = ''
    location: Optional[str] = ''
    website: Optional[str] = ''
    bio: Optional[str] = ''
    profile_image: Optional[str] = ''


class ProfileResponse(BaseModel):
    full_name: str = ''
    title: str = ''
    company: str = ''
    location: str = ''
    website: str = ''
    bio: str = ''
    profile_image: str = ''


@router.get("/timezone")
async def get_timezone(user_id: str = Query(...)):
    """Get user's timezone preference"""
    try:
        settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})
        
        if not settings or not settings.get('timezone'):
            # Return empty string if no timezone is set
            return {"timezone": ""}
        
        return {"timezone": settings.get('timezone', '')}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching timezone: {str(e)}")


@router.post("/timezone")
async def save_timezone(request: TimezoneRequest):
    """Save user's timezone preference"""
    try:
        from datetime import datetime, timezone as tz
        
        await db.user_settings.update_one(
            {"user_id": request.user_id},
            {
                "$set": {
                    "timezone": request.timezone,
                    "updated_at": datetime.now(tz.utc).isoformat()
                }
            },
            upsert=True
        )
        
        return {"message": "Timezone saved successfully", "timezone": request.timezone}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving timezone: {str(e)}")


@router.get("/profile", response_model=ProfileResponse)
async def get_profile(user_id: str = Query(...)):
    """Get the editable profile fields for a user"""
    try:
        settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0, "profile": 1})
        profile = settings.get('profile', {}) if settings else {}

        # Fallback to core user document for name if not stored yet
        if not profile.get('full_name'):
            user_doc = await db.users.find_one({"id": user_id}, {"_id": 0, "full_name": 1})
            if user_doc and user_doc.get('full_name'):
                profile['full_name'] = user_doc['full_name']

        return ProfileResponse(
            full_name=profile.get('full_name', ''),
            title=profile.get('title', ''),
            company=profile.get('company', ''),
            location=profile.get('location', ''),
            website=profile.get('website', ''),
            bio=profile.get('bio', ''),
            profile_image=profile.get('profile_image', '')
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching profile: {str(e)}")


@router.post("/profile")
async def save_profile(request: ProfileRequest):
    """Save user profile details"""
    try:
        from datetime import datetime, timezone as tz

        profile_data = request.dict()
        profile_data.pop('user_id', None)

        await db.user_settings.update_one(
            {"user_id": request.user_id},
            {
                "$set": {
                    "profile": profile_data,
                    "updated_at": datetime.now(tz.utc).isoformat()
                }
            },
            upsert=True
        )

        # Optionally keep user's full_name in sync with primary users collection
        if profile_data.get('full_name'):
            await db.users.update_one(
                {"id": request.user_id},
                {"$set": {"full_name": profile_data['full_name']} }
            )

        return {"message": "Profile saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving profile: {str(e)}")

@router.get("/linkedin-status")
async def get_linkedin_status(user_id: str = Query(...)):
    """Get LinkedIn connection status for user"""
    try:
        settings = await db.user_settings.find_one({"user_id": user_id})
        
        if not settings:
            return {"linkedin_connected": False}
        
        # Check if linkedin_access_token exists and is not empty
        linkedin_connected = bool(settings.get('linkedin_access_token'))
        
        linkedin_profile = settings.get('linkedin_profile', {}) if linkedin_connected else {}
        
        # If profile picture exists, add proxy URL to avoid CORS issues
        # The frontend will use picture_proxy if available, otherwise fallback to direct URL
        if linkedin_profile.get('picture'):
            # Keep original picture URL for reference
            # Frontend will construct proxy URL: /api/settings/linkedin-profile-picture?user_id={user_id}
            pass
        
        return {
            "linkedin_connected": linkedin_connected,
            "linkedin_profile": linkedin_profile
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching LinkedIn status: {str(e)}")

@router.get("/linkedin-profile-picture")
async def get_linkedin_profile_picture(user_id: str = Query(...)):
    """Proxy LinkedIn profile picture to avoid CORS issues"""
    try:
        settings = await db.user_settings.find_one({"user_id": user_id})
        
        if not settings:
            raise HTTPException(status_code=404, detail="User settings not found")
        
        linkedin_profile = settings.get('linkedin_profile', {})
        picture_url = linkedin_profile.get('picture') or linkedin_profile.get('pictureUrl') or linkedin_profile.get('picture_url') or linkedin_profile.get('profilePicture')
        access_token = settings.get('linkedin_access_token')
        
        if not picture_url and not access_token:
            raise HTTPException(status_code=404, detail="LinkedIn profile picture not found")
        
        # Try to fetch image from stored URL first
        if picture_url:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.get(picture_url, follow_redirects=True)
                    
                    if response.status_code == 200:
                        # Return image with proper headers
                        return Response(
                            content=response.content,
                            media_type=response.headers.get('content-type', 'image/jpeg'),
                            headers={
                                "Cache-Control": "public, max-age=3600",  # Cache for 1 hour
                                "Access-Control-Allow-Origin": "*"  # Allow CORS
                            }
                        )
                    # If URL expired (403), try to refresh from API
                    elif response.status_code == 403 and access_token:
                        print(f"[LINKEDIN PROFILE] Stored picture URL expired, refreshing from API...")
                    else:
                        raise Exception(f"Failed to fetch image: {response.status_code}")
            except Exception as e:
                print(f"[LINKEDIN PROFILE] Error fetching stored URL: {e}")
                # Fall through to refresh from API
        
        # If stored URL failed or doesn't exist, try to refresh from LinkedIn API
        if access_token:
            try:
                from ..adapters.linkedin_adapter import LinkedInAdapter
                linkedin = LinkedInAdapter(client_id="from_user", client_secret="from_user")
                linkedin.mock_mode = False
                
                # Fetch fresh profile data
                profile = await linkedin.get_user_profile(access_token)
                fresh_picture_url = profile.get('picture')
                
                if fresh_picture_url:
                    # Update stored profile with fresh picture URL
                    await db.user_settings.update_one(
                        {"user_id": user_id},
                        {"$set": {"linkedin_profile.picture": fresh_picture_url}}
                    )
                    
                    # Fetch the fresh image
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        response = await client.get(fresh_picture_url, follow_redirects=True)
                        
                        if response.status_code == 200:
                            return Response(
                                content=response.content,
                                media_type=response.headers.get('content-type', 'image/jpeg'),
                                headers={
                                    "Cache-Control": "public, max-age=3600",
                                    "Access-Control-Allow-Origin": "*"
                                }
                            )
            except Exception as refresh_error:
                print(f"[LINKEDIN PROFILE] Error refreshing from API: {refresh_error}")
        
        # If all else fails, return 404
        raise HTTPException(status_code=404, detail="Failed to fetch LinkedIn profile picture")
        
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Timeout fetching LinkedIn profile picture")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[LINKEDIN PROFILE] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching LinkedIn profile picture: {str(e)}")
