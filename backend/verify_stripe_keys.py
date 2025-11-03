import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from cryptography.fernet import Fernet

async def verify_stripe_keys():
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'linkedin_pilot')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Get system settings
    settings = await db.system_settings.find_one({'_id': 'api_keys'})
    
    if not settings:
        print('❌ No system_settings found in database!')
        print('   You need to save keys in admin dashboard first.')
        return
    
    print('\n✅ System settings found!\n')
    
    # Check which Stripe keys exist (encrypted)
    stripe_keys = [
        'stripe_secret_key',
        'stripe_publishable_key',
        'stripe_webhook_secret',
        'stripe_pro_price_id'
    ]
    
    for key in stripe_keys:
        if settings.get(key):
            print(f'✅ {key}: Present (encrypted)')
        else:
            print(f'❌ {key}: MISSING')
    
    # Try to decrypt and show first/last few characters
    ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', '')
    if not ENCRYPTION_KEY:
        print("❌ ENCRYPTION_KEY not found in environment!")
        return
    try:
        cipher_suite = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
        
        print('\n📋 Decrypted values (partial):')
        for key in stripe_keys:
            if settings.get(key):
                try:
                    decrypted = cipher_suite.decrypt(settings[key].encode()).decode()
                    if len(decrypted) > 20:
                        print(f'   {key}: {decrypted[:10]}...{decrypted[-10:]}')
                    else:
                        print(f'   {key}: {decrypted}')
                except Exception as e:
                    print(f'   {key}: Error decrypting - {type(e).__name__}: {str(e)}')
    except Exception as e:
        print(f'\n⚠️  Decryption error: {e}')
    
    client.close()

if __name__ == "__main__":
    asyncio.run(verify_stripe_keys())

