#!/usr/bin/env python3
"""
Check admin image model settings and recent posts
"""
import os
from pymongo import MongoClient
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv('backend/.env')
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'linkedin_pilot')

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

print("=" * 80)
print("ADMIN IMAGE MODEL SETTINGS")
print("=" * 80)

# Check model_settings
model_settings = db.system_settings.find_one({"_id": "model_settings"})
if model_settings:
    print(f"image_draft_image setting: {model_settings.get('image_draft_image', 'NOT SET')}")
else:
    print("No model_settings found - using code defaults (google_ai_studio:gemini-2.5-flash-image)")

print()
print("=" * 80)
print("CAMPAIGN IMAGE SETTINGS")
print("=" * 80)

campaigns = list(db.campaigns.find({}, {"name": 1, "image_model": 1, "use_ai_images": 1, "status": 1}))
for c in campaigns:
    print(f"Campaign: {c.get('name', 'N/A')}")
    print(f"  Status: {c.get('status', 'N/A')}")
    print(f"  image_model: {c.get('image_model', 'NOT SET')}")
    print(f"  use_ai_images: {c.get('use_ai_images', 'NOT SET')}")
    print()

print("=" * 80)
print("RECENT POSTS (Last 10)")
print("=" * 80)

seven_days_ago = datetime.utcnow() - timedelta(days=7)
recent = list(db.ai_content_posts.find({
    "created_at": {"$gte": seven_days_ago.isoformat()}
}).sort("created_at", -1).limit(10))

if not recent:
    print("No posts found in last 7 days")
else:
    for i, p in enumerate(recent, 1):
        print(f"\nPost #{i}:")
        print(f"  ID: {p.get('id', 'N/A')}")
        print(f"  Created: {p.get('created_at', 'N/A')}")
        print(f"  Campaign: {p.get('campaign_name', 'N/A')}")
        print(f"  image_model: {p.get('image_model', 'NOT SET')}")
        print(f"  provider_used: {p.get('provider_used', 'NOT SET')}")
        print(f"  model_used: {p.get('model_used', 'NOT SET')}")
        content_preview = p.get('content', '')[:80]
        print(f"  Content: {content_preview}...")

client.close()








