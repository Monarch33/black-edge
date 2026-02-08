# Black Edge - Deployment Guide

## 📋 Table of Contents
- [Frontend Deployment (Vercel)](#frontend-deployment-vercel)
- [Backend Deployment (Docker)](#backend-deployment-docker)
- [Environment Variables](#environment-variables)
- [Security Checklist](#security-checklist)
- [Testing](#testing)

---

## 🌐 Frontend Deployment (Vercel)

### Prerequisites
- Vercel account
- GitHub repository connected to Vercel
- Environment variables configured

### Setup Steps

1. **Install Vercel CLI** (optional for local testing)
   ```bash
   npm install -g vercel
   ```

2. **Configure Environment Variables in Vercel Dashboard**

   Navigate to Project Settings → Environment Variables and add:

   ```
   NEXT_PUBLIC_API_URL=https://api.blackedge.io
   NEXT_PUBLIC_WS_URL=wss://api.blackedge.io/ws
   NEXT_PUBLIC_POLYMARKET_API=https://gamma-api.polymarket.com
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
   NEXT_PUBLIC_ALCHEMY_ID=your_alchemy_api_key
   NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
   STRIPE_SECRET_KEY=sk_live_xxx
   ```

3. **Deploy to Vercel**

   **Option A: Automatic (via GitHub)**
   - Push to main branch
   - Vercel will auto-deploy

   **Option B: Manual (via CLI)**
   ```bash
   cd frontend
   vercel --prod
   ```

4. **Verify Deployment**
   - Check build logs in Vercel dashboard
   - Visit your production URL
   - Test wallet connection and API endpoints

### Troubleshooting

**Build Errors with Turbopack:**
If you encounter turbopack errors, try:
```bash
# Use webpack instead of turbopack
NEXT_PRIVATE_DISABLE_TURBOPACK=1 npm run build
```

Or update `next.config.js` to disable turbopack.

---

## 🐳 Backend Deployment (Docker)

### Local Development with Docker Compose

1. **Copy environment file**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your actual values
   ```

2. **Build and run services**
   ```bash
   cd ..  # back to project root
   docker-compose up --build
   ```

   This starts:
   - Backend FastAPI (port 8000)
   - Redis cache (port 6379)

3. **Verify backend is running**
   ```bash
   curl http://localhost:8000/health
   # Should return: {"status": "healthy"}
   ```

### Production Deployment

#### Option A: Docker Compose (VPS/EC2)

1. **Deploy to server**
   ```bash
   scp -r . user@your-server:/opt/blackedge
   ssh user@your-server
   cd /opt/blackedge
   ```

2. **Configure environment**
   ```bash
   cd backend
   nano .env  # Set production values
   ```

3. **Start services**
   ```bash
   docker-compose up -d
   ```

4. **Setup Nginx reverse proxy** (recommended)
   ```nginx
   server {
       listen 80;
       server_name api.blackedge.io;

       location / {
           proxy_pass http://localhost:8000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

5. **Setup SSL with Certbot**
   ```bash
   sudo certbot --nginx -d api.blackedge.io
   ```

#### Option B: Container Registry (AWS ECS, GCP Cloud Run, etc.)

1. **Build and tag image**
   ```bash
   cd backend
   docker build -t blackedge-backend:latest .
   ```

2. **Push to registry**
   ```bash
   # AWS ECR
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com
   docker tag blackedge-backend:latest YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/blackedge-backend:latest
   docker push YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/blackedge-backend:latest

   # Google Cloud
   gcloud auth configure-docker
   docker tag blackedge-backend:latest gcr.io/YOUR_PROJECT/blackedge-backend:latest
   docker push gcr.io/YOUR_PROJECT/blackedge-backend:latest
   ```

3. **Deploy to container service**
   - Follow platform-specific instructions (ECS task definition, Cloud Run service, etc.)

#### Option C: Railway / Render

Both platforms support Docker deployments:

1. **Connect GitHub repository**
2. **Select `backend` directory as root**
3. **Configure environment variables in dashboard**
4. **Deploy**

---

## 🔐 Environment Variables

### Frontend (.env.local)

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | Yes | `https://api.blackedge.io` |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL | Yes | `wss://api.blackedge.io/ws` |
| `NEXT_PUBLIC_POLYMARKET_API` | Polymarket API | Yes | `https://gamma-api.polymarket.com` |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect ID | Yes | From walletconnect.com |
| `NEXT_PUBLIC_ALCHEMY_ID` | Alchemy API key | Yes | From alchemy.com |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase config | If using auth | From Firebase console |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe public key | If using payments | `pk_live_...` |
| `STRIPE_SECRET_KEY` | Stripe secret | If using payments | `sk_live_...` (server-side only) |

### Backend (.env)

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `POLYGON_RPC_URL` | Polygon RPC endpoint | Yes | `https://polygon-mainnet.g.alchemy.com/v2/KEY` |
| `POLYGON_WS_URL` | Polygon WebSocket | Yes | `wss://polygon-mainnet.g.alchemy.com/v2/KEY` |
| `ALCHEMY_API_KEY` | Alchemy API key | Yes | From alchemy.com |
| `POLYMARKET_API_URL` | Polymarket endpoint | Yes | `https://gamma-api.polymarket.com` |
| `DATABASE_URL` | PostgreSQL connection | If using DB | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL` | Redis connection | Yes | `redis://localhost:6379` |
| `FIREBASE_CREDENTIALS_PATH` | Firebase service account | If using Firebase | `/app/firebase-credentials.json` |
| `JWT_SECRET_KEY` | JWT signing key | Yes | Generate with `openssl rand -hex 32` |
| `CORS_ORIGINS` | Allowed origins | Yes | `https://blackedge.io,https://www.blackedge.io` |

---

## 🔒 Security Checklist

### Before Deployment

- [ ] **No hardcoded secrets** in source code
  ```bash
  # Run security scan
  cd frontend
  grep -r "sk_" --include="*.ts" --include="*.tsx" src/
  grep -r "0x[a-fA-F0-9]{40}" --include="*.ts" --include="*.tsx" src/
  ```

- [ ] **Environment variables** are set in deployment platform (not in code)

- [ ] **Firebase credentials** are in secure storage (not committed to git)

- [ ] **API keys** are restricted by domain/IP in provider dashboards

- [ ] **CORS origins** are properly configured (not `*`)

- [ ] **Rate limiting** is enabled on backend

- [ ] **HTTPS/SSL** is enforced

- [ ] **Security headers** are configured (CSP, HSTS, X-Frame-Options)

### After Deployment

- [ ] Test all API endpoints

- [ ] Verify wallet connection works

- [ ] Check WebSocket connections

- [ ] Monitor error logs

- [ ] Setup uptime monitoring (UptimeRobot, Pingdom, etc.)

- [ ] Configure alerting for errors/downtime

---

## ✅ Testing

### Frontend Build Test

```bash
cd frontend
npm run build
npm run start  # Test production build locally
```

Expected output:
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages
✓ Finalizing page optimization
```

### Backend Test

```bash
cd backend
docker-compose up --build
```

Test health endpoint:
```bash
curl http://localhost:8000/health
# Expected: {"status":"healthy"}
```

Test API endpoints:
```bash
# Test signal endpoint
curl http://localhost:8000/api/v2/signal/TRUMP_2028

# Test features endpoint
curl http://localhost:8000/api/v2/features/TRUMP_2028
```

### Integration Test

1. Start backend: `docker-compose up`
2. Start frontend: `cd frontend && npm run dev`
3. Open browser to `http://localhost:3000`
4. Test:
   - [ ] Landing page loads
   - [ ] Connect wallet works
   - [ ] Terminal view loads data
   - [ ] WebSocket connections work
   - [ ] No console errors

---

## 🚀 Quick Deploy Commands

### Frontend (Vercel)
```bash
cd frontend
vercel --prod
```

### Backend (Docker Compose)
```bash
docker-compose up -d --build
```

### Backend (Manual)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
```

---

## 📊 Monitoring

### Recommended Services

- **Uptime**: [UptimeRobot](https://uptimerobot.com) (free tier available)
- **Logs**: Vercel logs + Docker logs
- **Errors**: Sentry (configure in both frontend and backend)
- **Analytics**: Vercel Analytics (already integrated)
- **Performance**: Vercel Speed Insights

### Health Endpoints

- Frontend: `https://blackedge.io` (should load)
- Backend: `https://api.blackedge.io/health`
- WebSocket: `wss://api.blackedge.io/ws` (should upgrade connection)

---

## 🆘 Troubleshooting

### Frontend Issues

**Build fails with turbopack errors:**
```bash
# Disable turbopack
export NEXT_PRIVATE_DISABLE_TURBOPACK=1
npm run build
```

**Wallet connection fails:**
- Check `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set
- Verify domain is allowlisted in WalletConnect dashboard
- Check browser console for errors

### Backend Issues

**Docker build fails:**
```bash
# Check Docker logs
docker-compose logs backend

# Rebuild from scratch
docker-compose down -v
docker-compose up --build
```

**Health check fails:**
```bash
# Check if backend is running
docker ps

# Check logs
docker logs blackedge-backend

# Test health endpoint directly
docker exec blackedge-backend curl http://localhost:8000/health
```

**Redis connection fails:**
```bash
# Check Redis is running
docker ps | grep redis

# Test Redis connection
docker exec blackedge-redis redis-cli ping
# Should return: PONG
```

---

## 📝 Notes

- **Frontend**: Deployed on Vercel (recommended) or any static host
- **Backend**: Deployed in Docker container on VPS, AWS ECS, Google Cloud Run, Railway, or Render
- **Database**: PostgreSQL recommended for production (optional, depends on your needs)
- **Cache**: Redis required for backend caching and rate limiting
- **CDN**: Vercel provides CDN automatically for frontend

---

## 🔗 Useful Links

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)
- [WalletConnect Setup](https://docs.walletconnect.com/)
- [Alchemy Dashboard](https://dashboard.alchemy.com/)

---

**Last Updated:** 2026-02-08
**Version:** 1.0.0
