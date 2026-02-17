"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useState, useMemo, useEffect } from "react"
import { X, TrendingUp, Zap, AlertTriangle, CheckCircle, Loader2 } from "lucide-react"
import { useTrade } from "@/hooks/use-trade"
import { useToast } from "@/hooks/use-toast"
import { ToastContainer } from "@/components/ui/toast"

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

interface TradeDockProps {
  selectedMarket: QuantSignal | null
  onClose: () => void
  onExecute: (marketId: string, outcome: "YES" | "NO", amount: number) => Promise<void>
  isPaywalled: boolean
}

// =============================================================================
// Component
// =============================================================================

export function TradeDock({ selectedMarket, onClose, onExecute, isPaywalled }: TradeDockProps) {
  const [outcome, setOutcome] = useState<"YES" | "NO">("YES")
  const [amount, setAmount] = useState<string>("")
  const { toasts, closeToast, success, error: showError } = useToast()
  const {
    executeTrade,
    simulateTrade,
    status,
    error,
    userBalance,
    isCheckingBalance,
    isInsufficientBalance,
    isApproving,
    isTrading,
    isSuccess,
    isError,
  } = useTrade()

  // Calculate estimated return based on current odds and amount
  const estimatedReturn = useMemo(() => {
    if (!selectedMarket || !amount || isNaN(parseFloat(amount))) return 0

    const amountNum = parseFloat(amount)
    const odds = outcome === "YES" ? selectedMarket.polyOdds / 100 : (100 - selectedMarket.polyOdds) / 100

    // Simple return calculation: if you bet $X at Y% odds, you get $X/Y if you win
    // So profit = (amountNum / odds) - amountNum
    const payout = amountNum / odds
    return payout
  }, [selectedMarket, amount, outcome])

  const estimatedProfit = useMemo(() => {
    if (!amount || isNaN(parseFloat(amount))) return 0
    return estimatedReturn - parseFloat(amount)
  }, [estimatedReturn, amount])

  const handleExecute = async () => {
    if (!selectedMarket || !amount || isNaN(parseFloat(amount))) return

    try {
      // 🔥 REAL TRADING ACTIVATED 🔥
      // This will execute real blockchain transactions with real USDC
      await executeTrade(selectedMarket.id, outcome, parseFloat(amount))

      // Also call the parent onExecute for state updates
      await onExecute(selectedMarket.id, outcome, parseFloat(amount))
    } catch (error) {
      console.error("Trade execution failed:", error)
    }
  }

  // Toast notifications based on status
  useEffect(() => {
    if (isSuccess && selectedMarket) {
      success(
        "✅ Trade Executed!",
        `${outcome} position on ${selectedMarket.market}. View in Portfolio.`
      )
    }
  }, [isSuccess, outcome, selectedMarket, success])

  useEffect(() => {
    if (isError && error) {
      showError("❌ Transaction Failed", error)
    }
  }, [isError, error, showError])

  useEffect(() => {
    if (isInsufficientBalance && error) {
      showError("⚠️ Insufficient Balance", error)
    }
  }, [isInsufficientBalance, error, showError])

  // Auto-close on success after 2 seconds
  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        setAmount("")
        onClose()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isSuccess, onClose])

  if (!selectedMarket) return null

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/20 bg-[#020408]/98 backdrop-blur-md shadow-2xl"
        >
        <div className="max-w-[1600px] mx-auto px-4 py-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-red-500" />
                <h3 className="text-sm text-white/80 font-mono tracking-wider">EXECUTION DOCK</h3>
                {selectedMarket.arbFlag && (
                  <span className="px-2 py-0.5 text-[10px] bg-yellow-500/20 text-yellow-500 font-mono border border-yellow-500/30">
                    ARB DETECTED
                  </span>
                )}
              </div>
              <p className="text-xs text-white/50 font-mono max-w-2xl truncate">
                {selectedMarket.question}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white/80 transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Trading Interface */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-4">
            {/* Left: Inputs */}
            <div className="space-y-3">
              {/* Outcome Toggle */}
              <div>
                <label className="block text-[10px] text-white/30 font-mono mb-2 tracking-wider">
                  OUTCOME
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setOutcome("YES")}
                    className={`flex-1 py-3 px-4 text-xs font-mono tracking-wider transition-all border ${
                      outcome === "YES"
                        ? "bg-green-500/20 border-green-500/50 text-green-400"
                        : "bg-white/5 border-white/10 text-white/40 hover:border-white/20"
                    }`}
                  >
                    <div className="text-sm mb-1">YES</div>
                    <div className="text-[10px] text-white/40">
                      {selectedMarket.polyOdds}% odds
                    </div>
                  </button>
                  <button
                    onClick={() => setOutcome("NO")}
                    className={`flex-1 py-3 px-4 text-xs font-mono tracking-wider transition-all border ${
                      outcome === "NO"
                        ? "bg-red-500/20 border-red-500/50 text-red-400"
                        : "bg-white/5 border-white/10 text-white/40 hover:border-white/20"
                    }`}
                  >
                    <div className="text-sm mb-1">NO</div>
                    <div className="text-[10px] text-white/40">
                      {100 - selectedMarket.polyOdds}% odds
                    </div>
                  </button>
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[10px] text-white/30 font-mono tracking-wider">
                    AMOUNT (USDC)
                  </label>
                  <span className="text-[10px] text-white/40 font-mono">
                    Balance: ${userBalance.toFixed(2)} USDC on Polygon
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className={`w-full bg-white/5 border px-4 py-3 text-lg font-mono text-white placeholder:text-white/20 focus:outline-none transition-colors ${
                      isInsufficientBalance
                        ? "border-red-500/50 focus:border-red-500"
                        : "border-white/10 focus:border-cyan-500/50"
                    }`}
                    disabled={isPaywalled}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/30 font-mono">
                    USDC
                  </div>
                </div>
                {/* Insufficient balance warning */}
                {isInsufficientBalance && (
                  <div className="mt-2 flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/20">
                    <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-red-400 font-mono">
                      Insufficient balance. You need ${parseFloat(amount || "0").toFixed(2)} but only have $
                      {userBalance.toFixed(2)}
                    </p>
                  </div>
                )}
                {/* Quick amount buttons */}
                <div className="flex gap-2 mt-2">
                  {[10, 50, 100, 500].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setAmount(preset.toString())}
                      className="px-3 py-1.5 text-[10px] bg-white/5 border border-white/10 text-white/40 hover:border-white/20 hover:text-white/60 font-mono transition-colors"
                      disabled={isPaywalled}
                    >
                      ${preset}
                    </button>
                  ))}
                  {userBalance > 0 && (
                    <button
                      onClick={() => setAmount(Math.floor(userBalance * 0.9).toString())}
                      className="px-3 py-1.5 text-[10px] bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 font-mono transition-colors"
                      disabled={isPaywalled}
                      title="Use 90% of balance"
                    >
                      MAX
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Simulation & Stats */}
            <div className="border border-white/10 bg-white/[0.02] p-4 space-y-3">
              <div>
                <div className="text-[10px] text-white/30 font-mono mb-1 tracking-wider">
                  ESTIMATED RETURN
                </div>
                <div className="text-2xl text-green-400 font-mono">
                  ${estimatedReturn.toFixed(2)}
                </div>
                <div className="text-xs text-white/40 font-mono mt-1">
                  Profit: <span className={estimatedProfit >= 0 ? "text-green-400" : "text-red-400"}>
                    {estimatedProfit >= 0 ? "+" : ""}${estimatedProfit.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="border-t border-white/5 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/30 font-mono">KELLY FRACTION</span>
                  <span className="text-xs text-white/60 font-mono">
                    {(selectedMarket.kellyFraction * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/30 font-mono">EDGE</span>
                  <span className={`text-xs font-mono ${selectedMarket.edge > 0 ? "text-green-400" : "text-red-400"}`}>
                    {selectedMarket.edge > 0 ? "+" : ""}{selectedMarket.edge}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/30 font-mono">RISK LEVEL</span>
                  <span className={`text-xs font-mono ${
                    selectedMarket.risk === "low" ? "text-green-400" :
                    selectedMarket.risk === "medium" ? "text-yellow-400" :
                    "text-red-400"
                  }`}>
                    {selectedMarket.risk.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/30 font-mono">VOLUME (24H)</span>
                  <span className="text-xs text-white/60 font-mono">
                    {selectedMarket.volume}
                  </span>
                </div>
              </div>

              {/* Risk Warning */}
              {selectedMarket.risk === "high" && (
                <div className="flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/20">
                  <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-red-400 font-mono">
                    HIGH RISK: This market has elevated volatility or low liquidity
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Execute Button */}
          <div className="mt-4">
            <button
              onClick={handleExecute}
              disabled={
                isCheckingBalance ||
                isInsufficientBalance ||
                isApproving ||
                isTrading ||
                isPaywalled ||
                !amount ||
                parseFloat(amount) <= 0
              }
              className={`w-full py-4 text-sm font-mono tracking-widest transition-all flex items-center justify-center gap-3 ${
                isPaywalled
                  ? "bg-white/5 text-white/20 border border-white/5 cursor-not-allowed"
                  : isInsufficientBalance
                  ? "bg-red-500/20 text-red-500 border border-red-500/50 cursor-not-allowed"
                  : isSuccess
                  ? "bg-green-500/20 text-green-500 border border-green-500/50"
                  : isError
                  ? "bg-red-500/20 text-red-500 border border-red-500/50"
                  : isCheckingBalance
                  ? "bg-cyan-500/20 text-cyan-500 border border-cyan-500/50 animate-pulse"
                  : isApproving
                  ? "bg-blue-500/20 text-blue-500 border border-blue-500/50 animate-pulse"
                  : isTrading
                  ? "bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 animate-pulse"
                  : !amount || parseFloat(amount) <= 0
                  ? "bg-white/5 text-white/20 border border-white/10 cursor-not-allowed"
                  : "bg-gradient-to-r from-red-500/20 to-purple-500/20 border border-red-500/50 text-red-400 hover:border-red-500 hover:bg-red-500/30 shadow-lg shadow-red-500/10"
              }`}
            >
              {isPaywalled ? (
                <>
                  <Zap className="w-5 h-5" />
                  LOCKED - UPGRADE REQUIRED
                </>
              ) : isInsufficientBalance ? (
                <>
                  <AlertTriangle className="w-5 h-5" />
                  ⚠️ INSUFFICIENT BALANCE
                </>
              ) : isSuccess ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  SUCCESS! 🚀
                </>
              ) : isError ? (
                <>
                  <AlertTriangle className="w-5 h-5" />
                  FAILED
                </>
              ) : isCheckingBalance ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  CHECKING BALANCE...
                </>
              ) : isApproving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  APPROVE WALLET...
                </>
              ) : isTrading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  EXECUTING TRADE...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  ⚡ EXECUTE TRADE
                </>
              )}
            </button>
            {(isError || isInsufficientBalance) && error && (
              <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-red-400 font-mono whitespace-pre-line">{error}</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onClose={closeToast} />
    </>
  )
}
