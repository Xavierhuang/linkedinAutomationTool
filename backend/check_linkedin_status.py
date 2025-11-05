import os
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient

try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None

async def main():
    env_path = Path(__file__).parent / ".env"
    if load_dotenv and env_path.exists():
        load_dotenv(env_path)

    mongo = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.getenv("DB_NAME", "linkedin_pilot")

    client = AsyncIOMotorClient(mongo)
    db = client[db_name]

    user = await db.users.find_one({}, {"_id": 0, "id": 1, "email": 1})
    if not user:
        print("No users found in database")
        return 1

    settings = await db.user_settings.find_one({"user_id": user["id"]})
    connected = bool(settings and settings.get("linkedin_access_token"))
    print(f"User: {user.get('email', 'unknown')} | ID: {user['id']} | linkedin_connected: {connected}")
    return 0

if __name__ == "__main__":
    import asyncio, sys
    sys.exit(asyncio.run(main()))






