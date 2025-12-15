from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import datetime, timedelta
import os

from ..models.scheduled_post import ScheduledPost, PostStatus
from ..adapters.linkedin_adapter import LinkedInAdapter

router = APIRouter(prefix="/scheduled-posts", tags=["scheduled_posts"])

def get_db():
    from motor.motor_asyncio import AsyncIOMotorClient
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    return client[os.environ['DB_NAME']]

@router.post("", response_model=ScheduledPost)
async def create_scheduled_post(scheduled_post: ScheduledPost):
    """Create a new scheduled post"""
    db = get_db()
    post_dict = scheduled_post.model_dump()
    post_dict['created_at'] = datetime.utcnow().isoformat()
    post_dict['updated_at'] = datetime.utcnow().isoformat()
    post_dict['publish_time'] = post_dict['publish_time'].isoformat() if isinstance(post_dict['publish_time'], datetime) else post_dict['publish_time']
    
    await db.scheduled_posts.insert_one(post_dict)
    
    # TODO: Enqueue publish job in Celery
    
    return scheduled_post

@router.get("")
async def list_scheduled_posts(
    org_id: Optional[str] = None, 
    range_start: Optional[str] = None, 
    range_end: Optional[str] = None,
    include_cancelled: Optional[bool] = False
):
    """List scheduled posts with optional date range"""
    db = get_db()
    
    # Build query - if org_id provided, filter by it; otherwise return all (for admin)
    query = {}
    if org_id:
        query["org_id"] = org_id
    else:
        # If no org_id provided, only return posts with org_id set (exclude null/onboarding posts)
        query["org_id"] = {"$ne": None}
    
    # Exclude cancelled posts by default (for calendar view)
    # Include them when explicitly requested (for posts view)
    # But always include posted posts so they remain visible in calendar
    if not include_cancelled:
        query["status"] = {"$nin": [PostStatus.CANCELLED.value, "deleted"]}
    # Note: We don't exclude "posted" status - posted posts should remain visible
    
    # Add date range filter
    if range_start and range_end:
        # Log the query for debugging
        print(f"[SCHEDULED POSTS] Querying posts for org_id={org_id}")
        print(f"  Date range: {range_start} to {range_end}")
        
        # Normalize date strings to ensure proper comparison
        # MongoDB can compare ISO strings directly, but ensure they're in consistent format
        query["publish_time"] = {
            "$gte": range_start,
            "$lte": range_end
        }
    else:
        print(f"[SCHEDULED POSTS] Querying ALL posts for org_id={org_id} (no date range)")
    
    posts = await db.scheduled_posts.find(query, {"_id": 0}).to_list(length=500)  # EXCLUDE _id
    
    # #region agent log
    import json
    with open('/var/www/linkedin-pilot/.cursor/debug.log', 'a') as f:
        f.write(json.dumps({"location":"scheduled_posts.py:71","message":"list_scheduled_posts query executed","data":{"org_id":org_id,"query":str(query),"posts_count":len(posts),"post_ids":[p.get('id') for p in posts[:5]],"post_org_ids":[p.get('org_id') for p in posts[:5]],"post_publish_times":[p.get('publish_time') for p in posts[:5]]},"timestamp":int(datetime.utcnow().timestamp()*1000),"sessionId":"debug-session","runId":"run1","hypothesisId":"B"})+"\n")
    # #endregion
    
    print(f"[SCHEDULED POSTS] Found {len(posts)} posts matching query")
    if posts:
        for i, post in enumerate(posts[:5], 1):  # Show first 5
            print(f"  Post {i}: id={post.get('id')}, publish_time={post.get('publish_time')}, status={post.get('status')}")
    elif range_start and range_end:
        # If no posts found with date range, check if posts exist outside range
        query_without_range = {"org_id": org_id}
        if not include_cancelled:
            query_without_range["status"] = {"$nin": [PostStatus.CANCELLED.value, "deleted"]}
        all_posts = await db.scheduled_posts.find(query_without_range, {"_id": 0}).to_list(length=20)
        if all_posts:
            print(f"[SCHEDULED POSTS] WARNING: Found {len(all_posts)} posts without date filter, but 0 with date filter!")
            print(f"  Date range might be too narrow. Posts outside range:")
            for post in all_posts[:5]:
                post_time = post.get('publish_time', 'N/A')
                print(f"    - {post.get('id')}: publish_time={post_time}, status={post.get('status')}")
            
            # Extend the range to include recent posts (within last 30 days)
            from datetime import datetime, timedelta
            try:
                # Parse the range_end and extend it
                range_end_dt = datetime.fromisoformat(range_end.replace('Z', '+00:00'))
                extended_end = (range_end_dt + timedelta(days=14)).isoformat()
                
                print(f"[SCHEDULED POSTS] Extending date range to include more posts: {range_start} to {extended_end}")
                query["publish_time"] = {
                    "$gte": range_start,
                    "$lte": extended_end
                }
                posts = await db.scheduled_posts.find(query, {"_id": 0}).to_list(length=500)
                print(f"[SCHEDULED POSTS] After extending range: Found {len(posts)} posts")
            except Exception as e:
                print(f"[SCHEDULED POSTS] Error extending date range: {e}")
    
    # Get draft data for each post
    for post in posts:
        draft = await db.drafts.find_one({"id": post['draft_id']}, {"_id": 0})
        if draft:
            post['draft_preview'] = {
                "mode": draft.get('mode'),
                "content": draft.get('content', {}),
                "assets": draft.get('assets', []),
                "linkedin_author_type": draft.get('linkedin_author_type'),
                "linkedin_author_id": draft.get('linkedin_author_id'),
                "campaign_id": draft.get('campaign_id')
            }
    
    return posts

@router.get("/{post_id}")
async def get_scheduled_post(post_id: str):
    """Get scheduled post by ID"""
    db = get_db()
    post = await db.scheduled_posts.find_one({"id": post_id}, {"_id": 0})
    
    if not post:
        raise HTTPException(status_code=404, detail="Scheduled post not found")
    
    # Get full draft data
    draft = await db.drafts.find_one({"id": post['draft_id']}, {"_id": 0})
    if draft:
        post['draft'] = draft
    
    return post

@router.patch("/{post_id}")
async def update_scheduled_post(post_id: str, publish_time: Optional[str] = None, timezone: Optional[str] = None, org_id: Optional[str] = None):
    """Update scheduled post (for drag-drop reschedule or org_id update)"""
    db = get_db()
    
    update_data = {"updated_at": datetime.utcnow().isoformat()}
    
    if publish_time:
        update_data['publish_time'] = publish_time
    if timezone:
        update_data['timezone'] = timezone
    if org_id:
        update_data['org_id'] = org_id
    
    result = await db.scheduled_posts.update_one(
        {"id": post_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Scheduled post not found")
    
    # TODO: Re-enqueue job with new time
    
    return {"post_id": post_id, "updated": True}

@router.put("/{post_id}")
async def update_scheduled_post_full(post_id: str, update_data: dict):
    """Update scheduled post with full object (for org_id updates during onboarding)"""
    import json
    db = get_db()
    
    # #region agent log
    with open('/var/www/linkedin-pilot/.cursor/debug.log', 'a') as f:
        f.write(json.dumps({"location":"scheduled_posts.py:164","message":"PUT update_scheduled_post_full called","data":{"post_id":post_id,"update_data_keys":list(update_data.keys()),"has_org_id":'org_id' in update_data,"new_org_id":update_data.get('org_id')},"timestamp":int(datetime.utcnow().timestamp()*1000),"sessionId":"debug-session","runId":"run1","hypothesisId":"A"})+"\n")
    # #endregion
    
    # Check if post exists
    existing_post = await db.scheduled_posts.find_one({"id": post_id}, {"_id": 0})
    if not existing_post:
        raise HTTPException(status_code=404, detail="Scheduled post not found")
    
    # #region agent log
    with open('/var/www/linkedin-pilot/.cursor/debug.log', 'a') as f:
        f.write(json.dumps({"location":"scheduled_posts.py:171","message":"Existing post found","data":{"post_id":post_id,"existing_org_id":existing_post.get('org_id'),"existing_status":existing_post.get('status'),"existing_publish_time":existing_post.get('publish_time')},"timestamp":int(datetime.utcnow().timestamp()*1000),"sessionId":"debug-session","runId":"run1","hypothesisId":"A"})+"\n")
    # #endregion
    
    # Build update dict - only update fields that are provided
    update_fields = {"updated_at": datetime.utcnow().isoformat()}
    
    # Update org_id if provided
    # Handle both null and actual org_id values
    if 'org_id' in update_data:
        new_org_id = update_data['org_id']
        # Only update if it's different from existing (avoid unnecessary updates)
        if existing_post.get('org_id') != new_org_id:
            update_fields['org_id'] = new_org_id
        else:
            # org_id already correct, but we still update updated_at
            pass
    
    # Update other fields if provided (preserve existing if not provided)
    for field in ['publish_time', 'timezone', 'status', 'draft_id', 'require_approval']:
        if field in update_data:
            if field == 'publish_time':
                # Handle both datetime and string formats
                if isinstance(update_data[field], datetime):
                    update_fields[field] = update_data[field].isoformat()
                elif isinstance(update_data[field], str):
                    update_fields[field] = update_data[field]
            else:
                update_fields[field] = update_data[field]
    
    # Preserve created_at from existing post
    if 'created_at' in existing_post:
        update_fields['created_at'] = existing_post['created_at']
    
    result = await db.scheduled_posts.update_one(
        {"id": post_id},
        {"$set": update_fields}
    )
    
    if result.modified_count == 0:
        # Still return success if org_id was already set correctly
        if 'org_id' in update_fields and existing_post.get('org_id') == update_fields['org_id']:
            return {"post_id": post_id, "updated": True, "message": "No changes needed"}
        raise HTTPException(status_code=400, detail="Failed to update scheduled post or no changes made")
    
    print(f"[SCHEDULED POST] Updated {post_id} with org_id: {update_fields.get('org_id')}")
    
    # Return updated post
    updated_post = await db.scheduled_posts.find_one({"id": post_id}, {"_id": 0})
    return updated_post

@router.post("/{post_id}/publish-now")
async def publish_now(post_id: str):
    """Publish post immediately to LinkedIn"""
    db = get_db()
    
    print(f"\n{'='*60}")
    print(f"[API] PUBLISH NOW called for post_id: {post_id}")
    
    # Get scheduled post
    scheduled_post = await db.scheduled_posts.find_one({"id": post_id}, {"_id": 0})
    if not scheduled_post:
        print(f"[ERROR] Scheduled post not found: {post_id}")
        raise HTTPException(status_code=404, detail="Scheduled post not found")
    
    print(f"[SUCCESS] Found scheduled post: {scheduled_post.get('id')}")
    
    # Get draft content
    draft = await db.drafts.find_one({"id": scheduled_post['draft_id']}, {"_id": 0})
    if not draft:
        print(f"[ERROR] Draft not found: {scheduled_post['draft_id']}")
        raise HTTPException(status_code=404, detail="Draft not found")
    
    print(f"[SUCCESS] Found draft: {draft.get('id')}")
    print(f"   Draft content: {draft.get('content', {}).get('body', '')[:100]}...")
    
    try:
        # Get organization info
        org = await db.organizations.find_one({"id": scheduled_post['org_id']}, {"_id": 0})
        if not org:
            print(f"[ERROR] Organization not found: {scheduled_post['org_id']}")
            raise HTTPException(status_code=404, detail="Organization not found")
        
        print(f"[SUCCESS] Found organization: {org.get('id')}")
        
        # Get LinkedIn credentials from USER settings (not organization)
        user_id = draft.get('author_id') or scheduled_post.get('created_by')
        if not user_id:
            print(f"[ERROR] No user_id found in draft or scheduled post!")
            raise HTTPException(status_code=400, detail="User ID not found")
        
        print(f"   Looking up LinkedIn connection for user: {user_id}")
        user_settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})
        
        if not user_settings:
            print(f"[ERROR] User settings not found for user: {user_id}")
            raise HTTPException(status_code=400, detail="LinkedIn account not connected. Please connect in Settings.")
        
        # Check if LinkedIn is connected in USER settings
        has_profile = bool(user_settings.get('linkedin_profile'))
        has_token = bool(user_settings.get('linkedin_access_token'))
        print(f"   LinkedIn profile exists: {has_profile}")
        print(f"   LinkedIn token exists: {has_token}")
        
        if not has_profile or not has_token:
            print(f"[ERROR] LinkedIn not connected!")
            raise HTTPException(status_code=400, detail="LinkedIn account not connected. Please connect in Settings.")
        
        # Initialize LinkedIn adapter
        # IMPORTANT: Pass the user's LinkedIn credentials, not env vars!
        # This ensures we use the real credentials from Settings, not mock mode
        linkedin = LinkedInAdapter(
            client_id="user_provided",  # Dummy value to disable mock mode
            client_secret="user_provided"  # We already have the access_token
        )
        
        # Override mock_mode to ensure we use real API
        linkedin.mock_mode = False
        
        # Determine author type and ID from draft
        author_type = draft.get('linkedin_author_type', 'personal')
        is_organization = author_type in ['organization', 'company']
        
        if is_organization:
            # Use organization/company ID from draft
            author_id = draft.get('linkedin_author_id')
            if not author_id:
                print(f"[ERROR] No organization/company ID in draft!")
                raise HTTPException(status_code=400, detail="Draft missing organization/company ID")
        else:
            # Use personal profile ID from user_settings
            author_id = user_settings['linkedin_profile'].get('sub')
        
        print(f"   Author type: {author_type}")
        print(f"   Author ID: {author_id}")
        print(f"[API] Calling LinkedIn API to create post...")
        
        # Handle asset uploads (images, documents, carousel)
        media_urns = []
        media_category = None
        
        if draft.get('assets') and len(draft['assets']) > 0:
            print(f"   Found {len(draft['assets'])} assets to upload")
            
            for asset in draft['assets']:
                asset_type = asset.get('type')
                asset_url = asset.get('url')
                
                if not asset_url:
                    continue
                
                try:
                    if asset_type == 'image':
                        print(f"   Uploading image: {asset_url[:50]}...")
                        print(f"   Is Organization: {is_organization}")
                        media_urn = await linkedin.upload_media(
                            access_token=user_settings['linkedin_access_token'],
                            org_id=author_id,
                            media_url=asset_url,
                            is_organization=is_organization
                        )
                        media_urns.append(media_urn)
                        print(f"   [SUCCESS] Image uploaded: {media_urn}")
                        # Give LinkedIn more time to process the media asset
                        # LinkedIn needs time to process and index the media before it can be used
                        import asyncio
                        print(f"   [WAIT] Waiting 5 seconds for LinkedIn to process media...")
                        await asyncio.sleep(5)
                        
                    elif asset_type == 'document' or asset_type == 'pdf':
                        print(f"   Uploading document: {asset_url[:50]}...")
                        media_category = "ARTICLE"
                        doc_urn = await linkedin.upload_document(
                            access_token=user_settings['linkedin_access_token'],
                            document_url=asset_url,
                            author_id=author_id,
                            title=draft['content'].get('title', 'Document')
                        )
                        media_urns.append(doc_urn)
                        print(f"   [SUCCESS] Document uploaded: {doc_urn}")
                        
                except Exception as e:
                    print(f"   [ERROR] Failed to upload {asset_type}: {e}")
                    import traceback
                    traceback.print_exc()
                    # Continue without this asset rather than failing completely
        
        # Determine media category for carousel (multiple images)
        if len(media_urns) > 1 and not media_category:
            media_category = "IMAGE"  # Carousel
            print(f"   📸 Carousel detected: {len(media_urns)} images")
        
        # Append hashtags to content if they exist
        content_to_post = draft['content'].copy()
        hashtags = draft.get('content', {}).get('hashtags', [])
        if hashtags and isinstance(hashtags, list) and len(hashtags) > 0:
            hashtags_str = ' '.join(hashtags)
            content_body = content_to_post.get('body', '')
            content_to_post['body'] = f"{content_body}\n\n{hashtags_str}"
        
        # Publish to LinkedIn
        result = await linkedin.create_post(
            access_token=user_settings['linkedin_access_token'],
            author_id=author_id,
            content=content_to_post,
            media_urns=media_urns,
            is_organization=is_organization,
            media_category=media_category
        )
        
        # Check if posting was successful
        if not result or not result.get('id'):
            print(f"[FAILED] LinkedIn posting failed - no post ID returned")
            print(f"   Result: {result}")
            await db.scheduled_posts.update_one(
                {"id": post_id},
                {"$set": {
                    "status": PostStatus.FAILED.value,
                    "updated_at": datetime.utcnow().isoformat()
                }}
            )
            raise HTTPException(status_code=500, detail="Failed to post to LinkedIn")
        
        print(f"[SUCCESS] LinkedIn API SUCCESS!")
        print(f"   Post ID: {result.get('id')}")
        print(f"   Post URL: {result.get('url')}")
        
        # Update scheduled post status
        await db.scheduled_posts.update_one(
            {"id": post_id},
            {"$set": {
                "status": PostStatus.POSTED.value,
                "publish_time": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
                "linkedin_post_id": result.get('id'),
                "platform_url": result.get('url')
            }}
        )
        
        print(f"[SUCCESS] Updated scheduled post status to POSTED")
        
        # Create a post record
        post_record = {
            "id": f"post_{datetime.now().timestamp()}",
            "scheduled_post_id": post_id,
            "org_id": scheduled_post['org_id'],
            "platform_post_id": result.get('id'),
            "platform_url": result.get('url'),
            "posted_at": datetime.utcnow().isoformat(),
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        await db.posts.insert_one(post_record)
        
        print(f"[SUCCESS] Created post record in database")
        print(f"{'='*60}\n")
        
        return {
            "post_id": post_id, 
            "status": "posted",
            "linkedin_post_id": result.get('id'),
            "linkedin_url": result.get('url')
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] ERROR publishing post: {e}")
        print(f"   Error type: {type(e).__name__}")
        print(f"   Error details: {str(e)}")
        import traceback
        print(f"\n[INFO] Full traceback:")
        traceback.print_exc()
        
        # Update status to failed
        await db.scheduled_posts.update_one(
            {"id": post_id},
            {"$set": {
                "status": PostStatus.FAILED.value,
                "error_message": str(e),
                "updated_at": datetime.utcnow().isoformat()
            }}
        )
        print(f"{'='*60}\n")
        
        # Return more detailed error message
        error_detail = f"Failed to publish: {type(e).__name__}: {str(e)}"
        raise HTTPException(status_code=500, detail=error_detail)

@router.patch("/{post_id}/cancel")
async def cancel_scheduled_post(post_id: str):
    """Cancel a scheduled post (changes status to cancelled)"""
    db = get_db()
    
    result = await db.scheduled_posts.update_one(
        {"id": post_id},
        {"$set": {
            "status": PostStatus.CANCELLED.value,
            "updated_at": datetime.utcnow().isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Scheduled post not found")
    
    return {"success": True, "message": "Scheduled post cancelled", "post_id": post_id}


@router.delete("/{post_id}")
async def delete_scheduled_post(post_id: str):
    """Delete a scheduled post"""
    db = get_db()
    
    # Check if post exists
    post = await db.scheduled_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Scheduled post not found")
    
    # Delete the scheduled post
    result = await db.scheduled_posts.delete_one({"id": post_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Failed to delete scheduled post")
    
    return {"success": True, "message": "Scheduled post deleted successfully", "post_id": post_id}
