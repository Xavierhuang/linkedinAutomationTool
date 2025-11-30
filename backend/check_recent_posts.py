import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def check_recent_posts():
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ.get('DB_NAME', 'linkedpilot')]
    
    print("\n" + "="*60)
    print("CHECKING ALL POSTS (SORTED BY CREATION TIME)")
    print("="*60 + "\n")
    
    # Get ALL scheduled posts sorted by created_at (most recent first)
    posts = await db.scheduled_posts.find(
        {},
        {"_id": 0, "id": 1, "org_id": 1, "publish_time": 1, "status": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(length=50)
    
    print(f"Total posts found: {len(posts)}\n")
    print(f"Current time (UTC): {datetime.utcnow().isoformat()}\n")
    
    if posts:
        for i, post in enumerate(posts, 1):
            pub_time = post.get('publish_time')
            created = post.get('created_at')
            org_id = post.get('org_id', '')[:20] + '...'  # Truncate for readability
            
            print(f"Post {i}:")
            print(f"  Created: {created}")
            print(f"  Publish: {pub_time}")
            print(f"  Status: {post.get('status')}")
            print(f"  Org ID: {org_id}")
            print()
            
            if i >= 20:  # Show only last 20
                print(f"... and {len(posts) - 20} more posts")
                break
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_recent_posts())
