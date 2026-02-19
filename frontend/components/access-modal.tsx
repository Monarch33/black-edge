"use client"

import { useState, useEffect } from "react"
import { useAccount } from "wagmi"
import {
  createCheckoutSession,
  isStripeConfigured,
  TIER_PRICES,
  type StripeTier,
} from "@/lib/stripe"
import { toast } from "sonner"

interface AccessModalProps {
  isOpen: boolean
  onClose: () => void
  defaultTier?: StripeTier
}

export function AccessModal({ isOpen, onClose, defaultTier = "runner" }: AccessModalProps) {
  const { address } = useAccount()
  const [loading, setLoading] = useState(false)
  const [selectedTier, setSelectedTier] = useState<StripeTier>(defaultTier)

  useEffect(() => {
    if (isOpen) setSelectedTier(defaultTier)
  }, [isOpen, defaultTier])

  const handleSubscribe = async (tier: StripeTier = selectedTier) => {
    if (!address || !TIER_PRICES[tier]?.priceId) {
      if (!TIER_PRICES[tier]?.priceId) {
        toast.error("Stripe price not configured. Set NEXT_PUBLIC_STRIPE_PRICE_ID_RUNNER.")
      } else {
        toast.error("Connect your wallet first")
      }
      return
    }

    setLoading(true)
    try {
      const result = await createCheckoutSession(tier, address, {
        successUrl: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/#pricing`,
      })
      if (!result?.url) {
        toast.error("Failed to create checkout session")
        return
      }
      window.location.href = result.url
    } catch (e) {
      toast.error("Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const tiers: StripeTier[] = ["runner", "whale"]
  const currentTier = TIER_PRICES[selectedTier]
  const hasPrice = !!currentTier?.priceId
  const isEdge = selectedTier === "whale"

  return (
    <div
      className="access-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="access-modal-title"
    >
      <div
        className="access-modal-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="access-modal-edge-glow" />
        {isEdge && (
          <div className="access-particles" aria-hidden>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <span key={i} />
            ))}
          </div>
        )}
        <div className="access-modal-content">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 id="access-modal-title" className="access-modal-title">
                GET ACCESS
              </h2>
              <p className="access-modal-subtitle">
                Subscribe to unlock the autonomous bot terminal. After payment, configure your Polymarket API keys and activate the agent.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="access-detail-mono text-white/40 hover:text-white text-xl leading-none p-2 -m-2 transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {!address && (
            <p className="access-detail-mono text-amber-400/80 text-xs mb-6 tracking-wider">
              Connect your wallet first to subscribe.
            </p>
          )}

          <div className="flex gap-4 mb-6 flex-wrap">
            {tiers.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedTier(t)}
                className={`access-detail-mono flex-1 min-w-[140px] py-3 px-4 text-[10px] tracking-wider border transition-all ${
                  selectedTier === t
                    ? "border-[#10b981] text-[#10b981] bg-[#10b981]/10"
                    : "border-white/20 text-white/50 hover:border-white/40 hover:text-white/70"
                }`}
              >
                {TIER_PRICES[t].name} — ${TIER_PRICES[t].amount}
              </button>
            ))}
          </div>

          <div
            className={`relative p-8 rounded border ${
              isEdge ? "access-tier-edge" : "access-tier-runner"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div>
                <span className="access-detail-mono text-[#10b981] font-bold text-[10px] tracking-widest block mb-2">
                  {currentTier.name}
                </span>
                <div className="flex items-baseline gap-2">
                  <span className={`access-price-syne text-4xl sm:text-5xl text-white`}>
                    ${currentTier.amount}
                  </span>
                  <span className="access-detail-mono text-white/40 text-sm">/ month</span>
                </div>
                {selectedTier === "runner" && (
                  <p className="access-detail-mono text-[10px] text-white/35 mt-2 tracking-wider">
                    Limited slots available at this rate
                  </p>
                )}
                <ul className="access-detail-mono text-[10px] text-white/50 space-y-2 mt-6">
                  {currentTier.features.slice(0, 6).map((f, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="text-[#10b981]">✓</span> {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="sm:shrink-0">
                <button
                  type="button"
                  onClick={() => handleSubscribe()}
                  disabled={!address || loading || !hasPrice}
                  className="w-full sm:w-auto px-10 py-4 border-2 border-[#10b981] text-[#10b981] access-detail-mono text-[10px] tracking-widest hover:bg-[#10b981]/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "REDIRECTING..." : hasPrice ? `PAY $${currentTier.amount} — UNLOCK` : "PRICE NOT CONFIGURED"}
                </button>
              </div>
            </div>
          </div>

          {address && (
            <button
              type="button"
              onClick={() => {
                onClose()
                window.location.href = "/dashboard"
              }}
              className="access-detail-mono w-full py-3 text-white/40 text-[10px] tracking-wider hover:text-white/70 transition-colors mt-4"
            >
              Already subscribed? Go to Dashboard →
            </button>
          )}

          <div className="access-reassurance mt-auto">
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <span>Secure Institutional Grade Encryption</span>
              <span>Powered by Stripe & Polymarket</span>
            </div>
          </div>

          {!isStripeConfigured() && (
            <p className="access-detail-mono mt-4 text-amber-400/80 text-[10px] tracking-wider">
              Stripe is not configured. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and STRIPE_SECRET_KEY.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
