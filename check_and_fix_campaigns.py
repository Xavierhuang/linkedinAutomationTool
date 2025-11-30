#!/usr/bin/env python3
"""
Check campaigns for DALL-E image_model settings and fix them
"""
import pymongo

client = pymongo.MongoClient('mongodb://localhost:27017')
db = client['linkedin_pilot']

print("=" * 80)
print("CHECKING CAMPAIGNS FOR DALL-E IMAGE MODEL SETTINGS")
print("=" * 80)
print()

campaigns = list(db.campaigns.find({}))

print(f"Found {len(campaigns)} campaigns:")
print()

dalle_campaigns = []

for campaign in campaigns:
    campaign_id = campaign.get('id', 'N/A')
    campaign_name = campaign.get('name', 'N/A')
    image_model = campaign.get('image_model', 'NOT SET')
    use_ai_images = campaign.get('use_ai_images', True)
    
    # Check if image_model contains dall-e
    if image_model and ('dall-e' in str(image_model).lower() or 'openai' in str(image_model).lower()):
        print(f"⚠️  Campaign: {campaign_name}")
        print(f"   ID: {campaign_id}")
        print(f"   Current image_model: {image_model}")
        print(f"   use_ai_images: {use_ai_images}")
        dalle_campaigns.append(campaign)
        print()

if dalle_campaigns:
    print("=" * 80)
    print(f"FOUND {len(dalle_campaigns)} CAMPAIGNS WITH DALL-E SETTINGS")
    print("=" * 80)
    print()
    print("Updating campaigns to use Gemini...")
    print()
    
    for campaign in dalle_campaigns:
        campaign_id = campaign.get('id')
        result = db.campaigns.update_one(
            {"id": campaign_id},
            {"$set": {"image_model": "google/gemini-2.5-flash-image"}}
        )
        if result.modified_count > 0:
            print(f"✓ Updated campaign: {campaign.get('name', campaign_id)}")
        else:
            print(f"✗ Failed to update: {campaign.get('name', campaign_id)}")
    
    print()
    print("All campaigns updated!")
else:
    print("✓ No campaigns found with DALL-E settings")

# Show all campaign image settings
print()
print("=" * 80)
print("ALL CAMPAIGN IMAGE SETTINGS:")
print("=" * 80)
for campaign in campaigns[:10]:  # Show first 10
    print(f"{campaign.get('name', 'N/A')}: image_model={campaign.get('image_model', 'NOT SET')}, use_ai_images={campaign.get('use_ai_images', 'N/A')}")








