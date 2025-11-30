import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timedelta

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def check_very_recent_posts():
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ.get('DB_NAME', 'linkedpilot')]
    
    print("\n" + "="*60)
    print("CHECKING POSTS FROM LAST 2 HOURS")
    print("="*60 + "\n")
    
    # Get current time
    now = datetime.utcnow()
    two_hours_ago = now - timedelta(hours=2)
    
    print(f"Current time (UTC): {now.isoformat()}")
    print(f"Looking for posts created after: {two_hours_ago.isoformat()}\n")
    
    # Find posts created in last 2 hours
    recent_posts = await db.scheduled_posts.find(
        {"created_at": {"$gte": two_hours_ago.isoformat()}},
        {"_id": 0}
    ).to_list(length=50)
    
    print(f"Posts created in last 2 hours: {len(recent_posts)}\n")
    
    if recent_posts:
        for i, post in enumerate(recent_posts, 1):
            print(f"Post {i}:")
            print(f"  ID: {post.get('id')}")
            print(f"  Org ID: {post.get('org_id')}")
            print(f"  Draft ID: {post.get('draft_id')}")
            print(f"  Created: {post.get('created_at')}")
            print(f"  Publish: {post.get('publish_time')}")
            print(f"  Status: {post.get('status')}")
            print()
    else:
        print("❌ NO POSTS found in the last 2 hours!")
        print("\nThis confirms posts are NOT being saved to the database.")
        print("There's likely an error in Step 5 preventing post creation.")
    
    # Also check drafts from last 2 hours
    print("\n" + "="*60)
    print("CHECKING DRAFTS FROM LAST 2 HOURS")
    print("="*60 + "\n")
    
    recent_drafts = await db.drafts.find(
        {"created_at": {"$gte": two_hours_ago.isoformat()}},
        {"_id": 0, "id": 1, "org_id": 1, "topic": 1, "created_at": 1}
    ).to_list(length=50)
    
    print(f"Drafts created in last 2 hours: {len(recent_drafts)}\n")
    
    if recent_drafts:
        for i, draft in enumerate(recent_drafts, 1):
            print(f"Draft {i}:")
            print(f"  ID: {draft.get('id')}")
            print(f"  Org ID: {draft.get('org_id')}")
            print(f"  Topic: {draft.get('topic', 'N/A')[:50]}")
            print(f"  Created: {draft.get('created_at')}")
            print()
    else:
        print("❌ NO DRAFTS found either!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_very_recent_posts())
