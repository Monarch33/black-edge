"use client"

import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { TrendingUp, Target, Award, DollarSign, CheckCircle2, XCircle, Clock } from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface TrackRecordData {
  summary: {
    total_predictions: number
    total_resolved: number
    win_rate: number
    avg_edge_predicted: number
    avg_edge_realized: number
    total_pnl: number
  }
  by_confidence: {
    [key: string]: {
      total: number
      wins: number
      win_rate: number
    }
  }
  recent_predictions: Array<{
    id: number
    timestamp: number
    market: string
    prediction: string
    confidence: number
    edge: number
    entry_price: number
    resolved: boolean
    correct: boolean | null
    profit_loss: number | null
  }>
}

export function TrackRecordView() {
  const [trackRecord, setTrackRecord] = useState<TrackRecordData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTrackRecord = async () => {
      try {
        const res = await fetch(`${API_URL}/api/v2/track-record`)
        const data = await res.json()

        if (data.track_record) {
          setTrackRecord(data.track_record)
        }

        setLoading(false)
      } catch (err) {
        console.error("Failed to fetch track record:", err)
        setError("Failed to load track record")
        setLoading(false)
      }
    }

    fetchTrackRecord()
    const interval = setInterval(fetchTrackRecord, 60000) // Refresh every 60s
    return () => clearInterval(interval)
  }, [])

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white pt-20 md:pt-24 px-4 pb-16">
        <div className="max-w-7xl mx-auto">
          <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-12 text-center">
            <div className="text-[#555]">Loading track record...</div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !trackRecord) {
    return (
      <div className="min-h-screen bg-black text-white pt-20 md:pt-24 px-4 pb-16">
        <div className="max-w-7xl mx-auto">
          <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-12 text-center">
            <div className="text-[#EF4444]">{error || "No track record available"}</div>
          </div>
        </div>
      </div>
    )
  }

  const { summary, by_confidence, recent_predictions } = trackRecord

  return (
    <div className="min-h-screen bg-black text-white pt-20 md:pt-24 px-4 pb-16">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-semibold text-white mb-2">Track Record</h1>
          <p className="text-sm text-[#888]">
            Public performance history from paper trading system
          </p>
        </motion.div>

        {/* Summary Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          {/* Win Rate */}
          <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-6 hover:border-white/30 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <Target className="w-5 h-5 text-[#22C55E]" />
              <span className="text-xs text-[#888] uppercase tracking-wider">Win Rate</span>
            </div>
            <div className="text-3xl font-semibold text-white mb-1">
              {summary.win_rate.toFixed(1)}%
            </div>
            <div className="text-xs text-[#555]">
              {summary.total_resolved} resolved
            </div>
          </div>

          {/* Total Predictions */}
          <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-6 hover:border-white/30 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <TrendingUp className="w-5 h-5 text-[#3B82F6]" />
              <span className="text-xs text-[#888] uppercase tracking-wider">Total Predictions</span>
            </div>
            <div className="text-3xl font-semibold text-white mb-1">
              {summary.total_predictions}
            </div>
            <div className="text-xs text-[#555]">
              {summary.total_predictions - summary.total_resolved} pending
            </div>
          </div>

          {/* Edge Realized */}
          <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-6 hover:border-white/30 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <Award className="w-5 h-5 text-[#F59E0B]" />
              <span className="text-xs text-[#888] uppercase tracking-wider">Avg Edge</span>
            </div>
            <div className="text-3xl font-semibold text-white mb-1">
              {summary.avg_edge_realized > 0 ? "+" : ""}
              {summary.avg_edge_realized.toFixed(1)}%
            </div>
            <div className="text-xs text-[#555]">
              vs {summary.avg_edge_predicted.toFixed(1)}% predicted
            </div>
          </div>

          {/* Total P&L */}
          <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-6 hover:border-white/30 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <DollarSign className="w-5 h-5 text-[#8B5CF6]" />
              <span className="text-xs text-[#888] uppercase tracking-wider">Paper P&L</span>
            </div>
            <div
              className={`text-3xl font-semibold mb-1 ${
                summary.total_pnl >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
              }`}
            >
              ${summary.total_pnl.toFixed(2)}
            </div>
            <div className="text-xs text-[#555]">paper trading</div>
          </div>
        </motion.div>

        {/* Confidence Breakdown */}
        {Object.keys(by_confidence).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <h2 className="text-xl font-semibold text-white mb-4">Performance by Confidence</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {["high", "medium", "low"].map((level) => {
                const data = by_confidence[level]
                if (!data) return null

                const winRate = (data.win_rate * 100).toFixed(1)

                return (
                  <div
                    key={level}
                    className="bg-[#0A0A0A] border border-[#1A1A1A] p-6 hover:border-white/30 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-medium text-white uppercase tracking-wider">
                        {level} Confidence
                      </span>
                      <span
                        className={`text-2xl font-semibold ${
                          data.win_rate >= 0.6 ? "text-[#22C55E]" : "text-[#F59E0B]"
                        }`}
                      >
                        {winRate}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#555]">
                      <span>{data.wins} wins</span>
                      <span>{data.total - data.wins} losses</span>
                      <span>{data.total} total</span>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-4 h-2 bg-[#1A1A1A] overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          data.win_rate >= 0.6 ? "bg-[#22C55E]" : "bg-[#F59E0B]"
                        }`}
                        style={{ width: `${winRate}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* Recent Predictions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-xl font-semibold text-white mb-4">Recent Predictions</h2>
          {recent_predictions.length === 0 ? (
            <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-12 text-center">
              <div className="text-[#555]">No predictions yet</div>
            </div>
          ) : (
            <div className="bg-[#0A0A0A] border border-[#1A1A1A] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1A1A1A]">
                      <th className="text-left py-4 px-6 text-xs text-[#888] font-medium tracking-wider">
                        DATE
                      </th>
                      <th className="text-left py-4 px-6 text-xs text-[#888] font-medium tracking-wider">
                        MARKET
                      </th>
                      <th className="text-center py-4 px-6 text-xs text-[#888] font-medium tracking-wider">
                        PREDICTION
                      </th>
                      <th className="text-right py-4 px-6 text-xs text-[#888] font-medium tracking-wider hidden md:table-cell">
                        CONFIDENCE
                      </th>
                      <th className="text-right py-4 px-6 text-xs text-[#888] font-medium tracking-wider hidden lg:table-cell">
                        EDGE
                      </th>
                      <th className="text-center py-4 px-6 text-xs text-[#888] font-medium tracking-wider">
                        STATUS
                      </th>
                      <th className="text-right py-4 px-6 text-xs text-[#888] font-medium tracking-wider hidden xl:table-cell">
                        P&L
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent_predictions.map((pred, idx) => (
                      <motion.tr
                        key={pred.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        className={`border-b border-[#1A1A1A] last:border-0 hover:bg-[#0A0A0A] transition-all group ${
                          idx % 2 === 1 ? "bg-[#0A0A0A]/50" : ""
                        }`}
                      >
                        <td className="py-4 px-6 text-xs text-[#888] whitespace-nowrap">
                          <div>{formatDate(pred.timestamp)}</div>
                          <div className="text-[#555]">{formatTime(pred.timestamp)}</div>
                        </td>
                        <td className="py-4 px-6 text-sm text-white group-hover:border-l-2 group-hover:border-white transition-all">
                          <div className="line-clamp-2 max-w-md">{pred.market}</div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span
                            className={`inline-block px-3 py-1 text-xs font-medium ${
                              pred.prediction === "YES"
                                ? "bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20"
                                : "bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20"
                            }`}
                          >
                            {pred.prediction}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-sm text-right font-mono text-white hidden md:table-cell">
                          {(pred.confidence * 100).toFixed(0)}%
                        </td>
                        <td className="py-4 px-6 text-sm text-right font-mono text-[#888] hidden lg:table-cell">
                          {pred.edge > 0 ? "+" : ""}
                          {(pred.edge * 100).toFixed(1)}%
                        </td>
                        <td className="py-4 px-6 text-center">
                          {!pred.resolved ? (
                            <div className="flex items-center justify-center gap-2 text-[#F59E0B]">
                              <Clock className="w-4 h-4" />
                              <span className="text-xs">Pending</span>
                            </div>
                          ) : pred.correct ? (
                            <div className="flex items-center justify-center gap-2 text-[#22C55E]">
                              <CheckCircle2 className="w-4 h-4" />
                              <span className="text-xs">Correct</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2 text-[#EF4444]">
                              <XCircle className="w-4 h-4" />
                              <span className="text-xs">Wrong</span>
                            </div>
                          )}
                        </td>
                        <td
                          className={`py-4 px-6 text-sm text-right font-mono font-semibold hidden xl:table-cell ${
                            pred.profit_loss === null
                              ? "text-[#555]"
                              : pred.profit_loss >= 0
                              ? "text-[#22C55E]"
                              : "text-[#EF4444]"
                          }`}
                        >
                          {pred.profit_loss === null
                            ? "—"
                            : `${pred.profit_loss >= 0 ? "+" : ""}$${pred.profit_loss.toFixed(2)}`}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>

        {/* Disclaimer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 p-6 bg-[#0A0A0A] border border-[#1A1A1A]"
        >
          <p className="text-xs text-[#555] leading-relaxed">
            <span className="text-white font-medium">Note:</span> This track record represents
            paper trading results for transparency and performance validation. All predictions are
            logged in real-time before market outcomes are known. Past performance does not
            guarantee future results. Polymarket trading involves substantial risk of loss.
          </p>
        </motion.div>
      </div>
    </div>
  )
}
