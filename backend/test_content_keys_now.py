"""Test if content generation keys can be retrieved"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from linkedpilot.routes.drafts import get_system_api_key

async def test():
    print("\n=== TESTING CONTENT GENERATION KEY RETRIEVAL ===\n")
    
    # Test OpenAI
    print("[1] Testing OpenAI key retrieval...")
    openai_key, provider = await get_system_api_key("openai")
    if openai_key:
        print(f"   [OK] OpenAI Key: {openai_key[:15]}...{openai_key[-4:]} (Provider: {provider})")
    else:
        print(f"   [ERROR] OpenAI Key: NOT FOUND")
    
    print()
    
    # Test OpenRouter
    print("[2] Testing OpenRouter key retrieval...")
    openrouter_key, provider = await get_system_api_key("openrouter")
    if openrouter_key:
        print(f"   [OK] OpenRouter Key: {openrouter_key[:15]}...{openrouter_key[-4:]} (Provider: {provider})")
    else:
        print(f"   [ERROR] OpenRouter Key: NOT FOUND")
    
    print()
    
    # Test Anthropic
    print("[3] Testing Anthropic key retrieval...")
    anthropic_key, provider = await get_system_api_key("anthropic")
    if anthropic_key:
        print(f"   [OK] Anthropic Key: {anthropic_key[:15]}...{anthropic_key[-4:]} (Provider: {provider})")
    else:
        print(f"   [ERROR] Anthropic Key: NOT FOUND")
    
    print()
    
    # Test ANY
    print("[4] Testing ANY key retrieval (fallback)...")
    any_key, provider = await get_system_api_key("any")
    if any_key:
        print(f"   [OK] ANY Key: {any_key[:15]}...{any_key[-4:]} (Provider: {provider})")
    else:
        print(f"   [ERROR] NO keys found at all!")
    
    print()
    
    # Direct database check
    print("[5] Direct database check...")
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import load_dotenv
    load_dotenv()
    
    client = AsyncIOMotorClient(os.getenv('MONGODB_URI'))
    db = client['linkedpilot']
    settings = await db.system_settings.find_one({"_id": "api_keys"})
    
    if settings:
        print(f"   [OK] system_settings document found")
        print(f"   Keys in document:")
        for key in ['openai_api_key', 'openrouter_api_key', 'anthropic_api_key', 'google_ai_api_key']:
            if settings.get(key):
                print(f"      - {key}: EXISTS (encrypted)")
            else:
                print(f"      - {key}: NOT SET")
    else:
        print(f"   [ERROR] No system_settings document!")
    
    client.close()
    print()

if __name__ == '__main__':
    asyncio.run(test())









