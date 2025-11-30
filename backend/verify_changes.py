import asyncio
import aiohttp
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

BACKEND_URL = "http://localhost:8000"

async def test_backend():
    mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.getenv("DB_NAME", "linkedin_pilot")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # 1. Get a valid org_id
    org = await db.organizations.find_one({})
    if not org:
        print("❌ No organization found.")
        return
    
    org_id = org['id']
    user_id = org.get('created_by')
    print(f"Testing with Org ID: {org_id}, User ID: {user_id}")
    
    async with aiohttp.ClientSession() as session:
        # 2. Test Campaign Previews (Daily Schedule)
        print("\nTesting /api/brand/campaign-previews...")
        try:
            async with session.post(f"{BACKEND_URL}/api/brand/campaign-previews", json={
                "org_id": org_id,
                "count": 1
            }) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    campaigns = data.get('campaigns', [])
                    if campaigns:
                        campaign = campaigns[0]
                        schedule = campaign.get('posting_schedule', {})
                        freq = schedule.get('frequency')
                        print(f"✅ Campaign Generated: {campaign.get('name')}")
                        print(f"   Frequency: {freq}")
                        if freq == 'daily':
                            print("   ✅ SUCCESS: Frequency is daily")
                        else:
                            print(f"   ❌ FAILURE: Frequency is {freq}")
                    else:
                        print("❌ No campaigns returned")
                else:
                    print(f"❌ Request failed: {resp.status}")
                    print(await resp.text())
        except Exception as e:
            print(f"❌ Error: {e}")

        # 3. Test Image Generation
        print("\nTesting /api/drafts/generate-image...")
        try:
            async with session.post(f"{BACKEND_URL}/api/drafts/generate-image", json={
                "prompt": "A futuristic city with flying cars",
                "topic": "Future of Transportation",
                "style": "cinematic",
                "user_id": user_id,
                "org_id": org_id
            }) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    url = data.get('url')
                    print(f"✅ Image Generated: {url}")
                else:
                    print(f"❌ Request failed: {resp.status}")
                    print(await resp.text())
        except Exception as e:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_backend())
