import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Risk Disclosure - Black Edge',
  description: 'Important Risk Disclosure for Black Edge Users',
}

export default function RiskDisclosure() {
  return (
    <div className="min-h-screen bg-[#0D0D1A] text-white">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-white/40 hover:text-white/80 transition-colors mb-8 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="flex items-start gap-4 mb-6">
          <AlertTriangle className="w-10 h-10 text-red-500 flex-shrink-0" />
          <div>
            <h1 className="text-4xl font-bold mb-2 tracking-tight">Risk Disclosure</h1>
            <p className="text-red-400 font-semibold">READ THIS CAREFULLY BEFORE USING THE SERVICE</p>
          </div>
        </div>

        <p className="text-white/40 text-sm mb-8">Last Updated: February 8, 2026</p>

        <div className="bg-red-500/10 border border-red-500/30 rounded p-6 mb-8">
          <p className="text-red-200 font-semibold mb-2">⚠️ IMPORTANT WARNING</p>
          <p className="text-white/80 leading-relaxed">
            Trading prediction markets carries significant risk. You can lose all capital invested. Only trade
            with money you can afford to lose. This disclosure explains the risks involved. If you do not
            understand these risks, do not use the Service.
          </p>
        </div>

        <div className="space-y-8 text-white/70 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. General Investment Risk</h2>
            <p className="mb-4">
              <strong className="text-white">All investments carry risk.</strong> When you trade prediction
              markets through Black Edge, you are exposing yourself to significant financial risk, including:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Complete loss of your invested capital</li>
              <li>Partial losses greater than 50% of your investment</li>
              <li>Losses that exceed your initial expectations</li>
              <li>Opportunity cost from capital being tied up in positions</li>
            </ul>
            <p className="mt-4 text-red-300">
              <strong>YOU SHOULD NEVER INVEST MORE THAN YOU CAN AFFORD TO LOSE.</strong>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Prediction Market Risks</h2>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">2.1 Market Volatility</h3>
            <p className="mb-4">
              Prediction markets can be extremely volatile. Prices can change rapidly due to:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Breaking news and real-world events</li>
              <li>Market sentiment shifts</li>
              <li>Large trades by other participants</li>
              <li>Low liquidity conditions</li>
              <li>Manipulation attempts</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">2.2 Binary Outcomes</h3>
            <p>
              Most prediction markets have binary YES/NO outcomes. This means you can lose 100% of your
              position if the outcome resolves against you. Unlike traditional investments, there is no
              partial recovery in many cases.
            </p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">2.3 Resolution Risk</h3>
            <p className="mb-4">
              Markets are resolved based on real-world outcomes, which carry risks:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Ambiguous or disputed outcomes</li>
              <li>Delayed resolutions</li>
              <li>Resolution according to specific terms you may not fully understand</li>
              <li>Potential for incorrect resolutions (though rare)</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">2.4 Liquidity Risk</h3>
            <p>
              Some markets may have low liquidity, meaning:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>You may not be able to exit positions at desired prices</li>
              <li>Large trades can significantly move prices</li>
              <li>Bid-ask spreads may be wide, increasing transaction costs</li>
              <li>You may be unable to close positions before resolution</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. Platform and Technical Risks</h2>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">3.1 Smart Contract Risk</h3>
            <p>
              Prediction markets on Polymarket and other platforms use smart contracts on blockchain networks.
              Smart contracts carry risks including:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Bugs or vulnerabilities in contract code</li>
              <li>Exploits by malicious actors</li>
              <li>Unintended behavior or edge cases</li>
              <li>Irreversible transactions</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">3.2 Blockchain Network Risk</h3>
            <p>
              Transactions occur on blockchain networks (Polygon, Ethereum, etc.) which have inherent risks:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Network congestion causing delays or failed transactions</li>
              <li>High gas fees during peak usage</li>
              <li>Network forks or protocol changes</li>
              <li>Potential network outages or attacks</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">3.3 Wallet and Security Risk</h3>
            <p>
              Your funds are controlled by your wallet private keys:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Lost private keys mean lost funds permanently</li>
              <li>Compromised keys can result in theft of all assets</li>
              <li>Phishing attacks targeting wallet users</li>
              <li>Malicious wallet software or browser extensions</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">3.4 Platform Availability</h3>
            <p>
              Black Edge and integrated platforms (Polymarket, etc.) may experience:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Technical outages or downtime</li>
              <li>Maintenance periods</li>
              <li>Service degradation during high traffic</li>
              <li>Discontinuation of services</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Algorithmic and Data Risks</h2>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">4.1 No Guarantee of Accuracy</h3>
            <p className="mb-4 text-red-300">
              <strong>CRITICAL: Black Edge's algorithms, signals, and analysis provide NO GUARANTEE of accuracy
              or profitability.</strong>
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Algorithmic predictions can be completely wrong</li>
              <li>Past performance does not indicate future results</li>
              <li>Market conditions change in unpredictable ways</li>
              <li>Models may fail in unprecedented situations</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">4.2 Data Quality Risk</h3>
            <p>
              Our analysis depends on data from third parties which may be:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Delayed, incomplete, or inaccurate</li>
              <li>Subject to manipulation or errors</li>
              <li>Unavailable during critical periods</li>
              <li>Misinterpreted by our systems</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">4.3 Execution Risk</h3>
            <p>
              Automated or suggested trades may fail due to:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Slippage (price movement during execution)</li>
              <li>Insufficient liquidity</li>
              <li>Transaction failures</li>
              <li>Gas price fluctuations</li>
              <li>Front-running by other traders</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Regulatory and Legal Risks</h2>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">5.1 Regulatory Uncertainty</h3>
            <p>
              Prediction markets exist in a complex and evolving regulatory environment:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Laws and regulations may change without notice</li>
              <li>Prediction markets may become restricted or prohibited</li>
              <li>Tax treatment is complex and may change</li>
              <li>Regulatory enforcement actions could impact the industry</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">5.2 Tax Implications</h3>
            <p>
              Trading prediction markets may have tax consequences:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Gains may be subject to capital gains tax</li>
              <li>Tax reporting requirements vary by jurisdiction</li>
              <li>You are responsible for understanding and complying with tax obligations</li>
              <li>Failure to report may result in penalties</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">5.3 Jurisdictional Restrictions</h3>
            <p>
              Prediction markets may be restricted or illegal in your jurisdiction. You are responsible
              for ensuring your use of the Service complies with all applicable laws.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. No Financial Advice</h2>
            <p className="mb-4 text-red-300">
              <strong>BLACK EDGE DOES NOT PROVIDE FINANCIAL ADVICE.</strong>
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>All analysis and signals are for informational purposes only</li>
              <li>Nothing on the Service constitutes a recommendation to trade</li>
              <li>We do not know your individual financial situation or risk tolerance</li>
              <li>You should consult with qualified financial professionals</li>
              <li>You are solely responsible for your investment decisions</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. Past Performance</h2>
            <p className="text-red-300 mb-4">
              <strong>PAST PERFORMANCE IS NOT INDICATIVE OF FUTURE RESULTS.</strong>
            </p>
            <p>
              Any historical returns, backtests, or performance data shown on the Service:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Do not guarantee similar future performance</li>
              <li>May not reflect actual trading conditions</li>
              <li>Do not account for all costs and fees</li>
              <li>Are based on assumptions that may not hold in the future</li>
              <li>May have been subject to survivor bias or other biases</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">8. Psychological and Emotional Risks</h2>
            <p className="mb-4">
              Trading can have psychological effects:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Stress and anxiety from market volatility</li>
              <li>Emotional decision-making leading to poor outcomes</li>
              <li>Addiction or compulsive trading behavior</li>
              <li>Impact on personal relationships and well-being</li>
            </ul>
            <p className="mt-4">
              If you experience negative psychological effects from trading, seek professional help and
              consider stopping immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">9. Third-Party Platform Risks</h2>
            <p className="mb-4">
              Black Edge integrates with third-party platforms (Polymarket, wallet providers, etc.). These
              platforms have their own risks:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Platform insolvency or shutdown</li>
              <li>Changes to terms of service</li>
              <li>Account suspension or termination</li>
              <li>Security breaches or hacks</li>
              <li>Disputes over market resolutions</li>
            </ul>
            <p className="mt-4">
              Black Edge is not responsible for the actions or failures of third-party platforms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">10. Limitation of Liability</h2>
            <p className="mb-4">
              As stated in our <Link href="/terms" className="text-red-400 hover:text-red-300 underline">Terms of Service</Link>,
              Black Edge's liability is limited. We are not liable for:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Trading losses or investment losses</li>
              <li>Inaccurate data or analysis</li>
              <li>Technical failures or outages</li>
              <li>Actions of third parties</li>
              <li>Any indirect, consequential, or punitive damages</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">11. Your Responsibilities</h2>
            <p className="mb-4">Before trading, you must:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Understand the risks described in this disclosure</li>
              <li>Assess your own financial situation and risk tolerance</li>
              <li>Only invest money you can afford to lose</li>
              <li>Conduct your own research and due diligence</li>
              <li>Understand the specific markets and outcomes you're trading</li>
              <li>Comply with all applicable laws and regulations</li>
              <li>Secure your wallet and private keys</li>
              <li>Monitor your positions and manage risk appropriately</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">12. Questions or Concerns</h2>
            <p>
              If you have questions about these risks or do not understand any aspect of prediction market
              trading, contact us at <span className="font-mono text-sm">risk@blackedge.io</span> or consult
              with a qualified financial advisor before trading.
            </p>
          </section>

          <div className="mt-12 pt-8 border-t border-red-500/20 bg-red-500/5 rounded p-6">
            <p className="text-red-200 font-semibold mb-4">ACKNOWLEDGMENT</p>
            <p className="text-white/80 leading-relaxed">
              By using Black Edge, you acknowledge that you have read, understood, and accept all the risks
              described in this Risk Disclosure. You understand that trading prediction markets is highly
              risky and you could lose all invested capital. You agree that you are solely responsible for
              your trading decisions and outcomes.
            </p>
            <p className="text-red-300 font-semibold mt-4">
              IF YOU DO NOT ACCEPT THESE RISKS, DO NOT USE THE SERVICE.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
