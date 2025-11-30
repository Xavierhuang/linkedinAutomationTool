import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def check_post_dates():
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ.get('DB_NAME', 'linkedpilot')]
    
    print("\n" + "="*60)
    print("CHECKING POST DATES")
    print("="*60 + "\n")
    
    # Get all scheduled posts sorted by publish_time
    posts = await db.scheduled_posts.find(
        {},
        {"_id": 0, "id": 1, "org_id": 1, "publish_time": 1, "status": 1, "created_at": 1}
    ).sort("publish_time", -1).to_list(length=20)
    
    print(f"Total posts found: {len(posts)}\n")
    print(f"Current time (UTC): {datetime.utcnow().isoformat()}\n")
    
    if posts:
        for i, post in enumerate(posts, 1):
            pub_time = post.get('publish_time')
            created = post.get('created_at')
            
            # Parse dates
            if isinstance(pub_time, str):
                pub_dt = datetime.fromisoformat(pub_time.replace('Z', '+00:00'))
            else:
                pub_dt = pub_time
                
            print(f"Post {i}:")
            print(f"  ID: {post.get('id')}")
            print(f"  Publish Time: {pub_time}")
            print(f"  Status: {post.get('status')}")
            print(f"  Created: {created}")
            print()
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_post_dates())
