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

export function AccessModal({ isOpen, onClose, defaultTier = "pro" }: AccessModalProps) {
  const { address } = useAccount()
  const [loading, setLoading] = useState(false)
  const [selectedTier, setSelectedTier] = useState<StripeTier>(defaultTier)

  useEffect(() => {
    if (isOpen) setSelectedTier(defaultTier)
  }, [isOpen, defaultTier])

  const handleSubscribe = async (tier: StripeTier = selectedTier) => {
    if (!address || !TIER_PRICES[tier]?.priceId) {
      if (!TIER_PRICES[tier]?.priceId) {
        toast.error("Stripe price not configured. Set NEXT_PUBLIC_STRIPE_PRICE_ID_PRO.")
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

  const tiers: StripeTier[] = ["pro", "whale"]
  const currentTier = TIER_PRICES[selectedTier]
  const hasPrice = !!currentTier?.priceId

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md border border-white/10 bg-black p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold tracking-tight">
            GET ACCESS
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-white/40 hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>

        <p className="text-white/60 text-sm mb-6">
          Subscribe to unlock the autonomous bot terminal. After payment, you&apos;ll configure your Polymarket API keys and activate the agent.
        </p>

        {!address ? (
          <p className="text-amber-400/80 text-sm mb-4">
            Connect your wallet first to subscribe.
          </p>
        ) : null}

        <div className="space-y-4">
          <div className="flex gap-2 mb-4">
            {tiers.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedTier(t)}
                className={`flex-1 py-2 text-[10px] tracking-wider border transition-colors ${
                  selectedTier === t
                    ? "border-[#10b981] text-[#10b981]"
                    : "border-white/20 text-white/50 hover:border-white/40"
                }`}
              >
                {TIER_PRICES[t].name} — ${TIER_PRICES[t].amount}
              </button>
            ))}
          </div>
          <div className="border border-white/10 p-4">
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-[#10b981] font-bold">{currentTier.name}</span>
              <span className="text-2xl font-bold">
                ${currentTier.amount}
                <span className="text-white/40 text-sm font-normal">/month</span>
              </span>
            </div>
            <ul className="text-[10px] text-white/50 space-y-1 mb-4">
              {currentTier.features.slice(0, 4).map((f, i) => (
                <li key={i}>• {f}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => handleSubscribe()}
              disabled={!address || loading || !hasPrice}
              className="w-full py-3 border border-[#10b981] text-[#10b981] text-[10px] tracking-widest hover:bg-[#10b981]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "REDIRECTING..." : hasPrice ? `PAY $${currentTier.amount} — UNLOCK` : "PRICE NOT CONFIGURED"}
            </button>
          </div>

          {address && (
            <button
              type="button"
              onClick={() => {
                onClose()
                window.location.href = "/dashboard"
              }}
              className="w-full py-2 text-white/40 text-[10px] hover:text-white/70 transition-colors"
            >
              Already subscribed? Go to Dashboard →
            </button>
          )}
        </div>

        {!isStripeConfigured() && (
          <p className="mt-4 text-amber-400/80 text-[10px]">
            Stripe is not configured. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and STRIPE_SECRET_KEY.
          </p>
        )}
      </div>
    </div>
  )
}
