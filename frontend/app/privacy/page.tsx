import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Privacy Policy - Black Edge',
  description: 'Black Edge Privacy Policy and Data Protection',
}

export default function PrivacyPolicy() {
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

        <h1 className="text-4xl font-bold mb-2 tracking-tight">Privacy Policy</h1>
        <p className="text-white/40 text-sm mb-8">Last Updated: February 8, 2026</p>

        <div className="space-y-8 text-white/70 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Introduction</h2>
            <p>
              Black Edge ("we," "our," or "us") respects your privacy and is committed to protecting your
              personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your
              information when you use our Service.
            </p>
            <p className="mt-4">
              By using Black Edge, you consent to the data practices described in this Privacy Policy. If you
              do not agree with our policies and practices, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Information We Collect</h2>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">2.1 Information You Provide</h3>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Account Information:</strong> Email address, username, profile information</li>
              <li><strong>Payment Information:</strong> Billing details (processed securely through Stripe)</li>
              <li><strong>Communications:</strong> Messages you send to us, support requests, feedback</li>
              <li><strong>Wallet Address:</strong> Public blockchain addresses when you connect your wallet</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">2.2 Information Collected Automatically</h3>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Usage Data:</strong> Pages visited, features used, time spent, interactions</li>
              <li><strong>Device Information:</strong> Browser type, operating system, device identifiers</li>
              <li><strong>Log Data:</strong> IP address, access times, error logs</li>
              <li><strong>Cookies and Tracking:</strong> Session data, preferences, analytics</li>
              <li><strong>Trading Activity:</strong> Markets viewed, positions taken, trading history</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">2.3 Information from Third Parties</h3>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Blockchain Data:</strong> Public transaction data from Polygon and other networks</li>
              <li><strong>Market Data:</strong> Data from Polymarket and other prediction market platforms</li>
              <li><strong>Wallet Providers:</strong> Information from WalletConnect, MetaMask, etc.</li>
              <li><strong>Analytics Services:</strong> Aggregated data from Vercel Analytics, etc.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. How We Use Your Information</h2>
            <p className="mb-4">We use your information to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Provide, operate, and maintain the Service</li>
              <li>Process your transactions and manage your account</li>
              <li>Send you important updates, security alerts, and support messages</li>
              <li>Personalize your experience and deliver relevant content</li>
              <li>Analyze usage patterns and improve the Service</li>
              <li>Detect, prevent, and address technical issues and fraud</li>
              <li>Comply with legal obligations and enforce our Terms</li>
              <li>Send marketing communications (with your consent)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Legal Bases for Processing (GDPR)</h2>
            <p className="mb-4">
              If you are in the European Economic Area (EEA), we process your personal data based on:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Consent:</strong> You have given explicit consent for specific processing</li>
              <li><strong>Contract:</strong> Processing is necessary to provide the Service to you</li>
              <li><strong>Legal Obligation:</strong> Processing is required to comply with laws</li>
              <li><strong>Legitimate Interests:</strong> Processing is necessary for our business operations,
                provided your rights do not override those interests</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. How We Share Your Information</h2>
            <p className="mb-4">We may share your information with:</p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">5.1 Service Providers</h3>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Payment Processors:</strong> Stripe for payment processing</li>
              <li><strong>Cloud Services:</strong> Vercel, Railway for hosting and infrastructure</li>
              <li><strong>Analytics:</strong> Vercel Analytics for usage analytics</li>
              <li><strong>Email Services:</strong> For transactional and marketing emails</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">5.2 Legal Requirements</h3>
            <p className="ml-4">
              We may disclose your information if required by law, court order, or government request, or
              to protect our rights, safety, or property.
            </p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">5.3 Business Transfers</h3>
            <p className="ml-4">
              If Black Edge is involved in a merger, acquisition, or sale of assets, your information may be
              transferred as part of that transaction.
            </p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">5.4 Public Blockchain Data</h3>
            <p className="ml-4">
              Transactions on public blockchains (Polygon, Ethereum, etc.) are publicly visible and permanent.
              We do not control this data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Data Retention</h2>
            <p>
              We retain your personal information for as long as necessary to provide the Service and comply
              with legal obligations. When you delete your account, we will delete or anonymize your data
              within 90 days, except where we are required to retain it by law.
            </p>
            <p className="mt-4">
              Note: Blockchain transactions cannot be deleted due to the immutable nature of blockchain technology.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. Data Security</h2>
            <p className="mb-4">
              We implement appropriate technical and organizational measures to protect your data, including:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Encryption of data in transit (HTTPS/TLS)</li>
              <li>Secure cloud infrastructure with access controls</li>
              <li>Regular security audits and monitoring</li>
              <li>Employee training on data protection</li>
              <li>Incident response procedures</li>
            </ul>
            <p className="mt-4">
              However, no method of transmission or storage is 100% secure. We cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">8. Your Privacy Rights</h2>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">8.1 General Rights</h3>
            <p className="mb-4">You have the right to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict processing</li>
              <li>Data portability (receive your data in a structured format)</li>
              <li>Withdraw consent at any time</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">8.2 EEA Residents (GDPR)</h3>
            <p className="ml-4">
              If you are in the EEA, you have additional rights under GDPR, including the right to lodge a
              complaint with your local data protection authority.
            </p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">8.3 California Residents (CCPA)</h3>
            <p className="ml-4 mb-2">
              If you are a California resident, you have the right to:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-8">
              <li>Know what personal information we collect and how it's used</li>
              <li>Delete your personal information</li>
              <li>Opt-out of the sale of your information (we do not sell your information)</li>
              <li>Non-discrimination for exercising your privacy rights</li>
            </ul>

            <p className="mt-6">
              To exercise your rights, contact us at <span className="font-mono text-sm">privacy@blackedge.io</span>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">9. Cookies and Tracking Technologies</h2>
            <p className="mb-4">We use cookies and similar tracking technologies to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Essential Cookies:</strong> Required for the Service to function (authentication, security)</li>
              <li><strong>Analytics Cookies:</strong> Help us understand usage patterns</li>
              <li><strong>Preference Cookies:</strong> Remember your settings and preferences</li>
            </ul>
            <p className="mt-4">
              You can control cookies through your browser settings. Note that disabling cookies may limit
              functionality.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">10. International Data Transfers</h2>
            <p>
              Your information may be transferred to and processed in countries other than your own. We ensure
              appropriate safeguards are in place for international transfers, including Standard Contractual
              Clauses approved by the European Commission.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">11. Children's Privacy</h2>
            <p>
              The Service is not intended for children under 18. We do not knowingly collect information from
              children. If you believe we have collected information from a child, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">12. Third-Party Links</h2>
            <p>
              The Service may contain links to third-party websites. We are not responsible for the privacy
              practices of these sites. We encourage you to read their privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">13. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Changes will be posted on this page with
              an updated "Last Updated" date. Your continued use of the Service after changes constitutes
              acceptance of the updated Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">14. Contact Us</h2>
            <p className="mb-4">
              For questions about this Privacy Policy or to exercise your privacy rights, contact us at:
            </p>
            <p className="font-mono text-sm">
              Email: privacy@blackedge.io<br />
              Data Protection Officer: dpo@blackedge.io<br />
              Address: [Your Company Address]
            </p>
          </section>

          <div className="mt-12 pt-8 border-t border-white/10">
            <p className="text-white/40 text-sm">
              By using Black Edge, you acknowledge that you have read and understood this Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
