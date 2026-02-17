"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import {
  Activity, Wifi, Clock, Zap, AlertTriangle, TrendingUp, TrendingDown,
  Play, ChevronRight, Shield, Eye, Crosshair, Copy, Check, Radio,
  Loader2, RotateCcw, Lock, BarChart3, Grid3X3, Skull,
  ExternalLink, Volume2, VolumeX,
} from "lucide-react"
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi"
import { parseEther } from "viem"
import { TradeDock } from "@/components/execution/trade-dock"
import { Crypto5MinPanel } from "@/components/crypto-5min-panel"

// =============================================================================
// Types
// =============================================================================

interface QuantSignal {
  id: string
  market: string
  question: string
  platform: string
  url: string
  polyOdds: number
  trueProb: number
  edge: number
  volume: string
  volumeTotal: string
  liquidity: number
  trend: "up" | "down" | "neutral"
  risk: "low" | "medium" | "high"
  spread: number
  kellyFraction: number
  volatility: number
  arbFlag: boolean
  arbDetail: string
  signalStrength: number
}

interface WhaleWallet {
  address: string
  label: string
  pnl: string
  isTracking: boolean
  lastAction?: string
}

interface ExecutionSettings {
  mevProtection: boolean
  sniperMode: boolean
  maxSlippage: number
  gasMultiplier: number
  privateRpc: boolean
}

type ViewMode = "table" | "heatmap"

// =============================================================================
// Constants
// =============================================================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
const FREE_TIMER_SECONDS = 60

// Category definitions
const CATEGORIES = ["ALL", "POLITICS", "CRYPTO", "ECONOMY", "SPORTS", "OTHER"] as const
type Category = typeof CATEGORIES[number]

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get trading recommendation based on quant metrics
 * STRICTER CALIBRATION - Realistic signals for production
 */
function getRecommendation(signal: QuantSignal): {
  label: string
  color: string
  bgColor: string
  borderColor: string
} {
  const { edge, signalStrength, arbFlag, risk, volume } = signal

  // Parse volume string to number for threshold checks
  const volumeNum = parseFloat(volume.replace(/[$KM]/g, '')) * (volume.includes('M') ? 1_000_000 : volume.includes('K') ? 1_000 : 1)

  // ARBITRAGE - highest priority (rare)
  if (arbFlag) {
    return {
      label: "🚨 ARBITRAGE",
      color: "text-white",
      bgColor: "bg-white/20",
      borderColor: "border-white/50"
    }
  }

  // STRONG BUY: Edge >5%, signal >70, volume >$50k, low risk
  if (edge > 5.0 && signalStrength > 70 && volumeNum > 50_000 && risk === "low") {
    return {
      label: "💎 STRONG BUY",
      color: "text-green-400",
      bgColor: "bg-green-500/20",
      borderColor: "border-green-500/50"
    }
  }

  // BUY: Edge >2%, signal >50
  if (edge > 2.0 && signalStrength > 50) {
    return {
      label: "✅ BUY",
      color: "text-green-400",
      bgColor: "bg-green-500/15",
      borderColor: "border-green-500/30"
    }
  }

  // NEUTRAL: Edge between 0-1%, or signal 30-50
  if (edge >= 0 && edge < 1.0) {
    return {
      label: "➖ NEUTRAL",
      color: "text-gray-400",
      bgColor: "bg-gray-500/15",
      borderColor: "border-gray-500/30"
    }
  }

  // HOLD: Edge 1-2%, moderate signal
  if (edge >= 1.0 && edge < 2.0 && signalStrength > 30) {
    return {
      label: "⚠️  HOLD",
      color: "text-white/70",
      bgColor: "bg-white/10",
      borderColor: "border-white/30"
    }
  }

  // AVOID: Negative edge or very high risk
  return {
    label: "❌ AVOID",
    color: "text-white/50",
    bgColor: "bg-white/5",
    borderColor: "border-white/20"
  }
}

/**
 * Categorize market based on question text
 */
function categorizeMarket(question: string, market: string): Category {
  const text = (question + " " + market).toLowerCase()

  if (text.match(/trump|biden|election|president|congress|senate|vote|politics|democrat|republican|government/)) {
    return "POLITICS"
  }
  if (text.match(/btc|bitcoin|eth|ethereum|crypto|solana|doge|nft|defi|blockchain/)) {
    return "CRYPTO"
  }
  if (text.match(/fed|rate|gdp|inflation|stock|market|economy|recession|unemployment|treasury/)) {
    return "ECONOMY"
  }
  if (text.match(/nfl|nba|super bowl|world series|championship|sports|game|team|player/)) {
    return "SPORTS"
  }
  return "OTHER"
}

// Mock data removed - using live API only

// =============================================================================
// Sub-Components
// =============================================================================

function CategoryTabs({ activeCategory, onCategoryChange, opportunitiesByCategory }: {
  activeCategory: Category
  onCategoryChange: (category: Category) => void
  opportunitiesByCategory: Record<Category, number>
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {CATEGORIES.map((category) => {
        const count = opportunitiesByCategory[category] || 0
        const isActive = category === activeCategory

        return (
          <button
            key={category}
            onClick={() => onCategoryChange(category)}
            className={`px-3 py-2 text-[10px] md:text-xs font-mono tracking-wider transition-all border ${
              isActive
                ? "bg-white/10 border-white/30 text-white"
                : "bg-white/5 border-white/10 text-white/40 hover:border-white/20 hover:text-white/60"
            }`}
          >
            {category}
            {count > 0 && (
              <span className={`ml-2 px-1.5 py-0.5 text-[8px] rounded ${
                isActive ? "bg-white/20" : "bg-white/10"
              }`}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function AITickerTape({ signals, isPaywalled }: { signals: QuantSignal[]; isPaywalled: boolean }) {
  const tickerRef = useRef<HTMLDivElement>(null)
  const [muted, setMuted] = useState(false)

  const tickerItems = useMemo(() => {
    return signals.map((s) => {
      const edgeColor = s.edge > 0 ? "text-green-500" : s.edge < 0 ? "text-red-500" : "text-white/40"
      const arbBadge = s.arbFlag ? " [ARB]" : ""
      return {
        id: s.id,
        text: `${s.market} ${s.polyOdds}%→${s.trueProb}%`,
        edge: `${s.edge > 0 ? "+" : ""}${s.edge}%`,
        edgeColor,
        signal: s.signalStrength,
        arbBadge,
      }
    })
  }, [signals])

  return (
    <div className="relative border-b border-white/10 bg-[#020408] overflow-hidden h-8 flex items-center">
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#020408] to-transparent z-10 flex items-center pl-2">
        <Zap className="w-3 h-3 text-white/60" />
      </div>
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#020408] to-transparent z-10 flex items-center justify-end pr-2">
        <button onClick={() => setMuted(!muted)} className="text-white/30 hover:text-white/60 transition-colors">
          {muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
        </button>
      </div>
      <motion.div
        ref={tickerRef}
        className={`flex items-center gap-8 whitespace-nowrap ${isPaywalled ? "blur-sm" : ""}`}
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      >
        {[...tickerItems, ...tickerItems].map((item, i) => (
          <span key={`${item.id}-${i}`} className="flex items-center gap-2 text-[10px] font-mono">
            <span className="text-white/60">{item.text}</span>
            <span className={item.edgeColor}>{item.edge}</span>
            {item.arbBadge && <span className="text-white font-bold">{item.arbBadge}</span>}
            <span className="text-white/20">|</span>
            <span className="text-white/30">SIG:{item.signal}</span>
            <span className="text-white/10">///</span>
          </span>
        ))}
      </motion.div>
    </div>
  )
}

function TerminalLogs() {
  const [logs, setLogs] = useState<Array<{ type: string; text: string }>>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch(`${API_URL}/api/v2/health`)
        if (res.ok) {
          const h = await res.json()
          setLogs([
            { type: "info", text: "> BLACK_EDGE v4.0.0 initializing..." },
            { type: "success", text: `> POLYMARKET: ${h.polymarket_client?.markets_cached || 0} markets cached` },
            { type: "success", text: `> QUANT_ENGINE: ${h.quant_engine?.status || 'ready'}` },
            { type: "success", text: "> SYSTEM: all components healthy" },
            { type: "info", text: "> READY TO TRADE" },
          ])
        } else {
          throw new Error('Health check failed')
        }
      } catch (error) {
        setLogs([
          { type: "info", text: "> BLACK_EDGE v4.0.0 initializing..." },
          { type: "error", text: "> BACKEND: offline" },
          { type: "warning", text: "> Start backend: cd backend && python main.py" },
        ])
      } finally {
        setIsLoading(false)
      }
    }
    fetchHealth()
  }, [])

  const getLogColor = (type: string) => {
    switch (type) {
      case "success": return "text-[#22C55E]"
      case "warning": return "text-[#888]"
      case "error": return "text-[#EF4444]"
      default: return "text-white/50"
    }
  }

  return (
    <div className="h-full overflow-y-auto font-mono text-[10px] md:text-xs p-3 md:p-4 space-y-1">
      {logs.map((log, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          className={getLogColor(log.type)}
        >
          {log.text}
        </motion.div>
      ))}
      {isLoading && <div className="text-white/30">&gt; Loading...</div>}
      <div className="flex items-center text-white/30">&gt; <span className="animate-blink ml-1">_</span></div>
    </div>
  )
}

function MevProtectionToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={`flex items-center gap-2 px-3 py-2 text-[10px] md:text-xs font-mono tracking-wider transition-all ${enabled ? "bg-white/20 border border-white/50 text-white" : "bg-white/5 border border-white/10 text-white/40 hover:border-white/20"}`}>
      <Shield className={`w-3 h-3 ${enabled ? "text-white" : "text-white/30"}`} />
      <span className="hidden sm:inline">MEV PROTECTION</span>
      <span className="sm:hidden">MEV</span>
      <div className={`w-6 h-3 rounded-full relative transition-colors ${enabled ? "bg-white/50" : "bg-white/20"}`}>
        <div className={`absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all ${enabled ? "left-3.5" : "left-0.5"}`} />
      </div>
    </button>
  )
}

function SniperModeBadge({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={`relative flex items-center gap-2 px-3 py-2 text-[10px] md:text-xs font-mono tracking-wider transition-all overflow-hidden ${enabled ? "bg-white/20 border border-white/50 text-white" : "bg-white/5 border border-white/10 text-white/40 hover:border-white/20"}`}>
      {enabled && <motion.div className="absolute inset-0 bg-white/10" animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }} />}
      <Crosshair className={`w-3 h-3 relative z-10 ${enabled ? "text-white" : "text-white/30"}`} />
      <span className="relative z-10 hidden sm:inline">SNIPER MODE</span>
      <span className="relative z-10 sm:hidden">SNIPE</span>
      {enabled && <motion.span className="relative z-10 w-2 h-2 rounded-full bg-white" animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />}
    </button>
  )
}

function PrivateRpcToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={`flex items-center gap-2 px-3 py-2 text-[10px] md:text-xs font-mono tracking-wider transition-all ${enabled ? "bg-cyan-500/20 border border-cyan-500/50 text-cyan-400" : "bg-white/5 border border-white/10 text-white/40 hover:border-white/20"}`}>
      <Radio className={`w-3 h-3 ${enabled ? "text-cyan-400" : "text-white/30"}`} />
      <span className="hidden sm:inline">PRIVATE RPC</span>
      <span className="sm:hidden">RPC</span>
      {enabled && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />}
    </button>
  )
}

function ViewModeToggle({ mode, onToggle }: { mode: ViewMode; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 text-white/40 hover:border-white/20 hover:text-white/60 text-[10px] md:text-xs font-mono tracking-wider transition-all">
      {mode === "table" ? <Grid3X3 className="w-3 h-3" /> : <BarChart3 className="w-3 h-3" />}
      <span className="hidden sm:inline">{mode === "table" ? "HEATMAP" : "TABLE"}</span>
    </button>
  )
}

function SignalHeatmap({ signals, isPaywalled }: { signals: QuantSignal[]; isPaywalled: boolean }) {
  const maxSignal = Math.max(...signals.map((s) => s.signalStrength), 1)

  const getHeatColor = (strength: number) => {
    const ratio = strength / 100
    if (ratio > 0.7) return "bg-green-500/40 border-green-500/60"
    if (ratio > 0.4) return "bg-white/20 border-white/40"
    return "bg-white/10 border-white/20"
  }

  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-2 p-4 ${isPaywalled ? "blur-sm" : ""}`}>
      {signals.map((s) => (
        <div key={s.id} className={`border p-3 ${getHeatColor(s.signalStrength)} transition-all hover:scale-105 cursor-pointer`}>
          <div className="text-[10px] text-white/80 font-mono truncate mb-1">{s.market}</div>
          <div className="flex items-center justify-between">
            <span className={`text-sm font-mono font-bold ${s.edge > 0 ? "text-green-400" : "text-red-400"}`}>
              {s.edge > 0 ? "+" : ""}{s.edge}%
            </span>
            <span className="text-[10px] text-white/40 font-mono">SIG:{s.signalStrength}</span>
          </div>
          <div className="mt-1 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-white/30 to-white/90 transition-all" style={{ width: `${s.signalStrength}%` }} />
          </div>
          {s.arbFlag && <div className="mt-1 text-[8px] text-white font-mono">ARB DETECTED</div>}
        </div>
      ))}
    </div>
  )
}

function WhaleRadar({ wallets, onAddWallet, onRemoveWallet, onToggleTracking, isPaywalled }: {
  wallets: WhaleWallet[]
  onAddWallet: (address: string, label: string) => void
  onRemoveWallet: (address: string) => void
  onToggleTracking: (address: string) => void
  isPaywalled: boolean
}) {
  const [inputAddress, setInputAddress] = useState("")
  const [inputLabel, setInputLabel] = useState("")
  const [isExpanded, setIsExpanded] = useState(true)
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)

  const handleAdd = () => {
    if (inputAddress.startsWith("0x") && inputAddress.length === 42) {
      onAddWallet(inputAddress, inputLabel || `Whale ${wallets.length + 1}`)
      setInputAddress("")
      setInputLabel("")
    }
  }

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address)
    setCopiedAddress(address)
    setTimeout(() => setCopiedAddress(null), 2000)
  }

  return (
    <div className="border border-white/10 bg-[#020408]">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 md:px-4 py-3 border-b border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-amber-500" />
          <span className="text-xs md:text-sm text-white font-mono tracking-wider">WHALE RADAR</span>
          <span className="px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-500 font-mono">{wallets.filter((w) => w.isTracking).length} ACTIVE</span>
        </div>
        <ChevronRight className={`w-4 h-4 text-white/30 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="p-3 border-b border-white/5">
              <div className="flex gap-2">
                <input type="text" value={inputAddress} onChange={(e) => setInputAddress(e.target.value)} placeholder="0x... wallet address" className="flex-1 bg-white/5 border border-white/10 px-3 py-2 text-xs font-mono text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/50" />
                <input type="text" value={inputLabel} onChange={(e) => setInputLabel(e.target.value)} placeholder="Label" className="w-24 bg-white/5 border border-white/10 px-3 py-2 text-xs font-mono text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/50" />
                <button onClick={handleAdd} disabled={!inputAddress.startsWith("0x") || inputAddress.length !== 42} className="px-3 py-2 bg-amber-500/20 border border-amber-500/50 text-amber-500 text-xs font-mono tracking-wider hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">TRACK</button>
              </div>
            </div>
            <div className={`max-h-48 overflow-y-auto ${isPaywalled ? "blur-sm" : ""}`}>
              {wallets.length === 0 ? (
                <div className="p-4 text-center text-white/30 text-xs font-mono">No wallets tracked. Add a whale address above.</div>
              ) : (
                wallets.map((wallet) => (
                  <div key={wallet.address} className={`flex items-center justify-between px-3 py-2 border-b border-white/5 ${wallet.isTracking ? "bg-amber-500/5" : ""}`}>
                    <div className="flex items-center gap-3">
                      <button onClick={() => onToggleTracking(wallet.address)} className={`w-3 h-3 rounded-full transition-colors ${wallet.isTracking ? "bg-amber-500" : "bg-white/20 hover:bg-white/30"}`} />
                      <div>
                        <div className="text-xs text-white/80 font-mono">{wallet.label}</div>
                        <div className="text-[10px] text-white/40 font-mono flex items-center gap-1">
                          {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
                          <button onClick={() => copyAddress(wallet.address)} className="p-0.5 hover:bg-white/10 rounded">
                            {copiedAddress === wallet.address ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-white/30" />}
                          </button>
                        </div>
                        {wallet.lastAction && <div className="text-[8px] text-cyan-500 font-mono mt-0.5">{wallet.lastAction}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono ${wallet.pnl.startsWith("+") ? "text-green-500" : "text-red-500"}`}>{wallet.pnl}</span>
                      <button
                        onClick={() => {}}
                        disabled={isPaywalled}
                        className={`px-2 py-1 text-[8px] font-mono tracking-wider border transition-all ${isPaywalled ? "border-white/5 text-white/20 cursor-not-allowed" : "border-cyan-500/30 text-cyan-500 bg-cyan-500/10 hover:bg-cyan-500/20"}`}
                      >
                        {isPaywalled ? <Lock className="w-3 h-3 inline" /> : "COPY TRADE"}
                      </button>
                      <button onClick={() => onRemoveWallet(wallet.address)} className="text-white/30 hover:text-white transition-colors">&times;</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function OpportunityRow({ opp, onSelect, isPaywalled }: { opp: QuantSignal; onSelect: (market: QuantSignal) => void; isPaywalled: boolean }) {
  const recommendation = getRecommendation(opp)

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group cursor-pointer"
      onClick={() => onSelect(opp)}
    >
      {/* MARKET */}
      <td className="py-3 px-3 md:px-4">
        <div className="flex items-center gap-2">
          {opp.arbFlag && <AlertTriangle className="w-3 h-3 text-white flex-shrink-0" />}
          {opp.risk === "high" && !opp.arbFlag && <AlertTriangle className="w-3 h-3 text-white/60 flex-shrink-0" />}
          <div>
            <div className="flex items-center gap-1">
              <span className="text-white/80 text-[10px] md:text-xs font-mono whitespace-nowrap">{opp.market}</span>
              {opp.url && (
                <a
                  href={opp.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-3 h-3 text-white/20 hover:text-white/50" />
                </a>
              )}
            </div>
            <span className="text-[8px] text-white/30 font-mono">{opp.platform} | VOL: {opp.volume}</span>
          </div>
        </div>
      </td>

      {/* SIGNAL (Recommendation Badge) */}
      <td className="py-3 px-3 md:px-4 text-center">
        <span className={`inline-block px-2 py-1 text-[10px] font-mono border ${recommendation.color} ${recommendation.bgColor} ${recommendation.borderColor} whitespace-nowrap`}>
          {recommendation.label}
        </span>
      </td>

      {/* CONFIDENCE (Progress Bar) */}
      <td className="py-3 px-3 md:px-4">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                opp.signalStrength >= 70 ? "bg-green-500" :
                opp.signalStrength >= 40 ? "bg-white/60" :
                "bg-white/30"
              }`}
              style={{ width: `${opp.signalStrength}%` }}
            />
          </div>
          <span className={`text-[10px] md:text-xs font-mono font-bold w-8 text-right ${
            opp.signalStrength >= 70 ? "text-green-500" :
            opp.signalStrength >= 40 ? "text-white/80" :
            "text-white/50"
          }`}>
            {opp.signalStrength}
          </span>
        </div>
      </td>

      {/* EDGE */}
      <td className="py-3 px-3 md:px-4 text-center">
        <span className={`text-sm md:text-base font-mono font-bold ${opp.edge > 0 ? "text-green-400" : "text-red-400"}`}>
          {opp.edge > 0 ? "+" : ""}{opp.edge}%
        </span>
        <div className="text-[8px] text-white/30 font-mono mt-0.5">
          Kelly: {(opp.kellyFraction * 100).toFixed(1)}%
        </div>
      </td>

      {/* ODDS */}
      <td className="py-3 px-3 md:px-4 text-center">
        <div className="text-[10px] md:text-xs font-mono">
          <div className="text-white/50">{opp.polyOdds}%</div>
          <div className="text-green-400 text-[8px] mt-0.5">→ {opp.trueProb}%</div>
        </div>
      </td>

      {/* RISK */}
      <td className="py-3 px-3 md:px-4 text-center">
        <span className={`px-2 py-1 text-[10px] font-mono border ${
          opp.risk === "low" ? "text-green-400 bg-green-500/10 border-green-500/30" :
          opp.risk === "medium" ? "text-white/70 bg-white/10 border-white/30" :
          "text-white/50 bg-white/5 border-white/20"
        }`}>
          {opp.risk.toUpperCase()}
        </span>
      </td>

      {/* ACTION */}
      <td className="py-3 px-3 md:px-4 text-right">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onSelect(opp)
          }}
          disabled={isPaywalled}
          className={`px-3 py-2 text-[10px] md:text-xs font-mono tracking-wider transition-all flex items-center gap-2 ml-auto ${
            isPaywalled
              ? "bg-white/5 text-white/20 border border-white/5 cursor-not-allowed"
              : "bg-white/10 text-white border border-white/30 hover:bg-white/20 hover:border-white/50"
          }`}
        >
          {isPaywalled ? (
            <>
              <Lock className="w-3 h-3" />
              <span className="hidden sm:inline">LOCKED</span>
            </>
          ) : (
            <>
              <Zap className="w-3 h-3" />
              <span className="hidden sm:inline">TRADE</span>
            </>
          )}
        </button>
      </td>
    </motion.tr>
  )
}

function PanicDock({ isPaywalled, onPanicSell, executedTrades, totalProfit }: {
  isPaywalled: boolean
  onPanicSell: () => void
  executedTrades: number
  totalProfit: number
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#020408]/95 backdrop-blur-sm">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/30 font-mono">TRADES:</span>
            <span className="text-sm text-white font-mono">{executedTrades}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/30 font-mono">P/L:</span>
            <span className={`text-sm font-mono ${totalProfit >= 0 ? "text-green-500" : "text-red-500"}`}>
              {totalProfit >= 0 ? "+" : ""}${totalProfit.toFixed(2)}
            </span>
          </div>
        </div>
        <button
          onClick={onPanicSell}
          disabled={isPaywalled}
          className={`px-4 py-2 text-[10px] md:text-xs font-mono tracking-wider transition-all flex items-center gap-2 ${
            isPaywalled
              ? "bg-white/5 text-white/20 border border-white/5 cursor-not-allowed"
              : "bg-white/20 text-white border border-white/50 hover:bg-white/30 active:bg-white/40"
          }`}
        >
          {isPaywalled ? <Lock className="w-3 h-3" /> : <Skull className="w-3 h-3" />}
          PANIC SELL ALL
        </button>
      </div>
    </div>
  )
}

function PaywallOverlay({ secondsLeft, onUpgrade }: { secondsLeft: number; onUpgrade: () => void }) {
  if (secondsLeft > 0) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="border border-white/50 bg-[#020408] p-8 max-w-md text-center"
      >
        <div className="w-16 h-16 border border-white/50 bg-white/10 flex items-center justify-center mx-auto mb-6">
          <Lock className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl text-white font-mono tracking-wider mb-2">FREE TRIAL EXPIRED</h2>
        <p className="text-sm text-white/40 font-mono mb-6">Your 60-second preview has ended. Upgrade to Runner to unlock full access.</p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onUpgrade}
            className="w-full py-3 bg-white text-black text-xs font-mono tracking-wider hover:bg-white/90 transition-colors"
          >
            UPGRADE TO RUNNER — $29/mo
          </button>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 border border-white/10 text-white/40 text-xs font-mono tracking-wider hover:border-white/20 transition-colors"
          >
            RESTART PREVIEW
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function FreeTimerBadge({ secondsLeft }: { secondsLeft: number }) {
  if (secondsLeft <= 0) return null
  const isUrgent = secondsLeft <= 15

  return (
    <motion.div
      className={`flex items-center gap-2 px-3 py-2 text-[10px] md:text-xs font-mono tracking-wider border ${
        isUrgent ? "bg-white/20 border-white/50 text-white" : "bg-white/5 border-white/10 text-white/40"
      }`}
      animate={isUrgent ? { borderColor: ["rgba(255,255,255,0.5)", "rgba(255,255,255,0.2)", "rgba(255,255,255,0.5)"] } : {}}
      transition={{ duration: 1, repeat: Infinity }}
    >
      <Clock className={`w-3 h-3 ${isUrgent ? "text-white" : "text-white/30"}`} />
      FREE: {Math.floor(secondsLeft / 60)}:{(secondsLeft % 60).toString().padStart(2, "0")}
    </motion.div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export function TerminalView() {
  const { address, isConnected } = useAccount()
  const { sendTransaction, data: txHash, isPending: isSending } = useSendTransaction()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash })

  const [latency, setLatency] = useState(12)
  const [status, setStatus] = useState("HUNTING")
  const [executedTrades, setExecutedTrades] = useState(0)
  const [totalProfit, setTotalProfit] = useState(0)
  const [showScrollHint, setShowScrollHint] = useState(true)
  const [opportunities, setOpportunities] = useState<QuantSignal[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("table")
  const [activeCategory, setActiveCategory] = useState<Category>("ALL")
  const [selectedMarket, setSelectedMarket] = useState<QuantSignal | null>(null)
  const [isLiveData, setIsLiveData] = useState(false)
  const [dataSource, setDataSource] = useState<"mock" | "live" | "loading">("loading")
  const tableContainerRef = useRef<HTMLDivElement>(null)

  // Paywall timer
  const [freeSecondsLeft, setFreeSecondsLeft] = useState(FREE_TIMER_SECONDS)
  const isPaywalled = freeSecondsLeft <= 0

  const [settings, setSettings] = useState<ExecutionSettings>({
    mevProtection: true,
    sniperMode: false,
    maxSlippage: 0.5,
    gasMultiplier: 1.2,
    privateRpc: true,
  })

  // Mock whale wallet data removed - to be populated from real on-chain data
  const [whaleWallets, setWhaleWallets] = useState<WhaleWallet[]>([])

  /**
   * Convert LatencySignal (crypto 5-min) to QuantSignal (TradeDock format)
   */
  const convertLatencySignalToQuantSignal = (signal: any, amount: number): QuantSignal => {
    const kellyFraction = amount / 1000 // Assume $1000 bankroll for now

    return {
      id: signal.tokenId,
      market: signal.slug || signal.market,
      question: signal.question || `BTC ${signal.direction} - ${signal.market}`,
      platform: "Polymarket",
      url: `https://polymarket.com/event/${signal.slug || signal.market}`,
      polyOdds: signal.direction === "UP"
        ? Math.round(signal.marketPrice * 100)
        : Math.round((1 - signal.marketPrice) * 100),
      trueProb: signal.trueProbability * 100,
      edge: signal.edge * 100,
      volume: `$${(signal.volume || 0).toLocaleString()}`,
      volumeTotal: `$${(signal.volume || 0).toLocaleString()}`,
      liquidity: signal.volume || 0,
      trend: signal.btcMove > 0 ? "up" : "down",
      risk: signal.confidence === "high" ? "low" : signal.confidence === "medium" ? "medium" : "high",
      spread: 0.02, // 2% default spread for crypto markets
      kellyFraction: kellyFraction,
      volatility: Math.abs(signal.btcMove),
      arbFlag: signal.edge > 0.08, // Flag if edge > 8%
      arbDetail: signal.edge > 0.08 ? `Latency arbitrage detected: ${(signal.edge * 100).toFixed(1)}% edge` : "",
      signalStrength: signal.confidence === "high" ? 0.9 : signal.confidence === "medium" ? 0.7 : 0.5,
    }
  }

  /**
   * Handle trade click from Crypto5MinPanel
   */
  const handleCrypto5MinTradeClick = (signal: any, amount: number) => {
    const quantSignal = convertLatencySignalToQuantSignal(signal, amount)
    setSelectedMarket(quantSignal)
  }

  // Free timer countdown
  useEffect(() => {
    if (freeSecondsLeft <= 0) return
    const timer = setInterval(() => {
      setFreeSecondsLeft((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [freeSecondsLeft])

  // Latency simulation
  useEffect(() => {
    const interval = setInterval(() => { setLatency(Math.floor(8 + Math.random() * 10)) }, 2000)
    return () => clearInterval(interval)
  }, [])

  // Scroll hint
  useEffect(() => {
    const container = tableContainerRef.current
    if (!container) return
    const handleScroll = () => { if (container.scrollLeft > 10) setShowScrollHint(false) }
    container.addEventListener("scroll", handleScroll)
    return () => container.removeEventListener("scroll", handleScroll)
  }, [])

  // Auto-fetch on mount + every 30s
  useEffect(() => {
    fetchOpportunities()
    const interval = setInterval(fetchOpportunities, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchOpportunities = useCallback(async () => {
    setIsLoading(true)
    setDataSource("loading")
    try {
      const response = await fetch(`${API_URL}/api/opportunities`)
      if (response.ok) {
        const data = await response.json()
        if (data.length > 0) {
          setOpportunities(data)
          setIsLiveData(true)
          setDataSource("live")
          console.log("✅ Live Polymarket data loaded:", data.length, "opportunities")
        } else {
          setDataSource("mock")
          console.warn("⚠️ Backend returned empty data, using mock")
        }
      } else {
        throw new Error(`API returned ${response.status}`)
      }
    } catch (error) {
      console.error("❌ Failed to fetch live data:", error)
      console.log("📦 Using mock data - Backend not available at:", API_URL)
      setIsLiveData(false)
      setDataSource("mock")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleExecute = async (marketId: string, outcome: "YES" | "NO", amount: number) => {
    if (!isConnected) throw new Error("Wallet not connected")
    if (isPaywalled) throw new Error("Upgrade required")
    const opp = opportunities.find((o) => o.id === marketId)
    if (!opp) return

    console.log(`[EXECUTION] Market: ${opp.market} | Outcome: ${outcome} | Amount: $${amount}`)

    try {
      // TODO: Replace with actual smart contract interaction
      // For now, just simulate the trade with a console.log
      const response = await fetch(`${API_URL}/api/build-tx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunityId: marketId,
          outcome,
          amount,
          settings: { mevProtection: settings.mevProtection, sniperMode: settings.sniperMode, privateRpc: settings.privateRpc, maxSlippage: settings.maxSlippage },
        }),
      })

      // If API fails, still log it for demo purposes
      if (!response.ok) {
        console.warn("[EXECUTION] API build-tx failed, but continuing for demo")
      } else {
        const txData = await response.json()
        sendTransaction({ to: txData.to as `0x${string}`, value: parseEther(txData.value || "0"), data: txData.data as `0x${string}` })
      }

      setExecutedTrades((prev) => prev + 1)
      setTotalProfit((prev) => prev + opp.edge * amount + Math.random() * 50)
      setStatus("EXECUTED")
      setTimeout(() => setStatus("HUNTING"), 2000)
    } catch (error) {
      console.error("Execution failed:", error)
      throw error
    }
  }

  const handlePanicSell = () => {
    setStatus("PANIC SELL")
    setTimeout(() => setStatus("HUNTING"), 3000)
  }

  const addWhaleWallet = (address: string, label: string) => { setWhaleWallets((prev) => [...prev, { address, label, pnl: "$0", isTracking: true }]) }
  const removeWhaleWallet = (address: string) => { setWhaleWallets((prev) => prev.filter((w) => w.address !== address)) }
  const toggleWhaleTracking = (address: string) => { setWhaleWallets((prev) => prev.map((w) => w.address === address ? { ...w, isTracking: !w.isTracking } : w)) }

  // Computed stats
  const avgEdge = useMemo(() => {
    const positiveEdge = opportunities.filter((o) => o.edge > 0)
    if (positiveEdge.length === 0) return 0
    return positiveEdge.reduce((sum, o) => sum + o.edge, 0) / positiveEdge.length
  }, [opportunities])

  const arbCount = useMemo(() => opportunities.filter((o) => o.arbFlag).length, [opportunities])

  // Categorize and filter opportunities
  const opportunitiesByCategory = useMemo(() => {
    const categorized: Record<Category, number> = {
      ALL: opportunities.length,
      POLITICS: 0,
      CRYPTO: 0,
      ECONOMY: 0,
      SPORTS: 0,
      OTHER: 0,
    }

    opportunities.forEach((opp) => {
      const category = categorizeMarket(opp.question, opp.market)
      categorized[category]++
    })

    return categorized
  }, [opportunities])

  const filteredOpportunities = useMemo(() => {
    if (activeCategory === "ALL") return opportunities

    return opportunities.filter((opp) => {
      const category = categorizeMarket(opp.question, opp.market)
      return category === activeCategory
    })
  }, [opportunities, activeCategory])

  return (
    <div className="min-h-screen pt-20 pb-16 px-3 md:px-4">
      <div className="max-w-[1600px] mx-auto">
        {/* AI Ticker Tape */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <AITickerTape signals={opportunities} isPaywalled={isPaywalled} />
        </motion.div>

        {/* Status Bar */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="border border-white/10 border-t-0 bg-[#020408] mb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between px-4 md:px-6 py-3 gap-3 md:gap-0">
            <div className="flex flex-wrap items-center gap-4 md:gap-8">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"} animate-pulse`} />
                <span className={`text-[10px] md:text-xs font-mono tracking-wider ${isConnected ? "text-green-500" : "text-red-500"}`}>{isConnected ? "CONNECTED" : "DISCONNECTED"}</span>
              </div>
              <div className="flex items-center gap-2"><Wifi className="w-3 h-3 text-white/40" /><span className="text-[10px] md:text-xs text-white/40 font-mono"><span className="text-green-500">{latency}ms</span></span></div>
              <div className="flex items-center gap-2"><Activity className="w-3 h-3 text-white/40" /><span className={`text-[10px] md:text-xs font-mono tracking-wider ${status === "HUNTING" ? "text-white" : status === "PANIC SELL" ? "text-white animate-pulse" : "text-green-500"}`}>{status}</span></div>
            </div>
            <div className="flex items-center gap-4 md:gap-6">
              <FreeTimerBadge secondsLeft={freeSecondsLeft} />
              <div className="text-right"><div className="text-[10px] md:text-xs text-white/30 font-mono">TRADES</div><div className="text-sm text-white font-mono">{executedTrades}</div></div>
              <div className="text-right"><div className="text-[10px] md:text-xs text-white/30 font-mono">P/L</div><div className={`text-sm font-mono ${totalProfit >= 0 ? "text-green-500" : "text-red-500"}`}>{totalProfit >= 0 ? "+" : ""}${totalProfit.toFixed(2)}</div></div>
            </div>
          </div>
        </motion.div>

        {/* Control Panel */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-wrap gap-2 mb-4">
          {/* ExecutionSettings toggles removed - non-functional in Phase 1, will be restored in Phase 6 */}
          <ViewModeToggle mode={viewMode} onToggle={() => setViewMode((prev) => prev === "table" ? "heatmap" : "table")} />

          {/* Data Source Indicator */}
          <div className={`flex items-center gap-2 px-3 py-2 border text-[10px] md:text-xs font-mono tracking-wider ${
            dataSource === "live"
              ? "bg-green-500/10 border-green-500/50 text-green-400"
              : dataSource === "mock"
              ? "bg-white/10 border-white/50 text-white"
              : "bg-white/5 border-white/10 text-white/40"
          }`}>
            <Radio className={`w-3 h-3 ${dataSource === "live" ? "animate-pulse" : ""}`} />
            <span className="hidden sm:inline">
              {dataSource === "live" ? "LIVE DATA" : dataSource === "mock" ? "MOCK DATA" : "LOADING..."}
            </span>
            <span className="sm:hidden">
              {dataSource === "live" ? "LIVE" : dataSource === "mock" ? "MOCK" : "..."}
            </span>
            {dataSource === "live" && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
          </div>

          <button onClick={fetchOpportunities} disabled={isLoading} className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 text-white/40 hover:border-white/20 hover:text-white/60 text-[10px] md:text-xs font-mono tracking-wider transition-all disabled:opacity-50">
            <RotateCcw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} /><span className="hidden sm:inline">REFRESH</span>
          </button>
        </motion.div>

        {/* Category Tabs */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <CategoryTabs
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            opportunitiesByCategory={opportunitiesByCategory}
          />
        </motion.div>

        {/* Crypto 5-Min Scanner - Floating badge when no signal, full panel when signal detected */}
        <Crypto5MinPanel
          onTradeClick={handleCrypto5MinTradeClick}
          userBalance={1000} // TODO: Get from wallet hook
        />

        {/* Main Grid */}
        <div className="grid lg:grid-cols-[1fr_350px] gap-4">
          {/* Main Content */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="border border-white/10 bg-[#020408]">
            {/* Table Header */}
            <div className="flex items-center justify-between px-3 md:px-4 py-3 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-white" />
                <span className="text-xs md:text-sm text-white font-mono tracking-wider">THE FEED</span>
                {arbCount > 0 && <span className="px-1.5 py-0.5 text-[10px] bg-white/20 text-white font-mono">{arbCount} ARB</span>}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3 text-white/30" />
                <span className="text-[10px] md:text-xs text-white/30 font-mono">
                  {filteredOpportunities.length} / {opportunities.length} SIGNALS
                </span>
              </div>
            </div>

            {/* Table or Heatmap */}
            {viewMode === "heatmap" ? (
              <SignalHeatmap signals={filteredOpportunities} isPaywalled={isPaywalled} />
            ) : (
              <div className="relative">
                <div ref={tableContainerRef} className="overflow-x-auto">
                  <table className={`w-full min-w-[700px] ${isPaywalled ? "blur-sm" : ""}`}>
                    <thead>
                      <tr className="border-b border-white/10 bg-white/[0.01]">
                        <th className="py-3 px-3 md:px-4 text-left text-[10px] md:text-xs text-white/30 font-mono tracking-wider">MARKET</th>
                        <th className="py-3 px-3 md:px-4 text-center text-[10px] md:text-xs text-white/30 font-mono tracking-wider">SIGNAL</th>
                        <th className="py-3 px-3 md:px-4 text-center text-[10px] md:text-xs text-white/30 font-mono tracking-wider">CONFIDENCE</th>
                        <th className="py-3 px-3 md:px-4 text-center text-[10px] md:text-xs text-white/30 font-mono tracking-wider">EDGE</th>
                        <th className="py-3 px-3 md:px-4 text-center text-[10px] md:text-xs text-white/30 font-mono tracking-wider">ODDS</th>
                        <th className="py-3 px-3 md:px-4 text-center text-[10px] md:text-xs text-white/30 font-mono tracking-wider">RISK</th>
                        <th className="py-3 px-3 md:px-4 text-right text-[10px] md:text-xs text-white/30 font-mono tracking-wider">ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOpportunities.map((opp) => (
                        <OpportunityRow key={opp.id} opp={opp} onSelect={setSelectedMarket} isPaywalled={isPaywalled} />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Scroll hint - mobile */}
                {showScrollHint && (
                  <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#020408] to-transparent pointer-events-none flex items-center justify-end pr-2 md:hidden">
                    <motion.div animate={{ x: [0, 5, 0] }} transition={{ duration: 1.5, repeat: Infinity }} className="text-white/40">
                      <ChevronRight className="w-5 h-5" />
                    </motion.div>
                  </div>
                )}
              </div>
            )}
          </motion.div>

          {/* Sidebar */}
          <div className="flex flex-col gap-4 order-last lg:order-none">
            {/* Logs */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="border border-white/10 bg-[#020408] h-[300px] lg:h-[350px] flex flex-col">
              <div className="flex items-center justify-between px-3 md:px-4 py-3 border-b border-white/10 bg-white/[0.02] shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs md:text-sm text-white font-mono tracking-wider">LOGS</span>
                </div>
                <span className="text-[10px] md:text-xs text-white/20 font-mono">LIVE</span>
              </div>
              <TerminalLogs />
            </motion.div>

            {/* Whale Radar */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
              <WhaleRadar
                wallets={whaleWallets}
                onAddWallet={addWhaleWallet}
                onRemoveWallet={removeWhaleWallet}
                onToggleTracking={toggleWhaleTracking}
                isPaywalled={isPaywalled}
              />
            </motion.div>
          </div>
        </div>

        {/* Bottom Stats */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-12">
          <div className="border border-white/10 bg-[#020408] p-3 md:p-4">
            <div className="text-[10px] md:text-xs text-white/30 font-mono mb-1">MARKETS</div>
            <div className="text-lg md:text-2xl text-white font-mono">{opportunities.length.toLocaleString()}</div>
          </div>
          <div className="border border-white/10 bg-[#020408] p-3 md:p-4">
            <div className="text-[10px] md:text-xs text-white/30 font-mono mb-1">AVG EDGE</div>
            <div className="text-lg md:text-2xl text-green-500 font-mono">+{avgEdge.toFixed(1)}%</div>
          </div>
          <div className="border border-white/10 bg-[#020408] p-3 md:p-4">
            <div className="text-[10px] md:text-xs text-white/30 font-mono mb-1">ARB SIGNALS</div>
            <div className={`text-lg md:text-2xl font-mono ${arbCount > 0 ? "text-white" : "text-white/50"}`}>{arbCount}</div>
          </div>
          <div className="border border-white/10 bg-[#020408] p-3 md:p-4">
            <div className="text-[10px] md:text-xs text-white/30 font-mono mb-1">BRIBE</div>
            <div className="text-lg md:text-2xl text-white font-mono">0.002</div>
          </div>
        </motion.div>
      </div>

      {/* Panic Dock - Fixed Footer (only show if no trade dock is open) */}
      {!selectedMarket && (
        <PanicDock isPaywalled={isPaywalled} onPanicSell={handlePanicSell} executedTrades={executedTrades} totalProfit={totalProfit} />
      )}

      {/* Trade Dock - Opens when a market is selected */}
      {selectedMarket && (
        <TradeDock
          selectedMarket={selectedMarket}
          onClose={() => setSelectedMarket(null)}
          onExecute={handleExecute}
          isPaywalled={isPaywalled}
        />
      )}

      {/* Paywall Overlay */}
      <PaywallOverlay secondsLeft={freeSecondsLeft} onUpgrade={() => { window.location.href = "/?view=pricing" }} />
    </div>
  )
}
