"""
Billing and Stripe integration routes
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Header
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import stripe
import os
import uuid
from cryptography.fernet import Fernet

router = APIRouter(prefix="/billing", tags=["billing"])

# Encryption - load key from environment when needed (not at module level)
def get_cipher_suite():
    """Get cipher suite with ENCRYPTION_KEY from environment"""
    ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', '')
    if not ENCRYPTION_KEY:
        raise HTTPException(status_code=500, detail="ENCRYPTION_KEY not configured")
    return Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)

def decrypt_value(encrypted_value: str) -> str:
    """Decrypt an encrypted value"""
    if not encrypted_value:
        return ''
    try:
        cipher_suite = get_cipher_suite()
        return cipher_suite.decrypt(encrypted_value.encode()).decode()
    except:
        return encrypted_value  # Return as-is if decryption fails

def get_db():
    from server import client
    return client[os.environ['DB_NAME']]

async def get_stripe_keys():
    """Get Stripe keys from database"""
    db = get_db()
    system_settings = await db.system_settings.find_one({"_id": "api_keys"})
    
    if not system_settings:
        print("[ERROR] [BILLING] No system_settings found in database!")
        return None, None, None, None
    
    secret_key = decrypt_value(system_settings.get('stripe_secret_key', ''))
    publishable_key = decrypt_value(system_settings.get('stripe_publishable_key', ''))
    webhook_secret = decrypt_value(system_settings.get('stripe_webhook_secret', ''))
    price_id = decrypt_value(system_settings.get('stripe_pro_price_id', ''))
    
    print(f"[KEY] [BILLING] Stripe keys loaded:")
    print(f"   Secret: {'[OK]' if secret_key else '[MISSING]'} ({secret_key[:15] if secret_key else 'MISSING'}...)")
    print(f"   Publishable: {'[OK]' if publishable_key else '[MISSING]'} ({publishable_key[:15] if publishable_key else 'MISSING'}...)")
    print(f"   Webhook: {'[OK]' if webhook_secret else '[MISSING]'}")
    print(f"   Price ID: {'[OK]' if price_id else '[MISSING]'}")
    
    return secret_key, publishable_key, webhook_secret, price_id


async def get_current_user(request: Request):
    """Get current user from auth token"""
    from server import get_current_user as get_user_from_server
    from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
    
    security = HTTPBearer()
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    credentials = HTTPAuthorizationCredentials(
        scheme="Bearer",
        credentials=auth_header.split(" ")[1]
    )
    
    return await get_user_from_server(credentials)


# ============================================================================
# PUBLIC ENDPOINTS
# ============================================================================

@router.get("/stripe-config")
async def get_stripe_config():
    """Get public Stripe configuration (publishable key)"""
    try:
        _, publishable_key, _, _ = await get_stripe_keys()
        
        if not publishable_key:
            raise HTTPException(
                status_code=503,
                detail="Stripe is not configured. Please contact support."
            )
        
        return {
            "publishableKey": publishable_key
        }
    except Exception as e:
        print(f"[ERROR] stripe-config endpoint: {e}")
        raise HTTPException(
            status_code=503,
            detail="Stripe configuration error. Please contact support."
        )


# ============================================================================
# SUBSCRIPTION MANAGEMENT
# ============================================================================

class CreateCheckoutSessionRequest(BaseModel):
    price_id: Optional[str] = None  # Optional - will use database value if not provided
    embedded: bool = False  # If true, returns client_secret for embedded checkout


@router.post("/create-subscription")
async def create_subscription(request: Request):
    """Create Stripe subscription for Payment Element"""
    user = await get_current_user(request)
    db = get_db()
    
    # Get Stripe keys from database
    secret_key, publishable_key, webhook_secret, price_id = await get_stripe_keys()
    
    if not secret_key:
        raise HTTPException(
            status_code=503,
            detail="Stripe is not configured. Please contact support."
        )
    
    # Set Stripe API key
    stripe.api_key = secret_key
    
    try:
        print(f"[INFO] [BILLING] Creating subscription for user: {user['email']}")
        
        # Create or get Stripe customer
        if user.get('stripe_customer_id'):
            customer_id = user['stripe_customer_id']
            print(f"[OK] [BILLING] Using existing customer: {customer_id}")
        else:
            customer = stripe.Customer.create(
                email=user['email'],
                name=user.get('full_name', user['email']),
                metadata={'user_id': user['id']}
            )
            customer_id = customer.id
            print(f"[OK] [BILLING] Created new customer: {customer_id}")
            
            # Save customer ID
            await db.users.update_one(
                {"id": user['id']},
                {"$set": {"stripe_customer_id": customer_id}}
            )
        
        # Create subscription with incomplete status
        # The Payment Element will collect payment and confirm
        subscription = stripe.Subscription.create(
            customer=customer_id,
            items=[{'price': price_id}],
            payment_behavior='default_incomplete',
            payment_settings={
                'save_default_payment_method': 'on_subscription',
            },
            expand=['latest_invoice.payment_intent'],
            metadata={'user_id': user['id']}
        )
        
        print(f"[OK] [BILLING] Subscription created: {subscription.id}")
        print(f"   Status: {subscription.status}")
        
        # Debug: Print subscription object details
        print(f"   Subscription object type: {type(subscription)}")
        print(f"   Has latest_invoice: {hasattr(subscription, 'latest_invoice')}")
        
        # For subscriptions with payment_behavior='default_incomplete',
        # the PaymentIntent is not immediately attached to the invoice.
        # We need to find it by querying recent PaymentIntents for this customer.
        
        print(f"[INFO] [BILLING] Retrieving PaymentIntent for subscription...")
        
        # List recent payment intents for this customer
        payment_intents = stripe.PaymentIntent.list(
            customer=customer_id,
            limit=5
        )
        
        print(f"[INFO] [BILLING] Found {len(payment_intents.data)} recent PaymentIntents")
        
        # Find the PaymentIntent associated with this subscription
        payment_intent = None
        for pi in payment_intents.data:
            # Check if this PI is for our subscription by checking metadata or invoice
            if hasattr(pi, 'invoice') and pi.invoice:
                pi_invoice_id = pi.invoice if isinstance(pi.invoice, str) else pi.invoice.id
                sub_invoice_id = subscription.latest_invoice if isinstance(subscription.latest_invoice, str) else subscription.latest_invoice.id
                
                print(f"   Checking PI {pi.id}: invoice={pi_invoice_id}, looking for={sub_invoice_id}")
                
                if pi_invoice_id == sub_invoice_id:
                    payment_intent = pi
                    print(f"[OK] [BILLING] Found matching PaymentIntent: {pi.id}")
                    break
        
        if not payment_intent:
            # Fallback: Just use the most recent PaymentIntent for this customer
            if payment_intents.data:
                payment_intent = payment_intents.data[0]
                print(f"[WARNING] [BILLING] Using most recent PaymentIntent: {payment_intent.id}")
            else:
                raise HTTPException(
                    status_code=500,
                    detail="No payment intent found for subscription"
                )
        
        # Get the client secret
        client_secret = payment_intent.client_secret
        if not client_secret:
            raise HTTPException(
                status_code=500,
                detail="Payment intent has no client secret"
            )
        
        print(f"[OK] [BILLING] Client secret obtained successfully")
        
        return {
            "subscriptionId": subscription.id,
            "clientSecret": client_secret
        }
        
    except Exception as e:
        print(f"[ERROR] [BILLING] Subscription creation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/create-checkout-session")
async def create_checkout_session(
    request: Request,
    checkout_data: CreateCheckoutSessionRequest
):
    """Create Stripe checkout session for subscription"""
    user = await get_current_user(request)
    db = get_db()
    
    # Get Stripe keys from database
    secret_key, publishable_key, webhook_secret, price_id = await get_stripe_keys()
    
    if not secret_key:
        raise HTTPException(
            status_code=503,
            detail="Stripe is not configured. Please contact support."
        )
    
    # Set Stripe API key
    stripe.api_key = secret_key
    
    try:
        # Create or get Stripe customer
        if user.get('stripe_customer_id'):
            customer_id = user['stripe_customer_id']
        else:
            customer = stripe.Customer.create(
                email=user['email'],
                name=user['full_name'],
                metadata={'user_id': user['id']}
            )
            customer_id = customer.id
            
            # Save customer ID
            await db.users.update_one(
                {"id": user['id']},
                {"$set": {"stripe_customer_id": customer_id}}
            )
        
        # Create checkout session with embedded mode support
        session_params = {
            'customer': customer_id,
            'line_items': [{
                'price': checkout_data.price_id or price_id,
                'quantity': 1,
            }],
            'mode': 'subscription',
            'metadata': {
                'user_id': user['id']
            }
        }
        
        if checkout_data.embedded:
            # Embedded checkout mode
            session_params['ui_mode'] = 'embedded'
            session_params['return_url'] = f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/dashboard/settings?session_id={{CHECKOUT_SESSION_ID}}"
        else:
            # Redirect mode
            session_params['success_url'] = f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/dashboard?subscription=success"
            session_params['cancel_url'] = f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/dashboard?subscription=cancelled"
        
        session = stripe.checkout.Session.create(**session_params)
        
        if checkout_data.embedded:
            return {"clientSecret": session.client_secret}
        else:
            return {"session_id": session.id, "url": session.url}
        
    except Exception as e:
        print(f"[ERROR] [BILLING] Checkout session error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/create-setup-intent")
async def create_setup_intent(request: Request):
    """Create a Setup Intent for embedded checkout"""
    user = await get_current_user(request)
    db = get_db()
    
    # Get Stripe keys from database
    secret_key, publishable_key, webhook_secret, price_id = await get_stripe_keys()
    
    if not secret_key:
        raise HTTPException(
            status_code=503,
            detail="Stripe is not configured. Please contact support."
        )
    
    # Set Stripe API key
    stripe.api_key = secret_key
    
    try:
        # Create or get Stripe customer
        if user.get('stripe_customer_id'):
            customer_id = user['stripe_customer_id']
        else:
            customer = stripe.Customer.create(
                email=user['email'],
                name=user['full_name'],
                metadata={'user_id': user['id']}
            )
            customer_id = customer.id
            
            # Save customer ID
            await db.users.update_one(
                {"id": user['id']},
                {"$set": {"stripe_customer_id": customer_id}}
            )
        
        # Create a Setup Intent for future payments
        setup_intent = stripe.SetupIntent.create(
            customer=customer_id,
            payment_method_types=['card'],
            metadata={
                'user_id': user['id'],
                'price_id': price_id
            }
        )
        
        return {
            "clientSecret": setup_intent.client_secret,
            "customerId": customer_id
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class CompleteSubscriptionRequest(BaseModel):
    payment_method_id: str

@router.post("/complete-subscription")
async def complete_subscription(request: Request, data: CompleteSubscriptionRequest):
    """Complete subscription after payment method is confirmed"""
    user = await get_current_user(request)
    db = get_db()
    
    payment_method_id = data.payment_method_id
    if not payment_method_id:
        raise HTTPException(status_code=400, detail="Payment method ID required")
    
    # Get Stripe keys from database
    secret_key, publishable_key, webhook_secret, price_id = await get_stripe_keys()
    
    if not secret_key:
        raise HTTPException(status_code=503, detail="Stripe is not configured")
    
    stripe.api_key = secret_key
    
    try:
        # Create subscription with the payment method
        subscription = stripe.Subscription.create(
            customer=user['stripe_customer_id'],
            items=[{'price': price_id}],
            default_payment_method=payment_method_id,
            expand=['latest_invoice.payment_intent']
        )
        
        # Update user to Pro tier
        await db.users.update_one(
            {"id": user['id']},
            {"$set": {
                "subscription_tier": "pro",
                "subscription_status": "active",
                "stripe_subscription_id": subscription.id,
                "subscription_start_date": datetime.now(timezone.utc).isoformat(),
                "ai_tokens_limit": 10000,
                "post_limit_per_month": -1
            }}
        )
        
        # Create subscription record
        await db.subscriptions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user['id'],
            "stripe_subscription_id": subscription.id,
            "stripe_customer_id": user['stripe_customer_id'],
            "plan_id": "pro-monthly",
            "status": "active",
            "amount": 30.00,
            "currency": "usd",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "success": True,
            "subscription": {
                "id": subscription.id,
                "status": subscription.status
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/cancel-subscription")
async def cancel_subscription(request: Request, immediate: bool = False):
    """Cancel user's subscription"""
    user = await get_current_user(request)
    db = get_db()
    
    if not user.get('stripe_subscription_id'):
        raise HTTPException(status_code=400, detail="No active subscription found")
    
    # Get Stripe keys from database
    secret_key, _, _, _ = await get_stripe_keys()
    if not secret_key:
        raise HTTPException(status_code=503, detail="Stripe is not configured")
    
    stripe.api_key = secret_key
    
    try:
        if immediate:
            # Immediately cancel (for testing)
            subscription = stripe.Subscription.delete(user['stripe_subscription_id'])
            
            # Reset user to free tier
            await db.users.update_one(
                {"id": user['id']},
                {"$set": {
                    "subscription_tier": "free",
                    "subscription_status": "cancelled",
                    "stripe_subscription_id": None,
                    "cancelled_at": datetime.now(timezone.utc).isoformat(),
                    "ai_tokens_limit": 1000,
                    "post_limit_per_month": 50
                }}
            )
            
            return {"message": "Subscription cancelled immediately", "immediate": True}
        else:
            # Cancel at period end (don't immediately cancel)
            subscription = stripe.Subscription.modify(
                user['stripe_subscription_id'],
                cancel_at_period_end=True
            )
            
            # Update database - keep status as "active" but flag for cancellation
            await db.users.update_one(
                {"id": user['id']},
                {"$set": {
                    "cancel_at_period_end": True,
                    "cancelled_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Log cancellation to subscriptions collection for tracking
            await db.subscriptions.update_one(
                {"stripe_subscription_id": user['stripe_subscription_id']},
                {"$set": {
                    "cancel_at_period_end": True,
                    "cancelled_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }},
                upsert=False
            )
            
            return {"message": "Subscription will be cancelled at the end of the billing period"}
        
    except Exception as e:
        print(f"[ERROR] [BILLING] Cancel error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/reactivate-subscription")
async def reactivate_subscription(request: Request):
    """Reactivate a cancelled subscription"""
    user = await get_current_user(request)
    db = get_db()
    
    if not user.get('stripe_subscription_id'):
        raise HTTPException(status_code=400, detail="No subscription found")
    
    # Get Stripe keys from database
    secret_key, _, _, _ = await get_stripe_keys()
    if not secret_key:
        raise HTTPException(status_code=503, detail="Stripe is not configured")
    
    stripe.api_key = secret_key
    
    try:
        # Remove cancellation
        subscription = stripe.Subscription.modify(
            user['stripe_subscription_id'],
            cancel_at_period_end=False
        )
        
        # Update database
        await db.users.update_one(
            {"id": user['id']},
            {"$set": {
                "subscription_status": "active",
                "cancel_at_period_end": False,
                "cancelled_at": None
            }}
        )
        
        # Update subscriptions collection
        await db.subscriptions.update_one(
            {"stripe_subscription_id": user['stripe_subscription_id']},
            {"$set": {
                "cancel_at_period_end": False,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=False
        )
        
        return {"message": "Subscription reactivated successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/subscription-status")
async def get_subscription_status(request: Request):
    """Get current user's subscription status"""
    user = await get_current_user(request)
    db = get_db()
    
    # Get user with subscription info
    user_data = await db.users.find_one(
        {"id": user['id']},
        {
            "_id": 0,
            "subscription_tier": 1,
            "subscription_status": 1,
            "subscription_start_date": 1,
            "subscription_end_date": 1,
            "stripe_subscription_id": 1,
            "ai_tokens_used": 1,
            "ai_tokens_limit": 1,
            "posts_this_month": 1,
            "post_limit_per_month": 1,
            "last_reset_date": 1
        }
    )
    
    # Get Stripe subscription details if exists
    stripe_details = None
    if user_data.get('stripe_subscription_id'):
        secret_key, _, _, _ = await get_stripe_keys()
        if secret_key:
            stripe.api_key = secret_key
            try:
                subscription = stripe.Subscription.retrieve(user_data['stripe_subscription_id'])
                
                # Safe access to all fields (some may not exist on cancelled subscriptions)
                stripe_details = {
                    "status": getattr(subscription, 'status', 'unknown'),
                    "current_period_end": getattr(subscription, 'current_period_end', None),
                    "cancel_at_period_end": getattr(subscription, 'cancel_at_period_end', False),
                    "amount": getattr(getattr(subscription, 'plan', None), 'amount', 0) / 100 if hasattr(subscription, 'plan') else 30.00,
                    "currency": getattr(getattr(subscription, 'plan', None), 'currency', 'usd') if hasattr(subscription, 'plan') else 'usd'
                }
                
                print(f"[OK] [BILLING] Stripe subscription retrieved: {subscription.id}")
                print(f"   Status: {stripe_details['status']}")
                print(f"   Cancel at period end: {stripe_details['cancel_at_period_end']}")
                print(f"   Current period end: {stripe_details['current_period_end']}")
            except Exception as e:
                print(f"[ERROR] [BILLING] Failed to retrieve Stripe subscription: {e}")
                # If subscription doesn't exist in Stripe, clear it from DB
                if "No such subscription" in str(e):
                    print(f"[WARNING] [BILLING] Subscription not found in Stripe, clearing from DB")
                    await db.users.update_one(
                        {"id": user_data['id']},
                        {"$set": {
                            "stripe_subscription_id": None,
                            "subscription_tier": "free",
                            "subscription_status": "inactive"
                        }}
                    )
    
    return {
        "user_subscription": user_data,
        "stripe_details": stripe_details
    }


@router.get("/payment-history")
async def get_payment_history(request: Request):
    """Get user's payment history"""
    user = await get_current_user(request)
    
    if not user.get('stripe_customer_id'):
        return {"payments": []}
    
    # Get Stripe keys from database
    secret_key, _, _, _ = await get_stripe_keys()
    if not secret_key:
        return {"payments": []}
    
    stripe.api_key = secret_key
    
    try:
        # Get invoices for this customer
        invoices = stripe.Invoice.list(
            customer=user['stripe_customer_id'],
            limit=50
        )
        
        payments = []
        for invoice in invoices.data:
            payments.append({
                "id": invoice.id,
                "amount": invoice.amount_paid / 100,
                "currency": invoice.currency,
                "status": invoice.status,
                "date": invoice.created,
                "invoice_pdf": invoice.invoice_pdf
            })
        
        return {"payments": payments}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# STRIPE WEBHOOKS
# ============================================================================

@router.post("/webhooks/stripe")
@router.post("/webhook")  # Alias for Stripe CLI
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    
    # Get webhook secret from database
    _, _, webhook_secret, _ = await get_stripe_keys()
    
    if not webhook_secret:
        raise HTTPException(status_code=503, detail="Webhook secret not configured")
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    db = get_db()
    
    print(f"[INFO] [WEBHOOK] Received event: {event['type']}")
    
    # Handle different event types
    if event['type'] == 'checkout.session.completed':
        await handle_checkout_completed(event['data']['object'], db)
    
    elif event['type'] == 'customer.subscription.updated':
        await handle_subscription_updated(event['data']['object'], db)
    
    elif event['type'] == 'customer.subscription.deleted':
        await handle_subscription_deleted(event['data']['object'], db)
    
    elif event['type'] == 'invoice.payment_failed':
        await handle_payment_failed(event['data']['object'], db)
    
    elif event['type'] == 'invoice.payment_succeeded':
        await handle_payment_succeeded(event['data']['object'], db)
    
    return {"status": "success"}


async def handle_checkout_completed(session, db):
    """Handle successful checkout"""
    user_id = session['metadata'].get('user_id')
    if not user_id:
        return
    
    # Update user to Pro tier
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "subscription_tier": "pro",
            "subscription_status": "active",
            "stripe_customer_id": session['customer'],
            "stripe_subscription_id": session['subscription'],
            "subscription_start_date": datetime.now(timezone.utc).isoformat(),
            "ai_tokens_limit": 10000,  # Pro tier limit
            "post_limit_per_month": -1  # Unlimited
        }}
    )
    
    # Create subscription record
    await db.subscriptions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "stripe_subscription_id": session['subscription'],
        "stripe_customer_id": session['customer'],
        "plan_id": "pro-monthly",
        "status": "active",
        "amount": 30.00,
        "currency": "usd",
        "created_at": datetime.now(timezone.utc).isoformat()
    })


async def handle_subscription_updated(subscription, db):
    """Handle subscription update"""
    # Find user by subscription ID
    user = await db.users.find_one({"stripe_subscription_id": subscription['id']})
    if not user:
        print(f"[WARNING] [WEBHOOK] No user found for subscription: {subscription['id']}")
        return
    
    print(f"[INFO] [WEBHOOK] Subscription updated for user: {user['email']}")
    print(f"   Status: {subscription.get('status')}")
    print(f"   Cancel at period end: {subscription.get('cancel_at_period_end')}")
    
    # Update subscription status
    status_map = {
        'active': 'active',
        'canceled': 'cancelled',
        'past_due': 'past_due',
        'trialing': 'trialing'
    }
    
    update_fields = {
        "subscription_status": status_map.get(subscription['status'], 'active')
    }
    
    # Only update end date if it exists
    if subscription.get('current_period_end'):
        update_fields["subscription_end_date"] = datetime.fromtimestamp(
            subscription['current_period_end'], tz=timezone.utc
        ).isoformat()
    
    await db.users.update_one(
        {"id": user['id']},
        {"$set": update_fields}
    )
    
    print(f"[OK] [WEBHOOK] User {user['email']} subscription updated")


async def handle_subscription_deleted(subscription, db):
    """Handle subscription cancellation"""
    user = await db.users.find_one({"stripe_subscription_id": subscription['id']})
    if not user:
        return
    
    # Downgrade to free tier
    await db.users.update_one(
        {"id": user['id']},
        {"$set": {
            "subscription_tier": "free",
            "subscription_status": "cancelled",
            "ai_tokens_limit": 1000,
            "post_limit_per_month": 50,
            "cancelled_at": datetime.now(timezone.utc).isoformat()
        }}
    )


async def handle_payment_failed(invoice, db):
    """Handle failed payment"""
    customer_id = invoice['customer']
    user = await db.users.find_one({"stripe_customer_id": customer_id})
    if not user:
        return
    
    # Mark as past due
    await db.users.update_one(
        {"id": user['id']},
        {"$set": {"subscription_status": "past_due"}}
    )
    
    # TODO: Send email notification to user


async def handle_payment_succeeded(invoice, db):
    """Handle successful payment"""
    customer_id = invoice['customer']
    user = await db.users.find_one({"stripe_customer_id": customer_id})
    if not user:
        print(f"[WARNING] [WEBHOOK] No user found for customer: {customer_id}")
        return
    
    print(f"[OK] [WEBHOOK] Payment succeeded for user: {user['email']}")
    
    # Get subscription ID from invoice
    subscription_id = invoice.get('subscription')
    
    # Update user to Pro tier
    update_fields = {
        "subscription_tier": "pro",
        "subscription_status": "active",
        "stripe_subscription_id": subscription_id,
        "ai_tokens_limit": 10000,
        "post_limit_per_month": -1
    }
    
    # Only set start date if not already set
    if not user.get('subscription_start_date'):
        update_fields["subscription_start_date"] = datetime.now(timezone.utc).isoformat()
    
    print(f"[OK] [WEBHOOK] Updating user to Pro tier (Sub ID: {subscription_id})")
    await db.users.update_one(
        {"id": user['id']},
        {"$set": update_fields}
    )
    
    # Record payment in usage tracking
    await db.usage_tracking.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user['id'],
        "resource_type": "payment",
        "amount": invoice['amount_paid'] / 100,
        "currency": invoice['currency'],
        "invoice_id": invoice['id'],
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    print(f"[OK] [WEBHOOK] User {user['email']} upgraded successfully")

