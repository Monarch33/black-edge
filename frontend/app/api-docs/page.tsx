import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Code, Lock, Zap } from 'lucide-react'

export const metadata: Metadata = {
  title: 'API Documentation - Black Edge',
  description: 'Black Edge API Documentation for Developers',
}

export default function ApiDocumentation() {
  return (
    <div className="min-h-screen bg-[#0D0D1A] text-white">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-white/40 hover:text-white/80 transition-colors mb-8 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="flex items-center gap-4 mb-6">
          <Code className="w-10 h-10 text-red-500" />
          <div>
            <h1 className="text-4xl font-bold tracking-tight">API Documentation</h1>
            <p className="text-white/60">Black Edge REST API & WebSocket Reference</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-12">
          <div className="bg-white/5 border border-white/10 rounded p-4">
            <Zap className="w-6 h-6 text-green-500 mb-2" />
            <h3 className="font-semibold mb-1">Real-Time Data</h3>
            <p className="text-xs text-white/60">WebSocket streaming for live market updates</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded p-4">
            <Lock className="w-6 h-6 text-blue-500 mb-2" />
            <h3 className="font-semibold mb-1">Secure & Authenticated</h3>
            <p className="text-xs text-white/60">Firebase token-based authentication</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded p-4">
            <Code className="w-6 h-6 text-purple-500 mb-2" />
            <h3 className="font-semibold mb-1">RESTful Design</h3>
            <p className="text-xs text-white/60">Standard HTTP methods and JSON responses</p>
          </div>
        </div>

        <div className="space-y-8 text-white/70 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Base URL</h2>
            <div className="bg-black/40 border border-white/10 rounded p-4 font-mono text-sm">
              <code className="text-green-400">https://black-edge-backend-production-e616.up.railway.app</code>
            </div>
            <p className="mt-4 text-sm">
              All API requests should be made to this base URL. For local development, use{' '}
              <code className="bg-white/10 px-2 py-1 rounded text-xs">http://localhost:8000</code>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Authentication</h2>
            <p className="mb-4">
              The Black Edge API uses Firebase authentication tokens for protected endpoints.
            </p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">Getting a Token</h3>
            <div className="bg-black/40 border border-white/10 rounded p-4 font-mono text-sm mb-4">
              <code className="text-white/80">
                {`// Authenticate with Firebase
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const auth = getAuth();
const userCredential = await signInWithEmailAndPassword(auth, email, password);
const token = await userCredential.user.getIdToken();`}
              </code>
            </div>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">Using the Token</h3>
            <p className="mb-4">Include the token in the WebSocket connection URL:</p>
            <div className="bg-black/40 border border-white/10 rounded p-4 font-mono text-sm">
              <code className="text-white/80">
                {`wss://black-edge-backend-production-e616.up.railway.app/ws/stream?token=YOUR_TOKEN`}
              </code>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">REST API Endpoints</h2>

            <div className="space-y-6">
              {/* Health Endpoint */}
              <div className="bg-white/5 border border-white/10 rounded p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded text-xs font-bold">GET</span>
                  <code className="text-white font-mono">/health</code>
                </div>
                <p className="mb-4">Check API health status and connectivity.</p>

                <h4 className="font-semibold text-white mb-2">Response</h4>
                <div className="bg-black/40 border border-white/10 rounded p-4 font-mono text-xs overflow-x-auto">
                  <pre className="text-white/80">{`{
  "status": "healthy",
  "timestamp": "2026-02-08T19:55:22.535612",
  "websocket_connections": 0,
  "tier_distribution": {}
}`}</pre>
                </div>
              </div>

              {/* Opportunities Endpoint */}
              <div className="bg-white/5 border border-white/10 rounded p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded text-xs font-bold">GET</span>
                  <code className="text-white font-mono">/api/opportunities</code>
                </div>
                <p className="mb-4">Get current trading opportunities with quant analysis.</p>

                <h4 className="font-semibold text-white mb-2">Response</h4>
                <div className="bg-black/40 border border-white/10 rounded p-4 font-mono text-xs overflow-x-auto">
                  <pre className="text-white/80">{`[
  {
    "id": "2",
    "market": "US_X_IRAN_MEETING_BY_FEBRUARY_6,_2026",
    "question": "US x Iran meeting by February 6, 2026?",
    "platform": "Polymarket",
    "url": "https://polymarket.com/event/...",
    "polyOdds": 50,
    "trueProb": 53,
    "edge": 3.0,
    "volume": "$6.0M",
    "volumeTotal": "$14.2M",
    "liquidity": 1504017,
    "trend": "neutral",
    "risk": "low",
    "spread": 0.0,
    "kellyFraction": 0.03,
    "volatility": 0.0,
    "arbFlag": false,
    "arbDetail": "",
    "signalStrength": 59
  }
]`}</pre>
                </div>

                <h4 className="font-semibold text-white mb-2 mt-4">Field Descriptions</h4>
                <ul className="list-disc list-inside space-y-2 text-sm ml-4">
                  <li><code className="bg-white/10 px-2 py-1 rounded text-xs">edge</code> - Calculated edge percentage (not guaranteed profit)</li>
                  <li><code className="bg-white/10 px-2 py-1 rounded text-xs">kellyFraction</code> - Optimal position size using Kelly Criterion</li>
                  <li><code className="bg-white/10 px-2 py-1 rounded text-xs">signalStrength</code> - Algorithmic confidence score (0-100)</li>
                  <li><code className="bg-white/10 px-2 py-1 rounded text-xs">arbFlag</code> - True if arbitrage opportunity detected</li>
                </ul>
              </div>

              {/* Build Transaction Endpoint */}
              <div className="bg-white/5 border border-white/10 rounded p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded text-xs font-bold">POST</span>
                  <code className="text-white font-mono">/api/build-tx</code>
                </div>
                <p className="mb-4">Build a transaction for executing a trade (requires authentication).</p>

                <h4 className="font-semibold text-white mb-2">Request Body</h4>
                <div className="bg-black/40 border border-white/10 rounded p-4 font-mono text-xs overflow-x-auto mb-4">
                  <pre className="text-white/80">{`{
  "marketId": "0x123...",
  "outcome": "YES",
  "amount": 100.0
}`}</pre>
                </div>

                <h4 className="font-semibold text-white mb-2">Response</h4>
                <div className="bg-black/40 border border-white/10 rounded p-4 font-mono text-xs overflow-x-auto">
                  <pre className="text-white/80">{`{
  "status": "success",
  "transaction": {
    "to": "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E",
    "data": "0x...",
    "value": "0",
    "gasLimit": "250000"
  }
}`}</pre>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">WebSocket API</h2>
            <p className="mb-4">
              Connect to the WebSocket endpoint for real-time market updates and trading signals.
            </p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">Connection</h3>
            <div className="bg-black/40 border border-white/10 rounded p-4 font-mono text-sm mb-4">
              <code className="text-white/80">
                {`wss://black-edge-backend-production-e616.up.railway.app/ws/stream?token=YOUR_TOKEN`}
              </code>
            </div>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">Message Types</h3>

            <div className="space-y-4 mt-4">
              <div className="bg-white/5 border border-white/10 rounded p-4">
                <h4 className="font-semibold text-white mb-2">Connection Established</h4>
                <div className="bg-black/40 border border-white/10 rounded p-3 font-mono text-xs overflow-x-auto">
                  <pre className="text-white/80">{`{
  "type": "connection",
  "authenticated": true,
  "tier": "runner",
  "message": "Connected to Black Edge stream"
}`}</pre>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded p-4">
                <h4 className="font-semibold text-white mb-2">Signals Update</h4>
                <div className="bg-black/40 border border-white/10 rounded p-3 font-mono text-xs overflow-x-auto">
                  <pre className="text-white/80">{`{
  "type": "signals_update",
  "data": [
    {
      "market": "BTC_100K_2026",
      "edge": 7.2,
      "signalStrength": 85
    }
  ]
}`}</pre>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded p-4">
                <h4 className="font-semibold text-white mb-2">Heartbeat</h4>
                <div className="bg-black/40 border border-white/10 rounded p-3 font-mono text-xs overflow-x-auto">
                  <pre className="text-white/80">{`{
  "type": "heartbeat",
  "timestamp": "2026-02-08T19:55:22.535612"
}`}</pre>
                </div>
              </div>
            </div>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">Example Implementation</h3>
            <div className="bg-black/40 border border-white/10 rounded p-4 font-mono text-xs overflow-x-auto">
              <pre className="text-white/80">{`// JavaScript WebSocket client
const ws = new WebSocket(
  'wss://black-edge-backend-production-e616.up.railway.app/ws/stream?token=' + token
);

ws.onopen = () => {
  console.log('Connected to Black Edge');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch(message.type) {
    case 'connection':
      console.log('Authenticated:', message.authenticated);
      break;
    case 'signals_update':
      console.log('New signals:', message.data);
      break;
    case 'heartbeat':
      // Keep connection alive
      break;
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected');
};`}</pre>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Rate Limits</h2>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>REST API: 100 requests per minute per IP</li>
              <li>WebSocket: 1 connection per authenticated user</li>
              <li>Data refreshes every 30 seconds</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Error Handling</h2>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">HTTP Status Codes</h3>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><code className="bg-white/10 px-2 py-1 rounded text-xs">200 OK</code> - Request successful</li>
              <li><code className="bg-white/10 px-2 py-1 rounded text-xs">400 Bad Request</code> - Invalid parameters</li>
              <li><code className="bg-white/10 px-2 py-1 rounded text-xs">401 Unauthorized</code> - Invalid or missing token</li>
              <li><code className="bg-white/10 px-2 py-1 rounded text-xs">404 Not Found</code> - Endpoint not found</li>
              <li><code className="bg-white/10 px-2 py-1 rounded text-xs">429 Too Many Requests</code> - Rate limit exceeded</li>
              <li><code className="bg-white/10 px-2 py-1 rounded text-xs">500 Internal Server Error</code> - Server error</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">Error Response Format</h3>
            <div className="bg-black/40 border border-white/10 rounded p-4 font-mono text-xs overflow-x-auto">
              <pre className="text-white/80">{`{
  "error": "Invalid market ID",
  "detail": "Market ID must be a valid Polymarket market address",
  "status": 400
}`}</pre>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Support & Contact</h2>
            <p className="mb-4">
              For API support, technical questions, or to report issues:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Email: <span className="font-mono text-sm">api@blackedge.io</span></li>
              <li>GitHub: <span className="font-mono text-sm">github.com/blackedge</span></li>
              <li>Discord: Community support channel</li>
            </ul>
          </section>

          <div className="mt-12 pt-8 border-t border-white/10 bg-white/5 rounded p-6">
            <p className="text-white/60 text-sm mb-4">
              <strong className="text-white">Disclaimer:</strong> The Black Edge API provides market data and
              analysis for informational purposes only. See our{' '}
              <Link href="/risk-disclosure" className="text-red-400 hover:text-red-300 underline">
                Risk Disclosure
              </Link>{' '}
              for important information about trading risks.
            </p>
            <p className="text-white/40 text-xs">
              API Version: 1.0 | Last Updated: February 8, 2026
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
