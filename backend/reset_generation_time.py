"""
Utility script to reset campaign generation times
Useful for testing campaign automation and forcing immediate content generation
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv()

async def reset_generation_times():
    """Reset last_generation_time for all active campaigns"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    
    print("=" * 80)
    print("RESETTING CAMPAIGN GENERATION TIMES")
    print("=" * 80)
    
    # Get all active campaigns
    campaigns = await db.campaigns.find({"status": "active"}).to_list(length=None)
    
    print(f"\nFound {len(campaigns)} active campaigns")
    print("-" * 80)
    
    if not campaigns:
        print("\nNo active campaigns found.")
        client.close()
        return
    
    # Reset generation times
    for campaign in campaigns:
        campaign_id = campaign.get('id')
        campaign_name = campaign.get('name', 'Unnamed')
        old_time = campaign.get('last_generation_time', 'Never')
        
        # Set last_generation_time to a very old date to trigger immediate generation
        # Using epoch time (1970-01-01)
        reset_time = datetime(1970, 1, 1, tzinfo=timezone.utc).isoformat()
        
        await db.campaigns.update_one(
            {"id": campaign_id},
            {"$set": {"last_generation_time": reset_time}}
        )
        
        print(f"\n✓ Reset campaign: {campaign_name}")
        print(f"  Campaign ID: {campaign_id}")
        print(f"  Old time: {old_time}")
        print(f"  New time: {reset_time}")
        print(f"  → This campaign will generate content on next scheduler run")
    
    print("\n" + "=" * 80)
    print("RESET COMPLETE")
    print("=" * 80)
    print("\nAll active campaigns have been reset.")
    print("Content will be generated on the next scheduler cycle.")
    
    client.close()

async def reset_specific_campaign(campaign_id: str):
    """Reset generation time for a specific campaign"""
    
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    
    campaign = await db.campaigns.find_one({"id": campaign_id})
    
    if not campaign:
        print(f"❌ Campaign not found: {campaign_id}")
        client.close()
        return
    
    reset_time = datetime(1970, 1, 1, tzinfo=timezone.utc).isoformat()
    
    await db.campaigns.update_one(
        {"id": campaign_id},
        {"$set": {"last_generation_time": reset_time}}
    )
    
    print(f"✓ Reset campaign: {campaign.get('name', 'Unnamed')}")
    print(f"  Campaign ID: {campaign_id}")
    print(f"  New time: {reset_time}")
    
    client.close()

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        # Reset specific campaign
        campaign_id = sys.argv[1]
        print(f"Resetting specific campaign: {campaign_id}")
        asyncio.run(reset_specific_campaign(campaign_id))
    else:
        # Reset all active campaigns
        asyncio.run(reset_generation_times())
