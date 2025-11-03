# ⚡ Stripe Test Mode - Quick Start (5 Minutes)

## 🎯 **Super Fast Setup:**

### **1️⃣ Get Your Keys (2 min)**

Visit: https://dashboard.stripe.com/test/apikeys

```
✅ Publishable Key:  pk_test_51...
✅ Secret Key:       sk_test_51...
```

---

### **2️⃣ Create Pro Product (1 min)**

Visit: https://dashboard.stripe.com/test/products/create

```
Name:    LinkedPilot Pro
Price:   $49.00
Period:  Monthly
```

Get your **Price ID**: `price_1...`

---

### **3️⃣ Set Up Webhook (1 min)**

**Option A - Local Testing (Easiest):**
```powershell
# Install Stripe CLI first (one-time)
stripe login
stripe listen --forward-to localhost:8000/api/billing/webhooks/stripe
```

Copy the **Webhook Secret**: `whsec_...`

**Option B - Skip for now** (set up later in production)

---

### **4️⃣ Add to Admin Dashboard (30 sec)**

1. Open: http://localhost:3002
2. Go to: **API Keys → Stripe**
3. Paste your 4 keys:
   ```
   Secret Key:        sk_test_...
   Publishable Key:   pk_test_...
   Webhook Secret:    whsec_...
   Price ID:          price_...
   ```
4. Click **"Save All Keys"**

---

### **5️⃣ Test It! (30 sec)**

1. Open: http://localhost:3000
2. Go to: **Settings → Billing & Usage**
3. Click: **"Upgrade to Pro"**
4. Use test card: `4242 4242 4242 4242`
5. Expiry: Any future date, CVC: Any 3 digits

---

## ✅ **Done! Check Results:**

**Admin Dashboard (http://localhost:3002):**
```
Active Subscriptions: 1 ✅
MRR: $49 ✅
```

**Stripe Dashboard (https://dashboard.stripe.com/test/payments):**
```
Payment: $49.00 ✅
```

---

## 🧪 **Test Cards:**

```
✅ Success:           4242 4242 4242 4242
❌ Declined:          4000 0000 0000 0002
💰 Insufficient:      4000 0000 0000 9995
```

---

## 🆘 **Quick Troubleshooting:**

**"Stripe is not configured"**
→ Add publishable key in admin dashboard

**"Webhook failed"**
→ Run `stripe listen` in terminal

**"User not upgraded"**
→ Check backend logs for webhook events

---

## 📋 **Your Keys Checklist:**

Before starting, get these 4 items:

```
□ sk_test_...     (Secret Key)
□ pk_test_...     (Publishable Key)
□ whsec_...       (Webhook Secret)
□ price_...       (Price ID)
```

---

## 🎯 **Visual Flow:**

```
User Dashboard → Click "Upgrade" → Stripe Checkout → Pay $49
              ↓
         Webhook Sent
              ↓
      Backend Updates User
              ↓
   Admin Dashboard Shows Stats
```

---

## 🚀 **Ready? Let's Go!**

Start here: https://dashboard.stripe.com/test/apikeys

**Time to complete: ~5 minutes** ⏱️










