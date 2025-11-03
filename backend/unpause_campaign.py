import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

async def unpause_campaign():
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
    db = client[os.environ.get('DB_NAME', 'linkedin_pilot')]
    
    # Update campaign status to active
    result = await db.campaigns.update_one(
        {'id': 'camp_1760964772642'},
        {'$set': {'status': 'active'}}
    )
    
    if result.modified_count > 0:
        print("✅ Campaign 'Mandi' has been UNPAUSED and set to ACTIVE")
        print("   The campaign will now generate content on the next scheduler run")
        print("   New posts will be auto-scheduled to the calendar (auto-post is enabled)")
    else:
        print("⚠️  No changes made - campaign may already be active")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(unpause_campaign())
