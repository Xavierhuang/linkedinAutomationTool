#!/usr/bin/env python3
"""
Check saved API keys in live database and verify Google AI key matches expected value.
"""
import os
import asyncio
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from cryptography.fernet import Fernet
import base64
import hashlib

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

EXPECTED_GOOGLE_AI_KEY = "AIzaSyAX0bufkR9Z1e5tMB1gySRBkIxNW1lewo8"

def mask_key(key: str) -> str:
    """Mask API key for display"""
    if not key or len(key) < 8:
        return "***"
    return f"{key[:8]}...{key[-4:]}"

async def check_keys():
    """Check all saved API keys in database"""
    
    print("=" * 70)
    print("LIVE DATABASE API KEYS CHECK")
    print("=" * 70)
    
    # Get encryption key
    ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', '')
    JWT_SECRET = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
    
    if not ENCRYPTION_KEY:
        print("❌ ERROR: ENCRYPTION_KEY not set")
        return 1
    
    try:
        cipher = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
        print("✓ ENCRYPTION_KEY loaded")
    except Exception as e:
        print(f"❌ ERROR: Failed to create cipher: {e}")
        return 1
    
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'linkedin_pilot')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    try:
        await client.admin.command('ping')
        print(f"✓ Connected to MongoDB: {db_name}\n")
    except Exception as e:
        print(f"❌ ERROR: Failed to connect: {e}")
        return 1
    
    # Check SYSTEM API Keys
    print("=" * 70)
    print("SYSTEM API KEYS (Admin Dashboard)")
    print("=" * 70)
    
    system_settings = await db.system_settings.find_one({"_id": "api_keys"})
    
    if not system_settings:
        print("❌ No system_settings found")
        return 1
    
    key_fields = {
        "google_ai_api_key": "Google AI Studio",
        "openai_api_key": "OpenAI",
        "openrouter_api_key": "OpenRouter",
        "anthropic_api_key": "Anthropic",
        "pexels_api_key": "Pexels",
        "unsplash_access_key": "Unsplash",
    }
    
    google_ai_found = False
    google_ai_matches = False
    
    for key_field, key_name in key_fields.items():
        encrypted = system_settings.get(key_field, '').strip()
        
        if not encrypted:
            print(f"  ⚠️  {key_name}: Not set")
            continue
        
        try:
            # Try primary key first
            try:
                decrypted = cipher.decrypt(encrypted.encode()).decode()
                print(f"  ✓ {key_name}: Present & decrypts ({mask_key(decrypted)})")
                
                # Check if this is the Google AI key we're looking for
                if key_field == "google_ai_api_key":
                    google_ai_found = True
                    if decrypted == EXPECTED_GOOGLE_AI_KEY:
                        google_ai_matches = True
                        print(f"      ✅ MATCHES expected Google AI key!")
                    else:
                        print(f"      ⚠️  Does NOT match expected key")
                        print(f"      Expected: {EXPECTED_GOOGLE_AI_KEY[:8]}...{EXPECTED_GOOGLE_AI_KEY[-4:]}")
                        print(f"      Actual:   {decrypted[:8]}...{decrypted[-4:]}")
                        
            except Exception:
                # Try legacy key
                legacy_key = base64.urlsafe_b64encode(hashlib.sha256(JWT_SECRET.encode()).digest())
                legacy_cipher = Fernet(legacy_key)
                decrypted = legacy_cipher.decrypt(encrypted.encode()).decode()
                print(f"  ✓ {key_name}: Present & decrypts with LEGACY key ({mask_key(decrypted)})")
                
                if key_field == "google_ai_api_key":
                    google_ai_found = True
                    if decrypted == EXPECTED_GOOGLE_AI_KEY:
                        google_ai_matches = True
                        print(f"      ✅ MATCHES expected Google AI key!")
                    else:
                        print(f"      ⚠️  Does NOT match expected key")
                        print(f"      Expected: {EXPECTED_GOOGLE_AI_KEY[:8]}...{EXPECTED_GOOGLE_AI_KEY[-4:]}")
                        print(f"      Actual:   {decrypted[:8]}...{decrypted[-4:]}")
                        
        except Exception as e:
            print(f"  ❌ {key_name}: Present but FAILED to decrypt: {e}")
    
    # Check USER API Keys (first user)
    print("\n" + "=" * 70)
    print("USER API KEYS (First User Sample)")
    print("=" * 70)
    
    user = await db.users.find_one({})
    if user:
        user_id = user.get('id') or str(user.get('_id', ''))
        user_email = user.get('email', 'unknown')
        print(f"User: {user_email} ({user_id})\n")
        
        user_settings = await db.user_settings.find_one({"user_id": user_id})
        
        if not user_settings:
            print("⚠️  No user_settings found\n")
        else:
            for key_field, key_name in key_fields.items():
                encrypted = user_settings.get(key_field, '').strip()
                
                if not encrypted:
                    continue
                
                try:
                    decrypted = cipher.decrypt(encrypted.encode()).decode()
                    print(f"  ✓ {key_name}: Present in user settings ({mask_key(decrypted)})")
                except Exception as e:
                    print(f"  ❌ {key_name}: Failed to decrypt: {e}")
    
    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    
    if google_ai_found:
        if google_ai_matches:
            print("✅ Google AI key found and matches expected value!")
        else:
            print("⚠️  Google AI key found but does NOT match expected value")
            print("   Update the key in Admin Dashboard if needed")
    else:
        print("❌ Google AI key NOT found in system settings")
        print("   Add it in Admin Dashboard → API Providers")
    
    client.close()
    return 0

if __name__ == "__main__":
    exit_code = asyncio.run(check_keys())
    exit(exit_code)





