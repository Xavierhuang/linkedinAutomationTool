import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def update_org_title():
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ.get('DB_NAME', 'linkedpilot')]
    
    # The org_id with posts
    target_org_id = "14dddac3-134a-4d27-9625-a90f82ffab2e"
    
    print(f"\nUpdating organization title...")
    print(f"Org ID: {target_org_id}")
    
    # Update the title
    result = await db.organizations.update_one(
        {"id": target_org_id},
        {"$set": {"title": "My Organization"}}
    )
    
    if result.modified_count > 0:
        print(f"✓ Successfully updated organization title to 'My Organization'")
    else:
        print(f"⚠ No changes made (title might already be set)")
    
    # Verify
    org = await db.organizations.find_one({"id": target_org_id}, {"_id": 0})
    print(f"\nVerification:")
    print(f"  Title: {org.get('title')}")
    print(f"  ID: {org.get('id')}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(update_org_title())
