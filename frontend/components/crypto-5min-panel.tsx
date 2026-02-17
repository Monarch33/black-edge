"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useState, useCallback } from "react"
import { Zap, TrendingUp, TrendingDown, Clock, Activity, AlertTriangle } from "lucide-react"

// =============================================================================
// Types
// =============================================================================

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
  direction: "UP" | "DOWN"
  btcMove: number
  marketPrice: number
  trueProbability: number
  edge: number
  confidence: "low" | "medium" | "high"
  timeRemaining: number
  recommendedSide: string
  tokenId: string
  slug: string
  question: string
  volume: number
}

interface Crypto5MinData {
  active_markets: Crypto5MinMarket[]
  signals: LatencySignal[]
  btcPrice: number
  timestamp: number
}

// =============================================================================
// Constants
// =============================================================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
const POLL_INTERVAL = 2000 // 2 seconds

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate Kelly Criterion bet size
 * Kelly% = (edge / odds) for binary outcomes
 * Returns fractional kelly (0.25x for safety)
 */
function calculateKellyFraction(edge: number, probability: number): number {
  if (edge <= 0 || probability <= 0 || probability >= 1) return 0

  // Kelly formula: f = (p * (b + 1) - 1) / b
  // where p = true probability, b = odds (decimal - 1)
  // For Polymarket: if buying at 'marketPrice', b = (1/marketPrice) - 1

  // Simplified: Kelly% = edge / (1 - probability)
  const kellyFull = edge / (1 - probability)

  // Use 25% Kelly (fractional) for safety
  const kellyFractional = kellyFull * 0.25

  // Cap at 10% of bankroll
  return Math.min(kellyFractional, 0.10)
}

function formatTimeRemaining(seconds: number): string {
  if (seconds < 0) return "EXPIRED"
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

function getProgressPercentage(timeRemaining: number, interval: number): number {
  const totalSeconds = interval * 60
  return Math.max(0, Math.min(100, (timeRemaining / totalSeconds) * 100))
}

function getConfidenceColor(confidence: string): string {
  switch (confidence) {
    case "high": return "text-green-400"
    case "medium": return "text-yellow-400"
    case "low": return "text-orange-400"
    default: return "text-white/40"
  }
}

// =============================================================================
// Main Component
// =============================================================================

interface Crypto5MinPanelProps {
  onTradeClick?: (signal: LatencySignal, amount: number) => void
  userBalance?: number
}

export function Crypto5MinPanel({ onTradeClick, userBalance = 1000 }: Crypto5MinPanelProps) {
  const [data, setData] = useState<Crypto5MinData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now())
  const [flashSignal, setFlashSignal] = useState<"UP" | "DOWN" | null>(null)

  // Fetch data from API
  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/v2/crypto/5min/signals`)

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`)
      }

      const newData: Crypto5MinData = await response.json()

      // Check if we have a new signal
      if (newData.signals.length > 0 && data?.signals.length === 0) {
        const signal = newData.signals[0]
        setFlashSignal(signal.direction)
        setTimeout(() => setFlashSignal(null), 2000)
      }

      setData(newData)
      setLastUpdate(Date.now())
      setError(null)
    } catch (err) {
      console.error("Failed to fetch crypto 5-min data:", err)
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setIsLoading(false)
    }
  }, [data?.signals.length])

  // Poll data every 2 seconds
  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchData])

  // Local countdown timer
  const [localTime, setLocalTime] = useState(Date.now())
  useEffect(() => {
    const interval = setInterval(() => setLocalTime(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  if (isLoading) {
    return null // Don't show anything while loading
  }

  if (error || !data) {
    return null // Don't show error state, just hide
  }

  const currentMarket = data.active_markets.find(m => m.timeRemaining > 30 && m.timeRemaining < 400)
  const signal = data.signals[0] // Best signal

  // Calculate elapsed time for progress bar
  const secondsSinceUpdate = Math.floor((localTime - lastUpdate) / 1000)

  // =========================================================================
  // MINIMAL FLOATING BADGE (No Signal State)
  // =========================================================================

  if (!signal) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed top-20 right-4 z-40"
      >
        <div className="relative group">
          {/* Glassmorphism badge */}
          <div className="backdrop-blur-xl bg-black/40 border border-white/10 rounded-full px-4 py-2 shadow-2xl">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Zap className="w-3.5 h-3.5 text-yellow-500/80" />
                <motion.div
                  className="absolute inset-0"
                  animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Zap className="w-3.5 h-3.5 text-yellow-500" />
                </motion.div>
              </div>
              <span className="text-[10px] text-white/60 font-mono tracking-wider">
                BTC SCANNER
              </span>
              <Activity className="w-3 h-3 text-white/30 animate-pulse" />
            </div>
          </div>

          {/* Tooltip on hover */}
          <div className="absolute top-full right-0 mt-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="backdrop-blur-xl bg-black/60 border border-white/10 rounded px-3 py-2 shadow-xl whitespace-nowrap">
              <div className="text-[10px] text-white/40 font-mono">
                {data.active_markets.length} markets • Scanning for edge...
              </div>
              <div className="text-[10px] text-white/60 font-mono mt-1">
                BTC: ${data.btcPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  // =========================================================================
  // PREMIUM EXPANDED PANEL (Signal Detected)
  // =========================================================================

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ type: "spring", duration: 0.6 }}
      className="relative"
    >
      {/* Premium container with glassmorphism */}
      <div
        className={`relative backdrop-blur-2xl bg-gradient-to-br border rounded-lg shadow-2xl transition-all duration-500 overflow-hidden ${
          flashSignal === "UP"
            ? "from-green-950/40 via-black/60 to-black/60 border-green-500/50 shadow-[0_0_40px_rgba(34,197,94,0.4)]"
            : flashSignal === "DOWN"
            ? "from-red-950/40 via-black/60 to-black/60 border-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.4)]"
            : "from-black/40 via-black/60 to-black/40 border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)]"
        }`}
      >
        {/* Animated gradient overlay */}
        <motion.div
          className="absolute inset-0 opacity-20"
          animate={{
            background: [
              "radial-gradient(circle at 0% 0%, rgba(234,179,8,0.1) 0%, transparent 50%)",
              "radial-gradient(circle at 100% 100%, rgba(234,179,8,0.1) 0%, transparent 50%)",
              "radial-gradient(circle at 0% 0%, rgba(234,179,8,0.1) 0%, transparent 50%)",
            ],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        />

        {/* Premium Header */}
        <div className="relative flex items-center justify-between px-5 py-3.5 border-b border-white/5 bg-gradient-to-r from-white/[0.03] to-transparent">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Zap className="w-5 h-5 text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.6)]" />
              <motion.div
                className="absolute inset-0"
                animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Zap className="w-5 h-5 text-yellow-400" />
              </motion.div>
            </div>
            <div>
              <div className="text-sm text-white font-mono tracking-wider">LATENCY SIGNAL</div>
              <div className="text-[10px] text-white/40 font-mono mt-0.5">High-Frequency Arbitrage</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[9px] text-white/30 font-mono tracking-wider">BTC/USDT</div>
              <div className="text-sm text-white font-mono tracking-tight">
                ${data.btcPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
        </div>

        {/* Premium Content */}
        <div className="relative p-5 space-y-4">
        {/* Current Market */}
        {currentMarket ? (
          <>
            {/* Interval Info */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-cyan-400/60" />
                <span className="text-[11px] text-white/50 font-mono tracking-wider">
                  {currentMarket.interval}MIN INTERVAL
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 rounded">
                  <span className="text-[11px] text-cyan-400 font-mono tracking-wider">
                    {formatTimeRemaining(Math.max(0, currentMarket.timeRemaining - secondsSinceUpdate))}
                  </span>
                </div>
              </div>
            </div>

            {/* Premium Progress Bar */}
            <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden shadow-inner">
              <motion.div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                initial={{ width: "100%" }}
                animate={{
                  width: `${getProgressPercentage(
                    Math.max(0, currentMarket.timeRemaining - secondsSinceUpdate),
                    currentMarket.interval
                  )}%`
                }}
                transition={{ duration: 1, ease: "linear" }}
              />
            </div>

            {/* Signal Detection - PREMIUM */}
            <AnimatePresence mode="wait">
              {signal && (
                <motion.div
                  key="signal"
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.9 }}
                  transition={{ type: "spring", duration: 0.5 }}
                  className="relative"
                >
                  {/* Premium Signal Card */}
                  <div className={`backdrop-blur-xl border-2 rounded-xl p-4 shadow-2xl relative overflow-hidden ${
                    signal.direction === "UP"
                      ? "bg-gradient-to-br from-green-950/60 via-green-900/40 to-black/60 border-green-500/50"
                      : "bg-gradient-to-br from-red-950/60 via-red-900/40 to-black/60 border-red-500/50"
                  }`}>
                    {/* Animated glow effect */}
                    <motion.div
                      className={`absolute inset-0 opacity-30 ${
                        signal.direction === "UP" ? "bg-green-500/20" : "bg-red-500/20"
                      }`}
                      animate={{
                        scale: [1, 1.05, 1],
                        opacity: [0.2, 0.3, 0.2],
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />

                    {/* Content */}
                    <div className="relative space-y-3">
                      {/* Signal Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          {signal.direction === "UP" ? (
                            <TrendingUp className="w-5 h-5 text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                          ) : (
                            <TrendingDown className="w-5 h-5 text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                          )}
                          <div>
                            <div className={`text-sm font-mono tracking-wider ${
                              signal.direction === "UP" ? "text-green-400" : "text-red-400"
                            }`}>
                              {signal.direction} DETECTED
                            </div>
                            <div className="text-[9px] text-white/40 font-mono mt-0.5">
                              Latency Arbitrage Opportunity
                            </div>
                          </div>
                        </div>
                        <div className={`px-2.5 py-1 rounded-lg border backdrop-blur-sm ${
                          signal.confidence === "high"
                            ? "bg-green-500/20 border-green-500/40 text-green-400"
                            : signal.confidence === "medium"
                            ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-400"
                            : "bg-orange-500/20 border-orange-500/40 text-orange-400"
                        }`}>
                          <span className="text-[10px] font-mono font-semibold tracking-wider">
                            {signal.confidence.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* Premium Stats Grid */}
                      <div className="grid grid-cols-2 gap-3">
                        {/* BTC Move */}
                        <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-lg p-2.5">
                          <div className="text-[9px] text-white/40 font-mono mb-1 tracking-wider">BTC MOVE</div>
                          <div className={`text-lg font-mono font-semibold ${
                            signal.btcMove > 0 ? "text-green-400" : "text-red-400"
                          }`}>
                            {signal.btcMove > 0 ? "+" : ""}{signal.btcMove.toFixed(2)}%
                          </div>
                        </div>

                        {/* Edge */}
                        <div className="backdrop-blur-sm bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2.5">
                          <div className="text-[9px] text-yellow-400/60 font-mono mb-1 tracking-wider">EDGE</div>
                          <div className="text-lg font-mono font-semibold text-yellow-400">
                            +{(signal.edge * 100).toFixed(1)}%
                          </div>
                        </div>

                        {/* Market Price */}
                        <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-lg p-2.5">
                          <div className="text-[9px] text-white/40 font-mono mb-1 tracking-wider">MARKET</div>
                          <div className="text-base font-mono text-white/80">
                            {(signal.marketPrice * 100).toFixed(0)}¢
                          </div>
                        </div>

                        {/* True Probability */}
                        <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-lg p-2.5">
                          <div className="text-[9px] text-white/40 font-mono mb-1 tracking-wider">TRUE PROB</div>
                          <div className="text-base font-mono text-white/80">
                            {(signal.trueProbability * 100).toFixed(0)}%
                          </div>
                        </div>
                      </div>

                      {/* Premium CTA Button */}
                      <button
                        onClick={() => {
                          const kellyFraction = calculateKellyFraction(signal.edge, signal.trueProbability)
                          const recommendedAmount = userBalance * kellyFraction
                          if (onTradeClick) {
                            onTradeClick(signal, Math.max(10, Math.floor(recommendedAmount)))
                          }
                        }}
                        className={`group relative w-full py-3.5 rounded-lg font-mono text-sm tracking-widest font-semibold transition-all duration-300 overflow-hidden ${
                          signal.direction === "UP"
                            ? "bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-black shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:shadow-[0_0_30px_rgba(34,197,94,0.6)]"
                            : "bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-black shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:shadow-[0_0_30px_rgba(239,68,68,0.6)]"
                        }`}
                      >
                        <motion.div
                          className="absolute inset-0 bg-white/20"
                          initial={{ x: "-100%" }}
                          whileHover={{ x: "100%" }}
                          transition={{ duration: 0.5 }}
                        />
                        <span className="relative flex items-center justify-center gap-2">
                          <Zap className="w-4 h-4" />
                          EXECUTE {signal.direction} • ${Math.max(10, Math.floor(userBalance * calculateKellyFraction(signal.edge, signal.trueProbability)))}
                        </span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : null}
        </div>

        {/* Subtle footer */}
        <div className="relative px-5 py-2.5 border-t border-white/5 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent">
          <div className="flex items-center justify-center gap-4 text-[9px] text-white/30 font-mono">
            <span>{data.active_markets.length} MARKETS</span>
            <span>•</span>
            <span>HFT ARBITRAGE</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
