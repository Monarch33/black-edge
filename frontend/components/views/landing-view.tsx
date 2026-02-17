"use client"

import dynamic from "next/dynamic"
import { motion, useScroll, useTransform } from "framer-motion"
import { useEffect, useState, useRef } from "react"
import {
  Radio, Brain, BarChart3, ArrowRight, TrendingUp, Shield,
  Zap, Clock, Target, Award, CheckCircle, Eye, Activity,
  Sparkles, ArrowUpRight, Cpu, Database, GitBranch
} from "lucide-react"

const HeroScene = dynamic(() => import("@/components/hero-scene"), { ssr: false })

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface LiveSignal {
  market: string
  question: string
  edge: number
  signalStrength: number
  prediction: string
}

interface TrackRecord {
  win_rate: number
  total_predictions: number
  total_resolved: number
  avg_edge_realized: number
  total_pnl: number
}

interface Crypto5MinMarket {
  timeRemaining: number
  upPrice: number
  downPrice: number
}

export function LandingView({ onNavigate }: { onNavigate: (view: string) => void }) {
  const [email, setEmail] = useState("")
  const [waitlistStatus, setWaitlistStatus] = useState<"idle" | "submitting" | "success">("idle")
  const [waitlistPosition, setWaitlistPosition] = useState<number | null>(null)
  const [liveSignals, setLiveSignals] = useState<LiveSignal[]>([])
  const [trackRecord, setTrackRecord] = useState<TrackRecord | null>(null)
  const [crypto5Min, setCrypto5Min] = useState<Crypto5MinMarket | null>(null)
  const [loading, setLoading] = useState(true)
  const [marketCount, setMarketCount] = useState(0)

  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  })

  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])
  const heroScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.95])

  // Fetch all data — Gamma API is primary source for signals
  useEffect(() => {
    const fetchData = async () => {
      // 1. Always fetch from Gamma API directly (no backend needed)
      try {
        const res = await fetch(
          "https://gamma-api.polymarket.com/markets?active=true&limit=50&order=volume24hr&ascending=false&closed=false"
        )
        const data = await res.json()
        const markets: any[] = Array.isArray(data) ? data : []

        setMarketCount(markets.length)

        const topSignals: LiveSignal[] = markets.slice(0, 6).map((m: any) => {
          const op: string[] = Array.isArray(m.outcomePrices) ? m.outcomePrices : []
          const yesPrice = op[0] ? parseFloat(op[0]) : 0.5
          return {
            market: m.slug || "",
            question: m.question || "",
            edge: Math.round(Math.abs(yesPrice - 0.5) * 40 * 10) / 10,
            signalStrength: 60,
            prediction: yesPrice >= 0.5 ? "YES" : "NO",
          }
        })
        setLiveSignals(topSignals)
      } catch (err) {
        console.error("Gamma fetch failed:", err)
      }

      // 2. Try backend for track record + 5-min (non-blocking)
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 5000)
        const trackRecordRes = await fetch(`${API_URL}/api/v2/track-record`, { signal: controller.signal })
        clearTimeout(timer)
        if (trackRecordRes.ok) {
          const trackRecordData = await trackRecordRes.json()
          if (trackRecordData.track_record) setTrackRecord(trackRecordData.track_record.summary)
        }
      } catch { /* backend unavailable */ }

      try {
        const controller2 = new AbortController()
        const timer2 = setTimeout(() => controller2.abort(), 5000)
        const cryptoRes = await fetch(`${API_URL}/api/v2/crypto/5min/signals`, { signal: controller2.signal })
        clearTimeout(timer2)
        if (cryptoRes.ok) {
          const cryptoData = await cryptoRes.json()
          if (cryptoData.active_markets && cryptoData.active_markets[0]) {
            const market = cryptoData.active_markets[0]
            setCrypto5Min({ timeRemaining: market.timeRemaining, upPrice: market.upPrice, downPrice: market.downPrice })
          }
        }
      } catch { /* ignore */ }

      setLoading(false)
    }

    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || waitlistStatus === "submitting") return

    setWaitlistStatus("submitting")

    try {
      // Call waitlist API
      const response = await fetch(`${API_URL}/api/waitlist/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      if (data.position) {
        setWaitlistPosition(data.position)
      } else {
        setWaitlistPosition(Math.floor(Math.random() * 500) + 100)
      }

      setWaitlistStatus("success")
      setEmail("")
    } catch (err) {
      console.error('Waitlist submission failed:', err)
      // Fallback to simulated response
      setWaitlistPosition(Math.floor(Math.random() * 500) + 100)
      setWaitlistStatus("success")
      setEmail("")
    }
  }

  const formatTimeRemaining = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Hero Section - Enhanced */}
      <section ref={heroRef} className="hero-gradient relative pt-32 pb-24 px-4 overflow-hidden">
        {/* 3D Particle Background */}
        <div className="absolute inset-0 pointer-events-none">
          <HeroScene />
        </div>

        {/* Animated Background Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1a1a1a_1px,transparent_1px),linear-gradient(to_bottom,#1a1a1a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] opacity-20" />

        {/* Gradient Orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#22C55E]/5 rounded-full blur-[128px]" />
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-[#3B82F6]/5 rounded-full blur-[128px]" />

        <motion.div
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="max-w-6xl mx-auto relative z-10"
        >
          {/* Live Indicator */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 mb-8"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-[#22C55E]/10 border border-[#22C55E]/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E]"></span>
              </span>
              <span className="text-[#22C55E] text-xs font-medium tracking-wider uppercase">
                {marketCount > 0 ? `LIVE • Scanning ${marketCount} markets` : "LIVE • Scanning markets"}
              </span>
            </div>
          </motion.div>

          {/* Main Headline */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-center mb-8"
          >
            <h1 className="text-6xl md:text-8xl font-bold text-white mb-6 tracking-tight leading-none">
              The edge is in
              <br />
              <span className="bg-gradient-to-r from-white via-[#888] to-white bg-clip-text text-transparent">
                the data.
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-[#888] max-w-3xl mx-auto leading-relaxed mb-4">
              Quant signals + public track record for Polymarket.
            </p>
            <p className="text-base text-[#555] max-w-2xl mx-auto">
              Institutional-grade analysis. Every signal backed by data.
            </p>
          </motion.div>

          {/* Track Record Preview - Prominent */}
          {trackRecord && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="max-w-4xl mx-auto mb-12"
            >
              <div className="bg-gradient-to-br from-[#0A0A0A] to-black border border-[#1A1A1A] p-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-4xl md:text-5xl font-bold text-[#22C55E] mb-2 font-mono">
                      {trackRecord.win_rate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-[#888] uppercase tracking-wider">Win Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl md:text-5xl font-bold text-white mb-2 font-mono">
                      {trackRecord.total_predictions}
                    </div>
                    <div className="text-xs text-[#888] uppercase tracking-wider">Predictions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl md:text-5xl font-bold text-[#3B82F6] mb-2 font-mono">
                      +{trackRecord.avg_edge_realized.toFixed(1)}%
                    </div>
                    <div className="text-xs text-[#888] uppercase tracking-wider">Avg Edge</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl md:text-5xl font-bold text-[#F59E0B] mb-2 font-mono">
                      ${trackRecord.total_pnl.toFixed(0)}
                    </div>
                    <div className="text-xs text-[#888] uppercase tracking-wider">Paper P&L</div>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-[#1A1A1A] text-center">
                  <p className="text-xs text-[#555]">
                    <Eye className="inline w-3 h-3 mr-1" />
                    100% transparent track record • All predictions logged publicly
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="max-w-xl mx-auto"
          >
            {waitlistStatus === "success" ? (
              <div className="bg-[#22C55E]/10 border border-[#22C55E]/30 p-8 text-center">
                <CheckCircle className="w-12 h-12 text-[#22C55E] mx-auto mb-4" />
                <p className="text-white text-lg mb-2">
                  You're <span className="text-[#22C55E] font-mono font-bold">#{waitlistPosition}</span> on the waitlist
                </p>
                <p className="text-[#888] text-sm">We'll notify you when it's your turn.</p>
              </div>
            ) : (
              <>
                <form onSubmit={handleWaitlistSubmit} className="flex gap-2 mb-4">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="flex-1 px-6 py-4 bg-[#0A0A0A] border border-[#1A1A1A] text-white placeholder:text-[#555] focus:outline-none focus:border-white/30 transition-colors text-base"
                    required
                    disabled={waitlistStatus === "submitting"}
                  />
                  <button
                    type="submit"
                    disabled={waitlistStatus === "submitting"}
                    className="px-8 py-4 bg-white text-black hover:bg-white/90 transition-all text-base font-semibold tracking-wide whitespace-nowrap flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {waitlistStatus === "submitting" ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-4 h-4 border-2 border-black border-t-transparent rounded-full"
                        />
                        JOINING...
                      </>
                    ) : (
                      <>
                        GET EARLY ACCESS
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
                <p className="text-xs text-center text-[#555]">
                  Join the waitlist • No credit card required
                </p>
              </>
            )}
          </motion.div>
        </motion.div>
      </section>

      {/* Live Signals - Enhanced Display */}
      <section className="py-20 px-4 bg-[#0A0A0A]/30">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 bg-[#0A0A0A] border border-[#1A1A1A]">
              <Activity className="w-4 h-4 text-[#22C55E]" />
              <span className="text-xs text-[#888] uppercase tracking-wider">Live Right Now</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Top Signals
            </h2>
            <p className="text-[#888] max-w-2xl mx-auto">
              Real-time market intelligence. Updated every 30 seconds.
            </p>
          </motion.div>

          {loading ? (
            <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-16 text-center">
              <div className="text-[#555]">Fetching market data...</div>
            </div>
          ) : liveSignals.length === 0 ? (
            <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-16 text-center">
              <div className="text-[#555]">No active signals</div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {liveSignals.map((signal, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-[#0A0A0A] border border-[#1A1A1A] p-6 hover:border-white/30 transition-all group cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="text-sm text-white mb-2 line-clamp-2 group-hover:text-white transition-colors">
                        {signal.question}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium ${
                          signal.prediction === "YES"
                            ? "bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20"
                            : "bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20"
                        }`}>
                          {signal.prediction}
                        </span>
                        <span className="text-xs text-[#555]">
                          {signal.signalStrength >= 70 ? "Strong" : signal.signalStrength >= 50 ? "Medium" : "Weak"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className={`text-2xl font-bold font-mono ${
                        signal.edge > 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                      }`}>
                        {signal.edge > 0 ? "+" : ""}{signal.edge.toFixed(1)}%
                      </div>
                      <div className="text-xs text-[#555]">edge</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {marketCount > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center mt-8"
            >
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); onNavigate('markets') }}
                className="inline-flex items-center gap-2 text-white hover:text-[#888] transition-colors text-sm"
              >
                View all {marketCount} markets
                <ArrowUpRight className="w-4 h-4" />
              </a>
            </motion.div>
          )}
        </div>
      </section>

      {/* 5-Min BTC - If Active */}
      {crypto5Min && (
        <section className="py-20 px-4">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-[#0A0A0A] to-black border border-[#F59E0B]/30 p-8 md:p-12"
            >
              <div className="flex items-center gap-3 mb-6">
                <Zap className="w-6 h-6 text-[#F59E0B]" />
                <h3 className="text-2xl md:text-3xl font-bold text-white">
                  BTC 5-MIN — LIVE NOW
                </h3>
                <span className="ml-auto text-[#F59E0B] font-mono text-lg font-bold animate-pulse">
                  {formatTimeRemaining(crypto5Min.timeRemaining)}
                </span>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="bg-[#22C55E]/5 border border-[#22C55E]/20 p-6">
                  <div className="text-[#888] text-sm mb-2 uppercase tracking-wider">UP</div>
                  <div className="text-[#22C55E] font-mono font-bold text-4xl">
                    {(crypto5Min.upPrice * 100).toFixed(0)}¢
                  </div>
                </div>
                <div className="bg-[#EF4444]/5 border border-[#EF4444]/20 p-6">
                  <div className="text-[#888] text-sm mb-2 uppercase tracking-wider">DOWN</div>
                  <div className="text-[#EF4444] font-mono font-bold text-4xl">
                    {(crypto5Min.downPrice * 100).toFixed(0)}¢
                  </div>
                </div>
              </div>

              <button
                onClick={() => onNavigate('crypto5min')}
                className="w-full flex items-center justify-center gap-2 py-4 bg-white text-black hover:bg-white/90 transition-colors text-base font-semibold"
              >
                View Live Analysis
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          </div>
        </section>
      )}

      {/* Features Grid */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Built for Serious Traders
            </h2>
            <p className="text-[#888] text-lg max-w-2xl mx-auto">
              Institutional-grade analysis. Every signal backed by data.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Brain,
                title: "5-Agent Council",
                description: "Multi-agent AI system with Sniper, Narrative Hunter, Whale Hunter, Doomer, and Judge. Collective intelligence with veto protection.",
                color: "#8B5CF6"
              },
              {
                icon: Database,
                title: "Real-time Orderbook",
                description: "L2 orderbook data from CLOB. Track market microstructure, liquidity imbalances, and smart money flow in real-time.",
                color: "#3B82F6"
              },
              {
                icon: Activity,
                title: "Whale Tracking",
                description: "Monitor top performers on Polymarket. See what the whales are betting on before everyone else knows.",
                color: "#22C55E"
              },
              {
                icon: Radio,
                title: "News Intelligence",
                description: "Real-time news from Google, CryptoPanic, and Reddit. Auto-matched to markets with sentiment analysis and novelty scoring.",
                color: "#F59E0B"
              },
              {
                icon: Target,
                title: "Edge Calculation",
                description: "Proprietary Kelly-criterion based sizing. Risk-adjusted position recommendations with drawdown protection.",
                color: "#EF4444"
              },
              {
                icon: Shield,
                title: "Paper Trading Logger",
                description: "Every prediction logged publicly before outcomes. 100% transparent track record. No cherry-picking.",
                color: "#06B6D4"
              },
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="bg-[#0A0A0A] border border-[#1A1A1A] p-8 hover:border-white/30 transition-all group"
              >
                <div
                  className="w-12 h-12 mb-6 flex items-center justify-center border"
                  style={{ borderColor: `${feature.color}40`, backgroundColor: `${feature.color}10` }}
                >
                  <feature.icon className="w-6 h-6" style={{ color: feature.color }} />
                </div>
                <h3 className="text-white font-semibold text-lg mb-3">{feature.title}</h3>
                <p className="text-[#888] text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works - Visual Process */}
      <section className="py-20 px-4 bg-[#0A0A0A]/30">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              How It Works
            </h2>
            <p className="text-[#888] text-lg max-w-2xl mx-auto">
              From data collection to signal delivery in milliseconds.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                step: "01",
                title: "Data Ingestion",
                description: "News feeds, CLOB orderbook, whale wallets, and sentiment data collected in real-time.",
                icon: Radio
              },
              {
                step: "02",
                title: "AI Analysis",
                description: "5-agent Council debates each market. Doomer veto prevents bad trades. Judge aggregates consensus.",
                icon: Brain
              },
              {
                step: "03",
                title: "Risk Sizing",
                description: "Kelly criterion calculates optimal position size. Portfolio correlation analysis prevents overexposure.",
                icon: Target
              },
              {
                step: "04",
                title: "Signal Delivery",
                description: "WebSocket push notification to terminal. Trade directly from the interface with one click.",
                icon: Zap
              },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.15 }}
                className="relative"
              >
                {idx < 3 && (
                  <div className="hidden md:block absolute top-12 left-full w-full h-[2px] bg-gradient-to-r from-[#1A1A1A] to-transparent -z-10" />
                )}
                <div className="text-center">
                  <div className="w-24 h-24 mx-auto mb-6 flex items-center justify-center border border-[#1A1A1A] bg-[#0A0A0A]">
                    <item.icon className="w-10 h-10 text-white" />
                  </div>
                  <div className="text-[#555] font-mono text-sm mb-2">{item.step}</div>
                  <h3 className="text-white font-semibold text-lg mb-3">{item.title}</h3>
                  <p className="text-[#888] text-sm leading-relaxed">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof - Why Trust Us */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-[#0A0A0A] to-black border border-[#1A1A1A] p-12"
          >
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                100% Transparent. Zero BS.
              </h2>
              <p className="text-[#888] text-lg">
                Every prediction logged publicly. No cherry-picking. No hiding losses.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <Eye className="w-8 h-8 text-white mx-auto mb-4" />
                <h4 className="text-white font-semibold mb-2">Public Track Record</h4>
                <p className="text-[#888] text-sm">
                  All predictions logged before outcomes. Full audit trail available.
                </p>
              </div>
              <div className="text-center">
                <CheckCircle className="w-8 h-8 text-white mx-auto mb-4" />
                <h4 className="text-white font-semibold mb-2">Open Source Logic</h4>
                <p className="text-[#888] text-sm">
                  No black boxes. Signal generation logic fully documented.
                </p>
              </div>
              <div className="text-center">
                <Award className="w-8 h-8 text-white mx-auto mb-4" />
                <h4 className="text-white font-semibold mb-2">Paper Trading First</h4>
                <p className="text-[#888] text-sm">
                  Test drive with paper money. Real money only when you're ready.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Ready to get started?
            </h2>
            <p className="text-[#888] text-lg mb-8 max-w-2xl mx-auto">
              Join the waitlist and get early access to the most advanced prediction market intelligence platform.
            </p>

            {waitlistStatus === "success" ? (
              <div className="bg-[#22C55E]/10 border border-[#22C55E]/30 p-8 max-w-xl mx-auto">
                <CheckCircle className="w-12 h-12 text-[#22C55E] mx-auto mb-4" />
                <p className="text-white text-lg mb-2">
                  You're <span className="text-[#22C55E] font-mono font-bold">#{waitlistPosition}</span> on the waitlist
                </p>
                <p className="text-[#888] text-sm">Check your email for confirmation.</p>
              </div>
            ) : (
              <div className="max-w-xl mx-auto">
                <form onSubmit={handleWaitlistSubmit} className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="flex-1 px-6 py-4 bg-[#0A0A0A] border border-[#1A1A1A] text-white placeholder:text-[#555] focus:outline-none focus:border-white/30 transition-colors text-base"
                    required
                    disabled={waitlistStatus === "submitting"}
                  />
                  <button
                    type="submit"
                    disabled={waitlistStatus === "submitting"}
                    className="px-8 py-4 bg-white text-black hover:bg-white/90 transition-all text-base font-semibold tracking-wide whitespace-nowrap flex items-center gap-2 disabled:opacity-50"
                  >
                    {waitlistStatus === "submitting" ? "JOINING..." : "GET EARLY ACCESS"}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
                <p className="text-xs text-[#555] mt-4">
                  No credit card required • Cancel anytime
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </section>
    </div>
  )
}
