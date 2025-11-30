#!/usr/bin/env python3
"""
Sync all admin (system) API keys to all users' settings.
This ensures users can access API keys configured by admin in their dashboard.
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

# All API key fields that should be synced
API_KEY_FIELDS = [
    "google_ai_api_key",
    "openai_api_key",
    "openrouter_api_key",
    "anthropic_api_key",
    "pexels_api_key",
    "unsplash_api_key",
    "unsplash_access_key",  # Some systems use this instead of unsplash_api_key
    "canva_api_key",
]

def mask_key(key: str) -> str:
    """Mask API key for display"""
    if not key or len(key) < 8:
        return "***"
    return f"{key[:4]}...{key[-4:]}"

async def sync_keys_to_users(user_id: str = None, dry_run: bool = False):
    """Sync system API keys to user(s) settings"""
    
    # Get encryption key
    ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', '')
    JWT_SECRET = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
    
    if not ENCRYPTION_KEY:
        print("ERROR: ENCRYPTION_KEY not set in environment")
        return 1
    
    try:
        cipher = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
        print("✓ Encryption cipher created")
    except Exception as e:
        print(f"ERROR: Failed to create encryption cipher: {e}")
        return 1
    
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'linkedin_pilot')
    
    print(f"\nConnecting to MongoDB: {db_name}")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    try:
        await client.admin.command('ping')
        print("✓ Connected to MongoDB")
    except Exception as e:
        print(f"ERROR: Failed to connect to MongoDB: {e}")
        return 1
    
    # Get system settings
    print("\n📥 Fetching system API keys from admin settings...")
    system_settings = await db.system_settings.find_one({"_id": "api_keys"})
    
    if not system_settings:
        print("ERROR: No system_settings document found (admin must configure keys first)")
        return 1
    
    print(f"✓ Found system_settings with {len([k for k in API_KEY_FIELDS if system_settings.get(k)])} API keys")
    
    # Get users to sync
    if user_id:
        users = await db.users.find({"id": user_id}).to_list(length=1)
        if not users:
            print(f"ERROR: User {user_id} not found")
            return 1
    else:
        users = await db.users.find({}).to_list(length=None)
    
    print(f"\n👥 Syncing keys to {len(users)} user(s)...")
    
    synced_count = 0
    updated_count = 0
    
    for user in users:
        user_id = user.get('id') or str(user.get('_id', ''))
        user_email = user.get('email', 'unknown')
        
        print(f"\n  User: {user_email} ({user_id})")
        
        # Get or create user settings (using user_settings collection)
        user_settings = await db.user_settings.find_one({"user_id": user_id})
        
        if not user_settings:
            user_settings = {"user_id": user_id}
            print(f"    Creating new settings document...")
        else:
            print(f"    Updating existing settings document...")
        
        keys_added = []
        keys_skipped = []
        
        # Copy each system key to user settings if not already present
        for key_field in API_KEY_FIELDS:
            system_encrypted = system_settings.get(key_field, '').strip()
            
            if not system_encrypted:
                continue  # Skip if system doesn't have this key
            
            # Check if user already has this key
            user_encrypted = user_settings.get(key_field, '').strip()
            
            if user_encrypted:
                keys_skipped.append(key_field)
                continue  # User already has this key
            
            # Decrypt system key
            try:
                # Try primary ENCRYPTION_KEY first
                try:
                    system_decrypted = cipher.decrypt(system_encrypted.encode()).decode()
                except Exception:
                    # Try legacy key as fallback
                    legacy_key = base64.urlsafe_b64encode(hashlib.sha256(JWT_SECRET.encode()).digest())
                    legacy_cipher = Fernet(legacy_key)
                    system_decrypted = legacy_cipher.decrypt(system_encrypted.encode()).decode()
                
                # Encrypt for user with current ENCRYPTION_KEY
                user_settings[key_field] = cipher.encrypt(system_decrypted.encode()).decode()
                keys_added.append(key_field)
                
                if not dry_run:
                    print(f"    ✓ Copied {key_field}: {mask_key(system_decrypted)}")
                else:
                    print(f"    [DRY RUN] Would copy {key_field}: {mask_key(system_decrypted)}")
                    
            except Exception as e:
                print(f"    ✗ Failed to decrypt/copy {key_field}: {e}")
        
        # Update user settings (using user_settings collection)
        if keys_added:
            if not dry_run:
                await db.user_settings.update_one(
                    {"user_id": user_id},
                    {"$set": user_settings},
                    upsert=True
                )
                updated_count += 1
                print(f"    ✅ Updated settings: {len(keys_added)} keys added")
            else:
                print(f"    [DRY RUN] Would update settings: {len(keys_added)} keys")
            
            synced_count += len(keys_added)
        else:
            if keys_skipped:
                print(f"    ⏭️  Skipped: All keys already present ({len(keys_skipped)} keys)")
            else:
                print(f"    ℹ️  No keys to sync (system has no keys configured)")
    
    print(f"\n{'='*60}")
    print(f"✅ SYNC COMPLETE")
    print(f"{'='*60}")
    print(f"  Users processed: {len(users)}")
    print(f"  Users updated: {updated_count}")
    print(f"  Total keys synced: {synced_count}")
    
    if dry_run:
        print(f"\n⚠️  DRY RUN MODE - No changes were made")
    else:
        print(f"\n✓ All admin API keys have been synced to user settings")
    
    client.close()
    return 0

if __name__ == "__main__":
    import sys
    
    # Check for dry-run flag
    dry_run = "--dry-run" in sys.argv or "-n" in sys.argv
    
    # Check for user_id argument
    user_id = None
    for arg in sys.argv:
        if arg.startswith("--user="):
            user_id = arg.split("=", 1)[1]
        elif arg.startswith("-u="):
            user_id = arg.split("=", 1)[1]
    
    if dry_run:
        print("🔍 DRY RUN MODE - No changes will be made\n")
    
    exit_code = asyncio.run(sync_keys_to_users(user_id=user_id, dry_run=dry_run))
    sys.exit(exit_code)

