#!/usr/bin/env python3
"""
Check which image model was used for a specific post by searching for its content
"""
import os
import sys
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv('backend/.env')

MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'linkedin_pilot')

# The post content to search for
search_content = "Are you still pouring resources into product development without a clear MVP strategy?"

try:
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("=" * 80)
    print("SEARCHING FOR SPECIFIC POST")
    print("=" * 80)
    print(f"Searching for: '{search_content[:60]}...'")
    print()
    
    # Search in ai_content_posts collection
    post = db.ai_content_posts.find_one({
        "content": {"$regex": search_content, "$options": "i"}
    })
    
    if not post:
        # Try searching in scheduled_posts
        scheduled = db.scheduled_posts.find_one({
            "draft_preview.content.body": {"$regex": search_content, "$options": "i"}
        })
        if scheduled:
            post = scheduled
            print("Found in scheduled_posts collection")
        else:
            # Try posts collection
            post = db.posts.find_one({
                "content": {"$regex": search_content, "$options": "i"}
            })
            if post:
                print("Found in posts collection")
    
    if not post:
        print("Post not found in database.")
        print()
        print("Searching for similar content...")
        # Try partial match
        partial_search = "pouring resources into product development"
        post = db.ai_content_posts.find_one({
            "content": {"$regex": partial_search, "$options": "i"}
        })
        if not post:
            # Get most recent posts
            print("Showing most recent posts instead:")
            recent = list(db.ai_content_posts.find({}).sort("created_at", -1).limit(5))
            for i, p in enumerate(recent, 1):
                print(f"\nPost #{i}:")
                print(f"  ID: {p.get('id', 'N/A')}")
                print(f"  Created: {p.get('created_at', 'N/A')}")
                print(f"  Content preview: {p.get('content', 'N/A')[:100]}...")
                print(f"  Image Model: {p.get('image_model', 'N/A')}")
                print(f"  Provider Used: {p.get('provider_used', 'N/A')}")
                print(f"  Model Used: {p.get('model_used', 'N/A')}")
        else:
            print("Found similar post!")
    
    if post:
        print("=" * 80)
        print("POST FOUND - DETAILS:")
        print("=" * 80)
        print()
        print(f"Post ID: {post.get('id', 'N/A')}")
        print(f"Created At: {post.get('created_at', 'N/A')}")
        print(f"Campaign ID: {post.get('campaign_id', 'N/A')}")
        print(f"Campaign Name: {post.get('campaign_name', 'N/A')}")
        print()
        print("IMAGE MODEL INFORMATION:")
        print("-" * 80)
        print(f"Image Model Field: {post.get('image_model', 'NOT SET')}")
        print(f"Provider Used: {post.get('provider_used', 'NOT SET')}")
        print(f"Model Used: {post.get('model_used', 'NOT SET')}")
        print(f"Image URL Present: {'Yes' if post.get('image_url') or post.get('image_base64') else 'No'}")
        
        # Check image URL for clues
        image_url = post.get('image_url') or post.get('image_base64', '')
        if image_url:
            if isinstance(image_url, str):
                if 'dall-e' in image_url.lower() or 'openai' in image_url.lower():
                    print(f"⚠️  IMAGE SOURCE: DALL-E (detected from URL)")
                elif 'data:image' in image_url or 'base64' in image_url:
                    print(f"✓ IMAGE SOURCE: Likely Gemini (base64 data URL)")
                elif 'unsplash' in image_url.lower() or 'pexels' in image_url.lower():
                    print(f"✓ IMAGE SOURCE: Stock Photo")
                else:
                    print(f"Image URL: {image_url[:100]}...")
        
        print()
        print("CONTENT PREVIEW:")
        print("-" * 80)
        content = post.get('content', post.get('draft_preview', {}).get('content', {}).get('body', 'N/A'))
        print(content[:300] + "..." if len(str(content)) > 300 else content)
        print()
        
        # Determine what was actually used
        image_model = post.get('image_model', '')
        provider_used = post.get('provider_used', '')
        model_used = post.get('model_used', '')
        
        print("=" * 80)
        print("CONCLUSION:")
        print("=" * 80)
        
        if 'dall-e' in str(image_model).lower() or 'dall-e' in str(provider_used).lower() or 'dall-e' in str(model_used).lower() or 'openai' in str(provider_used).lower():
            print("⚠️  WARNING: This post appears to have used DALL-E!")
        elif 'gemini' in str(image_model).lower() or 'gemini' in str(provider_used).lower() or 'gemini' in str(model_used).lower() or 'google' in str(provider_used).lower():
            print("✓ This post used Gemini for image generation")
        else:
            print(f"ℹ️  Image model info: {image_model or provider_used or model_used or 'Unknown'}")
    
    client.close()
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)








