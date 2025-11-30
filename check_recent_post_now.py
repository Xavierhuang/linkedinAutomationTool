#!/usr/bin/env python3
"""
Check the most recent post created (minutes ago - Nov 5, 2:56 AM)
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
    print("CHECKING MOST RECENT POSTS (Last 30 minutes)")
    print("=" * 80)
    print()
    
    # Get posts from last 30 minutes
    thirty_minutes_ago = datetime.utcnow() - timedelta(minutes=30)
    
    # Check ai_content_posts (campaign-generated)
    recent_posts = list(db.ai_content_posts.find({
        "created_at": {"$gte": thirty_minutes_ago.isoformat()}
    }).sort("created_at", -1))
    
    if not recent_posts:
        # Try last hour
        one_hour_ago = datetime.utcnow() - timedelta(hours=1)
        recent_posts = list(db.ai_content_posts.find({
            "created_at": {"$gte": one_hour_ago.isoformat()}
        }).sort("created_at", -1))
    
    if not recent_posts:
        # Get most recent 5 posts regardless of time
        recent_posts = list(db.ai_content_posts.find({}).sort("created_at", -1).limit(5))
        print("No posts in last hour. Showing 5 most recent posts:")
    
    print(f"Found {len(recent_posts)} recent post(s):")
    print()
    
    for i, post in enumerate(recent_posts, 1):
        print("=" * 80)
        print(f"POST #{i}")
        print("=" * 80)
        print(f"ID: {post.get('id', 'N/A')}")
        print(f"Created At: {post.get('created_at', 'N/A')}")
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
                if 'dall-e' in image_url.lower() or ('openai' in image_url.lower() and 'dall' in image_url.lower()):
                    print(f"⚠️  IMAGE SOURCE: DALL-E (detected from URL)")
                elif 'data:image' in image_url or 'base64' in image_url:
                    print(f"✓ IMAGE SOURCE: Gemini (base64 data URL)")
                    print(f"   URL length: {len(image_url)} chars")
                elif 'unsplash' in image_url.lower() or 'pexels' in image_url.lower():
                    print(f"✓ IMAGE SOURCE: Stock Photo")
                else:
                    print(f"Image URL present: {image_url[:100]}...")
            print()
        else:
            print("No image URL found")
            print()
        
        # Content preview
        content = post.get('content', '')
        if content:
            print("CONTENT PREVIEW:")
            print("-" * 80)
            print(content[:300] + "..." if len(content) > 300 else content)
            print()
        
        # Final determination
        print("RESULT:")
        print("-" * 80)
        image_model = str(post.get('image_model', '')).lower()
        provider_used = str(post.get('provider_used', '')).lower()
        model_used = str(post.get('model_used', '')).lower()
        
        if 'dall-e' in image_model or 'dall-e' in provider_used or 'dall-e' in model_used or ('openai' in provider_used and 'gemini' not in provider_used):
            print("❌ DALL-E WAS USED FOR THIS POST")
        elif 'gemini' in image_model or 'gemini' in provider_used or 'gemini' in model_used or 'google_ai_studio' in provider_used:
            print("✓ Gemini was used for this post")
        elif image_url and 'data:image' in str(image_url):
            print("✓ Gemini was used (base64 data URL detected)")
        elif image_url and ('unsplash' in str(image_url).lower() or 'pexels' in str(image_url).lower()):
            print("✓ Stock photo was used")
        else:
            print(f"ℹ️  Could not determine model from available fields")
        print()
    
    client.close()
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)








