"""
Background scheduler for automated content generation and posting
"""
import os
import asyncio
import base64
import hashlib
from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from motor.motor_asyncio import AsyncIOMotorClient
from cryptography.fernet import Fernet
import pytz

from linkedpilot.adapters.ai_content_generator import AIContentGenerator
from linkedpilot.adapters.linkedin_adapter import LinkedInAdapter
from linkedpilot.adapters.image_adapter import ImageAdapter
from linkedpilot.models.campaign import AIGeneratedPostStatus, CampaignStatus

# Global scheduler instance
scheduler = None

def get_db():
    """Get database connection"""
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    return client[os.environ['DB_NAME']]

def decrypt_api_key(encrypted_key: str) -> str:
    """Decrypt an API key using Fernet encryption (same as settings.py)"""
    try:
        # Handle None or empty keys
        if not encrypted_key:
            return None
            
        # If already decrypted (doesn't look like Fernet-encrypted), return as-is
        if not encrypted_key.startswith('gAAAAA'):
            return encrypted_key
        
        # Use SAME encryption method as settings.py
        import hashlib
        JWT_SECRET = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
        ENCRYPTION_KEY = base64.urlsafe_b64encode(hashlib.sha256(JWT_SECRET.encode()).digest())
        cipher_suite = Fernet(ENCRYPTION_KEY)
        
        decrypted = cipher_suite.decrypt(encrypted_key.encode()).decode()
        return decrypted
    except Exception as e:
        print(f"[ERROR] Failed to decrypt API key: {e}")
        return None  # Return None if decryption fails

async def generate_content_for_active_campaigns():
    """
    Generate content for all active campaigns based on their posting schedule
    This runs periodically to ensure campaigns have content ready for posting
    """
    print(f"\n{'='*60}")
    print(f"[AI-CONTENT-GEN] Job Started")
    print(f"   Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")
    print(f"{'='*60}\n")
    
    db = get_db()
    
    try:
        # Get all active campaigns
        campaigns = await db.campaigns.find({
            "status": CampaignStatus.ACTIVE
        }).to_list(length=100)
        
        print(f"[CAMPAIGNS] Found {len(campaigns)} active campaigns")
        
        for campaign in campaigns:
            try:
                campaign_id = campaign.get('id')
                campaign_name = campaign.get('name')
                org_id = campaign.get('org_id')
                
                # Check campaign frequency to determine if it's time to generate
                frequency = campaign.get('posting_schedule', {}).get('frequency', 'weekly')
                last_generation = campaign.get('last_generation_time')
                current_time = datetime.utcnow()
                
                # Map frequency to minutes between generations
                frequency_intervals = {
                    'every_5_min': 5,        # Generate every 5 minutes
                    'every_15_min': 15,      # Generate every 15 minutes
                    'every_30_min': 30,      # Generate every 30 minutes
                    'hourly': 60,            # Generate every hour
                    'twice_daily': 720,      # Generate every 12 hours
                    'daily': 1440,           # Generate every 24 hours
                    '3x_week': 3360,         # Generate every ~2.3 days (weekly/3)
                    '2x_week': 5040,         # Generate every ~3.5 days (weekly/2)
                    'weekly': 10080,         # Generate every 7 days
                    'bi_weekly': 20160       # Generate every 14 days
                }
                interval_minutes = frequency_intervals.get(frequency, 10080)  # Default: weekly
                
                # Check if enough time has passed since last generation
                should_generate = False
                if not last_generation:
                    should_generate = True  # Never generated before
                else:
                    # Parse last generation time
                    if isinstance(last_generation, str):
                        last_gen_time = datetime.fromisoformat(last_generation.replace('Z', '+00:00'))
                    else:
                        last_gen_time = last_generation
                    
                    # Calculate time difference
                    time_diff = (current_time - last_gen_time).total_seconds() / 60  # in minutes
                    should_generate = time_diff >= interval_minutes
                
                print(f"\n[CAMPAIGN] {campaign_name}")
                print(f"   Frequency: {frequency} (every {interval_minutes} minutes)")
                if last_generation:
                    print(f"   Last generated: {last_generation}")
                    print(f"   Time since last: {int(time_diff)} minutes ago")
                else:
                    print(f"   Last generated: Never")
                print(f"   Should generate: {'YES' if should_generate else 'NO (too soon)'}")
                
                # Generate content if it's time
                if should_generate:
                    print(f"   [GEN] Generating new content...")
                    
                    # Get user's API keys from settings (by user_id from campaign)
                    user_id = campaign.get('created_by')
                    settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})
                    
                    if not settings:
                        print(f"   [ERROR] No settings found for user!")
                        continue
                    
                    # Build list of available providers with their API keys (OpenAI first as default)
                    available_providers = []
                    if settings.get('openai_api_key'):
                        available_providers.append(('openai', decrypt_api_key(settings['openai_api_key'])))
                    if settings.get('anthropic_api_key'):
                        available_providers.append(('claude', decrypt_api_key(settings['anthropic_api_key'])))
                    if settings.get('google_ai_api_key'):
                        available_providers.append(('gemini', decrypt_api_key(settings['google_ai_api_key'])))
                    if settings.get('openrouter_api_key'):
                        available_providers.append(('openrouter', decrypt_api_key(settings['openrouter_api_key'])))
                    
                    if not available_providers:
                        print(f"   [ERROR] No API keys configured!")
                        print(f"   Please add at least one API key in Settings > API Keys:")
                        print(f"   - OpenRouter (recommended)")
                        print(f"   - OpenAI (ChatGPT)")
                        print(f"   - Anthropic (Claude)")
                        print(f"   - Google AI Studio (Gemini)")
                        continue
                    
                    # Get campaign's preferred text model
                    campaign_text_model = campaign.get('text_model', 'openai/gpt-4o-mini')
                    print(f"   [MODEL] Campaign text model: {campaign_text_model}")
                    
                    # Determine which provider to use based on campaign's text_model
                    model_provider_map = {
                        'openai': 'openai',
                        'anthropic': 'claude',
                        'claude': 'claude',
                        'google': 'gemini',
                        'gemini': 'gemini',
                        'meta-llama': 'openrouter',
                    }
                    
                    # Extract provider from model name (e.g., "openai/gpt-4o" -> "openai")
                    preferred_provider = None
                    if '/' in campaign_text_model:
                        model_prefix = campaign_text_model.split('/')[0]
                        preferred_provider = model_provider_map.get(model_prefix, 'openrouter')
                    else:
                        preferred_provider = 'openrouter'  # Default to OpenRouter for flexibility
                    
                    # Try preferred provider first, then fall back to others
                    providers_to_try = []
                    for provider, api_key in available_providers:
                        if provider == preferred_provider:
                            providers_to_try.insert(0, (provider, api_key))  # Add to front
                        else:
                            providers_to_try.append((provider, api_key))  # Add to end
                    
                    # Try each provider until one succeeds
                    result = None
                    last_error = None
                    
                    for provider, api_key in providers_to_try:
                        try:
                            print(f"   [API] Trying {provider} provider...")
                            
                            # Format model name based on provider
                            # OpenRouter uses "provider/model", others use just "model"
                            model_to_use = campaign_text_model
                            if provider != 'openrouter' and '/' in campaign_text_model:
                                # Extract just the model name for direct API calls
                                model_to_use = campaign_text_model.split('/')[-1]
                                print(f"   [MODEL] Adjusted for {provider}: {model_to_use}")
                            
                            generator = AIContentGenerator(
                                api_key=api_key,
                                provider=provider,
                                model=model_to_use  # Pass properly formatted model
                            )
                            
                            result = await generator.generate_post_for_campaign(campaign)
                            print(f"   [SUCCESS] Content generated with {provider} using model {model_to_use}!")
                            break  # Success! Exit the loop
                            
                        except Exception as gen_error:
                            print(f"   [ERROR] {provider} failed: {gen_error}")
                            last_error = gen_error
                            continue  # Try next provider
                    
                    # If all providers failed
                    if not result:
                        print(f"   [ERROR] All providers failed!")
                        print(f"   Last error: {last_error}")
                        continue
                    
                    # Generate image if campaign requires it
                    image_url = None
                    if campaign.get('include_images', False):
                        try:
                            print(f"   [IMAGE] Generating image...")
                            
                            post_content = result.get('content', '')
                            
                            # Check campaign's image mode setting
                            use_ai_images = campaign.get('use_ai_images', True)  # Default to AI images
                            image_model_raw = campaign.get('image_model', 'google/gemini-2.5-flash-image')
                            
                            print(f"   [IMAGE] Campaign image mode: {'AI Generation' if use_ai_images else 'Stock Photos'}")
                            print(f"   [IMAGE] Campaign image_model setting: {image_model_raw}")
                            
                            # Get default image model from admin settings (for fallback)
                            from linkedpilot.routes.drafts import get_default_model_setting, parse_model_setting
                            default_image_setting = await get_default_model_setting('image_draft_image')
                            default_img_provider, default_img_model = parse_model_setting(default_image_setting)
                            
                            print(f"   [IMAGE] Default fallback model: {default_img_provider}:{default_img_model}")
                            
                            from linkedpilot.routes.drafts import get_system_api_key
                            
                            # Prepare enhanced prompt for AI image generation
                            print(f"   [IMAGE] Step 1/3: Analyzing post content...")
                            print(f"   [IMAGE] Post preview: {post_content[:100]}...")
                            
                            # Get OpenAI API key for prompt optimization
                            system_openai_key, _ = await get_system_api_key("openai")
                            image_prompt = post_content  # Default fallback
                            
                            if system_openai_key:
                                try:
                                    print(f"   [IMAGE] Step 2/3: AI creating custom visual metaphor...")
                                    from linkedpilot.utils.ai_image_prompt_optimizer import generate_optimized_image_prompt
                                    
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
                            
                            # Respect campaign's use_ai_images setting
                            if use_ai_images:
                                # AI Image Generation Mode - use same logic as create page
                                print(f"   [IMAGE] Mode: AI Generation (using same logic as create page)")
                                
                                # Use same logic as create page: get default from admin settings
                                from linkedpilot.routes.drafts import get_default_model_setting, parse_model_setting
                                default_image_setting = await get_default_model_setting('image_draft_image')
                                default_img_provider, default_img_model = parse_model_setting(default_image_setting)
                                
                                # Use campaign's image_model if set, otherwise use admin default
                                image_model_to_use = image_model_raw if image_model_raw else default_img_model
                                
                                print(f"   [IMAGE] Admin default: {default_img_provider}/{default_img_model}")
                                print(f"   [IMAGE] Campaign setting: {image_model_raw}")
                                print(f"   [IMAGE] Using: {image_model_to_use}")
                                
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
                                        print(f"      API Key: {system_api_key[:8]}...{system_api_key[-4:]}")
                                        
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
                                        if image_result and 'url' in image_result and image_result['url']:
                                            image_url = image_result['url']
                                            print(f"   [IMAGE] ✓ Generated successfully with {default_img_model}!")
                                            print(f"   [IMAGE] Image URL length: {len(image_url)}")
                                        # Fallback to base64 if URL is missing or empty
                                        elif image_result and 'image_base64' in image_result and image_result['image_base64']:
                                            # Handle base64 images by creating a data URL
                                            image_url = f"data:image/png;base64,{image_result['image_base64']}"
                                            print(f"   [IMAGE] ✓ Generated successfully with {default_img_model} (base64 fallback)!")
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
                                                if image_result and 'url' in image_result and image_result['url']:
                                                    image_url = image_result['url']
                                                elif image_result and 'image_base64' in image_result and image_result['image_base64']:
                                                    image_url = f"data:image/png;base64,{image_result['image_base64']}"
                                    else:
                                        print(f"   [IMAGE] No API key available, skipping AI image generation")
                                except Exception as ai_error:
                                    print(f"   [IMAGE] AI generation failed: {ai_error}, no image generated")
                                    import traceback
                                    print(f"   [IMAGE] Error traceback:")
                                    traceback.print_exc()
                                    # Explicitly do NOT fall back to DALL-E or stock photos
                                    print(f"   [IMAGE] No fallback - campaign requires AI images")
                            else:
                                # Stock Photos Mode (only use stock when use_ai_images=False)
                                print(f"   [IMAGE] Mode: Stock Photos (campaign setting: use_ai_images=False)")
                            
                            # Stock Photos (ONLY if use_ai_images=False - NO fallback if AI is enabled)
                            if not image_url:
                                if use_ai_images:
                                    # If use_ai_images=True, do NOT fall back to stock photos
                                    # Only use the campaign's specified AI model (Gemini)
                                    print(f"   [IMAGE] AI generation failed - no fallback to stock photos (campaign requires AI images)")
                                else:
                                    # Only use stock photos if explicitly set to use_ai_images=False
                                    print(f"   [IMAGE] Using stock photos (campaign setting: use_ai_images=False)...")
                                    try:
                                        from linkedpilot.utils.stock_image_fetcher import StockImageFetcher, extract_image_keywords_ai
                                        
                                        # Get stock image API keys from SYSTEM settings
                                        system_settings = await db.system_settings.find_one({"_id": "api_keys"})
                                        
                                        def decrypt_system_key(encrypted_value):
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
                                        if system_settings:
                                            if system_settings.get('unsplash_access_key'):
                                                unsplash_key = decrypt_system_key(system_settings['unsplash_access_key'])
                                            if system_settings.get('pexels_api_key'):
                                                pexels_key = decrypt_system_key(system_settings['pexels_api_key'])
                                            if system_settings.get('openai_api_key'):
                                                openai_key = decrypt_system_key(system_settings['openai_api_key'])
                                        
                                        campaign_topic = campaign.get('name', '')
                                        keywords = await extract_image_keywords_ai(post_content, campaign_topic, openai_key)
                                        
                                        fetcher = StockImageFetcher(unsplash_key=unsplash_key, pexels_key=pexels_key)
                                        stock_result = await fetcher.fetch_image(keywords, orientation="landscape")
                                        
                                        if stock_result and stock_result.get('url'):
                                            image_url = stock_result['url']
                                            print(f"   [IMAGE] ✓ Found stock photo from {stock_result['source']}")
                                        else:
                                            print(f"   [IMAGE] Stock photos failed, no image generated")
                                    except Exception as stock_error:
                                        print(f"   [IMAGE] Stock photos failed: {stock_error}, no image generated")
                            
                            # No additional fallbacks - respect campaign's use_ai_images setting
                            if not image_url:
                                print(f"   [IMAGE] No image generated - respecting campaign's image mode setting")
                        except Exception as img_error:
                            print(f"   [WARNING] Image generation failed: {img_error}")
                    
                    # Check if campaign has auto_post enabled
                    auto_post = campaign.get('auto_post', False)
                    
                    # Get profile info from campaign for display in calendar
                    profile_type = campaign.get('profile_type', 'personal')
                    linkedin_author_id = campaign.get('linkedin_author_id')
                    author_name = None
                    
                    # Get author name from organization's LinkedIn data
                    if linkedin_author_id:
                        org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
                        if org:
                            if profile_type == 'company':
                                # Try to find company name from managed organizations
                                linkedin_token = org.get('linkedin_access_token')
                                if linkedin_token:
                                    try:
                                        from linkedpilot.adapters.linkedin_adapter import LinkedInAdapter
                                        linkedin = LinkedInAdapter(client_id="dummy", client_secret="dummy")
                                        linkedin.mock_mode = False
                                        managed_orgs = await linkedin.get_managed_organizations(linkedin_token)
                                        for managed_org in managed_orgs:
                                            if str(managed_org.get('id')) == str(linkedin_author_id):
                                                author_name = managed_org.get('name', managed_org.get('localizedName'))
                                                break
                                    except Exception as e:
                                        print(f"   [WARNING] Could not fetch company name: {e}")
                            else:
                                # Personal profile
                                linkedin_profile = org.get('linkedin_profile', {})
                                author_name = linkedin_profile.get('name', 'Personal Profile')
                    
                    # Create AI-generated post record
                    ai_post = {
                        "id": f"aipost_{int(datetime.utcnow().timestamp()*1000)}",
                        "campaign_id": campaign_id,
                        "org_id": org_id,
                        "content": result['content'],
                        "generation_prompt": result['generation_prompt'],
                        "content_pillar": result.get('content_pillar'),
                        "content_type": result.get('content_type', 'text'),
                        "image_url": image_url,  # Add image if generated
                        "profile_type": profile_type,  # Where to publish (personal/company)
                        "author_name": author_name,  # Display name for calendar
                        "status": AIGeneratedPostStatus.APPROVED.value if auto_post else AIGeneratedPostStatus.PENDING_REVIEW.value,
                        "created_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow()
                    }
                    
                    print(f"   [AUTO-POST] {'ENABLED' if auto_post else 'DISABLED'} - Status: {ai_post['status']}")
                    print(f"   [PUBLISH] Target: {profile_type} - {author_name or 'Unknown'}")
                    
                    # Save to database
                    try:
                        await db.ai_generated_posts.insert_one(ai_post)
                        print(f"   [DB] Post saved successfully! ID: {ai_post['id']}")
                    except Exception as db_error:
                        print(f"   [ERROR] Failed to save post to database: {db_error}")
                        print(f"   Post data: {ai_post}")
                        continue  # Skip campaign update if DB save failed
                    
                    # Update campaign: increment post count AND update last generation time
                    await db.campaigns.update_one(
                        {"id": campaign_id},
                        {
                            "$inc": {"total_posts": 1},
                            "$set": {"last_generation_time": current_time.isoformat()}
                        }
                    )
                    
                    print(f"   [SUCCESS] Content generated successfully!")
                    print(f"   Provider: {provider}")
                    print(f"   Next generation: {interval_minutes} minutes from now")
                else:
                    print(f"   [SKIP] Too soon to generate (waiting for {interval_minutes - int(time_diff)} more minutes)")
                    
            except Exception as e:
                print(f"   [ERROR] Error generating content: {e}")
                continue
        
        print(f"\n{'='*60}")
        print(f"[AI-CONTENT-GEN] Job Completed")
        print(f"{'='*60}\n")
        
    except Exception as e:
        print(f"[ERROR] Auto-content generation job failed: {e}")
        print(f"{'='*60}\n")

async def auto_schedule_approved_posts():
    """
    Auto-schedule approved posts to campaign time slots
    This assigns scheduled_for times to approved posts that don't have one yet
    """
    db = get_db()
    
    try:
        # Get all approved posts without a scheduled time
        unscheduled_posts = await db.ai_generated_posts.find({
            "status": AIGeneratedPostStatus.APPROVED.value,
            "scheduled_for": None
        }).to_list(length=100)
        
        print(f"\n[AUTO-SCHEDULE] Checking for unscheduled posts...")
        print(f"   Found {len(unscheduled_posts)} unscheduled approved posts")
        
        if not unscheduled_posts:
            return
        
        print(f"\n[AUTO-SCHEDULE] Processing {len(unscheduled_posts)} posts...")
        
        for post in unscheduled_posts:
            try:
                campaign_id = post.get('campaign_id')
                
                # Get campaign to check time slots
                campaign = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
                if not campaign:
                    continue
                
                # Get campaign time slots (in HH:MM format like "09:00", "14:00")
                time_slots = campaign.get('posting_schedule', {}).get('time_slots', ['09:00', '14:00'])
                frequency = campaign.get('posting_schedule', {}).get('frequency', 'daily')
                
                # Get user's timezone preference
                user_id = campaign.get('created_by')
                user_prefs = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})
                user_timezone = user_prefs.get('timezone') if user_prefs else 'UTC'
                
                print(f"   User timezone: {user_timezone}")
                
                # Get current time in user's timezone
                try:
                    tz = pytz.timezone(user_timezone)
                    current_time_user = datetime.now(tz)
                    current_time_utc = datetime.utcnow()
                    
                    print(f"   Current time (user): {current_time_user.strftime('%Y-%m-%d %H:%M %Z')}")
                    print(f"   Current time (UTC): {current_time_utc.strftime('%Y-%m-%d %H:%M UTC')}")
                    
                    # Get all already scheduled posts for this campaign from BOTH collections
                    org_id = post.get('org_id')
                    
                    # Check ai_generated_posts collection
                    # Only get APPROVED posts that are actually scheduled (not deleted/rejected)
                    ai_scheduled_posts = await db.ai_generated_posts.find({
                        "org_id": org_id,
                        "status": AIGeneratedPostStatus.APPROVED.value,
                        "scheduled_for": {"$ne": None, "$exists": True}
                    }, {"scheduled_for": 1, "status": 1}).to_list(length=1000)
                    
                    # Filter out any posts that might have been soft-deleted (status changed)
                    ai_scheduled_posts = [p for p in ai_scheduled_posts if p.get('status') == AIGeneratedPostStatus.APPROVED.value]
                    
                    # Check scheduled_posts collection (for manually scheduled posts)
                    # Exclude cancelled/deleted posts - only get active scheduled posts
                    manual_scheduled_posts = await db.scheduled_posts.find({
                        "org_id": org_id,
                        "status": {"$in": ["scheduled", "queued"]},
                        "publish_time": {"$ne": None, "$exists": True}
                    }, {"publish_time": 1, "status": 1}).to_list(length=1000)
                    
                    # Filter out cancelled posts (extra safety check)
                    manual_scheduled_posts = [p for p in manual_scheduled_posts if p.get('status') not in ["cancelled", "deleted"]]
                    
                    # Combine occupied times from both collections
                    occupied_times = set()
                    
                    # Add times from ai_generated_posts
                    for p in ai_scheduled_posts:
                        if 'scheduled_for' in p and p['scheduled_for']:
                            # Handle both datetime objects and ISO strings
                            if isinstance(p['scheduled_for'], str):
                                try:
                                    from dateutil import parser
                                    occupied_times.add(parser.parse(p['scheduled_for']).replace(tzinfo=None))
                                except:
                                    pass
                            else:
                                occupied_times.add(p['scheduled_for'] if not hasattr(p['scheduled_for'], 'replace') else p['scheduled_for'].replace(tzinfo=None))
                    
                    # Add times from scheduled_posts
                    for p in manual_scheduled_posts:
                        if 'publish_time' in p and p['publish_time']:
                            # Handle both datetime objects and ISO strings
                            if isinstance(p['publish_time'], str):
                                try:
                                    from dateutil import parser
                                    occupied_times.add(parser.parse(p['publish_time']).replace(tzinfo=None))
                                except:
                                    pass
                            else:
                                occupied_times.add(p['publish_time'] if not hasattr(p['publish_time'], 'replace') else p['publish_time'].replace(tzinfo=None))
                    
                    print(f"   Found {len(occupied_times)} occupied time slots (from {len(ai_scheduled_posts)} AI posts + {len(manual_scheduled_posts)} scheduled posts)")
                    
                    # Helper function to check if a slot is available
                    def is_slot_available(slot_time_utc):
                        # Check if this exact time is already taken
                        for occupied in occupied_times:
                            try:
                                # Ensure both are datetime objects
                                if isinstance(occupied, str):
                                    # Skip strings that weren't parsed (shouldn't happen, but safety check)
                                    continue
                                if not isinstance(occupied, datetime):
                                    continue
                                # Compare with 1-minute tolerance (in case of slight time differences)
                                if abs((occupied - slot_time_utc).total_seconds()) < 60:
                                    return False
                            except (TypeError, AttributeError) as e:
                                # Skip invalid datetime comparisons
                                print(f"   [WARNING] Invalid datetime comparison: {e}")
                                continue
                        return True
                    
                    # Try to find next available slot
                    scheduled_time = None
                    days_to_check = 7  # Check up to 7 days ahead
                    
                    for day_offset in range(days_to_check):
                        day_user = current_time_user + timedelta(days=day_offset)
                        
                        for slot in time_slots:
                            hour, minute = map(int, slot.split(':'))
                            
                            # Create time in user's timezone
                            slot_time_user = day_user.replace(hour=hour, minute=minute, second=0, microsecond=0)
                            
                            # Convert to UTC
                            slot_time_utc = slot_time_user.astimezone(pytz.UTC).replace(tzinfo=None)
                            
                            # Check if slot is in the future AND available
                            if slot_time_utc > current_time_utc and is_slot_available(slot_time_utc):
                                scheduled_time = slot_time_utc
                                day_label = "today" if day_offset == 0 else f"in {day_offset} days"
                                print(f"   Next available slot: {slot} {day_label} (user time) = {slot_time_utc.strftime('%Y-%m-%d %H:%M UTC')}")
                                break
                        
                        if scheduled_time:
                            break
                    
                    if not scheduled_time:
                        print(f"   [WARNING] No available slots found in next {days_to_check} days!")
                    
                except Exception as tz_error:
                    print(f"   [WARNING] Timezone conversion failed: {tz_error}, using UTC")
                    # Fallback to UTC if timezone conversion fails
                    current_time_utc = datetime.utcnow()
                    
                    # Get occupied slots from BOTH collections
                    org_id = post.get('org_id')
                    
                    # Check ai_generated_posts collection
                    # Only get APPROVED posts that are actually scheduled (not deleted/rejected)
                    ai_scheduled_posts = await db.ai_generated_posts.find({
                        "org_id": org_id,
                        "status": AIGeneratedPostStatus.APPROVED.value,
                        "scheduled_for": {"$ne": None, "$exists": True}
                    }, {"scheduled_for": 1, "status": 1}).to_list(length=1000)
                    
                    # Filter out any posts that might have been soft-deleted (status changed)
                    ai_scheduled_posts = [p for p in ai_scheduled_posts if p.get('status') == AIGeneratedPostStatus.APPROVED.value]
                    
                    # Check scheduled_posts collection (exclude cancelled/deleted)
                    # Only get active scheduled posts
                    manual_scheduled_posts = await db.scheduled_posts.find({
                        "org_id": org_id,
                        "status": {"$in": ["scheduled", "queued"]},
                        "publish_time": {"$ne": None, "$exists": True}
                    }, {"publish_time": 1, "status": 1}).to_list(length=1000)
                    
                    # Filter out cancelled posts (extra safety check)
                    manual_scheduled_posts = [p for p in manual_scheduled_posts if p.get('status') not in ["cancelled", "deleted"]]
                    
                    # Combine occupied times from both collections
                    occupied_times = set()
                    for p in ai_scheduled_posts:
                        if 'scheduled_for' in p and p['scheduled_for']:
                            if isinstance(p['scheduled_for'], str):
                                try:
                                    from dateutil import parser
                                    occupied_times.add(parser.parse(p['scheduled_for']).replace(tzinfo=None))
                                except:
                                    pass
                            else:
                                occupied_times.add(p['scheduled_for'] if not hasattr(p['scheduled_for'], 'replace') else p['scheduled_for'].replace(tzinfo=None))
                    
                    for p in manual_scheduled_posts:
                        if 'publish_time' in p and p['publish_time']:
                            if isinstance(p['publish_time'], str):
                                try:
                                    from dateutil import parser
                                    occupied_times.add(parser.parse(p['publish_time']).replace(tzinfo=None))
                                except:
                                    pass
                            else:
                                occupied_times.add(p['publish_time'] if not hasattr(p['publish_time'], 'replace') else p['publish_time'].replace(tzinfo=None))
                    
                    def is_slot_available_utc(slot_time_utc):
                        for occupied in occupied_times:
                            try:
                                # Ensure both are datetime objects
                                if isinstance(occupied, str):
                                    continue
                                if not isinstance(occupied, datetime):
                                    continue
                                # Compare with 1-minute tolerance
                                if abs((occupied - slot_time_utc).total_seconds()) < 60:
                                    return False
                            except (TypeError, AttributeError) as e:
                                print(f"   [WARNING] Invalid datetime comparison: {e}")
                                continue
                        return True
                    
                    scheduled_time = None
                    for day_offset in range(7):
                        day_utc = current_time_utc + timedelta(days=day_offset)
                        for slot in time_slots:
                            hour, minute = map(int, slot.split(':'))
                            slot_time = day_utc.replace(hour=hour, minute=minute, second=0, microsecond=0)
                            if slot_time > current_time_utc and is_slot_available_utc(slot_time):
                                scheduled_time = slot_time
                                break
                        if scheduled_time:
                            break
                
                if scheduled_time:
                    # Update post with scheduled time
                    await db.ai_generated_posts.update_one(
                        {"id": post.get('id')},
                        {"$set": {"scheduled_for": scheduled_time, "updated_at": datetime.utcnow()}}
                    )
                    print(f"   [SCHEDULED] Post for campaign '{campaign.get('name')}' at {scheduled_time.strftime('%Y-%m-%d %H:%M UTC')}")
                    
            except Exception as e:
                print(f"   [ERROR] Failed to schedule post: {e}")
                continue
                
    except Exception as e:
        print(f"[ERROR] Auto-scheduling failed: {e}")

async def auto_post_approved_content():
    """
    Automatically post approved content that is scheduled for now
    This runs every 5 minutes to check for scheduled posts
    Uses UTC time but respects the time slots configured in campaigns
    """
    print(f"\n{'='*60}")
    print(f"[AUTO-POST] Job Started")
    print(f"   Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")
    print(f"{'='*60}\n")
    
    db = get_db()
    
    try:
        # First, auto-schedule any approved posts that don't have a time yet
        await auto_schedule_approved_posts()
        
        # Get all approved posts that are scheduled for now or earlier
        current_time = datetime.utcnow()
        
        # Check AI-generated campaign posts
        approved_posts = await db.ai_generated_posts.find({
            "status": AIGeneratedPostStatus.APPROVED.value,
            "scheduled_for": {"$lte": current_time}
        }).to_list(length=50)
        
        # Check manually scheduled posts from drafts
        scheduled_posts = await db.scheduled_posts.find({
            "status": "scheduled",
            "publish_time": {"$lte": current_time.isoformat()}
        }).to_list(length=50)
        
        print(f"[AI POSTS] Found {len(approved_posts)} AI posts ready to post")
        print(f"[MANUAL POSTS] Found {len(scheduled_posts)} manually scheduled posts ready to post")
        
        for post in approved_posts:
            try:
                post_id = post.get('id')
                campaign_id = post.get('campaign_id')
                org_id = post.get('org_id')
                content = post.get('content')
                
                # Get campaign info
                campaign = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
                if not campaign:
                    print(f"   [WARNING] Campaign not found for post {post_id}")
                    continue
                
                # Check if campaign allows auto-posting
                if not campaign.get('auto_post', False):
                    print(f"   [SKIPPED] Campaign '{campaign.get('name')}' has auto-post disabled")
                    continue
                
                print(f"\n[POSTING] Campaign: {campaign.get('name')}")
                
                # Get organization info
                org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
                if not org:
                    print(f"   [WARNING] Organization not found")
                    continue
                
                # Get LinkedIn credentials from USER settings (campaigns have created_by user)
                user_id = campaign.get('created_by')
                if not user_id:
                    print(f"   [WARNING] No user_id in campaign")
                    # Mark as failed
                    await db.ai_generated_posts.update_one(
                        {"id": post_id},
                        {
                            "$set": {
                                "status": AIGeneratedPostStatus.FAILED,
                                "updated_at": datetime.utcnow()
                            }
                        }
                    )
                    continue
                
                print(f"   Looking up LinkedIn connection for user: {user_id}")
                user_settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})
                
                if not user_settings or not user_settings.get('linkedin_access_token'):
                    print(f"   [WARNING] No LinkedIn access token for user")
                    # Mark as failed
                    await db.ai_generated_posts.update_one(
                        {"id": post_id},
                        {
                            "$set": {
                                "status": AIGeneratedPostStatus.FAILED,
                                "updated_at": datetime.utcnow()
                            }
                        }
                    )
                    continue
                
                # Initialize LinkedIn adapter
                # Pass dummy credentials to disable mock mode since we have a real access token
                linkedin = LinkedInAdapter(client_id="from_user", client_secret="from_user")
                
                # Get author info - check if posting as organization or person
                # Use profile_type from campaign (can be "personal" or "company")
                profile_type = campaign.get('profile_type', 'personal')
                is_organization = (profile_type == 'company' or profile_type == 'organization')
                
                linkedin_profile = user_settings.get('linkedin_profile', {})
                author_id = user_settings.get('linkedin_person_urn') or linkedin_profile.get('sub')
                
                # If posting as organization, use the linkedin_author_id from campaign
                if is_organization:
                    author_id = campaign.get('linkedin_author_id')
                
                print(f"   [POSTING AS] {'Company' if is_organization else 'Personal'} - Author ID: {author_id}")
                
                # Handle image upload if present
                media_urns = None
                image_url = post.get('image_url')
                if image_url:
                    try:
                        print(f"   [IMAGE] Uploading image to LinkedIn: {image_url[:80]}...")
                        media_urn = await linkedin.upload_media(
                            access_token=user_settings['linkedin_access_token'],
                            org_id=author_id,
                            media_url=image_url,
                            media_type="image",
                            is_organization=is_organization
                        )
                        if media_urn:
                            media_urns = [media_urn]
                            print(f"   [IMAGE] Successfully uploaded! URN: {media_urn}")
                        else:
                            print(f"   [IMAGE] Upload failed - posting without image")
                    except Exception as img_error:
                        print(f"   [IMAGE] Upload error: {img_error} - posting without image")
                
                # Post to LinkedIn
                result = await linkedin.create_post(
                    access_token=user_settings['linkedin_access_token'],
                    author_id=author_id,
                    content={'body': content},
                    media_urns=media_urns,
                    is_organization=is_organization
                )
                
                # Check if post was successful (has an id)
                if result and result.get('id'):
                    # Update post status to POSTED
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
                    
                    # Update campaign analytics
                    await db.campaigns.update_one(
                        {"id": campaign_id},
                        {
                            "$set": {"last_post_time": datetime.utcnow().isoformat()},
                            "$inc": {"posts_this_week": 1, "posts_this_month": 1}
                        }
                    )
                    
                    print(f"   [SUCCESS] Posted successfully!")
                    print(f"   Post ID: {result.get('id')}")
                    print(f"   URL: {result.get('url')}")
                else:
                    print(f"   [FAILED] Posting failed: No post ID returned")
                    print(f"   Result: {result}")
                    # Mark as failed
                    await db.ai_generated_posts.update_one(
                        {"id": post_id},
                        {
                            "$set": {
                                "status": AIGeneratedPostStatus.FAILED,
                                "updated_at": datetime.utcnow()
                            }
                        }
                    )
                    
            except Exception as e:
                print(f"   [ERROR] Error posting content: {e}")
                # Mark as failed
                await db.ai_generated_posts.update_one(
                    {"id": post.get('id')},
                    {
                        "$set": {
                            "status": AIGeneratedPostStatus.FAILED,
                            "updated_at": datetime.utcnow()
                        }
                    }
                )
                continue
        
        # Now process manually scheduled posts
        for post in scheduled_posts:
            try:
                post_id = post.get('id')
                org_id = post.get('org_id')
                draft_id = post.get('draft_id')
                
                # Get draft content
                draft = await db.drafts.find_one({"id": draft_id}, {"_id": 0})
                if not draft:
                    print(f"   [WARNING] Draft not found for post {post_id}")
                    continue
                
                content_body = draft.get('content', {}).get('body', '')
                if not content_body:
                    print(f"   [WARNING] No content in draft {draft_id}")
                    continue
                
                # Append hashtags to content if they exist
                hashtags = draft.get('content', {}).get('hashtags', [])
                if hashtags and isinstance(hashtags, list) and len(hashtags) > 0:
                    hashtags_str = ' '.join(hashtags)
                    content_body = f"{content_body}\n\n{hashtags_str}"
                
                print(f"\n[POSTING] Manual Post: {post_id[:20]}...")
                
                # Get organization's LinkedIn access token
                org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
                if not org or not org.get('linkedin_access_token'):
                    print(f"   [WARNING] No LinkedIn access token for organization")
                    await db.scheduled_posts.update_one(
                        {"id": post_id},
                        {"$set": {"status": "failed", "updated_at": datetime.utcnow()}}
                    )
                    continue
                
                # Initialize LinkedIn adapter
                # Pass dummy credentials to disable mock mode since we have a real access token
                linkedin = LinkedInAdapter(client_id="from_user", client_secret="from_user")
                
                # Get author info
                # Try to get sub from linkedin_profile object first, then fallback to root level
                linkedin_profile = org.get('linkedin_profile', {})
                author_id = org.get('linkedin_person_urn') or linkedin_profile.get('sub') or org.get('linkedin_sub')
                is_organization = post.get('posting_as_organization', False)
                
                if is_organization and org.get('linkedin_organization_id'):
                    author_id = org.get('linkedin_organization_id')
                
                # Get image if exists
                image_url = None
                assets = draft.get('assets', [])
                if assets and len(assets) > 0:
                    image_url = assets[0].get('url')
                
                # Post to LinkedIn
                result = await linkedin.create_post(
                    access_token=org['linkedin_access_token'],
                    author_id=author_id,
                    content={'body': content_body},
                    is_organization=is_organization
                )
                
                # Check if post was successful (has an id)
                if result and result.get('id'):
                    # Update post status to PUBLISHED
                    await db.scheduled_posts.update_one(
                        {"id": post_id},
                        {
                            "$set": {
                                "status": "published",
                                "published_at": datetime.utcnow(),
                                "linkedin_post_id": result.get('id'),
                                "platform_url": result.get('url'),
                                "updated_at": datetime.utcnow()
                            }
                        }
                    )
                    print(f"   [SUCCESS] Posted successfully!")
                    print(f"   Post ID: {result.get('id')}")
                    print(f"   URL: {result.get('url')}")
                else:
                    print(f"   [FAILED] Posting failed: No post ID returned")
                    print(f"   Result: {result}")
                    await db.scheduled_posts.update_one(
                        {"id": post_id},
                        {
                            "$set": {
                                "status": "failed",
                                "error": result.get('error'),
                                "updated_at": datetime.utcnow()
                            }
                        }
                    )
                    
            except Exception as e:
                print(f"   [ERROR] Error posting manual content: {e}")
                await db.scheduled_posts.update_one(
                    {"id": post.get('id')},
                    {"$set": {"status": "failed", "updated_at": datetime.utcnow()}}
                )
                continue
        
        print(f"\n{'='*60}")
        print(f"[AUTO-POST] Job Completed")
        print(f"{'='*60}\n")
        
    except Exception as e:
        print(f"[ERROR] Auto-posting job failed: {e}")
        print(f"{'='*60}\n")

def start_scheduler():
    """Initialize and start the background scheduler"""
    global scheduler
    
    if scheduler is not None:
        print("[WARNING] Scheduler already running")
        return
    
    try:
        print(f"\n{'='*60}")
        print(f"[SCHEDULER] Starting Background Scheduler")
        print(f"{'='*60}\n")
        
        scheduler = AsyncIOScheduler()
        
        # Schedule content generation job - runs every 5 minutes for fast response
        # (campaigns with longer frequencies will naturally generate less often based on their pending post count)
        scheduler.add_job(
            generate_content_for_active_campaigns,
            CronTrigger(minute='*/5'),  # Every 5 minutes
            id='content_generation',
            name='Auto-generate content for active campaigns',
            replace_existing=True
        )
        print("[OK] SCHEDULED: Content Generation (Every 5 minutes)")
        
        # Schedule auto-posting job - runs every 5 minutes for fast testing
        scheduler.add_job(
            auto_post_approved_content,
            CronTrigger(minute='*/5'),  # Every 5 minutes
            id='auto_posting',
            name='Auto-post approved content',
            replace_existing=True
        )
        print("[OK] SCHEDULED: Auto-Posting (Every 5 minutes)")
        
        # Start scheduler in non-blocking mode
        scheduler.start()
        
        print(f"\n{'='*60}")
        print(f"[OK] Scheduler Started Successfully")
        print(f"{'='*60}\n")
        
    except Exception as e:
        print(f"\n{'='*60}")
        print(f"[ERROR] Failed to start scheduler")
        print(f"   {str(e)}")
        print(f"   Server will continue without scheduler")
        print(f"{'='*60}\n")
        scheduler = None

def stop_scheduler():
    """Stop the background scheduler"""
    global scheduler
    
    if scheduler is None:
        print("WARNING: Scheduler not running")
        return
    
    print("\nStopping scheduler...")
    scheduler.shutdown()
    scheduler = None
    print("Scheduler stopped\n")

# Manual trigger functions for testing/on-demand execution
async def trigger_content_generation():
    """Manually trigger content generation"""
    await generate_content_for_active_campaigns()

async def trigger_auto_posting():
    """Manually trigger auto-posting"""
    await auto_post_approved_content()



# Manual trigger functions for testing/on-demand execution
async def trigger_content_generation():
    """Manually trigger content generation"""
    await generate_content_for_active_campaigns()

