#!/usr/bin/env python3
import pymongo
client = pymongo.MongoClient('mongodb://localhost:27017')
db = client['linkedin_pilot']

# Get most recent posts
posts = list(db.ai_content_posts.find({}).sort("created_at", -1).limit(5))

print(f"Found {len(posts)} recent posts:")
for i, p in enumerate(posts, 1):
    print(f"\nPost {i}:")
    print(f"  ID: {p.get('id', 'N/A')}")
    print(f"  Created: {p.get('created_at', 'N/A')}")
    print(f"  Campaign: {p.get('campaign_name', 'N/A')}")
    print(f"  Image Model: {p.get('image_model', 'NOT SET')}")
    print(f"  Provider: {p.get('provider_used', 'NOT SET')}")
    print(f"  Model Used: {p.get('model_used', 'NOT SET')}")
    has_img = "Yes" if (p.get('image_url') or p.get('image_base64')) else "No"
    print(f"  Has Image: {has_img}")
    content = p.get('content', '')
    if content:
        print(f"  Content: {content[:80]}...")








