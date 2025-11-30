import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def find_org_with_posts():
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ.get('DB_NAME', 'linkedpilot')]
    
    print("\n" + "="*60)
    print("FINDING ORGANIZATION WITH POSTS")
    print("="*60 + "\n")
    
    # The org_id we know has posts
    target_org_id = "14dddac3-134a-4d27-9625-a90f82ffab2e"
    
    # Find this organization
    org = await db.organizations.find_one({"id": target_org_id}, {"_id": 0})
    
    if org:
        print(f"Found organization with posts:")
        print(f"  ID: {org.get('id')}")
        print(f"  Title: {org.get('title')}")
        print(f"  Created: {org.get('created_at')}")
        print(f"  User ID: {org.get('user_id')}")
        print()
        
        # Count posts
        post_count = await db.scheduled_posts.count_documents({"org_id": target_org_id})
        draft_count = await db.drafts.count_documents({"org_id": target_org_id})
        print(f"  Scheduled Posts: {post_count}")
        print(f"  Drafts: {draft_count}")
    else:
        print(f"Organization {target_org_id} NOT FOUND!")
        print("\nSearching for posts without matching org...")
        
        # Get a sample post
        sample_post = await db.scheduled_posts.find_one({"org_id": target_org_id}, {"_id": 0})
        if sample_post:
            print(f"\nSample post found:")
            print(f"  Org ID in post: {sample_post.get('org_id')}")
            print(f"  Post ID: {sample_post.get('id')}")
    
    # Also list all orgs with non-None titles
    print("\n" + "="*60)
    print("ORGANIZATIONS WITH TITLES")
    print("="*60 + "\n")
    
    orgs_with_titles = await db.organizations.find(
        {"title": {"$ne": None, "$exists": True}},
        {"_id": 0, "id": 1, "title": 1}
    ).to_list(length=50)
    
    for org in orgs_with_titles:
        post_count = await db.scheduled_posts.count_documents({"org_id": org.get('id')})
        if post_count > 0:
            print(f"✓ {org.get('title')} ({org.get('id')}): {post_count} posts")
        else:
            print(f"  {org.get('title')} ({org.get('id')}): {post_count} posts")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(find_org_with_posts())
