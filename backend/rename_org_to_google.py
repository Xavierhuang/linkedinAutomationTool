import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def rename_org_to_google():
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ.get('DB_NAME', 'linkedpilot')]
    
    # The org_id with posts
    target_org_id = "14dddac3-134a-4d27-9625-a90f82ffab2e"
    
    print(f"\nUpdating organization name to 'Google'...")
    print(f"Org ID: {target_org_id}")
    
    # Update both name and title fields for compatibility
    result = await db.organizations.update_one(
        {"id": target_org_id},
        {"$set": {
            "name": "Google",
            "title": "Google"  # Also set title for backward compatibility
        }}
    )
    
    if result.modified_count > 0:
        print(f"✓ Successfully updated organization name to 'Google'")
    else:
        print(f"⚠ No changes made (name might already be set)")
    
    # Verify
    org = await db.organizations.find_one({"id": target_org_id}, {"_id": 0})
    print(f"\nVerification:")
    print(f"  Name: {org.get('name')}")
    print(f"  Title: {org.get('title')}")
    print(f"  ID: {org.get('id')}")
    
    # Count posts
    post_count = await db.scheduled_posts.count_documents({"org_id": target_org_id})
    print(f"  Posts: {post_count}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(rename_org_to_google())
