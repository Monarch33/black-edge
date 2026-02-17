"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Search } from "lucide-react"
import { usePolymarkets, categorize } from "@/hooks/use-polymarket"
import { MarketCard } from "@/components/market-card"

type Category = "all" | "crypto" | "politics" | "sports" | "economy" | "other"
type SortBy = "volume" | "liquidity" | "price"

const CATEGORIES: { key: Category; label: string; emoji: string }[] = [
  { key: "all",      label: "All",      emoji: "🌐" },
  { key: "crypto",   label: "Crypto",   emoji: "₿" },
  { key: "politics", label: "Politics", emoji: "🏛️" },
  { key: "sports",   label: "Sports",   emoji: "⚽" },
  { key: "economy",  label: "Economy",  emoji: "📈" },
  { key: "other",    label: "Other",    emoji: "🔮" },
]

export function MarketsView() {
  const { markets: allMarkets, loading } = usePolymarkets({ limit: 200 })
  const [searchQuery, setSearchQuery]       = useState("")
  const [selectedCategory, setSelectedCategory] = useState<Category>("all")
  const [sortBy, setSortBy]                 = useState<SortBy>("volume")
  const [displayCount, setDisplayCount]     = useState(24)

  const filtered = allMarkets
    .filter(m => {
      if (selectedCategory !== "all" && categorize(m.question) !== selectedCategory) return false
      if (searchQuery.trim()) return m.question.toLowerCase().includes(searchQuery.toLowerCase())
      return true
    })
    .sort((a, b) => {
      if (sortBy === "volume")    return b.volume24hr - a.volume24hr
      if (sortBy === "liquidity") return b.liquidity  - a.liquidity
      if (sortBy === "price")     return b.yesPrice   - a.yesPrice
      return 0
    })

  const visible = filtered.slice(0, displayCount)
  const hasMore = filtered.length > displayCount

  const countFor = (key: string) =>
    key === "all" ? allMarkets.length : allMarkets.filter(m => categorize(m.question) === key).length

  return (
    <div className="min-h-screen bg-black text-white pt-20 md:pt-24 px-4 pb-16">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-2">All Markets</h1>
          <p className="text-sm text-white/40">
            {loading ? "Loading..." : `${filtered.length} active markets`} • Live from Polymarket
          </p>
        </div>

        {/* Search + Sort */}
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Search markets..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors text-sm"
            />
          </div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortBy)}
            className="px-4 py-3 bg-white/5 border border-white/10 text-white focus:outline-none text-xs tracking-wider appearance-none cursor-pointer"
          >
            <option value="volume">SORT: VOLUME 24H</option>
            <option value="liquidity">SORT: LIQUIDITY</option>
            <option value="price">SORT: YES PRICE</option>
          </select>
        </div>

        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => { setSelectedCategory(cat.key); setDisplayCount(24) }}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs whitespace-nowrap transition-colors border ${
                selectedCategory === cat.key
                  ? "bg-white text-black border-white"
                  : "bg-transparent text-white/50 border-white/10 hover:border-white/30 hover:text-white"
              }`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
              <span className="opacity-40 text-[10px]">({countFor(cat.key)})</span>
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white/5 border border-white/10 overflow-hidden">
                <div className="h-32 bg-white/5 animate-pulse" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-white/10 rounded animate-pulse" />
                  <div className="h-4 bg-white/10 rounded w-3/4 animate-pulse" />
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <div className="h-14 bg-white/10 rounded animate-pulse" />
                    <div className="h-14 bg-white/10 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-white/10 p-16 text-center text-white/30 text-sm">
            No markets found
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {visible.map((market, idx) => (
                <motion.div
                  key={market.conditionId || idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.4) }}
                >
                  <MarketCard market={market} />
                </motion.div>
              ))}
            </div>

            {hasMore && (
              <div className="text-center mb-4">
                <button
                  onClick={() => setDisplayCount(prev => prev + 24)}
                  className="px-8 py-3 bg-white/5 border border-white/10 text-white hover:bg-white hover:text-black transition-all text-sm"
                >
                  Load more{" "}
                  <span className="text-white/40 text-xs">({filtered.length - displayCount} remaining)</span>
                </button>
              </div>
            )}

            <div className="text-center text-xs text-white/20 mt-2">
              Showing {visible.length} of {filtered.length} markets • Updated live from Polymarket
            </div>
          </>
        )}
      </div>
    </div>
  )
}
