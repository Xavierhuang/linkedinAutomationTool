#!/usr/bin/env python3
"""Check for recent onboarding activity and posts"""
import os
from datetime import datetime, timedelta
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/')
DB_NAME = os.environ.get('DB_NAME', 'linkedpilot')

def check_recent_onboarding():
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        print("=" * 60)
        print("Checking for recent onboarding activity (last 24 hours)")
        print("=" * 60)
        
        # Check all organizations created in last 24 hours
        yesterday = datetime.utcnow() - timedelta(days=1)
        
        recent_orgs = list(db.organizations.find(
            {'created_at': {'$gte': yesterday.isoformat()}},
            {'id': 1, 'name': 1, 'created_at': 1}
        ).sort('created_at', -1))
        
        print(f"\n[Recent Organizations] (last 24h): {len(recent_orgs)}")
        
        if not recent_orgs:
            # Check all organizations
            all_orgs = list(db.organizations.find({}, {'id': 1, 'name': 1, 'created_at': 1}).sort('created_at', -1).limit(20))
            print(f"\n[All Organizations] (showing last 20): {len(all_orgs)}")
            for org in all_orgs:
                org_id = org.get('id')
                org_name = org.get('name')
                created = org.get('created_at', 'Unknown')
                
                # Count posts for this org
                scheduled_count = db.scheduled_posts.count_documents({'org_id': org_id})
                drafts_count = db.drafts.count_documents({'org_id': org_id})
                campaigns_count = db.campaigns.count_documents({'org_id': org_id})
                
                print(f"\n  - {org_name}")
                print(f"    ID: {org_id}")
                print(f"    Created: {created}")
                print(f"    Campaigns: {campaigns_count}, Drafts: {drafts_count}, Scheduled Posts: {scheduled_count}")
                
                # Check recent scheduled posts for this org
                if scheduled_count > 0:
                    recent_posts = list(db.scheduled_posts.find(
                        {'org_id': org_id},
                        {'id': 1, 'publish_time': 1, 'status': 1, 'created_at': 1}
                    ).sort('created_at', -1).limit(7))
                    
                    print(f"    Recent Scheduled Posts:")
                    for p in recent_posts:
                        print(f"      - {p.get('id')}: {p.get('publish_time')} (status: {p.get('status')}, created: {p.get('created_at')})")
        else:
            for org in recent_orgs:
                org_id = org.get('id')
                org_name = org.get('name')
                created = org.get('created_at')
                
                print(f"\n[OK] Found recent organization: {org_name}")
                print(f"   ID: {org_id}")
                print(f"   Created: {created}")
                
                # Check campaigns
                campaigns = list(db.campaigns.find({'org_id': org_id}, {'id': 1, 'name': 1, 'status': 1, 'created_at': 1}))
                print(f"\n   [Campaigns]: {len(campaigns)}")
                for c in campaigns:
                    print(f"     - {c.get('name')} (status: {c.get('status')}, created: {c.get('created_at')})")
                
                # Check scheduled posts
                scheduled = list(db.scheduled_posts.find(
                    {'org_id': org_id},
                    {'id': 1, 'draft_id': 1, 'publish_time': 1, 'status': 1, 'created_at': 1}
                ).sort('created_at', -1))
                
                print(f"\n   [Scheduled Posts]: {len(scheduled)}")
                if scheduled:
                    for p in scheduled[:10]:
                        print(f"     - {p.get('id')}: publish={p.get('publish_time')}, status={p.get('status')}, created={p.get('created_at')}")
                else:
                    print("     [X] No scheduled posts found")
                
                # Check drafts
                drafts = list(db.drafts.find({'org_id': org_id}, {'id': 1, 'campaign_id': 1, 'created_at': 1}).sort('created_at', -1))
                print(f"\n   [Drafts]: {len(drafts)}")
                if drafts:
                    for d in drafts[:10]:
                        print(f"     - {d.get('id')}: campaign={d.get('campaign_id')}, created={d.get('created_at')}")
                else:
                    print("     [X] No drafts found")
                
                if len(scheduled) > 0:
                    print(f"\n   [OK] Posts WERE generated for {org_name}!")
                else:
                    print(f"\n   [X] Posts were NOT generated for {org_name}")
        
        print("\n" + "=" * 60)
        
    except Exception as e:
        print(f"\n[X] Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    check_recent_onboarding()







