"use client"

import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { Search, ArrowUpRight, TrendingUp } from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface PolyMarket {
  id: string
  question: string
  image: string
  icon: string
  slug: string
  url: string
  yes_price: number
  no_price: number
  volume_24h: number
  volume_total: number
  liquidity: number
  end_date: string
  outcomes: string[]
}

type Category = "all" | "crypto" | "politics" | "sports" | "economy" | "tech"
type SortBy = "volume" | "liquidity" | "price"

const CATEGORIES: { key: Category; label: string; emoji: string }[] = [
  { key: "all", label: "All", emoji: "🌐" },
  { key: "crypto", label: "Crypto", emoji: "₿" },
  { key: "politics", label: "Politics", emoji: "🏛️" },
  { key: "sports", label: "Sports", emoji: "⚽" },
  { key: "economy", label: "Economy", emoji: "📈" },
  { key: "tech", label: "Tech", emoji: "💻" },
]

function detectCategory(question: string): Category {
  const q = question.toLowerCase()
  if (q.includes("btc") || q.includes("bitcoin") || q.includes("eth") || q.includes("ethereum") || q.includes("crypto") || q.includes("solana") || q.includes("token") || q.includes("coin") || q.includes("defi") || q.includes("blockchain")) return "crypto"
  if (q.includes("trump") || q.includes("biden") || q.includes("election") || q.includes("senate") || q.includes("congress") || q.includes("president") || q.includes("democrat") || q.includes("republican") || q.includes("vote") || q.includes("tariff") || q.includes("white house") || q.includes("russia") || q.includes("ukraine") || q.includes("china") || q.includes("nato") || q.includes("fed rate") || q.includes("geopolit")) return "politics"
  if (q.includes("nfl") || q.includes("nba") || q.includes("mlb") || q.includes("super bowl") || q.includes("champions league") || q.includes("premier league") || q.includes("soccer") || q.includes("tennis") || q.includes("f1") || q.includes("formula") || q.includes("golf") || q.includes("fifa") || q.includes("world cup") || q.includes("nhl") || q.includes("ufc") || q.includes("boxing") || q.includes("wimbledon") || q.includes("us open") || q.includes("la liga") || q.includes("serie a") || q.includes("bundesliga")) return "sports"
  if (q.includes("interest rate") || q.includes("inflation") || q.includes("gdp") || q.includes("recession") || q.includes("fed ") || q.includes("dow jones") || q.includes("s&p") || q.includes("nasdaq") || q.includes("oil price") || q.includes("gold price")) return "economy"
  if (q.includes("ai") || q.includes("openai") || q.includes("apple") || q.includes("google") || q.includes("nvidia") || q.includes("meta") || q.includes("microsoft") || q.includes("chatgpt") || q.includes("gpt") || q.includes("tesla") || q.includes("spacex") || q.includes("amazon")) return "tech"
  return "crypto"
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

export function MarketsView() {
  const [markets, setMarkets] = useState<PolyMarket[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<Category>("all")
  const [sortBy, setSortBy] = useState<SortBy>("volume")
  const [displayCount, setDisplayCount] = useState(20)

  useEffect(() => {
    const fetchFromGamma = async (): Promise<PolyMarket[]> => {
      const res = await fetch(
        "https://gamma-api.polymarket.com/markets?active=true&limit=100&order=volume24hr&ascending=false&closed=false",
        { signal: AbortSignal.timeout(10000) }
      )
      const data = await res.json()
      return (Array.isArray(data) ? data : []).map((m: any) => {
        const outcomePrices: string[] = Array.isArray(m.outcomePrices) ? m.outcomePrices : []
        const yesPrice = outcomePrices[0] ? parseFloat(outcomePrices[0]) : 0.5
        const noPrice = outcomePrices[1] ? parseFloat(outcomePrices[1]) : 0.5
        let outcomes: string[] = ["Yes", "No"]
        try { outcomes = typeof m.outcomes === "string" ? JSON.parse(m.outcomes) : (m.outcomes || ["Yes", "No"]) } catch {}
        const slug = m.slug || ""
        return {
          id: m.conditionId || m.id || "",
          question: m.question || "",
          image: m.image || "",
          icon: m.icon || "",
          slug,
          url: `https://polymarket.com/event/${slug}`,
          yes_price: yesPrice,
          no_price: noPrice,
          volume_24h: parseFloat(m.volume24hr || 0),
          volume_total: parseFloat(m.volumeNum || 0),
          liquidity: parseFloat(m.liquidityNum || 0),
          end_date: m.endDate || "",
          outcomes: outcomes.slice(0, 2),
        } as PolyMarket
      }).filter((m: PolyMarket) => m.question)
    }

    const fetchMarkets = async () => {
      // Try backend first with 5s timeout
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 5000)
        const res = await fetch(`${API_URL}/api/markets`, { signal: controller.signal })
        clearTimeout(timer)
        if (res.ok) {
          const data = await res.json()
          if (data.markets && data.markets.length > 0) {
            setMarkets(data.markets)
            setLoading(false)
            return
          }
        }
      } catch {
        // Backend timed out or unavailable — fall through to Gamma
      }

      // Gamma API fallback
      try {
        const gammaMarkets = await fetchFromGamma()
        setMarkets(gammaMarkets)
      } catch (err) {
        console.error("Failed to fetch markets from Gamma:", err)
      }
      setLoading(false)
    }

    fetchMarkets()
    const interval = setInterval(fetchMarkets, 60000)
    return () => clearInterval(interval)
  }, [])

  const filtered = markets
    .filter(m => {
      if (selectedCategory !== "all" && detectCategory(m.question) !== selectedCategory) return false
      if (searchQuery.trim()) return m.question.toLowerCase().includes(searchQuery.toLowerCase())
      return true
    })
    .sort((a, b) => {
      if (sortBy === "volume") return b.volume_24h - a.volume_24h
      if (sortBy === "liquidity") return b.liquidity - a.liquidity
      if (sortBy === "price") return b.yes_price - a.yes_price
      return 0
    })

  const visible = filtered.slice(0, displayCount)
  const hasMore = filtered.length > displayCount

  const categoryCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat.key] = cat.key === "all" ? markets.length : markets.filter(m => detectCategory(m.question) === cat.key).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="min-h-screen bg-black text-white pt-20 md:pt-24 px-4 pb-16">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-white/40" />
            <span className="text-xs text-white/40 uppercase tracking-wider">Live from Polymarket</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-2">
            All Markets
          </h1>
          <p className="text-sm text-white/40">
            {loading ? "Loading..." : `${filtered.length} active markets`}
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
              onClick={() => { setSelectedCategory(cat.key); setDisplayCount(20) }}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs whitespace-nowrap transition-colors border ${
                selectedCategory === cat.key
                  ? "bg-white text-black border-white"
                  : "bg-transparent text-white/50 border-white/10 hover:border-white/30 hover:text-white"
              }`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
              <span className="opacity-40 text-[10px]">({categoryCounts[cat.key] || 0})</span>
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white/5 border border-white/10 overflow-hidden">
                <div className="h-36 bg-white/5 animate-pulse" />
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
                <motion.a
                  key={market.id || idx}
                  href={market.url || "https://polymarket.com"}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.5) }}
                  className="bg-[#0A0A0A] border border-white/10 hover:border-white/30 transition-all group overflow-hidden block"
                >
                  {/* Market Image */}
                  <div className="relative h-36 bg-gradient-to-br from-white/5 to-black overflow-hidden">
                    {market.image ? (
                      <img
                        src={market.image}
                        alt=""
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none"
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-5xl opacity-10">
                          {CATEGORIES.find(c => c.key === detectCategory(market.question))?.emoji}
                        </span>
                      </div>
                    )}
                    {/* Volume badge */}
                    {market.volume_24h > 0 && (
                      <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm text-white/60 text-[10px] font-mono px-2 py-1 border border-white/10">
                        {formatVolume(market.volume_24h)} 24h
                      </div>
                    )}
                    {/* Category badge */}
                    <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-sm text-white/50 text-[10px] uppercase tracking-wider px-2 py-1 border border-white/10">
                      {CATEGORIES.find(c => c.key === detectCategory(market.question))?.emoji}{" "}
                      {detectCategory(market.question)}
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="p-4">
                    <p className="text-sm text-white line-clamp-2 mb-4 leading-snug group-hover:text-white/90 min-h-[2.5rem]">
                      {market.question}
                    </p>

                    {/* YES / NO prices — main Polymarket-style feature */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="flex flex-col items-center py-3 bg-[#22C55E]/10 border border-[#22C55E]/30 hover:bg-[#22C55E]/20 transition-colors">
                        <span className="text-[10px] text-[#22C55E]/60 font-mono mb-1 uppercase">
                          {market.outcomes[0] || "Yes"}
                        </span>
                        <span className="text-xl font-bold text-[#22C55E] font-mono leading-none">
                          {(market.yes_price * 100).toFixed(0)}¢
                        </span>
                      </div>
                      <div className="flex flex-col items-center py-3 bg-[#EF4444]/10 border border-[#EF4444]/30 hover:bg-[#EF4444]/20 transition-colors">
                        <span className="text-[10px] text-[#EF4444]/60 font-mono mb-1 uppercase">
                          {market.outcomes[1] || "No"}
                        </span>
                        <span className="text-xl font-bold text-[#EF4444] font-mono leading-none">
                          {(market.no_price * 100).toFixed(0)}¢
                        </span>
                      </div>
                    </div>

                    {/* Footer row */}
                    <div className="flex items-center justify-between text-[10px] text-white/25 font-mono pt-2 border-t border-white/5">
                      <span>Vol: {formatVolume(market.volume_total)}</span>
                      <div className="flex items-center gap-1 text-white/40 group-hover:text-white/70 transition-colors">
                        <span>Polymarket</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </div>
                    </div>
                  </div>
                </motion.a>
              ))}
            </div>

            {hasMore && (
              <div className="text-center mb-4">
                <button
                  onClick={() => setDisplayCount(prev => prev + 20)}
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
