"use client"

import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { Radio, Brain, BarChart3, ArrowRight } from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface LiveSignal {
  market: string
  question: string
  edge: number
  signalStrength: number
  prediction: string
}

interface Stats {
  marketsScanned: number
  matchRate: number
  cost: number
}

interface Crypto5MinMarket {
  timeRemaining: number
  upPrice: number
  downPrice: number
}

export function LandingView() {
  const [email, setEmail] = useState("")
  const [waitlistPosition, setWaitlistPosition] = useState<number | null>(null)
  const [stats, setStats] = useState<Stats>({ marketsScanned: 0, matchRate: 0, cost: 0 })
  const [liveSignals, setLiveSignals] = useState<LiveSignal[]>([])
  const [crypto5Min, setCrypto5Min] = useState<Crypto5MinMarket | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch stats and signals
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch signals
        const signalsRes = await fetch(`${API_URL}/api/v2/signals`)
        const signalsData = await signalsRes.json()

        if (signalsData.signals) {
          const topSignals = signalsData.signals
            .sort((a: any, b: any) => b.edge - a.edge)
            .slice(0, 5)
            .map((s: any) => ({
              market: s.market,
              question: s.question,
              edge: s.edge,
              signalStrength: s.signalStrength,
              prediction: s.prediction
            }))
          setLiveSignals(topSignals)
          setStats({
            marketsScanned: signalsData.signals.length,
            matchRate: 31, // TODO: Calculate from track record
            cost: 0
          })
        }

        // Fetch 5-min crypto data
        const cryptoRes = await fetch(`${API_URL}/api/v2/crypto/5min/signals`)
        const cryptoData = await cryptoRes.json()
        if (cryptoData.active_markets && cryptoData.active_markets[0]) {
          const market = cryptoData.active_markets[0]
          setCrypto5Min({
            timeRemaining: market.timeRemaining,
            upPrice: market.upPrice,
            downPrice: market.downPrice
          })
        }

        setLoading(false)
      } catch (err) {
        console.error('Failed to fetch data:', err)
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    // TODO: Implement real waitlist API
    // For now, simulate
    const position = Math.floor(Math.random() * 500) + 100
    setWaitlistPosition(position)
    setEmail("")
  }

  const getSignalLabel = (strength: number): string => {
    if (strength >= 70) return "Strong"
    if (strength >= 50) return "Medium"
    return "Weak"
  }

  const getSignalDot = (strength: number): string => {
    if (strength >= 70) return "●"
    if (strength >= 50) return "◐"
    return "○"
  }

  const formatTimeRemaining = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-5xl md:text-7xl font-semibold text-white mb-6 tracking-tight"
          >
            Prediction Market
            <br />
            Intelligence.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-lg text-[#888] mb-8 max-w-2xl mx-auto leading-relaxed"
          >
            AI-powered signals for Polymarket.
            <br />
            Multi-agent analysis. Real-time data. Zero noise.
          </motion.p>

          {/* Waitlist Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-md mx-auto mb-12"
          >
            {waitlistPosition ? (
              <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-6">
                <p className="text-white mb-2">You're <span className="text-white font-mono font-bold">#{waitlistPosition}</span> in line.</p>
                <p className="text-[#888] text-sm">We'll notify you by email.</p>
              </div>
            ) : (
              <form onSubmit={handleWaitlistSubmit} className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-3 bg-[#0A0A0A] border border-[#1A1A1A] text-white placeholder:text-[#555] focus:outline-none focus:border-white/30 transition-colors text-sm"
                  required
                />
                <button
                  type="submit"
                  className="px-6 py-3 bg-white text-black hover:bg-white/90 transition-colors text-sm font-medium tracking-wider whitespace-nowrap"
                >
                  GET EARLY ACCESS
                </button>
              </form>
            )}
          </motion.div>

          {/* Stats Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="grid grid-cols-3 gap-4 max-w-2xl mx-auto"
          >
            <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-6">
              <div className="text-3xl font-bold text-white mb-2 font-mono">
                {loading ? "—" : stats.marketsScanned}
              </div>
              <div className="text-sm text-[#888]">Markets Scanned</div>
            </div>
            <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-6">
              <div className="text-3xl font-bold text-white mb-2 font-mono">
                {loading ? "—" : `${stats.matchRate}%`}
              </div>
              <div className="text-sm text-[#888]">Match Rate</div>
            </div>
            <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-6">
              <div className="text-3xl font-bold text-white mb-2 font-mono">
                ${stats.cost}
              </div>
              <div className="text-sm text-[#888]">Cost/month</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Live Signals Table */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-semibold text-white mb-6">Live Signals</h2>

          {loading ? (
            <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-12 text-center">
              <div className="text-[#555]">Loading signals...</div>
            </div>
          ) : liveSignals.length === 0 ? (
            <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-12 text-center">
              <div className="text-[#555]">No signals available</div>
            </div>
          ) : (
            <div className="bg-[#0A0A0A] border border-[#1A1A1A]">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1A1A1A]">
                    <th className="text-left py-4 px-6 text-xs text-[#888] font-medium tracking-wider">MARKET</th>
                    <th className="text-right py-4 px-6 text-xs text-[#888] font-medium tracking-wider">EDGE</th>
                    <th className="text-right py-4 px-6 text-xs text-[#888] font-medium tracking-wider">SIGNAL</th>
                  </tr>
                </thead>
                <tbody>
                  {liveSignals.map((signal, idx) => (
                    <tr
                      key={idx}
                      className={`border-b border-[#1A1A1A] last:border-0 hover:bg-[#0A0A0A] transition-colors ${
                        idx % 2 === 1 ? "bg-[#0A0A0A]/50" : ""
                      }`}
                    >
                      <td className="py-4 px-6 text-sm text-white">
                        {signal.question.length > 60
                          ? signal.question.substring(0, 60) + "..."
                          : signal.question
                        }
                      </td>
                      <td className={`py-4 px-6 text-sm text-right font-mono font-bold ${
                        signal.edge > 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                      }`}>
                        {signal.edge > 0 ? "+" : ""}{signal.edge.toFixed(1)}%
                      </td>
                      <td className="py-4 px-6 text-sm text-right">
                        <span className="inline-flex items-center gap-2 text-white">
                          <span>{getSignalDot(signal.signalStrength)}</span>
                          <span className="text-[#888]">{getSignalLabel(signal.signalStrength)}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* BTC 5-Min Widget */}
      {crypto5Min && (
        <section className="py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
              <span>⚡</span> BTC 5-MIN — LIVE NOW
            </h2>

            <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="text-sm text-[#888]">
                  Resolving in <span className="text-white font-mono font-bold">{formatTimeRemaining(crypto5Min.timeRemaining)}</span>
                </div>
                <div className="flex gap-4">
                  <div className="text-center">
                    <div className="text-[#888] text-xs mb-1">UP</div>
                    <div className="text-[#22C55E] font-mono font-bold text-xl">{(crypto5Min.upPrice * 100).toFixed(0)}¢</div>
                  </div>
                  <div className="text-[#555]">|</div>
                  <div className="text-center">
                    <div className="text-[#888] text-xs mb-1">DOWN</div>
                    <div className="text-[#EF4444] font-mono font-bold text-xl">{(crypto5Min.downPrice * 100).toFixed(0)}¢</div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => window.location.hash = "#crypto5min"}
                className="w-full flex items-center justify-center gap-2 py-3 border border-[#1A1A1A] text-white hover:bg-white hover:text-black transition-colors text-sm"
              >
                <span>See live</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* How It Works */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-semibold text-white mb-12 text-center">How It Works</h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center border border-[#1A1A1A] bg-[#0A0A0A]">
                <Radio className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-white font-semibold mb-3">Data Collection</h3>
              <p className="text-[#888] text-sm leading-relaxed">
                News, CLOB orderbook, and sentiment data aggregated in real-time from multiple sources.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center border border-[#1A1A1A] bg-[#0A0A0A]">
                <Brain className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-white font-semibold mb-3">AI Analysis</h3>
              <p className="text-[#888] text-sm leading-relaxed">
                5-agent Council debate with Doomer veto system ensures robust signal generation.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center border border-[#1A1A1A] bg-[#0A0A0A]">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-white font-semibold mb-3">Signal Delivery</h3>
              <p className="text-[#888] text-sm leading-relaxed">
                Real-time WebSocket updates delivered directly to your terminal with edge analysis.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
