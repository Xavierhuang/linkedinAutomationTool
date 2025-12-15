"""
Test script to verify Gemini 3 Pro Image Preview image generation
Uses API key from admin dashboard system settings
"""
import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from cryptography.fernet import Fernet
import base64
import hashlib
import httpx
import json

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def get_system_api_key(key_type: str = "google_ai_studio"):
    """Get system-wide API key from admin-managed settings"""
    print(f"\n[TEST] Looking up system API key (type: {key_type})...")
    
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'linkedpilot')
    
    try:
        client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
        db = client[db_name]
        
        # Retrieve from system_settings collection
        system_settings = await db.system_settings.find_one({"_id": "api_keys"})
        
        if not system_settings:
            print(f"   [ERROR] No system API keys configured")
            return None, None
        
        print(f"   [SUCCESS] System settings found: {list(system_settings.keys())}")
        
        # Get Google AI API key
        if key_type == "google_ai_studio" or key_type == "google_ai":
            key_field = 'google_ai_api_key'
            provider = 'google_ai_studio'
        else:
            key_field = f'{key_type}_api_key'
            provider = key_type
        
        if not system_settings.get(key_field):
            print(f"   [ERROR] No {key_field} found")
            return None, None
        
        print(f"   [SUCCESS] Found {key_field}")
        
        # Decrypt the API key
        ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', '')
        JWT_SECRET = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
        legacy_key = base64.urlsafe_b64encode(hashlib.sha256(JWT_SECRET.encode()).digest())
        
        cipher_primary = None
        cipher_legacy = None
        if ENCRYPTION_KEY:
            cipher_primary = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
        cipher_legacy = Fernet(legacy_key)
        
        encrypted_key = system_settings.get(key_field, '')
        if encrypted_key:
            try:
                decrypted_key = (cipher_primary.decrypt(encrypted_key.encode()).decode() if cipher_primary else None)
                if decrypted_key:
                    print(f"   [SUCCESS] Decrypted {key_field} with ENCRYPTION_KEY: {decrypted_key[:10]}...{decrypted_key[-4:]}")
                    client.close()
                    return decrypted_key, provider
            except Exception as e:
                print(f"   [WARNING] Primary decryption failed: {e}")
            
            # Fallback to legacy
            try:
                decrypted_key = cipher_legacy.decrypt(encrypted_key.encode()).decode()
                print(f"   [SUCCESS] Decrypted {key_field} with legacy key: {decrypted_key[:10]}...{decrypted_key[-4:]}")
                client.close()
                return decrypted_key, provider
            except Exception as e2:
                print(f"   [ERROR] Failed to decrypt {key_field} with both keys: {e2}")
        
        client.close()
        return None, None
        
    except Exception as e:
        print(f"   [ERROR] Database error: {e}")
        import traceback
        traceback.print_exc()
        return None, None

async def test_gemini_3_pro_image(api_key: str):
    """Test Gemini 3 Pro Image Preview image generation"""
    print(f"\n{'='*60}")
    print(f"[TEST] Testing Gemini 3 Pro Image Preview")
    print(f"{'='*60}")
    
    model_name = "gemini-3-pro-image-preview"
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
    
    test_prompt = "A professional LinkedIn post image showing a modern office workspace with a laptop, coffee cup, and plants. Clean, minimalist design with soft lighting."
    
    # Request body according to Google docs
    request_body = {
        "contents": [{
            "parts": [{
                "text": test_prompt
            }]
        }],
        "generationConfig": {
            "responseModalities": ["TEXT", "IMAGE"],  # REQUIRED for Gemini 3 Pro
            "imageConfig": {
                "aspectRatio": "1:1",
                "imageSize": "1K"  # 1K resolution (1024x1024)
            }
        }
    }
    
    print(f"\n[TEST] API Details:")
    print(f"   Endpoint: {endpoint}")
    print(f"   Model: {model_name}")
    print(f"   API Key: {api_key[:10]}...{api_key[-4:]}")
    print(f"   Prompt: {test_prompt[:80]}...")
    print(f"\n[TEST] Request Body:")
    print(json.dumps(request_body, indent=2))
    
    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            print(f"\n[TEST] Sending request to Google API...")
            response = await client.post(
                endpoint,
                headers={
                    "x-goog-api-key": api_key,
                    "Content-Type": "application/json"
                },
                json=request_body
            )
            
            print(f"\n[TEST] Response Status: {response.status_code}")
            print(f"[TEST] Response Headers: {dict(response.headers)}")
            
            if response.status_code != 200:
                print(f"\n[ERROR] API returned error status {response.status_code}")
                print(f"[ERROR] Response body: {response.text[:500]}")
                return False
            
            result = response.json()
            print(f"\n[TEST] Response structure:")
            print(f"   Keys: {list(result.keys())}")
            
            if result.get('candidates') and len(result['candidates']) > 0:
                candidate = result['candidates'][0]
                content = candidate.get('content', {})
                parts = content.get('parts', [])
                
                print(f"\n[SUCCESS] Response received!")
                print(f"   Parts count: {len(parts)}")
                
                # Find image content
                image_found = False
                for i, part in enumerate(parts):
                    print(f"\n   Part {i}:")
                    print(f"      Keys: {list(part.keys())}")
                    
                    if 'text' in part:
                        print(f"      Text: {part['text'][:100]}...")
                    
                    inline_data = part.get('inlineData') or part.get('inline_data')
                    if inline_data:
                        image_found = True
                        data = inline_data.get('data', '')
                        mime_type = inline_data.get('mimeType') or inline_data.get('mime_type', 'image/png')
                        print(f"      [IMAGE FOUND]")
                        print(f"      MIME type: {mime_type}")
                        print(f"      Data length: {len(data)} characters")
                        print(f"      Data preview: {data[:50]}...")
                        
                        # Save image
                        import base64 as b64
                        image_bytes = b64.b64decode(data)
                        output_file = "test_gemini_image.png"
                        with open(output_file, 'wb') as f:
                            f.write(image_bytes)
                        print(f"\n[SUCCESS] Image saved to: {output_file}")
                        print(f"   File size: {len(image_bytes)} bytes")
                        return True
                
                if not image_found:
                    print(f"\n[ERROR] No image data found in response")
                    print(f"[ERROR] Full response: {json.dumps(result, indent=2)[:1000]}")
                    return False
            else:
                print(f"\n[ERROR] No candidates in response")
                print(f"[ERROR] Full response: {json.dumps(result, indent=2)[:1000]}")
                return False
                
    except httpx.HTTPStatusError as e:
        print(f"\n[ERROR] HTTP Status Error: {e}")
        print(f"[ERROR] Status Code: {e.response.status_code}")
        print(f"[ERROR] Response: {e.response.text[:500]}")
        return False
    except Exception as e:
        print(f"\n[ERROR] Exception: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    print(f"\n{'='*60}")
    print(f"Gemini 3 Pro Image Preview Test Script")
    print(f"{'='*60}")
    
    # Step 1: Get API key
    api_key, provider = await get_system_api_key("google_ai_studio")
    
    if not api_key:
        print(f"\n[ERROR] Could not retrieve Google AI API key from admin settings")
        print(f"[ERROR] Please ensure the API key is configured in Admin Dashboard > API Keys")
        return 1
    
    # Step 2: Test image generation
    success = await test_gemini_3_pro_image(api_key)
    
    if success:
        print(f"\n{'='*60}")
        print(f"[SUCCESS] Test completed successfully!")
        print(f"{'='*60}")
        return 0
    else:
        print(f"\n{'='*60}")
        print(f"[FAILURE] Test failed - check errors above")
        print(f"{'='*60}")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)








