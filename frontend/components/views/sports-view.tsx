"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useState, useEffect } from "react"
import { TrendingUp, TrendingDown, Clock, Flame, Zap } from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// Sport configuration
const SPORT_CONFIG = {
  all: { name: "All", color: "cyan" },
  nfl: { name: "NFL", color: "red" },
  nba: { name: "NBA", color: "orange" },
  ufc: { name: "UFC", color: "red" },
  soccer: { name: "Soccer", color: "green" },
  mlb: { name: "MLB", color: "blue" },
}

interface SportsMatch {
  id: string
  sport: string
  matchup: string
  question: string
  yesPrice: number
  noPrice: number
  edge: number
  volume: string
  prediction: "YES" | "NO"
  confidence: number
  trending: boolean
  url: string
}

export function SportsView() {
  const [selected, setSelected] = useState("all")
  const [matches, setMatches] = useState<SportsMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_URL}/api/v2/signals`)
        const data = await res.json()

        const SPORT_KEYWORDS = [
          "NFL", "NBA", "UFC", "MLB", "SOCCER", "SUPER BOWL", "CHAMPIONSHIP", "PLAYOFF",
          "LAKERS", "WARRIORS", "CELTICS", "BULLS", "HEAT", "KNICKS",
          "MANCHESTER", "ARSENAL", "CHELSEA", "TOTTENHAM", "LIVERPOOL",
          "REAL MADRID", "BARCELONA", "PSG", "PREMIER LEAGUE", "LA LIGA",
          "CHAMPIONS LEAGUE", "EUROPA", "SERIE A", "BUNDESLIGA", "MLS",
          "TENNIS", "WIMBLEDON", "US OPEN", "FRENCH OPEN",
          "F1", "FORMULA", "NASCAR", "RUGBY", "CRICKET", "GOLF", "PGA", "MASTERS"
        ]

        const sports = data.signals
          .filter((s: any) => {
            const m = s.market.toUpperCase()
            const q = s.question.toUpperCase()
            return SPORT_KEYWORDS.some(kw => m.includes(kw) || q.includes(kw))
          })
          .map((s: any) => {
            const m = s.market.toUpperCase()
            const q = s.question.toUpperCase()
            let sport = "soccer"
            let emoji = ""

            if (m.includes("NFL") || m.includes("SUPER BOWL")) {
              sport = "nfl"
            } else if (m.includes("NBA") || m.includes("LAKERS") || m.includes("WARRIORS") || m.includes("CELTICS") || m.includes("BULLS") || m.includes("HEAT") || m.includes("KNICKS")) {
              sport = "nba"
            } else if (m.includes("UFC") || m.includes("FIGHT")) {
              sport = "ufc"
            } else if (m.includes("MLB") || m.includes("BASEBALL")) {
              sport = "mlb"
            } else if (m.includes("SOCCER") || m.includes("PREMIER") || m.includes("MANCHESTER") || m.includes("ARSENAL") || m.includes("CHELSEA") || m.includes("TOTTENHAM") || m.includes("LIVERPOOL") || m.includes("REAL MADRID") || m.includes("BARCELONA") || m.includes("PSG") || m.includes("LA LIGA") || m.includes("CHAMPIONS LEAGUE") || m.includes("EUROPA") || m.includes("SERIE A") || m.includes("BUNDESLIGA") || m.includes("MLS") || q.includes("PREMIER LEAGUE") || q.includes("CHAMPIONS LEAGUE")) {
              sport = "soccer"
            }

            // Extract matchup (simplified)
            const matchup = s.market
              .replace(/Will|win|Win|WIN|the|The|2025|2026|2024/gi, "")
              .substring(0, 60)
              .trim()

            return {
              id: s.market,
              sport,
              emoji,
              matchup,
              question: s.market,
              yesPrice: s.polyOdds / 100,
              noPrice: (100 - s.polyOdds) / 100,
              edge: parseFloat(s.edge),
              volume: s.volume,
              prediction: s.prediction,
              confidence: s.trueProb,
              trending: parseFloat(s.edge) > 8,
              url: s.url || ''
            }
          })

        setMatches(sports)
        setLoading(false)
      } catch (err) {
        console.error(err)
        setLoading(false)
      }
    }

    fetchData()
    if (autoRefresh) {
      const interval = setInterval(fetchData, 15000) // 15s
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const filtered = selected === "all"
    ? matches
    : matches.filter(m => m.sport === selected)

  const trending = matches.filter(m => m.trending).length
  const avgEdge = matches.length > 0 ? matches.reduce((sum, m) => sum + m.edge, 0) / matches.length : 0
  const totalVolume = matches.reduce((sum, m) => {
    const vol = parseFloat(m.volume.replace(/[^0-9.]/g, ''))
    return sum + (isNaN(vol) ? 0 : vol)
  }, 0)

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
                Sports Betting Signals
              </h1>
              <p className="text-sm text-white/50">
                AI-powered predictions with real-time edge analysis
              </p>
            </div>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 px-4 py-2 border text-xs font-mono transition-all ${
                autoRefresh
                  ? "bg-white/10 border-white/30 text-white"
                  : "bg-white/5 border-white/20 text-white/40"
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? "bg-white animate-pulse" : "bg-white/40"}`} />
              {autoRefresh ? "LIVE" : "PAUSED"}
            </button>
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white/5 border border-white/10 p-4">
              <div className="text-xs text-white/40 font-mono mb-1">ACTIVE MARKETS</div>
              <div className="text-2xl font-bold text-white font-mono">{matches.length}</div>
            </div>
            <div className="bg-white/5 border border-white/10 p-4">
              <div className="text-xs text-white/40 font-mono mb-1">AVG EDGE</div>
              <div className="text-2xl font-bold text-white font-mono">+{avgEdge.toFixed(1)}%</div>
            </div>
            <div className="bg-white/5 border border-white/10 p-4">
              <div className="text-xs text-white/40 font-mono mb-1">HIGH EDGE</div>
              <div className="text-2xl font-bold text-white font-mono">{trending}</div>
            </div>
            <div className="bg-white/5 border border-white/10 p-4">
              <div className="text-xs text-white/40 font-mono mb-1">TOTAL VOLUME</div>
              <div className="text-2xl font-bold text-white font-mono">${(totalVolume / 1000000).toFixed(1)}M</div>
            </div>
          </div>
        </motion.div>

        {/* Professional Filters */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex gap-2 mb-6 overflow-x-auto pb-2"
        >
          {Object.entries(SPORT_CONFIG).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setSelected(key)}
              className={`flex items-center gap-2 px-4 py-2 font-mono text-xs transition-all whitespace-nowrap ${
                selected === key
                  ? "bg-white/10 border border-white/30 text-white"
                  : "bg-white/5 border border-white/10 text-white/50 hover:border-white/30"
              }`}
            >
              <span className="font-semibold">{config.name.toUpperCase()}</span>
              {key !== "all" && (
                <span className="text-[10px] bg-white/10 px-1.5 py-0.5">
                  {matches.filter(m => m.sport === key).length}
                </span>
              )}
            </button>
          ))}
        </motion.div>

        {/* Matches Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 border border-white/10 bg-white/5">
            <p className="text-sm text-white/40">No active markets</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {filtered.map((match, idx) => (
                <motion.div
                  key={match.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ delay: idx * 0.03 }}
                  className="relative"
                >
                  {/* High Edge Badge */}
                  {match.trending && (
                    <div className="absolute top-3 right-3 z-10 bg-white px-2 py-1">
                      <span className="text-black text-[10px] font-mono font-bold">
                        HIGH EDGE
                      </span>
                    </div>
                  )}

                  {/* Card */}
                  <div className="bg-white/5 border border-white/10 p-5 hover:border-white/30 transition-all">
                    {/* Sport Badge */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] text-white/40 font-mono uppercase tracking-wider">
                        {match.sport}
                      </span>
                      {match.edge > 5 && (
                        <div className="bg-white/10 border border-white/30 px-2 py-1">
                          <span className="text-white text-[10px] font-mono font-bold">
                            +{match.edge.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Matchup */}
                    <h3 className="text-white text-sm font-semibold mb-4 line-clamp-2">
                      {match.matchup}
                    </h3>

                    {/* Yes/No Prices */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div
                        className={`border p-3 transition-all ${
                          match.prediction === "YES"
                            ? "border-[#22C55E] bg-[#22C55E]/10"
                            : "border-white/20 bg-white/5"
                        }`}
                      >
                        <div className="text-[10px] text-white/40 font-mono mb-1">YES</div>
                        <div className="text-xl font-bold text-white font-mono">
                          {(match.yesPrice * 100).toFixed(0)}¢
                        </div>
                        {match.prediction === "YES" && (
                          <div className="text-[9px] text-[#22C55E] font-mono mt-1">RECOMMENDED</div>
                        )}
                      </div>

                      <div
                        className={`border p-3 transition-all ${
                          match.prediction === "NO"
                            ? "border-[#EF4444] bg-[#EF4444]/10"
                            : "border-white/20 bg-white/5"
                        }`}
                      >
                        <div className="text-[10px] text-white/40 font-mono mb-1">NO</div>
                        <div className="text-xl font-bold text-white font-mono">
                          {(match.noPrice * 100).toFixed(0)}¢
                        </div>
                        {match.prediction === "NO" && (
                          <div className="text-[9px] text-[#EF4444] font-mono mt-1">RECOMMENDED</div>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-between text-[10px] text-white/40 font-mono mb-4 pb-4 border-b border-white/10">
                      <span>VOL: {match.volume}</span>
                      <span>CONF: {(match.confidence * 100).toFixed(0)}%</span>
                    </div>

                    {/* CTA */}
                    <a
                      href={match.url || 'https://polymarket.com'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`w-full py-3 font-mono text-xs tracking-wider transition-all text-center block ${match.prediction === "YES" ? "bg-[#22C55E] hover:bg-[#22C55E]/90 text-black" : "bg-[#EF4444] hover:bg-[#EF4444]/90 text-black"}`}
                    >
                      TRADE {match.prediction} ON POLYMARKET
                    </a>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* High Edge Section */}
        {matches.filter(m => m.trending).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 bg-white/5 border border-white/20 p-6"
          >
            <h2 className="text-sm font-mono text-white mb-4 tracking-wider">
              HIGH EDGE OPPORTUNITIES ({matches.filter(m => m.trending).length})
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              {matches.filter(m => m.trending).slice(0, 3).map(m => (
                <div key={m.id} className="bg-black/40 border border-white/10 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-white/40 font-mono uppercase">{m.sport}</span>
                    <span className="text-xs font-mono text-white font-bold">
                      +{m.edge.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-white text-xs mb-3 line-clamp-2">{m.matchup}</p>
                  <div className="flex items-center justify-between text-[10px] text-white/40 font-mono">
                    <span>{m.volume}</span>
                    <span>{(m.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
