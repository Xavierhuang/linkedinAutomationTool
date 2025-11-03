import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv('backend/.env')

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'linkedpilot')

print(f"Connecting to: {mongo_url}")
print(f"Database: {db_name}\n")

client = MongoClient(mongo_url)
db = client[db_name]

# Count and list users
user_count = db.users.count_documents({})
print(f"Total users in database '{db_name}': {user_count}\n")

if user_count > 0:
    print("Users in database:")
    for user in db.users.find({}, {"_id": 0, "email": 1, "full_name": 1, "created_at": 1, "id": 1}):
        print(f"  ✅ Email: {user.get('email')}")
        print(f"     Name: {user.get('full_name')}")
        print(f"     ID: {user.get('id')}")
        print(f"     Created: {user.get('created_at')}")
        print()
else:
    print("❌ No users found!")

client.close()

