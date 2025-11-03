"""List all API keys stored via Admin Dashboard"""
import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

print("\n=== API KEYS IN ADMIN DASHBOARD ===\n")

# Connect to MongoDB
mongo_url = os.getenv('MONGO_URL')
db_name = os.getenv('DB_NAME', 'linkedin_pilot')

if not mongo_url:
    print("[ERROR] MONGO_URL not found in .env")
    exit(1)

client = MongoClient(mongo_url)
db = client[db_name]
settings = db['system_settings']

# Get all keys
keys = list(settings.find())

if not keys:
    print("[WARNING] No API keys found in database!")
    print("Please add keys via Admin Dashboard at http://localhost:3002")
else:
    print(f"Found {len(keys)} API key(s):\n")
    for doc in keys:
        key_name = doc.get('key')
        has_value = bool(doc.get('value'))
        value_length = len(doc.get('value', ''))
        
        status = "[OK]" if has_value else "[EMPTY]"
        print(f"{status} {key_name}")
        print(f"     Has encrypted value: {has_value}")
        print(f"     Encrypted length: {value_length} chars\n")

print("\nExpected keys for image generation:")
print("  - pexels_api_key (for Pexels stock images)")
print("  - unsplash_api_key (for Unsplash stock images)")
print("  - openai_api_key (for AI image generation)")
print("  - beebot_api_key (for content generation)")









