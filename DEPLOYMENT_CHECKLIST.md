# ✅ Black Edge Deployment Checklist

Follow this step-by-step guide to deploy your application to production.

---

## 🎯 Phase 1: Preparation (5 minutes)

### ✅ Step 1: Gather Missing Credentials

- [ ] **Get your Polymarket Private Key**
  - Open your crypto wallet (MetaMask, Rabby, etc.)
  - Export private key (Settings → Security → Show Private Key)
  - ⚠️ This will be used to execute trades - keep it secret!
  - Store temporarily in a secure note

- [ ] **Create Stripe Subscription Prices**
  1. Go to https://dashboard.stripe.com/products
  2. Click **"+ Add product"**
  3. Create "Runner Tier":
     - Name: `Runner Tier`
     - Price: `$49.99`
     - Billing: `Recurring monthly`
     - Click **"Save product"**
     - Copy the **Price ID** (starts with `price_`)
  4. Create "Whale Tier":
     - Name: `Whale Tier`
     - Price: `$199.99`
     - Billing: `Recurring monthly`
     - Click **"Save product"**
     - Copy the **Price ID**

---

## 🖥️ Phase 2: Backend Deployment (10 minutes)

### ✅ Step 2: Create Render Account

- [ ] Go to https://render.com
- [ ] Sign up or log in
- [ ] Connect your GitHub account

### ✅ Step 3: Deploy Backend

- [ ] Click **"New +"** → **"Web Service"**
- [ ] Select your `windsurf-project` repository
- [ ] Configure:
  - **Name:** `blackedge-backend`
  - **Region:** Choose closest to your users
  - **Branch:** `main`
  - **Root Directory:** `backend`
  - **Runtime:** `Python 3`
  - **Build Command:** `pip install -r requirements.txt`
  - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
  - **Instance Type:** `Starter` ($7/month) or `Free`

### ✅ Step 4: Add Backend Environment Variables

Click **"Advanced"** → **"Environment Variables"**, then add these 8 variables:

```
RESEND_API_KEY=re_XXXX_YOUR_RESEND_KEY_HERE
```
```
CRYPTOPANIC_TOKEN=YOUR_CRYPTOPANIC_TOKEN_HERE
```
```
STRIPE_SECRET_KEY=sk_live_YOUR_STRIPE_SECRET_KEY_HERE
```
```
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY_HERE
```
```
POLYMARKET_PRIVATE_KEY=YOUR_PRIVATE_KEY_FROM_STEP_1
```
```
POLYMARKET_DRY_RUN=true
```
```
ENVIRONMENT=production
```
```
DEBUG=false
```

⚠️ Replace `YOUR_PRIVATE_KEY_FROM_STEP_1` with your actual private key!

### ✅ Step 5: Deploy Backend

- [ ] Click **"Create Web Service"**
- [ ] Wait for deployment (5-10 minutes)
- [ ] Copy your backend URL: `https://blackedge-backend-XXXX.onrender.com`
- [ ] Test it works:
  ```bash
  curl https://blackedge-backend-XXXX.onrender.com/health
  ```
  Should return: `{"status": "healthy"}`

---

## 🎨 Phase 3: Frontend Deployment (10 minutes)

### ✅ Step 6: Create Vercel Account

- [ ] Go to https://vercel.com
- [ ] Sign up or log in
- [ ] Connect your GitHub account

### ✅ Step 7: Deploy Frontend

- [ ] Click **"Add New..."** → **"Project"**
- [ ] Select your `windsurf-project` repository
- [ ] Configure:
  - **Framework Preset:** `Next.js` (auto-detected)
  - **Root Directory:** `frontend`
  - **Build Command:** `npm run build` (auto-detected)
- [ ] Click **"Configure Project"** (DON'T click "Deploy" yet!)

### ✅ Step 8: Add Frontend Environment Variables

Add these 7 variables (replace the placeholders with your actual values):

```
NEXT_PUBLIC_API_URL=https://YOUR_BACKEND_URL.onrender.com
```
⚠️ Replace with your actual Render URL from Step 5

```
NEXT_PUBLIC_WS_URL=wss://YOUR_BACKEND_URL.onrender.com/ws/stream
```
⚠️ Replace with your actual Render URL (note: wss:// not https://)

```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_STRIPE_PUBLISHABLE_KEY_HERE
```

```
STRIPE_SECRET_KEY=sk_live_YOUR_STRIPE_SECRET_KEY_HERE
```

```
NEXT_PUBLIC_STRIPE_PRICE_ID_RUNNER=price_XXXXX
```
⚠️ Replace with Runner price ID from Step 1

```
NEXT_PUBLIC_STRIPE_PRICE_ID_WHALE=price_XXXXX
```
⚠️ Replace with Whale price ID from Step 1

```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=demo
```

### ✅ Step 9: Deploy Frontend

- [ ] Click **"Deploy"**
- [ ] Wait for deployment (3-5 minutes)
- [ ] Copy your frontend URL: `https://your-project.vercel.app`

---

## 🧪 Phase 4: Testing (10 minutes)

### ✅ Step 10: Test Backend Endpoints

Open terminal and test these:

```bash
# Health check
curl https://YOUR_BACKEND_URL.onrender.com/health

# Markets endpoint
curl https://YOUR_BACKEND_URL.onrender.com/api/v2/markets

# Track record
curl https://YOUR_BACKEND_URL.onrender.com/api/v2/track-record
```

All should return JSON without errors.

### ✅ Step 11: Test Frontend

Visit your Vercel URL and test each page:

- [ ] **Landing Page** (`/`)
  - Hero section loads
  - Track record preview shows data
  - Live signals display
  - All animations work

- [ ] **Markets Page** (`/markets`)
  - Markets grid loads
  - Search works
  - Filters work
  - Categories work

- [ ] **Sports Page** (`/sports`)
  - Sports markets load
  - Cards display correctly

- [ ] **Crypto 5-min** (`/crypto5min`)
  - Crypto scanner loads
  - Data displays

- [ ] **Track Record** (`/track-record`)
  - Win rate displays
  - Recent predictions load
  - Statistics are correct

- [ ] **Pricing** (`/pricing`)
  - Pricing cards display
  - Stripe checkout works (test with test card)

- [ ] **Terminal** (`/terminal`)
  - WebSocket connects
  - Real-time data streams
  - No console errors

### ✅ Step 12: Check Logs

- [ ] **Render Logs:**
  - Go to Render dashboard → Your service → **"Logs"**
  - Check for any errors
  - Should see: `INFO: Application startup complete`

- [ ] **Vercel Logs:**
  - Go to Vercel dashboard → Your project → **"Functions"**
  - Check for any runtime errors

---

## 🔐 Phase 5: Security Check (5 minutes)

### ✅ Step 13: Verify Security Settings

- [ ] `POLYMARKET_DRY_RUN=true` is set (prevents real trades)
- [ ] Private keys are NOT in GitHub code
- [ ] All environment variables are set correctly
- [ ] HTTPS is working (should be automatic)
- [ ] CORS is configured correctly in backend

### ✅ Step 14: Test Stripe in Test Mode (Optional)

Before accepting real payments, test Stripe:

1. Use test card: `4242 4242 4242 4242`
2. Expiry: Any future date
3. CVC: Any 3 digits
4. ZIP: Any 5 digits

Should create a test subscription successfully.

---

## 🌐 Phase 6: Custom Domain (Optional - 30 minutes)

### ✅ Step 15: Setup Custom Domain

**For Frontend (blackedge.ai):**
1. Vercel → Your project → **"Settings"** → **"Domains"**
2. Add `blackedge.ai` and `www.blackedge.ai`
3. Update DNS records at your registrar:
   ```
   A     @     76.76.21.21
   CNAME www   cname.vercel-dns.com
   ```
4. Wait for DNS propagation (5-60 minutes)

**For Backend (api.blackedge.ai):**
1. Render → Your service → **"Settings"** → **"Custom Domains"**
2. Add `api.blackedge.ai`
3. Update DNS record:
   ```
   CNAME api YOUR_SERVICE.onrender.com
   ```
4. Update `NEXT_PUBLIC_API_URL` in Vercel to `https://api.blackedge.ai`
5. Redeploy frontend

---

## 📊 Phase 7: Monitoring (Ongoing)

### ✅ Step 16: Setup Monitoring

- [ ] **Uptime Monitoring:**
  - Use https://uptimerobot.com (free)
  - Monitor: `https://your-backend.onrender.com/health`
  - Get alerts if site goes down

- [ ] **Error Tracking:**
  - Check Render logs daily for errors
  - Check Vercel logs for frontend errors

- [ ] **Analytics:**
  - Add Google Analytics or Plausible to frontend
  - Track user behavior and conversions

---

## 🎉 Deployment Complete!

Your Black Edge application is now live in production!

**Live URLs:**
- Frontend: `https://your-project.vercel.app`
- Backend: `https://blackedge-backend.onrender.com`

### Next Steps:

1. Share your site with early users
2. Monitor logs for any issues
3. When ready for real trading, set `POLYMARKET_DRY_RUN=false`
4. Enable Stripe live mode for real payments
5. Consider upgrading to paid hosting for better performance

---

## 🆘 Troubleshooting

### Backend Issues

**"Build failed"**
- Check Python version in Render logs
- Verify `requirements.txt` is correct
- Check all imports are available

**"Service unavailable"**
- Check environment variables are set
- Verify private key is correct
- Check Render service logs

### Frontend Issues

**"Can't connect to backend"**
- Verify `NEXT_PUBLIC_API_URL` is correct
- Check backend is running (test health endpoint)
- Check CORS settings in backend

**"Stripe not working"**
- Verify price IDs are correct
- Check publishable key matches secret key
- Ensure Stripe is in live mode

**"WebSocket connection failed"**
- Check `NEXT_PUBLIC_WS_URL` has `wss://` protocol
- Verify backend WebSocket endpoint is running
- Check browser console for errors

---

## 📞 Support

Need help?
- Check logs in Render and Vercel
- Review `PRODUCTION_DEPLOYMENT.md` for details
- Test each endpoint individually
- Verify all environment variables are set

Good luck with your launch! 🚀
