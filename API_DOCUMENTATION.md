# 🔌 Black Edge API Documentation

Complete API reference for developers integrating with Black Edge.

**Base URL** : `https://black-edge-backend-production-e616.up.railway.app`

---

## 📋 **Table of Contents**

1. [Authentication](#authentication)
2. [Credits API](#credits-api)
3. [Markets API](#markets-api)
4. [Signals API](#signals-api)
5. [WebSocket API](#websocket-api)
6. [Stripe Payments](#stripe-payments)
7. [Error Handling](#error-handling)
8. [Rate Limits](#rate-limits)

---

## 🔐 **Authentication**

All protected endpoints require an API key in the `Authorization` header.

**Header Format** :
```
Authorization: Bearer be_live_YOUR_API_KEY
```

**Alternative** :
```
X-API-Key: be_live_YOUR_API_KEY
```

### Get API Key

Users receive an API key automatically when signing up via:
- Google OAuth
- Wallet Connect
- Admin creation endpoint

---

## 💳 **Credits API**

### Get Credit Balance

```http
GET /api/credits/balance
Authorization: Bearer YOUR_API_KEY
```

**Response** :
```json
{
  "user_id": "abc123",
  "credits": 5000,
  "max_credits": 50000,
  "percentage": 10.0,
  "tier": "pro",
  "signals_generated_today": 12,
  "total_signals_lifetime": 847,
  "status": "ok"
}
```

### Purchase Credits

```http
POST /api/credits/purchase
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "amount": 1000,
  "payment_method": "stripe"
}
```

**Response** :
```json
{
  "status": "ok",
  "amount_added": 1000,
  "new_balance": 6000,
  "message": "Successfully added 1000 credits"
}
```

### Get Transaction History

```http
GET /api/credits/transactions?limit=50
Authorization: Bearer YOUR_API_KEY
```

**Response** :
```json
{
  "status": "ok",
  "count": 50,
  "transactions": [
    {
      "id": "tx_abc123",
      "user_id": "user_xyz",
      "amount": -1,
      "type": "signal",
      "description": "Signal generated: Bitcoin $150K",
      "balance_after": 4999,
      "timestamp": "2026-02-25T00:00:00Z"
    }
  ]
}
```

---

## 📊 **Markets API**

### Get Active Markets

```http
GET /api/v2/markets?limit=1000&min_volume=10000
```

**Parameters** :
- `limit` : Max markets to return (default: 1000, max: 10000)
- `min_volume` : Minimum 24h volume in USD (default: 0)

**Response** :
```json
{
  "status": "ok",
  "count": 447,
  "markets": [
    {
      "id": "0x123abc",
      "condition_id": "0x456def",
      "question": "Will Bitcoin reach $150K in February?",
      "slug": "bitcoin-150k-february",
      "url": "https://polymarket.com/event/bitcoin-150k-february",
      "yes_price": 0.35,
      "no_price": 0.65,
      "spread": 0.02,
      "volume_24h": 1723000,
      "volume_total": 5000000,
      "liquidity": 250000,
      "end_date": "2026-02-28T23:59:59Z",
      "active": true,
      "tokens": [
        {
          "token_id": "0xabc",
          "outcome": "YES",
          "price": 0.35
        },
        {
          "token_id": "0xdef",
          "outcome": "NO",
          "price": 0.65
        }
      ]
    }
  ]
}
```

### Get Single Market

```http
GET /api/v2/market/{market_id}
```

**Response** : Same as markets array item above

---

## 📡 **Signals API**

### Get All Signals

```http
GET /api/v2/signals
```

**Response** :
```json
{
  "status": "success",
  "signals": [
    {
      "id": "1",
      "market": "BITCOIN_150K_FEBRUARY",
      "question": "Will Bitcoin reach $150,000 in February?",
      "platform": "Polymarket",
      "url": "https://polymarket.com/event/bitcoin-150k-february",
      "polyOdds": 35,
      "trueProb": 47,
      "edge": 12.4,
      "volume": "$1.7M",
      "volumeTotal": "$5.0M",
      "liquidity": 250000,
      "trend": "bullish",
      "risk": "medium",
      "spread": 0.02,
      "kellyFraction": 0.082,
      "volatility": 0.15,
      "arbFlag": false,
      "arbDetail": "",
      "signalStrength": 85,
      "prediction": "YES"
    }
  ]
}
```

### Get Signal for Specific Market

```http
GET /api/v2/signal/{market_id}
```

**Response** : Single signal object

### Get Council Vote

```http
GET /api/v2/council/{market_id}
```

**Response** :
```json
{
  "market_id": "0x123abc",
  "question": "Will Bitcoin reach $150K in February?",
  "council_vote": {
    "quant": "YES",
    "sentiment": "YES",
    "whale": "NO",
    "risk": "YES",
    "oracle": "YES"
  },
  "consensus": "YES",
  "confidence": 0.8,
  "vote_count": "4/5 YES"
}
```

### Get Track Record

```http
GET /api/v2/track-record
```

**Response** :
```json
{
  "status": "success",
  "track_record": {
    "summary": {
      "total_predictions": 847,
      "total_resolved": 623,
      "win_rate": 62.0,
      "avg_edge_predicted": 12.4,
      "avg_edge_realized": 10.1,
      "total_pnl": 4250.50
    },
    "by_confidence": {
      "high": {
        "count": 200,
        "win_rate": 75.5
      },
      "medium": {
        "count": 423,
        "win_rate": 58.2
      },
      "low": {
        "count": 224,
        "win_rate": 52.1
      }
    },
    "recent_predictions": []
  },
  "timestamp": 1771979695.7017648
}
```

---

## 🔌 **WebSocket API**

### Connect to Real-Time Stream

```javascript
const WebSocket = require('ws');

const apiKey = 'be_live_YOUR_API_KEY';
const clientType = 'web'; // or 'cli'

const ws = new WebSocket(
  `wss://black-edge-backend-production-e616.up.railway.app/ws/v2/stream?api_key=${apiKey}&client_type=${clientType}`
);

ws.on('open', () => {
  console.log('Connected to Black Edge');
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log('Received:', message);
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

ws.on('close', () => {
  console.log('Disconnected from Black Edge');
});
```

### Message Types

**Welcome Message** :
```json
{
  "type": "welcome",
  "data": {
    "user_id": "abc123",
    "credits": 5000,
    "max_credits": 50000,
    "tier": "pro"
  }
}
```

**Signal Message** :
```json
{
  "type": "signal",
  "data": {
    "id": "1",
    "market": "BITCOIN_150K_FEBRUARY",
    "edge": 12.4,
    "council_vote": "4/5 YES",
    "kelly": 8.2,
    "side": "YES"
  },
  "credits_remaining": 4999
}
```

**Error Message** :
```json
{
  "type": "error",
  "code": "INSUFFICIENT_CREDITS",
  "message": "You have run out of API credits.",
  "credits_remaining": 0
}
```

**Heartbeat** :
```json
{
  "type": "heartbeat",
  "data": {
    "credits": 4999,
    "timestamp": 1771979695.7017648
  }
}
```

### Ping/Pong

Send ping to keep connection alive:
```json
{
  "type": "ping"
}
```

Receive pong:
```json
{
  "type": "pong"
}
```

---

## 💰 **Stripe Payments**

### Get Available Packages

```http
GET /api/stripe/packages
```

**Response** :
```json
{
  "status": "ok",
  "packages": [
    {
      "id": "starter",
      "name": "Starter Pack",
      "description": "1,000 API credits",
      "credits": 1000,
      "price_usd": 10.0,
      "price_per_credit": 0.01
    },
    {
      "id": "pro",
      "name": "Pro Pack",
      "description": "10,000 API credits",
      "credits": 10000,
      "price_usd": 50.0,
      "price_per_credit": 0.005
    },
    {
      "id": "whale",
      "name": "Whale Pack",
      "description": "100,000 API credits",
      "credits": 100000,
      "price_usd": 400.0,
      "price_per_credit": 0.004
    }
  ]
}
```

### Create Checkout Session

```http
POST /api/stripe/create-checkout
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "package": "pro",
  "success_url": "https://yourapp.com/success",
  "cancel_url": "https://yourapp.com/cancelled"
}
```

**Response** :
```json
{
  "checkout_url": "https://checkout.stripe.com/c/pay/cs_test_xxx",
  "session_id": "cs_test_xxx"
}
```

### Webhook (Server-Side Only)

```http
POST /api/stripe/webhook
Stripe-Signature: xxx
```

Stripe sends `checkout.session.completed` events when payments succeed.
Credits are automatically added to the user's account.

---

## ⚠️ **Error Handling**

### Error Response Format

```json
{
  "detail": "Error message here",
  "status_code": 400
}
```

### Common Error Codes

| Code | Message | Solution |
|------|---------|----------|
| 401 | Invalid API key | Check your API key |
| 402 | Insufficient credits | Purchase more credits |
| 404 | Not found | Check endpoint URL |
| 429 | Rate limit exceeded | Slow down requests |
| 500 | Internal server error | Contact support |

---

## 🚦 **Rate Limits**

### Current Limits

- **REST API** : 100 requests/minute per API key
- **WebSocket** : 1 connection per API key
- **Signal Generation** : 1 credit per signal

### Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1771979700
```

### Exceeding Limits

**Response** :
```json
{
  "detail": "Rate limit exceeded. Try again in 60 seconds.",
  "status_code": 429,
  "retry_after": 60
}
```

---

## 📝 **Code Examples**

### Python

```python
import requests

API_KEY = 'be_live_YOUR_API_KEY'
BASE_URL = 'https://black-edge-backend-production-e616.up.railway.app'

headers = {
    'Authorization': f'Bearer {API_KEY}'
}

# Get balance
response = requests.get(f'{BASE_URL}/api/credits/balance', headers=headers)
balance = response.json()
print(f"Credits: {balance['credits']}")

# Get signals
response = requests.get(f'{BASE_URL}/api/v2/signals')
signals = response.json()['signals']
for signal in signals[:5]:
    print(f"{signal['market']}: {signal['edge']}% edge")
```

### Node.js

```javascript
const axios = require('axios');

const API_KEY = 'be_live_YOUR_API_KEY';
const BASE_URL = 'https://black-edge-backend-production-e616.up.railway.app';

const headers = {
  'Authorization': `Bearer ${API_KEY}`
};

// Get balance
async function getBalance() {
  const response = await axios.get(`${BASE_URL}/api/credits/balance`, { headers });
  console.log(`Credits: ${response.data.credits}`);
}

// Get signals
async function getSignals() {
  const response = await axios.get(`${BASE_URL}/api/v2/signals`);
  const signals = response.data.signals.slice(0, 5);
  signals.forEach(signal => {
    console.log(`${signal.market}: ${signal.edge}% edge`);
  });
}

getBalance();
getSignals();
```

### cURL

```bash
# Get balance
curl -H "Authorization: Bearer be_live_YOUR_API_KEY" \
  https://black-edge-backend-production-e616.up.railway.app/api/credits/balance

# Get signals
curl https://black-edge-backend-production-e616.up.railway.app/api/v2/signals

# Get markets
curl "https://black-edge-backend-production-e616.up.railway.app/api/v2/markets?limit=100"
```

---

## 🔗 **SDK Libraries**

### Official SDKs

**JavaScript/TypeScript** :
```bash
npm install @blackedge/sdk
```

**Python** :
```bash
pip install blackedge-sdk
```

*(Coming soon)*

---

## 🆘 **Support**

- **Docs** : https://docs.blackedge.io
- **Email** : api@blackedge.io
- **Discord** : https://discord.gg/blackedge
- **GitHub** : https://github.com/blackedge/issues

---

**Built with ⚡ by the Black Edge team**
