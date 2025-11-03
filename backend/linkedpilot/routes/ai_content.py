from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime
import os

from ..adapters.ai_content_generator import AIContentGenerator
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
    """Generate AI content for a campaign"""
    db = get_db()
    
    # Get campaign
    campaign = await db.campaigns.find_one({"id": request.campaign_id}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Determine provider and model from campaign's text_model
    text_model = campaign.get('text_model', 'openai/gpt-4o-mini')
    if not request.provider or not request.model:
        if '/' in text_model:
            provider_str, model_str = text_model.split('/', 1)
            request.provider = provider_str if not request.provider else request.provider
            request.model = model_str if not request.model else request.model
        else:
            request.provider = 'openai' if not request.provider else request.provider
            request.model = text_model if not request.model else request.model
    
    # Get user's API key from settings if not provided
    if not request.user_api_key:
        from cryptography.fernet import Fernet
        import base64
        import hashlib
        
        # Lookup by user_id
        settings = await db.user_settings.find_one({"user_id": request.user_id}, {"_id": 0})
        if settings:
            # Decrypt API key
            JWT_SECRET = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
            ENCRYPTION_KEY = base64.urlsafe_b64encode(hashlib.sha256(JWT_SECRET.encode()).digest())
            cipher_suite = Fernet(ENCRYPTION_KEY)
            
            # Get the appropriate API key based on provider
            key_field = None
            if request.provider == "openrouter":
                key_field = 'openrouter_api_key'
            elif request.provider == "openai":
                key_field = 'openai_api_key'
            elif request.provider == "claude" or request.provider == "anthropic":
                key_field = 'anthropic_api_key'
            elif request.provider == "gemini" or request.provider == "google":
                key_field = 'google_ai_api_key'
            
            if key_field and settings.get(key_field):
                try:
                    request.user_api_key = cipher_suite.decrypt(settings[key_field].encode()).decode()
                except:
                    pass
    
    print(f"\n{'='*60}")
    print(f"🤖 AI Content Generation Request")
    print(f"   Campaign: {campaign.get('name')}")
    print(f"   Text Model: {text_model}")
    print(f"   Provider: {request.provider}")
    print(f"   Model: {request.model or 'default'}")
    print(f"   API Key: {'Found' if request.user_api_key else 'NOT FOUND'}")
    print(f"{'='*60}\n")
    
    try:
        # Initialize AI generator
        generator = AIContentGenerator(
            api_key=request.user_api_key,
            provider=request.provider,
            model=request.model
        )
        
        # Generate content
        result = await generator.generate_post_for_campaign(campaign)
        
        # Validate quality
        validation = await generator.validate_post_quality(result['content'])
        
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
                        
                        # Use the actual post topic/angle (from content pillars) for better image search
                        # The AI generator picks a specific topic from the campaign's content pillars
                        post_topic = result.get('topic', '') or result.get('angle', '') or campaign.get('name', '')
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
                
                # If user explicitly chose AI generation, fall back to AI (future enhancement)
                elif use_ai_images:
                    print(f"   [IMAGE] AI image generation not yet implemented for manual generation")
                    print(f"   [IMAGE] Use automated campaigns for AI image generation")
                    
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
            from ..models.scheduled_post import ScheduledPost, PostStatus
            from ..models.draft import Draft, DraftStatus, DraftMode
            import uuid
            
            # Get next available time slot from campaign
            time_slots = campaign.get('posting_schedule', {}).get('time_slots', ['09:00'])
            
            # Find the next available slot (check existing scheduled posts)
            existing_posts = await db.scheduled_posts.find({
                "org_id": request.org_id,
                "status": {"$in": ["scheduled", "queued"]}
            }).to_list(length=None)
            
            # Get all scheduled times
            scheduled_times = [post.get('publish_time') for post in existing_posts if post.get('publish_time')]
            
            # Find next available slot
            from datetime import timedelta
            import pytz
            
            now = datetime.utcnow()
            next_slot_time = None
            
            # Try to find a slot in the next 7 days
            for day_offset in range(7):
                check_date = now + timedelta(days=day_offset)
                for time_slot in time_slots:
                    hours, minutes = map(int, time_slot.split(':'))
                    slot_datetime = check_date.replace(hour=hours, minute=minutes, second=0, microsecond=0)
                    
                    # Skip if in the past
                    if slot_datetime <= now:
                        continue
                    
                    # Check if this slot is already taken
                    slot_taken = any(
                        abs((datetime.fromisoformat(st.replace('Z', '+00:00')) - slot_datetime).total_seconds()) < 300
                        for st in scheduled_times if st
                    )
                    
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
            "provider_used": request.provider,
            "model_used": result.get('model')
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
async def get_approved_posts(org_id: str, include_posted: bool = False):
    """Get all approved/posted AI-generated posts
    
    Args:
        org_id: Organization ID
        include_posted: If True, also return POSTED posts (for analytics)
    """
    db = get_db()
    
    # Build query based on include_posted flag
    if include_posted:
        # For analytics - get both approved and posted
        query = {
            "org_id": org_id, 
            "status": {"$in": [AIGeneratedPostStatus.APPROVED.value, AIGeneratedPostStatus.POSTED.value]}
        }
    else:
        # For calendar - only approved (scheduled for future)
        query = {
            "org_id": org_id, 
            "status": AIGeneratedPostStatus.APPROVED.value
        }
    
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



