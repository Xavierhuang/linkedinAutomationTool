# Admin Dashboard & Billing - Quick Start Guide

## What Was Built

A complete admin dashboard and billing system for LinkedPilot with:

1. **Admin Dashboard** (`admin.mandi.media`) - Separate admin interface
2. **Billing System** - Stripe integration with Free/Pro tiers
3. **Usage Tracking** - AI tokens and post limits
4. **Rate Limiting** - Automatic enforcement of tier limits
5. **User Dashboard Updates** - Billing page and usage widgets

---

## Quick Setup (5 minutes)

### Step 1: Install Dependencies

```bash
# Backend
cd backend
pip install stripe

# Frontend - Main App (already has dependencies)
cd ../frontend
npm install @stripe/stripe-js

# Admin Dashboard (new)
cd ../admin-dashboard
npm install
```

### Step 2: Configure Backend

Add to `backend/.env`:

```bash
# Admin JWT (use a different secret!)
ADMIN_JWT_SECRET=your-different-admin-secret-here

# Stripe (start with test mode)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRO_PRICE_ID=price_xxx

# URLs
FRONTEND_URL=http://localhost:3000
ADMIN_DASHBOARD_URL=http://localhost:3002
```

### Step 3: Setup Stripe Test Mode

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/products)
2. Create a product: "LinkedPilot Pro" - $49/month
3. Copy the Price ID (starts with `price_xxx`)
4. Get your test API keys from "Developers" → "API keys"

### Step 4: Create Admin User

```bash
# Start backend first
cd backend
python server.py

# In another terminal, connect to MongoDB and run:
mongosh "your-mongo-url"

# Update your user to admin
db.users.updateOne(
  { email: "your-email@example.com" },
  { $set: { role: "superadmin" } }
)
```

### Step 5: Start Everything

```bash
# Terminal 1: Backend
cd backend
python server.py

# Terminal 2: Main Frontend
cd frontend
npm start  # Runs on :3000

# Terminal 3: Admin Dashboard
cd admin-dashboard
npm start  # Runs on :3002 (you may need to set PORT=3002)
```

If port 3002 is taken, update the admin start script:

```bash
# In admin-dashboard/package.json, update scripts:
"start": "PORT=3002 react-scripts start"
```

---

## Testing the System

### Test 1: Admin Login

1. Go to `http://localhost:3002/login`
2. Login with your admin email/password
3. You should see the admin dashboard

### Test 2: User Upgrade Flow

1. Go to `http://localhost:3000` (main app)
2. Login as a regular user
3. Go to "Billing & Usage" in sidebar
4. Click "Upgrade to Pro"
5. Use test card: `4242 4242 4242 4242`
6. Verify upgrade works

### Test 3: Usage Tracking

1. Create some posts in the main app
2. Check "Billing & Usage" - see usage numbers update
3. In admin dashboard, go to "Analytics" - see the same data

---

## File Structure

```
backend/
├── linkedpilot/
│   ├── models/
│   │   └── subscription.py          (NEW - Subscription models)
│   ├── middleware/
│   │   ├── admin_auth.py             (NEW - Admin auth)
│   │   └── rate_limiter.py           (NEW - Usage limits)
│   └── routes/
│       ├── admin.py                  (NEW - Admin endpoints)
│       └── billing.py                (NEW - Billing/Stripe)
├── server.py                         (UPDATED - Includes new routes)
└── .env                              (UPDATED - New vars)

frontend/
├── src/
│   ├── components/
│   │   └── UsageWidget.js           (NEW - Usage display)
│   └── pages/linkedpilot/
│       ├── LinkedPilotDashboard.js   (UPDATED - Billing route)
│       └── components/
│           ├── LinkedPilotSidebar.js (UPDATED - Billing menu)
│           ├── BillingView.js        (NEW - Billing page)
│           └── SettingsView.js       (UPDATED - Simplified)
└── package.json                      (UPDATED - Stripe dep)

admin-dashboard/                      (NEW - Entire folder)
├── src/
│   ├── pages/
│   │   ├── AdminLogin.js
│   │   ├── AdminDashboard.js
│   │   ├── DashboardOverview.js
│   │   ├── UsersManagement.js
│   │   ├── BillingManagement.js
│   │   ├── AnalyticsView.js
│   │   ├── ActivityLogs.js
│   │   └── SystemSettings.js
│   └── contexts/
│       └── AdminAuthContext.js
└── package.json
```

---

## API Endpoints Reference

### Admin Endpoints (require admin JWT)

```
POST   /api/admin/auth/login           - Admin login
GET    /api/admin/users                - List users
GET    /api/admin/users/:id            - User details
PATCH  /api/admin/users/:id            - Update user
GET    /api/admin/billing/overview     - Billing stats
GET    /api/admin/subscriptions        - List subscriptions
GET    /api/admin/analytics/usage      - Usage analytics
GET    /api/admin/logs                 - Activity logs
GET    /api/admin/dashboard/stats      - Dashboard stats
GET    /api/admin/system/settings      - System settings
PATCH  /api/admin/system/settings      - Update settings
```

### Billing Endpoints (require user JWT)

```
POST   /api/billing/create-checkout-session  - Start upgrade
GET    /api/billing/subscription-status      - Get subscription
POST   /api/billing/cancel-subscription      - Cancel sub
GET    /api/billing/payment-history          - Payment history
POST   /api/billing/webhooks/stripe          - Stripe webhook
```

---

## Usage Limits

### Free Tier (Default)
- 1,000 AI tokens/month
- 50 posts/month
- All features available

### Pro Tier ($49/month)
- 10,000 AI tokens/month
- Unlimited posts
- Priority support

Limits automatically reset on the 1st of each month.

---

## Common Tasks

### Add a New Admin

```javascript
db.users.updateOne(
  { email: "admin@example.com" },
  { $set: { role: "admin" } }
);
```

### Manually Upgrade a User

```javascript
db.users.updateOne(
  { email: "user@example.com" },
  { $set: {
    subscription_tier: "pro",
    ai_tokens_limit: 10000,
    post_limit_per_month: -1
  }}
);
```

### Reset User's Monthly Usage

```javascript
db.users.updateOne(
  { email: "user@example.com" },
  { $set: {
    ai_tokens_used: 0,
    posts_this_month: 0,
    last_reset_date: new Date().toISOString()
  }}
);
```

### View All Subscriptions

```bash
# In MongoDB
db.users.find({ subscription_tier: "pro" })
```

---

## Troubleshooting

**Admin login fails:**
```bash
# Check user role
db.users.findOne({ email: "your@email.com" })
# Should have role: "admin" or "superadmin"
```

**Upgrade button doesn't work:**
- Check `STRIPE_PUBLISHABLE_KEY` is in frontend `.env`
- Check browser console for errors
- Make sure backend is running

**Webhook errors:**
- Stripe webhooks won't work on localhost
- Use Stripe CLI for local testing:
```bash
stripe listen --forward-to localhost:8000/api/billing/webhooks/stripe
```

**Usage not updating:**
- Check rate limiter is being called
- Verify `last_reset_date` field exists on user
- Check backend logs

---

## Next Steps

1. ✅ Test locally with Stripe test mode
2. ✅ Verify all admin functions work
3. ✅ Test upgrade/downgrade flow
4. ✅ Check usage limits enforce correctly
5. Deploy to production (see ADMIN_DASHBOARD_DEPLOYMENT.md)

---

## Key Files to Understand

1. **`backend/server.py`** - Main entry point, includes all routes
2. **`backend/linkedpilot/routes/admin.py`** - All admin endpoints
3. **`backend/linkedpilot/routes/billing.py`** - Stripe integration
4. **`backend/linkedpilot/middleware/rate_limiter.py`** - Usage limits
5. **`admin-dashboard/src/pages/AdminDashboard.js`** - Admin layout
6. **`frontend/src/pages/linkedpilot/components/BillingView.js`** - User billing

---

## Support

- **Backend errors**: Check `backend/logs/`
- **Stripe issues**: Check Stripe Dashboard → Webhooks → Logs
- **Admin issues**: Check browser console
- **Database issues**: Check MongoDB logs

---

**Created**: 2025-01-XX
**Version**: 1.0.0
**Status**: Ready for Testing










