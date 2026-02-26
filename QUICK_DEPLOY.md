# 🚀 QUICK DEPLOY GUIDE

## Step 1: Update Backend (5 min)

Edit `backend/main.py`:

**Add imports (line ~27):**
```python
from models.user import user_db, seed_demo_users
from routers.credits import router as credits_router
```

**Add router (line ~1200):**
```python
app.include_router(credits_router)
```

**Update WebSocket (line ~1765):**
```python
@app.websocket("/ws/v2/stream")
async def websocket_v2_endpoint_auth(
    websocket: WebSocket,
    api_key: str = Query(...),
    client_type: str = Query("web")
):
    from api.websocket_v2 import websocket_handler_v2
    await websocket_handler_v2(websocket, api_key, client_type)
```

**Seed users (in startup):**
```python
seed_demo_users()
```

**Test:**
```bash
cd backend && python main.py
curl http://localhost:8000/api/credits/admin/users
```

---

## Step 2: Deploy to Railway (5 min)

```bash
npm install -g @railway/cli
railway login
cd ~/black-edge
railway init
railway up
```

Get URL: `railway status`

Test: `curl https://YOUR-APP.railway.app/health`

---

## Step 3: Update CLI URLs (2 min)

Edit `cli/index.js` lines 19-20:

```javascript
const DEFAULT_API_URL = 'https://YOUR-APP.railway.app';
const DEFAULT_WS_URL = 'wss://YOUR-APP.railway.app/ws/v2/stream';
```

---

## Step 4: Publish to NPM (10 min)

```bash
cd cli
npm login
npm publish
# or: npm publish --access public
```

Test:
```bash
npm install -g black-edge-cli
black-edge start
```

---

## Step 5: Update Vercel (5 min)

Vercel Dashboard → Settings → Environment Variables:

```
NEXT_PUBLIC_API_URL=https://YOUR-APP.railway.app
NEXT_PUBLIC_WS_URL=wss://YOUR-APP.railway.app/ws/v2/stream
```

Redeploy.

---

✅ DONE! Total: 30 minutes
