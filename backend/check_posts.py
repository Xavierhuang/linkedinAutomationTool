import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def check_posts():
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ.get('DB_NAME', 'linkedpilot')]
    
    print("\n" + "="*60)
    print("CHECKING SCHEDULED POSTS")
    print("="*60 + "\n")
    
    # Get all scheduled posts
    posts = await db.scheduled_posts.find({}, {"_id": 0}).to_list(length=100)
    
    print(f"Total scheduled posts: {len(posts)}\n")
    
    if posts:
        for i, post in enumerate(posts, 1):
            print(f"Post {i}:")
            print(f"  ID: {post.get('id')}")
            print(f"  Org ID: {post.get('org_id')}")
            print(f"  Draft ID: {post.get('draft_id')}")
            print(f"  Publish Time: {post.get('publish_time')}")
            print(f"  Status: {post.get('status')}")
            print(f"  Created: {post.get('created_at')}")
            print()
    else:
        print("No scheduled posts found!")
    
    # Also check drafts
    print("\n" + "="*60)
    print("CHECKING DRAFTS")
    print("="*60 + "\n")
    
    drafts = await db.drafts.find({}, {"_id": 0}).to_list(length=100)
    print(f"Total drafts: {len(drafts)}\n")
    
    if drafts:
        for i, draft in enumerate(drafts[-10:], 1):  # Show last 10
            print(f"Draft {i}:")
            print(f"  ID: {draft.get('id')}")
            print(f"  Org ID: {draft.get('org_id')}")
            print(f"  Topic: {draft.get('topic', 'N/A')[:50]}")
            print(f"  Created: {draft.get('created_at')}")
            print()
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_posts())
