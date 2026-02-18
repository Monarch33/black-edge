"use client"

import { useState, useEffect, useCallback } from "react"
import { Search } from "lucide-react"
import { MarketCard, type CouncilDecision } from "@/components/market-card"
import type { PolyMarket } from "@/hooks/use-polymarket"

// ============================================================
// FETCH DIRECT GAMMA API — PAS DE BACKEND
// ============================================================

const GAMMA_API = 'https://gamma-api.polymarket.com'
const BACKEND_API = process.env.NEXT_PUBLIC_API_URL || ''

function parseJsonField(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return [] }
  }
  return []
}

function categorize(question: string): string {
  const q = question.toLowerCase()
  if (q.match(/nfl|nba|nhl|mlb|wnba|ufc|mma|boxing|tennis|f1|formula|soccer|football|baseball|basketball|championship|super bowl|game|match|player|team|league|cup|premier|serie|bundesliga|ligue|epl|la liga|fight|bout|round|playoff|wimbledon|pga|masters|golf|rugby|cricket|olympics/)) return 'sports'
  if (q.match(/btc|bitcoin|eth|ethereum|crypto|solana|doge|defi|blockchain|token|coin|binance|polygon|chainlink|xrp|cardano/)) return 'crypto'
  if (q.match(/trump|biden|harris|election|president|congress|senate|democrat|republican|governor|mayor|vote|political|party|legislation|bill|executive order|white house|supreme court|nato|tariff/)) return 'politics'
  if (q.match(/fed|rate|gdp|inflation|stock|recession|unemployment|treasury|economy|economic|s&p|nasdaq|dow|interest rate|federal reserve|oil price|gold price/)) return 'economy'
  return 'other'
}

async function fetchMarkets(): Promise<PolyMarket[]> {
  // 1. Try backend (Railway) first — fast if online
  if (BACKEND_API && !BACKEND_API.includes('localhost')) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 4000)
      const res = await fetch(`${BACKEND_API}/api/markets`, { signal: controller.signal })
      clearTimeout(timer)
      if (res.ok) {
        const data = await res.json()
        const mks: PolyMarket[] = (data.markets || []).map((m: Record<string, unknown>) => ({
          conditionId: String(m.id || ''),
          question: String(m.question || ''),
          slug: String(m.slug || ''),
          image: String(m.image || ''),
          icon: String(m.icon || ''),
          yesPrice: Number(m.yes_price ?? 0.5),
          noPrice: Number(m.no_price ?? 0.5),
          outcomes: (m.outcomes as string[]) || ['Yes', 'No'],
          volume: Number(m.volume_total ?? 0),
          volume24hr: Number(m.volume_24h ?? 0),
          liquidity: Number(m.liquidity ?? 0),
          endDate: String(m.end_date || ''),
          category: categorize(String(m.question || '')),
          description: '',
          url: String(m.url || ''),
          edge: null,
          signalStrength: null,
        }))
        if (mks.length > 0) return mks
      }
    } catch { /* fall through to Gamma */ }
  }

  // 2. Direct Gamma API — always works
  const res = await fetch(
    `${GAMMA_API}/markets?active=true&limit=200&order=volume24hr&ascending=false&closed=false`
  )
  if (!res.ok) return []
  const raw: Record<string, unknown>[] = await res.json()
  return raw
    .filter(m => m.question && m.outcomePrices && !m.closed)
    .map(m => {
      const prices = parseJsonField(m.outcomePrices).map(Number)
      const outs = parseJsonField(m.outcomes) as string[]
      const eventSlug = String(m.eventSlug || m.slug || '')
      return {
        conditionId: String(m.conditionId || m.id || ''),
        question: String(m.question || ''),
        slug: String(m.slug || ''),
        image: String(m.image || m.icon || ''),
        icon: String(m.icon || m.image || ''),
        yesPrice: prices[0] ?? 0.5,
        noPrice: prices[1] ?? 0.5,
        outcomes: outs.length > 0 ? outs : ['Yes', 'No'],
        volume: parseFloat(String(m.volume || '0')),
        volume24hr: parseFloat(String(m.volume24hr || '0')),
        liquidity: parseFloat(String(m.liquidity || '0')),
        endDate: String(m.endDate || ''),
        category: categorize(String(m.question || '')),
        description: String(m.description || ''),
        url: eventSlug ? `https://polymarket.com/event/${eventSlug}` : '',
        edge: null,
        signalStrength: null,
      }
    })
}

// ============================================================
// TYPES + CONSTANTS
// ============================================================

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

// ============================================================
// COMPONENT
// ============================================================

export function MarketsView() {
  const [allMarkets, setAllMarkets]             = useState<PolyMarket[]>([])
  const [loading, setLoading]                   = useState(true)
  const [searchQuery, setSearchQuery]           = useState("")
  const [selectedCategory, setSelectedCategory] = useState<Category>("all")
  const [sortBy, setSortBy]                     = useState<SortBy>("volume")
  const [displayCount, setDisplayCount]         = useState(24)
  const [councilMap, setCouncilMap]             = useState<Record<string, CouncilDecision>>({})

  // Fetch markets
  const load = useCallback(async () => {
    try {
      const mks = await fetchMarkets()
      setAllMarkets(mks)
    } catch (err) {
      console.error('fetchMarkets failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [load])

  // Fetch Council decisions
  useEffect(() => {
    if (!BACKEND_API || BACKEND_API.includes('localhost')) return
    const fetchCouncil = async () => {
      try {
        const res = await fetch(`${BACKEND_API}/api/v2/council`)
        if (!res.ok) return
        const data = await res.json()
        const map: Record<string, CouncilDecision> = {}
        for (const d of (data.decisions || [])) map[d.market_id] = d
        setCouncilMap(map)
      } catch { /* backend offline — skip */ }
    }
    fetchCouncil()
    const interval = setInterval(fetchCouncil, 60_000)
    return () => clearInterval(interval)
  }, [])

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
    key === "all"
      ? allMarkets.length
      : allMarkets.filter(m => categorize(m.question) === key).length

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
                <MarketCard
                  key={market.conditionId || idx}
                  market={market}
                  councilDecision={councilMap[market.conditionId]}
                />
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
