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
                            
                            # Check if campaign wants AI images or stock photos (default: stock)
                            post_content = result.get('content', '')
                            use_ai_images = campaign.get('use_ai_images', False)  # Default to stock photos
                            use_stock = not use_ai_images  # Use stock unless AI is explicitly enabled
                            
                            # Get campaign's preferred AI image model (only used if use_ai_images=True)
                            image_model_raw = campaign.get('image_model', 'openai/dall-e-3')
                            print(f"   [IMAGE] Mode: {'AI Generation' if use_ai_images else 'Stock Photos (default)'}")
                            if use_ai_images:
                                print(f"   [IMAGE MODEL] AI model: {image_model_raw}")
                            
                            if use_stock:
                                # Try to fetch stock image
                                try:
                                    print(f"   [STOCK IMAGE] Trying stock photos first...")
                                    from linkedpilot.utils.stock_image_fetcher import StockImageFetcher, extract_image_keywords_ai
                                    
                                    # Get stock image API keys from SYSTEM settings (admin-managed)
                                    system_settings = await db.system_settings.find_one({"_id": "api_keys"})
                                    
                                    # Decrypt using ENCRYPTION_KEY from .env (same as admin.py)
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
                                    if system_settings and system_settings.get('unsplash_access_key'):
                                        unsplash_key = decrypt_system_key(system_settings['unsplash_access_key'])
                                    if system_settings and system_settings.get('pexels_api_key'):
                                        pexels_key = decrypt_system_key(system_settings['pexels_api_key'])
                                    
                                    # Get OpenAI key for AI-powered keyword extraction from SYSTEM settings
                                    openai_key = None
                                    if system_settings and system_settings.get('openai_api_key'):
                                        openai_key = decrypt_system_key(system_settings['openai_api_key'])
                                    
                                    # Use campaign name as the topic for better image search
                                    campaign_topic = campaign.get('name', '')
                                    keywords = await extract_image_keywords_ai(post_content, campaign_topic, openai_key)
                                    print(f"   [STOCK IMAGE] Campaign topic: {campaign_topic}")
                                    print(f"   [STOCK IMAGE] Search keywords: {keywords}")
                                    
                                    fetcher = StockImageFetcher(unsplash_key=unsplash_key, pexels_key=pexels_key)
                                    stock_result = await fetcher.fetch_image(keywords, orientation="landscape")
                                    
                                    if stock_result and stock_result.get('url'):
                                        image_url = stock_result['url']
                                        print(f"   [STOCK IMAGE] ✓ Found from {stock_result['source']}")
                                        print(f"   [STOCK IMAGE] Photographer: {stock_result['photographer']}")
                                    else:
                                        print(f"   [STOCK IMAGE] No results, falling back to AI generation...")
                                        use_stock = False
                                except Exception as stock_error:
                                    print(f"   [STOCK IMAGE] Failed: {stock_error}, falling back to AI...")
                                    use_stock = False
                            
                            # If stock images didn't work or user chose AI, use AI generation
                            if not use_stock or not image_url:
                                print(f"   [IMAGE] Using AI image generation...")
                                
                                # Extract just model name if in "provider/model" format
                                image_model = image_model_raw.split('/')[-1] if '/' in image_model_raw else image_model_raw
                                
                                # Use AI to analyze post and create unique visual metaphor
                                
                                print(f"   [IMAGE] Step 1/3: Analyzing post content...")
                                print(f"   [IMAGE] Post preview: {post_content[:100]}...")
                                
                                # Get OpenAI API key for prompt optimization
                                openai_key = None
                                if settings.get('openai_api_key'):
                                    openai_key = decrypt_api_key(settings['openai_api_key'])
                            
                            if openai_key:
                                try:
                                    print(f"   [IMAGE] Step 2/3: AI creating custom visual metaphor...")
                                    from linkedpilot.utils.ai_image_prompt_optimizer import generate_optimized_image_prompt
                                    
                                    ai_analysis = await generate_optimized_image_prompt(
                                        post_content=post_content,
                                        ai_api_key=openai_key,
                                        ai_model="gpt-4o"
                                    )
                                    
                                    image_prompt = ai_analysis['optimized_prompt']
                                    print(f"   [IMAGE] Visual concept: {ai_analysis.get('visual_concept', 'N/A')}")
                                    print(f"   [IMAGE] Metaphor: {ai_analysis.get('metaphor_description', 'N/A')[:80]}...")
                                    print(f"   [IMAGE] Step 3/3: Generating image with optimized prompt...")
                                except Exception as ai_error:
                                    print(f"   [WARNING] AI prompt optimization failed, using fallback: {ai_error}")
                                    # Fallback to simple prompt
                                    image_prompt = f"""PROFESSIONAL PHOTOGRAPH - PHOTOREALISTIC. Shot on DSLR, 35mm, f/1.8. 
Cinematic photo representing: {post_content[:150]}. Natural setting, dramatic lighting, shallow depth of field. 
National Geographic quality. ABSOLUTELY NO TEXT OR WORDS. Pure imagery only.""".replace('\n', ' ')
                            else:
                                print(f"   [IMAGE] No OpenAI key, using simple prompt")
                                image_prompt = f"""PROFESSIONAL PHOTOGRAPH - PHOTOREALISTIC. Shot on DSLR, 35mm, f/1.8. 
Cinematic photo representing: {post_content[:150]}. Natural setting, dramatic lighting, shallow depth of field. 
National Geographic quality. ABSOLUTELY NO TEXT OR WORDS. Pure imagery only.""".replace('\n', ' ')
                            
                            # Determine provider from model name (use raw model name with provider prefix)
                            image_provider = 'openai'  # Default
                            image_api_key = None
                            
                            if 'dall-e' in image_model_raw or 'openai' in image_model_raw:
                                # OpenAI DALL-E
                                if settings.get('openai_api_key'):
                                    image_api_key = decrypt_api_key(settings['openai_api_key'])
                                    image_provider = 'openai'
                            elif 'stable-diffusion' in image_model_raw or 'stability' in image_model_raw:
                                # Stability AI
                                if settings.get('stability_api_key'):
                                    image_api_key = decrypt_api_key(settings['stability_api_key'])
                                    image_provider = 'stability'
                                elif settings.get('openai_api_key'):  # Fallback to OpenAI
                                    image_api_key = decrypt_api_key(settings['openai_api_key'])
                                    image_provider = 'openai'
                                    image_model = 'dall-e-2'  # Use OpenAI model
                            elif 'gemini' in image_model_raw or 'imagen' in image_model_raw or 'google' in image_model_raw:
                                # Google Gemini/Imagen
                                if settings.get('google_ai_api_key'):
                                    image_api_key = decrypt_api_key(settings['google_ai_api_key'])
                                    image_provider = 'gemini'
                                elif settings.get('openai_api_key'):  # Fallback to OpenAI
                                    image_api_key = decrypt_api_key(settings['openai_api_key'])
                                    image_provider = 'openai'
                                    image_model = 'dall-e-2'  # Use OpenAI model
                            elif 'flux' in image_model_raw or 'black-forest' in image_model_raw:
                                # Flux models (typically via OpenRouter)
                                if settings.get('openrouter_api_key'):
                                    image_api_key = decrypt_api_key(settings['openrouter_api_key'])
                                    image_provider = 'openrouter'
                                elif settings.get('openai_api_key'):  # Fallback to OpenAI
                                    image_api_key = decrypt_api_key(settings['openai_api_key'])
                                    image_provider = 'openai'
                                    image_model = 'dall-e-2'  # Use OpenAI model
                            else:
                                # Default to OpenAI if no match
                                if settings.get('openai_api_key'):
                                    image_api_key = decrypt_api_key(settings['openai_api_key'])
                                    image_provider = 'openai'
                            
                            # Fall back to AI Horde if no API key
                            if not image_api_key:
                                print(f"   [IMAGE] No API key found for {image_provider}, using AI Horde (free, slow)")
                                image_provider = 'ai_horde'
                                image_model = 'stable_diffusion_xl'
                            
                            print(f"   [IMAGE] Provider: {image_provider}, Model: {image_model}")
                            
                            image_generator = ImageAdapter(
                                api_key=image_api_key,
                                provider=image_provider,
                                model=image_model
                            )
                            
                            image_result = await image_generator.generate_image(
                                prompt=image_prompt,
                                style=campaign.get('image_style', 'professional')
                            )
                            
                            if image_result and 'url' in image_result:
                                image_url = image_result['url']
                                print(f"   [IMAGE] Generated successfully!")
                            else:
                                print(f"   [IMAGE] Failed to generate")
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
                    
                    # Get all already scheduled posts for this campaign
                    org_id = post.get('org_id')
                    scheduled_posts = await db.ai_generated_posts.find({
                        "org_id": org_id,
                        "status": AIGeneratedPostStatus.APPROVED.value,
                        "scheduled_for": {"$ne": None}
                    }, {"scheduled_for": 1}).to_list(length=1000)
                    
                    occupied_times = {p['scheduled_for'] for p in scheduled_posts if 'scheduled_for' in p}
                    print(f"   Found {len(occupied_times)} occupied time slots")
                    
                    # Helper function to check if a slot is available
                    def is_slot_available(slot_time_utc):
                        # Check if this exact time is already taken
                        for occupied in occupied_times:
                            # Compare with 1-minute tolerance (in case of slight time differences)
                            if abs((occupied - slot_time_utc).total_seconds()) < 60:
                                return False
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
                    
                    # Get occupied slots
                    org_id = post.get('org_id')
                    scheduled_posts = await db.ai_generated_posts.find({
                        "org_id": org_id,
                        "status": AIGeneratedPostStatus.APPROVED.value,
                        "scheduled_for": {"$ne": None}
                    }, {"scheduled_for": 1}).to_list(length=1000)
                    
                    occupied_times = {p['scheduled_for'] for p in scheduled_posts if 'scheduled_for' in p}
                    
                    def is_slot_available_utc(slot_time_utc):
                        for occupied in occupied_times:
                            if abs((occupied - slot_time_utc).total_seconds()) < 60:
                                return False
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

