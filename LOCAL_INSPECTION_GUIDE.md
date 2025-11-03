# LinkedPilot - Local Inspection Guide

## 🚀 All Servers Started!

I've started all three components for you to inspect:

---

## 📍 Access URLs

### 1. **Backend API** 
- **URL**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Status**: Running in background

### 2. **Main Frontend (User Dashboard)**
- **URL**: http://localhost:3000
- **Login**: Use your existing user account
- **Status**: Running in background

### 3. **Admin Dashboard** 
- **URL**: http://localhost:3002
- **Login**: Use admin account (see below)
- **Status**: Running in background

---

## 🔑 First Time Setup

### Create Your First Admin User

Since this is your first time, you need to create an admin user:

**Option 1: Using MongoDB Compass (GUI)**
1. Open MongoDB Compass
2. Connect to: `mongodb://localhost:27017`
3. Select database: `linkedpilot`
4. Select collection: `users`
5. Find your user by email
6. Edit document and add/change field:
   ```json
   "role": "superadmin"
   ```
7. Save

**Option 2: Using MongoDB Shell**
```bash
# Open new terminal
mongosh "mongodb://localhost:27017/linkedpilot"

# Run this command (replace with your email)
db.users.updateOne(
  { email: "your-email@example.com" },
  { $set: { role: "superadmin" } }
)
```

**Option 3: Using Python Script**
Create a file `make_admin.py` in the backend folder:
```python
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def make_admin():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    
    email = input("Enter email to make admin: ")
    
    result = await db.users.update_one(
        {"email": email},
        {"$set": {"role": "superadmin"}}
    )
    
    if result.modified_count > 0:
        print(f"✅ {email} is now a superadmin!")
    else:
        print(f"❌ User {email} not found")
    
    client.close()

asyncio.run(make_admin())
```

Then run: `python make_admin.py`

---

## 🧪 Testing the New Features

### 1. Test Admin Dashboard

1. **Go to**: http://localhost:3002/login
2. **Login** with your admin account
3. **Explore**:
   - Dashboard → See overview stats
   - Users → View all users (search/filter)
   - Billing → View subscriptions
   - Analytics → Usage data
   - Activity Logs → Admin actions
   - Settings → Configure limits

### 2. Test User Billing Page

1. **Go to**: http://localhost:3000
2. **Login** as regular user
3. **Navigate to**: "Billing & Usage" in sidebar
4. **See**:
   - Current plan (Free/Pro)
   - Usage statistics with progress bars
   - Feature comparison
   - Upgrade button

### 3. Test Upgrade Flow (Test Mode)

**Important**: For local testing, you'll need Stripe test keys.

**Quick Setup**:
1. Go to https://dashboard.stripe.com/test/apikeys
2. Get your test keys
3. Update `backend/.env`:
   ```
   STRIPE_SECRET_KEY=sk_test_xxx
   STRIPE_PUBLISHABLE_KEY=pk_test_xxx
   ```
4. Update `frontend/.env`:
   ```
   REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
   ```
5. Restart servers

**Test Card**: 4242 4242 4242 4242
- Expiry: Any future date
- CVC: Any 3 digits
- ZIP: Any 5 digits

### 4. Test Usage Tracking

1. Create some posts in the main app
2. Check "Billing & Usage" → See numbers update
3. Go to admin dashboard → Analytics → See usage there too

---

## 🔍 What to Inspect

### Backend (Port 8000)

**New Endpoints** - Check http://localhost:8000/docs:
- `/api/admin/*` - Admin endpoints (30+)
- `/api/billing/*` - Billing endpoints

**Try These**:
- GET /api/admin/dashboard/stats
- GET /api/admin/users
- GET /api/billing/subscription-status

### User Dashboard (Port 3000)

**New Features**:
- "Billing & Usage" menu item (in sidebar)
- Usage widgets showing limits
- Upgrade prompts when approaching limits

**Check These Pages**:
- /dashboard/billing → New billing page
- /dashboard/settings → Simplified (removed API Keys tab)

### Admin Dashboard (Port 3002)

**All New Pages**:
- /login → Admin login
- /dashboard → Overview stats
- /users → User management
- /billing → Subscription management
- /analytics → Usage analytics
- /logs → Activity logs
- /settings → System settings

---

## 📊 Sample Data

To test properly, you should have:
- ✅ At least 1 user (yourself)
- ✅ Made yourself a superadmin
- ✅ Created a few posts
- ⚠️ For billing: Need Stripe test keys

---

## 🐛 Troubleshooting

### Backend Not Starting?

Check `backend/.env` exists and has:
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=linkedpilot
JWT_SECRET_KEY=your-secret-key
```

### Frontend Not Loading?

```bash
cd frontend
npm install
npm start
```

### Admin Dashboard Not Loading?

```bash
cd admin-dashboard
npm install
npm start
```

### Port Already in Use?

Find and kill the process:
```powershell
# Find process on port 8000
netstat -ano | findstr :8000

# Kill it (replace PID)
taskkill /PID <PID> /F
```

### Can't Login to Admin?

Make sure you ran the MongoDB update to set role="superadmin"

---

## 📝 Key Files to Review

### Backend
- `backend/linkedpilot/routes/admin.py` - Admin API endpoints
- `backend/linkedpilot/routes/billing.py` - Stripe integration
- `backend/linkedpilot/middleware/rate_limiter.py` - Usage limits
- `backend/server.py` - Updated with new routes

### Admin Dashboard
- `admin-dashboard/src/pages/AdminDashboard.js` - Main layout
- `admin-dashboard/src/pages/DashboardOverview.js` - Dashboard stats
- `admin-dashboard/src/pages/UsersManagement.js` - User CRUD

### User Dashboard
- `frontend/src/pages/linkedpilot/components/BillingView.js` - Billing page
- `frontend/src/components/UsageWidget.js` - Usage widget

---

## 🎯 What to Look For

### Code Quality
- ✅ Clean, well-documented code
- ✅ Proper error handling
- ✅ Responsive design
- ✅ Professional UI

### Features
- ✅ Admin authentication separate from users
- ✅ Role-based access control
- ✅ Usage tracking and limits
- ✅ Stripe integration (needs test keys)
- ✅ Analytics and reporting

### Security
- ✅ Separate admin JWT tokens
- ✅ Activity logging
- ✅ Rate limiting
- ✅ Proper CORS configuration

---

## 💡 Test Scenarios

### Scenario 1: Admin Workflow
1. Login to admin dashboard
2. View all users
3. Click on a user → See details
4. Check their usage stats
5. View billing overview

### Scenario 2: User Upgrade
1. Login to user app (free tier)
2. Create posts until you approach limit
3. See warning about reaching limit
4. Go to billing page
5. See upgrade prompt
6. (With Stripe keys) Test upgrade flow

### Scenario 3: Usage Limits
1. As free user, try to exceed AI token limit
2. Should get error message
3. Upgrade to Pro
4. Limits should increase

---

## 🛑 Stopping the Servers

To stop all servers, you can:

1. **Close terminals** (if running in separate windows)
2. **Or press Ctrl+C** in each terminal
3. **Or use Task Manager** to kill Node.js and Python processes

---

## 📞 Need Help?

If something doesn't work:
1. Check the console logs in each terminal
2. Check browser console (F12)
3. Review the error messages
4. Check MongoDB is running: `mongosh`

---

## ✅ Success Checklist

After inspecting, verify:
- [ ] Backend is accessible at :8000
- [ ] Main app loads at :3000
- [ ] Admin dashboard loads at :3002
- [ ] Can login to admin dashboard
- [ ] Can see user list in admin
- [ ] Billing page shows in main app
- [ ] Usage widgets display correctly
- [ ] Settings page is simplified
- [ ] All pages are responsive

---

**Happy Inspecting! 🔍**

All three servers should now be running. Open your browser and start exploring!










