#!/usr/bin/env python3
"""Test script to verify API key decryption on server"""
import os
import sys
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from cryptography.fernet import Fernet
import base64
import hashlib

# Load environment
from dotenv import load_dotenv
load_dotenv()

async def test_keys():
    """Test both system and user API key decryption"""
    
    # Check ENCRYPTION_KEY
    ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', '')
    JWT_SECRET = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
    
    print("=" * 60)
    print("API KEY DECRYPTION TEST")
    print("=" * 60)
    
    print(f"\n1. ENCRYPTION_KEY from env: {'SET' if ENCRYPTION_KEY else 'NOT SET'}")
    print(f"   Length: {len(ENCRYPTION_KEY) if ENCRYPTION_KEY else 0}")
    
    if ENCRYPTION_KEY:
        try:
            cipher = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
            print(f"   ✓ Fernet cipher created successfully")
        except Exception as e:
            print(f"   ✗ Failed to create Fernet cipher: {e}")
            return
    
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'linkedin_pilot')
    
    print(f"\n2. Connecting to MongoDB: {db_name}")
    try:
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        await client.admin.command('ping')
        print(f"   ✓ Connected successfully")
    except Exception as e:
        print(f"   ✗ Failed to connect: {e}")
        return
    
    # Test system keys
    print(f"\n3. Testing SYSTEM API keys:")
    try:
        system_settings = await db.system_settings.find_one({"_id": "api_keys"})
        
        if not system_settings:
            print(f"   ✗ No system_settings document found")
        else:
            print(f"   ✓ Found system_settings with keys: {list(system_settings.keys())}")
            
            # Try to decrypt each key
            key_fields = ['google_ai_api_key', 'openai_api_key', 'openrouter_api_key', 'anthropic_api_key', 
                         'pexels_api_key', 'unsplash_api_key']
            
            for key_field in key_fields:
                encrypted_key = system_settings.get(key_field, '')
                if encrypted_key:
                    print(f"\n   Testing {key_field}:")
                    try:
                        if ENCRYPTION_KEY:
                            decrypted = cipher.decrypt(encrypted_key.encode()).decode()
                            print(f"      ✓ Decrypted with ENCRYPTION_KEY: {decrypted[:8]}...{decrypted[-4:]}")
                        else:
                            print(f"      ✗ ENCRYPTION_KEY not set")
                    except Exception as e:
                        print(f"      ✗ Failed with ENCRYPTION_KEY: {e}")
                        # Try legacy
                        try:
                            legacy_key = base64.urlsafe_b64encode(hashlib.sha256(JWT_SECRET.encode()).digest())
                            legacy_cipher = Fernet(legacy_key)
                            decrypted = legacy_cipher.decrypt(encrypted_key.encode()).decode()
                            print(f"      ✓ Decrypted with legacy key: {decrypted[:8]}...{decrypted[-4:]}")
                        except Exception as e2:
                            print(f"      ✗ Failed with legacy key: {e2}")
                else:
                    print(f"   - {key_field}: not set")
                    
    except Exception as e:
        print(f"   ✗ Error testing system keys: {e}")
        import traceback
        traceback.print_exc()
    
    # Test user keys
    print(f"\n4. Testing USER API keys:")
    try:
        # Get first user
        user = await db.users.find_one({})
        
        if not user:
            print(f"   - No users found in database")
        else:
            user_id = user.get('id') or str(user.get('_id', ''))
            print(f"   Testing for user: {user_id}")
            
            # Get user settings
            settings = await db.settings.find_one({"user_id": user_id})
            
            if not settings:
                print(f"   ✗ No settings found for user")
            else:
                print(f"   ✓ Found settings with keys: {list(settings.keys())}")
                
                # Try to decrypt user keys
                key_fields = ['google_ai_api_key', 'openai_api_key', 'openrouter_api_key', 
                             'anthropic_api_key', 'pexels_api_key', 'unsplash_api_key']
                
                for key_field in key_fields:
                    encrypted_key = settings.get(key_field, '')
                    if encrypted_key:
                        print(f"\n   Testing {key_field}:")
                        try:
                            if ENCRYPTION_KEY:
                                decrypted = cipher.decrypt(encrypted_key.encode()).decode()
                                print(f"      ✓ Decrypted with ENCRYPTION_KEY: {decrypted[:8]}...{decrypted[-4:]}")
                            else:
                                print(f"      ✗ ENCRYPTION_KEY not set")
                        except Exception as e:
                            print(f"      ✗ Failed with ENCRYPTION_KEY: {e}")
                            # Try legacy
                            try:
                                legacy_key = base64.urlsafe_b64encode(hashlib.sha256(JWT_SECRET.encode()).digest())
                                legacy_cipher = Fernet(legacy_key)
                                decrypted = legacy_cipher.decrypt(encrypted_key.encode()).decode()
                                print(f"      ✓ Decrypted with legacy key: {decrypted[:8]}...{decrypted[-4:]}")
                            except Exception as e2:
                                print(f"      ✗ Failed with legacy key: {e2}")
                    else:
                        print(f"   - {key_field}: not set")
                        
    except Exception as e:
        print(f"   ✗ Error testing user keys: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(test_keys())





