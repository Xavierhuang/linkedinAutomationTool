import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timedelta

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def check_fantasy_football_posts():
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ.get('DB_NAME', 'linkedpilot')]
    
    print("\n" + "="*80)
    print("CHECKING FANTASY FOOTBALL WEBSITE POSTS")
    print("="*80 + "\n")
    
    # Find organizations with "fantasy" in the name (case insensitive)
    orgs = await db.organizations.find({
        "$or": [
            {"name": {"$regex": "fantasy", "$options": "i"}},
            {"title": {"$regex": "fantasy", "$options": "i"}}
        ]
    }, {"_id": 0, "id": 1, "name": 1, "title": 1}).to_list(length=10)
    
    print(f"Found {len(orgs)} organization(s) with 'fantasy' in name:\n")
    
    if not orgs:
        print("No organizations found with 'fantasy' in name.")
        print("Checking all recent organizations...\n")
        # Get all recent orgs
        orgs = await db.organizations.find({}, {"_id": 0, "id": 1, "name": 1, "title": 1}).sort("created_at", -1).to_list(length=5)
        print(f"Showing {len(orgs)} most recent organizations:\n")
    
    for org in orgs:
        org_id = org.get('id')
        org_name = org.get('name') or org.get('title') or 'Unknown'
        print(f"Organization: {org_name}")
        print(f"  Org ID: {org_id}")
        
        # Get all scheduled posts for this org
        posts = await db.scheduled_posts.find(
            {"org_id": org_id},
            {"_id": 0}
        ).sort("created_at", -1).to_list(length=20)
        
        print(f"  Total scheduled posts: {len(posts)}\n")
        
        if posts:
            # Get current week range (like CalendarView does)
            now = datetime.utcnow()
            # Get start of current week (Monday)
            days_since_monday = now.weekday()
            week_start = now - timedelta(days=days_since_monday)
            week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
            week_end = week_start + timedelta(days=7)
            
            print(f"  Current week range (UTC):")
            print(f"    Start: {week_start.isoformat()}")
            print(f"    End: {week_end.isoformat()}\n")
            
            posts_in_range = []
            posts_out_of_range = []
            
            for i, post in enumerate(posts, 1):
                publish_time_str = post.get('publish_time')
                status = post.get('status', 'unknown')
                draft_id = post.get('draft_id', 'N/A')
                created_at = post.get('created_at', 'N/A')
                
                # Parse publish_time
                try:
                    if isinstance(publish_time_str, str):
                        publish_time = datetime.fromisoformat(publish_time_str.replace('Z', '+00:00'))
                        if publish_time.tzinfo:
                            publish_time = publish_time.replace(tzinfo=None)
                    else:
                        publish_time = publish_time_str
                    
                    # Check if in range
                    in_range = week_start <= publish_time <= week_end
                    
                    post_info = {
                        'post': post,
                        'publish_time': publish_time,
                        'in_range': in_range
                    }
                    
                    if in_range:
                        posts_in_range.append(post_info)
                    else:
                        posts_out_of_range.append(post_info)
                    
                except Exception as e:
                    print(f"    [ERROR] Could not parse publish_time: {publish_time_str} - {e}")
                    continue
            
            print(f"  Posts IN current week range: {len(posts_in_range)}")
            print(f"  Posts OUT of current week range: {len(posts_out_of_range)}\n")
            
            if posts_in_range:
                print("  === POSTS IN CURRENT WEEK (SHOULD APPEAR IN CALENDAR) ===")
                for i, post_info in enumerate(posts_in_range, 1):
                    post = post_info['post']
                    print(f"\n  Post {i}:")
                    print(f"    ID: {post.get('id')}")
                    print(f"    Status: {post.get('status')}")
                    print(f"    Publish Time: {post.get('publish_time')}")
                    print(f"    Draft ID: {post.get('draft_id')}")
                    print(f"    Created: {post.get('created_at')}")
                    
                    # Check if draft exists
                    draft = await db.drafts.find_one({"id": post.get('draft_id')}, {"_id": 0})
                    if draft:
                        content_preview = draft.get('content', {}).get('body', '')[:100]
                        # Remove emojis and special characters for Windows console
                        content_preview = content_preview.encode('ascii', 'ignore').decode('ascii')
                        print(f"    Draft Content Preview: {content_preview}...")
                    else:
                        print(f"    [WARNING] Draft not found for draft_id: {post.get('draft_id')}")
            
            if posts_out_of_range:
                print(f"\n  === POSTS OUT OF CURRENT WEEK ({len(posts_out_of_range)} total) ===")
                for i, post_info in enumerate(posts_out_of_range[:5], 1):  # Show first 5
                    post = post_info['post']
                    print(f"\n  Post {i}:")
                    print(f"    ID: {post.get('id')}")
                    print(f"    Status: {post.get('status')}")
                    print(f"    Publish Time: {post.get('publish_time')}")
                    print(f"    Created: {post.get('created_at')}")
        else:
            print("  [WARNING] No scheduled posts found for this organization!\n")
        
        print("\n" + "-"*80 + "\n")
    
    # Also check for very recent posts (last 30 minutes) across all orgs
    print("\n" + "="*80)
    print("CHECKING ALL VERY RECENT POSTS (LAST 30 MINUTES)")
    print("="*80 + "\n")
    
    thirty_min_ago = datetime.utcnow() - timedelta(minutes=30)
    recent_posts = await db.scheduled_posts.find(
        {"created_at": {"$gte": thirty_min_ago.isoformat()}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=20)
    
    print(f"Found {len(recent_posts)} posts created in last 30 minutes:\n")
    
    for i, post in enumerate(recent_posts, 1):
        org_id = post.get('org_id', 'N/A')
        org = await db.organizations.find_one({"id": org_id}, {"_id": 0, "name": 1, "title": 1})
        org_name = (org.get('name') or org.get('title') or 'Unknown') if org else 'Unknown'
        
        print(f"Post {i}:")
        print(f"  Org: {org_name} ({org_id})")
        print(f"  Post ID: {post.get('id')}")
        print(f"  Status: {post.get('status')}")
        print(f"  Publish Time: {post.get('publish_time')}")
        print(f"  Created: {post.get('created_at')}")
        print()
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_fantasy_football_posts())

