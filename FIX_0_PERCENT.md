# 🚨 FIX: Site Stuck at 0% Loading

## ❌ Problem
Site builds successfully on Vercel but gets stuck at the 0% preloader screen.

## ✅ Root Cause
**NextAuth is missing critical environment variables**, causing SessionProvider to fail initialization, which prevents the page from hydrating correctly.

## 🔧 Quick Fix (5 minutes)

### Option 1: Automated Script (Recommended)

```bash
cd frontend
./fix-nextauth-env.sh
```

The script will:
1. Ask for your production URL (e.g., `https://black-edge-peach.vercel.app`)
2. Generate a secure `NEXTAUTH_SECRET`
3. Optionally add Google OAuth credentials
4. Add everything to Vercel

Then deploy:
```bash
git commit --allow-empty -m "Fix NextAuth configuration"
git push
```

### Option 2: Manual via Vercel Dashboard

1. **Go to Vercel Dashboard**
   - https://vercel.com/dashboard
   - Select your project → Settings → Environment Variables

2. **Add NEXTAUTH_URL**
   - Key: `NEXTAUTH_URL`
   - Value: Your production URL (e.g., `https://black-edge-peach.vercel.app`)
   - Environment: Production, Preview

3. **Add NEXTAUTH_SECRET**
   - Key: `NEXTAUTH_SECRET`
   - Value: Generate one with: `openssl rand -base64 32`
   - Environment: Production, Preview

4. **Add Google OAuth (optional)**
   - Key: `GOOGLE_CLIENT_ID`
   - Value: Get from https://console.cloud.google.com/apis/credentials
   - Environment: Production, Preview

   - Key: `GOOGLE_CLIENT_SECRET`
   - Value: From Google Cloud Console
   - Environment: Production, Preview

5. **Redeploy**
   ```bash
   git commit --allow-empty -m "Trigger rebuild"
   git push
   ```

### Option 3: Via Vercel CLI

```bash
# Login to Vercel
vercel login

# Add NEXTAUTH_URL
vercel env add NEXTAUTH_URL production preview
# Enter: https://black-edge-peach.vercel.app

# Generate and add NEXTAUTH_SECRET
openssl rand -base64 32 | vercel env add NEXTAUTH_SECRET production preview

# Optional: Add Google OAuth
vercel env add GOOGLE_CLIENT_ID production preview
vercel env add GOOGLE_CLIENT_SECRET production preview

# Redeploy
vercel --prod
```

---

## 📋 Complete Environment Variables Checklist

### 🔴 CRITICAL (Site won't load without these)
- [x] `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` - Already configured
- [ ] **`NEXTAUTH_URL`** ← MISSING (causes 0% freeze)
- [ ] **`NEXTAUTH_SECRET`** ← MISSING (causes 0% freeze)

### 🟡 IMPORTANT (Features won't work)
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - For payments
- [ ] `NEXT_PUBLIC_STRIPE_RUNNER_PRICE_ID` - Runner tier pricing
- [ ] `NEXT_PUBLIC_STRIPE_WHALE_PRICE_ID` - Whale tier pricing
- [ ] `STRIPE_SECRET_KEY` - Backend Stripe operations
- [ ] `NEXT_PUBLIC_ADMIN_WALLET_ADDRESS` - Admin access

### 🟢 OPTIONAL (Nice to have)
- [ ] `GOOGLE_CLIENT_ID` - Google OAuth
- [ ] `GOOGLE_CLIENT_SECRET` - Google OAuth
- [ ] `NEXT_PUBLIC_SENTRY_DSN` - Error tracking
- [ ] `SENTRY_AUTH_TOKEN` - Sentry source maps

---

## 🧪 How to Test After Fix

### 1. Check Build Logs
```bash
# Watch Vercel deployment
vercel logs --follow
```

### 2. Test the Site
1. Open: `https://black-edge-peach.vercel.app`
2. **Site should now load past 0%** ✅
3. Open DevTools (F12) → Console tab
4. Should see no red errors

### 3. Test Authentication
1. Click "SIGN UP" or "LOG IN"
2. Modal should open
3. Google sign-in should work (if configured)

### 4. Test Wallet Connection
1. Click "Connect Wallet"
2. RainbowKit modal should open
3. Should be able to connect MetaMask/WalletConnect

---

## 🔍 Why This Fixes the 0% Issue

**Technical Explanation:**

1. **Before Fix:**
   ```
   SessionProvider initializes → NextAuth has no URL/SECRET
   → NextAuth fails silently
   → SessionProvider doesn't provide context
   → useSession() returns undefined
   → React hydration fails
   → useEffect never runs
   → Preloader stuck at 0%
   ```

2. **After Fix:**
   ```
   SessionProvider initializes → NextAuth configured properly
   → SessionProvider provides valid context
   → useSession() works correctly
   → React hydrates successfully
   → useEffect runs
   → Preloader animates 0% → 100%
   → Site loads normally ✅
   ```

---

## 📞 Still Stuck?

If site still doesn't load after adding these variables:

1. **Check Vercel Runtime Logs:**
   ```bash
   vercel logs <deployment-url> --follow
   ```

2. **Check Browser Console:**
   - Open DevTools (F12)
   - Look for errors in Console tab
   - Look for failed requests in Network tab

3. **Verify Variables:**
   ```bash
   vercel env ls
   ```

4. **Force Clean Rebuild:**
   - Vercel Dashboard → Deployments
   - Click "..." → Redeploy
   - **Uncheck** "Use existing Build Cache"

---

## ⏱️ Estimated Time to Fix

- **Automated script:** 2-3 minutes
- **Manual via Dashboard:** 5 minutes
- **Rebuild time:** 2-3 minutes
- **Total:** ~5-10 minutes

---

## ✅ Success Indicators

After the fix, you should see:
- ✅ Site loads past 0% preloader
- ✅ Preloader animates from 0% → 100%
- ✅ Homepage appears after ~2 seconds
- ✅ No errors in browser console
- ✅ "SIGN UP" / "LOG IN" buttons work
- ✅ Wallet connection works

---

**Note:** The build was already succeeding - this was a **runtime configuration issue**, not a code issue. Adding these environment variables fixes the client-side JavaScript initialization.
