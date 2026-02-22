"use client"

import React, { useState, useEffect } from "react"
import { useAccount } from "wagmi"
import {
  createCheckoutSession,
  isStripeConfigured,
  TIER_PRICES,
  type StripeTier,
} from "@/lib/stripe"
import { toast } from "sonner"

interface AccessModalProps {
  isOpen:       boolean
  onClose:      () => void
  defaultTier?: StripeTier
}

// ── Technical spec copy ───────────────────────────────────────────────────────

const RUNNER_SPECS = [
  "Direct Binance L2 WS Feed — μs-latency ingestion",
  "EIP-712 Cryptographic Order Signing (secp256k1)",
  "Polymarket CLOB Execution Engine (GTC limit orders)",
  "Black-Scholes Binary Option Pricing (per-tick)",
  "Half-Kelly Criterion Position Sizing",
]

const EDGE_SPECS = [
  "Everything in RUNNER_NODE",
  "Full REST + WebSocket API Access",
  "Autonomous 5-min Market Discovery (Gamma API)",
  "L2 Orderbook Imbalance Microstructure Feed",
  "Dynamic Take-Profit Position Management (±20 %)",
  "Priority Support & Custom Engine Configuration",
]

// ── Component ─────────────────────────────────────────────────────────────────

export function AccessModal({ isOpen, onClose, defaultTier = "runner" }: AccessModalProps) {
  const { address } = useAccount()
  const [loading,      setLoading]      = useState(false)
  const [selectedTier, setSelectedTier] = useState<StripeTier>(defaultTier)

  useEffect(() => {
    if (isOpen) setSelectedTier(defaultTier)
  }, [isOpen, defaultTier])

  const handleSubscribe = async (tier: StripeTier = selectedTier) => {
    if (!address || !TIER_PRICES[tier]?.priceId) {
      if (!TIER_PRICES[tier]?.priceId) {
        toast.error("Stripe price not configured")
      } else {
        toast.error("Connect your wallet to continue")
      }
      return
    }

    setLoading(true)
    try {
      const result = await createCheckoutSession(tier, address, {
        successUrl: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl:  `${window.location.origin}/#pricing`,
      })
      if (!result?.url) {
        toast.error("Failed to initialise checkout")
        return
      }
      window.location.href = result.url
    } catch {
      toast.error("Checkout error — try again")
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const currentTier            = TIER_PRICES[selectedTier]
  const isEdge                 = selectedTier === "whale"
  const hasPrice               = !!currentTier?.priceId
  const specs                  = isEdge ? EDGE_SPECS : RUNNER_SPECS
  const btnLabel               = isEdge ? "> SECURE_EDGE_ACCESS" : "> DEPLOY_RUNNER_NODE"
  const altTier: StripeTier    = isEdge ? "runner" : "whale"
  const accentColor            = isEdge ? "rgba(139,92,246," : "rgba(16,185,129,"
  const accentText             = isEdge ? "rgb(167,139,250)" : "rgb(16,185,129)"

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
      style={{ background: "rgba(0,0,0,0.97)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="am-title"
    >
      {/* Panel */}
      <div
        className="relative w-full max-w-3xl flex flex-col overflow-hidden"
        style={{
          background: "#000",
          border:     `1px solid ${accentColor}0.2)`,
          boxShadow:  `0 0 60px ${accentColor}0.08), inset 0 0 60px rgba(255,255,255,0.012)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top scan-line */}
        <div className="h-px w-full" style={{
          background: `linear-gradient(90deg, transparent, ${accentColor}0.55), transparent)`,
        }} />

        <div className="p-8 md:p-10 flex flex-col gap-8">

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[9px] tracking-[0.35em] text-white/25 mb-2 uppercase">
                Black Edge / Access Terminal
              </p>
              <h2 id="am-title" className="font-mono text-xl md:text-2xl font-bold text-white">
                {isEdge ? "> INITIALIZE_EDGE_PROTOCOL" : "> INITIALIZE_RUNNER_NODE"}
              </h2>
              <p className="font-mono text-[10px] text-white/30 tracking-wide mt-2 max-w-lg leading-relaxed">
                Institutional-grade HFT execution on Polymarket binary markets.
                Autonomous market discovery · sub-ms L2 ingestion · EIP-712 signing.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="font-mono text-white/25 hover:text-white/70 text-lg leading-none p-1 transition-colors flex-shrink-0"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* ── Tier toggle ──────────────────────────────────────────────────── */}
          <div className="flex gap-3 flex-wrap">
            {(["runner", "whale"] as StripeTier[]).map((t) => {
              const isSelected = selectedTier === t
              const tAccent    = t === "whale" ? "rgba(139,92,246," : "rgba(16,185,129,"
              const tText      = t === "whale" ? "rgb(167,139,250)" : "rgb(16,185,129)"
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedTier(t)}
                  className="font-mono flex-1 min-w-[140px] py-3 px-4 text-[9px] tracking-[0.25em] border transition-all uppercase"
                  style={{
                    borderColor: isSelected ? `${tAccent}0.55)` : "rgba(255,255,255,0.07)",
                    color:       isSelected ? tText               : "rgba(255,255,255,0.28)",
                    background:  isSelected ? `${tAccent}0.07)`  : "transparent",
                  }}
                >
                  {t === "runner" ? "RUNNER_NODE" : "THE_EDGE"} — ${TIER_PRICES[t].amount}/mo
                </button>
              )
            })}
          </div>

          {/* ── Tier card ────────────────────────────────────────────────────── */}
          <div className="p-6 md:p-8" style={{
            border:     `1px solid ${accentColor}0.15)`,
            background: `${accentColor}0.03)`,
          }}>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-8">

              {/* Left: price + specs */}
              <div className="flex-1">
                <div className="font-mono text-[8px] tracking-[0.4em] mb-3 uppercase"
                  style={{ color: accentText }}>
                  {isEdge ? "THE_EDGE" : "RUNNER_NODE"} / MODULE SPECS
                </div>

                <div className="flex items-baseline gap-2 mb-6">
                  <span className="font-mono text-5xl font-black text-white tracking-tight">
                    ${currentTier.amount}
                  </span>
                  <span className="font-mono text-[10px] text-white/25 tracking-wider">/ MO</span>
                </div>

                <ul className="space-y-2.5">
                  {specs.map((spec, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="font-mono text-[10px] flex-shrink-0 mt-0.5"
                        style={{ color: accentText }}>✓</span>
                      <span className="font-mono text-[10px] text-white/45 tracking-wide leading-relaxed">
                        {spec}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right: CTA */}
              <div className="sm:shrink-0 flex flex-col gap-3 sm:min-w-[220px]">
                {!address && (
                  <p className="font-mono text-[9px] text-amber-400/65 tracking-wider">
                    ⚠ WALLET NOT CONNECTED
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => handleSubscribe()}
                  disabled={!address || loading || !hasPrice}
                  className="font-mono text-[10px] tracking-[0.18em] px-6 py-4 border-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    borderColor: `${accentColor}0.65)`,
                    color:       accentText,
                    background:  "transparent",
                  }}
                  onMouseEnter={(e) => {
                    const b = e.currentTarget
                    b.style.background = `${accentColor}0.11)`
                    b.style.boxShadow  = `0 0 18px ${accentColor}0.35)`
                  }}
                  onMouseLeave={(e) => {
                    const b = e.currentTarget
                    b.style.background = "transparent"
                    b.style.boxShadow  = "none"
                  }}
                >
                  {loading
                    ? "> ROUTING_TO_VAULT..."
                    : hasPrice
                      ? `${btnLabel} — $${currentTier.amount}/mo`
                      : "> PRICE_NOT_CONFIGURED"}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedTier(altTier)}
                  className="font-mono text-[9px] text-white/18 hover:text-white/45 tracking-wider transition-colors text-left"
                >
                  {isEdge
                    ? `> RUNNER_NODE $${TIER_PRICES.runner.amount}/mo →`
                    : `> THE_EDGE $${TIER_PRICES.whale.amount}/mo →`}
                </button>
              </div>
            </div>
          </div>

          {/* ── Footer ──────────────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {address && (
              <button
                type="button"
                onClick={() => { onClose(); window.location.href = "/dashboard" }}
                className="font-mono text-[9px] text-white/22 hover:text-white/55 tracking-wider transition-colors"
              >
                {`> ALREADY_SUBSCRIBED → /dashboard`}
              </button>
            )}
            <div className="flex gap-5 font-mono text-[8px] text-white/18 tracking-wider ml-auto">
              <span>// STRIPE_SECURED</span>
              <span>// POLYGON_MAINNET</span>
              {!isStripeConfigured() && (
                <span className="text-amber-400/55">// STRIPE_UNCONFIGURED</span>
              )}
            </div>
          </div>

        </div>

        {/* Bottom scan-line */}
        <div className="h-px w-full" style={{
          background: `linear-gradient(90deg, transparent, ${accentColor}0.3), transparent)`,
        }} />
      </div>
    </div>
  )
}
