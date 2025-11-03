"""
Admin routes for user management, billing, and analytics
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Literal
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
from linkedpilot.middleware.admin_auth import (
    get_current_admin_user,
    require_superadmin,
    log_admin_activity,
    create_admin_token
)

router = APIRouter(prefix="/admin", tags=["admin"])

# Import db from server
def get_db():
    from server import client
    return client[os.environ['DB_NAME']]


# ============================================================================
# AUTHENTICATION
# ============================================================================

class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AdminLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


@router.post("/auth/login", response_model=AdminLoginResponse)
async def admin_login(login_data: AdminLoginRequest, request: Request):
    """Admin login endpoint with separate JWT tokens"""
    from server import pwd_context
    
    db = get_db()
    
    # Find user
    user = await db.users.find_one({"email": login_data.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Verify user has admin role
    if user.get('role') not in ['admin', 'superadmin']:
        raise HTTPException(status_code=403, detail="Access denied. Admin privileges required.")
    
    # Verify password
    if not pwd_context.verify(login_data.password, user['hashed_password']):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Create admin token
    token = create_admin_token(user['id'], user.get('role', 'admin'))
    
    # Log admin login
    client_ip = request.client.host if request.client else None
    await log_admin_activity(
        admin_id=user['id'],
        action='admin_login',
        ip_address=client_ip
    )
    
    # Remove sensitive data
    user.pop('hashed_password', None)
    user.pop('_id', None)
    
    return AdminLoginResponse(
        access_token=token,
        user=user
    )


# ============================================================================
# USER MANAGEMENT
# ============================================================================

@router.get("/users")
async def get_all_users(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    tier: Optional[Literal['free', 'pro']] = None,
    status: Optional[Literal['active', 'suspended', 'deleted']] = None,
    search: Optional[str] = None,
    admin_user: dict = Depends(get_current_admin_user)
):
    """Get all users with pagination and filters"""
    db = get_db()
    
    # Build query
    query = {}
    if tier:
        query['subscription_tier'] = tier
    if status:
        query['status'] = status
    if search:
        query['$or'] = [
            {'email': {'$regex': search, '$options': 'i'}},
            {'full_name': {'$regex': search, '$options': 'i'}}
        ]
    
    # Get total count
    total = await db.users.count_documents(query)
    
    # Get paginated users
    skip = (page - 1) * limit
    users = await db.users.find(
        query,
        {"_id": 0, "hashed_password": 0}
    ).skip(skip).limit(limit).sort("created_at", -1).to_list(length=limit)
    
    # Enrich users with Stripe cancellation status
    import stripe
    from linkedpilot.routes.billing import get_stripe_keys
    
    secret_key, _, _, _ = await get_stripe_keys()
    if secret_key:
        stripe.api_key = secret_key
        for user in users:
            if user.get('stripe_subscription_id'):
                try:
                    subscription = stripe.Subscription.retrieve(user['stripe_subscription_id'])
                    user['cancel_at_period_end'] = getattr(subscription, 'cancel_at_period_end', False)
                    user['current_period_end'] = getattr(subscription, 'current_period_end', None)
                except:
                    user['cancel_at_period_end'] = False
                    user['current_period_end'] = None
    
    return {
        "users": users,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }


@router.get("/users/{user_id}")
async def get_user_details(
    user_id: str,
    admin_user: dict = Depends(get_current_admin_user)
):
    """Get detailed user information"""
    db = get_db()
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get usage statistics
    usage_stats = await db.usage_tracking.aggregate([
        {"$match": {"user_id": user_id}},
        {"$group": {
            "_id": "$resource_type",
            "total_usage": {"$sum": "$tokens_used"},
            "count": {"$sum": 1},
            "total_cost": {"$sum": "$cost"}
        }}
    ]).to_list(length=100)
    
    # Get subscription info
    subscription = await db.subscriptions.find_one({"user_id": user_id}, {"_id": 0})
    
    # Get campaign count
    campaign_count = await db.campaigns.count_documents({"user_id": user_id})
    
    # Get post count
    post_count = await db.ai_generated_posts.count_documents({"user_id": user_id})
    
    return {
        "user": user,
        "usage_stats": usage_stats,
        "subscription": subscription,
        "campaign_count": campaign_count,
        "post_count": post_count
    }


class UpdateUserRequest(BaseModel):
    subscription_tier: Optional[Literal['free', 'pro']] = None
    ai_tokens_limit: Optional[int] = None
    post_limit_per_month: Optional[int] = None
    status: Optional[Literal['active', 'suspended', 'deleted']] = None
    role: Optional[Literal['user', 'admin', 'superadmin']] = None


@router.patch("/users/{user_id}")
async def update_user(
    user_id: str,
    update_data: UpdateUserRequest,
    request: Request,
    admin_user: dict = Depends(get_current_admin_user)
):
    """Update user information"""
    db = get_db()
    
    # Build update dict
    update_dict = {}
    if update_data.subscription_tier is not None:
        update_dict['subscription_tier'] = update_data.subscription_tier
    if update_data.ai_tokens_limit is not None:
        update_dict['ai_tokens_limit'] = update_data.ai_tokens_limit
    if update_data.post_limit_per_month is not None:
        update_dict['post_limit_per_month'] = update_data.post_limit_per_month
    if update_data.status is not None:
        update_dict['status'] = update_data.status
    if update_data.role is not None:
        # Only superadmin can change roles
        if admin_user.get('role') != 'superadmin':
            raise HTTPException(status_code=403, detail="Only superadmin can change user roles")
        update_dict['role'] = update_data.role
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    # Update user
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Log activity
    client_ip = request.client.host if request.client else None
    await log_admin_activity(
        admin_id=admin_user['id'],
        action='user_updated',
        target_user_id=user_id,
        details=update_dict,
        ip_address=client_ip
    )
    
    return {"message": "User updated successfully"}


@router.post("/users/{user_id}/suspend")
async def suspend_user(
    user_id: str,
    request: Request,
    admin_user: dict = Depends(get_current_admin_user)
):
    """Suspend a user account"""
    db = get_db()
    
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"status": "suspended"}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Log activity
    client_ip = request.client.host if request.client else None
    await log_admin_activity(
        admin_id=admin_user['id'],
        action='user_suspended',
        target_user_id=user_id,
        ip_address=client_ip
    )
    
    return {"message": "User suspended successfully"}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    request: Request,
    admin_user: dict = Depends(require_superadmin)
):
    """Delete a user (superadmin only)"""
    db = get_db()
    
    # Soft delete - mark as deleted
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"status": "deleted"}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Log activity
    client_ip = request.client.host if request.client else None
    await log_admin_activity(
        admin_id=admin_user['id'],
        action='user_deleted',
        target_user_id=user_id,
        ip_address=client_ip
    )
    
    return {"message": "User deleted successfully"}


# ============================================================================
# BILLING & SUBSCRIPTIONS
# ============================================================================

@router.get("/billing/overview")
async def get_billing_overview(admin_user: dict = Depends(get_current_admin_user)):
    """Get billing overview metrics"""
    db = get_db()
    
    # Count active subscriptions
    active_pro_users = await db.users.count_documents({
        "subscription_tier": "pro",
        "subscription_status": "active"
    })
    
    # Calculate MRR (Monthly Recurring Revenue)
    # Assuming $30/month for Pro tier
    mrr = active_pro_users * 30
    
    # Get total users
    total_users = await db.users.count_documents({})
    free_users = await db.users.count_documents({"subscription_tier": "free"})
    
    # Get new signups this month
    first_day_of_month = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    new_signups_this_month = await db.users.count_documents({
        "created_at": {"$gte": first_day_of_month.isoformat()}
    })
    
    # Calculate churn (users who cancelled this month)
    churned_this_month = await db.users.count_documents({
        "subscription_status": "cancelled",
        "cancelled_at": {"$gte": first_day_of_month.isoformat()}
    })
    
    churn_rate = (churned_this_month / active_pro_users * 100) if active_pro_users > 0 else 0
    
    return {
        "total_users": total_users,
        "free_users": free_users,
        "pro_users": active_pro_users,
        "mrr": mrr,
        "new_signups_this_month": new_signups_this_month,
        "churned_this_month": churned_this_month,
        "churn_rate": round(churn_rate, 2)
    }


@router.get("/subscriptions")
async def get_subscriptions(
    status: Optional[Literal['active', 'cancelled', 'past_due']] = None,
    admin_user: dict = Depends(get_current_admin_user)
):
    """Get all subscriptions"""
    db = get_db()
    
    query = {"subscription_tier": "pro"}
    if status:
        query['subscription_status'] = status
    
    subscriptions = await db.users.find(
        query,
        {"_id": 0, "id": 1, "email": 1, "full_name": 1, "subscription_tier": 1,
         "subscription_status": 1, "stripe_customer_id": 1, "subscription_start_date": 1,
         "subscription_end_date": 1}
    ).to_list(length=1000)
    
    return {"subscriptions": subscriptions}


# ============================================================================
# ANALYTICS
# ============================================================================

@router.get("/analytics/usage")
async def get_usage_analytics(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    admin_user: dict = Depends(get_current_admin_user)
):
    """Get usage analytics"""
    db = get_db()
    
    # Build date filter
    date_filter = {}
    if start_date:
        date_filter['$gte'] = start_date
    if end_date:
        date_filter['$lte'] = end_date
    
    match_stage = {"timestamp": date_filter} if date_filter else {}
    
    # Aggregate usage by resource type
    usage_by_type = await db.usage_tracking.aggregate([
        {"$match": match_stage},
        {"$group": {
            "_id": "$resource_type",
            "total_tokens": {"$sum": "$tokens_used"},
            "total_cost": {"$sum": "$cost"},
            "count": {"$sum": 1}
        }}
    ]).to_list(length=100)
    
    # Get top users by usage
    top_users = await db.usage_tracking.aggregate([
        {"$match": match_stage},
        {"$group": {
            "_id": "$user_id",
            "total_tokens": {"$sum": "$tokens_used"},
            "total_cost": {"$sum": "$cost"}
        }},
        {"$sort": {"total_tokens": -1}},
        {"$limit": 10}
    ]).to_list(length=10)
    
    # Enrich with user details
    for user_data in top_users:
        user = await db.users.find_one(
            {"id": user_data['_id']},
            {"_id": 0, "email": 1, "full_name": 1}
        )
        if user:
            user_data['user'] = user
    
    return {
        "usage_by_type": usage_by_type,
        "top_users": top_users
    }


@router.get("/analytics/revenue")
async def get_revenue_analytics(
    period: Literal['week', 'month', 'year'] = 'month',
    admin_user: dict = Depends(get_current_admin_user)
):
    """Get revenue analytics"""
    db = get_db()
    
    # Get active Pro users by signup date
    pro_users = await db.users.find(
        {"subscription_tier": "pro", "subscription_status": "active"},
        {"_id": 0, "subscription_start_date": 1}
    ).to_list(length=10000)
    
    # Group by period
    # For simplicity, calculating based on current active subscriptions
    total_revenue = len(pro_users) * 30  # $30 per month
    
    return {
        "period": period,
        "total_active_subscriptions": len(pro_users),
        "mrr": total_revenue,
        "arr": total_revenue * 12,
        "avg_revenue_per_user": 30
    }


# ============================================================================
# ACTIVITY LOGS
# ============================================================================

@router.get("/logs")
async def get_activity_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
    admin_id: Optional[str] = None,
    action: Optional[str] = None,
    admin_user: dict = Depends(get_current_admin_user)
):
    """Get admin activity logs"""
    db = get_db()
    
    # Build query
    query = {}
    if admin_id:
        query['admin_id'] = admin_id
    if action:
        query['action'] = action
    
    # Get total count
    total = await db.admin_activity_logs.count_documents(query)
    
    # Get paginated logs
    skip = (page - 1) * limit
    logs = await db.admin_activity_logs.find(
        query,
        {"_id": 0}
    ).skip(skip).limit(limit).sort("timestamp", -1).to_list(length=limit)
    
    # Enrich with admin details
    for log in logs:
        admin = await db.users.find_one(
            {"id": log['admin_id']},
            {"_id": 0, "email": 1, "full_name": 1}
        )
        if admin:
            log['admin'] = admin
    
    return {
        "logs": logs,
        "total": total,
        "page": page,
        "limit": limit
    }


# ============================================================================
# SYSTEM SETTINGS
# ============================================================================

class SystemSettingsRequest(BaseModel):
    free_tier_ai_tokens: Optional[int] = None
    free_tier_post_limit: Optional[int] = None
    pro_tier_ai_tokens: Optional[int] = None
    pro_tier_post_limit: Optional[int] = None


@router.get("/system/settings")
async def get_system_settings(admin_user: dict = Depends(get_current_admin_user)):
    """Get system settings"""
    db = get_db()
    
    settings = await db.system_settings.find_one({"_id": "global"}, {"_id": 0})
    
    if not settings:
        # Return defaults
        settings = {
            "free_tier_ai_tokens": 1000,
            "free_tier_post_limit": 50,
            "pro_tier_ai_tokens": 10000,
            "pro_tier_post_limit": -1  # unlimited
        }
    
    return settings


@router.patch("/system/settings")
async def update_system_settings(
    settings: SystemSettingsRequest,
    request: Request,
    admin_user: dict = Depends(require_superadmin)
):
    """Update system settings (superadmin only)"""
    db = get_db()
    
    update_dict = {}
    if settings.free_tier_ai_tokens is not None:
        update_dict['free_tier_ai_tokens'] = settings.free_tier_ai_tokens
    if settings.free_tier_post_limit is not None:
        update_dict['free_tier_post_limit'] = settings.free_tier_post_limit
    if settings.pro_tier_ai_tokens is not None:
        update_dict['pro_tier_ai_tokens'] = settings.pro_tier_ai_tokens
    if settings.pro_tier_post_limit is not None:
        update_dict['pro_tier_post_limit'] = settings.pro_tier_post_limit
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="No settings to update")
    
    await db.system_settings.update_one(
        {"_id": "global"},
        {"$set": update_dict},
        upsert=True
    )
    
    # Log activity
    client_ip = request.client.host if request.client else None
    await log_admin_activity(
        admin_id=admin_user['id'],
        action='system_settings_updated',
        details=update_dict,
        ip_address=client_ip
    )
    
    return {"message": "System settings updated successfully"}


# ============================================================================
# DASHBOARD STATS
# ============================================================================

@router.get("/dashboard/stats")
async def get_dashboard_stats(admin_user: dict = Depends(get_current_admin_user)):
    """Get dashboard overview statistics"""
    db = get_db()
    
    now = datetime.now(timezone.utc)
    first_day_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    thirty_days_ago = now - timedelta(days=30)
    last_month_start = (first_day_of_month - timedelta(days=1)).replace(day=1)
    
    # Total users
    total_users = await db.users.count_documents({})
    total_users_last_month = await db.users.count_documents({
        "created_at": {"$lt": first_day_of_month.isoformat()}
    })
    
    # Active subscriptions (including those marked for cancellation)
    active_pro = await db.users.count_documents({
        "subscription_tier": "pro",
        "subscription_status": "active"
    })
    active_pro_last_month = await db.users.count_documents({
        "subscription_tier": "pro",
        "subscription_status": "active",
        "subscription_start_date": {"$lt": first_day_of_month.isoformat()}
    })
    
    # Cancelling subscriptions (Pro + Active + cancel_at_period_end)
    cancelling_subs = await db.users.count_documents({
        "subscription_tier": "pro",
        "subscription_status": "active",
        "cancel_at_period_end": True
    })
    
    # Recent cancellations (last 30 days)
    recent_cancellations = await db.users.count_documents({
        "cancelled_at": {"$gte": thirty_days_ago.isoformat()}
    })
    
    # MRR (current active subscriptions)
    mrr = active_pro * 30
    mrr_last_month = active_pro_last_month * 30
    
    # At Risk MRR (subscriptions that will cancel)
    at_risk_mrr = cancelling_subs * 30
    
    # AI tokens used this month
    tokens_pipeline = [
        {"$match": {"timestamp": {"$gte": first_day_of_month}}},
        {"$group": {"_id": None, "total": {"$sum": "$tokens_used"}}}
    ]
    tokens_result = await db.usage_tracking.aggregate(tokens_pipeline).to_list(length=1)
    total_tokens = tokens_result[0]['total'] if tokens_result else 0
    
    tokens_pipeline_last = [
        {"$match": {"timestamp": {"$gte": last_month_start, "$lt": first_day_of_month}}},
        {"$group": {"_id": None, "total": {"$sum": "$tokens_used"}}}
    ]
    tokens_result_last = await db.usage_tracking.aggregate(tokens_pipeline_last).to_list(length=1)
    total_tokens_last = tokens_result_last[0]['total'] if tokens_result_last else 0
    
    # Posts created this month
    posts_this_month = await db.ai_generated_posts.count_documents({
        "created_at": {"$gte": first_day_of_month.isoformat()}
    })
    posts_last_month = await db.ai_generated_posts.count_documents({
        "created_at": {"$gte": last_month_start.isoformat(), "$lt": first_day_of_month.isoformat()}
    })
    
    # User growth (last 30 days)
    new_users_30d = await db.users.count_documents({
        "created_at": {"$gte": thirty_days_ago.isoformat()}
    })
    new_users_prev_30d = await db.users.count_documents({
        "created_at": {"$gte": (thirty_days_ago - timedelta(days=30)).isoformat(), "$lt": thirty_days_ago.isoformat()}
    })
    
    # Calculate percentage changes
    def calc_change(current, previous):
        if previous == 0:
            return 100.0 if current > 0 else 0.0
        return round(((current - previous) / previous) * 100, 1)
    
    return {
        "total_users": total_users,
        "total_users_change": calc_change(total_users, total_users_last_month),
        "active_subscriptions": active_pro,
        "active_subscriptions_change": calc_change(active_pro, active_pro_last_month),
        "cancelling_subscriptions": cancelling_subs,
        "recent_cancellations": recent_cancellations,
        "at_risk_mrr": at_risk_mrr,
        "mrr": mrr,
        "mrr_change": calc_change(mrr, mrr_last_month),
        "ai_tokens_this_month": total_tokens,
        "ai_tokens_change": calc_change(total_tokens, total_tokens_last),
        "posts_this_month": posts_this_month,
        "posts_change": calc_change(posts_this_month, posts_last_month),
        "new_users_30_days": new_users_30d,
        "new_users_change": calc_change(new_users_30d, new_users_prev_30d)
    }


@router.get("/dashboard/recent-activity")
async def get_recent_activity(admin_user: dict = Depends(get_current_admin_user), limit: int = 10):
    """Get recent activity across the platform"""
    db = get_db()
    
    # Get recent admin activity logs
    recent_logs = await db.admin_activity_logs.find({}).sort("timestamp", -1).limit(limit).to_list(length=limit)
    
    # Get recent user signups
    recent_users = await db.users.find({}).sort("created_at", -1).limit(5).to_list(length=5)
    
    # Get recent subscription changes
    recent_subs = await db.users.find({
        "subscription_tier": "pro"
    }).sort("subscription_start_date", -1).limit(5).to_list(length=5)
    
    # Get recent cancellations
    recent_cancels = await db.users.find({
        "cancel_at_period_end": True
    }).sort("cancelled_at", -1).limit(5).to_list(length=5)
    
    # Combine and format activities
    activities = []
    
    for user in recent_users:
        activities.append({
            "type": "user_signup",
            "description": f"New user signup",
            "email": user.get('email', 'Unknown'),
            "timestamp": user.get('created_at', datetime.now(timezone.utc).isoformat())
        })
    
    for sub in recent_subs:
        if sub.get('subscription_start_date'):
            activities.append({
                "type": "subscription_upgrade",
                "description": f"Subscription upgraded",
                "email": sub.get('email', 'Unknown'),
                "timestamp": sub.get('subscription_start_date', datetime.now(timezone.utc).isoformat())
            })
    
    for cancel in recent_cancels:
        if cancel.get('cancelled_at'):
            activities.append({
                "type": "subscription_cancellation",
                "description": f"Subscription cancelled (ends at period)",
                "email": cancel.get('email', 'Unknown'),
                "timestamp": cancel.get('cancelled_at', datetime.now(timezone.utc).isoformat())
            })
    
    # Check for high usage
    high_usage_users = await db.users.find({
        "ai_tokens_used": {"$gt": 8000}  # Alert at 80% of pro limit
    }).limit(5).to_list(length=5)
    
    for user in high_usage_users:
        activities.append({
            "type": "high_usage_alert",
            "description": f"High AI usage alert",
            "email": user.get('email', 'Unknown'),
            "timestamp": user.get('updated_at', datetime.now(timezone.utc).isoformat())
        })
    
    # Sort by timestamp and limit
    activities.sort(key=lambda x: x['timestamp'], reverse=True)
    
    return activities[:limit]


# ============================================================================
# SYSTEM-WIDE API KEYS MANAGEMENT
# ============================================================================

class SystemKeysRequest(BaseModel):
    openai_api_key: Optional[str] = ''
    openrouter_api_key: Optional[str] = ''
    anthropic_api_key: Optional[str] = ''
    google_ai_api_key: Optional[str] = ''
    linkedin_client_id: Optional[str] = ''
    linkedin_client_secret: Optional[str] = ''
    unsplash_access_key: Optional[str] = ''
    pexels_api_key: Optional[str] = ''
    canva_api_key: Optional[str] = ''
    stripe_secret_key: Optional[str] = ''
    stripe_publishable_key: Optional[str] = ''
    stripe_webhook_secret: Optional[str] = ''
    stripe_pro_price_id: Optional[str] = ''


@router.get("/system-keys")
async def get_system_keys(admin_user: dict = Depends(get_current_admin_user)):
    """Get system-wide API keys (admin only)"""
    from cryptography.fernet import Fernet
    import base64
    import hashlib
    
    # Encryption setup - ALWAYS use ENCRYPTION_KEY from environment
    _env_key = os.environ.get('ENCRYPTION_KEY')
    if not _env_key:
        raise HTTPException(status_code=500, detail="ENCRYPTION_KEY not configured in environment")
    cipher_suite = Fernet(_env_key.encode() if isinstance(_env_key, str) else _env_key)
    
    def decrypt_value(encrypted_value: str) -> str:
        if not encrypted_value or encrypted_value.strip() == '':
            return ''
        try:
            decrypted = cipher_suite.decrypt(encrypted_value.encode())
            return decrypted.decode()
        except Exception:
            return ''
    
    db = get_db()
    
    # Fetch system keys from database
    system_settings = await db.system_settings.find_one({"_id": "api_keys"})
    
    if not system_settings:
        # Return empty keys if not configured
        return {
            "openai_api_key": "",
            "openrouter_api_key": "",
            "anthropic_api_key": "",
            "google_ai_api_key": "",
            "linkedin_client_id": "",
            "linkedin_client_secret": "",
            "unsplash_access_key": "",
            "pexels_api_key": "",
            "canva_api_key": "",
            "stripe_secret_key": "",
            "stripe_publishable_key": "",
            "stripe_webhook_secret": "",
            "stripe_pro_price_id": ""
        }
    
    # Decrypt and return keys
    return {
        "openai_api_key": decrypt_value(system_settings.get('openai_api_key', '')),
        "openrouter_api_key": decrypt_value(system_settings.get('openrouter_api_key', '')),
        "anthropic_api_key": decrypt_value(system_settings.get('anthropic_api_key', '')),
        "google_ai_api_key": decrypt_value(system_settings.get('google_ai_api_key', '')),
        "linkedin_client_id": decrypt_value(system_settings.get('linkedin_client_id', '')),
        "linkedin_client_secret": decrypt_value(system_settings.get('linkedin_client_secret', '')),
        "unsplash_access_key": decrypt_value(system_settings.get('unsplash_access_key', '')),
        "pexels_api_key": decrypt_value(system_settings.get('pexels_api_key', '')),
        "canva_api_key": decrypt_value(system_settings.get('canva_api_key', '')),
        "stripe_secret_key": decrypt_value(system_settings.get('stripe_secret_key', '')),
        "stripe_publishable_key": decrypt_value(system_settings.get('stripe_publishable_key', '')),
        "stripe_webhook_secret": decrypt_value(system_settings.get('stripe_webhook_secret', '')),
        "stripe_pro_price_id": decrypt_value(system_settings.get('stripe_pro_price_id', ''))
    }


@router.post("/system-keys")
async def save_system_keys(
    keys: SystemKeysRequest,
    admin_user: dict = Depends(get_current_admin_user),
    request: Request = None
):
    """Save system-wide API keys (admin only)"""
    from cryptography.fernet import Fernet
    import base64
    import hashlib
    
    # Encryption setup - ALWAYS use ENCRYPTION_KEY from environment
    _env_key = os.environ.get('ENCRYPTION_KEY')
    if not _env_key:
        raise HTTPException(status_code=500, detail="ENCRYPTION_KEY not configured in environment")
    cipher_suite = Fernet(_env_key.encode() if isinstance(_env_key, str) else _env_key)
    
    def encrypt_value(value: str) -> str:
        if not value or value.strip() == '':
            return ''
        return cipher_suite.encrypt(value.encode()).decode()
    
    db = get_db()
    
    # Encrypt all keys
    encrypted_data = {
        "_id": "api_keys",
        "openai_api_key": encrypt_value(keys.openai_api_key) if keys.openai_api_key else '',
        "openrouter_api_key": encrypt_value(keys.openrouter_api_key) if keys.openrouter_api_key else '',
        "anthropic_api_key": encrypt_value(keys.anthropic_api_key) if keys.anthropic_api_key else '',
        "google_ai_api_key": encrypt_value(keys.google_ai_api_key) if keys.google_ai_api_key else '',
        "linkedin_client_id": encrypt_value(keys.linkedin_client_id) if keys.linkedin_client_id else '',
        "linkedin_client_secret": encrypt_value(keys.linkedin_client_secret) if keys.linkedin_client_secret else '',
        "unsplash_access_key": encrypt_value(keys.unsplash_access_key) if keys.unsplash_access_key else '',
        "pexels_api_key": encrypt_value(keys.pexels_api_key) if keys.pexels_api_key else '',
        "canva_api_key": encrypt_value(keys.canva_api_key) if keys.canva_api_key else '',
        "stripe_secret_key": encrypt_value(keys.stripe_secret_key) if keys.stripe_secret_key else '',
        "stripe_publishable_key": encrypt_value(keys.stripe_publishable_key) if keys.stripe_publishable_key else '',
        "stripe_webhook_secret": encrypt_value(keys.stripe_webhook_secret) if keys.stripe_webhook_secret else '',
        "stripe_pro_price_id": encrypt_value(keys.stripe_pro_price_id) if keys.stripe_pro_price_id else '',
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": admin_user['id']
    }
    
    # Upsert system settings
    await db.system_settings.update_one(
        {"_id": "api_keys"},
        {"$set": encrypted_data},
        upsert=True
    )
    
    # Log admin activity
    if request:
        await log_admin_activity(
            admin_id=admin_user['id'],
            action="system_keys_updated",
            details={"keys_updated": [k for k, v in keys.dict().items() if v]},
            ip_address=request.client.host if request.client else None
        )
    
    return {"message": "System API keys saved successfully"}

