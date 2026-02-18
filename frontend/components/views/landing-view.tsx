"use client"

import { useState, useEffect } from 'react'
import { BarChart3, Newspaper, Crosshair, TrendingUp, Shield, Zap, ArrowRight, Radio } from 'lucide-react'

// ============================================================
// POLYMARKET GAMMA API — FETCH DIRECT, PAS DE BACKEND
// ============================================================

const GAMMA_API = 'https://gamma-api.polymarket.com'

interface PMEvent {
  id: string
  title: string
  slug: string
  image: string
  volume: number
  liquidity: number
  yesPrice: number
  noPrice: number
  firstQuestion: string
}

function parseJsonStr(raw: any): any[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return [] }
  }
  return []
}

async function fetchEvents(limit = 20): Promise<PMEvent[]> {
  // Fetch directement depuis Polymarket — PAS de backend
  const res = await fetch(
    `${GAMMA_API}/events?active=true&limit=${limit}&order=volume24hr&ascending=false&closed=false`,
    { cache: 'no-store' }
  )
  if (!res.ok) return []
  const data = await res.json()

  return data
    .filter((e: any) => e.title && e.markets && e.markets.length > 0)
    .map((e: any) => {
      const m = e.markets[0]
      const prices = parseJsonStr(m?.outcomePrices || '[]').map(Number)
      return {
        id: e.id || '',
        title: e.title || '',
        slug: e.slug || '',
        image: e.image || e.icon || '',
        volume: parseFloat(e.volume || '0'),
        liquidity: parseFloat(e.liquidity || '0'),
        yesPrice: prices[0] || 0,
        noPrice: prices[1] || 0,
        firstQuestion: m?.question || e.title || '',
      }
    })
}

function formatVol(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
  return `${v.toFixed(0)}`
}

function likelihood(yesPrice: number): { label: string; color: string } {
  const pct = yesPrice * 100
  if (pct >= 85) return { label: 'VERY LIKELY', color: 'text-[#22C55E]' }
  if (pct >= 65) return { label: 'LIKELY', color: 'text-[#22C55E]/80' }
  if (pct >= 45) return { label: 'TOSS-UP', color: 'text-[#888]' }
  if (pct >= 25) return { label: 'UNLIKELY', color: 'text-[#EF4444]/80' }
  return { label: 'VERY UNLIKELY', color: 'text-[#EF4444]' }
}

// ============================================================
// COMPONENTS
// ============================================================

function EventCard({ event }: { event: PMEvent }) {
  const yesPct = Math.round(event.yesPrice * 100)
  const noPct = Math.round(event.noPrice * 100)
  const total = yesPct + noPct
  const barWidth = total > 0 ? (yesPct / total) * 100 : 50
  const lk = likelihood(event.yesPrice)

  return (
    <a
      href={`https://polymarket.com/event/${event.slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-[#0A0A0A] border border-[#1A1A1A] p-4 hover:border-[#333] transition-all duration-200 group"
    >
      <div className="flex items-start gap-3 mb-3">
        {event.image && (
          <img
            src={event.image}
            alt=""
            className="w-10 h-10 rounded object-cover flex-shrink-0 bg-[#1A1A1A]"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white leading-tight line-clamp-2 group-hover:text-white/80">
            {event.title}
          </p>
          <div className={`mt-1 text-[10px] font-mono tracking-wider ${lk.color}`}>
            {lk.label} • {yesPct}%
          </div>
        </div>
      </div>

      <div className="mb-2">
        <div className="flex justify-between text-xs font-mono mb-1">
          <span className="text-[#22C55E]">YES {yesPct}¢</span>
          <span className="text-[#EF4444]">NO {noPct}¢</span>
        </div>
        <div className="w-full h-1.5 bg-[#EF4444]/15 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#22C55E] rounded-full transition-all duration-700"
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 text-[10px] font-mono text-[#555]">
        <span>{formatVol(event.volume)} vol</span>
        <span>{formatVol(event.liquidity)} liq</span>
      </div>
    </a>
  )
}

function Skeleton() {
  return (
    <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-4 animate-pulse">
      <div className="flex gap-3 mb-3">
        <div className="w-10 h-10 rounded bg-[#1A1A1A]" />
        <div className="flex-1">
          <div className="h-4 bg-[#1A1A1A] rounded w-3/4 mb-2" />
          <div className="h-3 bg-[#1A1A1A] rounded w-1/3" />
        </div>
      </div>
      <div className="h-1.5 bg-[#1A1A1A] rounded-full mb-2" />
      <div className="h-3 bg-[#1A1A1A] rounded w-1/2" />
    </div>
  )
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-[#0A0A0A] border border-[#1A1A1A] px-6 py-4 text-center">
      <div className="text-2xl font-mono text-white">{value}</div>
      <div className="text-[10px] text-[#555] tracking-[0.2em] mt-1">{label}</div>
    </div>
  )
}

const COUNCIL_AGENTS = [
  { icon: BarChart3, name: 'FUNDAMENTALS', desc: 'Orderbook depth, volume flow, liquidity analysis' },
  { icon: Newspaper, name: 'SENTIMENT', desc: 'News feeds, social media, public opinion tracking' },
  { icon: Crosshair, name: 'SNIPER', desc: 'Price microstructure, momentum, mean reversion' },
  { icon: TrendingUp, name: 'NARRATIVE', desc: 'Viral potential, trending topics, upcoming catalysts' },
  { icon: Shield, name: 'DOOMER', desc: 'Risk detection. Finds reasons to NOT trade. Veto power.' },
]

// ============================================================
// MAIN LANDING VIEW
// ============================================================

export function LandingView({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const [events, setEvents] = useState<PMEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEvents(20)
      .then((data) => { setEvents(data); setLoading(false) })
      .catch(() => setLoading(false))

    const interval = setInterval(() => {
      fetchEvents(20).then(setEvents).catch(() => {})
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-black text-white">

      {/* ── HERO ── */}
      <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse at 20% 50%, rgba(255,255,255,0.03) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(255,255,255,0.02) 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, rgba(255,255,255,0.015) 0%, transparent 50%)',
          }} />
        </div>

        <div className="relative z-10 text-center max-w-3xl px-6">
          {events.length > 0 && (
            <div className="inline-flex items-center gap-2 mb-8 px-3 py-1.5 border border-[#1A1A1A] bg-[#0A0A0A]/80 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
              <span className="text-xs font-mono text-[#888]">
                LIVE • Analyzing {events.length} markets
              </span>
            </div>
          )}

          <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-[1.1] mb-6">
            The edge is in<br />the data.
          </h1>
          <p className="text-lg text-[#888] max-w-xl mx-auto mb-10">
            Quantitative prediction intelligence for Polymarket.
            Multi-agent AI analysis. Real-time data. Public track record.
          </p>
          <a
            href="#markets"
            className="inline-block bg-white text-black px-8 py-3.5 text-sm font-medium tracking-wider hover:bg-white/90 transition-colors"
          >
            EXPLORE MARKETS
          </a>
        </div>
      </section>

      {/* ── LIVE MARKETS ── */}
      <section id="markets" className="px-4 md:px-8 py-16 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-semibold mb-1">Live Markets</h2>
            <p className="text-sm text-[#555]">Real-time data from Polymarket. Updated every 60s.</p>
          </div>
          {events.length > 0 && (
            <span className="text-xs font-mono text-[#555]">
              {events.length} events • Source: Polymarket
            </span>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} />)}
          </div>
        ) : events.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.slice(0, 9).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Radio className="w-8 h-8 text-[#333] mx-auto mb-3" />
            <p className="text-[#555] text-sm">Connecting to Polymarket...</p>
            <p className="text-[#333] text-xs mt-1">If this persists, Polymarket API may be temporarily unavailable.</p>
          </div>
        )}
      </section>

      {/* ── STATS ── */}
      {events.length > 0 && (
        <section className="px-4 md:px-8 py-12 max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard value={events.length.toString()} label="MARKETS TRACKED" />
            <StatCard value={formatVol(events.reduce((s, e) => s + e.volume, 0))} label="TOTAL VOLUME" />
            <StatCard value="5" label="AI AGENTS" />
            <StatCard value={formatVol(events.reduce((s, e) => s + e.liquidity, 0))} label="TOTAL LIQUIDITY" />
          </div>
        </section>
      )}

      {/* ── HOW IT WORKS ── */}
      <section className="px-4 md:px-8 py-20 max-w-5xl mx-auto">
        <h2 className="text-2xl font-semibold mb-12 text-center">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: '01', icon: Radio, title: 'Collect', desc: 'Real-time data from Polymarket CLOB, news feeds, and orderbook depth. 30-second refresh cycle.' },
            { step: '02', icon: Zap, title: 'Analyze', desc: '5 AI agents debate every market independently. The Doomer agent vetoes bad trades. Consensus required.' },
            { step: '03', icon: ArrowRight, title: 'Deliver', desc: 'Signals with edge %, confidence level, and Kelly-criterion sizing. Every prediction logged publicly.' },
          ].map((item) => (
            <div key={item.step} className="bg-[#0A0A0A] border border-[#1A1A1A] p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-mono text-[#333]">{item.step}</span>
                <item.icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-medium mb-2">{item.title}</h3>
              <p className="text-sm text-[#888] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── THE COUNCIL ── */}
      <section className="px-4 md:px-8 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-semibold mb-3">The Council</h2>
          <p className="text-[#888] max-w-lg mx-auto text-sm">
            Every signal passes through 5 independent agents. They don&apos;t agree with each other. That&apos;s the point.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {COUNCIL_AGENTS.map((agent) => (
            <div
              key={agent.name}
              className={`bg-[#0A0A0A] border p-4 text-center ${
                agent.name === 'DOOMER' ? 'border-[#2A2A2A]' : 'border-[#1A1A1A]'
              }`}
            >
              <agent.icon className="w-6 h-6 text-white mx-auto mb-3" />
              <div className="text-xs font-mono tracking-wider mb-2">{agent.name}</div>
              <p className="text-[10px] text-[#555] leading-relaxed">{agent.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-4 md:px-8 py-20 text-center">
        <h2 className="text-2xl font-semibold mb-3">Public track record coming soon.</h2>
        <p className="text-[#888] text-sm mb-8 max-w-md mx-auto">
          Every prediction logged before the outcome. Every result published. No cherry-picking.
        </p>
        <a
          href="#markets"
          className="inline-block bg-white text-black px-8 py-3.5 text-sm font-medium tracking-wider hover:bg-white/90 transition-colors"
        >
          EXPLORE MARKETS
        </a>
        <p className="text-[#333] text-xs mt-4">Not financial advice.</p>
      </section>

    </div>
  )
}
