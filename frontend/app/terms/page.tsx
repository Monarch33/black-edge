import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Terms of Service - Black Edge',
  description: 'Black Edge Terms of Service and User Agreement',
}

export default function TermsOfService() {
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

        <h1 className="text-4xl font-bold mb-2 tracking-tight">Terms of Service</h1>
        <p className="text-white/40 text-sm mb-8">Last Updated: February 8, 2026</p>

        <div className="space-y-8 text-white/70 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Black Edge ("the Service"), you agree to be bound by these Terms of Service
              ("Terms"). If you do not agree to these Terms, do not use the Service.
            </p>
            <p className="mt-4">
              Black Edge is a prediction market analysis and trading platform. The Service provides algorithmic
              analysis, market data, and trading tools for prediction markets including Polymarket and other platforms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Description of Service</h2>
            <p className="mb-4">Black Edge provides:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Real-time prediction market data aggregation and analysis</li>
              <li>Algorithmic trading signals and arbitrage detection</li>
              <li>Market analytics and quantitative models</li>
              <li>Trading interface for executing positions on supported platforms</li>
              <li>Portfolio tracking and risk management tools</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. User Eligibility</h2>
            <p className="mb-4">To use the Service, you must:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Be at least 18 years of age</li>
              <li>Have the legal capacity to enter into binding contracts</li>
              <li>Not be prohibited from using the Service under applicable laws</li>
              <li>Comply with all local laws regarding online conduct and acceptable content</li>
              <li>Not be located in a jurisdiction where prediction markets are prohibited</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. No Financial Advice</h2>
            <p className="mb-4">
              <strong className="text-red-400">IMPORTANT: Black Edge does not provide financial advice.</strong>
            </p>
            <p className="mb-4">
              The Service provides analytical tools, market data, and algorithmic signals for informational
              purposes only. Nothing on the Service constitutes:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Financial, investment, trading, or legal advice</li>
              <li>A recommendation to buy, sell, or hold any position</li>
              <li>A guarantee of profit or return on investment</li>
              <li>Professional advice tailored to your specific circumstances</li>
            </ul>
            <p className="mt-4">
              You are solely responsible for your own investment decisions. Always conduct your own research
              and consult with qualified financial professionals before making investment decisions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Risk Acknowledgment</h2>
            <p className="mb-4">
              You acknowledge and agree that:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Trading prediction markets involves substantial risk of loss</li>
              <li>Past performance does not guarantee future results</li>
              <li>You may lose all capital invested in any position</li>
              <li>Market conditions can change rapidly and unpredictably</li>
              <li>Algorithmic signals and analysis may be inaccurate or incorrect</li>
              <li>You are solely responsible for assessing your own risk tolerance</li>
            </ul>
            <p className="mt-4">
              See our <Link href="/risk-disclosure" className="text-red-400 hover:text-red-300 underline">Risk Disclosure</Link> for
              a comprehensive explanation of the risks involved.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Account Registration and Security</h2>
            <p className="mb-4">
              To use certain features, you may need to connect a Web3 wallet or create an account. You agree to:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Provide accurate and complete information</li>
              <li>Maintain the security of your wallet private keys</li>
              <li>Not share your account credentials with others</li>
              <li>Notify us immediately of any unauthorized access</li>
              <li>Accept responsibility for all activities under your account</li>
            </ul>
            <p className="mt-4">
              Black Edge is not responsible for losses resulting from unauthorized access to your account or wallet.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. Prohibited Activities</h2>
            <p className="mb-4">You agree not to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Use the Service for any illegal purpose or in violation of any laws</li>
              <li>Attempt to manipulate markets or engage in market manipulation</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
              <li>Use automated tools to scrape data without permission</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Impersonate any person or entity</li>
              <li>Transmit viruses, malware, or harmful code</li>
              <li>Violate the rights of other users or third parties</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">8. Intellectual Property</h2>
            <p className="mb-4">
              All content, features, and functionality of the Service are owned by Black Edge and are protected
              by international copyright, trademark, and other intellectual property laws.
            </p>
            <p>
              You may not copy, modify, distribute, sell, or lease any part of the Service without our
              explicit written permission.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">9. Third-Party Services</h2>
            <p className="mb-4">
              The Service integrates with third-party platforms including Polymarket, wallet providers,
              and blockchain networks. Your use of these services is subject to their respective terms
              and conditions.
            </p>
            <p>
              Black Edge is not responsible for the availability, accuracy, or functionality of third-party
              services. We do not endorse or guarantee any third-party content or services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">10. Fees and Payments</h2>
            <p className="mb-4">
              Certain features of the Service may require payment of fees. By subscribing to a paid plan:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>You agree to pay all applicable fees as described</li>
              <li>Fees are non-refundable except as required by law</li>
              <li>We reserve the right to change fees with 30 days notice</li>
              <li>You authorize recurring charges for subscription plans</li>
              <li>Failure to pay may result in service suspension or termination</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">11. Disclaimers and Limitations of Liability</h2>
            <p className="mb-4">
              <strong className="text-white">THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND.</strong>
            </p>
            <p className="mb-4">
              Black Edge disclaims all warranties, express or implied, including:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Warranties of merchantability or fitness for a particular purpose</li>
              <li>Warranties that the Service will be uninterrupted or error-free</li>
              <li>Warranties regarding the accuracy or reliability of data or analysis</li>
              <li>Warranties that defects will be corrected</li>
            </ul>
            <p className="mt-4">
              <strong className="text-white">TO THE MAXIMUM EXTENT PERMITTED BY LAW, BLACK EDGE SHALL NOT BE LIABLE FOR:</strong>
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4 mt-4">
              <li>Any indirect, incidental, special, consequential, or punitive damages</li>
              <li>Loss of profits, revenue, data, or use</li>
              <li>Trading losses or investment losses</li>
              <li>Damages resulting from third-party services or platforms</li>
              <li>Damages exceeding the amount you paid to Black Edge in the past 12 months</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">12. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless Black Edge and its officers, directors,
              employees, and agents from any claims, liabilities, damages, losses, and expenses arising
              from your use of the Service, violation of these Terms, or violation of any rights of another.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">13. Termination</h2>
            <p className="mb-4">
              We reserve the right to suspend or terminate your access to the Service at any time, with
              or without cause, with or without notice, for any reason including:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Violation of these Terms</li>
              <li>Fraudulent, abusive, or illegal activity</li>
              <li>Extended periods of inactivity</li>
              <li>At our sole discretion</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">14. Governing Law and Dispute Resolution</h2>
            <p className="mb-4">
              These Terms shall be governed by and construed in accordance with the laws of [Your Jurisdiction],
              without regard to conflict of law principles.
            </p>
            <p>
              Any disputes arising from these Terms or the Service shall be resolved through binding arbitration
              in accordance with the rules of [Arbitration Association], except where prohibited by law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">15. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. Changes will be effective immediately
              upon posting to the Service. Your continued use of the Service after changes constitutes
              acceptance of the modified Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">16. Severability</h2>
            <p>
              If any provision of these Terms is found to be unenforceable or invalid, that provision shall
              be limited or eliminated to the minimum extent necessary, and the remaining provisions shall
              remain in full force and effect.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">17. Contact Information</h2>
            <p className="mb-4">
              For questions about these Terms, please contact us at:
            </p>
            <p className="font-mono text-sm">
              Email: legal@blackedge.io<br />
              Address: [Your Company Address]
            </p>
          </section>

          <div className="mt-12 pt-8 border-t border-white/10">
            <p className="text-white/40 text-sm">
              By using Black Edge, you acknowledge that you have read, understood, and agree to be bound
              by these Terms of Service.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
