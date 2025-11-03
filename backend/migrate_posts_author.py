"""
Migration script to update existing AI posts with campaign author information
Run this once after deploying the new code
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

async def migrate_posts():
    # Connect to MongoDB
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
    db = client[os.environ.get('DB_NAME', 'linkedin_pilot')]
    
    print("🔄 Starting migration: Adding author info to AI posts...")
    
    # Get all AI posts that have a campaign_id but missing profile_type or author_name
    posts = await db.ai_generated_posts.find({
        "campaign_id": {"$exists": True, "$ne": None},
        "$or": [
            {"profile_type": {"$exists": False}},
            {"author_name": {"$exists": False}}
        ]
    }).to_list(length=None)
    
    print(f"📊 Found {len(posts)} posts to update")
    
    updated_count = 0
    skipped_count = 0
    
    for post in posts:
        campaign_id = post.get('campaign_id')
        org_id = post.get('org_id')
        
        # Get campaign
        campaign = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
        if not campaign:
            print(f"   ⚠️  Skipping post {post['id'][:20]}... - Campaign not found")
            skipped_count += 1
            continue
        
        profile_type = campaign.get('profile_type', 'personal')
        linkedin_author_id = campaign.get('linkedin_author_id')
        
        # Resolve author name
        author_name = None
        if profile_type in ['company', 'organization'] and linkedin_author_id:
            # Get organization
            org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
            if org:
                linkedin_token = org.get('linkedin_access_token')
                if linkedin_token:
                    try:
                        # Import LinkedIn adapter
                        import sys
                        sys.path.append(os.path.dirname(os.path.dirname(__file__)))
                        from linkedpilot.adapters.linkedin_adapter import LinkedInAdapter
                        
                        linkedin = LinkedInAdapter(client_id="dummy", client_secret="dummy")
                        linkedin.mock_mode = False
                        managed_orgs = await linkedin.get_managed_organizations(linkedin_token)
                        
                        for managed_org in managed_orgs:
                            if str(managed_org.get('id')) == str(linkedin_author_id):
                                author_name = managed_org.get('name', managed_org.get('localizedName'))
                                break
                    except Exception as e:
                        print(f"   ⚠️  Could not fetch company name: {e}")
                else:
                    print(f"   ⚠️  No LinkedIn token for org {org_id}")
        else:
            # Personal profile
            org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
            if org:
                linkedin_profile = org.get('linkedin_profile', {})
                author_name = linkedin_profile.get('name', 'Personal Profile')
        
        # Update the post
        update_data = {
            "profile_type": profile_type,
            "updated_at": datetime.utcnow()
        }
        
        if author_name:
            update_data["author_name"] = author_name
        
        await db.ai_generated_posts.update_one(
            {"id": post['id']},
            {"$set": update_data}
        )
        
        print(f"   ✅ Updated post {post['id'][:20]}... → {profile_type} ({author_name or 'Unknown'})")
        updated_count += 1
    
    print(f"\n✨ Migration complete!")
    print(f"   Updated: {updated_count} posts")
    print(f"   Skipped: {skipped_count} posts")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate_posts())




Migration script to update existing AI posts with campaign author information
Run this once after deploying the new code
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

async def migrate_posts():
    # Connect to MongoDB
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
    db = client[os.environ.get('DB_NAME', 'linkedin_pilot')]
    
    print("🔄 Starting migration: Adding author info to AI posts...")
    
    # Get all AI posts that have a campaign_id but missing profile_type or author_name
    posts = await db.ai_generated_posts.find({
        "campaign_id": {"$exists": True, "$ne": None},
        "$or": [
            {"profile_type": {"$exists": False}},
            {"author_name": {"$exists": False}}
        ]
    }).to_list(length=None)
    
    print(f"📊 Found {len(posts)} posts to update")
    
    updated_count = 0
    skipped_count = 0
    
    for post in posts:
        campaign_id = post.get('campaign_id')
        org_id = post.get('org_id')
        
        # Get campaign
        campaign = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
        if not campaign:
            print(f"   ⚠️  Skipping post {post['id'][:20]}... - Campaign not found")
            skipped_count += 1
            continue
        
        profile_type = campaign.get('profile_type', 'personal')
        linkedin_author_id = campaign.get('linkedin_author_id')
        
        # Resolve author name
        author_name = None
        if profile_type in ['company', 'organization'] and linkedin_author_id:
            # Get organization
            org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
            if org:
                linkedin_token = org.get('linkedin_access_token')
                if linkedin_token:
                    try:
                        # Import LinkedIn adapter
                        import sys
                        sys.path.append(os.path.dirname(os.path.dirname(__file__)))
                        from linkedpilot.adapters.linkedin_adapter import LinkedInAdapter
                        
                        linkedin = LinkedInAdapter(client_id="dummy", client_secret="dummy")
                        linkedin.mock_mode = False
                        managed_orgs = await linkedin.get_managed_organizations(linkedin_token)
                        
                        for managed_org in managed_orgs:
                            if str(managed_org.get('id')) == str(linkedin_author_id):
                                author_name = managed_org.get('name', managed_org.get('localizedName'))
                                break
                    except Exception as e:
                        print(f"   ⚠️  Could not fetch company name: {e}")
                else:
                    print(f"   ⚠️  No LinkedIn token for org {org_id}")
        else:
            # Personal profile
            org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
            if org:
                linkedin_profile = org.get('linkedin_profile', {})
                author_name = linkedin_profile.get('name', 'Personal Profile')
        
        # Update the post
        update_data = {
            "profile_type": profile_type,
            "updated_at": datetime.utcnow()
        }
        
        if author_name:
            update_data["author_name"] = author_name
        
        await db.ai_generated_posts.update_one(
            {"id": post['id']},
            {"$set": update_data}
        )
        
        print(f"   ✅ Updated post {post['id'][:20]}... → {profile_type} ({author_name or 'Unknown'})")
        updated_count += 1
    
    print(f"\n✨ Migration complete!")
    print(f"   Updated: {updated_count} posts")
    print(f"   Skipped: {skipped_count} posts")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate_posts())




Migration script to update existing AI posts with campaign author information
Run this once after deploying the new code
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

async def migrate_posts():
    # Connect to MongoDB
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
    db = client[os.environ.get('DB_NAME', 'linkedin_pilot')]
    
    print("🔄 Starting migration: Adding author info to AI posts...")
    
    # Get all AI posts that have a campaign_id but missing profile_type or author_name
    posts = await db.ai_generated_posts.find({
        "campaign_id": {"$exists": True, "$ne": None},
        "$or": [
            {"profile_type": {"$exists": False}},
            {"author_name": {"$exists": False}}
        ]
    }).to_list(length=None)
    
    print(f"📊 Found {len(posts)} posts to update")
    
    updated_count = 0
    skipped_count = 0
    
    for post in posts:
        campaign_id = post.get('campaign_id')
        org_id = post.get('org_id')
        
        # Get campaign
        campaign = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
        if not campaign:
            print(f"   ⚠️  Skipping post {post['id'][:20]}... - Campaign not found")
            skipped_count += 1
            continue
        
        profile_type = campaign.get('profile_type', 'personal')
        linkedin_author_id = campaign.get('linkedin_author_id')
        
        # Resolve author name
        author_name = None
        if profile_type in ['company', 'organization'] and linkedin_author_id:
            # Get organization
            org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
            if org:
                linkedin_token = org.get('linkedin_access_token')
                if linkedin_token:
                    try:
                        # Import LinkedIn adapter
                        import sys
                        sys.path.append(os.path.dirname(os.path.dirname(__file__)))
                        from linkedpilot.adapters.linkedin_adapter import LinkedInAdapter
                        
                        linkedin = LinkedInAdapter(client_id="dummy", client_secret="dummy")
                        linkedin.mock_mode = False
                        managed_orgs = await linkedin.get_managed_organizations(linkedin_token)
                        
                        for managed_org in managed_orgs:
                            if str(managed_org.get('id')) == str(linkedin_author_id):
                                author_name = managed_org.get('name', managed_org.get('localizedName'))
                                break
                    except Exception as e:
                        print(f"   ⚠️  Could not fetch company name: {e}")
                else:
                    print(f"   ⚠️  No LinkedIn token for org {org_id}")
        else:
            # Personal profile
            org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
            if org:
                linkedin_profile = org.get('linkedin_profile', {})
                author_name = linkedin_profile.get('name', 'Personal Profile')
        
        # Update the post
        update_data = {
            "profile_type": profile_type,
            "updated_at": datetime.utcnow()
        }
        
        if author_name:
            update_data["author_name"] = author_name
        
        await db.ai_generated_posts.update_one(
            {"id": post['id']},
            {"$set": update_data}
        )
        
        print(f"   ✅ Updated post {post['id'][:20]}... → {profile_type} ({author_name or 'Unknown'})")
        updated_count += 1
    
    print(f"\n✨ Migration complete!")
    print(f"   Updated: {updated_count} posts")
    print(f"   Skipped: {skipped_count} posts")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate_posts())







