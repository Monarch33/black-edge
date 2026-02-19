"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Eye, Zap, Server, Clock, Radio, Skull, AlertTriangle, Loader2, Check, ExternalLink } from "lucide-react"
import { loadStripe } from "@stripe/stripe-js"
import { isStripeConfigured } from "@/lib/stripe"

const STRIPE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_KEY || ""
const stripePromise = STRIPE_KEY ? loadStripe(STRIPE_KEY) : null
const RUNNER_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_RUNNER || ""
const IS_STRIPE_ENABLED = isStripeConfigured()

interface Plan {
  id: "observer" | "runner" | "whale"
  name: string
  price: string
  period?: string
  originalPrice?: string
  priceSubtext?: string
  description: string
  badge?: string
  features: (string | { icon: React.ComponentType<{ className?: string }>; text: string })[]
  cta: string
  highlighted: boolean
  isWhale?: boolean
  icon: React.ComponentType<{ className?: string }>
}

const plans: Plan[] = [
  { id: "observer", name: "OBSERVER", price: "$0", period: "/mo", description: "See the opportunities. Cannot execute.", features: ["15 Minute Delay", "Read-only market scanner", "Basic opportunity alerts", "Limited API access"], cta: "START WATCHING", highlighted: false, icon: Eye },
  { id: "runner", name: "RUNNER", price: "$29", period: "/mo", description: "Autonomous AI execution. Real-time signals.", badge: "MOST POPULAR", features: ["Real-time AI Scanner", "Autonomous Execution (Paper + Live)", "Kelly Criterion Sizing", "Real-time Terminal Access", "Telegram/Discord Alerts", "Whale Tracker"], cta: "GET ACCESS", highlighted: true, icon: Zap },
  { id: "whale", name: "WHALE SYNDICATE", price: "CONTACT", priceSubtext: "SALES", description: "Custom allocation for serious traders.", features: [{ icon: Server, text: "Full REST + WebSocket API" }, { icon: Radio, text: "Custom Model Training" }, { icon: Clock, text: "Priority Execution Queue" }, { icon: Skull, text: "Dedicated Infra & Support" }], cta: "REQUEST ACCESS", highlighted: false, isWhale: true, icon: Skull },
]

export function PricingView() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successPlan, setSuccessPlan] = useState<string | null>(null)

  const handleCheckout = async (planId: "observer" | "runner" | "whale") => {
    setError(null)
    setLoadingPlan(planId)

    try {
      // Observer: free tier, just redirect
      if (planId === "observer") {
        setSuccessPlan(planId)
        setTimeout(() => { window.location.href = "/?view=terminal" }, 1000)
        return
      }

      // Whale: contact sales page
      if (planId === "whale") {
        window.location.href = "mailto:camil.nova@outlook.fr?subject=Black%20Edge%20Whale%20Syndicate%20Access"
        setLoadingPlan(null)
        return
      }

      // Runner: Stripe Checkout
      if (!IS_STRIPE_ENABLED) {
        throw new Error("⚠️ Payments are not configured yet. Please add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to enable subscriptions.")
      }

      console.log("[Stripe] Starting checkout for Runner plan...")
      console.log("[Stripe] Price ID:", RUNNER_PRICE_ID)
      console.log("[Stripe] Publishable key loaded:", !!STRIPE_KEY)

      const stripe = await stripePromise
      if (!stripe) {
        throw new Error("Stripe failed to initialize. Check your configuration.")
      }

      if (!RUNNER_PRICE_ID || RUNNER_PRICE_ID === "price_xxxxx_runner") {
        throw new Error("Stripe Price ID not configured. Set NEXT_PUBLIC_STRIPE_PRICE_ID_RUNNER in .env.local")
      }

      // Create checkout session via our API route
      console.log("[Stripe] Creating checkout session...")
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId: RUNNER_PRICE_ID,
          successUrl: `${window.location.origin}/success?plan=${planId}&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/?view=pricing`,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error("[Stripe] Checkout session creation failed:", response.status, errorData)
        throw new Error(errorData.error || `Server error ${response.status}`)
      }

      const { sessionId } = await response.json()
      console.log("[Stripe] Session created:", sessionId)

      // Redirect to Stripe Checkout
      const { error: stripeError } = await stripe.redirectToCheckout({ sessionId })
      if (stripeError) {
        console.error("[Stripe] Redirect error:", stripeError)
        throw new Error(stripeError.message)
      }
    } catch (err) {
      console.error("[Stripe] Checkout error:", err)
      setError(err instanceof Error ? err.message : "Checkout failed. Please try again.")
      setLoadingPlan(null)
    }
  }

  return (
    <div className="pt-24 md:pt-32 pb-16 md:pb-24 overflow-x-hidden">
      <div className="relative max-w-6xl mx-auto px-4 md:px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-12 md:mb-16">
          <div className="flex items-center justify-center gap-2 mb-4 md:mb-6"><AlertTriangle className="w-4 h-4 text-white/40" /><span className="text-[10px] md:text-xs text-white/40 tracking-[0.2em] md:tracking-[0.3em] uppercase">PRICING</span></div>
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold text-white mb-4 tracking-tight text-balance">STEAL THE EDGE.</h1>
          <p className="text-sm md:text-lg text-white/40 max-w-xl mx-auto">No performance fees. No hidden costs. Just raw access.</p>
        </motion.div>

        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 border border-white/20 bg-white/5 p-4 max-w-md mx-auto">
            <div className="flex items-center gap-2 text-white/70 text-sm font-mono"><AlertTriangle className="w-4 h-4 flex-shrink-0" /><span>{error}</span></div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-stretch">
          {plans.map((plan, i) => (
            <motion.div key={plan.name} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 + i * 0.1 }} className={`relative border bg-[#020408] overflow-hidden ${plan.highlighted ? "border-white/30 md:-mt-4 md:mb-4" : plan.isWhale ? "border-white/10" : "border-white/5"}`}>
              {plan.badge && <div className="absolute top-0 left-0 right-0 bg-white py-1"><p className="text-[10px] text-black text-center tracking-[0.2em] md:tracking-[0.3em]">{plan.badge}</p></div>}
              <div className={`p-4 md:p-6 lg:p-8 ${plan.badge ? "pt-8 md:pt-10" : ""}`}>
                <div className={`w-10 h-10 border flex items-center justify-center mb-4 md:mb-6 ${plan.highlighted ? "border-white/20 bg-white/10" : "border-white/10"}`}><plan.icon className={`w-5 h-5 ${plan.highlighted ? "text-white" : "text-white/50"}`} /></div>
                <h3 className="text-base md:text-lg font-bold text-white tracking-wider mb-2">{plan.name}</h3>
                <div className="mb-4">
                  {plan.originalPrice && <span className="text-white/30 line-through text-base md:text-lg mr-2">{plan.originalPrice}</span>}
                  {plan.isWhale ? (
                    <div className="relative inline-block"><span className="text-2xl md:text-4xl font-bold text-white">{plan.price}</span><span className="block text-white/60 text-[10px] md:text-sm tracking-wider px-2 py-0.5 bg-white/10 inline-block mt-1">{plan.priceSubtext}</span></div>
                  ) : (<><span className="text-2xl md:text-4xl font-bold text-white">{plan.price}</span><span className="text-white/30 text-xs md:text-sm">{plan.period}</span></>)}
                </div>
                <p className="text-xs md:text-sm text-white/40 mb-6 md:mb-8">{plan.description}</p>
                <ul className="space-y-2 md:space-y-3 mb-6 md:mb-8">
                  {plan.features.map((feature) => {
                    const isObject = typeof feature === "object"
                    const Icon = isObject ? feature.icon : null
                    const text = isObject ? feature.text : feature
                    return (<li key={text} className="flex items-center gap-3 text-xs md:text-sm text-white/60">{Icon ? <Icon className="w-4 h-4 text-white/30 flex-shrink-0" /> : <span className="w-4 h-4 flex items-center justify-center text-white/30">&rsaquo;</span>}{text}</li>)
                  })}
                </ul>
                <button onClick={() => handleCheckout(plan.id)} disabled={loadingPlan === plan.id || successPlan === plan.id} className={`w-full py-3 md:py-3 px-4 text-[10px] md:text-xs tracking-wider transition-all min-h-[48px] flex items-center justify-center gap-2 ${successPlan === plan.id ? "bg-[#22C55E] text-white" : plan.highlighted ? "bg-white text-black hover:bg-white/90" : plan.isWhale ? "border border-white/20 text-white/70 hover:border-white/40 hover:text-white" : "border border-white/10 text-white/50 hover:border-white/30 hover:text-white/80"} disabled:opacity-70 disabled:cursor-not-allowed`}>
                  {loadingPlan === plan.id ? <><Loader2 className="w-4 h-4 animate-spin" /><span>PROCESSING...</span></> : successPlan === plan.id ? <><Check className="w-4 h-4" /><span>ACTIVATED!</span></> : <>{plan.isWhale && <ExternalLink className="w-3 h-3" />}{plan.cta}</>}
                </button>
              </div>
              {plan.isWhale && <div className="px-4 pb-4 md:px-6 md:pb-6 lg:px-8 lg:pb-8"><div className="border-t border-white/5 pt-4"><p className="text-[10px] text-white/30 tracking-wider">NOTE: Requires identity verification.</p></div></div>}
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.6 }} className="mt-12 md:mt-16 border border-white/10 bg-white/5 p-3 md:p-4">
          <div className="flex items-start gap-3"><AlertTriangle className="w-4 h-4 text-white/40 flex-shrink-0 mt-0.5" /><div><p className="text-[10px] md:text-xs text-white/50 tracking-wider mb-1">DISCLAIMER</p><p className="text-[10px] md:text-xs text-white/40 leading-relaxed">Trading prediction markets involves substantial risk. Past performance does not guarantee future results.</p></div></div>
        </motion.div>
      </div>
    </div>
  )
}
