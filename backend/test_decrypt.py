"""
Test if we can decrypt Stripe keys from the database
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path
from cryptography.fernet import Fernet

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def test_decryption():
    """Test decryption of Stripe keys"""
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    
    print("\n🔍 Testing Stripe Key Decryption...")
    print(f"📁 Using ENCRYPTION_KEY: {os.environ.get('ENCRYPTION_KEY', 'NOT FOUND')[:20]}...")
    
    # Get encryption key
    ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', '')
    if not ENCRYPTION_KEY:
        print("❌ ENCRYPTION_KEY not found in environment!")
        return
    
    cipher_suite = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
    
    # Connect to database
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Fetch system settings
    system_settings = await db.system_settings.find_one({"_id": "api_keys"})
    
    if not system_settings:
        print("❌ No system_settings found in database!")
        client.close()
        return
    
    print("\n✅ System settings found!")
    print(f"\nStored keys (encrypted):")
    
    stripe_keys = ['stripe_secret_key', 'stripe_publishable_key', 'stripe_webhook_secret', 'stripe_pro_price_id']
    
    for key in stripe_keys:
        encrypted_value = system_settings.get(key, '')
        if encrypted_value:
            print(f"   {key}: {encrypted_value[:30]}...")
            
            # Try to decrypt
            try:
                decrypted = cipher_suite.decrypt(encrypted_value.encode()).decode()
                print(f"   ✅ Decrypted: {decrypted[:20]}...")
            except Exception as e:
                print(f"   ❌ Decryption failed: {str(e)}")
        else:
            print(f"   ❌ {key}: MISSING")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(test_decryption())










