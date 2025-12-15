#!/usr/bin/env python3
"""Check posts for user with email jimmy@gmail.com"""
import os
from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/')
DB_NAME = os.environ.get('DB_NAME', 'linkedpilot')

def check_jimmy_user():
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        print("=" * 60)
        print("Checking for user 'jimmy@gmail.com' and their onboarding posts")
        print("=" * 60)
        
        # Find user by email
        user = db.users.find_one(
            {'email': 'jimmy@gmail.com'},
            {'id': 1, 'name': 1, 'email': 1, 'created_at': 1}
        )
        
        if not user:
            print("\n[X] User not found")
            return
        
        user_id = user.get('id')
        user_name = user.get('name') or 'No name set'
        user_email = user.get('email')
        user_created = user.get('created_at')
        
        print(f"\n[OK] Found user: {user_name} ({user_email})")
        print(f"   ID: {user_id}")
        print(f"   Created: {user_created}")
        
        # Find organizations created by this user
        orgs = list(db.organizations.find(
            {'created_by': user_id},
            {'id': 1, 'name': 1, 'created_at': 1}
        ).sort('created_at', -1))
        
        print(f"\n[Organizations]: {len(orgs)}")
        if not orgs:
            print("  [X] No organizations found")
            return
        
        for org in orgs:
            org_id = org.get('id')
            org_name = org.get('name')
            org_created = org.get('created_at')
            
            print(f"\n  Organization: {org_name}")
            print(f"    ID: {org_id}")
            print(f"    Created: {org_created}")
            
            # Check campaigns
            campaigns = list(db.campaigns.find(
                {'org_id': org_id},
                {'id': 1, 'name': 1, 'status': 1, 'created_at': 1, 'created_by': 1}
            ).sort('created_at', -1))
            
            print(f"\n    [Campaigns]: {len(campaigns)}")
            if campaigns:
                for c in campaigns:
                    print(f"      - {c.get('name')} (id: {c.get('id')}, status: {c.get('status')}, created: {c.get('created_at')})")
            else:
                print("      [X] No campaigns found")
            
            # Check drafts
            drafts = list(db.drafts.find(
                {'org_id': org_id},
                {'id': 1, 'campaign_id': 1, 'created_at': 1, 'status': 1, 'created_by': 1}
            ).sort('created_at', -1))
            
            print(f"\n    [Drafts]: {len(drafts)}")
            if drafts:
                for d in drafts[:10]:
                    created = d.get('created_at', 'Unknown')
                    campaign_id = d.get('campaign_id', 'None')
                    print(f"      - {d.get('id')} (campaign: {campaign_id}, status: {d.get('status')}, created: {created})")
                if len(drafts) > 10:
                    print(f"      ... and {len(drafts) - 10} more drafts")
            else:
                print("      [X] No drafts found")
            
            # Check scheduled posts
            scheduled_posts = list(db.scheduled_posts.find(
                {'org_id': org_id},
                {'id': 1, 'draft_id': 1, 'publish_time': 1, 'status': 1, 'created_at': 1}
            ).sort('created_at', -1))
            
            print(f"\n    [Scheduled Posts]: {len(scheduled_posts)}")
            if scheduled_posts:
                for p in scheduled_posts:
                    publish_time = p.get('publish_time', 'Unknown')
                    status = p.get('status', 'Unknown')
                    created = p.get('created_at', 'Unknown')
                    draft_id = p.get('draft_id', 'Unknown')
                    print(f"      - {p.get('id')}")
                    print(f"        draft_id: {draft_id}")
                    print(f"        publish_time: {publish_time}")
                    print(f"        status: {status}")
                    print(f"        created: {created}")
            else:
                print("      [X] No scheduled posts found")
            
            # Check AI generated posts
            ai_posts = list(db.ai_generated_posts.find(
                {'org_id': org_id},
                {'id': 1, 'campaign_id': 1, 'scheduled_for': 1, 'status': 1, 'created_at': 1}
            ).sort('created_at', -1))
            
            print(f"\n    [AI Generated Posts]: {len(ai_posts)}")
            if ai_posts:
                for p in ai_posts[:10]:
                    scheduled = p.get('scheduled_for', 'Not scheduled')
                    status = p.get('status', 'Unknown')
                    created = p.get('created_at', 'Unknown')
                    print(f"      - {p.get('id')} (campaign: {p.get('campaign_id')}, scheduled: {scheduled}, status: {status}, created: {created})")
                if len(ai_posts) > 10:
                    print(f"      ... and {len(ai_posts) - 10} more AI posts")
            else:
                print("      [X] No AI generated posts found")
            
            # Summary for this org
            total_posts = len(scheduled_posts) + len(ai_posts)
            if total_posts > 0:
                print(f"\n    [OK] Posts WERE generated for {org_name}!")
                print(f"        Total: {total_posts} posts ({len(scheduled_posts)} scheduled, {len(ai_posts)} AI)")
            else:
                print(f"\n    [X] Posts were NOT generated for {org_name}")
        
        # Overall summary
        print("\n" + "=" * 60)
        print("OVERALL SUMMARY:")
        total_campaigns = sum(len(list(db.campaigns.find({'org_id': org.get('id')}))) for org in orgs)
        total_drafts = sum(len(list(db.drafts.find({'org_id': org.get('id')}))) for org in orgs)
        total_scheduled = sum(len(list(db.scheduled_posts.find({'org_id': org.get('id')}))) for org in orgs)
        total_ai = sum(len(list(db.ai_generated_posts.find({'org_id': org.get('id')}))) for org in orgs)
        
        print(f"  Organizations: {len(orgs)}")
        print(f"  Campaigns: {total_campaigns}")
        print(f"  Drafts: {total_drafts}")
        print(f"  Scheduled Posts: {total_scheduled}")
        print(f"  AI Generated Posts: {total_ai}")
        print(f"  Total Posts: {total_scheduled + total_ai}")
        
        if total_scheduled > 0 or total_ai > 0:
            print("\n[OK] Posts WERE generated during onboarding!")
        else:
            print("\n[X] Posts were NOT generated during onboarding")
            print("\nThis confirms the issue - posts are not being created during onboarding.")
        
        print("=" * 60)
        
    except Exception as e:
        print(f"\n[X] Error checking database: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    check_jimmy_user()
















