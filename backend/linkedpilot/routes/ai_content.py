from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime
import os
import random

from ..adapters.ai_content_generator import AIContentGenerator
from ..adapters.llm_adapter import LLMAdapter
from ..models.campaign import AIGeneratedPost, AIGeneratedPostStatus
from pydantic import BaseModel

router = APIRouter(prefix="/ai-content", tags=["ai-content"])

def get_db():
    from motor.motor_asyncio import AsyncIOMotorClient
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    return client[os.environ['DB_NAME']]

class ContentGenerationRequest(BaseModel):
    campaign_id: str
    org_id: str
    user_id: str  # User ID to lookup API keys from settings
    user_api_key: Optional[str] = None
    provider: Optional[str] = None  # Will be determined from campaign's text_model if not provided
    model: Optional[str] = None

class ContentValidationRequest(BaseModel):
    content: str

@router.post("/generate")
async def generate_content(request: ContentGenerationRequest):
    """Generate AI content for a campaign - uses LLMAdapter like drafts/generate"""
    db = get_db()
    
    # Get campaign
    campaign = await db.campaigns.find_one({"id": request.campaign_id}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Extract topic from campaign (select a random content pillar)
    content_pillars = campaign.get('content_pillars', [])
    if content_pillars:
        topic = random.choice(content_pillars)
    else:
        topic = campaign.get('name', 'LinkedIn Content')
    
    # Get tone from campaign
    tone = campaign.get('tone_voice', 'professional')
    
    print(f"\n{'='*60}")
    print(f"🤖 AI Content Generation Request (Campaign-based)")
    print(f"   Campaign: {campaign.get('name')}")
    print(f"   Topic (from campaign): {topic}")
    print(f"   Tone: {tone}")
    print(f"{'='*60}\n")
    
    # Import helper functions from drafts
    from ..routes.drafts import get_default_model_setting, parse_model_setting, get_system_api_key, get_user_api_key
    
    # Get default model setting from admin configuration
    default_model_setting = await get_default_model_setting('text_draft_content')
    default_provider, default_model = parse_model_setting(default_model_setting)
    
    print(f"[AI-CONTENT] Using default model: {default_provider}:{default_model}")
    
    # Multi-provider fallback: Use configured default first, then fallback providers
    providers_to_try = []
    
    # Priority 1: Use configured default model
    default_key, _ = await get_system_api_key(default_provider)
    if not default_key:
        default_key, _ = await get_user_api_key(request.user_id, default_provider)
    if default_key:
        providers_to_try.append((default_provider, default_model))
        print(f"   [SUCCESS] Added default model: {default_provider}:{default_model}")
    
    # Priority 2-4: Add other providers if keys are present (for fallback)
    # Google AI Studio
    if default_provider != "google_ai_studio":
        google_key, _ = await get_system_api_key("google_ai_studio")
        if not google_key:
            google_key, _ = await get_user_api_key(request.user_id, "google_ai_studio")
        if google_key:
            providers_to_try.append(("google_ai_studio", "gemini-2.5-flash"))
    
    # OpenAI
    if default_provider != "openai":
        openai_key, _ = await get_system_api_key("openai")
        if not openai_key:
            openai_key, _ = await get_user_api_key(request.user_id, "openai")
        if openai_key:
            providers_to_try.append(("openai", "gpt-4o"))
    
    # Anthropic
    if default_provider != "anthropic":
        anthropic_key, _ = await get_system_api_key("anthropic")
        if not anthropic_key:
            anthropic_key, _ = await get_user_api_key(request.user_id, "anthropic")
        if anthropic_key:
            providers_to_try.append(("anthropic", "claude-3-5-sonnet"))
    
    # OpenRouter
    if default_provider != "openrouter":
        openrouter_key, _ = await get_system_api_key("openrouter")
        if not openrouter_key:
            openrouter_key, _ = await get_user_api_key(request.user_id, "openrouter")
        if openrouter_key:
            providers_to_try.append(("openrouter", "anthropic/claude-3.5-sonnet"))
    
    content_data = None
    last_error = None
    provider_used = None
    model_used = None
    
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
            
            # Build context (same as drafts/generate)
            context = {
                'topic': topic,
                'tone': tone,
                'goal': 'engagement'
            }
            
            # Generate content (same as drafts/generate)
            content_data = await llm.generate_post_content(context, 'text')
            
            provider_used = provider_name
            model_used = model_name
            
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
            detail=f"Content generation failed: {str(last_error)}"
        )
    
    # Extract content from the response
    post_content = content_data.get('body', '') if isinstance(content_data, dict) else str(content_data)
    hashtags = content_data.get('hashtags', []) if isinstance(content_data, dict) else []
    
    # Ensure post_content is a string
    if not isinstance(post_content, str):
        post_content = str(post_content) if post_content else ""
    
    # Ensure hashtags is a list
    if not isinstance(hashtags, list):
        hashtags = []
    
    # Combine content and hashtags if needed
    if hashtags and len(hashtags) > 0:
        try:
            # Check if first item is a string
            if isinstance(hashtags[0], str):
                hashtag_str = ' '.join(str(h) for h in hashtags if h)
            elif isinstance(hashtags[0], dict):
                hashtag_str = ' '.join([str(h.get('#', '')) for h in hashtags if isinstance(h, dict) and h.get('#')])
            else:
                hashtag_str = ' '.join(str(h) for h in hashtags if h)
            
            if hashtag_str and hashtag_str not in post_content:
                post_content = f"{post_content}\n\n{hashtag_str}"
        except (IndexError, TypeError, AttributeError) as hashtag_error:
            print(f"   [WARNING] Error processing hashtags: {hashtag_error}, skipping hashtag merge")
        
        # Validate quality
    from ..adapters.ai_content_generator import AIContentGenerator
    generator = AIContentGenerator()  # Just for validation
    validation = await generator.validate_post_quality(post_content)
    
    result = {
        "content": post_content,
        "generation_prompt": content_data.get('generation_prompt', topic),
        "content_pillar": topic,
        "content_type": "text",
        "generated_at": datetime.utcnow().isoformat(),
        "provider": provider_used,
        "model": model_used
    }
    
    try:
        # Generate image if campaign requires it
        image_url = None
        if campaign.get('include_images', False):
            try:
                print(f"   [IMAGE] Generating image...")
                
                # Check if campaign wants AI images or stock photos (default: AI images to match scheduler)
                use_ai_images = campaign.get('use_ai_images', True)  # Default to AI images (matches scheduler)
                use_stock = not use_ai_images  # Use stock only if AI is explicitly disabled
                
                # Get campaign's preferred AI image model (only used if use_ai_images=True)
                image_model_raw = campaign.get('image_model', 'google/gemini-3-pro-image-preview')  # Updated to Gemini 3 Pro Image Preview
                print(f"   [IMAGE] Mode: {'AI Generation' if use_ai_images else 'Stock Photos (default)'}")
                if use_ai_images:
                    print(f"   [IMAGE MODEL] AI model: {image_model_raw}")
                
                if use_stock:
                    # Try to fetch stock image
                    try:
                        print(f"   [STOCK IMAGE] Trying stock photos...")
                        from ..utils.stock_image_fetcher import StockImageFetcher, extract_image_keywords_ai
                        from cryptography.fernet import Fernet
                        import base64
                        import hashlib
                        
                        # Get stock image API keys
                        settings = await db.user_settings.find_one({"user_id": request.user_id}, {"_id": 0})
                        
                        def decrypt_api_key(encrypted_value):
                            try:
                                ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', '')
                                if not ENCRYPTION_KEY:
                                    return None
                                cipher_suite = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
                                return cipher_suite.decrypt(encrypted_value.encode()).decode()
                            except:
                                return None
                        
                        unsplash_key = None
                        pexels_key = None
                        openai_key = None
                        
                        # First try system settings (admin-managed)
                        system_settings = await db.system_settings.find_one({"_id": "api_keys"})
                        
                        if system_settings:
                            if system_settings.get('unsplash_access_key'):
                                unsplash_key = decrypt_api_key(system_settings['unsplash_access_key'])
                            if system_settings.get('pexels_api_key'):
                                pexels_key = decrypt_api_key(system_settings['pexels_api_key'])
                            if system_settings.get('openai_api_key'):
                                openai_key = decrypt_api_key(system_settings['openai_api_key'])
                        
                        # Fallback to user settings if system keys not available
                        if not unsplash_key or not pexels_key:
                            if settings:
                                if settings.get('unsplash_access_key') and not unsplash_key:
                                    unsplash_key = decrypt_api_key(settings['unsplash_access_key'])
                                if settings.get('pexels_api_key') and not pexels_key:
                                    pexels_key = decrypt_api_key(settings['pexels_api_key'])
                                if settings.get('openai_api_key') and not openai_key:
                                    openai_key = decrypt_api_key(settings['openai_api_key'])
                        
                        # Use the actual post topic (from content pillars) for better image search
                        post_topic = topic
                        keywords = await extract_image_keywords_ai(post_content, post_topic, openai_key)
                        print(f"   [STOCK IMAGE] Post topic: {post_topic}")
                        print(f"   [STOCK IMAGE] Search keywords: {keywords}")
                        
                        fetcher = StockImageFetcher(unsplash_key=unsplash_key, pexels_key=pexels_key)
                        stock_result = await fetcher.fetch_image(keywords, orientation="landscape")
                        
                        if stock_result and stock_result.get('url'):
                            image_url = stock_result['url']
                            print(f"   [STOCK IMAGE] ✓ Found from {stock_result['source']}")
                            print(f"   [STOCK IMAGE] Photographer: {stock_result['photographer']}")
                        else:
                            print(f"   [STOCK IMAGE] No results, skipping image")
                    except Exception as stock_error:
                        print(f"   [STOCK IMAGE] Failed: {stock_error}, skipping image")
                
                # If user explicitly chose AI generation, use same logic as create page
                elif use_ai_images:
                    print(f"   [IMAGE] Mode: AI Generation (using same logic as create page)")
                    
                    # Use same logic as create page: get default from admin settings
                    from ..routes.drafts import get_default_model_setting, parse_model_setting
                    default_image_setting = await get_default_model_setting('image_draft_image')
                    default_img_provider, default_img_model = parse_model_setting(default_image_setting)
                    
                    # Use campaign's image_model if set, otherwise use admin default
                    image_model_to_use = image_model_raw if image_model_raw else default_img_model
                    
                    print(f"   [IMAGE] Admin default: {default_img_provider}/{default_img_model}")
                    print(f"   [IMAGE] Campaign setting: {image_model_raw}")
                    print(f"   [IMAGE] Using: {image_model_to_use}")
                    
                    # Prepare enhanced prompt for AI image generation (same as create page)
                    from ..utils.ai_image_prompt_optimizer import generate_optimized_image_prompt
                    from ..routes.drafts import get_system_api_key
                    
                    print(f"   [IMAGE] Step 1/3: Analyzing post content...")
                    print(f"   [IMAGE] Post preview: {post_content[:100]}...")
                    
                    # Get OpenAI API key for prompt optimization
                    system_openai_key, _ = await get_system_api_key("openai")
                    image_prompt = post_content  # Default fallback
                    
                    if system_openai_key:
                        try:
                            print(f"   [IMAGE] Step 2/3: AI creating custom visual metaphor...")
                            
                            ai_analysis = await generate_optimized_image_prompt(
                                post_content=post_content,
                                ai_api_key=system_openai_key,
                                ai_model="gpt-4o"
                            )
                            
                            image_prompt = ai_analysis['optimized_prompt']
                            print(f"   [IMAGE] Visual concept: {ai_analysis.get('visual_concept', 'N/A')}")
                            print(f"   [IMAGE] Metaphor: {ai_analysis.get('metaphor_description', 'N/A')[:80]}...")
                        except Exception as ai_error:
                            print(f"   [WARNING] AI optimization failed: {ai_error}, using simple prompt")
                            image_prompt = f"""PROFESSIONAL PHOTOGRAPH - PHOTOREALISTIC. Shot on DSLR, 35mm, f/1.8. 
Cinematic photo representing: {post_content[:150]}. Natural setting, dramatic lighting, shallow depth of field. 
National Geographic quality. ABSOLUTELY NO TEXT OR WORDS. Pure imagery only.""".replace('\n', ' ')
                    else:
                        print(f"   [IMAGE] No OpenAI key available, using simple prompt")
                        image_prompt = f"""PROFESSIONAL PHOTOGRAPH - PHOTOREALISTIC. Shot on DSLR, 35mm, f/1.8. 
Cinematic photo representing: {post_content[:150]}. Natural setting, dramatic lighting, shallow depth of field. 
National Geographic quality. ABSOLUTELY NO TEXT OR WORDS. Pure imagery only.""".replace('\n', ' ')
                    
                    print(f"   [IMAGE] Step 3/3: Generating image with optimized prompt...")
                    
                    # Try admin default first (same as create page)
                    try:
                        system_api_key, provider = await get_system_api_key(default_img_provider)
                        
                        if not system_api_key:
                            system_api_key, provider = await get_system_api_key("google_ai_studio")
                            if system_api_key:
                                default_img_provider = "google_ai_studio"
                                default_img_model = "gemini-2.5-flash-image"
                        
                        if system_api_key:
                            print(f"   [IMAGE] Creating ImageAdapter with:")
                            print(f"      Provider: {default_img_provider}")
                            print(f"      Model: {default_img_model}")
                            
                            from ..adapters.image_adapter import ImageAdapter
                            image_adapter = ImageAdapter(
                                api_key=system_api_key,
                                provider=default_img_provider,
                                model=default_img_model
                            )
                            
                            # Verify adapter was initialized correctly
                            print(f"   [IMAGE] ImageAdapter initialized:")
                            print(f"      Provider: {image_adapter.provider}")
                            print(f"      Model: {image_adapter.model}")
                            print(f"      Base URL: {image_adapter.base_url}")
                            
                            if image_adapter.provider == "openai":
                                raise Exception("ImageAdapter provider is 'openai' - DALL-E is deprecated!")
                            
                            image_result = await image_adapter.generate_image(
                                prompt=image_prompt,
                                style=campaign.get('image_style', 'professional')
                            )
                            
                            # Check for URL first (ImageAdapter usually provides this as data URL)
                            if image_result and image_result.get('url'):
                                image_url = image_result['url']
                                print(f"   [IMAGE] ✓ Generated successfully with {default_img_model}!")
                                print(f"   [IMAGE] Image URL length: {len(image_url)}")
                            # Fallback to base64 if URL doesn't exist or is empty
                            elif image_result and image_result.get('image_base64'):
                                # Handle base64 images by creating a data URL
                                image_url = f"data:image/png;base64,{image_result['image_base64']}"
                                print(f"   [IMAGE] ✓ Generated successfully with {default_img_model} (base64)!")
                                print(f"   [IMAGE] Base64 image length: {len(image_result['image_base64'])}")
                            else:
                                print(f"   [IMAGE] {default_img_model} failed, trying Google AI Studio fallback...")
                                # Fallback to Google AI Studio (same as create page)
                                system_api_key, _ = await get_system_api_key("google_ai_studio")
                                if system_api_key:
                                    image_adapter = ImageAdapter(
                                        api_key=system_api_key,
                                        provider="google_ai_studio",
                                        model="gemini-2.5-flash-image"
                                    )
                                    image_result = await image_adapter.generate_image(
                                        prompt=image_prompt,
                                        style=campaign.get('image_style', 'professional')
                                    )
                                    if image_result and image_result.get('url'):
                                        image_url = image_result['url']
                                    elif image_result and image_result.get('image_base64'):
                                        image_url = f"data:image/png;base64,{image_result['image_base64']}"
                        else:
                            print(f"   [IMAGE] No API key available, skipping AI image generation")
                    except Exception as ai_error:
                        print(f"   [IMAGE] AI generation failed: {ai_error}, no image generated")
                        import traceback
                        print(f"   [IMAGE] Error traceback: {traceback.format_exc()}")
                    
            except Exception as img_error:
                print(f"   [WARNING] Image generation failed: {img_error}")
        
        # Check if campaign has auto_post enabled
        auto_post = campaign.get('auto_post', False)
        next_slot_time = None  # Initialize for later use
        
        # Create AI-generated post record
        # Resolve author name for display
        from ..routes.campaigns import resolve_author_name
        profile_type = campaign.get('profile_type', 'personal')
        linkedin_author_id = campaign.get('linkedin_author_id')
        author_name = None
        if profile_type and linkedin_author_id:
            author_name = await resolve_author_name(request.org_id, profile_type, linkedin_author_id)
        
        # Debug: Log image URL status
        if image_url:
            try:
                # Ensure image_url is a string before slicing
                image_url_str = str(image_url) if image_url else ""
                if image_url_str and len(image_url_str) > 100:
                    print(f"   [IMAGE] Final image_url set: {image_url_str[:100]}...")
                else:
                    print(f"   [IMAGE] Final image_url set: {image_url_str}")
                print(f"   [IMAGE] Image URL length: {len(image_url_str) if image_url_str else 0}")
            except Exception as url_error:
                print(f"   [IMAGE] Error logging image URL: {url_error}")
                print(f"   [IMAGE] Image URL type: {type(image_url)}")
        else:
            print(f"   [IMAGE] No image_url set (will be None)")
        
        ai_post = AIGeneratedPost(
            campaign_id=request.campaign_id,
            org_id=request.org_id,
            content=result['content'],
            generation_prompt=result['generation_prompt'],
            content_pillar=result.get('content_pillar'),
            content_type=result.get('content_type', 'text'),
            image_url=image_url,  # Add generated image URL
            profile_type=profile_type,
            author_name=author_name,
            status=AIGeneratedPostStatus.APPROVED if auto_post else AIGeneratedPostStatus.PENDING_REVIEW
        )
        
        # Save to database
        post_dict = ai_post.model_dump()
        post_dict['created_at'] = datetime.utcnow()
        post_dict['updated_at'] = datetime.utcnow()
        await db.ai_generated_posts.insert_one(post_dict)
        
        # If auto_post is enabled, automatically schedule the post
        if auto_post:
            try:
                from ..models.scheduled_post import ScheduledPost, PostStatus
                from ..models.draft import Draft, DraftStatus, DraftMode
                import uuid
                
                # Get next available time slot from campaign
                time_slots_raw = campaign.get('posting_schedule', {}).get('time_slots', ['09:00'])
                
                # Ensure time_slots is a list (handle case where it might be stored as string)
                if isinstance(time_slots_raw, str):
                    # Try to parse as JSON string if it looks like JSON
                    try:
                        import json
                        time_slots = json.loads(time_slots_raw)
                        if not isinstance(time_slots, list):
                            time_slots = [time_slots_raw]  # Fallback to single string as list
                    except:
                        # If not JSON, treat as comma-separated or single value
                        if ',' in time_slots_raw:
                            time_slots = [ts.strip() for ts in time_slots_raw.split(',')]
                        else:
                            time_slots = [time_slots_raw]
                elif isinstance(time_slots_raw, list):
                    time_slots = time_slots_raw
                else:
                    # Fallback to default
                    time_slots = ['09:00']
                
                # Ensure all items are strings
                time_slots = [str(ts) for ts in time_slots if ts]
                
                if not time_slots:
                    time_slots = ['09:00']  # Final fallback
                
                # Find the next available slot (check existing scheduled posts)
                # Only check active scheduled posts (exclude cancelled/deleted)
                existing_posts = await db.scheduled_posts.find({
                    "org_id": request.org_id,
                    "status": {"$in": ["scheduled", "queued"]},
                    "publish_time": {"$ne": None, "$exists": True}
                }).to_list(length=None)
                
                # Also check ai_generated_posts for scheduled posts
                ai_existing_posts = await db.ai_generated_posts.find({
                    "org_id": request.org_id,
                    "status": "approved",  # Only approved posts
                    "scheduled_for": {"$ne": None, "$exists": True}
                }, {"scheduled_for": 1}).to_list(length=None)
                
                # Filter out any posts that might have been deleted/status changed
                existing_posts = [p for p in existing_posts if p.get('status') not in ["cancelled", "deleted"]]
                
                # Get all scheduled times from scheduled_posts
                scheduled_times = [post.get('publish_time') for post in existing_posts if post.get('publish_time')]
                
                # Also add times from ai_generated_posts
                for ai_post in ai_existing_posts:
                    if ai_post.get('scheduled_for'):
                        scheduled_times.append(ai_post['scheduled_for'])
                
                # Find next available slot
                from datetime import timedelta
                import pytz
                
                now = datetime.utcnow()
                next_slot_time = None
                
                # Try to find a slot in the next 7 days
                # Ensure day_offset is always an integer
                for day_offset_int in range(7):
                    try:
                        day_offset = int(day_offset_int)  # Ensure it's an integer
                        check_date = now + timedelta(days=day_offset)
                    except (ValueError, TypeError) as e:
                        print(f"   [WARNING] Invalid day_offset: {day_offset}, error: {e}")
                        continue
                    for time_slot in time_slots:
                        try:
                            # Ensure time_slot is a string and parse it
                            if not isinstance(time_slot, str):
                                time_slot = str(time_slot)
                            if ':' not in time_slot:
                                continue
                            time_parts = time_slot.split(':')
                            if len(time_parts) != 2:
                                continue
                            hours = int(time_parts[0])
                            minutes = int(time_parts[1])
                            slot_datetime = check_date.replace(hour=hours, minute=minutes, second=0, microsecond=0)
                        except (ValueError, TypeError, AttributeError) as e:
                            print(f"   [WARNING] Invalid time slot format: {time_slot}, error: {e}")
                            continue
                        
                        # Skip if in the past
                        if slot_datetime <= now:
                            continue
                        
                        # Check if this slot is already taken
                        slot_taken = False
                        for st in scheduled_times:
                            if not st:
                                continue
                            try:
                                # Handle both string and datetime objects
                                if isinstance(st, str):
                                    # Parse ISO string, handling both Z and timezone formats
                                    st_parsed = datetime.fromisoformat(st.replace('Z', '+00:00'))
                                elif isinstance(st, datetime):
                                    st_parsed = st.replace(tzinfo=None) if st.tzinfo else st
                                else:
                                    continue
                                
                                # Compare with 5-minute tolerance
                                if abs((st_parsed - slot_datetime).total_seconds()) < 300:
                                    slot_taken = True
                                    break
                            except (ValueError, AttributeError, TypeError) as e:
                                # Skip invalid datetime formats
                                print(f"   [WARNING] Invalid datetime format: {st}, error: {e}")
                                continue
                        
                        if not slot_taken:
                            next_slot_time = slot_datetime
                            break
                    
                    if next_slot_time:
                        break
                
                # If no slot found, use next available time slot + 1 hour
                if not next_slot_time:
                    next_slot_time = now + timedelta(hours=1)
                
                # Create draft first
                draft = Draft(
                    id=str(uuid.uuid4()),
                    org_id=request.org_id,
                    campaign_id=request.campaign_id,
                    author_id="system",
                    mode=DraftMode.TEXT,
                    content={
                        "body": ai_post.content,
                        "image_url": ai_post.image_url
                    },
                    assets=[{"url": ai_post.image_url, "type": "image"}] if ai_post.image_url else [],
                    linkedin_author_type=campaign.get('profile_type', 'personal'),
                    linkedin_author_id=campaign.get('linkedin_author_id'),
                    status=DraftStatus.APPROVED
                )
                
                draft_dict = draft.model_dump()
                draft_dict['created_at'] = datetime.utcnow()
                draft_dict['updated_at'] = datetime.utcnow()
                await db.drafts.insert_one(draft_dict)
                
                # Create scheduled post
                scheduled_post = ScheduledPost(
                    id=str(uuid.uuid4()),
                    draft_id=draft.id,
                    org_id=request.org_id,
                    publish_time=next_slot_time,
                    timezone="UTC",
                    status=PostStatus.SCHEDULED,
                    require_approval=False,
                    approved_by="auto_post",
                    approved_at=datetime.utcnow()
                )
                
                scheduled_dict = scheduled_post.model_dump()
                scheduled_dict['created_at'] = datetime.utcnow()
                scheduled_dict['updated_at'] = datetime.utcnow()
                await db.scheduled_posts.insert_one(scheduled_dict)
                
                # Update AI post with scheduled time
                await db.ai_generated_posts.update_one(
                    {"id": ai_post.id},
                    {"$set": {"scheduled_for": next_slot_time.isoformat()}}
                )
                
                print(f"🚀 Auto-post enabled: Post automatically scheduled for {next_slot_time.isoformat()}")
            except Exception as auto_post_error:
                print(f"   [WARNING] Auto-post scheduling failed: {auto_post_error}")
                print(f"   [WARNING] Error type: {type(auto_post_error).__name__}")
                import traceback
                print(f"   [WARNING] Traceback: {traceback.format_exc()}")
                # Continue without auto-posting - post is still generated
        
        # Update campaign analytics
        await db.campaigns.update_one(
            {"id": request.campaign_id},
            {"$inc": {"total_posts": 1}}
        )
        
        print(f"✅ Content generated successfully!")
        print(f"   Word count: {validation['word_count']}")
        print(f"   Quality: {'✓ PASS' if validation['valid'] else '✗ ISSUES'}")
        if not validation['valid']:
            print(f"   Issues: {', '.join(validation['issues'])}")
        if auto_post:
            print(f"   🚀 Auto-scheduled for: {next_slot_time.isoformat()}")
        print(f"{'='*60}\n")
        
        response_data = {
            "success": True,
            "post": ai_post.model_dump(),
            "validation": validation,
            "auto_posted": auto_post,
            "provider_used": result.get('provider', provider_used),
            "model_used": result.get('model', model_used)
        }
        
        if auto_post:
            response_data["scheduled_for"] = next_slot_time.isoformat()
            response_data["message"] = f"Post automatically approved and scheduled for {next_slot_time.strftime('%Y-%m-%d %H:%M UTC')}"
        
        return response_data
        
    except Exception as e:
        print(f"❌ Content generation failed: {e}")
        print(f"{'='*60}\n")
        raise HTTPException(status_code=500, detail=f"Content generation failed: {str(e)}")

@router.post("/validate")
async def validate_content(request: ContentValidationRequest):
    """Validate post content quality"""
    generator = AIContentGenerator()  # Use mock mode for validation
    validation = await generator.validate_post_quality(request.content)
    return validation

@router.get("/posts/{campaign_id}")
async def list_generated_posts(campaign_id: str, status: Optional[str] = None):
    """List AI-generated posts for a campaign"""
    db = get_db()
    
    query = {"campaign_id": campaign_id}
    if status:
        query["status"] = status
    
    posts = await db.ai_generated_posts.find(query, {"_id": 0}).sort("created_at", -1).to_list(length=100)
    return posts

@router.patch("/posts/{post_id}/status")
async def update_post_status(post_id: str, status: AIGeneratedPostStatus):
    """Update status of an AI-generated post (approve/reject)"""
    db = get_db()
    
    await db.ai_generated_posts.update_one(
        {"id": post_id},
        {
            "$set": {
                "status": status,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {"success": True, "status": status}

@router.delete("/posts/{post_id}")
async def delete_generated_post(post_id: str):
    """Delete an AI-generated post"""
    db = get_db()
    
    result = await db.ai_generated_posts.delete_one({"id": post_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    
    return {"success": True}

@router.get("/review-queue")
async def get_review_queue(org_id: str):
    """Get all AI-generated posts pending review for an organization"""
    db = get_db()
    
    posts = await db.ai_generated_posts.find(
        {"org_id": org_id, "status": AIGeneratedPostStatus.PENDING_REVIEW},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=100)
    
    # Enrich with campaign names
    for post in posts:
        campaign = await db.campaigns.find_one({"id": post.get("campaign_id")}, {"_id": 0, "name": 1})
        if campaign:
            post['campaign_name'] = campaign.get('name')
    
    return posts

@router.get("/approved-posts")
async def get_approved_posts(
    org_id: str, 
    include_posted: bool = True,
    range_start: Optional[str] = None,
    range_end: Optional[str] = None
):
    """Get all approved/posted AI-generated posts
    
    Args:
        org_id: Organization ID
        include_posted: If True, also return POSTED posts (default: True for calendar view)
        range_start: Optional ISO date string to filter posts scheduled after this date
        range_end: Optional ISO date string to filter posts scheduled before this date
    """
    db = get_db()
    
    # Build query - always include posted posts so they remain visible in calendar
    query = {
        "org_id": org_id, 
        "status": {"$in": [AIGeneratedPostStatus.APPROVED.value, AIGeneratedPostStatus.POSTED.value]}
    }
    
    # Add date range filtering if provided
    if range_start or range_end:
        date_conditions = []
        
        # Include posts with scheduled_for in the date range
        scheduled_query = {}
        if range_start:
            scheduled_query["$gte"] = range_start
        if range_end:
            scheduled_query["$lte"] = range_end
        if scheduled_query:
            date_conditions.append({"scheduled_for": scheduled_query})
        
        # Also include posts without scheduled_for (unscheduled posts)
        date_conditions.append({"scheduled_for": {"$exists": False}})
        date_conditions.append({"scheduled_for": None})
        
        # Combine date conditions with OR
        query["$or"] = date_conditions
    
    posts = await db.ai_generated_posts.find(
        query,
        {"_id": 0}
    ).sort("scheduled_for", 1).to_list(length=200)
    
    # Enrich with campaign names
    for post in posts:
        campaign = await db.campaigns.find_one({"id": post.get("campaign_id")}, {"_id": 0, "name": 1})
        if campaign:
            post['campaign_name'] = campaign.get('name')
    
    return posts

class PostUpdateRequest(BaseModel):
    content: str

class PostScheduleUpdateRequest(BaseModel):
    scheduled_for: str

@router.patch("/posts/{post_id}/schedule")
async def update_post_schedule(post_id: str, request: PostScheduleUpdateRequest):
    """Update the scheduled time of an AI-generated post (for drag-and-drop)"""
    db = get_db()
    
    # Check if post exists
    post = await db.ai_generated_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Parse and update scheduled time
    scheduled_time = datetime.fromisoformat(request.scheduled_for.replace('Z', '+00:00'))
    
    await db.ai_generated_posts.update_one(
        {"id": post_id},
        {
            "$set": {
                "scheduled_for": scheduled_time.replace(tzinfo=None),
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    print(f"[RESCHEDULE] Post {post_id} rescheduled to {scheduled_time}")
    
    # Return updated post
    updated_post = await db.ai_generated_posts.find_one({"id": post_id}, {"_id": 0})
    return updated_post

@router.put("/posts/{post_id}")
async def update_post_content(post_id: str, request: PostUpdateRequest):
    """Update the content of an AI-generated post"""
    db = get_db()
    
    # Check if post exists
    post = await db.ai_generated_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Update content
    await db.ai_generated_posts.update_one(
        {"id": post_id},
        {
            "$set": {
                "content": request.content,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    # Return updated post
    updated_post = await db.ai_generated_posts.find_one({"id": post_id}, {"_id": 0})
    return updated_post

@router.post("/posts/{post_id}/approve")
async def approve_post(post_id: str):
    """Approve an AI-generated post"""
    db = get_db()
    
    post = await db.ai_generated_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    await db.ai_generated_posts.update_one(
        {"id": post_id},
        {
            "$set": {
                "status": AIGeneratedPostStatus.APPROVED,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {"success": True, "message": "Post approved"}

@router.post("/posts/{post_id}/reject")
async def reject_post(post_id: str):
    """Reject an AI-generated post"""
    db = get_db()
    
    post = await db.ai_generated_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    await db.ai_generated_posts.update_one(
        {"id": post_id},
        {
            "$set": {
                "status": AIGeneratedPostStatus.REJECTED,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {"success": True, "message": "Post rejected"}

@router.post("/posts/{post_id}/post-now")
async def post_now(post_id: str):
    """Post an AI-generated post immediately to LinkedIn"""
    db = get_db()
    
    # Get the post
    post = await db.ai_generated_posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Get organization
    org = await db.organizations.find_one({"id": post['org_id']}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    if not org.get('linkedin_access_token'):
        raise HTTPException(status_code=400, detail="LinkedIn not connected. Please connect your LinkedIn account first.")
    
    try:
        # Initialize LinkedIn adapter
        from linkedpilot.adapters.linkedin_adapter import LinkedInAdapter
        linkedin = LinkedInAdapter(client_id="from_user", client_secret="from_user")
        linkedin.mock_mode = False
        
        # Get campaign to determine author info
        campaign = await db.campaigns.find_one({"id": post['campaign_id']}, {"_id": 0})
        
        # Determine author type and ID
        profile_type = post.get('profile_type') or (campaign.get('profile_type') if campaign else 'personal')
        is_organization = profile_type in ['company', 'organization']
        
        if is_organization:
            # Use organization/company ID from post or campaign
            author_id = campaign.get('linkedin_author_id') if campaign else None
            if not author_id:
                raise HTTPException(status_code=400, detail="Company/Organization ID not found")
        else:
            # Use personal profile ID
            linkedin_profile = org.get('linkedin_profile', {})
            author_id = org.get('linkedin_person_urn') or linkedin_profile.get('sub') or org.get('linkedin_sub')
        
        # Handle image upload if present
        media_urns = []
        if post.get('image_url'):
            try:
                print(f"   [IMAGE] Uploading image: {post['image_url'][:50]}...")
                print(f"   [IMAGE] Author ID: {author_id}")
                print(f"   [IMAGE] Is Organization: {is_organization}")
                media_urn = await linkedin.upload_media(
                    access_token=org['linkedin_access_token'],
                    org_id=author_id,
                    media_url=post['image_url'],
                    is_organization=is_organization
                )
                if media_urn:
                    media_urns.append(media_urn)
                    print(f"   [SUCCESS] Image uploaded! URN: {media_urn}")
                    # Give LinkedIn more time to process the media asset
                    # LinkedIn needs time to process and index the media before it can be used
                    import asyncio
                    print(f"   [WAIT] Waiting 5 seconds for LinkedIn to process media...")
                    await asyncio.sleep(5)
                else:
                    print(f"   [WARNING] Image upload returned None")
            except Exception as e:
                print(f"   [ERROR] Failed to upload image: {e}")
                import traceback
                traceback.print_exc()
                # Continue without image rather than failing
        
        # Post to LinkedIn
        result = await linkedin.create_post(
            access_token=org['linkedin_access_token'],
            author_id=author_id,
            content={'body': post['content']},
            is_organization=is_organization,
            media_urns=media_urns if media_urns else None
        )
        
        if result and result.get('id'):
            # Update post status
            await db.ai_generated_posts.update_one(
                {"id": post_id},
                {
                    "$set": {
                        "status": AIGeneratedPostStatus.POSTED,
                        "posted_at": datetime.utcnow(),
                        "linkedin_post_id": result.get('id'),
                        "platform_url": result.get('url'),
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            return {
                "success": True,
                "message": "Posted successfully!",
                "post_id": result.get('id'),
                "url": result.get('url')
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to post to LinkedIn")
            
    except Exception as e:
        print(f"Error posting to LinkedIn: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to post: {str(e)}")



