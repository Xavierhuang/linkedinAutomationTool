"""
Admin routes for user management, billing, and analytics
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Literal, Dict
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


# ============================================================================
# DEFAULT AI MODEL SETTINGS
# ============================================================================

class ModelSettingsRequest(BaseModel):
    # Text generation models
    text_draft_content: Optional[str] = 'google_ai_studio:gemini-2.5-flash'  # Provider:Model
    text_text_overlay: Optional[str] = 'google_ai_studio:gemini-2.5-flash'
    text_carousel_content: Optional[str] = 'google_ai_studio:gemini-2.5-flash'
    
    # Image generation models - using only Gemini 3 Pro Image Preview
    image_draft_image: Optional[str] = 'google_ai_studio:gemini-3-pro-image-preview'
    image_carousel_images: Optional[str] = 'google_ai_studio:gemini-3-pro-image-preview'


@router.get("/model-settings")
async def get_model_settings(admin_user: dict = Depends(get_current_admin_user)):
    """Get default AI model settings (admin only)"""
    db = get_db()
    
    # Fetch model settings from database
    model_settings = await db.system_settings.find_one({"_id": "model_settings"})
    
    if not model_settings:
        # Return default values
        return {
            "text_draft_content": "google_ai_studio:gemini-2.5-flash",
            "text_text_overlay": "google_ai_studio:gemini-2.5-flash",
            "text_carousel_content": "google_ai_studio:gemini-2.5-flash",
            "image_draft_image": "google_ai_studio:gemini-3-pro-image-preview",
            "image_carousel_images": "google_ai_studio:gemini-3-pro-image-preview"
        }
    
    return {
        "text_draft_content": model_settings.get('text_draft_content', 'google_ai_studio:gemini-2.5-flash'),
        "text_text_overlay": model_settings.get('text_text_overlay', 'google_ai_studio:gemini-2.5-flash'),
        "text_carousel_content": model_settings.get('text_carousel_content', 'google_ai_studio:gemini-2.5-flash'),
        "image_draft_image": model_settings.get('image_draft_image', 'google_ai_studio:gemini-3-pro-image-preview'),
        "image_carousel_images": model_settings.get('image_carousel_images', 'google_ai_studio:gemini-3-pro-image-preview')
    }


@router.post("/model-settings")
async def save_model_settings(
    settings: ModelSettingsRequest,
    admin_user: dict = Depends(get_current_admin_user),
    request: Request = None
):
    """Save default AI model settings (admin only)"""
    db = get_db()
    
    # Save model settings
    settings_data = {
        "_id": "model_settings",
        "text_draft_content": settings.text_draft_content or "google_ai_studio:gemini-2.5-flash",
        "text_text_overlay": settings.text_text_overlay or "google_ai_studio:gemini-2.5-flash",
        "text_carousel_content": settings.text_carousel_content or "google_ai_studio:gemini-2.5-flash",
        "image_draft_image": settings.image_draft_image or "google_ai_studio:gemini-3-pro-image-preview",
        "image_carousel_images": settings.image_carousel_images or "google_ai_studio:gemini-3-pro-image-preview",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": admin_user['id']
    }
    
    # Upsert model settings
    await db.system_settings.update_one(
        {"_id": "model_settings"},
        {"$set": settings_data},
        upsert=True
    )
    
    # Log admin activity
    if request:
        await log_admin_activity(
            admin_id=admin_user['id'],
            action="model_settings_updated",
            details={"settings": settings.dict()},
            ip_address=request.client.host if request.client else None
        )
    
    return {"message": "Model settings saved successfully"}


@router.get("/test-google-api")
async def test_google_api(admin_user: dict = Depends(get_current_admin_user)):
    """Test Google AI Studio API key accessibility and functionality (admin only)"""
    from linkedpilot.routes.drafts import get_system_api_key
    from linkedpilot.adapters.image_adapter import ImageAdapter
    
    result = {
        "api_key_found": False,
        "api_key_length": 0,
        "api_key_preview": "",
        "adapter_initialized": False,
        "test_image_generated": False,
        "error": None,
        "model_used": None
    }
    
    try:
        # Step 1: Get API key
        print(f"[TEST] Testing Google AI Studio API key access...")
        google_api_key, provider = await get_system_api_key("google_ai_studio")
        
        if not google_api_key:
            result["error"] = "Google AI Studio API key not found in system settings"
            return result
        
        result["api_key_found"] = True
        result["api_key_length"] = len(google_api_key)
        result["api_key_preview"] = f"{google_api_key[:10]}...{google_api_key[-4:]}" if len(google_api_key) > 14 else "***"
        
        # Step 2: Initialize adapter
        print(f"[TEST] Initializing ImageAdapter with Gemini 3 Pro Image Preview...")
        try:
            image_adapter = ImageAdapter(
                api_key=google_api_key,
                provider="google_ai_studio",
                model="gemini-3-pro-image-preview"
            )
            result["adapter_initialized"] = True
            result["model_used"] = image_adapter.model
        except Exception as adapter_error:
            result["error"] = f"Failed to initialize ImageAdapter: {str(adapter_error)}"
            return result
        
        # Step 3: Test image generation with a simple prompt
        print(f"[TEST] Testing image generation...")
        try:
            test_prompt = "A professional LinkedIn post image showing a modern office workspace"
            image_result = await image_adapter.generate_image(
                prompt=test_prompt,
                style="professional",
                size="1024x1024"
            )
            
            if image_result and image_result.get('url'):
                result["test_image_generated"] = True
                result["image_url"] = image_result.get('url')
                print(f"[TEST] SUCCESS: Image generated at {image_result.get('url')[:50]}...")
            else:
                result["error"] = "Image generation returned no URL"
        except Exception as gen_error:
            result["error"] = f"Image generation failed: {str(gen_error)}"
            import traceback
            result["traceback"] = traceback.format_exc()
        
    except Exception as e:
        result["error"] = f"Test failed: {str(e)}"
        import traceback
        result["traceback"] = traceback.format_exc()
    
    return result


@router.get("/available-models")
async def get_available_models(admin_user: dict = Depends(get_current_admin_user)):
    """Get list of available AI models organized by provider"""
    return {
        "text_models": {
            "google_ai_studio": [
                {"value": "google_ai_studio:gemini-2.5-flash", "label": "Gemini 2.5 Flash (Recommended)"},
                {"value": "google_ai_studio:gemini-2.5-pro", "label": "Gemini 2.5 Pro"},
                {"value": "google_ai_studio:gemini-2.0-flash", "label": "Gemini 2.0 Flash"},
            ],
            "openai": [
                {"value": "openai:gpt-4o", "label": "GPT-4o (Recommended)"},
                {"value": "openai:gpt-4-turbo", "label": "GPT-4 Turbo"},
                {"value": "openai:gpt-3.5-turbo", "label": "GPT-3.5 Turbo"},
            ],
        },
        "image_models": {
            "google_ai_studio": [
                {"value": "google_ai_studio:gemini-3-pro-image-preview", "label": "Gemini 3 Pro Image Preview (Recommended)"},
            ],
            "stock": [
                {"value": "stock:unsplash", "label": "Unsplash Stock Photos"},
                {"value": "stock:pexels", "label": "Pexels Stock Photos"},
            ]
        }
    }


# ============================================================================
# AI PROMPTS MANAGEMENT
# ============================================================================

class AIPromptsRequest(BaseModel):
    prompts: Dict[str, Dict[str, str]]


def get_default_prompts():
    """Get default prompts from codebase - extracts actual prompts used in the app"""
    
    # Content Generation Prompt - from ai_content_generator.py
    content_prompt = """You are an expert LinkedIn content strategist and copywriter specializing in campaign-driven content that drives measurable engagement and builds thought leadership.

**CAMPAIGN CONTEXT**:
- Campaign Name: {name}
{'- Campaign Goal: ' + description if description else ''}
- Target Audience: {audience_text}
- Content Focus: {content_pillar}
- Tone Style: {tone_voice.capitalize()}

**TEMPORAL CONTEXT**:
Consider {current_year} trends, recent developments in {current_month} {current_year}, and current industry insights related to "{content_pillar}".

**TONE REQUIREMENTS**:
Write with a {tone_voice} voice that is authentic, authoritative, and value-driven. Balance expertise with approachability.

**CONTENT STRUCTURE** (follow this pattern exactly):
1. **Opening Hook** (1-2 sentences): 
   - Start with a compelling question, surprising stat, bold statement, or personal observation
   - Make it scroll-stopping and relevant to "{content_pillar}"
   - Connect to the target audience's interests and challenges

2. **Core Value** (3-5 short paragraphs):
   - Each paragraph: 2-3 sentences maximum
   - Include specific examples, data points, or actionable insights
   - Relate to "{content_pillar}" throughout
   - Make it practical and immediately useful
   - Address target audience needs directly

3. **Call-to-Action** (1 sentence):
   - End with an engaging question that invites conversation
   - OR provide a clear next step for the reader
   - Make it feel natural, not forced

4. **Hashtags (REQUIRED)**:
   - Include exactly 5 relevant hashtags at the very end of the post, on a new line after the CTA
   - Mix trending hashtags with niche-specific ones
   - Make them relevant to the topic and industry
   - Use proper LinkedIn hashtag format (e.g., #Leadership #BusinessGrowth #StartupTips)

**QUALITY STANDARDS**:
- Length: Under 260 words (optimal for LinkedIn algorithm)
- Readability: Use line breaks between paragraphs for mobile readability
- Engagement: Include 2-3 strategic emojis (not excessive)
- Value: Provide genuine, specific insights - not generic advice
- Authenticity: Write like a human expert, not an AI or marketer
- Variety: Make each post unique - vary sentence structure, examples, and perspectives
- Specificity: Use concrete examples, numbers, or scenarios

**OUTPUT FORMAT**:
Write the complete post with all content, then add exactly 5 hashtags at the end on a new line.

Example:
[Your post content here with paragraphs separated by line breaks]

What's your take?

#HashtagOne #HashtagTwo #HashtagThree #HashtagFour #HashtagFive

**OUTPUT REQUIREMENTS**:
- Write the complete post with all content
- Use line breaks between paragraphs
- Include exactly 5 hashtags at the end on a new line
- Make it feel authentic and human-written
- Ensure variety - do NOT repeat patterns from previous posts
- Focus on "{content_pillar}" but approach it from fresh angles each time
- Do NOT include any meta-commentary or explanations
- Return ONLY the post content with hashtags

Generate the LinkedIn post now:"""
    
    # LLM Adapter prompt - from llm_adapter.py
    llm_prompt = """You are an expert LinkedIn content strategist with deep expertise in creating high-engagement posts that drive meaningful conversations and audience growth.

TASK: Create a compelling, professional LinkedIn post about: "{topic}"

IMPORTANT: Stay fully focused on the exact topic. Do NOT default to general themes (AI, tech, productivity, remote work, etc.) unless they're directly part of the topic.

TEMPLATE & STYLE ROTATION
Use this template verbatim, adapting it to the topic:
{template_prompt}

TONE:
Professional, conversational, and authentic — written like a real person with genuine insight, not like marketing copy.

STRUCTURE REQUIREMENTS (updated for readability):

Hook (1–2 short lines):
Start with a bold statement, question, or surprising fact that instantly grabs attention.
Keep it tight — 1–2 lines max.

Core Content (4–6 short sections):

Use short sentences and frequent line breaks — aim for 1–3 lines per paragraph.

Mix in questions, dashes, or ellipses to create rhythm and natural flow.

Share specific examples, data, or insights (not generic advice).

Use occasional emojis (2–3 max) to guide the reader's eye, not decorate.

Vary paragraph length — make the post look easy to read at first glance.

Call-to-Action (CTA):
End with a conversation prompt, not a sales pitch.
Example: "What's your take?" / "How are you approaching this?" / "Would you try this?"

IMAGE CAPTION + VISUAL DIRECTION:
LinkedIn rewards posts where the caption reinforces the supporting creative. After the CTA, add ONE line that starts with
Image caption: <18 word description>
Describe the scene that should match this visual plan: {image_caption_brief}
Image style target: {image_style['label']} ({image_style['ratio']}, {image_style['orientation']}) — {image_style['description']}
This caption must appear BEFORE the hashtags.

Hashtags (REQUIRED):
Include exactly 5 relevant hashtags at the very end of the post, after the image caption line.
- Mix trending hashtags with niche-specific ones
- Make them relevant to the topic and industry
- Use proper LinkedIn hashtag format (e.g., #Leadership #BusinessGrowth #StartupTips)

Formatting Rules:

Keep total length under 260 words.

Use line breaks between every paragraph.

Avoid dense blocks of text — it should look like it breathes on screen.

If you use lists, use the "→" arrow style or emojis for flow.

Output Format:
Write the complete post with all content, then add 5 hashtags at the end on a new line.
Example:
[Your post content here with paragraphs separated by line breaks]

What's your take?

Image caption: describe the recommended visual in <= 18 words.

#HashtagOne #HashtagTwo #HashtagThree #HashtagFour #HashtagFive"""
    
    # Gemini Overlay Agent prompts - from gemini_overlay_agent.py
    research_prompt = """You are a Research Agent specializing in expert LinkedIn post design analysis.

TASK: Analyze this image and content to create designs matching high-performing LinkedIn post examples.

REFERENCE STYLE: Designs like "10 LinkedIn Post Examples You Can Try for Better Reach"
- Left-side text placement (professional, scannable)
- Bold headlines with strong visual impact
- Clean typography hierarchy
- Engaging, modern layouts

IMAGE CONTEXT:
- Dimensions: {img_width}x{img_height} pixels (WIDTH x HEIGHT)
- Aspect Ratio: {round(img_width/img_height, 2) if img_height > 0 else 1.0}:1
- Total Area: {img_width * img_height:,} pixels
- Post Content: "{post_content}"
- Call to Action: "{call_to_action}"
- Brand Info: "{brand_info}"

CRITICAL: You MUST understand image boundaries:
- X-axis: 0 to {img_width} pixels (0% to 100%)
- Y-axis: 0 to {img_height} pixels (0% to 100%)
- Left edge: x = 0 (0%)
- Right edge: x = {img_width} (100%)
- Top edge: y = 0 (0%)
- Bottom edge: y = {img_height} (100%)
- Safe margins: 5% from all edges ({int(img_width * 0.05)}px horizontal, {int(img_height * 0.05)}px vertical)

RESEARCH ANALYSIS REQUIRED:

1. VISUAL COMPOSITION ANALYSIS (CRITICAL):
   - Identify ALL faces, people, or main subjects in the image
   - Note their positions (x, y coordinates or percentage)
   - Identify logos, branding, or important visual elements
   - Analyze LEFT SIDE of image (10-30% from left edge) - is it clear for text?
   - Detect visual complexity: Is left side busy or clear?
   - Identify color schemes and contrast zones (especially left side)
   - Note any existing text, logos, or graphics to avoid
   - Determine if left side has sufficient contrast for white text

2. CONTENT ANALYSIS:
   - Extract compelling headline from post content (5-8 powerful words)
   - Identify supporting message or CTA (8-12 words)
   - Determine emotional tone (professional, inspirational, educational)
   - Analyze content type and engagement potential

3. LEFT-SIDE SAFE ZONE IDENTIFICATION (CRITICAL):
   - Image width: {img_width}px, height: {img_height}px
   - PRIMARY: Left side zones (10-20% from left = {int(img_width * 0.10)}-{int(img_width * 0.20)}px)
   - Headline zone: 18-25% from top ({int(img_height * 0.18)}-{int(img_height * 0.25)}px)
   - Subtext zone: 42-50% from top ({int(img_height * 0.42)}-{int(img_height * 0.50)}px)
   - Text width: 60-70% of image width ({int(img_width * 0.60)}-{int(img_width * 0.70)}px)
   - CRITICAL: Ensure left side zones DO NOT overlap with faces, people, or main subjects
   - Identify left-side areas with high contrast for readability
   - Determine left-side zones with low visual complexity
   - Ensure right side remains open for visual elements ({int(img_width * 0.70)}-{img_width}px)
   - Maintain 5% margin from all edges ({int(img_width * 0.05)}px horizontal, {int(img_height * 0.05)}px vertical)
   - If left side is too busy or has faces, recommend alternative zones

4. DESIGN RECOMMENDATIONS (LinkedIn Best Practices):
   - Layout: LEFT-SIDE TEXT (like high-performing examples)
   - Typography: Bold headlines (64-80px), medium subtext (32-40px)
   - Colors: White (#FFFFFF) for headlines, light gray (#F0F0F0) for subtext
   - Effects: Strong shadows (25-30px blur) for depth and readability
   - Text alignment: LEFT (not center) for professional LinkedIn style

Return comprehensive JSON research report with visual_analysis, content_analysis, safe_zones, design_recommendations, and insights.

Be thorough and professional - this research will inform expert design decisions."""

    orchestra_prompt = """You are an Orchestra Agent creating expert-grade LinkedIn post designs.

TASK: Design a professional, engaging LinkedIn post overlay similar to high-performing examples.

REFERENCE DESIGN STYLE (Corporate LinkedIn Templates - Freepik Style):
- Clean, minimalist corporate design with professional identity
- Text can be positioned strategically: left edge, center-top, or center-bottom
- Bold, impactful headlines (64-80px) with premium typography
- Supporting subtext (32-40px) with clear hierarchy
- Professional color schemes: white/black text with subtle shadows
- Corporate color palettes: blues, grays, professional tones
- Minimalist backgrounds with ample negative space
- Modern, sophisticated layouts that convey professionalism
- Text often uses geometric shapes or subtle backgrounds for contrast

RESEARCH DATA:
{research_json}

IMAGE DIMENSIONS: {img_width}x{img_height} pixels
- Width: {img_width}px (0-100% = 0-{img_width}px)
- Height: {img_height}px (0-100% = 0-{img_height}px)
- Left edge: x=0px (0%), Right edge: x={img_width}px (100%)
- Top edge: y=0px (0%), Bottom edge: y={img_height}px (100%)
- Safe left zone: {int(img_width * 0.10)}-{int(img_width * 0.20)}px (10-20%)
- Maximum text width: {int(img_width * 0.70)}px (70% of image width)
- Headline vertical zone: {int(img_height * 0.15)}-{int(img_height * 0.30)}px (15-30%)
- Subtext vertical zone: {int(img_height * 0.40)}-{int(img_height * 0.55)}px (40-55%)

DESIGN REQUIREMENTS:

1. LAYOUT STRATEGY (Corporate Template Style):
   - Multiple placement options: left edge, center-top, or center-bottom
   - Keep center area (40-60%) free for visual elements
   - Use vertical stacking for headline + subtext
   - Create visual balance with ample negative space
   - Minimalist approach: less is more
   - Professional spacing and alignment

2. TYPOGRAPHY HIERARCHY:
   - Headline: 64-80px, bold (700-900 weight), white color
   - Subtext/CTA: 32-40px, medium weight (400-600), slightly lighter white (#F0F0F0)
   - Use Montserrat (corporate standard), Roboto (clean professional), or Inter (corporate standard) font family
   - Ensure text is scannable, impactful, and conveys professionalism

3. POSITIONING (DYNAMIC FROM RESEARCH - NO HARDCODING):
   - Headline: USE Research Agent's recommended zone (best_zone_for_headline)
   - Subtext: USE Research Agent's recommended zone (best_zone_for_subtext)
   - DO NOT hardcode positions - use x_percent and y_percent from research
   - Text width: Calculate based on text length and recommended width_percent from research
   - Adapt margins based on image content and safe zones from research
   - Consider image composition - where does text complement best?

4. VISUAL EFFECTS (DYNAMIC FROM RESEARCH):
   - Text color: USE recommended_text_color from zone analysis (DYNAMIC)
   - Shadows: Determine based on background contrast and image style from research
   - Colors: USE recommended colors from design_recommendations (not hardcoded)
   - Background effects: Optional, based on image needs from research
   - Opacity: Adjust based on contrast needs
   - Style: Match image mood and style from research (corporate/creative/minimalist)

Return orchestrated design strategy with strategy, element_plan, and coordination_notes."""

    review_prompt = """You are a Review Agent ensuring expert-grade LinkedIn post design quality.

TASK: Review design against high-performing LinkedIn post examples (like "10 LinkedIn Post Examples" style).

DESIGN STRATEGY:
{strategy_json}

IMAGE DIMENSIONS: {img_width}x{img_height} pixels
- Width: {img_width}px, Height: {img_height}px
- Left edge: x=0px (0%), Right edge: x={img_width}px (100%)
- Top edge: y=0px (0%), Bottom edge: y={img_height}px (100%)
- Safe left zone: {int(img_width * 0.10)}-{int(img_width * 0.20)}px (10-20%)
- Maximum text width: {int(img_width * 0.70)}px (70% of image width)

POST CONTENT: "{post_content}"

EXPERT DESIGN STANDARDS (based on high-performing LinkedIn posts):

1. LAYOUT EXCELLENCE:
   - Text should be positioned on LEFT SIDE (not center)
   - Leave right side open for visual elements
   - Vertical text stacking creates clear hierarchy
   - Professional spacing between elements (8-12% gap)

2. TYPOGRAPHY EXCELLENCE:
   - Headlines: 64-80px, bold (700-900), white, strong shadows
   - Subtext: 32-40px, medium weight (500-600), slightly lighter
   - Font: Montserrat or Playfair Display (premium, elegant)
   - Text alignment: LEFT (not center) for better readability
   - Line height: 1.2-1.3 for optimal readability

3. VISUAL IMPACT:
   - Strong shadows (blur 25-30px, offset 4-6px) for depth
   - High contrast (white text on dark/medium backgrounds)
   - Professional color palette (white, light gray, brand colors)
   - Text width: 60-75% of image (leaves visual space)

4. LINKEDIN OPTIMIZATION:
   - Mobile-first: Text readable on small screens
   - Scannable: Quick to read and understand
   - Engaging: Draws attention without overwhelming
   - Professional: Matches LinkedIn's business aesthetic

5. POSITIONING VALIDATION:
   - Headline: Left side, 15-20% from top, 10-15% from left
   - Subtext: Left side, 40-50% from top, 10-15% from left
   - All text within safe bounds (10% margin from edges)
   - No overlap with important visual elements

Return review report with validated design including review_status, quality_score, readability_score, visual_balance_score, professional_score, linkedin_optimization_score, issues_found, recommendations, and validated_design."""

    refinement_prompt = """You are a Refinement Agent creating expert-grade LinkedIn post designs.

CRITICAL: You MUST use the actual extracted text provided below. Do NOT use placeholder text or instructions like "Extract...". Use the real headline and subtext text exactly as provided.

EXTRACTED TEXT (USE THESE EXACTLY):
- Headline: "{headline_text}"
- Subtext: "{subtext_text}"

TASK: Create polished, professional design matching high-performing LinkedIn post examples.

REFERENCE STYLE: Designs like "10 LinkedIn Post Examples You Can Try for Better Reach"
- Clean, modern typography
- Left-side text placement
- Bold headlines with strong shadows
- Professional color schemes
- Engaging, scannable layouts

REVIEWED DESIGN:
{design_json}

POST CONTENT: "{post_content}"
IMAGE DIMENSIONS: {img_width}x{img_height} pixels
- Width: {img_width}px (0-100% = 0-{img_width}px)
- Height: {img_height}px (0-100% = 0-{img_height}px)
- Left boundary: x=0px (0%)
- Right boundary: x={img_width}px (100%)
- Top boundary: y=0px (0%)
- Bottom boundary: y={img_height}px (100%)
- Safe margins: 5% = {int(img_width * 0.05)}px horizontal, {int(img_height * 0.05)}px vertical

REFINEMENT REQUIREMENTS:

1. TEXT EXTRACTION & OPTIMIZATION:
   - USE THE EXACT TEXT PROVIDED ABOVE: "{headline_text}" for headline and "{subtext_text}" for subtext
   - DO NOT use placeholder text like "Extract..." or "Generate..."
   - The text has already been extracted - use it exactly as provided
   - Ensure text is scannable and impactful
   - Match tone to LinkedIn professional standards

2. POSITIONING (DYNAMIC FROM RESEARCH - NO HARDCODING):
   - Headline: USE Research Agent's recommended position: x={headline_pos_x}%, y={headline_pos_y}%
   - Subtext: USE Research Agent's recommended position: x={subtext_pos_x}%, y={subtext_pos_y}%
   - DO NOT hardcode positions - use research recommendations
   - Text alignment: Determine based on image composition and research recommendations
   - Width: Use recommended width_percent from research: headline={headline_width_pct}%, subtext={subtext_width_pct}%

3. TYPOGRAPHY EXCELLENCE (DYNAMIC FROM RESEARCH):
   - Headline: {headline_font_size}px (adaptive to image size), weight 700-800
   - Subtext: {subtext_font_size}px (adaptive to image size), weight 500-600
   - Font: USE Research Agent's recommendation: "{headline_font_rec}" for headline, "{subtext_font_rec}" for subtext
   - DO NOT hardcode font names - use research recommendations based on image style
   - Line height: 1.2-1.25 for headlines, 1.3-1.35 for subtext
   - Letter spacing: 0-1px for optimal readability

4. VISUAL EFFECTS POLISH (ADAPTIVE TO BACKGROUND):
   - Headline color: {headline_contrast['text_color']} (analyzed from background)
   - Subtext color: {subtext_contrast['text_color']} (analyzed from background)
   - Shadows: Blur {headline_contrast['shadow_blur']}px for headline, {subtext_contrast['shadow_blur']}px for subtext
   - Shadow color: {headline_contrast['shadow_color']} for headline, {subtext_contrast['shadow_color']} for subtext
   - Stroke: {headline_contrast['stroke_width']}px for headline if needed for contrast
   - Opacity: 100% for headlines, 95-98% for subtext
   - Ensure high contrast for readability (colors have been analyzed from actual image background)

5. PROFESSIONAL FINISHING:
   - All positions validated within bounds
   - Proper spacing between elements (10-15% gap)
   - Professional color harmony
   - Mobile-optimized sizing

Return refined, expert-grade elements matching high-performing LinkedIn post style with elements array and refinement_notes.

CRITICAL REQUIREMENTS:
1. Use the EXACT text provided: "{headline_text}" for headline and "{subtext_text}" for subtext
2. Do NOT use placeholder text or instructions
3. Use the exact font sizes: {headline_font_size}px for headline, {subtext_font_size}px for subtext
4. Use the exact colors provided: {headline_contrast['text_color']} for headline, {subtext_contrast['text_color']} for subtext
5. Ensure professional, polished output matching the reference example"""

    # Image prompt optimizer - from ai_image_prompt_optimizer.py
    image_prompt_optimizer = """You are an expert visual metaphor creator for LinkedIn content.

Your job:
1. Analyze the LinkedIn post content
2. Extract the core emotional message and key insight
3. Create a UNIQUE, CINEMATIC visual metaphor (NOT generic office/desk scenes)
4. Generate an optimized DALL-E prompt for hyper-realistic photography

RULES FOR VISUAL IMAGERY:
- STAY RELEVANT TO THE TOPIC FIRST - If the post is about soldiers, show soldiers; if about doctors, show medical imagery; if about teachers, show educational settings
- Only use abstract metaphors for GENERIC business concepts (growth, success, innovation)
- For SPECIFIC professions/topics: Use DIRECT, REALISTIC, RELEVANT imagery (actual people, real situations, authentic contexts)
- Avoid: Generic office scenes, stock photo clichés, people at desks with laptops, forced handshakes
- Think: Real-world scenarios, authentic moments, documentary-style captures, actual professionals in action
- Each image should be UNIQUE and TOPIC-APPROPRIATE - never generic
- Realism and relevance > Abstract symbolism

PHOTOGRAPHY REQUIREMENTS:
- Hyper-realistic, photojournalistic style
- Shot on professional DSLR (35mm, f/1.8)
- Cinematic lighting and composition
- Shallow depth of field
- Ample negative space for text overlay
- Rule of thirds or golden ratio
- ABSOLUTELY NO TEXT/WORDS/LETTERS in the image

OUTPUT FORMAT (JSON):
{
  "visual_concept": "One sentence describing the visual metaphor",
  "metaphor_description": "Why this visual represents the post's message",
  "subject": "Main subject of the photo",
  "environment": "Setting/background",
  "focal_point": "Key element that draws the eye",
  "lighting": "Lighting style and mood",
  "color_palette": "Primary colors and tones",
  "composition": "Framing and perspective",
  "emotional_tone": "The feeling this image evokes",
  "reasoning": "Why this specific visual works for this post"
}"""
    
    return {
        "content_generation": {
            "main_prompt": content_prompt,
            "llm_adapter_prompt": llm_prompt,
            "carousel_prompt": """You are an expert LinkedIn content strategist specializing in carousel post creation.

Create engaging carousel content with multiple slides that tell a cohesive story or provide step-by-step value.

**STRUCTURE**:
- Slide 1: Compelling hook/title slide
- Slides 2-5: Core content with actionable insights
- Final slide: Strong CTA with hashtags

**REQUIREMENTS**:
- Each slide should be concise (1-2 sentences max)
- Maintain visual flow and narrative coherence
- Include specific examples and actionable tips
- End with engaging CTA and relevant hashtags

Generate the carousel content now:"""
        },
        "text_overlay": {
            "research_agent": research_prompt,
            "orchestra_agent": orchestra_prompt,
            "review_agent": review_prompt,
            "refinement_agent": refinement_prompt
        },
        "image_generation": {
            "image_prompt_optimizer": image_prompt_optimizer
        },
        "campaign_generation": {
            "campaign_idea_generator": """You are an expert campaign strategist.

Analyze the provided brand materials and generate creative campaign ideas that align with the brand's voice and goals.

**OUTPUT**: Structured campaign proposals with:
- Campaign names
- Content pillars
- Target audience insights
- Tone recommendations
- Content ideas

Generate campaign ideas now:"""
        },
        "brand_assistant": {
            "brand_analysis": """You are a brand strategist analyzing brand materials.

Extract key insights from brand materials including:
- Brand voice and tone
- Visual style preferences
- Content themes
- Target audience characteristics
- Campaign opportunities

**OUTPUT**: Comprehensive brand analysis report."""
        }
    }


@router.get("/ai-prompts")
async def get_ai_prompts(admin_user: dict = Depends(get_current_admin_user)):
    """Get all AI prompts (admin only)"""
    db = get_db()
    
    # Try to get saved prompts from database
    saved_prompts = await db.ai_prompts.find_one({"_id": "prompts"})
    
    if saved_prompts:
        # Merge with defaults to ensure all prompts exist
        default_prompts = get_default_prompts()
        prompts = saved_prompts.get("prompts", {})
        
        # Ensure all default categories and prompts exist
        for category_id, category_prompts in default_prompts.items():
            if category_id not in prompts:
                prompts[category_id] = {}
            for prompt_key in category_prompts.keys():
                if prompt_key not in prompts[category_id]:
                    prompts[category_id][prompt_key] = category_prompts[prompt_key]
        
        return {"prompts": prompts}
    else:
        # Return defaults if nothing saved
        return {"prompts": get_default_prompts()}


@router.post("/ai-prompts")
async def save_ai_prompts(
    request: AIPromptsRequest,
    admin_user: dict = Depends(get_current_admin_user),
    http_request: Request = None
):
    """Save AI prompts (admin only)"""
    db = get_db()
    
    # Merge with defaults to ensure structure
    default_prompts = get_default_prompts()
    prompts_to_save = request.prompts.copy()
    
    # Ensure all default categories exist
    for category_id, category_prompts in default_prompts.items():
        if category_id not in prompts_to_save:
            prompts_to_save[category_id] = {}
        # Ensure all default prompts exist
        for prompt_key in category_prompts.keys():
            if prompt_key not in prompts_to_save[category_id]:
                prompts_to_save[category_id][prompt_key] = category_prompts[prompt_key]
    
    # Save to database
    await db.ai_prompts.update_one(
        {"_id": "prompts"},
        {"$set": {"prompts": prompts_to_save, "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": admin_user.get("id")}},
        upsert=True
    )
    
    # Log admin activity
    if http_request:
        client_ip = http_request.client.host if http_request.client else None
        await log_admin_activity(
            admin_id=admin_user.get("id"),
            action="ai_prompts_updated",
            ip_address=client_ip
        )
    
    return {"message": "AI prompts saved successfully", "prompts": prompts_to_save}

