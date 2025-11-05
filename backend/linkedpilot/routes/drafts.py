from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import List, Dict, Optional
from datetime import datetime
import os
import base64
import hashlib

from ..models.draft import Draft, DraftMode, DraftStatus
from ..models.prompt_history import PromptHistory, PromptType, PromptAction
from ..adapters.llm_adapter import LLMAdapter
from ..adapters.image_adapter import ImageAdapter
import base64
import io
from PIL import Image, ImageDraw
import random

from pydantic import BaseModel as PydanticBaseModel

class DraftGenerateRequest(PydanticBaseModel):
    org_id: str
    topic: str
    tone: str
    type: str
    created_by: str

class ImageGenerateRequest(PydanticBaseModel):
    prompt: str
    topic: Optional[str] = None  # Original user topic for better image search
    style: str = "professional"
    user_id: str  # Add user_id to fetch API key
    org_id: Optional[str] = None  # Organization ID for prompt logging
    model: str = "gemini-2.5-flash-image"  # Image model to use (default: Gemini 2.5 Flash Image)
    session_id: Optional[str] = None  # Session ID for WebSocket progress updates
    draft_id: Optional[str] = None  # Draft ID for prompt history tracking

router = APIRouter(prefix="/drafts", tags=["drafts"])

def get_db():
    from motor.motor_asyncio import AsyncIOMotorClient
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    return client[os.environ['DB_NAME']]

async def get_default_model_setting(setting_key: str) -> str:
    """Get default model setting from system_settings
    
    Args:
        setting_key: One of 'text_draft_content', 'text_text_overlay', 'text_carousel_content',
                     'image_draft_image', 'image_carousel_images'
    
    Returns:
        Model string in format 'provider:model' or default value
    """
    db = get_db()
    model_settings = await db.system_settings.find_one({"_id": "model_settings"})
    
    if not model_settings:
        # Return defaults
        defaults = {
            'text_draft_content': 'google_ai_studio:gemini-2.5-flash',
            'text_text_overlay': 'google_ai_studio:gemini-2.5-flash',
            'text_carousel_content': 'google_ai_studio:gemini-2.5-flash',
            'image_draft_image': 'google_ai_studio:gemini-2.5-flash-image',
            'image_carousel_images': 'google_ai_studio:gemini-2.5-flash-image'
        }
        return defaults.get(setting_key, 'google_ai_studio:gemini-2.5-flash')
    
    return model_settings.get(setting_key, 'google_ai_studio:gemini-2.5-flash')

def parse_model_setting(model_string: str) -> tuple:
    """Parse model setting string into (provider, model) tuple
    
    Args:
        model_string: Format 'provider:model' (e.g., 'google_ai_studio:gemini-2.5-flash')
    
    Returns:
        Tuple of (provider, model)
    """
    if ':' in model_string:
        provider, model = model_string.split(':', 1)
        return provider, model
    # Fallback: assume google_ai_studio if no provider specified
    return 'google_ai_studio', model_string

async def get_system_api_key(key_type: str = "any") -> tuple:
    """Get system-wide API key from admin-managed settings
    
    Args:
        key_type: Type of key to prioritize ("google_ai", "openrouter", "openai", "anthropic", or "any")
    
    Returns:
        Tuple of (api_key, provider) or (None, None)
    """
    from cryptography.fernet import Fernet
    
    print(f"[API_KEY] [SYSTEM] Looking up system API key (type: {key_type})")
    
    db = get_db()
    # Retrieve from system_settings collection (admin-managed)
    system_settings = await db.system_settings.find_one({"_id": "api_keys"})
    
    if not system_settings:
        print(f"   [ERROR] No system API keys configured. Admin must add keys in admin dashboard.")
        return None, None
    
    print(f"   [SUCCESS] System settings found: {list(system_settings.keys())}")
    
    # Priority order based on key_type
    if key_type == "google_ai" or key_type == "google_ai_studio":
        key_priority = ['google_ai_api_key', 'openrouter_api_key', 'openai_api_key', 'anthropic_api_key']
    elif key_type == "openrouter":
        key_priority = ['openrouter_api_key', 'google_ai_api_key', 'anthropic_api_key', 'openai_api_key']
    elif key_type == "openai":
        key_priority = ['openai_api_key', 'anthropic_api_key', 'openrouter_api_key', 'google_ai_api_key']
    elif key_type == "anthropic":
        key_priority = ['anthropic_api_key', 'openrouter_api_key', 'openai_api_key', 'google_ai_api_key']
    else:  # "any"
        key_priority = ['openai_api_key', 'google_ai_api_key', 'anthropic_api_key', 'openrouter_api_key']
    
    # Try keys in priority order
    api_key_field = None
    provider = None
    for key_field in key_priority:
        if system_settings.get(key_field):
            api_key_field = key_field
            if key_field == 'google_ai_api_key':
                provider = 'google_ai_studio'
            elif key_field == 'openrouter_api_key':
                provider = 'openrouter'
            elif key_field == 'anthropic_api_key':
                provider = 'anthropic'
            else:
                provider = 'openai'
            print(f"   [SUCCESS] Found system {key_field}")
            break
    
    if not api_key_field:
        print(f"   [ERROR] No system API key found (checked {key_priority})")
        return None, None
    
    # Decrypt the API key - prefer ENCRYPTION_KEY, fallback to legacy JWT-derived key
    try:
        ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', '')
        JWT_SECRET = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
        legacy_key = base64.urlsafe_b64encode(hashlib.sha256(JWT_SECRET.encode()).digest())
        
        cipher_primary = None
        cipher_legacy = None
        if ENCRYPTION_KEY:
            cipher_primary = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
        cipher_legacy = Fernet(legacy_key)
        
        encrypted_key = system_settings.get(api_key_field, '')
        if encrypted_key:
            try:
                decrypted_key = (cipher_primary.decrypt(encrypted_key.encode()).decode() if cipher_primary else None)
                if decrypted_key:
                    print(f"   [SUCCESS] Decrypted system {api_key_field} with ENCRYPTION_KEY: {decrypted_key[:8]}...{decrypted_key[-4:]}")
                    return decrypted_key, provider
            except Exception:
                pass
            # Fallback to legacy
            try:
                decrypted_key = cipher_legacy.decrypt(encrypted_key.encode()).decode()
                print(f"   [SUCCESS] Decrypted system {api_key_field} with legacy key: {decrypted_key[:8]}...{decrypted_key[-4:]}")
                return decrypted_key, provider
            except Exception as e2:
                print(f"   [ERROR] Failed to decrypt system {api_key_field} with both keys: {e2}")
        else:
            print(f"   [ERROR] System {api_key_field} field is empty")
    except Exception as e:
        print(f"   [ERROR] Error preparing decryptors: {e}")
    
    return None, None

async def get_user_api_key(user_id: str, key_type: str = "any") -> tuple:
    """Get user's API key from settings
    
    Args:
        user_id: User ID to lookup
        key_type: Type of key to prioritize ("google_ai", "openrouter", "openai", or "any")
    
    Returns:
        Tuple of (api_key, provider) or (None, None)
    """
    from cryptography.fernet import Fernet
    import base64
    import hashlib
    
    print(f"[API_KEY] Looking up API key for user: {user_id} (type: {key_type})")
    
    db = get_db()
    settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})
    
    if not settings:
        print(f"   [ERROR] No settings found for user {user_id}")
        return None, None
    
    print(f"   [SUCCESS] Settings found: {list(settings.keys())}")
    
    # Priority order based on key_type
    if key_type == "google_ai" or key_type == "google_ai_studio":
        key_priority = ['google_ai_api_key', 'openrouter_api_key', 'openai_api_key', 'anthropic_api_key']
    elif key_type == "openrouter":
        key_priority = ['openrouter_api_key', 'google_ai_api_key', 'anthropic_api_key', 'openai_api_key']
    elif key_type == "openai":
        key_priority = ['openai_api_key', 'anthropic_api_key', 'openrouter_api_key', 'google_ai_api_key']
    elif key_type == "anthropic":
        key_priority = ['anthropic_api_key', 'openrouter_api_key', 'openai_api_key', 'google_ai_api_key']
    else:  # "any"
        key_priority = ['openai_api_key', 'google_ai_api_key', 'anthropic_api_key', 'openrouter_api_key']
    
    # Try keys in priority order
    api_key_field = None
    provider = None
    for key_field in key_priority:
        if settings.get(key_field):
            api_key_field = key_field
            if key_field == 'google_ai_api_key':
                provider = 'google_ai_studio'
            elif key_field == 'openrouter_api_key':
                provider = 'openrouter'
            elif key_field == 'anthropic_api_key':
                provider = 'anthropic'
            else:
                provider = 'openai'
            print(f"   [SUCCESS] Found {key_field}")
            break
    
    if not api_key_field:
        print(f"   [ERROR] No API key found (checked {key_priority})")
        return None, None
    
    # Decrypt the API key - prefer ENCRYPTION_KEY, fallback to legacy JWT-derived key
    try:
        ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', '')
        JWT_SECRET = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
        legacy_key = base64.urlsafe_b64encode(hashlib.sha256(JWT_SECRET.encode()).digest())
        
        cipher_primary = None
        cipher_legacy = Fernet(legacy_key)
        if ENCRYPTION_KEY:
            cipher_primary = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
        
        encrypted_key = settings.get(api_key_field, '')
        if encrypted_key:
            # Try primary
            if cipher_primary:
                try:
                    decrypted_key = cipher_primary.decrypt(encrypted_key.encode()).decode()
                    print(f"   [SUCCESS] Decrypted {api_key_field} with ENCRYPTION_KEY: {decrypted_key[:8]}...{decrypted_key[-4:]}")
                    return decrypted_key, provider
                except Exception:
                    pass
            # Fallback to legacy
            try:
                decrypted_key = cipher_legacy.decrypt(encrypted_key.encode()).decode()
                print(f"   [SUCCESS] Decrypted {api_key_field} with legacy key: {decrypted_key[:8]}...{decrypted_key[-4:]}")
                return decrypted_key, provider
            except Exception as e2:
                print(f"   [ERROR] Failed to decrypt {api_key_field} with both keys: {e2}")
        else:
            print(f"   [ERROR] {api_key_field} field is empty")
    except Exception as e:
        print(f"   [ERROR] Error preparing decryptors: {e}")
    
    return None, None


async def get_user_openai_key(user_id: str) -> str:
    """Legacy function for backward compatibility"""
    api_key, _ = await get_user_api_key(user_id, "any")
    return api_key


async def get_user_canva_key(user_id: str) -> str:
    """Get user's Canva API key from settings"""
    from cryptography.fernet import Fernet
    import base64
    import hashlib
    
    print(f"[CANVA] Looking up Canva key for user: {user_id}")
    
    db = get_db()
    settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})
    
    if not settings:
        print(f"   [ERROR] No settings found for user {user_id}")
        return None
    
    if not settings.get('canva_api_key'):
        print(f"   [WARNING] No canva_api_key field in settings (using mock mode)")
        return None
    
    # Decrypt the API key
    try:
        ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', '')
        if not ENCRYPTION_KEY:
            print(f"   [ERROR] ENCRYPTION_KEY not set in environment")
            return None
            
        cipher_suite = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
        
        encrypted_key = settings.get('canva_api_key', '')
        if encrypted_key:
            decrypted = cipher_suite.decrypt(encrypted_key.encode())
            decrypted_key = decrypted.decode()
            print(f"   [SUCCESS] Decrypted Canva key: {decrypted_key[:8]}...{decrypted_key[-4:]}")
            return decrypted_key
        else:
            print(f"   [WARNING] canva_api_key field is empty (using mock mode)")
    except Exception as e:
        print(f"   [ERROR] Error decrypting Canva key: {e}")
    
    return None

@router.post("", response_model=Draft)
async def create_draft(draft: Draft):
    """Create a new draft"""
    db = get_db()
    draft_dict = draft.model_dump()
    draft_dict['created_at'] = datetime.utcnow().isoformat()
    draft_dict['updated_at'] = datetime.utcnow().isoformat()
    
    await db.drafts.insert_one(draft_dict)
    return draft

@router.post("/generate")
async def generate_draft_content(request: DraftGenerateRequest):
    """Generate draft content using AI for simple topic-based generation"""
    print(f"\n{'='*60}")
    print(f"[DRAFT] /api/drafts/generate called")
    print(f"   User ID: {request.created_by}")
    print(f"   Topic: {request.topic}")
    print(f"   Tone: {request.tone}")
    
    # Get default model setting from admin configuration
    default_model_setting = await get_default_model_setting('text_draft_content')
    default_provider, default_model = parse_model_setting(default_model_setting)
    
    print(f"[DRAFT] Using default model: {default_provider}:{default_model}")
    
    # Multi-provider fallback: Use configured default first, then fallback providers
    providers_to_try = []
    
    # Priority 1: Use configured default model
    default_key, _ = await get_system_api_key(default_provider)
    if not default_key:
        default_key, _ = await get_user_api_key(request.created_by, default_provider)
    if default_key:
        providers_to_try.append((default_provider, default_model))
        print(f"   [SUCCESS] Added default model: {default_provider}:{default_model}")
    
    # Priority 2-4: Add other providers if keys are present (for fallback)
    # Google AI Studio
    if default_provider != "google_ai_studio":
        google_key, _ = await get_system_api_key("google_ai_studio")
        if not google_key:
            google_key, _ = await get_user_api_key(request.created_by, "google_ai_studio")
        if google_key:
            providers_to_try.append(("google_ai_studio", "gemini-2.5-flash"))
    
    # OpenAI
    if default_provider != "openai":
        openai_key, _ = await get_system_api_key("openai")
        if not openai_key:
            openai_key, _ = await get_user_api_key(request.created_by, "openai")
        if openai_key:
            providers_to_try.append(("openai", "gpt-4o"))
    
    # Anthropic
    if default_provider != "anthropic":
        anthropic_key, _ = await get_system_api_key("anthropic")
        if not anthropic_key:
            anthropic_key, _ = await get_user_api_key(request.created_by, "anthropic")
        if anthropic_key:
            providers_to_try.append(("anthropic", "claude-3-5-sonnet"))
    
    # OpenRouter
    if default_provider != "openrouter":
        openrouter_key, _ = await get_system_api_key("openrouter")
        if not openrouter_key:
            openrouter_key, _ = await get_user_api_key(request.created_by, "openrouter")
        if openrouter_key:
            providers_to_try.append(("openrouter", "anthropic/claude-3.5-sonnet"))
    
    content_data = None
    last_error = None
    
    for provider_name, model_name in providers_to_try:
        try:
            print(f"[LLM] Trying provider: {provider_name} with model: {model_name}")
            
            # Get system-wide API key for this provider (admin-managed)
            system_api_key, provider = await get_system_api_key(provider_name)
            
            if not system_api_key:
                print(f"   [SKIP] No system API key configured for {provider_name}")
                continue
            
            print(f"   [SUCCESS] System API key found for {provider_name}")
            
            # Initialize LLM adapter with the system's API key
            llm = LLMAdapter(
                api_key=system_api_key,
                provider=provider,
                model=model_name
            )
            
            # Build context
            context = {
                'topic': request.topic,
                'tone': request.tone,
                'goal': 'engagement'
            }
            
            # Generate content
            content_data = await llm.generate_post_content(context, request.type)
            
            print(f"   [SUCCESS] Content generated with {provider_name}!")
            break  # Success! Exit the loop
            
        except Exception as e:
            print(f"   [ERROR] {provider_name} failed: {str(e)}")
            last_error = e
            continue  # Try next provider
    
    # If all providers failed, raise an error
    if content_data is None:
        if last_error is None:
            last_error = "No usable provider API keys found (system/user)"
        print(f"[ERROR] All providers failed. Last error: {last_error}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate content with all providers. Admin must configure system API keys. Last error: {str(last_error)}"
        )
    
    print(f"{'='*60}\n")
    
    # Log the prompt to database
    if request.org_id and request.created_by:
        try:
            from linkedpilot.utils.prompt_logger import log_prompt
            from linkedpilot.models.prompt_history import PromptType, PromptAction
            
            await log_prompt(
                user_id=request.created_by,
                org_id=request.org_id,
                prompt_type=PromptType.TEXT_GENERATION,
                action=PromptAction.CREATED,
                text_prompt=content_data.get('generation_prompt', request.topic),
                model_used=model_name if content_data else None,
                provider_used=provider_name if content_data else None,
                success=True,
                generated_content=content_data.get('body', '') if isinstance(content_data, dict) else str(content_data)
            )
            print(f"[PROMPT_LOG] Logged text prompt history")
        except Exception as log_error:
            print(f"[WARNING] Failed to log prompt: {log_error}")
    
    return {
        "content": content_data.get('body', content_data) if isinstance(content_data, dict) else str(content_data),
        "hashtags": content_data.get('hashtags', []) if isinstance(content_data, dict) else [],
        "org_id": request.org_id,
        "type": request.type,
        "generation_prompt": content_data.get('generation_prompt')  # Include for prompt editing UI
    }

@router.post("/fetch-stock-image")
async def fetch_stock_image(request: ImageGenerateRequest):
    """
    Fetch a free stock image from Unsplash/Pexels based on the post content.
    This is the default, fast, and free option.
    """
    print(f"\n{'='*60}")
    print(f"[STOCK IMAGE] /api/drafts/fetch-stock-image called")
    print(f"   Post content: {request.prompt[:100]}...")
    
    try:
        from linkedpilot.utils.stock_image_fetcher import StockImageFetcher, extract_image_keywords_ai
        
        # Get system stock image API keys (admin-managed)
        db = get_db()
        system_settings = await db.system_settings.find_one({"_id": "api_keys"})
        
        unsplash_key = None
        pexels_key = None
        openai_key = None
        
        if system_settings:
            # Decrypt system API keys using ENCRYPTION_KEY from .env (same as admin.py)
            from cryptography.fernet import Fernet
            
            ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', '')
            if not ENCRYPTION_KEY:
                print(f"   [ERROR] ENCRYPTION_KEY not set in environment")
            else:
                cipher_suite = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
            
            if system_settings.get('unsplash_access_key'):
                try:
                    unsplash_key = cipher_suite.decrypt(system_settings['unsplash_access_key'].encode()).decode()
                except:
                    pass
            
            if system_settings.get('pexels_api_key'):
                try:
                    pexels_key = cipher_suite.decrypt(system_settings['pexels_api_key'].encode()).decode()
                except:
                    pass
            
            if system_settings.get('openai_api_key'):
                try:
                    openai_key = cipher_suite.decrypt(system_settings['openai_api_key'].encode()).decode()
                except:
                    pass
        
        # Extract keywords using AI for better visual descriptions
        topic_for_search = request.topic if request.topic else request.prompt[:100]
        
        # Use system OpenAI key for AI-powered keyword extraction (already decrypted above)
        keywords = await extract_image_keywords_ai(request.prompt, topic_for_search, openai_key)
        print(f"   Original topic: {request.topic if request.topic else 'N/A'}")
        # Safe print for Windows console (avoid Unicode arrows)
        try:
            print(f"   AI-generated keywords: {keywords}")
        except UnicodeEncodeError:
            print(f"   AI-generated keywords: [Keywords generated but contain Unicode characters]")
        print(f"   Unsplash key: {'Found' if unsplash_key else 'Not found'}")
        print(f"   Pexels key: {'Found' if pexels_key else 'Not found'}")
        
        # Fetch stock image with user's API keys
        fetcher = StockImageFetcher(unsplash_key=unsplash_key, pexels_key=pexels_key)
        image_data = await fetcher.fetch_image(keywords, orientation="landscape")
        
        if image_data:
            print(f"   [SUCCESS] Stock image found from {image_data['source']}")
            print(f"   Photographer: {image_data['photographer']}")
            print(f"{'='*60}\n")
            
            return {
                "url": image_data['url'],
                "source": image_data['source'],
                "photographer": image_data['photographer'],
                "photographer_url": image_data.get('photographer_url'),
                "attribution": image_data['attribution'],
                "prompt": keywords,
                "model": "Stock Photo",
                "provider": image_data['source'],
                "cost": "$0.00",
                "note": f"Free stock photo from {image_data['source']}"
            }
        else:
            print(f"   [WARNING] No stock images found, falling back to placeholder")
            print(f"{'='*60}\n")
            raise HTTPException(
                status_code=404,
                detail="No suitable stock images found. Try generating with AI instead."
            )
            
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"[ERROR] Stock image fetch failed: {e}")
        print(f"[ERROR] Full traceback:")
        print(error_details)
        print(f"{'='*60}\n")
        raise HTTPException(
            status_code=500,
            detail=f"Stock image fetch failed: {str(e)}. Try generating with AI instead."
        )

@router.post("/generate-image")
async def generate_image_for_draft(request: ImageGenerateRequest):
    """
    Generate image for a draft with Gemini 2.5 Flash Image as default and Stock as fallback:
    1. Gemini 2.5 Flash Image (google/gemini-2.5-flash-image) - Default Primary
    2. Stock Photos (Unsplash/Pexels) - Primary Fallback
    3. OpenRouter (for Gemini models) - Secondary Fallback
    4. AI Horde (free) - Last resort
    """
    print(f"\n{'='*60}")
    print(f"[IMAGE] /api/drafts/generate-image called")
    print(f"   User ID: {request.user_id}")
    print(f"   Org ID: {request.org_id}")
    print(f"   Session ID: {request.session_id}")
    print(f"   Original Prompt: {request.prompt[:80]}...")
    print(f"   Style: {request.style}")
    print(f"   Model: {request.model}")
    
    # Helper function to log prompt and return response
    async def log_and_return_result(result_data: dict, success: bool = True):
        """Log the prompt to database after successful generation"""
        if request.org_id and request.user_id:
            try:
                from linkedpilot.utils.prompt_logger import log_prompt
                from linkedpilot.models.prompt_history import PromptType, PromptAction
                
                await log_prompt(
                    user_id=request.user_id,
                    org_id=request.org_id,
                    prompt_type=PromptType.IMAGE_GENERATION,
                    action=PromptAction.CREATED,
                    image_prompt=enhanced_prompt,
                    draft_id=request.draft_id,
                    model_used=result_data.get('model', image_model),
                    provider_used=result_data.get('provider', 'Unknown'),
                    success=success,
                    generated_image_url=result_data.get('url')
                )
                print(f"[PROMPT_LOG] Logged image prompt history")
            except Exception as log_error:
                print(f"[WARNING] Failed to log prompt: {log_error}")
        
        return result_data
    
    # Track which model was actually used
    image_model_used = None
    provider_used = None
    
    # Use AI to analyze post and create unique visual metaphor
    print(f"   [IMAGE] Step 1/3: AI analyzing content for perfect visual...")
    
    # Try to get system OpenAI key for AI prompt optimization (admin-managed)
    system_openai_key, _ = await get_system_api_key("openai")
    
    print(f"   [DEBUG] System OpenAI key found for AI optimization: {bool(system_openai_key)}")
    
    enhanced_prompt = request.prompt  # Default fallback
    
    if system_openai_key:
        try:
            print(f"   [IMAGE] Step 2/3: AI creating custom visual metaphor...")
            from linkedpilot.utils.ai_image_prompt_optimizer import generate_optimized_image_prompt
            
            ai_analysis = await generate_optimized_image_prompt(
                post_content=request.prompt,
                ai_api_key=system_openai_key,
                ai_model="gpt-4o"
            )
            
            enhanced_prompt = ai_analysis['optimized_prompt']
            print(f"   [IMAGE] Visual concept: {ai_analysis.get('visual_concept', 'N/A')}")
            print(f"   [IMAGE] Metaphor: {ai_analysis.get('metaphor_description', 'N/A')[:80]}...")
        except Exception as ai_error:
            print(f"   [WARNING] AI optimization failed: {ai_error}, using simple prompt")
            enhanced_prompt = f"""PROFESSIONAL PHOTOGRAPH - PHOTOREALISTIC. Shot on DSLR, 35mm, f/1.8. 
Cinematic photo representing: {request.prompt[:150]}. Natural setting, dramatic lighting, shallow depth of field. 
National Geographic quality. ABSOLUTELY NO TEXT OR WORDS. Pure imagery only.""".replace('\n', ' ')
    else:
        print(f"   [IMAGE] No OpenAI key available, using simple prompt")
        enhanced_prompt = f"""PROFESSIONAL PHOTOGRAPH - PHOTOREALISTIC. Shot on DSLR, 35mm, f/1.8. 
Cinematic photo representing: {request.prompt[:150]}. Natural setting, dramatic lighting, shallow depth of field. 
National Geographic quality. ABSOLUTELY NO TEXT OR WORDS. Pure imagery only.""".replace('\n', ' ')
    
    print(f"   [IMAGE] Step 3/3: Generating image with optimized prompt...")
    
    # Get default image model setting from admin configuration
    default_image_setting = await get_default_model_setting('image_draft_image')
    default_img_provider, default_img_model = parse_model_setting(default_image_setting)
    
    # Use model from request, or fallback to admin-configured default
    image_model = request.model or default_img_model
    print(f"[IMAGE] Using model: {image_model} (from request) or default: {default_img_provider}:{default_img_model}")
    
    print(f"[DEBUG] Request model: '{request.model}' -> Processing as: '{image_model}'")
    
    # Map 'stock' to 'stock-only' to skip Gemini and use pure stock
    if image_model == 'stock':
        image_model = 'stock-only'
        print(f"[DEBUG] Mapped 'stock' -> 'stock-only' (will skip Gemini)")
    
    # Priority 1: Use configured default image model
    # Check if default model is Google AI Studio or matches image_model
    if image_model == default_img_model or image_model in ['gemini-stock', 'google/gemini-2.5-flash-image', 'gemini-2.5-flash-image', 'gemini-2.0-flash-exp'] or image_model is None:
        print(f"[IMAGE] Priority 1: Attempting {default_img_provider} with {default_img_model}...")
        
        # Try to get API key for configured provider
        system_api_key, provider = await get_system_api_key(default_img_provider)
        
        if not system_api_key:
            system_api_key, provider = await get_user_api_key(request.user_id, default_img_provider)
        
        if system_api_key:
            try:
                image_adapter = ImageAdapter(
                    api_key=system_api_key,
                    provider=default_img_provider,
                    model=default_img_model
                )
                
                image_data = await image_adapter.generate_image(enhanced_prompt, request.style)
                
                print(f"[SUCCESS] Image generated via {default_img_provider} with {default_img_model}!")
                print(f"{'='*60}\n")
                
                return await log_and_return_result({
                    "url": image_data.get('url'),
                    "image_base64": image_data.get('image_base64'),
                    "prompt": enhanced_prompt,
                    "model": default_img_model,
                    "provider": default_img_provider.replace('_', ' ').title()
                })
            except Exception as e:
                print(f"[WARNING] {default_img_provider} failed: {e}")
                print(f"[FALLBACK] Will try fallback providers...")
        else:
            print(f"[WARNING] No {default_img_provider} API key found, trying fallback providers...")
    
    # Fallback 1: Google AI Studio (if not already tried)
    if default_img_provider != "google_ai_studio" and (image_model in ['gemini-stock', 'google/gemini-2.5-flash-image', 'gemini-2.5-flash-image'] or image_model is None):
        print(f"[IMAGE] Fallback 1: Trying Google AI Studio...")
        system_api_key, provider = await get_system_api_key("google_ai_studio")
        
        if not system_api_key:
            system_api_key, provider = await get_user_api_key(request.user_id, "google_ai_studio")
        
        if system_api_key:
            try:
                image_adapter = ImageAdapter(
                    api_key=system_api_key,
                    provider="google_ai_studio",
                    model="gemini-2.5-flash-image"
                )
                
                image_data = await image_adapter.generate_image(enhanced_prompt, request.style)
                
                print(f"[SUCCESS] Image generated via Google AI Studio!")
                print(f"{'='*60}\n")
                
                return await log_and_return_result({
                    "url": image_data.get('url'),
                    "image_base64": image_data.get('image_base64'),
                    "prompt": enhanced_prompt,
                    "model": "gemini-2.5-flash-image",
                    "provider": "Google AI Studio"
                })
            except Exception as e:
                print(f"[WARNING] Google AI Studio failed: {e}")
                print(f"[FALLBACK] Will try stock photos next...")
    
    # Priority 2: Stock Photos (Fallback after Google AI Studio - only if explicitly requested)
    if image_model in ['gemini-stock', 'stock-only', 'stock'] or (image_model is None and default_img_provider != "google_ai_studio"):
        print(f"[IMAGE] Priority 2: Trying stock photos (fallback)...")
        try:
            from linkedpilot.utils.stock_image_fetcher import StockImageFetcher, extract_image_keywords_ai
            
            # Get system stock image API keys (admin-managed)
            db = get_db()
            system_settings = await db.system_settings.find_one({"_id": "api_keys"})
            
            unsplash_key = None
            pexels_key = None
            openai_key = None
            
            if system_settings:
                from cryptography.fernet import Fernet
                ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', '')
                if ENCRYPTION_KEY:
                    cipher_suite = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
                    
                    if system_settings.get('unsplash_access_key'):
                        try:
                            unsplash_key = cipher_suite.decrypt(system_settings['unsplash_access_key'].encode()).decode()
                            print(f"   [DEBUG] Unsplash key decrypted: {unsplash_key[:8]}...")
                        except Exception as e:
                            print(f"   [WARNING] Failed to decrypt Unsplash key: {e}")
                    
                    if system_settings.get('pexels_api_key'):
                        try:
                            pexels_key = cipher_suite.decrypt(system_settings['pexels_api_key'].encode()).decode()
                            print(f"   [DEBUG] Pexels key decrypted: {pexels_key[:8]}...")
                        except Exception as e:
                            print(f"   [WARNING] Failed to decrypt Pexels key: {e}")
                    
                    if system_settings.get('openai_api_key'):
                        try:
                            openai_key = cipher_suite.decrypt(system_settings['openai_api_key'].encode()).decode()
                        except Exception as e:
                            print(f"   [WARNING] Failed to decrypt OpenAI key: {e}")
                else:
                    print(f"   [ERROR] ENCRYPTION_KEY not set in environment")
            else:
                print(f"   [WARNING] No system_settings found in database")
            
            print(f"   [DEBUG] Using Unsplash: {bool(unsplash_key)}, Pexels: {bool(pexels_key)}")
            
            # Extract keywords using AI for better visual descriptions
            keywords = await extract_image_keywords_ai(request.prompt, request.topic if request.topic else request.prompt[:100], openai_key)
            print(f"   AI-generated keywords: {keywords}")
            
            # Fetch stock image
            fetcher = StockImageFetcher(unsplash_key=unsplash_key, pexels_key=pexels_key)
            image_data = await fetcher.fetch_image(keywords, orientation="landscape")
            
            if image_data:
                print(f"   [SUCCESS] Stock image found from {image_data['source']}")
                print(f"   Photographer: {image_data['photographer']}")
                print(f"{'='*60}\n")
                
                return await log_and_return_result({
                    "url": image_data['url'],
                    "source": image_data['source'],
                    "photographer": image_data['photographer'],
                    "photographer_url": image_data.get('photographer_url'),
                    "attribution": image_data['attribution'],
                    "prompt": keywords,
                    "model": "Stock Photo",
                    "provider": image_data['source'],
                    "cost": "$0.00",
                    "note": f"Free stock photo from {image_data['source']}"
                })
            else:
                print(f"   [WARNING] No stock images found")
        except Exception as stock_error:
            print(f"   [WARNING] Stock image failed: {stock_error}")
    
    # Priority 3: OpenRouter (Fallback for Gemini if direct Google AI Studio failed)
    # Try OpenRouter as fallback for Gemini models only
    if image_model in ['google/gemini-2.5-flash-image', 'gemini-2.5-flash-image'] or (image_model is None and default_img_model in ['gemini-2.5-flash-image', 'google/gemini-2.5-flash-image']):
        print(f"[IMAGE] Priority 4: Trying OpenRouter as last resort...")
        openrouter_key, _ = await get_system_api_key("openrouter")
        
        if not openrouter_key:
            openrouter_key, _ = await get_user_api_key(request.user_id, "openrouter")
        
        if openrouter_key:
            try:
                image_adapter = ImageAdapter(
                    api_key=openrouter_key,
                    provider="openrouter",
                    model="google/gemini-2.5-flash-image"  # OpenRouter format
                )
                
                image_data = await image_adapter.generate_image(enhanced_prompt, request.style)
                
                print(f"[SUCCESS] Image generated via OpenRouter!")
                print(f"{'='*60}\n")
                
                return await log_and_return_result({
                    "url": image_data.get('url'),
                    "image_base64": image_data.get('image_base64'),
                    "prompt": enhanced_prompt,
                    "model": "google/gemini-2.5-flash-image",
                    "provider": "OpenRouter"
                })
            except Exception as e:
                print(f"[WARNING] OpenRouter failed: {e}")
        else:
            print(f"[WARNING] No OpenRouter API key found")
    
    # Priority 5: AI Horde (free, crowdsourced) - Absolute last resort
    if image_model in ['ai_horde', 'gemini-stock', 'stock', 'google/gemini-2.5-flash-image', 'gemini-2.5-flash-image', 'gemini-2.0-flash-exp'] or image_model is None:
        print(f"[IMAGE] Using AI Horde (free, crowdsourced - last resort)")
        image_adapter = ImageAdapter(
            api_key="0000000000",
            provider="ai_horde",
            model="stable_diffusion_xl"
        )
        
        try:
            image_data = await image_adapter.generate_image(enhanced_prompt, request.style)
            print(f"[SUCCESS] AI Horde image generated!")
            print(f"{'='*60}\n")
            
            return await log_and_return_result({
                "url": image_data.get('url'),
                "prompt": enhanced_prompt,
                "model": "AI Horde (Stable Diffusion XL)",
                "provider": "AI Horde",
                "cost": "$0.00",
                "wait_time": image_data.get('wait_time', 0),
                "note": f"Free crowdsourced generation completed in {image_data.get('wait_time', 0)} seconds"
            })
        except Exception as e:
            print(f"[ERROR] AI Horde failed: {e}")
            print(f"{'='*60}\n")
            raise HTTPException(
                status_code=500,
                detail=f"Image generation failed. All methods exhausted. Please try again later or add your API key in Settings."
            )
    
    # If we get here, all methods have been exhausted
    print(f"[ERROR] All image generation methods failed for model: {image_model}")
    raise HTTPException(
        status_code=500,
        detail=f"Image generation failed. All providers exhausted. Please add API keys in Settings or try again later."
    )

@router.post("/upload-image")
async def upload_user_image(
    image: UploadFile = File(...),
    org_id: str = Form(...)
):
    """
    Upload user's own image for a post
    Converts to base64 data URL
    """
    print(f"\n{'='*60}")
    print(f"[UPLOAD] /api/drafts/upload-image called")
    print(f"   Org ID: {org_id}")
    print(f"   Filename: {image.filename}")
    print(f"   Content Type: {image.content_type}")
    
    try:
        # Read image file
        contents = await image.read()
        
        # Convert to base64
        import base64
        img_base64 = base64.b64encode(contents).decode()
        data_url = f"data:{image.content_type};base64,{img_base64}"
        
        print(f"[SUCCESS] Image uploaded and converted to base64")
        print(f"   Size: {len(img_base64)} bytes")
        print(f"{'='*60}\n")
        
        return {
            "success": True,
            "url": data_url,
            "filename": image.filename,
            "size": len(contents)
        }
    except Exception as e:
        print(f"[ERROR] Image upload failed: {e}")
        print(f"{'='*60}\n")
        raise HTTPException(status_code=500, detail=f"Image upload failed: {str(e)}")

@router.post("/generate-carousel")
async def generate_carousel_draft(request: DraftGenerateRequest):
    """Generate carousel draft with AI content and images"""
    print(f"\n{'='*60}")
    print(f"🎠 /api/drafts/generate-carousel called")
    print(f"   User ID: {request.created_by}")
    print(f"   Topic: {request.topic}")
    
    # Get user's OpenAI API key
    user_api_key = await get_user_openai_key(request.created_by)
    
    if not user_api_key:
        print(f"❌ No user API key found")
        raise HTTPException(status_code=400, detail="OpenAI API key required. Please add it in Settings.")
    
    llm = LLMAdapter(api_key=user_api_key)
    image_adapter = ImageAdapter(
        api_key=user_api_key,
        provider="openrouter",
        model="google/gemini-2.5-flash-image"
    )
    
    # Generate carousel content
    context = {
        'topic': request.topic,
        'tone': request.tone,
        'num_slides': 5  # Default to 5 slides
    }
    
    carousel_data = await llm.generate_carousel_content(context)
    
    print(f"✅ Carousel content generated: {len(carousel_data.get('slides', []))} slides")
    
    # Generate images for each slide
    slides_with_images = []
    for i, slide in enumerate(carousel_data.get('slides', [])):
        print(f"   Generating image for slide {i+1}...")
        # Generate cinematic carousel slide prompt
        from linkedpilot.utils.cinematic_image_prompts import generate_carousel_slide_prompt
        enhanced_image_prompt = generate_carousel_slide_prompt(
            slide['title'], 
            slide['content'], 
            i + 1, 
            len(carousel_data.get('slides', []))
        )
        image_data = await image_adapter.generate_image(enhanced_image_prompt, request.tone)
        
        slides_with_images.append({
            "title": slide['title'],
            "content": slide['content'],
            "image_url": image_data.get('url')
        })
    
    print(f"{'='*60}\n")
    
    return {
        "caption": carousel_data.get('caption'),
        "slides": slides_with_images,
        "hashtags": carousel_data.get('hashtags', []),
        "org_id": request.org_id,
        "type": "carousel"
    }

@router.post("/generate-full")
async def generate_full_draft(org_id: str, campaign_id: str, mode: str, author_id: str, context: Dict = {}):
    """Generate draft content using AI"""
    llm = LLMAdapter()
    content = await llm.generate_post_content(context, mode)
    
    # Create draft
    draft = Draft(
        org_id=org_id,
        campaign_id=campaign_id,
        author_id=author_id,
        mode=DraftMode(mode),
        content=content
    )
    
    db = get_db()
    draft_dict = draft.model_dump()
    draft_dict['created_at'] = datetime.utcnow().isoformat()
    draft_dict['updated_at'] = datetime.utcnow().isoformat()
    
    await db.drafts.insert_one(draft_dict)
    return draft

@router.get("", response_model=List[Draft])
async def list_drafts(org_id: str):
    """List all drafts for an organization"""
    db = get_db()
    drafts = await db.drafts.find({"org_id": org_id}).to_list(length=100)
    
    for d in drafts:
        if isinstance(d.get('created_at'), str):
            d['created_at'] = datetime.fromisoformat(d['created_at'])
        if isinstance(d.get('updated_at'), str):
            d['updated_at'] = datetime.fromisoformat(d['updated_at'])
    
    return [Draft(**d) for d in drafts]

@router.get("/google-fonts")
async def get_google_fonts():
    """Get list of available Google Fonts"""
    from linkedpilot.utils.image_text_overlay import get_google_fonts_list
    fonts = get_google_fonts_list()
    return {"fonts": fonts}

@router.post("/generate-text-overlay")
async def generate_ai_text_overlay(request: Dict):
    """Generate AI-powered text overlay template for campaign image
    
    Uses campaign data and web research to suggest optimal text placement
    and styling for professional-looking overlays"""
    print(f"\n{'='*60}")
    print(f"[AI TEXT OVERLAY] Generating overlay template")
    
    campaign_content = request.get('content', '')
    hashtags = request.get('hashtags', [])
    image_prompt = request.get('imagePrompt', '')
    image_description = request.get('imageDescription', '')
    
    # Get default model setting from admin configuration
    default_model_setting = await get_default_model_setting('text_text_overlay')
    default_provider, default_model = parse_model_setting(default_model_setting)
    
    print(f"[TEXT OVERLAY] Using default model: {default_provider}:{default_model}")
    
    # Get user_id from request if available
    user_id = request.get('user_id') or request.get('created_by', '')
    
    # Multi-provider fallback: Use configured default first, then fallback providers
    providers_to_try = []
    
    # Priority 1: Use configured default model
    default_key, _ = await get_system_api_key(default_provider)
    if not default_key and user_id:
        default_key, _ = await get_user_api_key(user_id, default_provider)
    if default_key:
        providers_to_try.append((default_provider, default_model))
    
    # Priority 2-4: Add other providers if keys are present (for fallback)
    if default_provider != "google_ai_studio":
        google_key, _ = await get_system_api_key("google_ai_studio")
        if not google_key and user_id:
            google_key, _ = await get_user_api_key(user_id, "google_ai_studio")
        if google_key:
            providers_to_try.append(("google_ai_studio", "gemini-2.5-flash"))
    
    if default_provider != "openai":
        openai_key, _ = await get_system_api_key("openai")
        if not openai_key and user_id:
            openai_key, _ = await get_user_api_key(user_id, "openai")
        if openai_key:
            providers_to_try.append(("openai", "gpt-4o"))
    
    if default_provider != "anthropic":
        anthropic_key, _ = await get_system_api_key("anthropic")
        if not anthropic_key and user_id:
            anthropic_key, _ = await get_user_api_key(user_id, "anthropic")
        if anthropic_key:
            providers_to_try.append(("anthropic", "claude-3-5-sonnet"))
    
    if default_provider != "openrouter":
        openrouter_key, _ = await get_system_api_key("openrouter")
        if not openrouter_key and user_id:
            openrouter_key, _ = await get_user_api_key(user_id, "openrouter")
        if openrouter_key:
            providers_to_try.append(("openrouter", "anthropic/claude-3.5-sonnet"))
    
    result = None
    last_error = None
    
    for provider_name, model_name in providers_to_try:
        try:
            print(f"[LLM] Trying provider: {provider_name} with model: {model_name}")
            
            system_api_key, provider = await get_system_api_key(provider_name)
            
            if not system_api_key:
                print(f"   [SKIP] No system API key configured for {provider_name}")
                continue
            
            print(f"   [SUCCESS] System API key found for {provider_name}")
            
            llm = LLMAdapter(
                api_key=system_api_key,
                provider=provider,
                model=model_name
            )
            
            # Build context for AI text overlay generation
            prompt = f"""You are a professional graphic designer specializing in social media campaign images.
Create a text overlay design plan for this campaign:

CAMPAIGN CONTENT:
{campaign_content}

HASHTAGS: {', '.join(hashtags)}

IMAGE DESCRIPTION: {image_description}

IMAGE PROMPT: {image_prompt}

Analyze this campaign and design 2-4 strategic text overlay elements that:
1. Enhance the message without cluttering the image
2. Use professional typography and modern design principles
3. Position text in visually pleasing locations (follow rule of thirds, avoid dead centers)
4. Use appropriate colors that contrast well with likely image backgrounds
5. Create visual hierarchy (main headline, subhead, call-to-action if needed)
6. Match the professional tone suitable for LinkedIn

Return a JSON array of text overlay objects with this exact structure:
[
  {{
    "text": "Main headline text",
    "position": [x_percent, y_percent],
    "font_size": 72,
    "font_name": "Poppins",
    "font_weight": 700,
    "font_style": "normal",
    "text_decoration": "none",
    "text_align": "center",
    "color": "#FFFFFF",
    "stroke_width": 2,
    "stroke_color": "#000000",
    "width": 400,
    "height": 150,
    "rotation": 0
  }}
]

Positions use percentages (0-100) relative to image dimensions.
Return ONLY valid JSON, no markdown or explanation."""

            response = await llm.llm_complete(prompt)
            result_text = response.strip()
            
            # Parse JSON from response
            import json
            import re
            # Extract JSON array if wrapped in markdown or other text
            json_match = re.search(r'\[.*\]', result_text, re.DOTALL)
            if json_match:
                result_text = json_match.group(0)
            
            result = json.loads(result_text)
            
            print(f"   [SUCCESS] Text overlay generated with {provider_name}!")
            print(f"   Generated {len(result)} text elements")
            break  # Success! Exit the loop
            
        except Exception as e:
            last_error = e
            print(f"   [ERROR] {provider_name} failed: {str(e)}")
            continue
    
    if result is None:
        print(f"[ERROR] All providers failed. Last error: {last_error}")
        print(f"{'='*60}\n")
        raise HTTPException(status_code=500, detail=f"Failed to generate overlay: {str(last_error)}")
    
    print(f"{'='*60}\n")
    return {"overlay_elements": result}

@router.get("/{draft_id}", response_model=Draft)
async def get_draft(draft_id: str):
    """Get draft by ID"""
    db = get_db()
    draft = await db.drafts.find_one({"id": draft_id}, {"_id": 0})
    
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    if isinstance(draft.get('created_at'), str):
        draft['created_at'] = datetime.fromisoformat(draft['created_at'])
    if isinstance(draft.get('updated_at'), str):
        draft['updated_at'] = datetime.fromisoformat(draft['updated_at'])
    
    return Draft(**draft)

@router.delete("/{draft_id}")
async def delete_draft(draft_id: str):
    """Delete a draft"""
    db = get_db()
    result = await db.drafts.delete_one({"id": draft_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    return {"message": "Draft deleted successfully", "id": draft_id}

@router.post("/{draft_id}/chat")
async def chat_edit_draft(draft_id: str, message: str):
    """Edit draft using chat interface"""
    db = get_db()
    draft = await db.drafts.find_one({"id": draft_id}, {"_id": 0})
    
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    # Get current content and history
    current_content = draft['content'].get('body', '')
    history = draft.get('ai_edit_history', [])
    
    # Generate edited content
    llm = LLMAdapter()
    edited_content = await llm.edit_post_with_chat(current_content, message, history)
    
    # Update draft
    history.append({"role": "user", "content": message})
    history.append({"role": "assistant", "content": edited_content})
    
    draft['content']['body'] = edited_content
    draft['ai_edit_history'] = history
    draft['version'] = draft.get('version', 1) + 1
    draft['updated_at'] = datetime.utcnow().isoformat()
    
    await db.drafts.update_one(
        {"id": draft_id},
        {"$set": {
            "content": draft['content'],
            "ai_edit_history": history,
            "version": draft['version'],
            "updated_at": draft['updated_at']
        }}
    )
    
    return {"draft_id": draft_id, "content": draft['content'], "version": draft['version']}

@router.post("/{draft_id}/generate-images")
async def generate_images_for_draft(draft_id: str, provider: str = "google_ai_studio", style: str = "professional"):
    """Generate images for draft using Google AI Studio (Gemini 2.5 Flash Image) - DALL-E removed"""
    db = get_db()
    draft = await db.drafts.find_one({"id": draft_id}, {"_id": 0})
    
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    # Generate image using cinematic approach
    # Get Google AI Studio API key (DALL-E removed - always use Gemini)
    from linkedpilot.routes.drafts import get_system_api_key
    system_api_key, _ = await get_system_api_key("google_ai_studio")
    if not system_api_key:
        raise HTTPException(status_code=500, detail="Google AI Studio API key not configured")
    
    # Force provider to google_ai_studio (DALL-E removed)
    provider = "google_ai_studio"
    
    image_adapter = ImageAdapter(
        api_key=system_api_key,
        provider=provider,
        model="gemini-2.5-flash-image"
    )
    content_preview = draft['content'].get('body', '')
    # Extract hook for cinematic generation
    lines = content_preview.split('\n')
    hook = ''
    for line in lines:
        line = line.strip()
        if line and not line.startswith('#') and len(line) > 20:
            hook = line
            break
    if not hook:
        hook = content_preview[:200].strip()
    
    # Generate cinematic prompt
    from linkedpilot.utils.cinematic_image_prompts import generate_cinematic_image_prompt
    enhanced_prompt = generate_cinematic_image_prompt(hook, content_preview)
    image_data = await image_adapter.generate_image(enhanced_prompt, style)
    
    # Add to draft assets
    assets = draft.get('assets', [])
    assets.append({
        "type": "image",
        "url": image_data['url'],
        "prompt": image_data['prompt'],
        "generated_at": datetime.utcnow().isoformat()
    })
    
    await db.drafts.update_one(
        {"id": draft_id},
        {"$set": {"assets": assets, "updated_at": datetime.utcnow().isoformat()}}
    )
    return Draft(**draft)

@router.post("/add-text-overlay")
async def add_text_overlay(request: dict):
    """Add text overlay to an image using Pillow"""
    print(f"\n{'='*60}")
    print(f"[TEXT_OVERLAY] /api/drafts/add-text-overlay called")
    
    try:
        from linkedpilot.utils.image_text_overlay import add_text_overlay_to_image
        
        image_base64 = request.get('image_base64')
        text = request.get('text', '')
        position = request.get('position', [50, 50])
        font_name = request.get('font_name', 'Arial')
        font_size = request.get('font_size', 48)
        font_weight = request.get('font_weight', 400)
        font_style = request.get('font_style', 'normal')
        text_decoration = request.get('text_decoration', 'none')
        text_align = request.get('text_align', 'left')
        color = request.get('color', '#FFFFFF')
        stroke_width = request.get('stroke_width', 0)
        stroke_color = request.get('stroke_color', '#000000')
        shadow_enabled = request.get('shadow_enabled', False)
        shadow_color = request.get('shadow_color', '#000000')
        shadow_blur = request.get('shadow_blur', 10)
        shadow_offset_x = request.get('shadow_offset_x', 0)
        shadow_offset_y = request.get('shadow_offset_y', 0)
        background_color = request.get('background_color', 'transparent')
        opacity = request.get('opacity', 100)
        letter_spacing = request.get('letter_spacing', 0)
        line_height = request.get('line_height', 1.2)
        rotation = request.get('rotation', 0)
        width = request.get('width', 300)
        height = request.get('height', 100)
        
        if not image_base64:
            raise HTTPException(status_code=400, detail="image_base64 is required")
        
        # Convert position to tuple
        position_tuple = (int(position[0]), int(position[1]))
        
        # Add text overlay
        result_image = await add_text_overlay_to_image(
            image_base64=image_base64,
            text=text,
            position=position_tuple,
            font_name=font_name,
            font_size=font_size,
            font_weight=font_weight,
            font_style=font_style,
            text_decoration=text_decoration,
            text_align=text_align,
            color=color,
            stroke_width=stroke_width,
            stroke_color=stroke_color,
            shadow_enabled=shadow_enabled,
            shadow_color=shadow_color,
            shadow_blur=shadow_blur,
            shadow_offset_x=shadow_offset_x,
            shadow_offset_y=shadow_offset_y,
            background_color=background_color,
            opacity=opacity,
            letter_spacing=letter_spacing,
            line_height=line_height,
            rotation=rotation,
            width=width,
            height=height
        )
        
        print(f"[SUCCESS] Text overlay added successfully!")
        print(f"{'='*60}\n")
        
        return {
            "success": True,
            "image_base64": result_image,
            "url": f"data:image/png;base64,{result_image}"
        }
        
    except Exception as e:
        print(f"[ERROR] Text overlay failed: {e}")
        print(f"{'='*60}\n")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Text overlay failed: {str(e)}")

@router.post("/auto-detect-text-position")
async def auto_detect_text_position(request: dict):
    """AI suggests optimal text overlay position and styling"""
    print(f"\n{'='*60}")
    print(f"[TEXT_OVERLAY] /api/drafts/auto-detect-text-position called")
    
    try:
        from linkedpilot.utils.image_text_overlay import auto_determine_best_position
        
        image_base64 = request.get('image_base64')
        text = request.get('text', 'Sample Text')
        
        if not image_base64:
            raise HTTPException(status_code=400, detail="image_base64 is required")
        
        # Get AI suggestion
        suggestions = await auto_determine_best_position(
            image_base64=image_base64,
            text=text
        )
        
        print(f"[SUCCESS] AI position detection complete!")
        print(f"   Position: {suggestions.get('position')}")
        print(f"   Font size: {suggestions.get('font_size')}")
        print(f"{'='*60}\n")
        
        return {
            "success": True,
            "suggestions": suggestions
        }
        
    except Exception as e:
        print(f"[ERROR] AI detection failed: {e}")
        print(f"{'='*60}\n")
        raise HTTPException(status_code=500, detail=f"AI detection failed: {str(e)}")
    
 