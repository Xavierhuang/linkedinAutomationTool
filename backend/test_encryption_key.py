import os
import sys
import base64

from pathlib import Path

try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None

def main() -> int:
    # Load backend/.env if present
    env_path = Path(__file__).parent / ".env"
    if load_dotenv and env_path.exists():
        load_dotenv(env_path)

    key = os.getenv("ENCRYPTION_KEY", "").strip()
    print(f"ENCRYPTION_KEY present: {bool(key)}")
    if not key:
        print("ERROR: ENCRYPTION_KEY not found in environment or .env")
        return 1

    # Validate Fernet key shape
    try:
        raw = base64.urlsafe_b64decode(key)
        print(f"Decoded bytes length: {len(raw)} (expected 32)")
    except Exception as e:
        print(f"ERROR: ENCRYPTION_KEY is not valid urlsafe base64: {e}")
        return 2

    # Try encrypt/decrypt a sample
    try:
        from cryptography.fernet import Fernet
        cipher = Fernet(key.encode() if isinstance(key, str) else key)
        plaintext = b"encryption-key-self-test"
        token = cipher.encrypt(plaintext)
        roundtrip = cipher.decrypt(token)
        ok = roundtrip == plaintext
        print(f"Encrypt/Decrypt roundtrip OK: {ok}")
        if not ok:
            print("ERROR: Decrypted bytes did not match input")
            return 3
    except Exception as e:
        print(f"ERROR: Fernet operation failed: {e}")
        return 4

    print("SUCCESS: ENCRYPTION_KEY loaded and working")
    return 0

if __name__ == "__main__":
    sys.exit(main())


