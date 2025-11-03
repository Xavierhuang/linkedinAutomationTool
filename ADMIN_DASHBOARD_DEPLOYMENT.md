# LinkedPilot Admin Dashboard & Billing System - Deployment Guide

## Overview

This guide covers the complete deployment of the admin dashboard and billing system for LinkedPilot.

## Architecture

- **Main App**: `https://mandi.media` (User Dashboard)
- **Admin Dashboard**: `https://admin.mandi.media` (Admin Interface)
- **Backend API**: Shared backend serving both applications

---

## Part 1: Backend Setup

### 1.1 Update Environment Variables

Add these to your backend `.env` file:

```bash
# JWT Secrets (use different secrets for security)
JWT_SECRET_KEY=your-user-jwt-secret
ADMIN_JWT_SECRET=your-admin-jwt-secret-different-from-user

# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_xxx  # Use sk_test_xxx for testing
STRIPE_PUBLISHABLE_KEY=pk_live_xxx  # Use pk_test_xxx for testing
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRO_PRICE_ID=price_xxx  # From Stripe dashboard

# Frontend URLs
FRONTEND_URL=https://mandi.media
ADMIN_DASHBOARD_URL=https://admin.mandi.media

# Usage Limits
FREE_TIER_AI_TOKENS=1000
FREE_TIER_POST_LIMIT=50
PRO_TIER_AI_TOKENS=10000
PRO_TIER_POST_LIMIT=-1
```

### 1.2 Install New Dependencies

```bash
cd backend
pip install stripe==13.0.1
```

### 1.3 Database Migration

No migration scripts needed! The new fields are added automatically on user signup. For existing users, run this MongoDB update:

```javascript
// Connect to MongoDB
db.users.updateMany(
  {},
  {
    $set: {
      role: "user",
      status: "active",
      subscription_tier: "free",
      subscription_status: "active",
      ai_tokens_used: 0,
      ai_tokens_limit: 1000,
      posts_this_month: 0,
      post_limit_per_month: 50,
      last_reset_date: new Date().toISOString(),
      linkedin_connected: false
    }
  }
);
```

### 1.4 Create Your First Admin User

```javascript
// In MongoDB, update your user account to admin
db.users.updateOne(
  { email: "your-email@mandi.media" },
  { $set: { role: "superadmin" } }
);
```

### 1.5 Restart Backend

```bash
cd backend
python server.py
```

The backend now has these new endpoints:
- `/api/admin/*` - Admin endpoints
- `/api/billing/*` - Billing endpoints

---

## Part 2: Stripe Configuration

### 2.1 Create Stripe Account

1. Go to [https://dashboard.stripe.com](https://dashboard.stripe.com)
2. Sign up or log in
3. Get your API keys from "Developers" → "API keys"

### 2.2 Create Product & Price

1. Go to "Products" in Stripe dashboard
2. Click "Add product"
3. Configure:
   - **Name**: LinkedPilot Pro
   - **Description**: Professional LinkedIn content automation
   - **Pricing**: $49.00 / month (recurring)
4. Copy the Price ID (starts with `price_xxx`)
5. Add it to your `.env` as `STRIPE_PRO_PRICE_ID`

### 2.3 Setup Webhook

1. Go to "Developers" → "Webhooks"
2. Click "Add endpoint"
3. **Endpoint URL**: `https://mandi.media/api/billing/webhooks/stripe`
4. **Events to listen to**:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.payment_succeeded`
5. Copy the **Signing secret** (starts with `whsec_xxx`)
6. Add it to your `.env` as `STRIPE_WEBHOOK_SECRET`

---

## Part 3: Admin Dashboard Deployment

### 3.1 Build Admin Dashboard

```bash
cd admin-dashboard

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
REACT_APP_API_URL=https://mandi.media
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
EOF

# Build for production
npm run build
```

### 3.2 Deploy to Subdomain

**Option A: Same Server (Recommended)**

If using Nginx:

```nginx
# Add to your nginx config

# Admin dashboard
server {
    listen 80;
    listen 443 ssl http2;
    server_name admin.mandi.media;

    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;

    root /var/www/linkedpilot/admin-dashboard/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to backend
    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Option B: Separate Server**

Deploy the `build` folder to a separate server and point `admin.mandi.media` to it.

### 3.3 Update DNS

Add an A record or CNAME:
```
admin.mandi.media → your-server-ip
```

### 3.4 SSL Certificate

```bash
# If using Certbot
sudo certbot --nginx -d admin.mandi.media
```

---

## Part 4: User Dashboard Updates

### 4.1 Install Stripe.js

```bash
cd frontend
npm install @stripe/stripe-js
```

### 4.2 Update Environment Variables

Add to `frontend/.env`:

```bash
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
```

### 4.3 Rebuild and Deploy

```bash
cd frontend
npm run build

# Copy build to your hosting
# ... deploy as usual
```

---

## Part 5: Testing

### 5.1 Test Admin Login

1. Go to `https://admin.mandi.media/login`
2. Login with your admin account
3. Verify you see the dashboard

### 5.2 Test Billing Flow (Stripe Test Mode)

Use Stripe test card: `4242 4242 4242 4242`
- Expiry: Any future date
- CVC: Any 3 digits
- ZIP: Any 5 digits

1. Login to user dashboard as a free user
2. Go to "Billing & Usage"
3. Click "Upgrade to Pro"
4. Complete checkout with test card
5. Verify subscription appears in admin dashboard

### 5.3 Test Webhooks

1. Go to Stripe Dashboard → Webhooks
2. Click your webhook endpoint
3. Click "Send test webhook"
4. Select `checkout.session.completed`
5. Verify it's received successfully

---

## Part 6: Go Live Checklist

Before going live with real payments:

- [ ] Switch Stripe from test mode to live mode
- [ ] Update all Stripe keys in environment variables
- [ ] Test the full signup → upgrade → payment flow
- [ ] Verify webhook is working in production
- [ ] Set up admin email notifications for failed payments
- [ ] Configure rate limiting on API endpoints
- [ ] Enable monitoring (Sentry, etc.)
- [ ] Create backup of database
- [ ] Document admin procedures
- [ ] Train admin staff on using admin dashboard

---

## Part 7: Admin User Guide

### Creating Admin Users

To give someone admin access:

```javascript
// In MongoDB
db.users.updateOne(
  { email: "newadmin@mandi.media" },
  { $set: { role: "admin" } }  // or "superadmin"
);
```

### Admin Roles

- **superadmin**: Full access, can modify system settings and create other admins
- **admin**: Can manage users and view analytics, but cannot change system settings
- **user**: Regular user (default)

### Key Admin Tasks

**Monitor Usage:**
- Dashboard → View AI token usage
- Analytics → Check top users by consumption

**Manage Subscriptions:**
- Billing → View active subscriptions
- Can manually cancel or refund subscriptions

**Handle Support Requests:**
- Users → Search for user
- Click user → View full details
- Can adjust limits or reset usage

---

## Part 8: Monitoring & Maintenance

### Daily Checks

1. Failed payments (Admin → Billing)
2. High usage alerts (Admin → Analytics)
3. System health (Admin → Dashboard)

### Monthly Tasks

1. Review MRR growth
2. Analyze churn rate
3. Check top users for potential issues
4. Review activity logs for unusual behavior

### Backup Strategy

```bash
# Backup MongoDB daily
mongodump --uri="$MONGO_URL" --out=/backups/$(date +%Y%m%d)

# Keep 30 days of backups
find /backups -mtime +30 -exec rm -rf {} \;
```

---

## Troubleshooting

### Admin Login Not Working

1. Check user has `role: "admin"` or `role: "superadmin"` in database
2. Verify `ADMIN_JWT_SECRET` is set correctly
3. Check browser console for CORS errors

### Stripe Webhooks Failing

1. Go to Stripe Dashboard → Webhooks
2. Check webhook logs
3. Verify `STRIPE_WEBHOOK_SECRET` matches
4. Ensure backend is accessible from Stripe servers (no firewall blocking)

### Payments Not Reflecting

1. Check webhook received successfully
2. Verify user's `stripe_customer_id` is set
3. Check backend logs for errors in webhook handler

### User Can't Upgrade

1. Check Stripe publishable key is correct in frontend `.env`
2. Verify `STRIPE_PRO_PRICE_ID` is set correctly
3. Test with Stripe test mode first

---

## Security Notes

1. **Never commit** `.env` files to git
2. Use different JWT secrets for admin and users
3. Keep admin dashboard on separate subdomain
4. Enable 2FA for admin accounts (future enhancement)
5. Regularly review admin activity logs
6. Rotate API keys periodically
7. Use HTTPS everywhere
8. Set up rate limiting on billing endpoints

---

## Support

If you encounter issues:

1. Check backend logs: `tail -f backend/logs/app.log`
2. Check Stripe webhook logs in dashboard
3. Review admin activity logs for unusual behavior
4. Contact Stripe support for payment issues

---

## Next Steps

After successful deployment:

1. Set up monitoring alerts (email/Slack)
2. Create admin user documentation
3. Set up automated backups
4. Configure email templates for billing notifications
5. Add analytics tracking (Mixpanel, etc.)
6. Consider adding 2FA for admin accounts
7. Set up staging environment for testing changes

---

## Cost Breakdown

- **Stripe fees**: 2.9% + $0.30 per transaction
- **Monthly Pro subscription**: $49/user
  - Net revenue: ~$47.50/user after Stripe fees
- **Backend costs**: Existing infrastructure (no additional cost)
- **Admin dashboard**: Static hosting (minimal/free with current server)

---

## Scaling Considerations

As you grow:

- Consider Redis for caching usage stats
- Set up CDN for admin dashboard
- Implement database read replicas
- Add queue system (Celery/Bull) for async tasks
- Set up horizontal scaling for API servers
- Implement proper logging and alerting

---

**Deployment Date**: _________
**Deployed By**: _________
**Version**: 1.0.0










