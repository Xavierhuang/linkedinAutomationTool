# 🎯 Stripe API Management - Complete Guide

## ✅ **What Was Added:**

### **Admin Dashboard → API Keys → Stripe Tab**

Your admin dashboard now has a **7th tab** for Stripe configuration:

```
[OpenAI] [Google AI] [LinkedIn] [Unsplash] [Pexels] [Canva] [🆕 Stripe]
```

---

## 🔑 **Stripe Keys You'll Manage:**

### **1. Secret Key** (`stripe_secret_key`)
- **Format:** `sk_live_...` (production) or `sk_test_...` (testing)
- **Used by:** Backend for creating checkout sessions, managing subscriptions
- **Where:** Stripe Dashboard → Developers → API keys
- **Security:** NEVER exposed to frontend

### **2. Publishable Key** (`stripe_publishable_key`)
- **Format:** `pk_live_...` (production) or `pk_test_...` (testing)  
- **Used by:** Frontend to initialize Stripe.js
- **Where:** Stripe Dashboard → Developers → API keys
- **Security:** Safe to expose (public key)

### **3. Webhook Secret** (`stripe_webhook_secret`)
- **Format:** `whsec_...`
- **Used by:** Backend to verify webhook authenticity
- **Where:** Stripe Dashboard → Developers → Webhooks
- **Security:** Required for secure webhook handling

### **4. Pro Plan Price ID** (`stripe_pro_price_id`)
- **Format:** `price_...`
- **Used by:** Backend/Frontend to reference the Pro subscription
- **Where:** Stripe Dashboard → Products → Your Pro Plan
- **Security:** Not secret, but specific to your product

---

## 🚀 **How to Get Stripe Keys:**

### **Step 1: Create Stripe Account**
1. Go to https://stripe.com
2. Sign up / Log in
3. Complete account verification

### **Step 2: Get API Keys**
1. Navigate to **Developers → API keys**
2. Copy your **Publishable key** (starts with `pk_`)
3. Reveal and copy your **Secret key** (starts with `sk_`)
4. Toggle between **Test mode** and **Live mode** as needed

**Test Mode:**
- Use test keys (`sk_test_`, `pk_test_`) during development
- No real charges
- Use test card: `4242 4242 4242 4242`

**Live Mode:**
- Use live keys (`sk_live_`, `pk_live_`) in production
- Real charges
- Real credit cards

### **Step 3: Create a Product (Pro Plan)**
1. Go to **Products** in Stripe Dashboard
2. Click **Add product**
3. Configure:
   - **Name:** LinkedPilot Pro
   - **Description:** Pro tier with unlimited features
   - **Pricing:** $49/month (recurring)
   - **Billing period:** Monthly
4. Click **Save product**
5. Copy the **Price ID** (starts with `price_...`)

### **Step 4: Set Up Webhook**
1. Go to **Developers → Webhooks**
2. Click **Add endpoint**
3. **Endpoint URL:** `https://your-domain.com/api/billing/webhooks/stripe`
   - For testing: `https://yourdomain.com/api/billing/webhooks/stripe`
   - For production: Use your production URL
4. **Events to listen to:**
   ```
   checkout.session.completed
   customer.subscription.updated
   customer.subscription.deleted
   invoice.payment_succeeded
   invoice.payment_failed
   ```
5. Click **Add endpoint**
6. Reveal and copy the **Signing secret** (starts with `whsec_...`)

---

## 📊 **How It Works:**

### **Architecture:**

```
┌─────────────────────────────────────────────────┐
│  ADMIN DASHBOARD (You)                          │
│  Configure Stripe keys once                     │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  MONGODB (Encrypted Storage)                    │
│  system_settings.api_keys                       │
│  ├─ stripe_secret_key (encrypted)               │
│  ├─ stripe_publishable_key (encrypted)          │
│  ├─ stripe_webhook_secret (encrypted)           │
│  └─ stripe_pro_price_id (encrypted)             │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  BACKEND API                                    │
│  ├─ Reads encrypted keys from MongoDB           │
│  ├─ Decrypts them                               │
│  ├─ Uses for Stripe operations                  │
│  └─ Verifies webhook signatures                 │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  USER DASHBOARD                                 │
│  ├─ Clicks "Upgrade to Pro"                     │
│  ├─ Frontend gets publishable key from backend  │
│  ├─ Stripe.js redirects to Checkout             │
│  ├─ User pays                                   │
│  └─ Webhook updates subscription in MongoDB     │
└─────────────────────────────────────────────────┘
```

### **User Upgrade Flow:**

1. **User clicks "Upgrade to Pro"** in main app
2. **Frontend calls:** `POST /api/billing/create-checkout-session`
3. **Backend:**
   - Reads Stripe keys from MongoDB (decrypted)
   - Creates Stripe checkout session
   - Returns session ID
4. **Frontend:**
   - Initializes Stripe.js with publishable key
   - Redirects user to Stripe Checkout
5. **User completes payment** on Stripe's secure page
6. **Stripe sends webhook:** `checkout.session.completed`
7. **Backend webhook handler:**
   - Verifies signature using webhook secret
   - Updates user's subscription in MongoDB
   - Activates Pro features
8. **User returns to app** with Pro access!

---

## 🛠️ **How to Configure in Admin Dashboard:**

### **Step 1: Log into Admin Dashboard**
1. Go to http://localhost:3002 (or https://admin.mandi.media in production)
2. **Log out** if already logged in (to get fresh admin token)
3. **Log back in** with your admin credentials

### **Step 2: Navigate to API Keys**
1. Click **"API Keys"** in sidebar (3rd item)
2. Click the **"Stripe"** tab

### **Step 3: Enter Your Stripe Keys**
```
┌──────────────────────────────────────────────────┐
│ Stripe                                           │
│ Payment processing and subscriptions             │
│                                                  │
│ Secret Key:                                      │
│ [sk_test_...••••••••••••••••••••] 👁             │
│                                                  │
│ Publishable Key:                                 │
│ [pk_test_...••••••••••••••••••••] 👁             │
│                                                  │
│ Webhook Secret:                                  │
│ [whsec_...••••••••••••••••••••••] 👁             │
│                                                  │
│ Pro Plan Price ID:                               │
│ [price_...••••••••••••••••••••••] 👁             │
│                                                  │
│ 💡 Visit Stripe Dashboard →                      │
└──────────────────────────────────────────────────┘
```

### **Step 4: Save**
Click **"Save All Keys"** button at the bottom

---

## 🔐 **Security:**

### **Encryption:**
- All Stripe keys are encrypted with **Fernet (AES-128)** before storage
- Encryption key derived from `JWT_SECRET_KEY`
- Same encryption as other system keys

### **Access Control:**
- Only **admins** can view/edit Stripe keys
- Requires **admin JWT token**
- Activity logged to `admin_activity_logs`

### **Best Practices:**
1. ✅ **Start with test keys** during development
2. ✅ **Switch to live keys** only in production
3. ✅ **Never commit keys** to Git
4. ✅ **Rotate keys** if compromised
5. ✅ **Monitor webhook events** in Stripe Dashboard
6. ✅ **Use HTTPS** for webhook endpoints (required by Stripe)

---

## 🧪 **Testing:**

### **Test Mode Configuration:**
```
Secret Key: sk_test_51ABC...
Publishable Key: pk_test_51ABC...
Webhook Secret: whsec_test123...
Price ID: price_test123...
```

### **Test Cards:**
```
Success: 4242 4242 4242 4242 (any future date, any CVC)
Decline: 4000 0000 0000 0002
3D Secure: 4000 0027 6000 3184
```

### **Test Flow:**
1. Configure test keys in admin dashboard
2. User dashboard → Billing → Upgrade to Pro
3. Use test card: `4242 4242 4242 4242`
4. Check MongoDB for updated subscription
5. Verify webhook received in Stripe Dashboard

---

## 🎯 **Production Checklist:**

### **Before Going Live:**
- [ ] Create Stripe account (verified)
- [ ] Create Pro product ($49/month)
- [ ] Get live API keys (`sk_live_`, `pk_live_`)
- [ ] Set up webhook endpoint (HTTPS required)
- [ ] Get webhook secret (`whsec_...`)
- [ ] Configure all 4 keys in admin dashboard
- [ ] Test with real card (small amount)
- [ ] Verify webhook delivery
- [ ] Check subscription created in Stripe
- [ ] Check user upgraded in MongoDB
- [ ] Monitor Stripe Dashboard for events

---

## 📊 **What Users See:**

### **Free Tier:**
- Limited AI tokens (1,000/month)
- Limited posts (50/month)
- Basic features

### **Pro Tier ($49/month):**
- Unlimited AI tokens (10,000/month)
- Unlimited posts
- All features
- Priority support

### **Upgrade Button:**
```
┌──────────────────────────────────────────┐
│  Upgrade to Pro                          │
│  $49/month                               │
│  ✓ Unlimited AI content                 │
│  ✓ Unlimited posts                       │
│  ✓ All features                          │
│                                          │
│  [Upgrade Now →]                         │
└──────────────────────────────────────────┘
```

### **After Clicking:**
1. Redirected to Stripe Checkout (secure)
2. Enter card details
3. Complete payment
4. Redirected back to app
5. Pro features activated immediately!

---

## 🔄 **Subscription Management:**

### **What Stripe Handles Automatically:**
- ✅ Monthly recurring billing
- ✅ Failed payment retries
- ✅ Card expiration notifications
- ✅ Subscription cancellation
- ✅ Prorated upgrades/downgrades
- ✅ Invoice generation
- ✅ Receipt emails

### **What Your Backend Handles:**
- ✅ Creating checkout sessions
- ✅ Processing webhook events
- ✅ Updating user's subscription status in MongoDB
- ✅ Activating/deactivating Pro features
- ✅ Tracking usage limits

---

## 💡 **Common Issues:**

### **Issue 1: "Stripe is not configured"**
**Cause:** Missing publishable key  
**Fix:** Add `stripe_publishable_key` in admin dashboard

### **Issue 2: "Webhook signature verification failed"**
**Cause:** Wrong webhook secret  
**Fix:** Copy correct `whsec_...` from Stripe Dashboard → Webhooks

### **Issue 3: "Price not found"**
**Cause:** Wrong price ID  
**Fix:** Copy correct `price_...` from Stripe Dashboard → Products

### **Issue 4: "Test mode mismatch"**
**Cause:** Using test key with live price ID (or vice versa)  
**Fix:** Ensure all keys are from same mode (test or live)

---

## 📝 **Summary:**

### **What You Need to Do:**
1. ✅ Create Stripe account
2. ✅ Get 4 keys from Stripe Dashboard
3. ✅ Configure in Admin Dashboard → API Keys → Stripe
4. ✅ Save
5. ✅ Test upgrade flow

### **What Users Experience:**
1. Click "Upgrade to Pro"
2. Pay on Stripe (secure)
3. Get instant Pro access
4. Enjoy unlimited features!

### **What Happens Behind the Scenes:**
1. System reads your Stripe keys (encrypted)
2. Creates checkout session
3. Processes webhook
4. Updates user's subscription
5. Activates Pro features

---

## 🎉 **You're All Set!**

Your Stripe integration is now fully managed through the admin dashboard!

**Next Steps:**
1. Log into admin dashboard
2. Navigate to API Keys → Stripe tab
3. Enter your Stripe keys
4. Test with test mode first
5. Switch to live mode when ready
6. Monitor subscriptions in Stripe Dashboard

**Need Help?**
- Stripe Docs: https://stripe.com/docs
- Test Cards: https://stripe.com/docs/testing
- Webhooks: https://stripe.com/docs/webhooks

---

**Everything is encrypted, secure, and ready to go!** 🚀










