# Stripe Integration Cheat Sheet

> **30-Minute Quick Start Guide for SaaS Subscription Integration**

---

## 🚀 Speed Run: 5 Steps to Live Stripe Integration

### Step 1: Stripe Dashboard (5 minutes)

```bash
✅ Create account at dashboard.stripe.com
✅ Create Product: "Pro Plan" → Copy Price ID
✅ Get API Keys: sk_test_xxx (secret) + pk_test_xxx (publishable)
✅ Install Stripe CLI: brew install stripe/stripe-cli/stripe
```

---

### Step 2: Backend Setup (10 minutes)

**Install:**
```bash
pip install stripe  # Python
npm install stripe  # Node.js
```

**Create Subscription Endpoint:**
```python
@router.post("/billing/create-subscription")
async def create_subscription(user_id: str):
    subscription = stripe.Subscription.create(
        customer=user['stripe_customer_id'],
        items=[{"price": "price_xxxxx"}],
        payment_behavior='default_incomplete',
        expand=['latest_invoice.payment_intent']
    )
    
    return {
        "clientSecret": subscription.latest_invoice.payment_intent.client_secret
    }
```

**Webhook Handler:**
```python
@router.post("/billing/webhooks/stripe")
async def webhook(request: Request):
    event = stripe.Webhook.construct_event(
        await request.body(),
        request.headers['stripe-signature'],
        os.getenv('STRIPE_WEBHOOK_SECRET')
    )
    
    if event['type'] == 'invoice.payment_succeeded':
        # Upgrade user to Pro
        db.users.update(subscription_tier='pro')
    
    return {"status": "success"}
```

---

### Step 3: Frontend Setup (10 minutes)

**Install:**
```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

**Payment Form:**
```javascript
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe('pk_test_xxx');

function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [clientSecret, setClientSecret] = useState('');

  useEffect(() => {
    fetch('/api/billing/create-subscription', { method: 'POST' })
      .then(res => res.json())
      .then(data => setClientSecret(data.clientSecret));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.origin + '/success' }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button type="submit">Subscribe</button>
    </form>
  );
}

function App() {
  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm />
    </Elements>
  );
}
```

---

### Step 4: Test Locally (3 minutes)

```bash
# Terminal 1: Forward webhooks
stripe listen --forward-to localhost:8000/api/billing/webhooks/stripe

# Copy the webhook secret (whsec_xxx) to .env

# Terminal 2: Test events
stripe trigger invoice.payment_succeeded
```

**Test Cards:**
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`

---

### Step 5: Deploy (2 minutes)

```bash
✅ Set production API keys in environment variables
✅ Create webhook endpoint in Stripe Dashboard
✅ Point to: https://yourdomain.com/api/billing/webhooks/stripe
✅ Copy production webhook secret to .env
✅ Test with $0.50 charge (refund after)
```

---

## 📋 Essential Code Snippets

### Create Customer on Signup

```python
customer = stripe.Customer.create(
    email=user_email,
    metadata={"user_id": user_id}
)
db.users.update(stripe_customer_id=customer.id)
```

### Cancel Subscription

```python
stripe.Subscription.modify(
    subscription_id,
    cancel_at_period_end=True
)
```

### Get Subscription Status

```python
subscription = stripe.Subscription.retrieve(subscription_id)
return {
    "status": subscription.status,
    "cancel_at_period_end": subscription.cancel_at_period_end
}
```

---

## ⚠️ Critical DOs and DON'Ts

### ✅ ALWAYS DO:
1. Verify webhook signatures
2. Use webhooks as source of truth (not frontend)
3. Store `stripe_customer_id` and `stripe_subscription_id` in database
4. Use Payment Element (recommended)
5. Test locally with Stripe CLI

### ❌ NEVER DO:
1. Hardcode API keys
2. Trust frontend without webhook verification
3. Use deprecated CardElement for subscriptions
4. Skip webhook testing
5. Immediately downgrade on cancellation (use `cancel_at_period_end`)

---

## 🔥 Critical Webhook Events

```python
# Upgrade to Pro
'invoice.payment_succeeded' → tier='pro', status='active'

# Handle cancellation
'customer.subscription.updated' → check cancel_at_period_end

# Downgrade to Free
'customer.subscription.deleted' → tier='free', status='inactive'

# Handle failed payment
'invoice.payment_failed' → status='past_due', send email
```

---

## 🗄️ Database Schema

```sql
users:
  stripe_customer_id     -- REQUIRED: Links to Stripe Customer
  stripe_subscription_id -- REQUIRED: Links to active subscription
  subscription_tier      -- 'free', 'pro', 'enterprise'
  subscription_status    -- 'active', 'past_due', 'cancelled', 'inactive'
  subscription_end_date  -- When subscription renews/ends
```

---

## 🧪 Testing Checklist

- [ ] Subscribe with test card (4242...)
- [ ] Decline payment (4000 0000 0000 0002)
- [ ] Cancel subscription
- [ ] Reactivate subscription
- [ ] Trigger webhook: `stripe trigger invoice.payment_succeeded`
- [ ] Check webhook logs in Stripe Dashboard

---

## 🚨 Common Errors & Fixes

| Error | Fix |
|-------|-----|
| "Invalid API key" | Check `STRIPE_SECRET_KEY` in .env |
| "No such price" | Verify Price ID is correct |
| "Webhook signature invalid" | Check `STRIPE_WEBHOOK_SECRET` |
| "Multiple Checkout objects" | Use Payment Element instead |
| "Payment succeeds but user not upgraded" | Check webhook is firing |

---

## 📐 Architecture Pattern

```
Frontend                Backend                  Stripe
   │                       │                       │
   ├─(1) Click "Upgrade"──▶│                       │
   │                       ├─(2) Create Sub────────▶│
   │                       │◀─(3) Return Secret────┤
   │◀─(4) Return Secret───┤                       │
   │                       │                       │
   ├─(5) Confirm Payment──────────────────────────▶│
   │                       │                       │
   │                       │◀─(6) Webhook: Success─┤
   │                       ├─(7) Upgrade User      │
   │                       │    (tier='pro')       │
   │                       │                       │
   │◀─(8) Poll Status─────┤                       │
   │    (tier='pro')       │                       │
```

---

## 🔗 Quick Links

- **Test Cards:** https://stripe.com/docs/testing
- **Webhook Events:** https://stripe.com/docs/api/events/types
- **CLI Docs:** https://stripe.com/docs/cli
- **Dashboard:** https://dashboard.stripe.com

---

## ⚡ Copy-Paste Templates

### .env Template
```bash
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_PRO_PRICE_ID=price_xxxxx
```

### Test Script
```bash
#!/bin/bash
# test_stripe.sh

echo "Testing subscription creation..."
curl -X POST http://localhost:8000/api/billing/create-subscription \
  -H "Authorization: Bearer $TOKEN"

echo "Triggering webhook..."
stripe trigger invoice.payment_succeeded

echo "Checking user status..."
curl http://localhost:8000/api/billing/subscription-status \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🎯 Success Criteria

You're done when:
- ✅ User can subscribe with test card
- ✅ Webhook fires and upgrades user
- ✅ Stripe Dashboard shows active subscription
- ✅ User can cancel subscription
- ✅ Failed payments are handled gracefully

---

**Next time you integrate Stripe, just follow this cheat sheet and you'll be done in 30 minutes!** 🚀









