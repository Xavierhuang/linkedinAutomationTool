import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def check_organizations():
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ.get('DB_NAME', 'linkedpilot')]
    
    print("\n" + "="*60)
    print("CHECKING ORGANIZATIONS")
    print("="*60 + "\n")
    
    # Get all organizations
    orgs = await db.organizations.find({}, {"_id": 0}).to_list(length=100)
    
    print(f"Total organizations: {len(orgs)}\n")
    
    if orgs:
        for i, org in enumerate(orgs, 1):
            print(f"Organization {i}:")
            print(f"  ID: {org.get('id')}")
            print(f"  Title: {org.get('title')}")
            print(f"  Created: {org.get('created_at')}")
            print()
    
    # Check posts for each org
    print("\n" + "="*60)
    print("POSTS PER ORGANIZATION")
    print("="*60 + "\n")
    
    for org in orgs:
        org_id = org.get('id')
        post_count = await db.scheduled_posts.count_documents({"org_id": org_id})
        draft_count = await db.drafts.count_documents({"org_id": org_id})
        print(f"{org.get('title')} ({org_id}):")
        print(f"  Scheduled Posts: {post_count}")
        print(f"  Drafts: {draft_count}")
        print()
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_organizations())
