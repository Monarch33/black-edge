"use client"

import { useState, useEffect } from "react"
import { useAccount } from "wagmi"
import { Lock } from "lucide-react"
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
        style={{
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(16,185,129,0.2)",
          boxShadow:
            "0 0 50px rgba(16,185,129,0.1), 0 0 0 1px rgba(255,255,255,0.03) inset",
        }}
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

        {/* Top scan line */}
        <div
          style={{
            height: 1,
            background:
              "linear-gradient(90deg, transparent, rgba(16,185,129,0.6) 40%, rgba(16,185,129,0.6) 60%, transparent)",
          }}
        />

        <div className="access-modal-content">
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div className="flex-1">
              <p className="access-detail-mono text-[9px] tracking-[0.35em] text-emerald-500/50 mb-4 uppercase">
                // ACCESS PROTOCOL v3.0
              </p>

              <div className="flex items-center gap-4 mb-4">
                <div
                  style={{
                    padding: 12,
                    border: "1px solid rgba(16,185,129,0.3)",
                    borderRadius: 8,
                    background: "rgba(16,185,129,0.06)",
                    animation: "doomerPulse 2.5s ease-in-out infinite",
                    flexShrink: 0,
                  }}
                >
                  <Lock size={22} color="#10b981" />
                </div>
                <h2
                  id="access-modal-title"
                  className="access-detail-mono font-bold text-white"
                  style={{ fontSize: "clamp(15px,2.2vw,22px)", letterSpacing: ".06em" }}
                >
                  &gt; SECURITY CLEARANCE REQUIRED
                </h2>
              </div>

              <p className="access-detail-mono text-[11px] leading-relaxed tracking-wider text-white/35 max-w-lg">
                Protocol access is restricted to verified nodes. Initialize transfer to unseal the terminal.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="access-detail-mono text-white/25 hover:text-white text-2xl leading-none p-2 -m-2 transition-colors flex-shrink-0 ml-6"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {!address && (
            <p className="access-detail-mono text-amber-400/70 text-[10px] mb-6 tracking-wider px-4 py-2.5 border border-amber-500/20 rounded-lg bg-amber-500/[0.04]">
              ⚠ NODE AUTHENTICATION REQUIRED — connect your wallet to proceed.
            </p>
          )}

          {/* Tier selector */}
          <div className="flex gap-3 mb-6 flex-wrap">
            {tiers.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedTier(t)}
                className={`access-detail-mono flex-1 min-w-[140px] py-3 px-4 text-[10px] tracking-wider rounded-lg border transition-all ${
                  selectedTier === t
                    ? "border-emerald-500 text-emerald-400 bg-emerald-500/10 shadow-[0_0_16px_rgba(16,185,129,0.15)]"
                    : "border-white/10 text-white/35 hover:border-white/20 hover:text-white/55 bg-white/[0.02]"
                }`}
              >
                {TIER_PRICES[t].name} — ${TIER_PRICES[t].amount}
              </button>
            ))}
          </div>

          {/* Tier detail */}
          <div
            className={`relative p-8 rounded-xl border ${
              isEdge ? "access-tier-edge" : "access-tier-runner"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-8">
              <div className="flex-1">
                <span className="access-detail-mono text-emerald-500 font-bold text-[10px] tracking-widest block mb-2">
                  {currentTier.name}
                </span>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="access-price-syne text-4xl sm:text-5xl text-white">
                    ${currentTier.amount}
                  </span>
                  <span className="access-detail-mono text-white/35 text-sm">/ month</span>
                </div>
                {selectedTier === "runner" && (
                  <p className="access-detail-mono text-[10px] text-white/25 mb-4 tracking-wider">
                    Limited slots available at this rate
                  </p>
                )}
                <ul className="access-detail-mono text-[10px] text-white/50 space-y-2 mt-4">
                  {currentTier.features.slice(0, 6).map((f, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="text-emerald-500">✓</span> {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA column */}
              <div className="sm:shrink-0 sm:w-60 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => handleSubscribe()}
                  disabled={!address || loading || !hasPrice}
                  className="btn-scanline w-full py-5 rounded-xl font-bold text-[11px] tracking-[0.2em] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: loading ? "rgba(16,185,129,0.75)" : "#10b981",
                    color: "#000",
                    boxShadow:
                      !address || loading || !hasPrice
                        ? "none"
                        : "0 0 28px rgba(16,185,129,0.55), 0 0 60px rgba(16,185,129,0.2)",
                  }}
                >
                  {loading
                    ? "REDIRECTING..."
                    : hasPrice
                    ? `INITIALIZE TRANSFER — $${currentTier.amount}`
                    : "PRICE NOT CONFIGURED"}
                </button>

                {address && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      window.location.href = "/dashboard"
                    }}
                    className="access-detail-mono w-full py-3 text-white/30 text-[10px] tracking-wider hover:text-white/60 transition-colors text-center rounded-lg border border-white/[0.06] hover:border-white/12 bg-white/[0.02]"
                  >
                    Already subscribed → Enter Terminal
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Reassurance */}
          <div className="access-reassurance mt-auto">
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <span>⬡ Institutional grade encryption</span>
              <span>⬡ Powered by Stripe &amp; Polymarket</span>
              <span>⬡ Keys never leave your browser</span>
            </div>
          </div>

          {!isStripeConfigured() && (
            <p className="access-detail-mono mt-4 text-amber-400/70 text-[10px] tracking-wider">
              Stripe is not configured. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and STRIPE_SECRET_KEY.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
