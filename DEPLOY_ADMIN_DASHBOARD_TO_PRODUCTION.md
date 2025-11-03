# Deploy Admin Dashboard to Production (mandi.media)

## Overview

Deploy the complete admin dashboard with cancellation tracking to your live site at:
- **Main App**: `https://mandi.media`
- **Admin Dashboard**: `https://admin.mandi.media`
- **Backend API**: `https://mandi.media/api`

---

## Pre-Deployment Checklist

### 1. Test Locally First

- [ ] Backend running on `http://localhost:8000`
- [ ] Frontend running on `http://localhost:3000`
- [ ] Admin Dashboard running on `http://localhost:3002`
- [ ] Can login to admin dashboard
- [ ] Dashboard shows real metrics
- [ ] Cancellation tracking works
- [ ] "At Risk" metric shows correctly

### 2. Verify Files Changed

**Backend Files:**
```
backend/linkedpilot/routes/admin.py         (Updated stats + activity)
backend/linkedpilot/routes/billing.py       (Fixed cancellation logic)
```

**Admin Dashboard Files:**
```
admin-dashboard/src/pages/DashboardOverview.js   (New metrics + activity colors)
admin-dashboard/src/pages/UsersManagement.js     (Already has cancellation badges)
```

**Documentation:**
```
ADMIN_DASHBOARD_CANCELLATION_TRACKING.md
STRIPE_SAAS_INTEGRATION_GUIDE.md (Updated with real stories)
```

---

## Deployment Steps

### Step 1: Backup Current Production

```bash
# SSH into your server
ssh user@your-server

# Backup current code
cd /var/www
cp -r mandi.media mandi.media.backup-$(date +%Y%m%d)
cd mandi.media
```

### Step 2: Update Backend

```bash
# Navigate to backend directory
cd backend

# Pull latest changes (if using git)
git pull origin main

# Or manually upload changed files:
# - backend/linkedpilot/routes/admin.py
# - backend/linkedpilot/routes/billing.py

# Restart backend
pm2 restart linkedpilot-backend

# Or if using systemd:
sudo systemctl restart linkedpilot-backend

# Check logs
pm2 logs linkedpilot-backend --lines 50
```

### Step 3: Update Admin Dashboard

```bash
# Navigate to admin dashboard
cd /var/www/admin.mandi.media

# Pull latest changes
git pull origin main

# Or manually upload changed files:
# - admin-dashboard/src/pages/DashboardOverview.js

# Install dependencies (if needed)
npm install

# Build for production
npm run build

# Restart admin dashboard server
pm2 restart admin-dashboard

# Or copy build to nginx
sudo cp -r build/* /var/www/admin.mandi.media/html/
```

### Step 4: Verify Deployment

```bash
# Check if services are running
pm2 status

# Expected output:
# ┌─────┬────────────────────┬─────────┬─────────┬─────────┐
# │ id  │ name               │ status  │ restart │ uptime  │
# ├─────┼────────────────────┼─────────┼─────────┼─────────┤
# │ 0   │ linkedpilot-backend│ online  │ 0       │ 5m      │
# │ 1   │ linkedpilot-frontend│ online │ 0       │ 5m      │
# │ 2   │ admin-dashboard    │ online  │ 0       │ 5m      │
# └─────┴────────────────────┴─────────┴─────────┴─────────┘

# Test backend API
curl http://localhost:8000/api/admin/dashboard/stats

# Should return JSON with:
# - active_subscriptions
# - cancelling_subscriptions
# - at_risk_mrr
# - recent_cancellations
```

### Step 5: Test Admin Dashboard

1. **Open**: `https://admin.mandi.media`
2. **Login**: Use your admin credentials
3. **Check Dashboard Overview**:
   - [ ] "Total Users" shows correct count
   - [ ] "Active Subscriptions" shows correct count
   - [ ] "At Risk" card visible (orange)
   - [ ] "MRR" shows correct amount with "at risk" subtitle
4. **Check Recent Activity**:
   - [ ] Shows user signups (green dot)
   - [ ] Shows subscription upgrades (blue dot)
   - [ ] Shows cancellations (red dot) ✨ NEW
5. **Check Users Management**:
   - [ ] Filter checkbox: "Show only users with pending cancellations" ✨ NEW
   - [ ] Users with `cancel_at_period_end` show orange "CANCELLING" badge ✨ NEW

---

## Nginx Configuration (If Needed)

### Admin Dashboard Subdomain

**File**: `/etc/nginx/sites-available/admin.mandi.media`

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name admin.mandi.media;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name admin.mandi.media;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/admin.mandi.media/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.mandi.media/privkey.pem;

    # Root directory
    root /var/www/admin.mandi.media/html;
    index index.html;

    # React Router support
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy to backend
    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Enable and reload:**
```bash
sudo ln -s /etc/nginx/sites-available/admin.mandi.media /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Environment Variables

### Backend `.env` (Production)

Ensure these are set:
```env
# Admin JWT
ADMIN_JWT_SECRET=your-admin-secret-here

# Database
MONGODB_URL=mongodb://localhost:27017/linkedpilot

# Encryption (for API keys)
ENCRYPTION_KEY=your-static-encryption-key-here

# Stripe (fetched from admin dashboard, but good to have backup)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
```

### Admin Dashboard `.env` (Production)

**File**: `admin-dashboard/.env.production`
```env
REACT_APP_API_URL=https://mandi.media
```

---

## Database Migration (If Needed)

The new cancellation tracking adds these fields to users:
- `cancel_at_period_end`: Boolean (default: false)
- `cancelled_at`: ISO timestamp (optional)

**No migration needed!** These fields are added dynamically when users cancel.

### Optional: Add Index for Performance

```javascript
// Connect to MongoDB
mongo

use linkedpilot

// Add index for faster cancellation queries
db.users.createIndex({ "cancel_at_period_end": 1 })
db.users.createIndex({ "cancelled_at": -1 })
db.subscriptions.createIndex({ "cancel_at_period_end": 1 })
```

---

## SSL Certificate for Admin Subdomain

If `admin.mandi.media` doesn't have SSL yet:

```bash
# Install certbot (if not already installed)
sudo apt install certbot python3-certbot-nginx

# Get certificate for admin subdomain
sudo certbot --nginx -d admin.mandi.media

# Certbot will automatically:
# - Create SSL certificate
# - Update nginx config
# - Set up auto-renewal

# Verify auto-renewal
sudo certbot renew --dry-run
```

---

## PM2 Ecosystem Configuration

**File**: `ecosystem.config.js` (root of project)

```javascript
module.exports = {
  apps: [
    {
      name: 'linkedpilot-backend',
      cwd: './backend',
      script: 'uvicorn',
      args: 'server:app --host 0.0.0.0 --port 8000',
      interpreter: 'python3',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'linkedpilot-frontend',
      cwd: './frontend',
      script: 'npm',
      args: 'start',
      env: {
        PORT: 3000,
        NODE_ENV: 'production'
      }
    },
    {
      name: 'admin-dashboard',
      cwd: './admin-dashboard',
      script: 'serve',
      args: '-s build -l 3002',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

**Start all services:**
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## Rollback Plan (If Something Goes Wrong)

### Option 1: Quick Rollback

```bash
# Stop current services
pm2 stop all

# Restore backup
cd /var/www
rm -rf mandi.media
mv mandi.media.backup-YYYYMMDD mandi.media

# Restart services
cd mandi.media
pm2 start ecosystem.config.js
```

### Option 2: Revert Specific Files

```bash
# Revert only backend admin.py
cd backend/linkedpilot/routes
git checkout HEAD~1 admin.py
pm2 restart linkedpilot-backend

# Revert only admin dashboard
cd admin-dashboard
git checkout HEAD~1 src/pages/DashboardOverview.js
npm run build
pm2 restart admin-dashboard
```

---

## Post-Deployment Testing

### 1. Test Cancellation Flow

1. **User cancels** (as regular user):
   - Go to `https://mandi.media/dashboard/settings`
   - Click "Billing & Usage" tab
   - Cancel Pro subscription
   - Should see: "Subscription will be cancelled at the end of the billing period"

2. **Admin sees it** (as admin):
   - Go to `https://admin.mandi.media`
   - Dashboard Overview should show:
     - "At Risk": 1 user, $30 MRR
   - Recent Activity should show:
     - Red dot: "Subscription cancelled (ends at period)"
   - Users Management should show:
     - User with PRO + CANCELLING badges

### 2. Verify Metrics

```bash
# Check backend logs
pm2 logs linkedpilot-backend --lines 100

# Should see successful API calls:
# [OK] [ADMIN] Dashboard stats fetched
# [OK] [ADMIN] Recent activity fetched
```

### 3. Monitor for Errors

```bash
# Watch logs for 5 minutes
pm2 logs --lines 200

# Check for any errors related to:
# - Missing fields (cancel_at_period_end)
# - Database query failures
# - Admin authentication issues
```

---

## Troubleshooting

### Problem: Admin dashboard shows 0 for all metrics

**Solution:**
```bash
# Check backend is actually running
curl http://localhost:8000/api/admin/dashboard/stats

# If 401 Unauthorized:
# - Check admin token in browser localStorage
# - Try logging in again

# If 500 Server Error:
# - Check backend logs: pm2 logs linkedpilot-backend
# - Verify MongoDB is running: sudo systemctl status mongod
```

### Problem: "At Risk" card not showing

**Solution:**
```bash
# Check if users have cancel_at_period_end field
mongo
use linkedpilot
db.users.find({ cancel_at_period_end: true }).count()

# If 0, test cancellation flow again
```

### Problem: Admin dashboard won't load (blank page)

**Solution:**
```bash
# Check nginx logs
sudo tail -f /var/log/nginx/error.log

# Check if build files exist
ls -la /var/www/admin.mandi.media/html/

# Rebuild if needed
cd admin-dashboard
npm run build
sudo cp -r build/* /var/www/admin.mandi.media/html/
```

---

## Success Criteria

Your deployment is successful when:

- [x] Admin dashboard loads at `https://admin.mandi.media`
- [x] Can login with admin credentials
- [x] Dashboard shows real numbers (not 0s everywhere)
- [x] "At Risk" card appears with correct data
- [x] Cancellation tracking works end-to-end
- [x] Recent Activity shows cancellations with red dot
- [x] Users Management shows "CANCELLING" badges
- [x] No errors in backend logs
- [x] No 401/403 errors in browser console

---

## Monitoring After Deployment

### Set Up Alerts (Optional)

**High Churn Alert:**
```javascript
// Add to backend cron job
if (cancelling_subscriptions / active_subscriptions > 0.1) {
  sendEmailAlert('High churn rate detected: ' + churnRate + '%');
}
```

**Daily MRR Report:**
```bash
# Add to crontab
0 9 * * * curl https://mandi.media/api/admin/dashboard/stats | mail -s "Daily MRR Report" admin@mandi.media
```

---

## Next Steps After Deployment

1. **Monitor for 24 hours**: Watch for any errors or issues
2. **Test cancellation flow**: Have a test user cancel and verify tracking
3. **Review metrics**: Check if numbers make sense
4. **Set up alerts**: Email notifications for cancellations
5. **Plan retention**: Reach out to cancelling users

---

**Deployment Date:** ___________  
**Deployed By:** ___________  
**Status:** [ ] Pending [ ] In Progress [ ] Complete ✅

---

## Support

If you encounter issues:
1. Check backend logs: `pm2 logs linkedpilot-backend`
2. Check admin dashboard logs: `pm2 logs admin-dashboard`
3. Check nginx logs: `sudo tail -f /var/log/nginx/error.log`
4. Rollback if needed (see Rollback Plan above)









