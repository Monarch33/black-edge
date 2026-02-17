"use client"

import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { Search, TrendingUp, Activity, Filter, ArrowUpRight, Eye, Zap } from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface Market {
  id: string
  market: string
  question: string
  edge: number
  signalStrength: number
  prediction: string
  polyOdds: number
  platform: string
  category?: string
  volume?: number
  trueProb?: number
  url?: string
}

type Category = "all" | "crypto" | "politics" | "sports" | "economy" | "tech"
type SortBy = "edge" | "volume" | "signal"

const CATEGORIES: { key: Category; label: string; emoji: string }[] = [
  { key: "all", label: "All Markets", emoji: "🌐" },
  { key: "crypto", label: "Crypto", emoji: "₿" },
  { key: "politics", label: "Politics", emoji: "🏛️" },
  { key: "sports", label: "Sports", emoji: "⚽" },
  { key: "economy", label: "Economy", emoji: "📈" },
  { key: "tech", label: "Tech", emoji: "💻" },
]

export function MarketsView() {
  const [markets, setMarkets] = useState<Market[]>([])
  const [filteredMarkets, setFilteredMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<Category>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [displayCount, setDisplayCount] = useState(20)
  const [sortBy, setSortBy] = useState<SortBy>("edge")
  const [showFilters, setShowFilters] = useState(false)

  // Fetch markets
  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        const res = await fetch(`${API_URL}/api/v2/signals`)
        const data = await res.json()

        if (data.signals) {
          const marketsData = data.signals.map((s: any) => ({
            id: s.id,
            market: s.market,
            question: s.question,
            edge: s.edge,
            signalStrength: s.signalStrength,
            prediction: s.prediction,
            polyOdds: s.polyOdds,
            platform: s.platform,
            category: detectCategory(s.question),
            volume: s.volume || 0,
            trueProb: s.trueProb || 0,
            url: s.url || '',
          }))
          setMarkets(marketsData)
          setFilteredMarkets(marketsData)
        }

        setLoading(false)
      } catch (err) {
        console.error("Failed to fetch markets:", err)
        setLoading(false)
      }
    }

    fetchMarkets()
    const interval = setInterval(fetchMarkets, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  // Detect category from question text
  const detectCategory = (question: string): string => {
    const q = question.toLowerCase()
    if (
      q.includes("btc") ||
      q.includes("bitcoin") ||
      q.includes("eth") ||
      q.includes("ethereum") ||
      q.includes("crypto")
    )
      return "crypto"
    if (
      q.includes("trump") ||
      q.includes("biden") ||
      q.includes("election") ||
      q.includes("senate") ||
      q.includes("congress") ||
      q.includes("president")
    )
      return "politics"
    if (
      q.includes("nfl") ||
      q.includes("nba") ||
      q.includes("mlb") ||
      q.includes("super bowl") ||
      q.includes("sport")
    )
      return "sports"
    if (
      q.includes("fed") ||
      q.includes("interest rate") ||
      q.includes("inflation") ||
      q.includes("gdp") ||
      q.includes("economy")
    )
      return "economy"
    if (
      q.includes("ai") ||
      q.includes("tech") ||
      q.includes("apple") ||
      q.includes("google") ||
      q.includes("nvidia")
    )
      return "tech"
    return "other"
  }

  // Apply filters and sorting
  useEffect(() => {
    let filtered = markets

    // Category filter
    if (selectedCategory !== "all") {
      filtered = filtered.filter((m) => m.category === selectedCategory)
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((m) => m.question.toLowerCase().includes(query))
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === "edge") return Math.abs(b.edge) - Math.abs(a.edge)
      if (sortBy === "volume") return (b.volume || 0) - (a.volume || 0)
      if (sortBy === "signal") return b.signalStrength - a.signalStrength
      return 0
    })

    setFilteredMarkets(filtered)
    setDisplayCount(20) // Reset display count when filters change
  }, [markets, selectedCategory, searchQuery, sortBy])

  const getSignalLabel = (strength: number): string => {
    if (strength >= 70) return "Strong"
    if (strength >= 50) return "Medium"
    return "Weak"
  }

  const getSignalColor = (strength: number): string => {
    if (strength >= 70) return "text-[#22C55E]"
    if (strength >= 50) return "text-[#F59E0B]"
    return "text-[#888]"
  }

  const visibleMarkets = filteredMarkets.slice(0, displayCount)
  const hasMore = filteredMarkets.length > displayCount

  // Calculate stats
  const highEdgeCount = markets.filter((m) => Math.abs(m.edge) > 5).length
  const avgEdge = markets.length > 0
    ? markets.reduce((sum, m) => sum + Math.abs(m.edge), 0) / markets.length
    : 0

  return (
    <div className="min-h-screen bg-black text-white pt-20 md:pt-24 px-4 pb-16">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-5 h-5 text-[#22C55E]" />
                <span className="text-xs text-[#888] uppercase tracking-wider">
                  Live Markets
                </span>
              </div>
              <h1 className="text-3xl md:text-5xl font-bold text-white mb-3">
                All Signals
              </h1>
              <p className="text-sm text-[#888]">
                {loading ? "Loading..." : `${filteredMarkets.length} active opportunities`}
              </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0A0A0A] border border-[#1A1A1A] px-6 py-4">
                <div className="text-xs text-[#888] uppercase tracking-wider mb-1">
                  High Edge
                </div>
                <div className="text-2xl font-bold text-[#22C55E] font-mono">
                  {highEdgeCount}
                </div>
              </div>
              <div className="bg-[#0A0A0A] border border-[#1A1A1A] px-6 py-4">
                <div className="text-xs text-[#888] uppercase tracking-wider mb-1">
                  Avg Edge
                </div>
                <div className="text-2xl font-bold text-white font-mono">
                  {avgEdge.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="flex flex-col md:flex-row gap-3 mb-6">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
              <input
                type="text"
                placeholder="Search markets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-[#0A0A0A] border border-[#1A1A1A] text-white placeholder:text-[#555] focus:outline-none focus:border-white/30 transition-colors text-sm"
              />
            </div>

            {/* Sort Dropdown */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-3 text-xs tracking-wider transition-colors ${
                  showFilters
                    ? "bg-white text-black"
                    : "bg-[#0A0A0A] border border-[#1A1A1A] text-[#888] hover:border-white/30 hover:text-white"
                }`}
              >
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">FILTERS</span>
              </button>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="px-4 py-3 bg-[#0A0A0A] border border-[#1A1A1A] text-white focus:outline-none focus:border-white/30 transition-colors text-xs tracking-wider appearance-none cursor-pointer"
              >
                <option value="edge">SORT: EDGE ↓</option>
                <option value="signal">SORT: SIGNAL ↓</option>
                <option value="volume">SORT: VOLUME ↓</option>
              </select>
            </div>
          </div>

          {/* Category Pills */}
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex gap-2 overflow-x-auto pb-2 mb-4"
            >
              {CATEGORIES.map((cat) => {
                const count = markets.filter((m) => m.category === cat.key || cat.key === "all").length
                return (
                  <button
                    key={cat.key}
                    onClick={() => setSelectedCategory(cat.key)}
                    className={`flex items-center gap-2 px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                      selectedCategory === cat.key
                        ? "bg-white text-black"
                        : "bg-[#0A0A0A] text-[#888] border border-[#1A1A1A] hover:border-white/30 hover:text-white"
                    }`}
                  >
                    <span>{cat.emoji}</span>
                    <span>{cat.label}</span>
                    <span className="text-[10px] opacity-50">
                      ({cat.key === "all" ? markets.length : count})
                    </span>
                  </button>
                )
              })}
            </motion.div>
          )}
        </motion.div>

        {/* Markets Grid */}
        {loading ? (
          <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-16 text-center">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
            <div className="text-[#555]">Loading markets...</div>
          </div>
        ) : filteredMarkets.length === 0 ? (
          <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-16 text-center">
            <div className="text-[#555]">
              {searchQuery ? "No markets match your search" : "No markets in this category"}
            </div>
          </div>
        ) : (
          <>
            {/* Grid View */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {visibleMarkets.map((market, idx) => (
                <motion.div
                  key={market.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="bg-[#0A0A0A] border border-[#1A1A1A] hover:border-white/30 transition-all group cursor-pointer overflow-hidden"
                >
                  {/* Header */}
                  <div className="p-5 border-b border-[#1A1A1A]">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {market.category && (
                          <span className="text-[10px] text-[#888] uppercase tracking-wider">
                            {CATEGORIES.find(c => c.key === market.category)?.emoji} {market.category}
                          </span>
                        )}
                      </div>
                      <div className={`text-xs font-mono font-bold ${
                        market.edge > 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                      }`}>
                        {market.edge > 0 ? "+" : ""}{market.edge.toFixed(1)}%
                      </div>
                    </div>
                    <h3 className="text-sm text-white line-clamp-2 group-hover:text-white transition-colors mb-3">
                      {market.question}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium ${
                        market.prediction === "YES"
                          ? "bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20"
                          : "bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20"
                      }`}>
                        {market.prediction}
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="p-5 grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-[10px] text-[#555] uppercase tracking-wider mb-1">
                        Price
                      </div>
                      <div className="text-sm font-mono text-white">
                        {market.polyOdds}¢
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#555] uppercase tracking-wider mb-1">
                        Signal
                      </div>
                      <div className={`text-sm font-mono ${getSignalColor(market.signalStrength)}`}>
                        {getSignalLabel(market.signalStrength)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#555] uppercase tracking-wider mb-1">
                        Edge
                      </div>
                      <div className="text-sm font-mono text-white">
                        {Math.abs(market.edge).toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="p-5 pt-0">
                    <a
                      href={market.url || `https://polymarket.com`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 py-2 bg-white/5 border border-white/10 text-white hover:bg-white hover:text-black transition-all text-xs"
                    >
                      View on Polymarket
                      <ArrowUpRight className="w-3 h-3" />
                    </a>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="text-center">
                <button
                  onClick={() => setDisplayCount((prev) => prev + 20)}
                  className="px-8 py-3 bg-[#0A0A0A] border border-[#1A1A1A] text-white hover:bg-white hover:text-black transition-all text-sm flex items-center gap-2 mx-auto"
                >
                  Load More
                  <span className="text-xs text-[#555]">
                    ({filteredMarkets.length - displayCount} remaining)
                  </span>
                </button>
              </div>
            )}

            {/* Footer info */}
            <div className="mt-6 text-center text-xs text-[#555]">
              Showing {visibleMarkets.length} of {filteredMarkets.length} markets •
              Updated every 30 seconds
            </div>
          </>
        )}
      </div>
    </div>
  )
}
