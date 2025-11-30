import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def find_user():
    mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.getenv("DB_NAME", "linkedin_pilot")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print(f"Searching for users in {db_name}...")
    
    # Search for Jimmy
    users = await db.users.find({"$or": [
        {"name": {"$regex": "Jimmy", "$options": "i"}},
        {"email": {"$regex": "jimmy", "$options": "i"}}
    ]}).to_list(length=10)
    
    if users:
        print(f"Found {len(users)} user(s):")
        for user in users:
            print(f"Name: {user.get('name')}")
            print(f"Email: {user.get('email')}")
            print(f"ID: {user.get('id')}")
            print("-" * 20)
    else:
        print("No user found matching 'Jimmy'. Listing all users:")
        all_users = await db.users.find({}).to_list(length=5)
        for user in all_users:
            print(f"Name: {user.get('name')}, Email: {user.get('email')}")

if __name__ == "__main__":
    asyncio.run(find_user())
