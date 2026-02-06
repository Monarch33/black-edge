"use client"

import { motion } from "framer-motion"
import { TrendingUp, TrendingDown, Wallet, BarChart3, ExternalLink, RefreshCw, AlertCircle } from "lucide-react"
import { useAccount } from "wagmi"
import { usePortfolio } from "@/hooks/use-portfolio"

// =============================================================================
// Component
// =============================================================================

export function PortfolioView() {
  const { address, isConnected } = useAccount()
  const { positions, stats, isLoading, error, refetch } = usePortfolio()

  const handleRefresh = () => {
    refetch()
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen pt-20 px-4">
        <div className="max-w-[1600px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-white/10 bg-[#020408] p-12 text-center"
          >
            <Wallet className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <h2 className="text-xl text-white font-mono tracking-wider mb-2">
              WALLET NOT CONNECTED
            </h2>
            <p className="text-sm text-white/40 font-mono">
              Connect your wallet to view your portfolio
            </p>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-20 pb-16 px-3 md:px-4">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-red-500" />
              <h1 className="text-2xl text-white font-mono tracking-wider">PORTFOLIO</h1>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white/40 hover:border-white/20 hover:text-white/60 text-xs font-mono tracking-wider transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              REFRESH
            </button>
          </div>
          <p className="text-sm text-white/40 font-mono">
            Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
          </p>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
        >
          <div className="border border-white/10 bg-[#020408] p-4">
            <div className="text-xs text-white/30 font-mono mb-2">TOTAL VALUE</div>
            <div className="text-2xl text-white font-mono">${stats.totalValue.toFixed(2)}</div>
          </div>
          <div className="border border-white/10 bg-[#020408] p-4">
            <div className="text-xs text-white/30 font-mono mb-2">TOTAL P/L</div>
            <div className={`text-2xl font-mono ${stats.totalPnL >= 0 ? "text-green-500" : "text-red-500"}`}>
              {stats.totalPnL >= 0 ? "+" : ""}${stats.totalPnL.toFixed(2)}
            </div>
          </div>
          <div className="border border-white/10 bg-[#020408] p-4">
            <div className="text-xs text-white/30 font-mono mb-2">P/L %</div>
            <div className={`text-2xl font-mono ${stats.totalPnLPercent >= 0 ? "text-green-500" : "text-red-500"}`}>
              {stats.totalPnLPercent >= 0 ? "+" : ""}{stats.totalPnLPercent.toFixed(2)}%
            </div>
          </div>
        </motion.div>

        {/* Positions Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="border border-white/10 bg-[#020408]"
        >
          {/* Table Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-red-500" />
              <span className="text-sm text-white font-mono tracking-wider">ACTIVE POSITIONS</span>
            </div>
            <span className="text-xs text-white/30 font-mono">{positions.length} MARKETS</span>
          </div>

          {/* Table */}
          {positions.length === 0 ? (
            <div className="p-12 text-center">
              <BarChart3 className="w-12 h-12 text-white/10 mx-auto mb-3" />
              <p className="text-sm text-white/30 font-mono">No active positions</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.01]">
                    <th className="py-3 px-4 text-left text-xs text-white/30 font-mono tracking-wider">
                      MARKET
                    </th>
                    <th className="py-3 px-4 text-center text-xs text-white/30 font-mono tracking-wider">
                      POSITION
                    </th>
                    <th className="py-3 px-4 text-center text-xs text-white/30 font-mono tracking-wider">
                      SHARES
                    </th>
                    <th className="py-3 px-4 text-center text-xs text-white/30 font-mono tracking-wider">
                      AVG PRICE
                    </th>
                    <th className="py-3 px-4 text-center text-xs text-white/30 font-mono tracking-wider">
                      CURRENT
                    </th>
                    <th className="py-3 px-4 text-center text-xs text-white/30 font-mono tracking-wider">
                      VALUE
                    </th>
                    <th className="py-3 px-4 text-center text-xs text-white/30 font-mono tracking-wider">
                      P/L
                    </th>
                    <th className="py-3 px-4 text-right text-xs text-white/30 font-mono tracking-wider">
                      LINK
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((position) => (
                    <motion.tr
                      key={position.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group"
                    >
                      <td className="py-3 px-4">
                        <div className="text-white/80 text-xs font-mono whitespace-nowrap">
                          {position.market}
                        </div>
                        <div className="text-[10px] text-white/30 font-mono mt-0.5">
                          {position.question}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-1 text-[10px] font-mono border ${
                            position.outcome === "YES"
                              ? "text-green-400 bg-green-500/10 border-green-500/30"
                              : "text-red-400 bg-red-500/10 border-red-500/30"
                          }`}
                        >
                          {position.outcome}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-white/60 text-xs font-mono">{position.shares}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-white/60 text-xs font-mono">
                          ${position.avgPrice.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-white/60 text-xs font-mono">
                          ${position.currentPrice.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-white font-mono text-sm">
                          ${position.value.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {position.pnl >= 0 ? (
                            <TrendingUp className="w-3 h-3 text-green-500" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-red-500" />
                          )}
                          <span
                            className={`text-xs font-mono ${
                              position.pnl >= 0 ? "text-green-500" : "text-red-500"
                            }`}
                          >
                            {position.pnl >= 0 ? "+" : ""}${position.pnl.toFixed(2)}
                          </span>
                        </div>
                        <div
                          className={`text-[10px] font-mono mt-0.5 ${
                            position.pnlPercent >= 0 ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          ({position.pnlPercent >= 0 ? "+" : ""}
                          {position.pnlPercent.toFixed(2)}%)
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <a
                          href={position.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white/20 hover:text-white/50 transition-colors inline-block"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* Error Box */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6 border border-red-500/20 bg-red-500/5 p-4"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-400 font-mono">
                <strong>ERROR:</strong> {error}
              </p>
            </div>
          </motion.div>
        )}

        {/* Info Box */}
        {!error && positions.length === 0 && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6 border border-blue-500/20 bg-blue-500/5 p-4"
          >
            <p className="text-xs text-blue-400 font-mono">
              📊 <strong>LIVE DATA:</strong> Portfolio is fetching real positions from The Graph (Polymarket subgraph on Polygon). If you have no positions, try making a trade first.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  )
}
