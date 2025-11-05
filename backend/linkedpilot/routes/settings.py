from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient
import os
from cryptography.fernet import Fernet
import base64
import hashlib

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
    openrouter_api_key: Optional[str] = ''
    google_ai_api_key: Optional[str] = ''
    unsplash_access_key: Optional[str] = ''
    pexels_api_key: Optional[str] = ''
    text_model: Optional[str] = 'gpt-4o'
    image_model: Optional[str] = 'mock-gemini-2.5-flash-image'


class ApiKeysResponse(BaseModel):
    openai_api_key: str = ''
    linkedin_client_id: str = ''
    linkedin_client_secret: str = ''
    linkedin_redirect_uri: str = ''
    canva_api_key: str = ''
    openrouter_api_key: str = ''
    google_ai_api_key: str = ''
    unsplash_access_key: str = ''
    pexels_api_key: str = ''
    text_model: str = 'gpt-4o'
    image_model: str = 'mock-gemini-2.5-flash-image'


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
            openrouter_api_key=decrypt_value(settings.get('openrouter_api_key', '')),
            google_ai_api_key=decrypt_value(settings.get('google_ai_api_key', '')),
            unsplash_access_key=decrypt_value(settings.get('unsplash_access_key', '')),
            pexels_api_key=decrypt_value(settings.get('pexels_api_key', '')),
            text_model=settings.get('text_model', 'gpt-4o'),
            image_model=settings.get('image_model', 'mock-gemini-2.5-flash-image')
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
        if request.openrouter_api_key:
            encrypted_data["openrouter_api_key"] = encrypt_value(request.openrouter_api_key)
        if request.google_ai_api_key:
            encrypted_data["google_ai_api_key"] = encrypt_value(request.google_ai_api_key)
        if request.unsplash_access_key:
            encrypted_data["unsplash_access_key"] = encrypt_value(request.unsplash_access_key)
        if request.pexels_api_key:
            encrypted_data["pexels_api_key"] = encrypt_value(request.pexels_api_key)
        
        # Always update these
        encrypted_data["text_model"] = request.text_model or 'gpt-4o'
        encrypted_data["image_model"] = request.image_model or 'google/gemini-2.5-flash-image'
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

@router.get("/linkedin-status")
async def get_linkedin_status(user_id: str = Query(...)):
    """Get LinkedIn connection status for user"""
    try:
        settings = await db.user_settings.find_one({"user_id": user_id})
        
        if not settings:
            return {"linkedin_connected": False}
        
        # Check if linkedin_access_token exists and is not empty
        linkedin_connected = bool(settings.get('linkedin_access_token'))
        
        return {
            "linkedin_connected": linkedin_connected,
            "linkedin_profile": settings.get('linkedin_profile', {}) if linkedin_connected else {}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching LinkedIn status: {str(e)}")
