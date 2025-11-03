import asyncio
import os
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient

def get_db():
    """Get database connection"""
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    return client[os.environ['DB_NAME']]

async def restore_posts():
    db = get_db()
    
    # Find the posts that were posted today (status='posted', posted_at today)
    today_start = datetime(2025, 10, 25, 0, 0, 0)
    today_end = datetime(2025, 10, 25, 23, 59, 59)
    
    posts = await db.ai_generated_posts.find({
        'org_id': '75d9110d-e08e-47e5-8cfa-9cdd23c23174',
        'status': 'posted',
        'posted_at': {'$gte': today_start, '$lte': today_end}
    }, {'_id': 0, 'id': 1, 'content': 1, 'posted_at': 1}).to_list(10)
    
    print(f'Found {len(posts)} posts to restore:')
    for post in posts:
        print(f"  - {post['id']}: {post['content'][:50]}...")
    
    if len(posts) > 0:
        # Update all found posts: change status to approved, clear posted_at and scheduled_for
        result = await db.ai_generated_posts.update_many(
            {
                'org_id': '75d9110d-e08e-47e5-8cfa-9cdd23c23174',
                'status': 'posted',
                'posted_at': {'$gte': today_start, '$lte': today_end}
            },
            {
                '$set': {
                    'status': 'approved',
                    'updated_at': datetime.utcnow()
                },
                '$unset': {
                    'posted_at': '',
                    'linkedin_post_id': '',
                    'platform_url': '',
                    'scheduled_for': ''
                }
            }
        )
        print(f'\n✅ Restored {result.modified_count} posts to approved status')
        print('They will be automatically rescheduled by the scheduler within 5 minutes')
    else:
        print('No posts found to restore')

asyncio.run(restore_posts())


from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient

def get_db():
    """Get database connection"""
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    return client[os.environ['DB_NAME']]

async def restore_posts():
    db = get_db()
    
    # Find the posts that were posted today (status='posted', posted_at today)
    today_start = datetime(2025, 10, 25, 0, 0, 0)
    today_end = datetime(2025, 10, 25, 23, 59, 59)
    
    posts = await db.ai_generated_posts.find({
        'org_id': '75d9110d-e08e-47e5-8cfa-9cdd23c23174',
        'status': 'posted',
        'posted_at': {'$gte': today_start, '$lte': today_end}
    }, {'_id': 0, 'id': 1, 'content': 1, 'posted_at': 1}).to_list(10)
    
    print(f'Found {len(posts)} posts to restore:')
    for post in posts:
        print(f"  - {post['id']}: {post['content'][:50]}...")
    
    if len(posts) > 0:
        # Update all found posts: change status to approved, clear posted_at and scheduled_for
        result = await db.ai_generated_posts.update_many(
            {
                'org_id': '75d9110d-e08e-47e5-8cfa-9cdd23c23174',
                'status': 'posted',
                'posted_at': {'$gte': today_start, '$lte': today_end}
            },
            {
                '$set': {
                    'status': 'approved',
                    'updated_at': datetime.utcnow()
                },
                '$unset': {
                    'posted_at': '',
                    'linkedin_post_id': '',
                    'platform_url': '',
                    'scheduled_for': ''
                }
            }
        )
        print(f'\n✅ Restored {result.modified_count} posts to approved status')
        print('They will be automatically rescheduled by the scheduler within 5 minutes')
    else:
        print('No posts found to restore')

asyncio.run(restore_posts())


from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient

def get_db():
    """Get database connection"""
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    return client[os.environ['DB_NAME']]

async def restore_posts():
    db = get_db()
    
    # Find the posts that were posted today (status='posted', posted_at today)
    today_start = datetime(2025, 10, 25, 0, 0, 0)
    today_end = datetime(2025, 10, 25, 23, 59, 59)
    
    posts = await db.ai_generated_posts.find({
        'org_id': '75d9110d-e08e-47e5-8cfa-9cdd23c23174',
        'status': 'posted',
        'posted_at': {'$gte': today_start, '$lte': today_end}
    }, {'_id': 0, 'id': 1, 'content': 1, 'posted_at': 1}).to_list(10)
    
    print(f'Found {len(posts)} posts to restore:')
    for post in posts:
        print(f"  - {post['id']}: {post['content'][:50]}...")
    
    if len(posts) > 0:
        # Update all found posts: change status to approved, clear posted_at and scheduled_for
        result = await db.ai_generated_posts.update_many(
            {
                'org_id': '75d9110d-e08e-47e5-8cfa-9cdd23c23174',
                'status': 'posted',
                'posted_at': {'$gte': today_start, '$lte': today_end}
            },
            {
                '$set': {
                    'status': 'approved',
                    'updated_at': datetime.utcnow()
                },
                '$unset': {
                    'posted_at': '',
                    'linkedin_post_id': '',
                    'platform_url': '',
                    'scheduled_for': ''
                }
            }
        )
        print(f'\n✅ Restored {result.modified_count} posts to approved status')
        print('They will be automatically rescheduled by the scheduler within 5 minutes')
    else:
        print('No posts found to restore')

asyncio.run(restore_posts())

