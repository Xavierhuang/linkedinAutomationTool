#!/usr/bin/env python3
"""
Check all recent posts from all collections
"""
import os
import sys
from datetime import datetime
from pymongo import MongoClient

MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'linkedin_pilot')

try:
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("=" * 80)
    print("CHECKING ALL RECENT POSTS FROM ALL COLLECTIONS")
    print("=" * 80)
    print()
    
    # Get most recent posts from all collections
    collections_to_check = ['ai_content_posts', 'posts', 'scheduled_posts']
    
    all_recent = []
    
    for collection_name in collections_to_check:
        collection = db[collection_name]
        posts = list(collection.find({}).sort("created_at", -1).limit(3))
        for post in posts:
            post['_collection'] = collection_name
            all_recent.append(post)
    
    # Sort by created_at
    all_recent.sort(key=lambda x: x.get('created_at', ''), reverse=True)
    
    print(f"Found {len(all_recent)} most recent posts across all collections:")
    print()
    
    for i, post in enumerate(all_recent[:10], 1):
        print("=" * 80)
        print(f"POST #{i} (from {post.get('_collection', 'unknown')})")
        print("=" * 80)
        print(f"ID: {post.get('id', 'N/A')}")
        created_at = post.get('created_at', post.get('published_at', post.get('scheduled_time', 'N/A')))
        print(f"Created At: {created_at}")
        print(f"Campaign ID: {post.get('campaign_id', 'N/A')}")
        print(f"Campaign Name: {post.get('campaign_name', 'N/A')}")
        print()
        print("IMAGE MODEL INFORMATION:")
        print("-" * 80)
        print(f"image_model field: {post.get('image_model', 'NOT SET')}")
        print(f"provider_used field: {post.get('provider_used', 'NOT SET')}")
        print(f"model_used field: {post.get('model_used', 'NOT SET')}")
        
        # Check draft preview if it's a scheduled post
        if 'draft_preview' in post:
            draft = post.get('draft_preview', {})
            assets = draft.get('assets', [])
            if assets:
                for asset in assets:
                    if asset.get('type') == 'image':
                        print(f"Image URL from draft: {asset.get('url', 'N/A')[:100]}...")
        
        image_url = post.get('image_url') or post.get('image_base64', '')
        if image_url:
            if isinstance(image_url, str):
                if 'dall-e' in image_url.lower():
                    print(f"⚠️  IMAGE SOURCE: DALL-E (detected from URL)")
                elif 'data:image' in image_url:
                    print(f"✓ IMAGE SOURCE: Gemini (base64 data URL)")
                elif 'unsplash' in image_url.lower() or 'pexels' in image_url.lower():
                    print(f"✓ IMAGE SOURCE: Stock Photo")
        
        print()
        
        # Final determination
        image_model = str(post.get('image_model', '')).lower()
        provider_used = str(post.get('provider_used', '')).lower()
        model_used = str(post.get('model_used', '')).lower()
        
        if 'dall-e' in image_model or 'dall-e' in provider_used or 'dall-e' in model_used:
            print("❌ DALL-E WAS USED")
        elif 'gemini' in image_model or 'gemini' in provider_used or 'gemini' in model_used or 'google_ai_studio' in provider_used:
            print("✓ Gemini was used")
        elif image_url and 'data:image' in str(image_url):
            print("✓ Gemini was used (base64)")
        else:
            print(f"ℹ️  Model: {image_model or provider_used or model_used or 'Unknown'}")
        print()
    
    client.close()
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)








