"""Check if Pexels API key is retrievable from database"""
import os
import sys
from pymongo import MongoClient
from cryptography.fernet import Fernet
from dotenv import load_dotenv

# Load environment
load_dotenv()

print("\n=== PEXELS API KEY CHECK ===\n")

# Connect to MongoDB
mongodb_uri = os.getenv('MONGO_URL')
db_name = os.getenv('DB_NAME', 'linkedin_pilot')

if not mongodb_uri:
    print("[ERROR] MONGO_URL not found in .env")
    sys.exit(1)

client = MongoClient(mongodb_uri)
db = client[db_name]
settings_collection = db['system_settings']

# Check for Pexels key
pexels_doc = settings_collection.find_one({'key': 'pexels_api_key'})

if not pexels_doc:
    print("[ERROR] Pexels API key NOT found in database")
    print("Please add it via Admin Dashboard at http://localhost:3002")
    sys.exit(1)

print(f"[OK] Pexels document found in database")
print(f"[OK] Encrypted value exists: {bool(pexels_doc.get('value'))}")
print(f"[OK] Encrypted value length: {len(pexels_doc.get('value', ''))} chars")

# Try to decrypt
encryption_key = os.getenv('ENCRYPTION_KEY')
if not encryption_key:
    print("[ERROR] ENCRYPTION_KEY not found in .env")
    sys.exit(1)

try:
    cipher = Fernet(encryption_key.encode())
    decrypted = cipher.decrypt(pexels_doc['value'].encode()).decode()
    print(f"\n[OK] Decryption: SUCCESS")
    print(f"[OK] Key starts with: {decrypted[:15]}...")
    print(f"[OK] Key length: {len(decrypted)} chars")
    print(f"\n[SUMMARY] Pexels API key is properly stored and retrievable!")
except Exception as e:
    print(f"\n[ERROR] Decryption FAILED: {e}")
    print("The key may have been encrypted with a different ENCRYPTION_KEY")
    sys.exit(1)

