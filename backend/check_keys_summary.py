#!/usr/bin/env python3
"""
Summarize saved API keys (system and user) and whether they decrypt correctly.
This prints presence/decryptability only; never prints full secrets.
"""
import os
import asyncio
import base64
import hashlib
from typing import Dict, Any

from motor.motor_asyncio import AsyncIOMotorClient
from cryptography.fernet import Fernet

try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except Exception:
    pass

KEY_FIELDS = [
    "google_ai_api_key",
    "openai_api_key",
    "openrouter_api_key",
    "anthropic_api_key",
    "pexels_api_key",
    "unsplash_api_key",
    "canva_api_key",
]

async def summarize_system_keys(db) -> Dict[str, Any]:
    report: Dict[str, Any] = {"document": False, "keys": {}}
    doc = await db.system_settings.find_one({"_id": "api_keys"})
    if not doc:
        return report
    report["document"] = True

    enc = os.environ.get("ENCRYPTION_KEY", "")
    legacy_secret = os.environ.get("JWT_SECRET_KEY", "your-secret-key-change-in-production")
    legacy_key = base64.urlsafe_b64encode(hashlib.sha256(legacy_secret.encode()).digest())

    cipher_primary = Fernet(enc.encode() if isinstance(enc, str) and enc else enc) if enc else None
    cipher_legacy = Fernet(legacy_key)

    for field in KEY_FIELDS:
        value = doc.get(field, "")
        status = {"present": bool(value), "decrypt_primary": False, "decrypt_legacy": False}
        if value:
            # Try primary
            if cipher_primary:
                try:
                    _ = cipher_primary.decrypt(value.encode()).decode()
                    status["decrypt_primary"] = True
                except Exception:
                    pass
            # Try legacy
            try:
                _ = cipher_legacy.decrypt(value.encode()).decode()
                status["decrypt_legacy"] = True
            except Exception:
                pass
        report["keys"][field] = status

    return report

async def summarize_first_user_keys(db) -> Dict[str, Any]:
    report: Dict[str, Any] = {"user_id": None, "settings": False, "keys": {}}

    user = await db.users.find_one({})
    if not user:
        return report
    user_id = user.get("id") or str(user.get("_id", ""))
    report["user_id"] = user_id

    settings = await db.settings.find_one({"user_id": user_id})
    if not settings:
        return report
    report["settings"] = True

    enc = os.environ.get("ENCRYPTION_KEY", "")
    legacy_secret = os.environ.get("JWT_SECRET_KEY", "your-secret-key-change-in-production")
    legacy_key = base64.urlsafe_b64encode(hashlib.sha256(legacy_secret.encode()).digest())

    cipher_primary = Fernet(enc.encode() if isinstance(enc, str) and enc else enc) if enc else None
    cipher_legacy = Fernet(legacy_key)

    for field in KEY_FIELDS:
        value = settings.get(field, "")
        status = {"present": bool(value), "decrypt_primary": False, "decrypt_legacy": False}
        if value:
            if cipher_primary:
                try:
                    _ = cipher_primary.decrypt(value.encode()).decode()
                    status["decrypt_primary"] = True
                except Exception:
                    pass
            try:
                _ = cipher_legacy.decrypt(value.encode()).decode()
                status["decrypt_legacy"] = True
            except Exception:
                pass
        report["keys"][field] = status

    return report

async def main():
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "linkedin_pilot")

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    try:
        await client.admin.command("ping")
    except Exception as e:
        print({"ok": False, "error": f"Mongo connection failed: {e}"})
        return

    system_report = await summarize_system_keys(db)
    user_report = await summarize_first_user_keys(db)

    print({
        "ok": True,
        "system": system_report,
        "user_sample": user_report,
    })

    client.close()

if __name__ == "__main__":
    asyncio.run(main())




