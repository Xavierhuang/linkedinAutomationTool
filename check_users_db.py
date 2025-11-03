import os
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
from dotenv import load_dotenv

load_dotenv('backend/.env')

async def check_users():
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'linkedpilot')
    
    print(f"Connecting to: {mongo_url}")
    print(f"Database: {db_name}\n")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Count users
    user_count = await db.users.count_documents({})
    print(f"Total users in database: {user_count}\n")
    
    if user_count > 0:
        print("Users found:")
        async for user in db.users.find({}, {"_id": 0, "email": 1, "full_name": 1, "created_at": 1}):
            print(f"  - Email: {user.get('email')}")
            print(f"    Name: {user.get('full_name')}")
            print(f"    Created: {user.get('created_at')}")
            print()
    else:
        print("❌ No users found in database!")
        print("   You need to sign up to create an account.")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_users())

