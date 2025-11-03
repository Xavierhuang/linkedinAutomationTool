# 🧪 Stripe Test Mode Setup - Complete Guide

## 🎯 **Goal:**
Set up Stripe in **TEST MODE** to test your Pro subscription flow without real charges.

---

## 📋 **Step-by-Step Setup:**

### **Step 1: Create/Login to Stripe Account**

1. **Go to:** https://dashboard.stripe.com/register
2. **Sign up** or **log in** if you already have an account
3. **Verify your email**

---

### **Step 2: Switch to Test Mode**

1. **Look at the top right** of the Stripe Dashboard
2. **You'll see a toggle:** "Test mode" / "Live mode"
3. **Make sure "Test mode" is ON** (it should say "Test mode" with a toggle)
4. **Color indicator:** Test mode shows an orange/amber banner

```
┌────────────────────────────────────────┐
│ [🔴 Test mode ▼]  Your Name           │  ← Make sure this is ON
└────────────────────────────────────────┘
```

---

### **Step 3: Get Your Test API Keys**

1. **Navigate to:** Developers → API keys
   - URL: https://dashboard.stripe.com/test/apikeys

2. **You'll see two keys:**

   **A. Publishable key (starts with `pk_test_`)**
   ```
   pk_test_51ABC123...XYZ
   ```
   - Click to copy
   - This goes in your frontend (safe to expose)

   **B. Secret key (starts with `sk_test_`)**
   ```
   sk_test_51ABC123...XYZ
   ```
   - Click "Reveal test key"
   - Copy it
   - ⚠️ **Keep this secret!**

3. **Save both keys somewhere safe** (you'll need them soon)

---

### **Step 4: Create Your Pro Product**

1. **Navigate to:** Products → Add product
   - URL: https://dashboard.stripe.com/test/products/create

2. **Fill in the details:**
   ```
   Name: LinkedPilot Pro
   Description: Pro tier with unlimited features
   
   Pricing:
   ├─ Model: Standard pricing
   ├─ Price: $49.00 USD
   ├─ Billing period: Monthly
   └─ Payment type: Recurring
   ```

3. **Click "Add product"**

4. **Copy the Price ID:**
   - After creating, you'll see a price entry
   - Click on it
   - Look for: `price_...` (starts with "price_")
   - Example: `price_1ABC123XYZ`
   - **Copy this!**

---

### **Step 5: Set Up Webhook (Local Testing)**

For local testing, we'll use **Stripe CLI**:

#### **Option A: Install Stripe CLI (Recommended for Testing)**

1. **Download Stripe CLI:**
   - Windows: https://github.com/stripe/stripe-cli/releases/latest
   - Download `stripe_X.X.X_windows_x86_64.zip`

2. **Extract and add to PATH** (or run from folder)

3. **Login to Stripe:**
   ```powershell
   stripe login
   ```
   - This opens your browser
   - Click "Allow access"

4. **Forward webhooks to local backend:**
   ```powershell
   stripe listen --forward-to localhost:8000/api/billing/webhooks/stripe
   ```
   - This will show you a **webhook signing secret**
   - Starts with: `whsec_...`
   - **Copy this!**
   - Keep this terminal open while testing

#### **Option B: Use Stripe Dashboard (For Production Later)**

1. **Navigate to:** Developers → Webhooks → Add endpoint
   - URL: https://dashboard.stripe.com/test/webhooks/create

2. **Endpoint URL:**
   ```
   https://your-domain.com/api/billing/webhooks/stripe
   ```
   - For now, you can use: `https://yourdomain.ngrok.io/api/billing/webhooks/stripe`
   - Or set this up later when deploying

3. **Select events:**
   ```
   ✓ checkout.session.completed
   ✓ customer.subscription.created
   ✓ customer.subscription.updated
   ✓ customer.subscription.deleted
   ✓ invoice.payment_succeeded
   ✓ invoice.payment_failed
   ```

4. **Copy the signing secret** (starts with `whsec_...`)

---

### **Step 6: Configure Keys in Admin Dashboard**

Now let's add all your Stripe keys to your admin dashboard:

1. **Open your admin dashboard:**
   ```
   http://localhost:3002
   ```

2. **Log out and log back in** (to get fresh admin token)

3. **Navigate to: API Keys → Stripe tab**

4. **Enter your test keys:**
   ```
   Secret Key:          sk_test_51ABC...
   Publishable Key:     pk_test_51ABC...
   Webhook Secret:      whsec_...
   Pro Plan Price ID:   price_1ABC...
   ```

5. **Click "Save All Keys"**

---

### **Step 7: Update Environment Variables (Optional)**

You can also add them to your `.env` file for the frontend:

**Create/Update:** `frontend/.env`
```bash
REACT_APP_BACKEND_URL=http://localhost:8000
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_51ABC...
```

---

### **Step 8: Test the Subscription Flow**

#### **A. From User Dashboard:**

1. **Open user dashboard:**
   ```
   http://localhost:3000
   ```

2. **Navigate to: Settings → Billing & Usage tab**

3. **Click "Upgrade to Pro"**

4. **You'll be redirected to Stripe Checkout**

#### **B. Use Test Card:**

Stripe provides test card numbers that work in test mode:

**Success Card:**
```
Card Number:  4242 4242 4242 4242
Expiry:       Any future date (e.g., 12/25)
CVC:          Any 3 digits (e.g., 123)
ZIP:          Any 5 digits (e.g., 12345)
```

**Other Test Cards:**
```
Success:              4242 4242 4242 4242
Decline:              4000 0000 0000 0002
Insufficient funds:   4000 0000 0000 9995
3D Secure:            4000 0027 6000 3184
```

#### **C. Complete the Flow:**

1. **Enter test card details**
2. **Click "Subscribe"**
3. **You'll be redirected back to your app**
4. **Check your user dashboard:**
   - Should now show "Pro" tier
   - MRR should increase to $49

#### **D. Verify in Stripe Dashboard:**

1. **Go to:** Payments
   - URL: https://dashboard.stripe.com/test/payments
   - You should see your $49 payment

2. **Go to:** Customers
   - URL: https://dashboard.stripe.com/test/customers
   - You should see your user

3. **Go to:** Subscriptions
   - URL: https://dashboard.stripe.com/test/subscriptions
   - You should see the active subscription

---

### **Step 9: Verify Webhook Delivery**

1. **In Stripe Dashboard:**
   - Go to: Developers → Webhooks
   - Click on your webhook endpoint
   - You should see event deliveries

2. **Check your backend logs:**
   - Look for webhook events being received
   - Should show: `checkout.session.completed`

3. **Check your database:**
   ```powershell
   cd backend
   python check_users.py
   ```
   - Your user should now be on "Pro" tier

---

### **Step 10: Test in Admin Dashboard**

1. **Open admin dashboard:**
   ```
   http://localhost:3002
   ```

2. **Check Dashboard Overview:**
   ```
   ✓ Total Users: 1
   ✓ Active Subscriptions: 1 (increased!)
   ✓ MRR: $49 (increased!)
   ```

3. **Check Recent Activity:**
   - Should show "Subscription upgraded"

---

## 📊 **What You'll See:**

### **Before Upgrade:**
```
Admin Dashboard:
├─ Total Users: 1
├─ Active Subscriptions: 0
├─ MRR: $0
└─ Your tier: free
```

### **After Upgrade (Test Mode):**
```
Admin Dashboard:
├─ Total Users: 1
├─ Active Subscriptions: 1 ✅
├─ MRR: $49 ✅
└─ Your tier: pro ✅

Stripe Dashboard:
├─ Test payment: $49.00 ✅
├─ Test customer created ✅
├─ Test subscription active ✅
└─ Webhook events delivered ✅
```

---

## 🧪 **Test Scenarios:**

### **1. Successful Subscription:**
```
Card: 4242 4242 4242 4242
Result: ✅ Subscription created
```

### **2. Declined Card:**
```
Card: 4000 0000 0000 0002
Result: ❌ Payment fails, no subscription
```

### **3. Cancel Subscription:**
```
1. Go to Stripe Dashboard → Subscriptions
2. Click on your subscription
3. Click "Cancel subscription"
4. Choose "Cancel immediately"
5. Check admin dashboard - should show 0 active subscriptions
```

### **4. Test Webhook Failure:**
```
1. Stop your backend server
2. Trigger a Stripe event (e.g., cancel sub)
3. Restart backend
4. Stripe will retry webhooks automatically
```

---

## 🎯 **Quick Setup Checklist:**

```
Step 1: ✅ Create Stripe account
Step 2: ✅ Switch to Test Mode
Step 3: ✅ Get test API keys (pk_test_ and sk_test_)
Step 4: ✅ Create Pro product ($49/month)
Step 5: ✅ Get webhook secret (whsec_)
Step 6: ✅ Configure in Admin Dashboard (API Keys → Stripe)
Step 7: ✅ Test with card 4242 4242 4242 4242
Step 8: ✅ Verify in Stripe Dashboard
Step 9: ✅ Check webhook delivery
Step 10: ✅ Confirm in Admin Dashboard
```

---

## 🔧 **Troubleshooting:**

### **Issue: "Stripe is not configured"**
**Fix:** Make sure you added the Publishable Key in admin dashboard

### **Issue: "Webhook signature verification failed"**
**Fix:** 
- Make sure webhook secret starts with `whsec_`
- Use Stripe CLI for local testing
- Make sure backend is running on port 8000

### **Issue: "Payment succeeded but user not upgraded"**
**Fix:**
- Check backend logs for webhook events
- Verify webhook secret is correct
- Make sure `checkout.session.completed` event is enabled

### **Issue: "Price not found"**
**Fix:**
- Make sure you're using the Price ID (starts with `price_`)
- Not the Product ID (starts with `prod_`)
- Double-check it's from Test mode

---

## 📝 **Your Test Keys Checklist:**

Before proceeding, make sure you have:

```
✅ Secret Key (sk_test_...)
✅ Publishable Key (pk_test_...)
✅ Webhook Secret (whsec_...)
✅ Price ID (price_...)
```

---

## 🚀 **Next Step:**

**Ready to configure? Run this command to check your current setup:**

```powershell
# Check if your backend is running
curl http://localhost:8000/docs

# Check if admin dashboard is running
curl http://localhost:3002
```

---

## 💡 **Pro Tips:**

1. **Keep Stripe CLI running** during testing for webhook delivery
2. **Check both dashboards** (Admin + Stripe) to verify everything
3. **Test failure scenarios** (declined cards, cancellations)
4. **Export test data** before going live (Stripe doesn't migrate test to live)
5. **Use different test cards** to simulate various scenarios

---

## ✅ **When Ready for Production:**

1. Switch Stripe Dashboard to **Live mode**
2. Get **live keys** (sk_live_, pk_live_)
3. Create **live product** ($49/month)
4. Set up **live webhook** (with your production URL)
5. Update keys in **Admin Dashboard**
6. Test with a **real card** (charge $1 and refund to verify)

---

## 🎉 **You're Ready!**

Follow these steps and you'll have a fully working test subscription system!

**Questions? Issues? Let me know and I'll help you debug!** 🚀










