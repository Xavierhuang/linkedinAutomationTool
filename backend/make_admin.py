"""
Quick script to make a user an admin
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def make_admin():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    
    # Make hhuangweijia@gmail.com a superadmin
    email = "hhuangweijia@gmail.com"
    
    # Try to find user by email
    user = await db.users.find_one({"email": email})
    
    if not user:
        print(f"❌ User with email containing '{email}' not found")
        print(f"\n🔍 Available users:")
        users = await db.users.find({}, {"_id": 0, "email": 1, "full_name": 1}).to_list(length=100)
        for u in users:
            print(f"   - {u.get('email')} ({u.get('full_name')})")
        client.close()
        return
    
    # Update user to superadmin
    result = await db.users.update_one(
        {"id": user['id']},
        {"$set": {"role": "superadmin"}}
    )
    
    if result.modified_count > 0:
        print(f"✅ SUCCESS! {user.get('email')} is now a SUPERADMIN!")
        print(f"\n📋 User Details:")
        print(f"   Email: {user.get('email')}")
        print(f"   Name: {user.get('full_name')}")
        print(f"   Role: superadmin")
        print(f"\n🔐 Login Credentials:")
        print(f"   URL: http://localhost:3002/login")
        print(f"   Email: {user.get('email')}")
        print(f"   Password: (your existing password)")
    else:
        print(f"ℹ️  User already has superadmin role")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(make_admin())










