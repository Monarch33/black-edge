# 🚀 Production Deployment Guide

## ✅ Pre-Deployment Checklist

- [x] Code pushed to GitHub (commit b025b3e)
- [x] API keys collected
- [ ] Polymarket private key ready
- [ ] Stripe price IDs created
- [ ] Backend deployed to Render
- [ ] Frontend deployed to Vercel

---

## 📦 BACKEND DEPLOYMENT (Render)

### Step 1: Create New Web Service

1. Go to https://render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Select: `windsurf-project` repo

### Step 2: Configure Service

**Basic Settings:**
- Name: `blackedge-backend`
- Region: Choose closest to your users
- Branch: `main`
- Root Directory: `backend`
- Runtime: `Python 3`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

**Instance Type:**
- Start with **Starter** ($7/month) or **Free** tier

### Step 3: Environment Variables

Copy and paste these environment variables into Render:

```env
# API Keys
RESEND_API_KEY=re_XXXX_YOUR_RESEND_KEY_HERE
CRYPTOPANIC_TOKEN=YOUR_CRYPTOPANIC_TOKEN_HERE
STRIPE_SECRET_KEY=sk_live_YOUR_STRIPE_SECRET_KEY_HERE

# Blockchain RPC (Alchemy)
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY_HERE

# Polymarket Trading (⚠️ REQUIRED - Add your private key)
POLYMARKET_PRIVATE_KEY=YOUR_PRIVATE_KEY_HERE
POLYMARKET_DRY_RUN=true

# Application Settings
ENVIRONMENT=production
DEBUG=false
```

**⚠️ CRITICAL:** You need to add your Polymarket private key to `POLYMARKET_PRIVATE_KEY`. This is the Ethereum wallet private key that will be used to execute trades on Polymarket.

### Step 4: Deploy

1. Click **"Create Web Service"**
2. Wait for deployment (5-10 minutes)
3. Copy your backend URL: `https://blackedge-backend.onrender.com`

---

## 🎨 FRONTEND DEPLOYMENT (Vercel)

### Step 1: Create New Project

1. Go to https://vercel.com
2. Click **"Add New..."** → **"Project"**
3. Import your `windsurf-project` repository
4. Select the repository

### Step 2: Configure Project

**Framework Preset:** Next.js (auto-detected)

**Root Directory:** `frontend`

**Build Settings:**
- Build Command: `npm run build` (auto-detected)
- Output Directory: `.next` (auto-detected)
- Install Command: `npm install` (auto-detected)

### Step 3: Environment Variables

**After backend is deployed**, add these environment variables in Vercel:

```env
# Backend API Connection (⚠️ Use your actual Render URL)
NEXT_PUBLIC_API_URL=https://blackedge-backend.onrender.com
NEXT_PUBLIC_WS_URL=wss://blackedge-backend.onrender.com/ws/stream

# Stripe (Frontend)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_STRIPE_PUBLISHABLE_KEY_HERE

# Stripe (Backend API Route)
STRIPE_SECRET_KEY=sk_live_YOUR_STRIPE_SECRET_KEY_HERE

# Stripe Price IDs (⚠️ Create these in Stripe Dashboard first)
NEXT_PUBLIC_STRIPE_PRICE_ID_RUNNER=price_XXXXXXXXXXXXX
NEXT_PUBLIC_STRIPE_PRICE_ID_WHALE=price_XXXXXXXXXXXXX

# Optional: WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=demo
```

### Step 4: Create Stripe Price IDs

Before deploying, create subscription prices in Stripe:

1. Go to https://dashboard.stripe.com/products
2. Create **"Runner"** plan:
   - Name: "Runner Tier"
   - Price: $49.99/month
   - Copy the price ID (starts with `price_`)
3. Create **"Whale"** plan:
   - Name: "Whale Tier"
   - Price: $199.99/month
   - Copy the price ID
4. Update the environment variables above with real price IDs

### Step 5: Deploy

1. Click **"Deploy"**
2. Wait for deployment (3-5 minutes)
3. Your site will be live at: `https://your-project.vercel.app`

---

## 🔐 Security Checklist

- [ ] `POLYMARKET_DRY_RUN=true` is set (prevents accidental real trades)
- [ ] All API keys are in environment variables (not in code)
- [ ] Stripe is in LIVE mode (using pk_live/sk_live keys)
- [ ] CORS is properly configured in backend
- [ ] HTTPS is enabled (automatic on Render/Vercel)

---

## 🧪 Testing Your Production Deployment

### 1. Test Backend

```bash
# Health check
curl https://blackedge-backend.onrender.com/health

# Get markets
curl https://blackedge-backend.onrender.com/api/v2/markets

# Get track record
curl https://blackedge-backend.onrender.com/api/v2/track-record
```

### 2. Test Frontend

1. Visit your Vercel URL
2. Check all pages load:
   - Landing page: `/`
   - Markets: `/markets`
   - Sports: `/sports`
   - Crypto 5-min: `/crypto5min`
   - Track Record: `/track-record`
   - Pricing: `/pricing`
3. Test WebSocket connection (Terminal view should show live data)
4. Test Stripe checkout flow

### 3. Monitor Logs

**Render (Backend):**
- Go to your service → **"Logs"** tab
- Check for errors or warnings

**Vercel (Frontend):**
- Go to your project → **"Functions"** tab
- Check for runtime errors

---

## 🌐 Custom Domain Setup (Optional)

### For Frontend (Vercel)

1. Go to your project → **"Settings"** → **"Domains"**
2. Add `blackedge.ai`
3. Add DNS records (provided by Vercel):
   ```
   A     @     76.76.21.21
   CNAME www   cname.vercel-dns.com
   ```

### For Backend (Render)

1. Go to your service → **"Settings"** → **"Custom Domains"**
2. Add `api.blackedge.ai`
3. Add DNS record:
   ```
   CNAME api your-service.onrender.com
   ```
4. Update `NEXT_PUBLIC_API_URL` in Vercel to `https://api.blackedge.ai`

---

## 📊 Environment Variables Summary

### Backend (Render) - 9 Variables

| Variable | Value | Required |
|----------|-------|----------|
| `RESEND_API_KEY` | re_TuHu3FWk_... | ✅ Yes |
| `CRYPTOPANIC_TOKEN` | 4fea200010d9da... | ✅ Yes |
| `STRIPE_SECRET_KEY` | sk_live_51SxX7s... | ✅ Yes |
| `POLYGON_RPC_URL` | https://polygon-mainnet.g.alchemy.com/v2/... | ✅ Yes |
| `POLYMARKET_PRIVATE_KEY` | YOUR_PRIVATE_KEY | ✅ Yes |
| `POLYMARKET_DRY_RUN` | true | ✅ Yes |
| `ENVIRONMENT` | production | ✅ Yes |
| `DEBUG` | false | Optional |

### Frontend (Vercel) - 7 Variables

| Variable | Value | Required |
|----------|-------|----------|
| `NEXT_PUBLIC_API_URL` | https://blackedge-backend.onrender.com | ✅ Yes |
| `NEXT_PUBLIC_WS_URL` | wss://blackedge-backend.onrender.com/ws/stream | ✅ Yes |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | pk_live_51SxX7s... | ✅ Yes |
| `STRIPE_SECRET_KEY` | sk_live_51SxX7s... | ✅ Yes |
| `NEXT_PUBLIC_STRIPE_PRICE_ID_RUNNER` | price_XXXXX | ✅ Yes |
| `NEXT_PUBLIC_STRIPE_PRICE_ID_WHALE` | price_XXXXX | ✅ Yes |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | demo | Optional |

---

## ⚠️ IMPORTANT NOTES

1. **Polymarket Private Key:** You must add your Ethereum wallet private key to trade on Polymarket. Keep this secret and never commit it to GitHub.

2. **DRY_RUN Mode:** The backend is configured with `POLYMARKET_DRY_RUN=true` to prevent accidental real trades. Only set this to `false` when you're ready to execute real trades.

3. **Stripe Prices:** You need to create subscription products in the Stripe Dashboard and copy the price IDs.

4. **First Deploy May Be Slow:** Render's free/starter tier spins down after 15 minutes of inactivity. First request may take 30-60 seconds to wake up.

5. **Render Free Tier Limits:**
   - Service spins down after 15 min inactivity
   - 750 hours/month free usage
   - Consider upgrading to Starter ($7/mo) for 24/7 uptime

---

## 🆘 Troubleshooting

### Backend won't start

1. Check Render logs for errors
2. Verify all environment variables are set
3. Ensure Python dependencies installed correctly

### Frontend can't connect to backend

1. Verify `NEXT_PUBLIC_API_URL` is correct
2. Check CORS settings in backend `main.py`
3. Test backend health endpoint directly

### Stripe checkout not working

1. Verify price IDs are correct
2. Check both publishable and secret keys are set
3. Ensure Stripe is in LIVE mode

### WebSocket connection fails

1. Check `NEXT_PUBLIC_WS_URL` is correct
2. Verify backend WebSocket endpoint is running
3. Test with `wscat -c wss://your-backend.onrender.com/ws/stream`

---

## 📞 Next Steps

1. ✅ Deploy backend to Render with environment variables
2. ✅ Deploy frontend to Vercel with environment variables
3. ✅ Create Stripe subscription prices
4. ✅ Test the full application flow
5. ✅ Monitor logs for any issues
6. 🎉 Share your live site!

**Your production site will be live at:**
- Frontend: `https://your-project.vercel.app`
- Backend API: `https://blackedge-backend.onrender.com`

Good luck with your deployment! 🚀
