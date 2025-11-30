from fastapi import APIRouter, HTTPException
from typing import List
from datetime import datetime
import os

from ..models.post import Post
from ..adapters.linkedin_adapter import LinkedInAdapter

router = APIRouter(prefix="/posts", tags=["posts"])

def get_db():
    from motor.motor_asyncio import AsyncIOMotorClient
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    return client[os.environ['DB_NAME']]

@router.post("/publish")
async def publish_post(post: Post):
    """Publish a post to LinkedIn immediately"""
    db = get_db()
    
    try:
        # Get organization to access LinkedIn credentials
        org = await db.organizations.find_one({"id": post.org_id}, {"_id": 0})
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        # Check if LinkedIn is connected
        if not org.get('linkedin_profile') or not org.get('linkedin_access_token'):
            raise HTTPException(status_code=400, detail="LinkedIn account not connected. Please connect in Settings.")
        
        # Initialize LinkedIn adapter - pass dummy credentials to disable mock mode
        linkedin = LinkedInAdapter(client_id="from_user", client_secret="from_user")
        
        # Prepare content
        body_text = ''
        try:
            body_text = post.content if isinstance(post.content, str) else (post.content or {}).get('body', '')
        except Exception:
            body_text = ''
        content = {"body": body_text}
        
        # Get author ID (person or organization)
        linkedin_profile = org.get('linkedin_profile', {})
        author_id = org.get('linkedin_person_urn') or linkedin_profile.get('sub') or org.get('linkedin_sub')
        is_organization = post.posting_as_organization if hasattr(post, 'posting_as_organization') else False
        
        if is_organization and org.get('linkedin_organization_id'):
            author_id = org.get('linkedin_organization_id')
        
        # Collect media URLs if provided (from metadata or content). If none, try latest draft assets.
        media_urls = []
        try:
            if isinstance(post.metadata, dict):
                if post.metadata.get('image_url'):
                    media_urls.append(post.metadata['image_url'])
                # support array of images
                if isinstance(post.metadata.get('image_urls'), list):
                    media_urls.extend([u for u in post.metadata['image_urls'] if isinstance(u, str)])
            if not media_urls and not isinstance(post.content, str) and isinstance(post.content, dict):
                if post.content.get('image_url'):
                    media_urls.append(post.content['image_url'])
            # Fallback: look up latest draft assets for this scheduled_post_id
            if not media_urls and getattr(post, 'scheduled_post_id', None):
                draft = await db.drafts.find_one({"id": post.scheduled_post_id}, {"_id": 0, "assets": 1})
                if draft and isinstance(draft.get('assets'), list):
                    for asset in draft['assets']:
                        if asset.get('type') == 'image' and asset.get('url'):
                            media_urls.append(asset['url'])
            # Second fallback: latest draft for org
            if not media_urls:
                latest_draft = await db.drafts.find({"org_id": post.org_id}).sort("updated_at", -1).limit(1).to_list(length=1)
                if latest_draft:
                    assets = latest_draft[0].get('assets', [])
                    for asset in assets:
                        if asset.get('type') == 'image' and asset.get('url'):
                            media_urls.append(asset['url'])
        except Exception:
            pass

        # Upload media and get URNs
        media_urns = []
        if media_urls:
            for url in media_urls:
                try:
                    urn = await linkedin.upload_media(
                        access_token=org['linkedin_access_token'],
                        org_id=author_id,
                        media_url=url,
                        media_type="image",
                        is_organization=is_organization
                    )
                    if urn:
                        media_urns.append(urn)
                except Exception as e:
                    print(f"[WARN] Media upload failed for {url}: {e}")

        # Publish to LinkedIn (attach media if available)
        result = await linkedin.create_post(
            access_token=org['linkedin_access_token'],
            author_id=author_id,
            content=content,
            media_urns=media_urns if media_urns else None,
            is_organization=is_organization
        )
        
        # Save post to database
        post_dict = post.model_dump()
        post_dict['linkedin_post_id'] = result.get('id')
        post_dict['posted_at'] = datetime.utcnow().isoformat()
        post_dict['created_at'] = datetime.utcnow().isoformat()
        post_dict['updated_at'] = datetime.utcnow().isoformat()
        
        await db.posts.insert_one(post_dict)
        
        return {"message": "Post published successfully", "post_id": post.id, "linkedin_post_id": result.get('id')}
        
    except Exception as e:
        print(f"Error publishing post: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to publish post: {str(e)}")

@router.get("")
async def list_posts(org_id: str):
    """List all published posts for an organization"""
    db = get_db()
    posts = await db.posts.find({"org_id": org_id}, {"_id": 0}).sort("posted_at", -1).to_list(length=100)
    
    print(f"[POSTS] Fetching posts for org: {org_id}")
    print(f"   Found {len(posts)} posts")
    
    return posts

@router.get("/{post_id}")
async def get_post(post_id: str):
    """Get post by ID with analytics"""
    db = get_db()
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Get analytics events
    analytics = await db.analytics_events.find({"post_id": post_id}).to_list(length=1000)
    post['analytics'] = analytics
    
    return post

@router.post("/{post_id}/sync-analytics")
async def sync_post_analytics(post_id: str):
    """Fetch and sync analytics from LinkedIn for a specific post"""
    db = get_db()
    
    try:
        # Get post from database
        post = await db.posts.find_one({"id": post_id}, {"_id": 0})
        if not post:
            # Try scheduled_posts collection
            post = await db.scheduled_posts.find_one({"id": post_id}, {"_id": 0})
            if not post or post.get('status') != 'published':
                raise HTTPException(status_code=404, detail="Published post not found")
        
        linkedin_post_id = post.get('linkedin_post_id')
        if not linkedin_post_id:
            raise HTTPException(status_code=400, detail="Post has no LinkedIn ID")
        
        # Get organization for access token
        org = await db.organizations.find_one({"id": post['org_id']}, {"_id": 0})
        if not org or not org.get('linkedin_access_token'):
            raise HTTPException(status_code=400, detail="LinkedIn not connected")
        
        # Fetch analytics from LinkedIn
        linkedin = LinkedInAdapter(client_id="from_user", client_secret="from_user")
        analytics = await linkedin.get_post_analytics(
            access_token=org['linkedin_access_token'],
            post_urn=linkedin_post_id
        )
        
        # Update post with analytics
        update_data = {
            "impressions": analytics.get('impressions', 0),
            "reactions": analytics.get('reactions', 0),
            "comments": analytics.get('comments', 0),
            "shares": analytics.get('shares', 0),
            "clicks": analytics.get('clicks', 0),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Update in posts collection
        await db.posts.update_one({"id": post_id}, {"$set": update_data})
        
        # Also update in scheduled_posts if it exists there
        await db.scheduled_posts.update_one({"id": post_id}, {"$set": update_data})
        
        print(f"[ANALYTICS] Synced analytics for post {post_id}: {analytics}")
        
        return {"message": "Analytics synced successfully", "analytics": update_data}
    
    except Exception as e:
        print(f"[ERROR] Failed to sync analytics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to sync analytics: {str(e)}")

@router.post("/sync-all-analytics")
async def sync_all_analytics(org_id: str):
    """Sync analytics for all published posts"""
    db = get_db()
    
    try:
        # Get organization
        org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
        if not org or not org.get('linkedin_access_token'):
            raise HTTPException(status_code=400, detail="LinkedIn not connected")
        
        # Get all published posts from all collections
        
        # 1. Posts collection (manual posts)
        posts_query = {"org_id": org_id, "linkedin_post_id": {"$exists": True, "$ne": None}}
        posts = await db.posts.find(posts_query, {"_id": 0}).to_list(length=500)
        
        # 2. Scheduled_posts collection (published manual posts)
        scheduled_posts = await db.scheduled_posts.find({
            "org_id": org_id,
            "status": "published",
            "linkedin_post_id": {"$exists": True, "$ne": None}
        }, {"_id": 0}).to_list(length=500)
        
        # 3. AI_generated_posts collection (posted AI posts)
        ai_posts = await db.ai_generated_posts.find({
            "org_id": org_id,
            "status": "posted",
            "linkedin_post_id": {"$exists": True, "$ne": None}
        }, {"_id": 0}).to_list(length=500)
        
        all_posts = posts + scheduled_posts + ai_posts
        
        print(f"\n[SYNC] Found posts to sync:")
        print(f"   Posts collection: {len(posts)}")
        print(f"   Scheduled_posts: {len(scheduled_posts)}")
        print(f"   AI_generated_posts: {len(ai_posts)}")
        print(f"   Total: {len(all_posts)}")
        
        if not all_posts:
            return {"message": "No published posts found", "synced": 0, "total": 0}
        
        linkedin = LinkedInAdapter(client_id="from_user", client_secret="from_user")
        synced_count = 0
        
        # Get organization ID for analytics (if available)
        org_linkedin_id = org.get('linkedin_organization_id') or org.get('linkedin_org_id')
        
        for post in all_posts:
            try:
                linkedin_post_id = post.get('linkedin_post_id')
                if not linkedin_post_id:
                    continue
                
                # Fetch analytics from LinkedIn with organization_id for better accuracy
                analytics = await linkedin.get_post_analytics(
                    access_token=org['linkedin_access_token'],
                    post_urn=linkedin_post_id,
                    organization_id=org_linkedin_id
                )
                
                # Update post with analytics
                update_data = {
                    "impressions": analytics.get('impressions', 0),
                    "reactions": analytics.get('reactions', 0),
                    "comments": analytics.get('comments', 0),
                    "shares": analytics.get('shares', 0),
                    "clicks": analytics.get('clicks', 0),
                    "updated_at": datetime.utcnow().isoformat()
                }
                
                # Update in appropriate collection
                if post in posts:
                    await db.posts.update_one({"id": post['id']}, {"$set": update_data})
                    print(f"[ANALYTICS] Synced post (posts): {post['id'][:30]}...")
                elif post in scheduled_posts:
                    await db.scheduled_posts.update_one({"id": post['id']}, {"$set": update_data})
                    print(f"[ANALYTICS] Synced post (scheduled): {post['id'][:30]}...")
                else:
                    # AI generated post
                    await db.ai_generated_posts.update_one({"id": post['id']}, {"$set": update_data})
                    print(f"[ANALYTICS] Synced post (AI): {post['id'][:30]}...")
                
                synced_count += 1
                
            except Exception as e:
                print(f"[WARNING] Failed to sync post {post.get('id')}: {e}")
                continue
        
        print(f"[ANALYTICS] Synced analytics for {synced_count}/{len(all_posts)} posts")
        
        return {"message": f"Analytics synced for {synced_count} posts", "synced": synced_count, "total": len(all_posts)}
    
    except Exception as e:
        print(f"[ERROR] Failed to sync all analytics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to sync analytics: {str(e)}")

@router.post("/import-from-linkedin")
async def import_posts_from_linkedin(org_id: str):
    """Import all posts from LinkedIn API and save to database with analytics"""
    db = get_db()
    
    try:
        print(f"\n[IMPORT] Starting LinkedIn posts import for org: {org_id}")
        
        # Get organization
        org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        # Check LinkedIn connection - try organization first, then user level
        linkedin_access_token = org.get('linkedin_access_token')
        linkedin_profile = org.get('linkedin_profile', {})
        user_id = org.get('created_by')
        user_settings = None
        
        # If not at org level, check user settings
        if not linkedin_access_token and user_id:
            user_settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})
            if user_settings:
                linkedin_access_token = user_settings.get('linkedin_access_token')
                if not linkedin_profile and user_settings.get('linkedin_profile'):
                    linkedin_profile = user_settings.get('linkedin_profile', {})
        
        if not linkedin_access_token:
            raise HTTPException(status_code=400, detail="LinkedIn not connected. Please connect LinkedIn in Settings.")
        
        # Get author ID - check org first, then user settings
        author_id = org.get('linkedin_person_urn') or linkedin_profile.get('sub') or org.get('linkedin_sub')
        
        # If still no author_id, try user settings
        if not author_id and user_settings:
            user_linkedin_profile = user_settings.get('linkedin_profile', {})
            author_id = user_linkedin_profile.get('sub')
        
        if not author_id:
            raise HTTPException(status_code=400, detail="No LinkedIn author ID found. Please reconnect LinkedIn in Settings.")
        
        # Initialize LinkedIn adapter
        linkedin = LinkedInAdapter(client_id="from_user", client_secret="from_user")
        
        # Fetch all posts from LinkedIn
        linkedin_posts = await linkedin.get_all_user_posts(
            access_token=linkedin_access_token,
            author_id=author_id,
            count=50
        )
        
        print(f"[IMPORT] Found {len(linkedin_posts)} posts from LinkedIn")
        
        imported_count = 0
        updated_count = 0
        
        for linkedin_post in linkedin_posts:
            try:
                # Extract post data
                post_id = linkedin_post.get('id', '')
                if not post_id:
                    continue
                
                # Extract content
                commentary = linkedin_post.get('commentary', '')
                created_time = linkedin_post.get('createdAt') or linkedin_post.get('created', {}).get('time')
                
                # Check if post already exists in database
                existing_post = await db.posts.find_one({"linkedin_post_id": post_id}, {"_id": 0})
                
                if existing_post:
                    print(f"   Post {post_id[:30]} already exists, updating...")
                    updated_count += 1
                else:
                    print(f"   Importing new post: {post_id[:30]}...")
                    imported_count += 1
                
                # Fetch analytics for this post
                analytics = await linkedin.get_post_analytics(
                    access_token=linkedin_access_token,
                    post_urn=post_id
                )
                
                # Prepare post data
                post_data = {
                    "id": existing_post.get('id') if existing_post else f"imported_{datetime.utcnow().timestamp()}",
                    "org_id": org_id,
                    "linkedin_post_id": post_id,
                    "content": commentary,
                    "posted_at": created_time,
                    "platform_url": f"https://www.linkedin.com/feed/update/{post_id}",
                    "impressions": analytics.get('impressions', 0),
                    "reactions": analytics.get('reactions', 0),
                    "comments": analytics.get('comments', 0),
                    "shares": analytics.get('shares', 0),
                    "clicks": analytics.get('clicks', 0),
                    "updated_at": datetime.utcnow().isoformat(),
                    "source": "imported"
                }
                
                if not existing_post:
                    post_data["created_at"] = datetime.utcnow().isoformat()
                
                # Upsert post
                await db.posts.update_one(
                    {"linkedin_post_id": post_id},
                    {"$set": post_data},
                    upsert=True
                )
                
            except Exception as e:
                print(f"   [WARNING] Failed to import post: {e}")
                continue
        
        print(f"[IMPORT] Complete! Imported: {imported_count}, Updated: {updated_count}")
        
        return {
            "message": f"Successfully imported {imported_count} new posts and updated {updated_count} existing posts",
            "imported": imported_count,
            "updated": updated_count,
            "total": len(linkedin_posts)
        }
    
    except Exception as e:
        print(f"[ERROR] Import failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to import posts: {str(e)}")

@router.get("/{post_id}/comments")
async def get_post_comments(post_id: str):
    """Get comments for a LinkedIn post"""
    db = get_db()
    
    try:
        # Get post from database
        post = await db.posts.find_one({"id": post_id}, {"_id": 0})
        if not post:
            # Try AI generated posts
            post = await db.ai_generated_posts.find_one({"id": post_id}, {"_id": 0})
        if not post:
            # Try scheduled posts
            post = await db.scheduled_posts.find_one({"id": post_id}, {"_id": 0})
        
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        linkedin_post_id = post.get('linkedin_post_id')
        if not linkedin_post_id:
            return {"comments": [], "message": "No LinkedIn ID for this post"}
        
        # Get organization for access token
        org = await db.organizations.find_one({"id": post['org_id']}, {"_id": 0})
        if not org or not org.get('linkedin_access_token'):
            raise HTTPException(status_code=400, detail="LinkedIn not connected")
        
        # Fetch comments from LinkedIn
        linkedin = LinkedInAdapter(client_id="from_user", client_secret="from_user")
        comments = await linkedin.get_post_comments(
            access_token=org['linkedin_access_token'],
            post_urn=linkedin_post_id
        )
        
        return {"comments": comments, "post_id": post_id, "linkedin_post_id": linkedin_post_id}
    
    except Exception as e:
        print(f"[ERROR] Failed to fetch comments: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch comments: {str(e)}")

@router.post("/{post_id}/reply")
async def reply_to_post(post_id: str, comment_text: str):
    """Reply to a LinkedIn post"""
    db = get_db()
    
    try:
        # Get post from database
        post = await db.posts.find_one({"id": post_id}, {"_id": 0})
        if not post:
            post = await db.ai_generated_posts.find_one({"id": post_id}, {"_id": 0})
        if not post:
            post = await db.scheduled_posts.find_one({"id": post_id}, {"_id": 0})
        
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        linkedin_post_id = post.get('linkedin_post_id')
        if not linkedin_post_id:
            raise HTTPException(status_code=400, detail="No LinkedIn ID for this post")
        
        # Get organization for access token
        org = await db.organizations.find_one({"id": post['org_id']}, {"_id": 0})
        if not org or not org.get('linkedin_access_token'):
            raise HTTPException(status_code=400, detail="LinkedIn not connected")
        
        # Post comment to LinkedIn
        linkedin = LinkedInAdapter(client_id="from_user", client_secret="from_user")
        result = await linkedin.post_comment_reply(
            access_token=org['linkedin_access_token'],
            post_urn=linkedin_post_id,
            comment_text=comment_text
        )
        
        if result.get('error'):
            raise HTTPException(status_code=500, detail=result['error'])
        
        return {"message": "Comment posted successfully", "comment": result}
    
    except Exception as e:
        print(f"[ERROR] Failed to post comment: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to post comment: {str(e)}")


@router.delete("/{post_id}")
async def delete_post(post_id: str):
    """Delete a post"""
    db = get_db()
    
    # Check if post exists
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Delete the post
    result = await db.posts.delete_one({"id": post_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Failed to delete post")
    
    return {"success": True, "message": "Post deleted successfully", "post_id": post_id}
