import os
from pathlib import Path
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

async def main():
    env_path = Path(__file__).parent / ".env"
    if load_dotenv and env_path.exists():
        load_dotenv(env_path)

    from cryptography.fernet import Fernet
    import base64, hashlib
    enc_key = os.getenv("ENCRYPTION_KEY", "").strip()
    jwt_secret = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
    legacy_key = base64.urlsafe_b64encode(hashlib.sha256(jwt_secret.encode()).digest())
    cipher_primary = Fernet(enc_key.encode() if isinstance(enc_key, str) else enc_key) if enc_key else None
    cipher_legacy = Fernet(legacy_key)

    mongo = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.getenv("DB_NAME", "linkedin_pilot")
    client = AsyncIOMotorClient(mongo)
    db = client[db_name]

    user = await db.users.find_one({}, {"_id": 0, "id": 1, "email": 1})
    if not user:
        print("No users found")
        return 1

    settings = await db.user_settings.find_one({"user_id": user["id"]}, {"_id": 0})
    if not settings:
        print(f"No user_settings for {user['id']}")
        return 2

    fields = [
        "openai_api_key",
        "google_ai_api_key",
        "openrouter_api_key",
        "anthropic_api_key",
        "pexels_api_key",
        "unsplash_access_key",
        "canva_api_key",
    ]

    print(f"User: {user.get('email','unknown')} | ID: {user['id']}")
    for f in fields:
        enc = (settings.get(f) or '').strip()
        if not enc:
            print(f"- {f}: MISSING")
            continue
        # Try primary then legacy
        decrypted = None
        if cipher_primary:
            try:
                decrypted = cipher_primary.decrypt(enc.encode()).decode()
            except Exception:
                decrypted = None
        if decrypted is None:
            try:
                decrypted = cipher_legacy.decrypt(enc.encode()).decode()
            except Exception as e:
                print(f"- {f}: DECRYPT_ERROR ({e.__class__.__name__})")
                continue
        print(f"- {f}: {mask(decrypted)}")

    return 0

if __name__ == "__main__":
    import asyncio, sys
    sys.exit(asyncio.run(main()))


