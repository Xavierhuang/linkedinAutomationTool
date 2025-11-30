import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from cryptography.fernet import Fernet
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def check_keys():
    print("--- Checking Admin Keys ---")
    
    # 1. Check Environment Variables
    mongo_url = os.getenv('MONGO_URL')
    db_name = os.getenv('DB_NAME')
    encryption_key = os.getenv('ENCRYPTION_KEY')
    linkedin_redirect_uri = os.getenv('LINKEDIN_REDIRECT_URI')
    
    print(f"MONGO_URL: {mongo_url}")
    print(f"DB_NAME: {db_name}")
    print(f"ENCRYPTION_KEY present: {bool(encryption_key)}")
    print(f"LINKEDIN_REDIRECT_URI (env): {linkedin_redirect_uri}")
    
    if not encryption_key:
        print("ERROR: ENCRYPTION_KEY not found in environment!")
        return

    # 2. Connect to DB
    try:
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        print("Connected to MongoDB")
    except Exception as e:
        print(f"ERROR: Could not connect to MongoDB: {e}")
        return

    # 3. Fetch System Settings
    try:
        system_settings = await db.system_settings.find_one({"_id": "api_keys"})
        if not system_settings:
            print("WARNING: No 'api_keys' document found in 'system_settings' collection.")
            return
        
        print("Found 'api_keys' in system_settings")
        
        encrypted_client_id = system_settings.get('linkedin_client_id', '')
        encrypted_client_secret = system_settings.get('linkedin_client_secret', '')
        
        print(f"Encrypted Client ID length: {len(encrypted_client_id)}")
        print(f"Encrypted Client Secret length: {len(encrypted_client_secret)}")

        # 4. Decrypt
        try:
            cipher_suite = Fernet(encryption_key.encode() if isinstance(encryption_key, str) else encryption_key)
            
            if encrypted_client_id:
                decrypted_id = cipher_suite.decrypt(encrypted_client_id.encode()).decode()
                print(f"Decrypted Client ID: {decrypted_id[:4]}...{decrypted_id[-4:]} (Length: {len(decrypted_id)})")
            else:
                print("Client ID is empty")

            if encrypted_client_secret:
                decrypted_secret = cipher_suite.decrypt(encrypted_client_secret.encode()).decode()
                print(f"Decrypted Client Secret: {decrypted_secret[:4]}...{decrypted_secret[-4:]} (Length: {len(decrypted_secret)})")
            else:
                print("Client Secret is empty")
                
        except Exception as e:
            print(f"ERROR during decryption: {e}")
            
    except Exception as e:
        print(f"ERROR fetching settings: {e}")

if __name__ == "__main__":
    asyncio.run(check_keys())
