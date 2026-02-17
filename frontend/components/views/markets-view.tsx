"use client"

import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { Search } from "lucide-react"

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
}

type Category = "all" | "crypto" | "politics" | "sports" | "economy" | "tech"

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "all", label: "All" },
  { key: "crypto", label: "Crypto" },
  { key: "politics", label: "Politics" },
  { key: "sports", label: "Sports" },
  { key: "economy", label: "Economy" },
  { key: "tech", label: "Tech" },
]

export function MarketsView() {
  const [markets, setMarkets] = useState<Market[]>([])
  const [filteredMarkets, setFilteredMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<Category>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [displayCount, setDisplayCount] = useState(20)

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

  // Apply filters
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

    setFilteredMarkets(filtered)
    setDisplayCount(20) // Reset display count when filters change
  }, [markets, selectedCategory, searchQuery])

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

  const visibleMarkets = filteredMarkets.slice(0, displayCount)
  const hasMore = filteredMarkets.length > displayCount

  return (
    <div className="min-h-screen bg-black text-white pt-20 md:pt-24 px-4 pb-16">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-semibold text-white mb-2">Markets</h1>
              <p className="text-sm text-[#888]">
                {loading ? "Loading..." : `${filteredMarkets.length} markets available`}
              </p>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
              <input
                type="text"
                placeholder="Search markets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-[#0A0A0A] border border-[#1A1A1A] text-white placeholder:text-[#555] focus:outline-none focus:border-white/30 transition-colors text-sm w-64"
              />
            </div>
          </div>

          {/* Category Pills */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={`px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat.key
                    ? "bg-[#1A1A1A] text-white border border-[#2A2A2A]"
                    : "bg-transparent text-[#888] border border-[#1A1A1A] hover:border-[#2A2A2A] hover:text-white"
                }`}
              >
                {cat.label}
                {cat.key !== "all" && (
                  <span className="ml-2 text-[10px] text-[#555]">
                    ({markets.filter((m) => m.category === cat.key).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Markets Table */}
        {loading ? (
          <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-12 text-center">
            <div className="text-[#555]">Loading markets...</div>
          </div>
        ) : filteredMarkets.length === 0 ? (
          <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-12 text-center">
            <div className="text-[#555]">
              {searchQuery ? "No markets match your search" : "No markets in this category"}
            </div>
          </div>
        ) : (
          <>
            <div className="bg-[#0A0A0A] border border-[#1A1A1A] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1A1A1A]">
                    <th className="text-left py-4 px-6 text-xs text-[#888] font-medium tracking-wider">
                      MARKET
                    </th>
                    <th className="text-left py-4 px-6 text-xs text-[#888] font-medium tracking-wider hidden md:table-cell">
                      CATEGORY
                    </th>
                    <th className="text-right py-4 px-6 text-xs text-[#888] font-medium tracking-wider">
                      PRICE
                    </th>
                    <th className="text-right py-4 px-6 text-xs text-[#888] font-medium tracking-wider">
                      EDGE
                    </th>
                    <th className="text-right py-4 px-6 text-xs text-[#888] font-medium tracking-wider hidden lg:table-cell">
                      SIGNAL
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMarkets.map((market, idx) => (
                    <motion.tr
                      key={market.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.02 }}
                      className={`border-b border-[#1A1A1A] last:border-0 hover:bg-[#0A0A0A] transition-all group cursor-pointer ${
                        idx % 2 === 1 ? "bg-[#0A0A0A]/50" : ""
                      }`}
                    >
                      <td className="py-4 px-6 text-sm text-white group-hover:border-l-2 group-hover:border-white transition-all">
                        <div className="line-clamp-2">{market.question}</div>
                      </td>
                      <td className="py-4 px-6 text-xs text-[#888] uppercase hidden md:table-cell">
                        {market.category}
                      </td>
                      <td className="py-4 px-6 text-sm text-right font-mono text-white">
                        {market.polyOdds}¢
                      </td>
                      <td
                        className={`py-4 px-6 text-sm text-right font-mono font-bold ${
                          market.edge > 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                        }`}
                      >
                        {market.edge > 0 ? "+" : ""}
                        {market.edge.toFixed(1)}%
                      </td>
                      <td className="py-4 px-6 text-sm text-right hidden lg:table-cell">
                        <span className="inline-flex items-center gap-2">
                          <span className="text-white">{getSignalDot(market.signalStrength)}</span>
                          <span className="text-[#888]">{getSignalLabel(market.signalStrength)}</span>
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => setDisplayCount((prev) => prev + 20)}
                  className="px-6 py-3 bg-[#0A0A0A] border border-[#1A1A1A] text-white hover:bg-[#1A1A1A] hover:border-white/30 transition-colors text-sm"
                >
                  Load More ({filteredMarkets.length - displayCount} remaining)
                </button>
              </div>
            )}

            {/* Footer info */}
            <div className="mt-6 text-center text-xs text-[#555]">
              Showing {visibleMarkets.length} of {filteredMarkets.length} markets
            </div>
          </>
        )}
      </div>
    </div>
  )
}
