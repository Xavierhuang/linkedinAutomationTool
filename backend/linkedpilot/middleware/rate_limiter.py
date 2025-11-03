"""
Rate limiting and usage tracking middleware
"""
from fastapi import HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from typing import Literal
import uuid


async def check_usage_limits(
    user_id: str,
    action: Literal['ai_generation', 'post_creation', 'image_generation'],
    db,
    tokens_needed: int = 0
) -> bool:
    """
    Check if user has sufficient quota for the requested action
    Returns True if allowed, raises HTTPException if limit exceeded
    """
    # Get current user with subscription info
    user = await db.users.find_one(
        {"id": user_id},
        {
            "_id": 0,
            "subscription_tier": 1,
            "ai_tokens_used": 1,
            "ai_tokens_limit": 1,
            "posts_this_month": 1,
            "post_limit_per_month": 1,
            "last_reset_date": 1
        }
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get user limits (with defaults)
    subscription_tier = user.get('subscription_tier', 'free')
    ai_tokens_used = user.get('ai_tokens_used', 0)
    ai_tokens_limit = user.get('ai_tokens_limit', 1000)  # Free tier default
    posts_this_month = user.get('posts_this_month', 0)
    post_limit_per_month = user.get('post_limit_per_month', 50)  # Free tier default
    last_reset_date = user.get('last_reset_date')
    
    # Check if we need to reset monthly counters
    if should_reset_monthly_usage(last_reset_date):
        await reset_monthly_usage(user_id, db)
        ai_tokens_used = 0
        posts_this_month = 0
    
    # Check limits based on action
    if action in ['ai_generation', 'image_generation']:
        if ai_tokens_used + tokens_needed > ai_tokens_limit:
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "AI token limit reached",
                    "limit": ai_tokens_limit,
                    "used": ai_tokens_used,
                    "needed": tokens_needed,
                    "upgrade_url": "/billing/upgrade" if subscription_tier == 'free' else None,
                    "message": f"You've used {ai_tokens_used} of {ai_tokens_limit} AI tokens this month."
                }
            )
    
    elif action == 'post_creation':
        # -1 means unlimited (Pro tier)
        if post_limit_per_month != -1 and posts_this_month >= post_limit_per_month:
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "Monthly post limit reached",
                    "limit": post_limit_per_month,
                    "used": posts_this_month,
                    "upgrade_url": "/billing/upgrade" if subscription_tier == 'free' else None,
                    "message": f"You've created {posts_this_month} of {post_limit_per_month} posts this month."
                }
            )
    
    return True


async def track_usage(
    user_id: str,
    resource_type: Literal['ai_generation', 'post_creation', 'linkedin_post', 'image_generation'],
    db,
    tokens_used: int = 0,
    cost: float = None,
    campaign_id: str = None,
    metadata: dict = None
):
    """Track user resource usage"""
    # Create usage tracking entry
    usage_entry = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "resource_type": resource_type,
        "tokens_used": tokens_used,
        "cost": cost or calculate_cost(tokens_used),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "campaign_id": campaign_id,
        "metadata": metadata or {}
    }
    
    await db.usage_tracking.insert_one(usage_entry)
    
    # Update user counters
    if resource_type in ['ai_generation', 'image_generation']:
        await db.users.update_one(
            {"id": user_id},
            {"$inc": {"ai_tokens_used": tokens_used}}
        )
    elif resource_type == 'post_creation':
        await db.users.update_one(
            {"id": user_id},
            {"$inc": {"posts_this_month": 1}}
        )


def should_reset_monthly_usage(last_reset_date) -> bool:
    """Check if monthly usage should be reset (new month)"""
    if not last_reset_date:
        return True
    
    # Parse date if it's a string
    if isinstance(last_reset_date, str):
        try:
            last_reset_date = datetime.fromisoformat(last_reset_date.replace('Z', '+00:00'))
        except:
            return True
    
    now = datetime.now(timezone.utc)
    
    # Reset if we're in a new month
    if now.month != last_reset_date.month or now.year != last_reset_date.year:
        return True
    
    return False


async def reset_monthly_usage(user_id: str, db):
    """Reset monthly usage counters"""
    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "ai_tokens_used": 0,
                "posts_this_month": 0,
                "last_reset_date": datetime.now(timezone.utc).isoformat()
            }
        }
    )


def calculate_cost(tokens_used: int) -> float:
    """Calculate cost based on token usage (for analytics)"""
    # Example: $0.01 per 1000 tokens
    return round(tokens_used * 0.00001, 4)


def estimate_tokens(text: str) -> int:
    """Estimate token count from text (rough approximation)"""
    # Rough estimate: ~4 characters per token
    return max(int(len(text) / 4), 100)  # Minimum 100 tokens



