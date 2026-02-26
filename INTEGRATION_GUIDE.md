# 🚀 Dual-Client Architecture Integration Guide

Complete guide to integrate the API Credit System, WebSocket V2, and CLI with your Black Edge backend.

---

## 📋 What's Been Built

### 1. **Backend API Credit System**
- ✅ User model with API keys (`be_live_***`)
- ✅ Credit balance tracking
- ✅ Transaction logging
- ✅ Endpoints: `/api/credits/balance`, `/api/credits/purchase`, `/api/credits/deduct`

### 2. **WebSocket V2 with Auth**
- ✅ API key authentication
- ✅ Credit deduction per signal
- ✅ Support for Web + CLI clients
- ✅ Error handling for insufficient credits

### 3. **CLI for NPM Publication**
- ✅ Production-ready `package.json`
- ✅ Professional README with installation guide
- ✅ Complete CLI with guided setup
- ✅ API key validation
- ✅ Credit balance check
- ✅ WebSocket signal streaming

---

## 🔧 Backend Integration

### Step 1: Add Models to Backend

The user model has been created at:
```
backend/models/user.py
```

**Action:** Import this in your `backend/main.py`:

```python
# Add near the top of main.py
from models.user import user_db, seed_demo_users
```

### Step 2: Add Credits Router

The credits API router has been created at:
```
backend/routers/credits.py
```

**Action:** Add to `backend/main.py` around line 1200 (after other routers):

```python
# Add Credits API router
try:
    from routers.credits import router as credits_router
    app.include_router(credits_router)
    logger.info("✅ Credits API router enabled")
except Exception as e:
    logger.warning("⚠️ Credits API router disabled", error=str(e))
```

### Step 3: Update WebSocket V2 Endpoint

The enhanced WebSocket has been created at:
```
backend/api/websocket_v2.py
```

**Action:** Replace the existing WebSocket V2 endpoint in `backend/main.py` (around line 1764):

```python
# V2 WebSocket endpoint (with API key auth)
@app.websocket("/ws/v2/stream")
async def websocket_v2_endpoint_auth(
    websocket: WebSocket,
    api_key: str = Query(..., description="Black Edge API Key"),
    client_type: str = Query("web", description="Client type: web or cli")
) -> None:
    """
    V2 WebSocket endpoint with API key authentication and credit management.

    Query Parameters:
    - api_key: Black Edge API key (be_live_***)
    - client_type: "web" (browser terminal) or "cli" (local terminal)

    Example:
    - Web:  ws://localhost:8000/ws/v2/stream?api_key=be_live_xxx&client_type=web
    - CLI:  ws://localhost:8000/ws/v2/stream?api_key=be_live_xxx&client_type=cli
    """
    from api.websocket_v2 import websocket_handler_v2
    await websocket_handler_v2(websocket, api_key, client_type)
```

### Step 4: Seed Demo Users on Startup

**Action:** In `backend/main.py`, add to the startup section (after `await state.startup()`):

```python
# In the lifespan context manager, after state.startup()
async def lifespan(app: FastAPI):
    # Startup
    await state.startup()

    # Seed demo users (first time only)
    from models.user import seed_demo_users
    seed_demo_users()

    # ... rest of startup code
```

### Step 5: Update Signal Broadcasting

**Action:** When your backend generates a signal, broadcast it using the new manager:

```python
from api.websocket_v2 import manager_v2

# When you have a new signal
signal_data = {
    "id": "signal_123",
    "market": "Bitcoin above $120K",
    "edge": 12.4,
    "council_vote": "4/5 YES",
    "kelly": 8.2,
    "side": "YES"
}

# This will automatically deduct 1 credit per user who receives it
sent_count = await manager_v2.broadcast_signal(signal_data, deduct_credits=True)
logger.info(f"Signal broadcast to {sent_count} users")
```

---

## 🌐 Frontend Integration

### Step 1: Update AccountPanel API Calls

In `frontend/components/account-panel.tsx`, replace mock data with real API calls:

```typescript
// Replace mock data with real API call
useEffect(() => {
  const fetchCredits = async () => {
    if (!userAddress) return;

    try {
      const response = await fetch('/api/credits/balance', {
        headers: {
          'Authorization': `Bearer ${apiKey}`  // Get from user context
        }
      });

      const data = await response.json();
      setCredits(data.credits);
      setMaxCredits(data.max_credits);
      // ... update other fields
    } catch (error) {
      console.error('Failed to fetch credits:', error);
    }
  };

  fetchCredits();
  const interval = setInterval(fetchCredits, 30000); // Refresh every 30s
  return () => clearInterval(interval);
}, [userAddress]);
```

### Step 2: Update WebSocket Connection

In your Web Terminal component, connect to the new authenticated WebSocket:

```typescript
// Get API key from user session
const apiKey = user?.apiKey || 'be_live_xxx';

// Connect to authenticated WebSocket
const ws = new WebSocket(
  `${WS_URL}/ws/v2/stream?api_key=${apiKey}&client_type=web`
);

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'signal') {
    // New signal received
    addSignal(message.data);
    setCreditsRemaining(message.credits_remaining);
  }

  if (message.type === 'error' && message.code === 'INSUFFICIENT_CREDITS') {
    // Show "out of credits" modal
    showCreditsPurchaseModal();
  }
};
```

---

## 📦 CLI Publication to NPM

### Step 1: Install Dependencies

```bash
cd cli
npm install
```

### Step 2: Test Locally

```bash
# Link locally for testing
npm link

# Test the CLI
black-edge start

# Unlink after testing
npm unlink -g black-edge-cli
```

### Step 3: Publish to NPM

**Before publishing, ensure you're logged in to NPM:**

```bash
npm login
```

**Then publish:**

```bash
cd cli
npm publish
```

**If the name `black-edge-cli` is taken, update `package.json` to:**
```json
{
  "name": "@your-org/black-edge-cli",
  ...
}
```

**Then publish with public access:**

```bash
npm publish --access public
```

### Step 4: Test Global Installation

```bash
npm install -g black-edge-cli
black-edge start
```

---

## 🔐 OAuth Integration (NextAuth.js)

### Step 1: Install NextAuth

```bash
cd frontend
npm install next-auth @next-auth/prisma-adapter
```

### Step 2: Create Auth Config

Create `frontend/app/api/auth/[...nextauth]/route.ts`:

```typescript
import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import AppleProvider from "next-auth/providers/apple"
import EmailProvider from "next-auth/providers/email"

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    AppleProvider({
      clientId: process.env.APPLE_CLIENT_ID!,
      clientSecret: process.env.APPLE_CLIENT_SECRET!,
    }),
    EmailProvider({
      server: process.env.EMAIL_SERVER!,
      from: process.env.EMAIL_FROM!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Create Black Edge user and API key
      const response = await fetch(`${process.env.BACKEND_URL}/api/credits/admin/create-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          google_id: account?.provider === 'google' ? account.providerAccountId : null,
          apple_id: account?.provider === 'apple' ? account.providerAccountId : null,
          tier: 'free'
        })
      });

      const data = await response.json();
      user.apiKey = data.api_key;  // Store API key in session

      return true;
    },
    async session({ session, user }) {
      // Attach API key to session
      session.user.apiKey = user.apiKey;
      return session;
    },
  },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

### Step 3: Environment Variables

Add to `frontend/.env.local`:

```bash
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Apple OAuth
APPLE_CLIENT_ID=your-apple-client-id
APPLE_CLIENT_SECRET=your-apple-client-secret

# Email (SendGrid, Mailgun, etc.)
EMAIL_SERVER=smtp://username:password@smtp.example.com:587
EMAIL_FROM=noreply@blackedge.io

# Backend API
BACKEND_URL=http://localhost:8000
```

### Step 4: Update AuthModal

Update `frontend/components/auth-modal.tsx` to use NextAuth:

```typescript
import { signIn } from 'next-auth/react';

// In the component
const handleGoogleAuth = () => {
  signIn('google', { callbackUrl: '/dashboard' });
};

const handleAppleAuth = () => {
  signIn('apple', { callbackUrl: '/dashboard' });
};

const handleEmailAuth = (e: React.FormEvent) => {
  e.preventDefault();
  signIn('email', { email, callbackUrl: '/dashboard' });
};
```

---

## ✅ Testing Checklist

### Backend
- [ ] Demo users seeded on startup
- [ ] `/api/credits/balance` returns user credits
- [ ] `/api/credits/purchase` adds credits
- [ ] `/api/credits/deduct` removes credits
- [ ] WebSocket V2 requires `api_key` query param
- [ ] WebSocket V2 rejects invalid API keys
- [ ] WebSocket V2 deducts 1 credit per signal
- [ ] WebSocket V2 sends `INSUFFICIENT_CREDITS` error when credits = 0

### Frontend
- [ ] LOG IN / SIGN UP buttons in header
- [ ] AuthModal opens with Google/Apple/Wallet options
- [ ] AccountPanel shows credit balance
- [ ] AccountPanel shows masked API key with copy button
- [ ] AccountPanel shows CLI install commands with copy buttons
- [ ] Web Terminal connects to authenticated WebSocket
- [ ] Credit balance updates after each signal
- [ ] "Out of credits" modal appears when credits = 0

### CLI
- [ ] `npm link` installs CLI globally
- [ ] `black-edge start` shows ASCII logo
- [ ] CLI prompts for API key
- [ ] CLI validates API key and checks credits
- [ ] CLI connects to WebSocket and receives signals
- [ ] CLI displays credit balance after each signal
- [ ] CLI shows error when credits = 0
- [ ] `npm publish` succeeds

---

## 🎯 Next Steps

1. **Set up OAuth providers** (Google/Apple) and get client IDs/secrets
2. **Deploy backend** with new endpoints
3. **Deploy frontend** with updated auth flow
4. **Test end-to-end** Web + CLI dual-client flow
5. **Publish CLI to NPM**
6. **Monitor credit usage** and adjust pricing

---

## 📚 Documentation Links

- **Backend API**: `http://localhost:8000/docs`
- **Frontend**: `http://localhost:3000`
- **CLI README**: `cli/README.md`
- **User Model**: `backend/models/user.py`
- **Credits Router**: `backend/routers/credits.py`
- **WebSocket V2**: `backend/api/websocket_v2.py`

---

## 🆘 Troubleshooting

**WebSocket won't connect**
- Check that `api_key` query parameter is included
- Verify API key is valid (`be_live_***`)
- Check that user has credits > 0

**Credits not deducting**
- Verify `deduct_credits=True` in `broadcast_signal()`
- Check transaction logs in `/api/credits/transactions`

**CLI won't install**
- Run `npm link` in the `cli/` directory first
- Check that `index.js` has execute permissions (`chmod +x`)

**OAuth not working**
- Verify environment variables are set
- Check OAuth redirect URIs match NextAuth URL
- Test with email magic link first (simpler setup)

---

**Built with ⚡ by the Black Edge team**
