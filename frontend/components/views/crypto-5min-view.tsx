"use client"

import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import { Zap, TrendingUp, TrendingDown, Clock, Activity, DollarSign, Target } from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface Crypto5MinMarket {
  slug: string
  question: string
  interval: number
  upPrice: number
  downPrice: number
  timeRemaining: number
  volume: number
}

interface LatencySignal {
  market: string
  slug: string
  question: string
  direction: "UP" | "DOWN"
  btcMove: number
  marketPrice: number
  trueProbability: number
  edge: number
  confidence: "low" | "medium" | "high"
  timeRemaining: number
  recommendedSide: string
  tokenId: string
  volume: number
}

interface Crypto5MinData {
  active_markets: Crypto5MinMarket[]
  signals: LatencySignal[]
  btcPrice: number
  timestamp: number
}

function formatTimeRemaining(seconds: number): string {
  if (seconds < 0) return "EXPIRED"
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

function getConfidenceColor(confidence: string): string {
  switch (confidence) {
    case "high": return "text-white bg-white/10 border-white/30"
    case "medium": return "text-[#888] bg-white/5 border-white/20"
    case "low": return "text-[#555] bg-white/5 border-white/10"
    default: return "text-white/40 bg-white/5 border-white/10"
  }
}

export function Crypto5MinView() {
  const [data, setData] = useState<Crypto5MinData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [localTime, setLocalTime] = useState(Date.now())
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now())

  // Fetch data every 2 seconds
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_URL}/api/v2/crypto/5min/signals`)
        const newData: Crypto5MinData = await res.json()
        setData(newData)
        setLastUpdate(Date.now())
        setIsLoading(false)
      } catch (err) {
        console.error("Failed to fetch 5-min data:", err)
        setIsLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 2000)
    return () => clearInterval(interval)
  }, [])

  // Local countdown
  useEffect(() => {
    const interval = setInterval(() => setLocalTime(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const secondsSinceUpdate = Math.floor((localTime - lastUpdate) / 1000)

  return (
    <div className="min-h-screen pt-20 md:pt-24 px-4 pb-8 bg-black">
      <div className="max-w-7xl mx-auto">
        {/* Professional Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 tracking-tight">
                5-Minute Crypto Signals
              </h1>
              <p className="text-sm text-white/50">
                Latency arbitrage on BTC/ETH short-term markets
              </p>
            </div>
            {data && (
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/20">
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-xs font-mono text-white">LIVE</span>
              </div>
            )}
          </div>

          {/* Performance Metrics */}
          {data && (
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white/5 border border-white/10 p-4">
                <div className="text-xs text-white/40 font-mono mb-1">BTC PRICE</div>
                <div className="text-2xl font-bold text-white font-mono">${data.btcPrice.toLocaleString()}</div>
              </div>
              <div className="bg-white/5 border border-white/10 p-4">
                <div className="text-xs text-white/40 font-mono mb-1">ACTIVE MARKETS</div>
                <div className="text-2xl font-bold text-white font-mono">{data.active_markets.length}</div>
              </div>
              <div className="bg-white/5 border border-white/10 p-4">
                <div className="text-xs text-white/40 font-mono mb-1">ACTIVE SIGNALS</div>
                <div className="text-2xl font-bold text-white font-mono">{data.signals.length}</div>
              </div>
              <div className="bg-white/5 border border-white/10 p-4">
                <div className="text-xs text-white/40 font-mono mb-1">AVG EDGE</div>
                <div className="text-2xl font-bold text-white font-mono">
                  {data.signals.length > 0 ? `+${((data.signals.reduce((sum, s) => sum + s.edge, 0) / data.signals.length) * 100).toFixed(1)}%` : 'N/A'}
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : !data ? (
          <div className="border border-white/10 bg-white/5 p-12 text-center">
            <p className="text-sm text-white/40">Failed to load data</p>
          </div>
        ) : (
          <>
            {/* Active Signals */}
            {data.signals.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
              >
                <h2 className="text-sm font-mono text-white mb-4 tracking-wider">
                  ACTIVE SIGNALS ({data.signals.length})
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {data.signals.map((signal, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`border p-5 ${
                        signal.direction === "UP"
                          ? "bg-green-500/5 border-green-500/30"
                          : "bg-red-500/5 border-red-500/30"
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          {signal.direction === "UP" ? (
                            <TrendingUp className="w-4 h-4 text-green-400" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-red-400" />
                          )}
                          <span className={`text-xs font-mono font-bold ${
                            signal.direction === "UP" ? "text-green-400" : "text-red-400"
                          }`}>
                            {signal.direction}
                          </span>
                        </div>
                        <span className={`px-2 py-1 border text-[9px] font-mono font-bold ${
                          getConfidenceColor(signal.confidence)
                        }`}>
                          {signal.confidence.toUpperCase()}
                        </span>
                      </div>

                      {/* Question */}
                      <p className="text-white/70 text-xs mb-4 line-clamp-2">{signal.question}</p>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="bg-white/5 border border-white/10 p-2">
                          <div className="text-[9px] text-white/40 font-mono mb-1">BTC MOVE</div>
                          <div className={`text-sm font-mono font-bold ${
                            signal.btcMove > 0 ? "text-green-400" : "text-red-400"
                          }`}>
                            {signal.btcMove > 0 ? "+" : ""}{signal.btcMove.toFixed(2)}%
                          </div>
                        </div>
                        <div className="bg-white/10 border border-white/30 p-2">
                          <div className="text-[9px] text-[#888] font-mono mb-1">EDGE</div>
                          <div className="text-sm font-mono font-bold text-white">
                            +{(signal.edge * 100).toFixed(1)}%
                          </div>
                        </div>
                        <div className="bg-white/5 border border-white/10 p-2">
                          <div className="text-[9px] text-white/40 font-mono mb-1">MARKET</div>
                          <div className="text-sm font-mono text-white">
                            {(signal.marketPrice * 100).toFixed(0)}¢
                          </div>
                        </div>
                        <div className="bg-white/5 border border-white/10 p-2">
                          <div className="text-[9px] text-white/40 font-mono mb-1">TRUE PROB</div>
                          <div className="text-sm font-mono text-white">
                            {(signal.trueProbability * 100).toFixed(0)}%
                          </div>
                        </div>
                      </div>

                      {/* Time Remaining */}
                      <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                        <span className="text-[9px] text-white/40 font-mono">TIME REMAINING</span>
                        <span className="text-xs text-white font-mono">
                          {formatTimeRemaining(signal.timeRemaining)}
                        </span>
                      </div>

                      {/* Execute Button */}
                      <a
                        href={`https://polymarket.com/event/${signal.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`w-full py-3 font-mono text-xs tracking-wider font-bold transition-all text-center block ${
                          signal.direction === "UP"
                            ? "bg-green-500 hover:bg-green-400 text-black"
                            : "bg-red-500 hover:bg-red-400 text-black"
                        }`}
                      >
                        EXECUTE {signal.direction}
                      </a>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* All Active Markets */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-sm font-mono text-white mb-4 tracking-wider">
                ALL ACTIVE MARKETS ({data.active_markets.length})
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.active_markets.map((market, idx) => {
                  const timeLeft = Math.max(0, market.timeRemaining - secondsSinceUpdate)
                  const progressPct = (timeLeft / (market.interval * 60)) * 100

                  return (
                    <motion.div
                      key={market.slug}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="border border-white/10 bg-white/5 p-4 hover:border-white/30 transition-all"
                    >
                      {/* Interval Badge */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="px-2 py-1 bg-white/10 border border-white/30 text-[9px] font-mono text-white font-bold">
                          {market.interval}MIN
                        </span>
                        <span className="text-[9px] text-white/40 font-mono">
                          {formatTimeRemaining(timeLeft)}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="relative h-1 bg-white/10 overflow-hidden mb-3">
                        <div
                          className="absolute inset-y-0 left-0 bg-white"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>

                      {/* Question */}
                      <p className="text-white/70 text-xs mb-3 line-clamp-2">{market.question}</p>

                      {/* Prices */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-white/5 border border-white/10 p-2">
                          <div className="text-[9px] text-white/40 font-mono mb-1">UP</div>
                          <div className="text-sm font-mono text-green-400 font-bold">
                            {(market.upPrice * 100).toFixed(0)}¢
                          </div>
                        </div>
                        <div className="bg-white/5 border border-white/10 p-2">
                          <div className="text-[9px] text-white/40 font-mono mb-1">DOWN</div>
                          <div className="text-sm font-mono text-red-400 font-bold">
                            {(market.downPrice * 100).toFixed(0)}¢
                          </div>
                        </div>
                      </div>

                      {/* Volume */}
                      <div className="text-[9px] text-white/40 font-mono text-center mb-3">
                        VOLUME: ${market.volume.toLocaleString()}
                      </div>

                      {/* Trade Button */}
                      <a
                        href={`https://polymarket.com/event/${market.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 font-mono text-[10px] tracking-wider bg-white/10 hover:bg-white/20 text-white transition-all text-center block border border-white/10"
                      >
                        TRADE ON POLYMARKET
                      </a>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>

            {/* Strategy Info */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-8 border border-white/10 bg-white/5 p-6"
            >
              <h3 className="text-sm font-mono text-white mb-4 tracking-wider">
                STRATEGY: LATENCY ARBITRAGE
              </h3>
              <div className="grid md:grid-cols-3 gap-6 text-xs">
                <div>
                  <div className="text-white font-mono font-bold mb-2 text-[10px]">1. DETECT</div>
                  <p className="text-white/60 leading-relaxed">
                    Monitor BTC price on Binance with sub-second precision for real-time movements
                  </p>
                </div>
                <div>
                  <div className="text-white font-mono font-bold mb-2 text-[10px]">2. CALCULATE</div>
                  <p className="text-white/60 leading-relaxed">
                    Compare true probability against Polymarket's delayed pricing to identify edge
                  </p>
                </div>
                <div>
                  <div className="text-white font-mono font-bold mb-2 text-[10px]">3. EXECUTE</div>
                  <p className="text-white/60 leading-relaxed">
                    Trade immediately when edge exceeds 5% threshold before market adjusts
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </div>
  )
}
