"""
Subscription and billing models for LinkedPilot
"""
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime
from decimal import Decimal


class Subscription(BaseModel):
    """Subscription model for billing"""
    id: str
    user_id: str
    stripe_subscription_id: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    plan_id: Literal['free', 'pro-monthly'] = 'free'
    status: Literal['active', 'cancelled', 'past_due', 'trialing'] = 'active'
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    cancel_at_period_end: bool = False
    cancelled_at: Optional[datetime] = None
    amount: Optional[float] = None
    currency: str = 'usd'
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class UsageTracking(BaseModel):
    """Track user resource usage"""
    id: str
    user_id: str
    resource_type: Literal['ai_generation', 'post_creation', 'linkedin_post', 'image_generation']
    tokens_used: int = 0
    cost: Optional[float] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    campaign_id: Optional[str] = None
    metadata: Optional[dict] = {}


class AdminActivityLog(BaseModel):
    """Log admin actions for audit trail"""
    id: str
    admin_id: str
    action: str  # e.g., 'user_suspended', 'subscription_modified', 'api_key_reset'
    target_user_id: Optional[str] = None
    details: Optional[dict] = {}
    ip_address: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class UserSubscriptionInfo(BaseModel):
    """Extended user information including subscription details"""
    # Basic user info
    id: str
    email: str
    full_name: str
    created_at: datetime
    
    # Role and permissions
    role: Literal['user', 'admin', 'superadmin'] = 'user'
    status: Literal['active', 'suspended', 'deleted'] = 'active'
    
    # Subscription info
    subscription_tier: Literal['free', 'pro'] = 'free'
    subscription_status: Literal['active', 'cancelled', 'past_due', 'trialing'] = 'active'
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    subscription_start_date: Optional[datetime] = None
    subscription_end_date: Optional[datetime] = None
    
    # Usage limits and tracking
    ai_tokens_used: int = 0
    ai_tokens_limit: int = 1000  # Free tier default
    posts_this_month: int = 0
    post_limit_per_month: int = 50  # Free tier default
    last_reset_date: Optional[datetime] = None
    
    # LinkedIn connection
    linkedin_connected: bool = False
    linkedin_profile: Optional[dict] = None



