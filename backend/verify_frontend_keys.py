#!/usr/bin/env python3
"""
Verify that the frontend can retrieve and decrypt admin API keys correctly.
Simulates the same flow the frontend uses when generating content.
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

async def verify_keys():
    """Verify API key retrieval matches what frontend expects"""
    
    print("=" * 70)
    print("FRONTEND KEY RETRIEVAL VERIFICATION")
    print("=" * 70)
    
    # Check ENCRYPTION_KEY
    ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', '')
    JWT_SECRET = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
    
    if not ENCRYPTION_KEY:
        print("❌ ERROR: ENCRYPTION_KEY not set")
        return 1
    
    try:
        cipher = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
        print("✓ ENCRYPTION_KEY loaded and valid\n")
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
        print("✓ Connected to MongoDB\n")
    except Exception as e:
        print(f"❌ ERROR: Failed to connect: {e}")
        return 1
    
    # Test 1: System API Keys (what admin sets)
    print("=" * 70)
    print("TEST 1: SYSTEM API KEYS (Admin Dashboard)")
    print("=" * 70)
    
    system_settings = await db.system_settings.find_one({"_id": "api_keys"})
    
    if not system_settings:
        print("❌ No system_settings found")
        return 1
    
    print(f"✓ System settings document found\n")
    
    # Test each key type that frontend might need
    key_types = {
        "google_ai_api_key": "Google AI Studio",
        "openai_api_key": "OpenAI",
        "openrouter_api_key": "OpenRouter",
        "anthropic_api_key": "Anthropic",
        "pexels_api_key": "Pexels",
        "unsplash_access_key": "Unsplash",
    }
    
    system_results = {}
    
    for key_field, key_name in key_types.items():
        encrypted = system_settings.get(key_field, '').strip()
        
        if not encrypted:
            print(f"  ⚠️  {key_name}: Not set")
            system_results[key_field] = {"present": False, "decrypts": False}
            continue
        
        # Try to decrypt
        try:
            # Try primary key first
            try:
                decrypted = cipher.decrypt(encrypted.encode()).decode()
                print(f"  ✓ {key_name}: Present & decrypts correctly ({decrypted[:8]}...{decrypted[-4:]})")
                system_results[key_field] = {"present": True, "decrypts": True}
            except Exception:
                # Try legacy key
                legacy_key = base64.urlsafe_b64encode(hashlib.sha256(JWT_SECRET.encode()).digest())
                legacy_cipher = Fernet(legacy_key)
                decrypted = legacy_cipher.decrypt(encrypted.encode()).decode()
                print(f"  ✓ {key_name}: Present & decrypts with LEGACY key ({decrypted[:8]}...{decrypted[-4:]})")
                system_results[key_field] = {"present": True, "decrypts": True, "legacy": True}
        except Exception as e:
            print(f"  ❌ {key_name}: Present but FAILED to decrypt: {e}")
            system_results[key_field] = {"present": True, "decrypts": False, "error": str(e)}
    
    # Test 2: User API Keys (synced from system)
    print("\n" + "=" * 70)
    print("TEST 2: USER API KEYS (Synced from Admin)")
    print("=" * 70)
    
    # Get first user
    user = await db.users.find_one({})
    
    if not user:
        print("❌ No users found")
        return 1
    
    user_id = user.get('id') or str(user.get('_id', ''))
    user_email = user.get('email', 'unknown')
    
    print(f"Testing for user: {user_email} ({user_id})\n")
    
    user_settings = await db.user_settings.find_one({"user_id": user_id})
    
    if not user_settings:
        print("⚠️  No user_settings found (keys may not be synced)")
        print("   Run sync_admin_keys_to_users.py to sync keys\n")
    else:
        print(f"✓ User settings found\n")
        
        user_results = {}
        
        for key_field, key_name in key_types.items():
            encrypted = user_settings.get(key_field, '').strip()
            
            if not encrypted:
                print(f"  ⚠️  {key_name}: Not set in user settings")
                user_results[key_field] = {"present": False, "decrypts": False}
                continue
            
            # Try to decrypt
            try:
                decrypted = cipher.decrypt(encrypted.encode()).decode()
                print(f"  ✓ {key_name}: Present & decrypts correctly ({decrypted[:8]}...{decrypted[-4:]})")
                user_results[key_field] = {"present": True, "decrypts": True}
            except Exception as e:
                print(f"  ❌ {key_name}: Present but FAILED to decrypt: {e}")
                user_results[key_field] = {"present": True, "decrypts": False, "error": str(e)}
    
    # Test 3: Simulate API key retrieval (like get_system_api_key / get_user_api_key)
    print("\n" + "=" * 70)
    print("TEST 3: API KEY RETRIEVAL SIMULATION")
    print("=" * 70)
    
    # Import the actual functions
    import sys
    sys.path.insert(0, str(Path(__file__).parent))
    
    try:
        from linkedpilot.routes.drafts import get_system_api_key, get_user_api_key
        
        providers_to_test = [
            ("google_ai_studio", "Google AI Studio"),
            ("openai", "OpenAI"),
            ("openrouter", "OpenRouter"),
            ("anthropic", "Anthropic"),
        ]
        
        print("\nTesting get_system_api_key():\n")
        for provider, name in providers_to_test:
            api_key, provider_result = await get_system_api_key(provider)
            if api_key:
                print(f"  ✓ {name}: Retrieved successfully ({api_key[:8]}...{api_key[-4:]})")
            else:
                print(f"  ⚠️  {name}: Not found or failed")
        
        print("\nTesting get_user_api_key():\n")
        for provider, name in providers_to_test:
            api_key, provider_result = await get_user_api_key(user_id, provider)
            if api_key:
                print(f"  ✓ {name}: Retrieved successfully ({api_key[:8]}...{api_key[-4:]})")
            else:
                print(f"  ⚠️  {name}: Not found or failed")
                
    except Exception as e:
        print(f"⚠️  Could not import key retrieval functions: {e}")
        import traceback
        traceback.print_exc()
    
    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    
    system_available = sum(1 for r in system_results.values() if r.get("decrypts", False))
    print(f"System keys available: {system_available}/{len(key_types)}")
    
    if user_settings:
        user_available = sum(1 for r in user_results.values() if r.get("decrypts", False))
        print(f"User keys available: {user_available}/{len(key_types)}")
    
    print("\n✓ Verification complete!")
    print("=" * 70)
    
    client.close()
    return 0

if __name__ == "__main__":
    exit_code = asyncio.run(verify_keys())
    exit(exit_code)





