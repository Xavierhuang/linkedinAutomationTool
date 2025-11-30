#!/usr/bin/env python3
import pymongo
import re

client = pymongo.MongoClient('mongodb://localhost:27017')
db = client['linkedin_pilot']

# Search for the specific post content
search_text = "Are you still pouring resources into product development without a clear MVP strategy"

print("Searching for post with content about MVP strategy...")
print()

# Check all collections
collections = ['ai_content_posts', 'posts', 'scheduled_posts', 'drafts']

for collection_name in collections:
    collection = db[collection_name]
    
    # Search in content field
    if collection_name == 'scheduled_posts':
        # Scheduled posts have content in draft_preview
        results = list(collection.find({
            "draft_preview.content.body": {"$regex": search_text, "$options": "i"}
        }))
    elif collection_name == 'drafts':
        results = list(collection.find({
            "content.body": {"$regex": search_text, "$options": "i"}
        }))
    else:
        results = list(collection.find({
            "content": {"$regex": search_text, "$options": "i"}
        }))
    
    if results:
        print(f"Found {len(results)} post(s) in {collection_name}:")
        for i, post in enumerate(results, 1):
            print(f"\nPost {i} from {collection_name}:")
            print(f"  ID: {post.get('id', 'N/A')}")
            created = post.get('created_at', post.get('published_at', post.get('scheduled_time', 'N/A')))
            print(f"  Created: {created}")
            print(f"  Campaign: {post.get('campaign_name', 'N/A')}")
            print(f"  Image Model: {post.get('image_model', 'NOT SET')}")
            print(f"  Provider: {post.get('provider_used', 'NOT SET')}")
            print(f"  Model Used: {post.get('model_used', 'NOT SET')}")
            
            # Check image
            if collection_name == 'scheduled_posts':
                draft = post.get('draft_preview', {})
                assets = draft.get('assets', [])
                for asset in assets:
                    if asset.get('type') == 'image':
                        img_url = asset.get('url', '')
                        if 'dall-e' in img_url.lower():
                            print(f"  ⚠️  IMAGE: DALL-E detected")
                        elif 'data:image' in img_url:
                            print(f"  ✓ IMAGE: Gemini (base64)")
                        else:
                            print(f"  IMAGE URL: {img_url[:80]}...")
            else:
                img_url = post.get('image_url') or post.get('image_base64', '')
                if img_url:
                    if 'dall-e' in str(img_url).lower():
                        print(f"  ⚠️  IMAGE: DALL-E detected")
                    elif 'data:image' in str(img_url):
                        print(f"  ✓ IMAGE: Gemini (base64)")
                    else:
                        print(f"  IMAGE: Present")
                else:
                    print(f"  IMAGE: None")
            
            # Content preview
            if collection_name == 'scheduled_posts':
                content = post.get('draft_preview', {}).get('content', {}).get('body', '')
            elif collection_name == 'drafts':
                content = post.get('content', {}).get('body', '')
            else:
                content = post.get('content', '')
            
            if content:
                print(f"  Content preview: {content[:100]}...")
            print()

# Also get most recent from each collection
print("=" * 80)
print("MOST RECENT POSTS FROM EACH COLLECTION:")
print("=" * 80)

for collection_name in collections:
    collection = db[collection_name]
    recent = list(collection.find({}).sort("created_at", -1).limit(1))
    if recent:
        post = recent[0]
        print(f"\n{collection_name}:")
        print(f"  Created: {post.get('created_at', post.get('published_at', post.get('scheduled_time', 'N/A')))}")
        print(f"  Image Model: {post.get('image_model', 'NOT SET')}")








