import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv('backend/.env')

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')

print(f"Connecting to: {mongo_url}\n")

client = MongoClient(mongo_url)

# List all databases
print("Available databases:")
for db_name in client.list_database_names():
    db = client[db_name]
    if 'users' in db.list_collection_names():
        user_count = db.users.count_documents({})
        if user_count > 0:
            print(f"  ✅ {db_name} - {user_count} users found")
        else:
            print(f"  ⚪ {db_name} - users collection exists but empty")
    else:
        print(f"  ⚪ {db_name} - no users collection")

print(f"\nCurrent .env setting: DB_NAME={os.environ.get('DB_NAME', 'linkedpilot')}")

client.close()

