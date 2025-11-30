#!/usr/bin/env python3
"""
Check live database for campaign-generated posts and their image models
"""
import os
import sys
from datetime import datetime, timedelta
from pymongo import MongoClient

MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'linkedin_pilot')

try:
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("=" * 80)
    print("LIVE DATABASE - CAMPAIGN POSTS ANALYSIS")
    print("=" * 80)
    print()
    
    # Search for the specific post content
    search_content = "Are you still pouring resources into product development without a clear MVP strategy"
    
    print(f"Searching for post containing: '{search_content[:60]}...'")
    print()
    
    # Check ai_content_posts collection (campaign-generated posts)
    posts = list(db.ai_content_posts.find({
        "content": {"$regex": search_content, "$options": "i"}
    }).sort("created_at", -1))
    
    if not posts:
        # Try broader search
        posts = list(db.ai_content_posts.find({
            "content": {"$regex": "pouring resources", "$options": "i"}
        }).sort("created_at", -1))
    
    if not posts:
        # Get all recent campaign posts
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        posts = list(db.ai_content_posts.find({
            "created_at": {"$gte": seven_days_ago.isoformat()}
        }).sort("created_at", -1).limit(10))
        print(f"No exact match found. Showing {len(posts)} most recent campaign posts:")
        print()
    
    if not posts:
        print("No posts found in ai_content_posts collection.")
        # Check posts collection
        posts = list(db.posts.find({
            "content": {"$regex": search_content, "$options": "i"}
        }).sort("created_at", -1))
        if posts:
            print(f"Found {len(posts)} post(s) in posts collection:")
    
    for i, post in enumerate(posts, 1):
        print("=" * 80)
        print(f"POST #{i}")
        print("=" * 80)
        print(f"ID: {post.get('id', 'N/A')}")
        print(f"Created: {post.get('created_at', 'N/A')}")
        print(f"Campaign ID: {post.get('campaign_id', 'N/A')}")
        print(f"Campaign Name: {post.get('campaign_name', 'N/A')}")
        print()
        print("IMAGE MODEL INFORMATION:")
        print("-" * 80)
        print(f"image_model field: {post.get('image_model', 'NOT SET')}")
        print(f"provider_used field: {post.get('provider_used', 'NOT SET')}")
        print(f"model_used field: {post.get('model_used', 'NOT SET')}")
        print()
        
        # Check image URL
        image_url = post.get('image_url') or post.get('image_base64', '')
        if image_url:
            if isinstance(image_url, str):
                if len(image_url) > 200:
                    url_preview = image_url[:100] + "..." + image_url[-50:]
                else:
                    url_preview = image_url
                
                if 'dall-e' in image_url.lower() or ('openai' in image_url.lower() and 'dall' in image_url.lower()):
                    print(f"⚠️  IMAGE SOURCE: DALL-E (detected from URL)")
                    print(f"   URL preview: {url_preview}")
                elif 'data:image' in image_url or 'base64' in image_url:
                    print(f"✓ IMAGE SOURCE: Gemini (base64 data URL)")
                    print(f"   URL length: {len(image_url)} chars")
                elif 'unsplash' in image_url.lower() or 'pexels' in image_url.lower():
                    print(f"✓ IMAGE SOURCE: Stock Photo")
                    print(f"   URL: {url_preview}")
                else:
                    print(f"Image URL present: {url_preview}")
            print()
        else:
            print("No image URL found")
            print()
        
        # Content preview
        content = post.get('content', '')
        if content:
            print("CONTENT PREVIEW:")
            print("-" * 80)
            print(content[:200] + "..." if len(content) > 200 else content)
            print()
        
        # Final determination
        print("RESULT:")
        print("-" * 80)
        image_model = str(post.get('image_model', '')).lower()
        provider_used = str(post.get('provider_used', '')).lower()
        model_used = str(post.get('model_used', '')).lower()
        
        if 'dall-e' in image_model or 'dall-e' in provider_used or 'dall-e' in model_used:
            print("❌ DALL-E WAS USED FOR THIS POST")
        elif 'gemini' in image_model or 'gemini' in provider_used or 'gemini' in model_used or 'google' in provider_used:
            print("✓ Gemini was used for this post")
        elif image_url and 'data:image' in str(image_url):
            print("✓ Gemini was used (base64 data URL detected)")
        elif image_url and ('unsplash' in str(image_url).lower() or 'pexels' in str(image_url).lower()):
            print("✓ Stock photo was used")
        else:
            print(f"ℹ️  Could not determine model from available fields")
        print()
    
    # Check admin default settings
    print("=" * 80)
    print("ADMIN DEFAULT IMAGE MODEL SETTING")
    print("=" * 80)
    model_settings = db.system_settings.find_one({"_id": "model_settings"})
    if model_settings:
        default_image = model_settings.get('image_draft_image', 'NOT SET')
        print(f"Default image model: {default_image}")
    else:
        print("No model_settings found in database")
    print()
    
    client.close()
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)








