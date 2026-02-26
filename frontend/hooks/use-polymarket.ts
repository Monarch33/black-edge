"use client"
import { useState, useEffect, useCallback } from 'react'

const GAMMA_API = 'https://gamma-api.polymarket.com'
const BACKEND_API = process.env.NEXT_PUBLIC_API_URL || ''

export interface PolyMarket {
  conditionId: string
  question: string
  slug: string
  image: string
  icon: string
  yesPrice: number
  noPrice: number
  outcomes: string[]
  volume: number
  volume24hr: number
  liquidity: number
  endDate: string
  category: string
  description: string
  url: string
  edge: number | null
  signalStrength: number | null
}

function parseJsonField(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return [] }
  }
  return []
}

export function categorize(question: string): string {
  const q = question.toLowerCase()
  if (q.match(/nfl|nba|nhl|mlb|wnba|ufc|mma|boxing|tennis|f1|formula|soccer|football|baseball|basketball|championship|super bowl|game|match|player|team|league|cup|premier|serie|bundesliga|ligue|epl|la liga|fight|bout|round|playoff|wimbledon|pga|masters|golf|rugby|cricket|olympics/)) return 'sports'
  if (q.match(/btc|bitcoin|eth|ethereum|crypto|solana|doge|defi|blockchain|token|coin|binance|polygon|chainlink|xrp|cardano/)) return 'crypto'
  if (q.match(/trump|biden|harris|election|president|congress|senate|democrat|republican|governor|mayor|vote|political|party|legislation|bill|executive order|white house|supreme court|nato|tariff/)) return 'politics'
  if (q.match(/fed|rate|gdp|inflation|stock|recession|unemployment|treasury|economy|economic|s&p|nasdaq|dow|interest rate|federal reserve|oil price|gold price/)) return 'economy'
  return 'other'
}

export function usePolymarkets(options?: { limit?: number; category?: string }) {
  const limit = options?.limit ?? 100
  const categoryFilter = options?.category ?? null

  const [allMarkets, setAllMarkets] = useState<PolyMarket[]>([])
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState<'backend' | 'gamma' | 'none'>('none')

  const fetchMarkets = useCallback(async () => {
    // 1. Try backend if URL is configured
    if (BACKEND_API && BACKEND_API !== 'http://localhost:8000') {
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
          if (mks.length > 0) {
            setAllMarkets(mks)
            setSource('backend')
            setLoading(false)
            return
          }
        }
      } catch { /* fall through to gamma */ }
    }

    // 2. Direct Gamma API (always works, no CORS issues)
    try {
      const res = await fetch(
        `${GAMMA_API}/markets?active=true&limit=200&order=volume24hr&ascending=false&closed=false`
      )
      if (res.ok) {
        const raw: Record<string, unknown>[] = await res.json()
        const parsed: PolyMarket[] = raw
          .filter(m => m.question && m.outcomePrices && !m.closed)
          .map(m => {
            const prices = parseJsonField(m.outcomePrices).map(Number)
            const outs = parseJsonField(m.outcomes) as string[]
            const slug = String(m.slug || '')
            // Use eventSlug for the URL (event slug, not market slug)
            const eventSlug = String(m.eventSlug || slug || '')
            return {
              conditionId: String(m.conditionId || m.id || ''),
              question: String(m.question || ''),
              slug,
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
        setAllMarkets(parsed)
        setSource('gamma')
      }
    } catch (err) {
      console.error('Gamma API failed:', err)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchMarkets()
    const interval = setInterval(fetchMarkets, 60000)
    return () => clearInterval(interval)
  }, [fetchMarkets])

  const markets = categoryFilter
    ? allMarkets.filter(m => m.category === categoryFilter).slice(0, limit)
    : allMarkets.slice(0, limit)

  return { markets, allMarkets, loading, source, refetch: fetchMarkets }
}
