"""Check API keys in database"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from cryptography.fernet import Fernet

load_dotenv()

async def check_api_keys():
    """Check which API keys are configured"""
    client = AsyncIOMotorClient(os.getenv('MONGODB_URI'))
    db = client['linkedpilot']
    
    settings = await db.system_settings.find_one({'_id': 'api_keys'})
    
    if not settings:
        print('[ERROR] No API keys found in database!')
        print('Please add API keys in the admin dashboard at:')
        print('http://localhost:3002/api-keys')
        return
    
    print('\n=== API KEYS IN DATABASE ===\n')
    
    keys_to_check = [
        'openai_api_key',
        'openrouter_api_key', 
        'anthropic_api_key',
        'google_ai_api_key',
        'unsplash_access_key',
        'pexels_api_key'
    ]
    
    keys_found = []
    encryption_key = os.getenv('ENCRYPTION_KEY')
    
    if not encryption_key:
        print('[ERROR] ENCRYPTION_KEY not set in .env file!')
        return
    
    cipher = Fernet(encryption_key.encode())
    
    for key_name in keys_to_check:
        if settings.get(key_name):
            keys_found.append(key_name)
            try:
                encrypted = settings[key_name]
                decrypted = cipher.decrypt(encrypted.encode()).decode()
                masked = f"{decrypted[:8]}...{decrypted[-4:]}" if len(decrypted) > 12 else "***"
                print(f'   [OK] {key_name}: {masked}')
            except Exception as e:
                print(f'   [ERROR] {key_name}: Decryption failed - {e}')
        else:
            print(f'   [ - ] {key_name}: Not set')
    
    print()
    
    if not keys_found:
        print('[ERROR] No API keys configured!')
        print('Please add API keys in admin dashboard.')
    else:
        print(f'[OK] {len(keys_found)} API key(s) configured')
    
    client.close()

if __name__ == '__main__':
    asyncio.run(check_api_keys())









