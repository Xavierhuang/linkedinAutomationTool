"""Check latest Beebot generation and verify Gemini 2.5 Flash usage"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv('backend/.env')

async def check_latest_generation():
    # Connect to MongoDB
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    
    print("=" * 60)
    print("CHECKING LATEST BEEBOT GENERATIONS")
    print("=" * 60)
    
    # Get most recent image generation
    print("\n1. Latest Image Generation Log:")
    print("-" * 60)
    latest_image = await db.prompt_history.find_one(
        {"prompt_type": "image_generation"},
        sort=[("created_at", -1)]
    )
    
    if latest_image:
        print(f"User ID: {latest_image.get('user_id', 'N/A')}")
        print(f"Org ID: {latest_image.get('org_id', 'N/A')}")
        print(f"Model Used: {latest_image.get('model_used', 'N/A')}")
        print(f"Provider: {latest_image.get('provider_used', 'N/A')}")
        print(f"Success: {latest_image.get('success', False)}")
        print(f"Created At: {latest_image.get('created_at', 'N/A')}")
        print(f"\nPrompt Preview:")
        prompt = latest_image.get('image_prompt', '')
        print(prompt[:200] + "..." if len(prompt) > 200 else prompt)
        print(f"\nGenerated Image URL: {latest_image.get('generated_image_url', 'N/A')[:100]}...")
        
        if 'gemini' in latest_image.get('model_used', '').lower() or latest_image.get('model_used', '') == 'google/gemini-2.5-flash-image':
            print("\n[SUCCESS] Gemini 2.5 Flash Image was used!")
        elif latest_image.get('model_used', '').lower() == 'stock photo':
            print("\n[WARNING] Stock Photo was used (fallback)")
        else:
            print(f"\n[WARNING] Different model used: {latest_image.get('model_used', 'N/A')}")
    else:
        print("No image generations found in prompt_history")
    
    # Get recent text generations
    print("\n2. Recent Text Generations:")
    print("-" * 60)
    recent_text = await db.prompt_history.find(
        {"prompt_type": "text_generation"},
        sort=[("created_at", -1)]
    ).limit(5).to_list(length=5)
    
    for i, item in enumerate(recent_text, 1):
        print(f"\n{i}. Model: {item.get('model_used', 'N/A')} | Provider: {item.get('provider_used', 'N/A')}")
        print(f"   Created: {item.get('created_at', 'N/A')}")
    
    # Check API key configuration
    print("\n3. API Key Configuration:")
    print("-" * 60)
    system_keys = await db.system_settings.find_one({"_id": "api_keys"})
    
    if system_keys:
        google_ai = system_keys.get('google_ai_api_key', None)
        openrouter = system_keys.get('openrouter_api_key', None)
        print(f"Google AI Studio Key: {'[OK] Configured' if google_ai else '[MISSING]'}")
        print(f"OpenRouter API Key: {'[OK] Configured' if openrouter else '[MISSING]'}")
        
        if google_ai:
            try:
                from cryptography.fernet import Fernet
                ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', '')
                if ENCRYPTION_KEY:
                    cipher_suite = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
                    decrypted = cipher_suite.decrypt(google_ai.encode()).decode()
                    print(f"Google AI Key Preview: {decrypted[:8]}...{decrypted[-4:]}")
            except Exception as e:
                print(f"Error decrypting Google AI key: {e}")
    else:
        print("[ERROR] No system API keys found")
    
    print("\n" + "=" * 60)
    client.close()

if __name__ == "__main__":
    asyncio.run(check_latest_generation())
