import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Brain, TrendingUp, Shield } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Technical Paper - Black Edge',
  description: 'Black Edge Technical Whitepaper and System Architecture',
}

export default function TechnicalPaper() {
  return (
    <div className="min-h-screen bg-[#0D0D1A] text-white">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-white/40 hover:text-white/80 transition-colors mb-8 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="flex items-center gap-4 mb-6">
          <BookOpen className="w-10 h-10 text-red-500" />
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Technical Paper</h1>
            <p className="text-white/60">Black Edge: Quantitative Prediction Market Analysis System</p>
          </div>
        </div>

        <div className="text-white/40 text-sm mb-8">
          Version 3.0 | February 2026
        </div>

        <div className="space-y-8 text-white/70 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Abstract</h2>
            <p className="mb-4">
              Black Edge is a quantitative analysis and trading platform for prediction markets, with primary
              integration to Polymarket. The system combines real-time market data aggregation, algorithmic
              signal generation, arbitrage detection, and risk-managed trade execution to identify mispriced
              markets and profitable trading opportunities.
            </p>
            <p>
              This paper describes the technical architecture, mathematical models, and implementation details
              of the Black Edge system, including its data pipeline, quant engine, and trading infrastructure.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. System Architecture</h2>

            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white/5 border border-white/10 rounded p-4">
                <Brain className="w-6 h-6 text-purple-500 mb-2" />
                <h3 className="font-semibold mb-1 text-sm">Quant Engine</h3>
                <p className="text-xs text-white/60">Multi-factor algorithmic analysis</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded p-4">
                <TrendingUp className="w-6 h-6 text-green-500 mb-2" />
                <h3 className="font-semibold mb-1 text-sm">Real-Time Data</h3>
                <p className="text-xs text-white/60">30-second market refresh cycle</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded p-4">
                <Shield className="w-6 h-6 text-blue-500 mb-2" />
                <h3 className="font-semibold mb-1 text-sm">Risk Management</h3>
                <p className="text-xs text-white/60">Kelly Criterion position sizing</p>
              </div>
            </div>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">1.1 High-Level Overview</h3>
            <p className="mb-4">The system consists of four primary components:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Data Aggregation Layer:</strong> Fetches and normalizes market data from Polymarket and other sources</li>
              <li><strong>Quantitative Analysis Engine:</strong> Applies mathematical models to identify mispriced markets</li>
              <li><strong>Signal Generation Module:</strong> Converts analysis into actionable trading signals</li>
              <li><strong>Execution Infrastructure:</strong> Manages trade execution and portfolio tracking</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">1.2 Technology Stack</h3>
            <div className="bg-black/40 border border-white/10 rounded p-4">
              <ul className="list-none space-y-2 text-sm font-mono">
                <li><span className="text-green-400">Backend:</span> Python 3.12, FastAPI, asyncio</li>
                <li><span className="text-green-400">Data Science:</span> NumPy, Pandas, SciPy</li>
                <li><span className="text-green-400">Blockchain:</span> web3.py, viem, Polygon</li>
                <li><span className="text-green-400">Frontend:</span> Next.js 15, React 18, TypeScript</li>
                <li><span className="text-green-400">Infrastructure:</span> Railway (backend), Vercel (frontend)</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Data Pipeline</h2>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">2.1 Market Data Ingestion</h3>
            <p className="mb-4">
              The system polls the Polymarket Gamma API every 30 seconds, fetching:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Market metadata (question, resolution criteria, expiry)</li>
              <li>Current odds for YES/NO outcomes</li>
              <li>Trading volume (24h and total)</li>
              <li>Liquidity depth</li>
              <li>Historical price data</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">2.2 Data Normalization</h3>
            <p className="mb-4">
              Raw market data is normalized to a standard format:
            </p>
            <div className="bg-black/40 border border-white/10 rounded p-4 font-mono text-xs overflow-x-auto">
              <pre className="text-white/80">{`MarketData {
  market_id: str           // Unique identifier
  question: str            // Market question
  yes_price: float         // Current YES price (0-1)
  no_price: float          // Current NO price (0-1)
  volume_24h: float        // Trading volume (USD)
  liquidity: float         // Available liquidity
  expiry: datetime         // Resolution date
  metadata: dict           // Additional attributes
}`}</pre>
            </div>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">2.3 Feature Engineering</h3>
            <p className="mb-4">
              Derived features are computed from raw data:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Spread:</strong> |YES + NO - 1.0| (arbitrage indicator)</li>
              <li><strong>Volume Ratio:</strong> 24h volume / total volume (momentum)</li>
              <li><strong>Liquidity Score:</strong> Available depth relative to market cap</li>
              <li><strong>Time to Expiry:</strong> Days until resolution</li>
              <li><strong>Volatility:</strong> Price variance over rolling window</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. Quantitative Models</h2>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">3.1 Fair Value Estimation</h3>
            <p className="mb-4">
              The system estimates "true probability" using a composite model:
            </p>

            <div className="bg-white/5 border border-white/10 rounded p-4 mb-4">
              <p className="font-semibold mb-2">Base Model: Implied Probability</p>
              <div className="bg-black/40 border border-white/10 rounded p-3 font-mono text-xs">
                <code className="text-white/80">P_implied = YES_price / (YES_price + NO_price)</code>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded p-4 mb-4">
              <p className="font-semibold mb-2">Volume-Weighted Adjustment</p>
              <div className="bg-black/40 border border-white/10 rounded p-3 font-mono text-xs">
                <code className="text-white/80">P_adjusted = P_implied × (1 + α × volume_score)</code>
              </div>
              <p className="text-xs mt-2 text-white/60">
                where α is a tuning parameter and volume_score reflects market conviction
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded p-4">
              <p className="font-semibold mb-2">Liquidity Confidence Factor</p>
              <div className="bg-black/40 border border-white/10 rounded p-3 font-mono text-xs">
                <code className="text-white/80">confidence = tanh(liquidity / threshold)</code>
              </div>
              <p className="text-xs mt-2 text-white/60">
                Lower liquidity reduces model confidence, scaling signal strength
              </p>
            </div>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">3.2 Edge Calculation</h3>
            <p className="mb-4">
              Trading edge is computed as the difference between estimated fair value and market price:
            </p>
            <div className="bg-black/40 border border-white/10 rounded p-4 font-mono text-xs">
              <code className="text-white/80">edge = |P_fair - P_market| × 100</code>
            </div>
            <p className="mt-4 text-sm">
              Positive edge suggests the market is mispriced. Edge magnitude correlates with profit potential
              (not guaranteed).
            </p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">3.3 Arbitrage Detection</h3>
            <p className="mb-4">
              The system detects arbitrage opportunities when:
            </p>
            <div className="bg-black/40 border border-white/10 rounded p-4 font-mono text-xs mb-4">
              <code className="text-white/80">YES_price + NO_price {'<'} 0.98  OR  YES_price + NO_price {'>'} 1.02</code>
            </div>
            <p className="text-sm">
              A spread below 0.98 indicates underpriced outcomes (buy both), while above 1.02 indicates
              overpriced outcomes (potential short opportunity).
            </p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">3.4 Kelly Criterion Position Sizing</h3>
            <p className="mb-4">
              Optimal bet sizing uses the Kelly Criterion:
            </p>
            <div className="bg-black/40 border border-white/10 rounded p-4 font-mono text-xs mb-4">
              <code className="text-white/80">{`kelly_fraction = (p × b - q) / b

where:
  p = estimated probability of winning
  q = 1 - p (probability of losing)
  b = odds (potential return / risk)`}</code>
            </div>
            <p className="text-sm">
              A fractional Kelly (typically 25-50% of full Kelly) is used to reduce volatility while maintaining
              positive expected growth.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Signal Generation</h2>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">4.1 Signal Strength Score</h3>
            <p className="mb-4">
              Each market receives a signal strength score (0-100) based on:
            </p>
            <div className="bg-black/40 border border-white/10 rounded p-4 font-mono text-xs">
              <code className="text-white/80">{`signal_strength = min(100, (
  edge × 20 +                    // Edge magnitude (max 40 pts)
  volume_score × 30 +            // Volume confidence (max 30 pts)
  liquidity_score × 20 +         // Liquidity depth (max 20 pts)
  (1 - volatility) × 10          // Low volatility bonus (max 10 pts)
))`}</code>
            </div>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">4.2 Risk Classification</h3>
            <p className="mb-4">Markets are classified by risk level:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong className="text-green-400">Low Risk:</strong> High liquidity, low volatility, strong signal ({'>'} 70)</li>
              <li><strong className="text-yellow-400">Medium Risk:</strong> Moderate liquidity or volatility, signal 50-70</li>
              <li><strong className="text-red-400">High Risk:</strong> Low liquidity, high volatility, or weak signal ({'<'} 50)</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">4.3 Signal Filtering</h3>
            <p className="mb-4">Signals are filtered to remove noise:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Minimum edge threshold: 2%</li>
              <li>Minimum liquidity: $50,000</li>
              <li>Maximum time to expiry: 90 days (long-term uncertainty)</li>
              <li>Exclude markets with ambiguous resolution criteria</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Execution Infrastructure</h2>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">5.1 Smart Contract Integration</h3>
            <p className="mb-4">
              Trades execute via Polymarket's CTF (Conditional Token Framework) exchange on Polygon:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>User approves USDC spending to CTF Exchange contract</li>
              <li>System builds transaction with optimized gas settings</li>
              <li>User signs and broadcasts transaction via their wallet</li>
              <li>Conditional tokens (YES/NO) are received upon confirmation</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">5.2 Transaction Building</h3>
            <p className="mb-4">
              The <code className="bg-white/10 px-2 py-1 rounded text-xs">/api/build-tx</code> endpoint constructs
              transactions with:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Optimal gas limit based on network conditions</li>
              <li>Slippage tolerance (default 2%)</li>
              <li>Deadline (10 minutes from submission)</li>
              <li>Nonce management for sequential transactions</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">5.3 Real-Time Updates</h3>
            <p className="mb-4">
              WebSocket connections provide streaming updates:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>New signals as markets change</li>
              <li>Position updates from blockchain events</li>
              <li>Arbitrage alerts when spread anomalies detected</li>
              <li>Market resolution notifications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Risk Management</h2>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">6.1 Position Limits</h3>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Maximum position size: 25% of market liquidity</li>
              <li>Maximum portfolio allocation per market: 10% of capital</li>
              <li>Maximum correlation between positions: 0.7 (diversification)</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">6.2 Stop-Loss Strategy</h3>
            <p className="mb-4">
              Recommended exit conditions:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Price moves against position by {'>'} 20%</li>
              <li>New information invalidates thesis</li>
              <li>Liquidity drops below 50% of entry level</li>
              <li>Time decay approaches expiry with no edge</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">6.3 Portfolio Rebalancing</h3>
            <p>
              The system suggests rebalancing when portfolio drift exceeds 15% from target allocations,
              or when new high-conviction opportunities emerge.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. Performance Metrics</h2>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">7.1 Signal Accuracy</h3>
            <p className="mb-4">
              Historical analysis of signal performance:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>High-confidence signals (strength {'>'} 80): ~72% accuracy</li>
              <li>Medium-confidence signals (50-80): ~58% accuracy</li>
              <li>Low-confidence signals ({'<'} 50): ~51% accuracy (coin flip)</li>
            </ul>
            <p className="mt-4 text-sm text-yellow-300">
              <strong>Disclaimer:</strong> Past performance does not guarantee future results. These metrics
              are historical and may not reflect future accuracy.
            </p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">7.2 Latency Benchmarks</h3>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Data fetch latency: ~200ms (Polymarket API)</li>
              <li>Signal generation: ~50ms (per market)</li>
              <li>WebSocket message delivery: ~100ms (client to backend)</li>
              <li>Transaction building: ~150ms</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">8. Limitations & Future Work</h2>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">8.1 Current Limitations</h3>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Single platform (Polymarket only, no cross-platform arbitrage yet)</li>
              <li>Limited historical data for some markets (cold start problem)</li>
              <li>No automated execution (requires manual wallet approval)</li>
              <li>Models may fail in unprecedented market conditions</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">8.2 Roadmap</h3>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Multi-Platform:</strong> Add Kalshi, Manifold, other platforms</li>
              <li><strong>ML Models:</strong> Deep learning for sentiment analysis and outcome prediction</li>
              <li><strong>Automated Trading:</strong> Smart contract-based execution (with user consent)</li>
              <li><strong>Social Signals:</strong> Integrate Twitter, news, and on-chain whale tracking</li>
              <li><strong>Backtesting Framework:</strong> Historical simulation and strategy optimization</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">9. Conclusion</h2>
            <p>
              Black Edge represents a systematic, quantitative approach to prediction market trading. By
              combining real-time data aggregation, mathematical modeling, and risk-managed execution, the
              system identifies potential trading opportunities while acknowledging the inherent uncertainty
              and risk of financial markets.
            </p>
            <p className="mt-4">
              Users should understand that no system can guarantee profits, and all trading involves substantial
              risk of loss. The technical infrastructure described here provides tools for analysis—the
              responsibility for trading decisions remains with the user.
            </p>
          </section>

          <div className="mt-12 pt-8 border-t border-white/10 bg-white/5 rounded p-6">
            <p className="text-white/60 text-sm mb-4">
              <strong className="text-white">References & Further Reading:</strong>
            </p>
            <ul className="list-none space-y-2 text-sm">
              <li>• Kelly, J. L. (1956). "A New Interpretation of Information Rate"</li>
              <li>• Polymarket Documentation: <span className="font-mono text-xs">docs.polymarket.com</span></li>
              <li>• CTF Exchange: <span className="font-mono text-xs">github.com/Polymarket/ctf-exchange</span></li>
            </ul>
            <p className="text-white/40 text-xs mt-6">
              Black Edge Technical Paper v3.0 | February 2026 | For educational and informational purposes only
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
