import os
from pathlib import Path
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient

try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None

def mask(v: str) -> str:
    if not v:
        return ""
    if len(v) <= 8:
        return "*" * len(v)
    return f"{v[:4]}***{v[-4:]}"

async def main(user_id: Optional[str] = None, org_id: Optional[str] = None) -> int:
    # Load env
    env_path = Path(__file__).parent / ".env"
    if load_dotenv and env_path.exists():
        load_dotenv(env_path)

    from cryptography.fernet import Fernet

    enc = os.getenv("ENCRYPTION_KEY", "").strip()
    if not enc:
        print("ERROR: ENCRYPTION_KEY missing")
        return 1
    cipher = Fernet(enc.encode() if isinstance(enc, str) else enc)

    mongo = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.getenv("DB_NAME", "linkedin_pilot")
    client = AsyncIOMotorClient(mongo)
    db = client[db_name]

    # Default to first user/org if not provided
    if not user_id:
        u = await db.users.find_one({}, {"_id": 0, "id": 1, "email": 1})
        if not u:
            print("No users found")
            return 2
        user_id = u["id"]
        print(f"User: {u.get('email','unknown')} ({user_id})")
    if not org_id:
        o = await db.organizations.find_one({}, {"_id": 0, "id": 1, "name": 1})
        if o:
            org_id = o["id"]
            print(f"Org: {o.get('name','unknown')} ({org_id})")

    # 1) Copy selected system API keys to user's settings if missing
    system = await db.system_settings.find_one(
        {"_id": "api_keys"},
        {"google_ai_api_key": 1, "pexels_api_key": 1, "unsplash_access_key": 1, "_id": 0}
    )
    if system and system.get("google_ai_api_key"):
        try:
            # system key is stored encrypted; decrypt then encrypt for user
            sys_enc = system["google_ai_api_key"].strip()
            sys_dec = cipher.decrypt(sys_enc.encode()).decode()
            user_settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0}) or {"user_id": user_id}
            if not user_settings.get("google_ai_api_key"):
                user_settings["google_ai_api_key"] = cipher.encrypt(sys_dec.encode()).decode()
                await db.user_settings.update_one({"user_id": user_id}, {"$set": user_settings}, upsert=True)
                print(f"Set user google_ai_api_key: {mask(sys_dec)}")
            else:
                print("User google_ai_api_key already present")
        except Exception as e:
            print(f"WARNING: Failed to set user google key: {e}")
    else:
        print("No system google_ai_api_key found")

    # Pexels
    if system and system.get("pexels_api_key"):
        try:
            sys_enc = system["pexels_api_key"].strip()
            sys_dec = cipher.decrypt(sys_enc.encode()).decode()
            user_settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0}) or {"user_id": user_id}
            if not user_settings.get("pexels_api_key"):
                user_settings["pexels_api_key"] = cipher.encrypt(sys_dec.encode()).decode()
                await db.user_settings.update_one({"user_id": user_id}, {"$set": user_settings}, upsert=True)
                print(f"Set user pexels_api_key: {mask(sys_dec)}")
            else:
                print("User pexels_api_key already present")
        except Exception as e:
            print(f"WARNING: Failed to set user pexels key: {e}")
    else:
        print("No system pexels_api_key found")

    # Unsplash
    if system and system.get("unsplash_access_key"):
        try:
            sys_enc = system["unsplash_access_key"].strip()
            sys_dec = cipher.decrypt(sys_enc.encode()).decode()
            user_settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0}) or {"user_id": user_id}
            if not user_settings.get("unsplash_access_key"):
                user_settings["unsplash_access_key"] = cipher.encrypt(sys_dec.encode()).decode()
                await db.user_settings.update_one({"user_id": user_id}, {"$set": user_settings}, upsert=True)
                print(f"Set user unsplash_access_key: {mask(sys_dec)}")
            else:
                print("User unsplash_access_key already present")
        except Exception as e:
            print(f"WARNING: Failed to set user unsplash key: {e}")
    else:
        print("No system unsplash_access_key found")

    # 2) Ensure LinkedIn token present in user_settings; if only in org, copy over; if only in user, copy to org
    user_settings = await db.user_settings.find_one({"user_id": user_id})
    org = await db.organizations.find_one({"id": org_id}) if org_id else None

    user_tok = user_settings.get('linkedin_access_token') if user_settings else None
    org_tok = org.get('linkedin_access_token') if org else None

    if not user_tok and org_tok:
        await db.user_settings.update_one(
            {"user_id": user_id},
            {"$set": {
                "linkedin_access_token": org.get('linkedin_access_token'),
                "linkedin_token_expires": org.get('linkedin_token_expires'),
                "linkedin_profile": org.get('linkedin_profile', {}),
                "linkedin_sub": org.get('linkedin_sub'),
                "linkedin_person_urn": org.get('linkedin_person_urn'),
                "linkedin_organization_id": org.get('linkedin_organization_id')
            }},
            upsert=True
        )
        print("Copied LinkedIn token from org -> user_settings")
    elif user_tok and org and not org_tok:
        await db.organizations.update_one(
            {"id": org_id},
            {"$set": {
                "linkedin_access_token": user_settings.get('linkedin_access_token'),
                "linkedin_token_expires": user_settings.get('linkedin_token_expires'),
                "linkedin_profile": user_settings.get('linkedin_profile', {}),
                "linkedin_sub": user_settings.get('linkedin_sub'),
                "linkedin_person_urn": user_settings.get('linkedin_person_urn'),
                "linkedin_organization_id": user_settings.get('linkedin_organization_id')
            }}
        )
        print("Copied LinkedIn token from user_settings -> org")
    else:
        print("LinkedIn tokens present or no org available")

    return 0

if __name__ == "__main__":
    import asyncio, sys
    sys.exit(asyncio.run(main()))


