"""
Clear Stripe keys from database
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def clear_stripe_keys():
    """Clear all Stripe keys from system_settings"""
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("\n🗑️  Clearing Stripe keys from database...")
    
    # Update system_settings to clear only Stripe keys
    result = await db.system_settings.update_one(
        {"_id": "api_keys"},
        {"$set": {
            "stripe_secret_key": "",
            "stripe_publishable_key": "",
            "stripe_webhook_secret": "",
            "stripe_pro_price_id": ""
        }}
    )
    
    if result.matched_count > 0:
        print("✅ Stripe keys cleared successfully!")
        print("\n📝 You can now re-enter your Stripe keys in the admin dashboard.")
    else:
        print("⚠️  No system_settings document found (this is OK - will be created when you save keys)")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(clear_stripe_keys())










