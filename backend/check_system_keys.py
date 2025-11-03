import os
import sys
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient

try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None

def mask(value: str) -> str:
    if not value:
        return ""
    v = str(value)
    if len(v) <= 8:
        return "*" * len(v)
    return f"{v[:4]}***{v[-4:]}"

async def main() -> int:
    # Load .env
    env_path = Path(__file__).parent / ".env"
    if load_dotenv and env_path.exists():
        load_dotenv(env_path)

    mongo = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "linkedin_pilot")
    enc_key = os.environ.get("ENCRYPTION_KEY", "").strip()

    from cryptography.fernet import Fernet
    if not enc_key:
        print("ERROR: ENCRYPTION_KEY missing")
        return 1

    cipher = Fernet(enc_key.encode() if isinstance(enc_key, str) else enc_key)

    client = AsyncIOMotorClient(mongo)
    db = client[db_name]

    doc = await db.system_settings.find_one({"_id": "api_keys"})
    if not doc:
        print("system_settings.api_keys: NOT FOUND")
        return 2

    fields = [
        "openai_api_key",
        "openrouter_api_key",
        "anthropic_api_key",
        "google_ai_api_key",
        "linkedin_client_id",
        "linkedin_client_secret",
        "unsplash_access_key",
        "pexels_api_key",
        "canva_api_key",
        "stripe_secret_key",
        "stripe_publishable_key",
        "stripe_webhook_secret",
        "stripe_pro_price_id",
    ]

    print("system_settings.api_keys present fields (masked, decrypted):")
    for f in fields:
        enc = (doc.get(f) or "").strip()
        if not enc:
            print(f"- {f}: MISSING")
            continue
        try:
            dec = cipher.decrypt(enc.encode()).decode()
            print(f"- {f}: {mask(dec)}")
        except Exception as e:
            print(f"- {f}: DECRYPT_ERROR ({e.__class__.__name__})")

    return 0

if __name__ == "__main__":
    import asyncio
    sys.exit(asyncio.run(main()))


