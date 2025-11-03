"""
Test script to manually trigger content generation for Tech Time Savers campaign
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
from datetime import datetime
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from linkedpilot.adapters.ai_content_generator import AIContentGenerator
from linkedpilot.models.campaign import AIGeneratedPostStatus

load_dotenv()

async def test_generation():
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
    db = client[os.environ.get('DB_NAME', 'linkedin_pilot')]
    
    # Get Tech Time Savers campaign
    campaign = await db.campaigns.find_one({'name': 'Tech Time Savers'}, {'_id': 0})
    
    if not campaign:
        print("❌ Tech Time Savers campaign not found!")
        return
    
    print("\n" + "="*80)
    print("TECH TIME SAVERS CAMPAIGN")
    print("="*80)
    print(f"ID: {campaign.get('id')}")
    print(f"Org ID: {campaign.get('org_id')}")
    print(f"Status: {campaign.get('status')}")
    print(f"Auto-post: {campaign.get('auto_post')}")
    print(f"Frequency: {campaign.get('posting_schedule', {}).get('frequency')}")
    print(f"Last generation: {campaign.get('last_generation_time')}")
    print(f"Created by: {campaign.get('created_by')}")
    
    # Get user settings
    user_id = campaign.get('created_by')
    print(f"\nLooking for settings with user_id: {user_id}")
    
    settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})
    
    if not settings:
        print("❌ No settings found for this user!")
        print("\nTrying to find settings by org_id...")
        settings = await db.user_settings.find_one({"org_id": campaign.get('org_id')}, {"_id": 0})
        
        if settings:
            print(f"✅ Found settings by org_id")
        else:
            print("❌ No settings found by org_id either!")
            
            # List all settings to debug
            all_settings = await db.user_settings.find({}, {"_id": 0, "user_id": 1, "org_id": 1}).to_list(length=10)
            print(f"\nAll user_settings in database:")
            for s in all_settings:
                print(f"  - user_id: {s.get('user_id')}, org_id: {s.get('org_id')}")
            
            client.close()
            return
    
    print(f"\n✅ Found settings!")
    print(f"Settings keys: {list(settings.keys())}")
    
    # Check for API keys
    api_keys_found = []
    if settings.get('openai_api_key'):
        api_keys_found.append('OpenAI')
    if settings.get('anthropic_api_key'):
        api_keys_found.append('Anthropic')
    if settings.get('google_ai_api_key'):
        api_keys_found.append('Google AI')
    if settings.get('openrouter_api_key'):
        api_keys_found.append('OpenRouter')
    
    print(f"API keys found: {', '.join(api_keys_found) if api_keys_found else 'NONE!'}")
    
    if not api_keys_found:
        print("\n❌ NO API KEYS CONFIGURED!")
        print("This is why the campaign isn't generating content.")
        print("\nTo fix:")
        print("1. Go to Settings > API Keys in the UI")
        print("2. Add at least one API key (OpenAI, Anthropic, Google AI, or OpenRouter)")
        client.close()
        return
    
    # Try to generate content
    print(f"\n{'='*80}")
    print("ATTEMPTING CONTENT GENERATION")
    print("="*80)
    
    try:
        # Decrypt function (same as scheduler)
        import base64
        import hashlib
        from cryptography.fernet import Fernet
        
        def decrypt_api_key(encrypted_key: str) -> str:
            try:
                if not encrypted_key or not encrypted_key.startswith('gAAAAA'):
                    return encrypted_key
                JWT_SECRET = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
                ENCRYPTION_KEY = base64.urlsafe_b64encode(hashlib.sha256(JWT_SECRET.encode()).digest())
                cipher_suite = Fernet(ENCRYPTION_KEY)
                return cipher_suite.decrypt(encrypted_key.encode()).decode()
            except:
                return encrypted_key
        
        # Get first available API key
        api_key = None
        provider = None
        
        if settings.get('openai_api_key'):
            api_key = decrypt_api_key(settings['openai_api_key'])
            provider = 'openai'
        elif settings.get('google_ai_api_key'):
            api_key = decrypt_api_key(settings['google_ai_api_key'])
            provider = 'gemini'
        elif settings.get('anthropic_api_key'):
            api_key = decrypt_api_key(settings['anthropic_api_key'])
            provider = 'claude'
        elif settings.get('openrouter_api_key'):
            api_key = decrypt_api_key(settings['openrouter_api_key'])
            provider = 'openrouter'
        
        if not api_key:
            print("❌ Failed to get API key!")
            client.close()
            return
        
        print(f"Using provider: {provider}")
        print(f"API key starts with: {api_key[:15]}...")
        
        # Initialize generator
        generator = AIContentGenerator(
            api_key=api_key,
            provider=provider
        )
        
        # Generate content
        print("\n🤖 Generating content...")
        result = await generator.generate_post_for_campaign(campaign)
        
        print(f"\n✅ CONTENT GENERATED SUCCESSFULLY!")
        print(f"Content length: {len(result['content'])} characters")
        print(f"Content pillar: {result.get('content_pillar')}")
        print(f"Provider: {result.get('provider')}")
        print(f"\nContent preview:")
        print("-"*80)
        print(result['content'][:200] + "...")
        print("-"*80)
        
        # Save to database
        auto_post = campaign.get('auto_post', False)
        
        ai_post = {
            "id": f"aipost_{int(datetime.utcnow().timestamp()*1000)}",
            "campaign_id": campaign.get('id'),
            "org_id": campaign.get('org_id'),
            "content": result['content'],
            "generation_prompt": result['generation_prompt'],
            "content_pillar": result.get('content_pillar'),
            "content_type": result.get('content_type', 'text'),
            "image_url": None,
            "status": AIGeneratedPostStatus.APPROVED.value if auto_post else AIGeneratedPostStatus.PENDING_REVIEW.value,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        await db.ai_generated_posts.insert_one(ai_post)
        
        # Update campaign
        await db.campaigns.update_one(
            {"id": campaign.get('id')},
            {
                "$inc": {"total_posts": 1},
                "$set": {"last_generation_time": datetime.utcnow().isoformat()}
            }
        )
        
        print(f"\n✅ POST SAVED TO DATABASE!")
        print(f"Post ID: {ai_post['id']}")
        print(f"Status: {ai_post['status']}")
        print(f"Auto-post: {auto_post}")
        
        if auto_post:
            print("\n🚀 Auto-post is enabled - post will be auto-scheduled to calendar!")
        else:
            print("\n📋 Post is in review queue - needs manual approval")
        
    except Exception as e:
        print(f"\n❌ GENERATION FAILED: {e}")
        import traceback
        traceback.print_exc()
    
    client.close()

if __name__ == "__main__":
    asyncio.run(test_generation())
