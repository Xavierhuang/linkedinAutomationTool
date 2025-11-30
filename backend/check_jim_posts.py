#!/usr/bin/env python3
"""Check if posts were generated during onboarding for jim jim"""
import os
import sys
from datetime import datetime, timedelta
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/')
DB_NAME = os.environ.get('DB_NAME', 'linkedpilot')

def check_jim_posts():
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        print("=" * 60)
        print("Checking for posts generated during onboarding for 'jim jim'")
        print("=" * 60)
        
        # Find organization with "jim" in the name
        org = db.organizations.find_one(
            {'name': {'$regex': 'jim', '$options': 'i'}},
            {'id': 1, 'name': 1, 'created_at': 1}
        )
        
        if not org:
            print("\n[X] No organization found with 'jim' in the name")
            print("\nAvailable organizations:")
            orgs = list(db.organizations.find({}, {'id': 1, 'name': 1, 'created_at': 1}).limit(10))
            for o in orgs:
                print(f"  - {o.get('name')} (id: {o.get('id')})")
            return
        
        org_id = org.get('id')
        org_name = org.get('name')
        org_created = org.get('created_at')
        
        print(f"\n[OK] Found organization: {org_name}")
        print(f"   ID: {org_id}")
        print(f"   Created: {org_created}")
        
        # Check campaigns
        campaigns = list(db.campaigns.find(
            {'org_id': org_id},
            {'id': 1, 'name': 1, 'status': 1, 'created_at': 1}
        ))
        
        print(f"\n📊 Campaigns ({len(campaigns)}):")
        if campaigns:
            for c in campaigns:
                print(f"  - {c.get('name')} (id: {c.get('id')}, status: {c.get('status')}, created: {c.get('created_at')})")
        else:
            print("  [X] No campaigns found")
        
        # Check drafts
        drafts = list(db.drafts.find(
            {'org_id': org_id},
            {'id': 1, 'campaign_id': 1, 'created_at': 1, 'status': 1}
        ))
        
        print(f"\n[Drafts] ({len(drafts)}):")
        if drafts:
            # Sort by created_at descending
            drafts.sort(key=lambda x: x.get('created_at', ''), reverse=True)
            for d in drafts[:10]:  # Show first 10
                created = d.get('created_at', 'Unknown')
                campaign_id = d.get('campaign_id', 'None')
                print(f"  - {d.get('id')} (campaign: {campaign_id}, status: {d.get('status')}, created: {created})")
            if len(drafts) > 10:
                print(f"  ... and {len(drafts) - 10} more drafts")
        else:
            print("  [X] No drafts found")
        
        # Check scheduled posts
        scheduled_posts = list(db.scheduled_posts.find(
            {'org_id': org_id},
            {'id': 1, 'draft_id': 1, 'publish_time': 1, 'status': 1, 'created_at': 1}
        ))
        
        print(f"\n[Scheduled Posts] ({len(scheduled_posts)}):")
        if scheduled_posts:
            # Sort by publish_time ascending
            scheduled_posts.sort(key=lambda x: x.get('publish_time', ''))
            for p in scheduled_posts:
                publish_time = p.get('publish_time', 'Unknown')
                status = p.get('status', 'Unknown')
                created = p.get('created_at', 'Unknown')
                print(f"  - {p.get('id')} (draft: {p.get('draft_id')}, publish: {publish_time}, status: {status}, created: {created})")
        else:
            print("  [X] No scheduled posts found")
        
        # Check AI generated posts
        ai_posts = list(db.ai_generated_posts.find(
            {'org_id': org_id},
            {'id': 1, 'campaign_id': 1, 'scheduled_for': 1, 'status': 1, 'created_at': 1}
        ))
        
        print(f"\n🤖 AI Generated Posts ({len(ai_posts)}):")
        if ai_posts:
            for p in ai_posts[:10]:  # Show first 10
                scheduled = p.get('scheduled_for', 'Not scheduled')
                status = p.get('status', 'Unknown')
                created = p.get('created_at', 'Unknown')
                print(f"  - {p.get('id')} (campaign: {p.get('campaign_id')}, scheduled: {scheduled}, status: {status}, created: {created})")
            if len(ai_posts) > 10:
                print(f"  ... and {len(ai_posts) - 10} more AI posts")
        else:
            print("  [X] No AI generated posts found")
        
        # Summary
        print("\n" + "=" * 60)
        print("SUMMARY:")
        print(f"  Campaigns: {len(campaigns)}")
        print(f"  Drafts: {len(drafts)}")
        print(f"  Scheduled Posts: {len(scheduled_posts)}")
        print(f"  AI Generated Posts: {len(ai_posts)}")
        
        if len(scheduled_posts) > 0 or len(ai_posts) > 0:
            print("\n[OK] Posts WERE generated during onboarding!")
        else:
            print("\n[X] Posts were NOT generated during onboarding")
        
        print("=" * 60)
        
    except Exception as e:
        print(f"\n[X] Error checking database: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    check_jim_posts()


import os
import sys
from datetime import datetime, timedelta
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/')
DB_NAME = os.environ.get('DB_NAME', 'linkedpilot')

def check_jim_posts():
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        print("=" * 60)
        print("Checking for posts generated during onboarding for 'jim jim'")
        print("=" * 60)
        
        # Find organization with "jim" in the name
        org = db.organizations.find_one(
            {'name': {'$regex': 'jim', '$options': 'i'}},
            {'id': 1, 'name': 1, 'created_at': 1}
        )
        
        if not org:
            print("\n[X] No organization found with 'jim' in the name")
            print("\nAvailable organizations:")
            orgs = list(db.organizations.find({}, {'id': 1, 'name': 1, 'created_at': 1}).limit(10))
            for o in orgs:
                print(f"  - {o.get('name')} (id: {o.get('id')})")
            return
        
        org_id = org.get('id')
        org_name = org.get('name')
        org_created = org.get('created_at')
        
        print(f"\n[OK] Found organization: {org_name}")
        print(f"   ID: {org_id}")
        print(f"   Created: {org_created}")
        
        # Check campaigns
        campaigns = list(db.campaigns.find(
            {'org_id': org_id},
            {'id': 1, 'name': 1, 'status': 1, 'created_at': 1}
        ))
        
        print(f"\n[Campaigns] ({len(campaigns)}):")
        if campaigns:
            for c in campaigns:
                print(f"  - {c.get('name')} (id: {c.get('id')}, status: {c.get('status')}, created: {c.get('created_at')})")
        else:
            print("  [X] No campaigns found")
        
        # Check drafts
        drafts = list(db.drafts.find(
            {'org_id': org_id},
            {'id': 1, 'campaign_id': 1, 'created_at': 1, 'status': 1}
        ))
        
        print(f"\n[Drafts] ({len(drafts)}):")
        if drafts:
            # Sort by created_at descending
            drafts.sort(key=lambda x: x.get('created_at', ''), reverse=True)
            for d in drafts[:10]:  # Show first 10
                created = d.get('created_at', 'Unknown')
                campaign_id = d.get('campaign_id', 'None')
                print(f"  - {d.get('id')} (campaign: {campaign_id}, status: {d.get('status')}, created: {created})")
            if len(drafts) > 10:
                print(f"  ... and {len(drafts) - 10} more drafts")
        else:
            print("  [X] No drafts found")
        
        # Check scheduled posts
        scheduled_posts = list(db.scheduled_posts.find(
            {'org_id': org_id},
            {'id': 1, 'draft_id': 1, 'publish_time': 1, 'status': 1, 'created_at': 1}
        ))
        
        print(f"\n[Scheduled Posts] ({len(scheduled_posts)}):")
        if scheduled_posts:
            # Sort by publish_time ascending
            scheduled_posts.sort(key=lambda x: x.get('publish_time', ''))
            for p in scheduled_posts:
                publish_time = p.get('publish_time', 'Unknown')
                status = p.get('status', 'Unknown')
                created = p.get('created_at', 'Unknown')
                print(f"  - {p.get('id')} (draft: {p.get('draft_id')}, publish: {publish_time}, status: {status}, created: {created})")
        else:
            print("  [X] No scheduled posts found")
        
        # Check AI generated posts
        ai_posts = list(db.ai_generated_posts.find(
            {'org_id': org_id},
            {'id': 1, 'campaign_id': 1, 'scheduled_for': 1, 'status': 1, 'created_at': 1}
        ))
        
        print(f"\n🤖 AI Generated Posts ({len(ai_posts)}):")
        if ai_posts:
            for p in ai_posts[:10]:  # Show first 10
                scheduled = p.get('scheduled_for', 'Not scheduled')
                status = p.get('status', 'Unknown')
                created = p.get('created_at', 'Unknown')
                print(f"  - {p.get('id')} (campaign: {p.get('campaign_id')}, scheduled: {scheduled}, status: {status}, created: {created})")
            if len(ai_posts) > 10:
                print(f"  ... and {len(ai_posts) - 10} more AI posts")
        else:
            print("  [X] No AI generated posts found")
        
        # Summary
        print("\n" + "=" * 60)
        print("SUMMARY:")
        print(f"  Campaigns: {len(campaigns)}")
        print(f"  Drafts: {len(drafts)}")
        print(f"  Scheduled Posts: {len(scheduled_posts)}")
        print(f"  AI Generated Posts: {len(ai_posts)}")
        
        if len(scheduled_posts) > 0 or len(ai_posts) > 0:
            print("\n[OK] Posts WERE generated during onboarding!")
        else:
            print("\n[X] Posts were NOT generated during onboarding")
        
        print("=" * 60)
        
    except Exception as e:
        print(f"\n[X] Error checking database: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    check_jim_posts()

