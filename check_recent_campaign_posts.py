#!/usr/bin/env python3
"""
Check recent campaign-generated posts to verify they're using Gemini for image generation
"""
import os
import sys
from datetime import datetime, timedelta
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv('backend/.env')

MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'linkedin_pilot')

try:
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("=" * 80)
    print("RECENT CAMPAIGN-GENERATED POSTS - IMAGE MODEL VERIFICATION")
    print("=" * 80)
    print()
    
    # Get posts from the last 7 days
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    
    # Check ai_content_posts collection (where campaign posts are stored)
    recent_posts = db.ai_content_posts.find({
        "created_at": {"$gte": seven_days_ago.isoformat()},
        "source": "campaign"
    }).sort("created_at", -1).limit(20)
    
    posts_list = list(recent_posts)
    
    if not posts_list:
        print("No campaign-generated posts found in the last 7 days.")
        print()
        print("Checking all recent posts regardless of source...")
        recent_posts_all = db.ai_content_posts.find({
            "created_at": {"$gte": seven_days_ago.isoformat()}
        }).sort("created_at", -1).limit(20)
        posts_list = list(recent_posts_all)
    
    if not posts_list:
        print("No posts found in the last 7 days.")
        sys.exit(0)
    
    print(f"Found {len(posts_list)} recent post(s):")
    print()
    
    gemini_count = 0
    dalle_count = 0
    stock_count = 0
    no_image_count = 0
    unknown_count = 0
    
    for i, post in enumerate(posts_list, 1):
        post_id = post.get('id', 'N/A')
        created_at = post.get('created_at', 'N/A')
        campaign_id = post.get('campaign_id', 'N/A')
        campaign_name = post.get('campaign_name', 'N/A')
        
        # Check image model from various possible fields
        image_model = post.get('image_model') or post.get('provider_used') or post.get('model_used')
        image_url = post.get('image_url') or post.get('image_base64')
        
        # Determine image source
        image_source = "None"
        if image_url:
            if isinstance(image_url, str):
                if 'dall-e' in image_url.lower() or 'openai' in image_url.lower():
                    image_source = "DALL-E"
                    dalle_count += 1
                elif 'data:image' in image_url or 'base64' in image_url:
                    # Check if it's from Gemini (base64 images are usually Gemini)
                    if image_model:
                        if 'gemini' in str(image_model).lower() or 'google' in str(image_model).lower():
                            image_source = "Gemini (base64)"
                            gemini_count += 1
                        else:
                            image_source = f"Unknown ({image_model})"
                            unknown_count += 1
                    else:
                        image_source = "Unknown (base64)"
                        unknown_count += 1
                elif 'unsplash' in image_url.lower() or 'pexels' in image_url.lower():
                    image_source = "Stock Photo"
                    stock_count += 1
                else:
                    image_source = f"Unknown ({image_url[:50]}...)"
                    unknown_count += 1
            else:
                image_source = "Present (format unknown)"
        else:
            no_image_count += 1
        
        print(f"Post #{i}:")
        print(f"  ID: {post_id}")
        print(f"  Created: {created_at}")
        print(f"  Campaign ID: {campaign_id}")
        print(f"  Campaign Name: {campaign_name}")
        print(f"  Image Model Field: {image_model}")
        print(f"  Image Source: {image_source}")
        print(f"  Has Image: {'Yes' if image_url else 'No'}")
        print()
    
    print("=" * 80)
    print("SUMMARY:")
    print("=" * 80)
    print(f"Total Posts: {len(posts_list)}")
    print(f"Gemini Images: {gemini_count}")
    print(f"DALL-E Images: {dalle_count}")
    print(f"Stock Photos: {stock_count}")
    print(f"No Images: {no_image_count}")
    print(f"Unknown/Other: {unknown_count}")
    print()
    
    if dalle_count > 0:
        print("⚠️  WARNING: Some posts are still using DALL-E!")
    elif gemini_count > 0 or stock_count > 0:
        print("✓ All posts with images are using Gemini or Stock Photos (as configured)")
    else:
        print("ℹ️  No images found in recent posts")
    
    client.close()
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)








