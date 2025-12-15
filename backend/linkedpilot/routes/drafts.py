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
    org_id: Optional[str] = None  # Organization ID for prompt logging and brand DNA
    campaign_id: Optional[str] = None  # Campaign ID for campaign context
    model: str = "gemini-3-pro-image-preview"  # Image model to use (default: Gemini 3 Pro Image Preview)
    session_id: Optional[str] = None  # Session ID for WebSocket progress updates
    draft_id: Optional[str] = None  # Draft ID for prompt history tracking

class DraftChatRequest(PydanticBaseModel):
    messages: List[Dict[str, str]]
    org_id: Optional[str] = None
    user_id: str
    generate_with_image: Optional[bool] = True  # Flag to trigger image generation (default: always generate)


router = APIRouter(prefix="/drafts", tags=["drafts"])
# Force reload for chat endpoint

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
            'image_draft_image': 'google_ai_studio:gemini-3-pro-image-preview',  # Updated to Gemini 3 Pro Image Preview
            'image_carousel_images': 'google_ai_studio:gemini-3-pro-image-preview'  # Updated to Gemini 3 Pro Image Preview
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
        key_type: Type of key to prioritize ("google_ai", "openai", or "any")
    
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
        key_priority = ['google_ai_api_key', 'openai_api_key']
    elif key_type == "openai":
        key_priority = ['openai_api_key', 'google_ai_api_key']
    else:  # "any"
        key_priority = ['openai_api_key', 'google_ai_api_key']
    
    # Try keys in priority order
    api_key_field = None
    provider = None
    for key_field in key_priority:
        if system_settings.get(key_field):
            api_key_field = key_field
            if key_field == 'google_ai_api_key':
                provider = 'google_ai_studio'
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
        key_type: Type of key to prioritize ("google_ai", "openai", or "any")
    
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
        key_priority = ['google_ai_api_key', 'openai_api_key']
    elif key_type == "openai":
        key_priority = ['openai_api_key', 'google_ai_api_key']
    else:  # "any"
        key_priority = ['openai_api_key', 'google_ai_api_key']
    
    # Try keys in priority order
    api_key_field = None
    provider = None
    for key_field in key_priority:
        if settings.get(key_field):
            api_key_field = key_field
            if key_field == 'google_ai_api_key':
                provider = 'google_ai_studio'
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
    
    # ALWAYS use system API keys from admin dashboard - users never enter API keys
    # Priority 1: Use configured default model
    default_key, _ = await get_system_api_key(default_provider)
    if default_key:
        providers_to_try.append((default_provider, default_model))
        print(f"   [SUCCESS] Added default model: {default_provider}:{default_model}")
    
    # Priority 2-4: Add other providers if keys are present (for fallback)
    # Google AI Studio
    if default_provider != "google_ai_studio":
        google_key, _ = await get_system_api_key("google_ai_studio")
        if google_key:
            providers_to_try.append(("google_ai_studio", "gemini-2.5-flash"))
    
    # OpenAI
    if default_provider != "openai":
        openai_key, _ = await get_system_api_key("openai")
        if openai_key:
            providers_to_try.append(("openai", "gpt-4o"))
    
    
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
                'goal': 'engagement',
                'org_id': request.org_id,
                'author_id': request.created_by,
                'format': request.type
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
        "generation_prompt": content_data.get('generation_prompt'),
        "template_id": content_data.get('template_id'),
        "template_label": content_data.get('template_label'),
        "image_caption": content_data.get('image_caption'),
        "image_style": content_data.get('image_style'),
        "image_caption_brief": content_data.get('image_caption_brief')
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
    Generate image for a draft with Gemini 3 Pro Image Preview as default and Stock as fallback:
    1. Gemini 3 Pro Image Preview (google/gemini-3-pro-image-preview) - Default Primary
    2. Stock Photos (Unsplash/Pexels) - Primary Fallback
    3. Google AI Studio (for Gemini models) - Secondary Fallback
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
        """Log the prompt to database after successful generation and generate text overlay suggestions"""
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
        
        # Generate text overlay suggestions if using Gemini 3 Pro Image Preview (supports text)
        if result_data.get('url') and ('gemini-3-pro-image-preview' in str(result_data.get('model', '')).lower() or 'gemini-3-pro' in str(result_data.get('model', '')).lower()):
            try:
                print(f"[TEXT_OVERLAY] Generating editable text overlay suggestions for Gemini 3 Pro image...")
                # Import here to avoid circular dependency
                from ..utils.gemini_overlay_agent import GeminiOverlayAgent
                from ..routes.drafts import get_system_api_key
                
                # Get API key for Gemini overlay agent
                api_key, _ = await get_system_api_key("google_ai_studio")
                if api_key:
                    agent = GeminiOverlayAgent(api_key=api_key)
                    overlay_result = await agent.generate_overlay(
                        image_url=result_data.get('url'),
                        post_content=request.prompt or request.topic or '',
                        call_to_action='',
                        brand_info=''
                    )
                    result_data['text_overlay'] = overlay_result.get('elements', [])
                    result_data['text_overlay_template_id'] = overlay_result.get('template_id')
                    print(f"[TEXT_OVERLAY] Generated {len(result_data.get('text_overlay', []))} editable text overlay elements")
                else:
                    print(f"[WARNING] No API key for text overlay generation")
                    result_data['text_overlay'] = []
            except Exception as overlay_error:
                print(f"[WARNING] Failed to generate text overlay suggestions: {overlay_error}")
                import traceback
                traceback.print_exc()
                # Don't fail the request if overlay generation fails
                result_data['text_overlay'] = []
        
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
    
    # Fetch brand DNA (colors, fonts) and campaign context if org_id is provided
    brand_colors = None
    brand_fonts = None
    campaign_context = None
    
    if request.org_id:
        try:
            db = get_db()
            # Get brand analysis
            brand_analysis = await db.brand_analysis.find_one({"org_id": request.org_id}, {"_id": 0})
            if brand_analysis:
                brand_colors = brand_analysis.get('brand_colors', [])
                brand_fonts = brand_analysis.get('brand_fonts', [])
                print(f"   [IMAGE] Found brand DNA: {len(brand_colors)} colors, {len(brand_fonts)} fonts")
            
            # Get campaign context if campaign_id is provided
            if hasattr(request, 'campaign_id') and request.campaign_id:
                campaign = await db.campaigns.find_one({"id": request.campaign_id}, {"_id": 0})
                if campaign:
                    campaign_context = f"{campaign.get('name', '')} - {campaign.get('description', '')}"
                    print(f"   [IMAGE] Found campaign context: {campaign.get('name', 'N/A')}")
        except Exception as brand_error:
            print(f"   [WARNING] Failed to fetch brand DNA: {brand_error}")
    
    if system_openai_key:
        try:
            print(f"   [IMAGE] Step 2/3: AI creating custom visual metaphor with brand DNA...")
            from linkedpilot.utils.ai_image_prompt_optimizer import generate_optimized_image_prompt
            
            ai_analysis = await generate_optimized_image_prompt(
                post_content=request.prompt,
                ai_api_key=system_openai_key,
                ai_model="gpt-4o",
                brand_colors=brand_colors,
                brand_fonts=brand_fonts,
                campaign_context=campaign_context
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
    if image_model == default_img_model or image_model in ['gemini-stock', 'google/gemini-3-pro-image-preview', 'gemini-3-pro-image-preview', 'gemini-2.5-flash-image', 'gemini-2.0-flash-exp'] or image_model is None:
        print(f"[IMAGE] Priority 1: Attempting {default_img_provider} with {default_img_model}...")
        
        # Try to get API key for configured provider
        system_api_key, provider = await get_system_api_key(default_img_provider)
        
        # ALWAYS use system API keys from admin dashboard - users never enter API keys
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
    if default_img_provider != "google_ai_studio" and (image_model in ['gemini-stock', 'google/gemini-3-pro-image-preview', 'gemini-3-pro-image-preview', 'google/gemini-2.5-flash-image', 'gemini-2.5-flash-image'] or image_model is None):
        print(f"[IMAGE] Fallback 1: Trying Google AI Studio...")
        # ALWAYS use system API keys from admin dashboard - users never enter API keys
        system_api_key, provider = await get_system_api_key("google_ai_studio")
        
        if system_api_key:
            try:
                image_adapter = ImageAdapter(
                    api_key=system_api_key,
                    provider="google_ai_studio",
                    model="gemini-3-pro-image-preview"
                )
                
                image_data = await image_adapter.generate_image(enhanced_prompt, request.style)
                
                print(f"[SUCCESS] Image generated via Google AI Studio!")
                print(f"{'='*60}\n")
                
                return await log_and_return_result({
                    "url": image_data.get('url'),
                    "image_base64": image_data.get('image_base64'),
                    "prompt": enhanced_prompt,
                    "model": "gemini-3-pro-image-preview",
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
                    "image_base64": None,
                    "prompt": keywords,
                    "model": "Stock Photo",
                    "provider": image_data['source']
                })
            else:
                print(f"   [WARNING] No stock images found")
                # Only raise HTTPException if stock images were explicitly requested
                # Otherwise, continue to fallback providers
                if image_model in ['gemini-stock', 'stock-only', 'stock']:
                    raise HTTPException(status_code=404, detail="No stock images found")
                # If it's just a fallback, don't raise exception - continue to next provider
                
        except HTTPException:
            # Re-raise HTTPException so it's returned to the client
            raise
        except Exception as e:
            print(f"[ERROR] Stock image fallback failed: {e}")
            # Fallback to Google AI Studio if stock fails (for non-HTTPException errors)
            pass
            
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

class AIOverlayRequest(PydanticBaseModel):
    image_url: str = ""
    post_content: str = ""
    call_to_action: str = ""
    brand_info: str = ""

@router.post("/generate-ai-overlay")
async def generate_ai_overlay(request: AIOverlayRequest):
    """
    Generate AI text overlay suggestions using Gemini multi-step agent system
    Uses Gemini to analyze images and ensure text stays within bounds
    """
    print(f"\n{'='*60}")
    print(f"[AI OVERLAY] /api/drafts/generate-ai-overlay called (Gemini Agent)")
    try:
        print(f"   Image URL: {request.image_url[:50] if request.image_url else 'None'}...")
        print(f"   Content: {request.post_content[:100] if request.post_content else 'None'}...")
    except Exception as e:
        print(f"   [WARNING] Error logging request: {e}")
    
    try:
        # Get API key for Gemini
        from ..utils.api_key_helper import get_api_key_and_provider
        from ..routes.settings import decrypt_value
        
        # Try to get user API key from request context (if available)
        api_key = None
        user_id = None
        
        # Check if we can get user_id from request (might need to pass it)
        # For now, use system key
        if not api_key:
            api_key, _ = await get_system_api_key("google_ai_studio")
        
        if not api_key:
            # Fallback to environment variable
            import os
            api_key = os.getenv('GOOGLE_AI_API_KEY')
        
        if not api_key:
            print(f"[WARNING] No Gemini API key found, using fallback")
            # Use fallback basic generation
            return await _generate_fallback_overlay(request)
        
        # Use Gemini multi-step agent system
        from ..utils.gemini_overlay_agent import GeminiOverlayAgent
        
        agent = GeminiOverlayAgent(api_key=api_key)
        # Generate overlay with multiple candidates (default: 3)
        result = await agent.generate_overlay(
            image_url=request.image_url,
            post_content=request.post_content,
            call_to_action=request.call_to_action,
            brand_info=request.brand_info,
            return_multiple=True,  # Enable multi-candidate generation
            top_n=3  # Return top 3 candidates
        )
        
        elements_count = len(result.get('elements', []))
        alternatives_count = len(result.get('alternatives', []))
        print(f"[SUCCESS] Gemini agent generated {elements_count} primary elements")
        if alternatives_count > 0:
            print(f"   Plus {alternatives_count} alternative designs")
        print(f"   Best score: {result.get('scores', {}).get(0, 'N/A')}")
        print(f"{'='*60}\n")
        
        return result
        
    except Exception as e:
        print(f"[ERROR] Gemini agent failed: {e}")
        import traceback
        traceback.print_exc()
        # Fallback to basic generation
        print(f"[FALLBACK] Using basic overlay generation")
        try:
            return await _generate_fallback_overlay(request)
        except Exception as fallback_error:
            print(f"[FALLBACK ERROR] {fallback_error}")
            # Return minimal valid response to prevent CORS issues
            return {
                "elements": [{
                    "text": request.post_content[:50] if request.post_content else "Add Your Text",
                    "position": [15, 25],
                    "font_size": 64,
                    "font_name": "Poppins",
                    "font_weight": 700,
                    "font_style": "normal",
                    "text_decoration": "none",
                    "text_align": "left",
                    "color": "#FFFFFF",
                    "stroke_width": 0,
                    "stroke_color": "#000000",
                    "width": 600,
                    "height": 100,
                    "rotation": 0,
                    "line_height": 1.2,
                    "letter_spacing": 0,
                    "opacity": 100,
                    "shadow_enabled": True,
                    "shadow_color": "#000000",
                    "shadow_blur": 25,
                    "shadow_offset_x": 0,
                    "shadow_offset_y": 5,
                    "background_color": "transparent",
                    "background_opacity": 100
                }],
                "template_id": "minimal-fallback"
            }


async def _generate_fallback_overlay(request: AIOverlayRequest):
    """Fallback basic overlay generation if Gemini fails - uses left-side professional layout"""
    elements = []
    
    # Extract headline from CTA or content
    headline_text = request.call_to_action if request.call_to_action else ""
    if not headline_text and request.post_content:
        # Extract first 5-8 words as headline
        words = request.post_content.split()[:8]
        headline_text = ' '.join(words)
    
    # Main headline - LEFT SIDE
    if headline_text:
        elements.append({
            "text": headline_text,
            "position": [15, 22],  # Left side, professional positioning
            "font_size": 72,
            "font_name": "Poppins",
            "font_weight": 700,
            "font_style": "normal",
            "text_decoration": "none",
            "color": "#FFFFFF",
            "text_align": "left",  # Left alignment for professional look
            "rotation": 0,
            "stroke_width": 0,
            "stroke_color": "#000000",
            "shadow_enabled": True,
            "shadow_color": "#000000",
            "shadow_blur": 28,
            "shadow_offset_x": 0,
            "shadow_offset_y": 5,
            "opacity": 100,
            "letter_spacing": 0.5,
            "line_height": 1.22,
            "width": 600,
            "height": 120
        })
    
    # Subtext from content - LEFT SIDE
    if request.post_content:
        try:
            sentences = request.post_content.split('.')
            if len(sentences) > 1:
                subtext = sentences[1].strip()[:60]
            else:
                # Use middle portion
                mid = len(request.post_content) // 2
                subtext = request.post_content[mid:mid+60].strip()
        except Exception:
            subtext = request.post_content[:60] if len(request.post_content) > 60 else request.post_content
            
        elements.append({
            "text": subtext,
            "position": [15, 47],  # Left side, below headline
            "font_size": 38,
            "font_name": "Poppins",
            "font_weight": 500,
            "font_style": "normal",
            "text_decoration": "none",
            "color": "#F0F0F0",
            "text_align": "left",  # Left alignment
            "rotation": 0,
            "stroke_width": 0,
            "stroke_color": "#000000",
            "shadow_enabled": True,
            "shadow_color": "#000000",
            "shadow_blur": 22,
            "shadow_offset_x": 0,
            "shadow_offset_y": 4,
            "opacity": 96,
            "letter_spacing": 0,
            "line_height": 1.32,
            "width": 700,
            "height": 90
        })
    
    # Default placeholder if no elements
    if not elements:
        elements.append({
            "text": "Add Your Text Here",
            "position": [15, 25],  # Left side
            "font_size": 64,
            "font_name": "Poppins",
            "font_weight": 700,
            "font_style": "normal",
            "text_decoration": "none",
            "color": "#FFFFFF",
            "text_align": "left",  # Left alignment
            "rotation": 0,
            "stroke_width": 0,
            "stroke_color": "#000000",
            "shadow_enabled": True,
            "shadow_color": "#000000",
            "shadow_blur": 25,
            "shadow_offset_x": 0,
            "shadow_offset_y": 5,
            "opacity": 100,
            "letter_spacing": 0,
            "line_height": 1.2,
            "width": 600,
            "height": 100
        })
    
    return {
        "elements": elements,
        "template_id": "fallback-overlay-left-side"
    }

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
        provider="google_ai_studio",
        model="gemini-3-pro-image-preview"
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
    """Generate AI-powered text overlay template using advanced system
    
    Uses the advanced AI text overlay system (Phases 1-10) with:
    - Content-aware placement (saliency maps)
    - Adaptive typography
    - Template library
    - Quality scoring
    - Caching for performance"""
    print(f"\n{'='*60}")
    print(f"[AI TEXT OVERLAY] Generating overlay using ADVANCED system")
    
    request_data = request  # request is already the dict
    campaign_content = request_data.get('content', '')
    hashtags = request_data.get('hashtags', [])
    image_prompt = request_data.get('imagePrompt', '')
    image_description = request_data.get('imageDescription', '')
    image_url = request_data.get('imageUrl', '')  # Image URL or base64 data URL
    
    # Get image as base64
    image_base64 = None
    if image_url:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=30.0) as client:
                if image_url.startswith('data:image'):
                    # Extract base64 from data URL
                    header, encoded = image_url.split(',', 1)
                    image_base64 = encoded
                else:
                    # Fetch image and convert to base64
                    response = await client.get(image_url)
                    image_base64 = base64.b64encode(response.content).decode()
        except Exception as e:
            print(f"[WARNING] Failed to fetch image: {e}")
            raise HTTPException(status_code=400, detail=f"Failed to load image: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="imageUrl is required")
    
    # Prepare text elements for advanced system
    from linkedpilot.utils.ai_text_overlay_advanced import generate_ai_text_overlay, OverlayRole
    
    text_elements = []
    
    # Extract main content as headline
    if campaign_content:
        # Take first sentence or first 100 chars as headline
        headline = campaign_content.split('.')[0].strip()
        if len(headline) > 100:
            headline = headline[:100] + '...'
        text_elements.append({
            'text': headline,
            'role': OverlayRole.HEADLINE.value
        })
    
    # Add hashtags as separate elements
    for hashtag in hashtags[:3]:  # Limit to 3 hashtags
        text_elements.append({
            'text': f"#{hashtag}" if not hashtag.startswith('#') else hashtag,
            'role': OverlayRole.HASHTAG.value
        })
    
    if not text_elements:
        text_elements.append({
            'text': campaign_content[:50] if campaign_content else 'Your Text Here',
            'role': OverlayRole.HEADLINE.value
        })
    
    # Get preferred template from request if provided
    preferred_template = request_data.get('preferred_template')
    preferred_composition = None
    if preferred_template and preferred_template != 'auto':
        # Map frontend template names to CompositionType
        template_map = {
            'hero_left': 'hero_left',
            'hero_right': 'hero_right',
            'hero_top': 'hero_top',
            'hero_bottom': 'hero_bottom',
            'center_stack': 'center_stack'
        }
        if preferred_template in template_map:
            preferred_composition = template_map[preferred_template]
            print(f"[ADVANCED SYSTEM] Using preferred template: {preferred_template}")
    
    try:
        # Use advanced AI system
        print(f"[ADVANCED SYSTEM] Generating with {len(text_elements)} text elements")
        candidates = await generate_ai_text_overlay(
            image_base64=image_base64,
            text_elements=text_elements,
            top_n=1,  # Return best candidate
            use_template=True,
            use_cache=True,
            preferred_composition=preferred_composition  # Pass preferred template
        )
        
        if not candidates:
            raise Exception("No candidates generated")
        
        # Convert to frontend format (percentages)
        # The advanced system returns a list of candidate dictionaries
        result = []
        img_data = base64.b64decode(image_base64)
        img = Image.open(io.BytesIO(img_data))
        img_width, img_height = img.size
        
        # Validate image dimensions to prevent ZeroDivisionError
        if img_width == 0 or img_height == 0:
            raise ValueError(f"Invalid image dimensions: {img_width}x{img_height}. Image may be corrupted or invalid.")
        
        for candidate in candidates:
            box = candidate.get('box', {})
            x = box.get('x', 0)
            y = box.get('y', 0)
            
            # Convert to percentages if needed
            if not box.get('use_percentage', False):
                x = (x / img_width) * 100
                y = (y / img_height) * 100
            
            typography = candidate.get('typography', {})
            effects = candidate.get('effects', {})
            
            result.append({
                'text': candidate.get('text', ''),
                'position': [round(x, 2), round(y, 2)],
                'font_size': typography.get('font_size', 48),
                'font_name': typography.get('font_name', 'Poppins'),
                'font_weight': typography.get('font_weight', 400),
                'font_style': typography.get('font_style', 'normal'),
                'text_decoration': 'none',
                'text_align': candidate.get('text_align', 'center'),
                'color': candidate.get('color', '#FFFFFF'),
                'stroke_width': effects.get('stroke_width', 0),
                'stroke_color': effects.get('stroke_color', '#000000'),
                'width': box.get('width', 300),
                'height': box.get('height', 100),
                'rotation': candidate.get('rotation', 0),
                'line_height': typography.get('line_height', 1.2),
                'letter_spacing': typography.get('letter_spacing', 0),
                'opacity': effects.get('opacity', 100),
                'shadow_enabled': effects.get('shadow_enabled', False),
                'shadow_color': effects.get('shadow_color', '#000000'),
                'shadow_blur': effects.get('shadow_blur', 10),
                'shadow_offset_x': 0,
                'shadow_offset_y': 0,
                'background_color': candidate.get('panel_color', 'transparent'),
                'background_opacity': candidate.get('panel_opacity', 100)
            })
        
        print(f"[SUCCESS] Advanced system generated {len(result)} overlay elements")
        print(f"{'='*60}\n")
        
        # Return with metadata for frontend display
        return {
            "overlay_elements": result,
            "template_id": candidates[0].get('template_id') if candidates else None,
            "quality_score": "High",  # Could calculate from actual scores
            "system": "advanced"  # Flag to show this used advanced system
        }
    except Exception as e:
        print(f"[ERROR] Advanced system failed: {e}")
        import traceback
        traceback.print_exc()
        # Fallback to legacy LLM-based system if advanced fails
        print(f"[FALLBACK] Using legacy LLM-based system")
        try:
            # Get API key for LLM fallback
            user_id = request_data.get('user_id') or request_data.get('created_by')
            org_id = request_data.get('org_id')
            
            if not user_id and org_id:
                # Try to get user_id from org
                org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
                if org:
                    user_id = org.get('created_by')
            
            api_key = None
            provider = None
            
            if user_id:
                settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})
                if settings:
                    from ..utils.api_key_helper import get_api_key_and_provider
                    from ..routes.settings import decrypt_value
                    api_key, provider = get_api_key_and_provider(settings, decrypt_value)
            
            # Try system key if no user key
            if not api_key:
                api_key, provider = await get_system_api_key("any")
            
            if not api_key:
                raise Exception("No API key available for fallback")
            
            # Use LLM to generate simple overlay suggestions
            from ..adapters.llm_adapter import LLMAdapter
            llm = LLMAdapter(api_key=api_key, provider=provider)
            
            # Create prompt for LLM-based overlay generation
            overlay_prompt = f"""Generate text overlay suggestions for a LinkedIn post image.

Content: {campaign_content[:500]}
Hashtags: {', '.join(hashtags[:5]) if hashtags else 'None'}
Image Description: {image_description[:200] if image_description else 'Professional business image'}

Generate 2-3 text overlay elements with:
1. A headline (main message, 5-8 words max)
2. Optional subheadline or call-to-action (if content allows)
3. Optional hashtag placement

For each element, suggest:
- Text content (short and impactful)
- Position (top, center, bottom, left, right)
- Font size (48-72 for headline, 24-36 for subtext)
- Color (white or contrasting color)
- Text alignment (center recommended)

Return JSON format:
{{
  "elements": [
    {{
      "text": "Headline text",
      "position_type": "top|center|bottom",
      "font_size": 64,
      "color": "#FFFFFF",
      "text_align": "center"
    }}
  ]
}}"""
            
            print(f"[FALLBACK] Calling LLM for overlay generation...")
            llm_response = await llm.generate_completion(overlay_prompt, temperature=0.7)
            
            # Parse LLM response
            import json
            response_text = llm_response.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            
            llm_data = json.loads(response_text.strip())
            
            # Convert to frontend format
            img_data = base64.b64decode(image_base64)
            img = Image.open(io.BytesIO(img_data))
            img_width, img_height = img.size
            
            # Validate image dimensions (even though we use hardcoded percentages, validate for safety)
            if img_width == 0 or img_height == 0:
                raise ValueError(f"Invalid image dimensions: {img_width}x{img_height}. Image may be corrupted or invalid.")
            
            result = []
            for idx, elem in enumerate(llm_data.get('elements', [])):
                text = elem.get('text', '')
                position_type = elem.get('position_type', 'center').lower()
                
                # Map position types to coordinates
                position_map = {
                    'top': [50, 20],
                    'center': [50, 50],
                    'bottom': [50, 80],
                    'left': [20, 50],
                    'right': [80, 50]
                }
                position = position_map.get(position_type, [50, 50])
                
                result.append({
                    'text': text,
                    'position': position,
                    'font_size': elem.get('font_size', 64 if idx == 0 else 36),
                    'font_name': 'Poppins',
                    'font_weight': 700 if idx == 0 else 400,
                    'font_style': 'normal',
                    'text_decoration': 'none',
                    'text_align': elem.get('text_align', 'center'),
                    'color': elem.get('color', '#FFFFFF'),
                    'stroke_width': 0,
                    'stroke_color': '#000000',
                    'width': 600,
                    'height': 100,
                    'rotation': 0,
                    'line_height': 1.2,
                    'letter_spacing': 0,
                    'opacity': 100,
                    'shadow_enabled': True,
                    'shadow_color': '#000000',
                    'shadow_blur': 20,
                    'shadow_offset_x': 0,
                    'shadow_offset_y': 4,
                    'background_color': 'transparent',
                    'background_opacity': 100
                })
            
            if not result:
                # Ultimate fallback: create basic elements from content
                if campaign_content:
                    headline = campaign_content.split('.')[0].strip()[:80]
                    result.append({
                        'text': headline,
                        'position': [50, 30],
                        'font_size': 64,
                        'font_name': 'Poppins',
                        'font_weight': 700,
                        'font_style': 'normal',
                        'text_decoration': 'none',
                        'text_align': 'center',
                        'color': '#FFFFFF',
                        'stroke_width': 0,
                        'stroke_color': '#000000',
                        'width': 600,
                        'height': 100,
                        'rotation': 0,
                        'line_height': 1.2,
                        'letter_spacing': 0,
                        'opacity': 100,
                        'shadow_enabled': True,
                        'shadow_color': '#000000',
                        'shadow_blur': 20,
                        'shadow_offset_x': 0,
                        'shadow_offset_y': 4,
                        'background_color': 'transparent',
                        'background_opacity': 100
                    })
            
            print(f"[SUCCESS] Legacy LLM fallback generated {len(result)} overlay elements")
            print(f"{'='*60}\n")
            
            return {
                "overlay_elements": result,
                "template_id": "legacy-fallback",
                "quality_score": "Medium",
                "system": "legacy-llm"
            }
            
        except Exception as fallback_error:
            print(f"[ERROR] Legacy fallback also failed: {fallback_error}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Failed to generate overlay: Advanced system failed ({str(e)}), and legacy fallback also failed ({str(fallback_error)})")

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

@router.put("/{draft_id}", response_model=Draft)
async def update_draft(draft_id: str, draft: Draft):
    """Update an existing draft"""
    db = get_db()
    
    # Get existing draft
    existing_draft = await db.drafts.find_one({"id": draft_id}, {"_id": 0})
    if not existing_draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    # Build update dict
    update_data = draft.model_dump()
    update_data['updated_at'] = datetime.utcnow().isoformat()
    
    # Preserve created_at from existing draft
    if 'created_at' in existing_draft:
        update_data['created_at'] = existing_draft['created_at']
    
    # Update draft in database
    result = await db.drafts.update_one(
        {"id": draft_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Failed to update draft or no changes made")
    
    # Return updated draft
    updated_draft = await db.drafts.find_one({"id": draft_id}, {"_id": 0})
    if isinstance(updated_draft.get('created_at'), str):
        updated_draft['created_at'] = datetime.fromisoformat(updated_draft['created_at'])
    if isinstance(updated_draft.get('updated_at'), str):
        updated_draft['updated_at'] = datetime.fromisoformat(updated_draft['updated_at'])
    
    return Draft(**updated_draft)

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
        model="gemini-3-pro-image-preview"
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

@router.post("/chat")
async def chat_draft(request: DraftChatRequest):
    """
    Chat with the AI to gather requirements and generate a draft.
    Optionally generates an image if generate_with_image is True.
    """
    print(f"\n{'='*60}")
    print(f"[CHAT] /api/drafts/chat called")
    print(f"   User ID: {request.user_id}")
    print(f"   Org ID: {request.org_id}")
    print(f"   Messages: {len(request.messages)}")
    print(f"   Generate with image: {request.generate_with_image}")
    
    # Chat endpoint ALWAYS uses OpenAI for text generation
    # Images use Google AI Studio (handled separately below)
    provider = "openai"
    model = "gpt-4o"
    
    # Get OpenAI API key
    # ALWAYS use system API keys from admin dashboard - users never enter API keys
    system_api_key, _ = await get_system_api_key("openai")
    
    if not system_api_key:
        print(f"   [ERROR] No OpenAI API key found")
        raise HTTPException(status_code=500, detail="No OpenAI API key configured")
        
    print(f"   [INFO] Using OpenAI ({model}) for chat text generation")
        
    try:
        llm = LLMAdapter(
            api_key=system_api_key,
            provider=provider,
            model=model
        )
        
        response = await llm.chat_with_context(
            messages=request.messages,
            user_context={"org_id": request.org_id, "user_id": request.user_id}
        )
        
        print(f"   [SUCCESS] Chat response: {response.get('type')}")
        
        # Generate image by default (default is True in model)
        if response.get('type') == 'draft' and request.generate_with_image:
            print(f"   [IMAGE] Generating image for draft...")
            try:
                # Get the generated post content
                post_content = response.get('content', '')
                
                # Fetch brand DNA and campaign context
                brand_colors = None
                brand_fonts = None
                campaign_context = None
                
                if request.org_id:
                    try:
                        db = get_db()
                        # Fetch brand analysis
                        brand_analysis = await db.brand_analysis.find_one({"org_id": request.org_id})
                        if brand_analysis:
                            brand_colors = brand_analysis.get('colors', [])
                            brand_fonts = brand_analysis.get('fonts', [])
                        
                        # Fetch campaign context if available (from latest campaign or user input)
                        # For now, use the post content as campaign context
                        campaign_context = post_content[:500]  # First 500 chars of post
                    except Exception as brand_error:
                        print(f"   [WARNING] Failed to fetch brand DNA: {brand_error}")
                
                # Get OpenAI key for prompt optimization
                # ALWAYS use system API keys from admin dashboard - users never enter API keys
                system_openai_key, _ = await get_system_api_key("openai")
                
                # Optimize image prompt with brand DNA
                enhanced_prompt = post_content[:200]  # Default to post content
                if system_openai_key:
                    try:
                        from linkedpilot.utils.ai_image_prompt_optimizer import generate_optimized_image_prompt
                        ai_analysis = await generate_optimized_image_prompt(
                            post_content=post_content,
                            ai_api_key=system_openai_key,
                            ai_model="gpt-4o",
                            brand_colors=brand_colors,
                            brand_fonts=brand_fonts,
                            campaign_context=campaign_context
                        )
                        enhanced_prompt = ai_analysis['optimized_prompt']
                        print(f"   [IMAGE] Optimized prompt with brand DNA")
                    except Exception as opt_error:
                        print(f"   [WARNING] Prompt optimization failed: {opt_error}")
                
                # Generate image using Gemini 3 Pro Image Preview
                # ALWAYS use system API keys from admin dashboard - users never enter API keys
                print(f"   [IMAGE] Step 1: Retrieving Google AI Studio API key...")
                google_api_key, provider = await get_system_api_key("google_ai_studio")
                
                if google_api_key:
                    print(f"   [IMAGE] Step 2: API key found (length: {len(google_api_key)}, starts with: {google_api_key[:10]}...)")
                    print(f"   [IMAGE] Step 3: Initializing ImageAdapter with Gemini 3 Pro Image Preview...")
                    
                    try:
                        image_adapter = ImageAdapter(
                            api_key=google_api_key,
                            provider="google_ai_studio",
                            model="gemini-3-pro-image-preview"  # Use Gemini 3 Pro Image Preview
                        )
                        
                        print(f"   [IMAGE] Step 4: Generating image with prompt: {enhanced_prompt[:100]}...")
                        image_result = await image_adapter.generate_image(
                            prompt=enhanced_prompt,
                            style="professional",
                            size="1024x1024"  # 1K resolution for Gemini 3 Pro
                        )
                        
                        if image_result and image_result.get('url'):
                            # Add image URL to response
                            response['image_url'] = image_result.get('url')
                            response['image_prompt'] = enhanced_prompt
                            print(f"   [SUCCESS] Image generated successfully! URL: {image_result.get('url')[:50]}...")
                            
                            # Extract text from generated image and create editable overlays
                            try:
                                print(f"   [TEXT EXTRACTION] Extracting text from generated image...")
                                from ..utils.gemini_overlay_agent import GeminiOverlayAgent
                                
                                # Get image base64 from URL (if it's a data URL)
                                image_url = image_result.get('url')
                                image_base64 = None
                                if image_url.startswith('data:image'):
                                    # Extract base64 from data URL
                                    image_base64 = image_url.split(',')[1] if ',' in image_url else None
                                elif image_result.get('image_base64'):
                                    image_base64 = image_result.get('image_base64')
                                
                                if image_base64:
                                    # Initialize variables
                                    tesseract_elements = None
                                    extracted_elements = None
                                    
                                    # Get image dimensions first for percentage calculations
                                    try:
                                        image_bytes = base64.b64decode(image_base64)
                                        img_for_dimensions = Image.open(io.BytesIO(image_bytes))
                                        img_width, img_height = img_for_dimensions.size
                                        print(f"   [TEXT EXTRACTION] Image dimensions: {img_width}x{img_height} pixels")
                                    except Exception as dim_error:
                                        print(f"   [WARNING] Could not get image dimensions: {dim_error}")
                                        img_width, img_height = 1200, 627
                                    
                                    # Use Tesseract OCR for precise text coordinate extraction
                                    try:
                                        from ..utils.tesseract_extractor import extract_text_with_tesseract
                                        
                                        print(f"   [TEXT EXTRACTION] Using Tesseract OCR for precise text coordinates...")
                                        
                                        # Extract text with Tesseract
                                        tesseract_results = extract_text_with_tesseract(image_base64)
                                        
                                        # Store Tesseract results for coordinate merging, but always use Gemini Vision for font detection
                                        if tesseract_results and len(tesseract_results) > 0:
                                            print(f"   [TESSERACT] Found {len(tesseract_results)} text elements with coordinates")
                                            for i, elem in enumerate(tesseract_results):
                                                print(f"   [TESSERACT] Element {i+1}: '{elem.get('text', '')[:50]}' at ({elem.get('bbox', {}).get('x', 0)}, {elem.get('bbox', {}).get('y', 0)})")
                                            tesseract_elements = tesseract_results
                                            print(f"   [TEXT EXTRACTION] Will use Gemini Vision for font/styling detection and merge with Tesseract coordinates...")
                                        else:
                                            print(f"   [TESSERACT] No text found (or empty result), using Gemini Vision only...")
                                    except Exception as tesseract_error:
                                        print(f"   [WARNING] Tesseract extraction failed: {tesseract_error}")
                                        import traceback
                                        traceback.print_exc()
                                        tesseract_elements = None
                                    
                                    # Always use Gemini Vision for font/styling detection (even if Tesseract found text)
                                    # Gemini Vision provides better font detection than Tesseract
                                    # Use Gemini Vision to extract text from image
                                    vision_llm = LLMAdapter(
                                        api_key=google_api_key,
                                        provider="google_ai_studio",
                                        model="gemini-2.5-flash"
                                    )
                                    
                                    # Get image dimensions for accurate bounding box calculation
                                    try:
                                        # Decode base64 to get image bytes
                                        image_bytes = base64.b64decode(image_base64)
                                        img_for_dimensions = Image.open(io.BytesIO(image_bytes))
                                        img_width, img_height = img_for_dimensions.size
                                        print(f"   [TEXT EXTRACTION] Image dimensions: {img_width}x{img_height} pixels")
                                    except Exception as dim_error:
                                        print(f"   [WARNING] Could not get image dimensions: {dim_error}")
                                        # Fallback to standard LinkedIn post dimensions
                                        img_width, img_height = 1200, 627
                                    
                                    # Always use Gemini Vision for font detection
                                    extraction_prompt = f"""Analyze this LinkedIn post image and extract ALL visible text elements with PIXEL-PERFECT bounding boxes.

IMAGE DIMENSIONS: {img_width}x{img_height} pixels

CRITICAL REQUIREMENTS FOR PRECISE TEXT EXTRACTION:
1. Use a GRID-BASED coordinate system aligned to the image dimensions
2. Measure positions relative to the EXACT image boundaries (0,0) to ({img_width},{img_height})
3. Consider the image's visual composition:
   - Identify busy/active regions (faces, complex backgrounds) - text may be positioned to avoid these
   - Identify empty/clear spaces - text may be positioned in these areas
   - Note visual hierarchy and focal points
4. Extract EVERY piece of baked-in text with PIXEL-PERFECT accuracy

POSITIONING METHODOLOGY:
- Use a grid system: Divide image into a {img_width//10}x{img_height//10} grid for reference
- Measure bounding boxes in PIXELS first, then convert to percentages
- The bounding box MUST exactly match the text boundaries (no gaps, minimal padding)
- For multi-line text, include the entire block in ONE bounding box

For each text element, provide:
1. The exact text content (preserve line breaks with \\n)
2. PRECISE bounding box in PIXELS (measure from image edges):
   - bbox.x: Left edge X coordinate (0 to {img_width}) - measure from left edge
   - bbox.y: Top edge Y coordinate (0 to {img_height}) - measure from top edge  
   - bbox.width: Width in pixels - measure from left edge of first character to right edge of last character
   - bbox.height: Height in pixels - measure from top of tallest character to bottom including descenders and line spacing
3. Bounding box in PERCENTAGES (calculate precisely):
   - x_percent = (bbox.x / {img_width}) * 100
   - y_percent = (bbox.y / {img_height}) * 100
   - width_percent = (bbox.width / {img_width}) * 100
   - height_percent = (bbox.height / {img_height}) * 100
4. EXACT font size in pixels (measure the actual rendered text height - this is critical!)
   - Measure from baseline to cap height (top of capital letters)
   - For multi-line text, divide bbox height by number of lines and line_height
   - Example: If bbox height is 80px, 2 lines, line_height 1.2 → font_size ≈ 80 / (2 * 1.2) ≈ 33px
5. Font family/name (identify the EXACT font style - this is critical for premium fonts):
   - Premium fonts commonly used: Montserrat, Playfair Display, Raleway, Lato, Oswald, Bebas Neue, Barlow, Inter, Space Grotesk, DM Sans, Plus Jakarta Sans, Manrope, Outfit, Work Sans, Nunito, Rubik, Source Sans Pro, Merriweather, Libre Baskerville, Cormorant Garamond
   - Common fonts: Arial, Helvetica, Times, Georgia, Roboto, Poppins, Open Sans
   - Look for distinctive characteristics: serif vs sans-serif, weight, letter spacing, geometric vs humanist
   - If the font looks premium/modern, identify it specifically (don't default to Poppins)
   - Return the EXACT font name as it appears in Google Fonts (e.g., "Montserrat", "Playfair Display", "Raleway")
   - Only default to "Poppins" if you truly cannot identify the font
6. Text alignment (left, center, right) - observe how text aligns within its bounding box
7. EXACT color in hex format (sample the actual text color)
8. Font weight (400=normal, 700=bold) - estimate from appearance
9. Line height (1.0-2.0) - measure spacing between lines if multi-line
10. Letter spacing in pixels (usually 0, but measure if text appears spaced)
11. Background color if text has a visible background (hex or "transparent")
12. Shadow properties if visible:
    - shadow_blur: Blur radius in pixels
    - shadow_offset_x: Horizontal offset in pixels
    - shadow_offset_y: Vertical offset in pixels
    - shadow_color: Shadow color in hex
13. Confidence score (0.0 to 1.0) - use 0.8+ for clear text

CRITICAL ACCURACY REQUIREMENTS:
- Measure bounding boxes using pixel coordinates relative to image origin (0,0) at top-left
- The bounding box should tightly fit the text (minimal padding, no gaps)
- For multi-line text, the bounding box should encompass ALL lines
- Position (x_percent, y_percent) is the TOP-LEFT corner of the bounding box
- Width and height must be accurate to within 2-3 pixels

VISUAL COMPOSITION ANALYSIS:
- Note if text is positioned to avoid busy regions (faces, complex patterns)
- Note if text is positioned in empty/clear spaces
- Note the visual relationship between text and main image elements

Return as JSON array:
[
  {{
    "text": "exact text content\\nwith line breaks",
    "bbox": {{
      "x": 120,
      "y": 45,
      "width": 580,
      "height": 95
    }},
    "bbox_percent": {{
      "x_percent": 10.0,
      "y_percent": 7.18,
      "width_percent": 48.33,
      "height_percent": 15.15
    }},
    "font_size": 64,
    "font_weight": 700,
    "text_align": "left",
    "color": "#FFFFFF",
    "line_height": 1.2,
    "letter_spacing": 0,
    "shadow_enabled": true,
    "shadow_blur": 8,
    "shadow_offset_x": 0,
    "shadow_offset_y": 3,
    "shadow_color": "#000000",
    "background_color": "transparent",
    "confidence": 0.95,
    "is_baked_in": true
  }}
]"""
                                    
                                    vision_response = await vision_llm.generate_completion_with_image(
                                        prompt=extraction_prompt,
                                        image_base64=image_base64,
                                        temperature=0.1
                                    )
                                    
                                    # Parse extracted text elements
                                    import json
                                    import re
                                    
                                    # Extract JSON from response
                                    json_match = re.search(r'\[.*\]', vision_response, re.DOTALL)
                                    if json_match:
                                        extracted_elements = json.loads(json_match.group())
                                    else:
                                        extracted_elements = []
                                    
                                    print(f"   [TEXT EXTRACTION] Gemini Vision extraction complete: {len(extracted_elements) if extracted_elements else 0} elements")
                                    
                                    # Process extracted elements (from Gemini Vision, optionally enhanced with Tesseract coordinates)
                                    if extracted_elements:
                                        
                                        # If we have Tesseract elements, merge coordinates with Gemini Vision font detection
                                        if tesseract_elements and len(tesseract_elements) > 0 and extracted_elements:
                                            print(f"   [TEXT EXTRACTION] Merging Tesseract coordinates with Gemini Vision font detection...")
                                            # Create a map of text to Tesseract elements for coordinate matching
                                            tesseract_map = {}
                                            for t_elem in tesseract_elements:
                                                text_key = t_elem.get('text', '').strip().lower()
                                                tesseract_map[text_key] = t_elem
                                            
                                            # Enhance Gemini Vision elements with Tesseract coordinates if text matches
                                            for gemini_elem in extracted_elements:
                                                gemini_text = gemini_elem.get('text', '').strip().lower()
                                                # Try exact match first
                                                if gemini_text in tesseract_map:
                                                    t_elem = tesseract_map[gemini_text]
                                                    # Use Tesseract's precise coordinates but keep Gemini's font/styling
                                                    gemini_elem['bbox'] = t_elem.get('bbox', gemini_elem.get('bbox', {}))
                                                    gemini_elem['bbox_percent'] = t_elem.get('bbox_percent', gemini_elem.get('bbox_percent', {}))
                                                    print(f"   [MERGE] Enhanced '{gemini_elem.get('text', '')[:30]}' with Tesseract coordinates, font: {gemini_elem.get('font_name', 'unknown')}")
                                                else:
                                                    # Try partial match (in case of minor text differences)
                                                    for t_key, t_elem in tesseract_map.items():
                                                        if t_key in gemini_text or gemini_text in t_key:
                                                            gemini_elem['bbox'] = t_elem.get('bbox', gemini_elem.get('bbox', {}))
                                                            gemini_elem['bbox_percent'] = t_elem.get('bbox_percent', gemini_elem.get('bbox_percent', {}))
                                                            print(f"   [MERGE] Enhanced '{gemini_elem.get('text', '')[:30]}' with Tesseract coordinates (partial match), font: {gemini_elem.get('font_name', 'unknown')}")
                                                            break
                                        
                                        # Convert to editable overlay format with bounding boxes
                                        editable_overlays = []
                                        for elem in extracted_elements:
                                            # Prefer bounding box percentages if available, fallback to center position
                                            bbox_percent = elem.get('bbox_percent', {})
                                            bbox_pixels = elem.get('bbox', {})
                                            
                                            # Calculate position from bounding box (use top-left corner)
                                            if bbox_percent:
                                                x_percent = bbox_percent.get('x_percent', elem.get('x_percent', 15))
                                                y_percent = bbox_percent.get('y_percent', elem.get('y_percent', 25))
                                                width_percent = bbox_percent.get('width_percent', 0)
                                                height_percent = bbox_percent.get('height_percent', 0)
                                            elif bbox_pixels:
                                                # Convert pixel bbox to percentages
                                                x_percent = (bbox_pixels.get('x', 0) / img_width) * 100 if img_width > 0 else 15
                                                y_percent = (bbox_pixels.get('y', 0) / img_height) * 100 if img_height > 0 else 25
                                                width_percent = (bbox_pixels.get('width', 600) / img_width) * 100 if img_width > 0 else 50
                                                height_percent = (bbox_pixels.get('height', 100) / img_height) * 100 if img_height > 0 else 10
                                            else:
                                                # Fallback to center position (old format)
                                                x_percent = elem.get('x_percent', 15)
                                                y_percent = elem.get('y_percent', 25)
                                                width_percent = 50  # Default width
                                                height_percent = 10  # Default height
                                            
                                            # Calculate width and height in pixels from percentages
                                            width_pixels = int((width_percent / 100) * img_width) if width_percent > 0 else 600
                                            height_pixels = int((height_percent / 100) * img_height) if height_percent > 0 else 100
                                            
                                            # Calculate font size from bounding box height if not provided or seems wrong
                                            # Font size is approximately: bbox_height / (line_height * line_count)
                                            extracted_font_size = elem.get('font_size')
                                            text_content = elem.get('text', '')
                                            line_count = text_content.count('\n') + 1 if text_content else 1
                                            line_height = elem.get('line_height', 1.2)
                                            
                                            # If font size not provided or seems unreasonable, calculate from bbox height
                                            if not extracted_font_size or extracted_font_size < 10 or extracted_font_size > 500:
                                                # Calculate font size from bounding box height
                                                # For single line: font_size ≈ bbox_height / line_height
                                                # For multi-line: font_size ≈ bbox_height / (line_height * line_count)
                                                calculated_font_size = height_pixels / (line_height * line_count)
                                                font_size = max(12, min(200, int(calculated_font_size)))  # Clamp to reasonable range
                                                print(f"   [FONT SIZE] Calculated from bbox: {font_size}px (bbox_height={height_pixels}px, lines={line_count}, line_height={line_height})")
                                            else:
                                                font_size = int(extracted_font_size)
                                                print(f"   [FONT SIZE] Using extracted: {font_size}px")
                                            
                                            # Filter very low-confidence detections (lower threshold to include more text)
                                            confidence = elem.get('confidence', 1.0)
                                            if confidence < 0.3:
                                                print(f"   [SKIP] Very low confidence text detection ({confidence:.2f}): {elem.get('text', '')[:30]}")
                                                continue
                                            
                                            # Log all detected text for debugging
                                            text_preview = text_content[:50]
                                            font_name = elem.get('font_name', 'Poppins')
                                            print(f"   [DETECTED] Text: '{text_preview}' | Font: {font_name} {font_size}px | Confidence: {confidence:.2f} | Size: {width_percent:.1f}% x {height_percent:.1f}%")
                                            
                                            # Use extracted styling or defaults - prioritize matching baked-in text exactly
                                            editable_overlays.append({
                                                "text": text_content,
                                                "position": [x_percent, y_percent],  # Top-left corner as percentage - EXACT position
                                                "bbox": {
                                                    "x": bbox_pixels.get('x', int((x_percent / 100) * img_width)),
                                                    "y": bbox_pixels.get('y', int((y_percent / 100) * img_height)),
                                                    "width": width_pixels,
                                                    "height": height_pixels
                                                },
                                                "bbox_percent": {
                                                    "x_percent": x_percent,
                                                    "y_percent": y_percent,
                                                    "width_percent": width_percent,
                                                    "height_percent": height_percent
                                                },
                                                "font_size": font_size,  # Use calculated or extracted font size
                                                "font_name": elem.get('font_name', 'Poppins'),  # Use extracted font or default
                                                "font_weight": elem.get('font_weight', 700),  # Use extracted weight
                                                "font_style": "normal",
                                                "text_decoration": "none",
                                                "text_align": elem.get('text_align', 'left'),  # Use extracted alignment
                                                "color": elem.get('color', '#FFFFFF'),  # Use extracted color
                                                "stroke_width": 0,
                                                "stroke_color": "#000000",
                                                "width": width_pixels,  # Use calculated width - must cover baked-in text
                                                "height": height_pixels,  # Use calculated height - must cover baked-in text
                                                "rotation": 0,
                                                "line_height": elem.get('line_height', 1.2),  # Use extracted line height
                                                "letter_spacing": elem.get('letter_spacing', 0),  # Use extracted spacing
                                                "opacity": 100,
                                                "shadow_enabled": elem.get('shadow_enabled', True),  # Use extracted shadow settings
                                                "shadow_color": elem.get('shadow_color', '#000000'),
                                                "shadow_blur": elem.get('shadow_blur', 10),
                                                "shadow_offset_x": elem.get('shadow_offset_x', 0),
                                                "shadow_offset_y": elem.get('shadow_offset_y', 2),
                                                "background_color": elem.get('background_color', 'transparent'),  # May need background to cover baked-in text
                                                "background_opacity": 100,
                                                "confidence": confidence,
                                                "is_baked_in": elem.get('is_baked_in', True),  # Mark as baked-in text
                                                "replace_baked_text": True  # Flag to indicate this should replace baked-in text visually
                                            })
                                    
                                    if editable_overlays:
                                        response['text_overlays'] = editable_overlays
                                        print(f"   [SUCCESS] Extracted {len(editable_overlays)} editable text elements from image!")
                                    else:
                                        print(f"   [WARNING] No text elements extracted from image")
                                        
                                else:
                                    print(f"   [WARNING] Could not extract base64 from image URL for text extraction")
                                    
                            except Exception as extract_error:
                                print(f"   [WARNING] Text extraction failed: {extract_error}")
                                import traceback
                                traceback.print_exc()
                                # Don't fail the whole request if text extraction fails
                                
                        else:
                            print(f"   [ERROR] Image generation returned no URL. Result: {image_result}")
                            response['image_error'] = "Image generation returned no URL"
                    except Exception as adapter_error:
                        print(f"   [ERROR] ImageAdapter error: {adapter_error}")
                        import traceback
                        traceback.print_exc()
                        response['image_error'] = f"ImageAdapter error: {str(adapter_error)}"
                else:
                    print(f"   [ERROR] No Google AI Studio API key found!")
                    print(f"   [ERROR] Please configure Google AI API key in Admin Dashboard > API Keys")
                    response['image_error'] = "Google AI Studio API key not configured in admin dashboard"
                    
            except Exception as img_error:
                print(f"   [ERROR] Image generation failed: {img_error}")
                import traceback
                traceback.print_exc()
                # Don't fail the whole request if image generation fails
                response['image_error'] = str(img_error)
        
        return response
        
    except Exception as e:
        print(f"   [ERROR] Chat failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

    
 