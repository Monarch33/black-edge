# ✅ Vercel Environment Variables - Setup Complete

## Already Added ✓

The following environment variables have been automatically added to Vercel:

```bash
✅ NEXT_PUBLIC_API_URL
   = https://black-edge-backend-production-e616.up.railway.app

✅ NEXT_PUBLIC_WS_URL
   = wss://black-edge-backend-production-e616.up.railway.app/ws/stream

✅ NEXT_PUBLIC_POLYMARKET_API
   = https://gamma-api.polymarket.com

✅ NEXT_PUBLIC_VERCEL_ANALYTICS_ID
   = auto

✅ NEXTAUTH_SECRET
   = [auto-generated secure secret]
```

---

## 🔐 Still Need to Add (Sensitive Keys)

You need to add these manually in the **Vercel Dashboard** or use the provided script.

### Method 1: Vercel Dashboard (Recommended)

1. Go to: https://vercel.com/finas-projects-31356a2e/frontend/settings/environment-variables

2. Add each variable below:

#### **Sentry (Error Tracking)**
```
NEXT_PUBLIC_SENTRY_DSN
SENTRY_AUTH_TOKEN
```
Get these from: https://sentry.io/settings/black-edge/projects/

#### **Stripe (Payments)**
```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_RUNNER_PRICE_ID
NEXT_PUBLIC_STRIPE_WHALE_PRICE_ID
```
Get these from: https://dashboard.stripe.com/apikeys

#### **Firebase (Authentication)**
```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```
Get these from: https://console.firebase.google.com/project/YOUR_PROJECT/settings/general

#### **NEXTAUTH_URL (Your Production URL)**
```
NEXTAUTH_URL = https://your-app.vercel.app
```
Replace with your actual Vercel production URL

---

### Method 2: Use the Script

Run the interactive script to add all variables:

```bash
cd frontend
./setup-vercel-env.sh
```

This will prompt you for each value and add them automatically.

---

### Method 3: Vercel CLI (One by One)

```bash
cd frontend

# Sentry
echo "your_sentry_dsn" | vercel env add NEXT_PUBLIC_SENTRY_DSN production
echo "your_sentry_token" | vercel env add SENTRY_AUTH_TOKEN production

# Stripe
echo "pk_live_xxx" | vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
echo "sk_live_xxx" | vercel env add STRIPE_SECRET_KEY production
echo "whsec_xxx" | vercel env add STRIPE_WEBHOOK_SECRET production
echo "price_xxx" | vercel env add NEXT_PUBLIC_STRIPE_RUNNER_PRICE_ID production
echo "price_xxx" | vercel env add NEXT_PUBLIC_STRIPE_WHALE_PRICE_ID production

# Firebase
echo "your_api_key" | vercel env add NEXT_PUBLIC_FIREBASE_API_KEY production
echo "your-project.firebaseapp.com" | vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN production
echo "your_project_id" | vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID production
echo "your-project.appspot.com" | vercel env add NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET production
echo "your_sender_id" | vercel env add NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID production
echo "your_app_id" | vercel env add NEXT_PUBLIC_FIREBASE_APP_ID production

# NextAuth URL
echo "https://your-app.vercel.app" | vercel env add NEXTAUTH_URL production
```

---

## 📋 Optional Variables

These are optional but recommended:

```bash
# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

# Alchemy RPC
NEXT_PUBLIC_ALCHEMY_ID

# Admin Access
NEXT_PUBLIC_ADMIN_WALLET_ADDRESS
```

---

## 🔍 Verify Setup

Check which variables are set:

```bash
cd frontend
vercel env ls
```

---

## 🚀 Deploy After Adding Variables

Once all variables are added, trigger a new deployment:

```bash
cd frontend
vercel --prod
```

Or wait for automatic deployment from GitHub push.

---

## ✅ Checklist

### Required for Launch:
- [x] ~~NEXT_PUBLIC_API_URL~~ (added)
- [x] ~~NEXT_PUBLIC_WS_URL~~ (added)
- [x] ~~NEXT_PUBLIC_POLYMARKET_API~~ (added)
- [x] ~~NEXTAUTH_SECRET~~ (added)
- [ ] NEXTAUTH_URL (add your production URL)
- [ ] Sentry variables (for error tracking)
- [ ] Stripe variables (for payments)
- [ ] Firebase variables (for auth)

### Optional:
- [ ] WalletConnect Project ID
- [ ] Alchemy API Key
- [ ] Admin Wallet Address

---

## 📍 Quick Links

- **Vercel Dashboard:** https://vercel.com/finas-projects-31356a2e/frontend
- **Environment Variables:** https://vercel.com/finas-projects-31356a2e/frontend/settings/environment-variables
- **Sentry Dashboard:** https://sentry.io/settings/
- **Stripe Dashboard:** https://dashboard.stripe.com/
- **Firebase Console:** https://console.firebase.google.com/

---

## 🆘 Need Help?

If you encounter issues:

1. Check the Vercel CLI is logged in: `vercel whoami`
2. Verify project is linked: `ls -la frontend/.vercel`
3. List current env vars: `vercel env ls`
4. Check build logs: `vercel logs`

---

**Status:** ✅ Core variables added, sensitive keys need manual setup
**Next:** Add Sentry, Stripe, and Firebase keys to complete the setup
