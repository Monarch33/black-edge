"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useState, useEffect } from "react"
import { TrendingUp, TrendingDown, ArrowUpRight } from "lucide-react"

const GAMMA_URL = "https://gamma-api.polymarket.com/markets?active=true&limit=300&order=volume24hr&ascending=false&closed=false"

const SPORT_CONFIG: Record<string, { name: string }> = {
  all:     { name: "All" },
  soccer:  { name: "Soccer" },
  nba:     { name: "NBA" },
  nfl:     { name: "NFL" },
  ufc:     { name: "UFC / Boxing" },
  tennis:  { name: "Tennis" },
  other:   { name: "Other" },
}

const SOCCER_KEYWORDS = ["PREMIER LEAGUE","CHAMPIONS LEAGUE","LA LIGA","SERIE A","BUNDESLIGA","LIGUE 1","EUROPA LEAGUE","MLS","WORLD CUP","FIFA","ARSENAL","CHELSEA","LIVERPOOL","MANCHESTER","TOTTENHAM","REAL MADRID","BARCELONA","ATLETICO","JUVENTUS","PSG","INTER MILAN","AC MILAN","NAPOLI","AJAX","PORTO","BENFICA","CELTIC","RANGERS","DORTMUND","BAYERN","LEVERKUSEN","SOCCER","FOOTBALL MATCH","WIN THE","UEFA","CONMEBOL","COPA"]
const NBA_KEYWORDS = ["NBA","LAKERS","WARRIORS","CELTICS","BULLS","HEAT","KNICKS","BUCKS","NETS","SUNS","CLIPPERS","SIXERS","RAPTORS","NUGGETS","MAVS","MAVERICKS","SPURS","ROCKETS","PELICANS","GRIZZLIES","THUNDER","JAZZ","PACERS","HAWKS","CAVALIERS","PISTONS","MAGIC","WIZARDS","HORNETS","KINGS","BLAZERS","TIMBERWOLVES"]
const NFL_KEYWORDS = ["NFL","SUPER BOWL","TOUCHDOWN","QUARTERBACK","AFC","NFC","CHIEFS","EAGLES","PATRIOTS","COWBOYS","PACKERS","RAVENS","49ERS","RAMS","BENGALS","BILLS","CHARGERS","BRONCOS","SEAHAWKS","RAIDERS","STEELERS","BEARS","GIANTS","JETS","DOLPHINS","SAINTS","PANTHERS","FALCONS","BUCCANEERS","LIONS","VIKINGS","CARDINALS","JAGUARS","TITANS","TEXANS","COLTS","BROWNS"]
const UFC_KEYWORDS = ["UFC","MMA","BOXING","FIGHT NIGHT","TITLE FIGHT","KO","KNOCKOUT","TKO","SUBMISSION","CONOR","MCGREGOR","CANELO","FURY","USYK","POIRIER","ADESANYA","JONES","NGANNOU","MIOCIC","CORMIER","ROMERO","WHITTAKER","STRICKLAND","COSTA","VOLK","HOLLOWAY","ALDO","ORTEGA"]
const TENNIS_KEYWORDS = ["TENNIS","WIMBLEDON","US OPEN","FRENCH OPEN","AUSTRALIAN OPEN","ROLAND GARROS","ATP","WTA","DJOKOVIC","ALCARAZ","SINNER","MEDVEDEV","FEDERER","NADAL","SERENA","SWIATEK","SABALENKA","RYBAKINA","GAUFF","KVITOVA","HALEP","SLAM","GRAND SLAM"]
const ALL_SPORTS = [...SOCCER_KEYWORDS,...NBA_KEYWORDS,...NFL_KEYWORDS,...UFC_KEYWORDS,...TENNIS_KEYWORDS,"F1","FORMULA ONE","NASCAR","GOLF","PGA","MASTERS","RYDER CUP","MLB","BASEBALL","HOCKEY","NHL","RUGBY","CRICKET","IPL","ESPORTS","OLYMPICS","COMMONWEALTH","MARATHON","TOUR DE FRANCE","SNOOKER","DARTS","CYCLING","SWIMMING","ATHLETICS","MATCH","TOURNAMENT","CHAMPIONSHIP","PLAYOFF","CUP FINAL","LEAGUE","SEMIFINAL","FINAL"]

function detectSport(q: string): string {
  const u = q.toUpperCase()
  if (SOCCER_KEYWORDS.some(k => u.includes(k))) return "soccer"
  if (NBA_KEYWORDS.some(k => u.includes(k))) return "nba"
  if (NFL_KEYWORDS.some(k => u.includes(k))) return "nfl"
  if (UFC_KEYWORDS.some(k => u.includes(k))) return "ufc"
  if (TENNIS_KEYWORDS.some(k => u.includes(k))) return "tennis"
  return "other"
}

function isSports(q: string): boolean {
  const u = q.toUpperCase()
  return ALL_SPORTS.some(k => u.includes(k))
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

interface SportMarket {
  id: string
  sport: string
  question: string
  image: string
  slug: string
  url: string
  yesPrice: number
  noPrice: number
  volume24h: number
  volumeTotal: number
  outcomes: string[]
}

export function SportsView() {
  const [selected, setSelected] = useState("all")
  const [markets, setMarkets] = useState<SportMarket[]>([])
  const [loading, setLoading] = useState(true)
  const [displayCount, setDisplayCount] = useState(24)

  useEffect(() => {
    const fetchSports = async () => {
      try {
        const res = await fetch(GAMMA_URL)
        const data = await res.json()
        const raw: any[] = Array.isArray(data) ? data : []

        const sports: SportMarket[] = []
        for (const m of raw) {
          if (m.closed || !m.active) continue
          const q: string = m.question || ""
          if (!isSports(q)) continue

          const outcomePrices: string[] = Array.isArray(m.outcomePrices) ? m.outcomePrices : []
          const yesPrice = outcomePrices[0] ? parseFloat(outcomePrices[0]) : 0.5
          const noPrice  = outcomePrices[1] ? parseFloat(outcomePrices[1]) : 0.5
          let outcomes: string[] = ["Yes", "No"]
          try { outcomes = typeof m.outcomes === "string" ? JSON.parse(m.outcomes) : (m.outcomes || ["Yes", "No"]) } catch {}

          const slug = m.slug || ""
          sports.push({
            id: m.conditionId || m.id || slug,
            sport: detectSport(q),
            question: q,
            image: m.image || "",
            slug,
            url: `https://polymarket.com/event/${slug}`,
            yesPrice,
            noPrice,
            volume24h: parseFloat(m.volume24hr || 0),
            volumeTotal: parseFloat(m.volumeNum || 0),
            outcomes: outcomes.slice(0, 2),
          })
        }

        // Sort by 24h volume
        sports.sort((a, b) => b.volume24h - a.volume24h)
        setMarkets(sports)
      } catch (err) {
        console.error("Failed to fetch sports markets:", err)
      }
      setLoading(false)
    }

    fetchSports()
    const interval = setInterval(fetchSports, 60000)
    return () => clearInterval(interval)
  }, [])

  const filtered = selected === "all" ? markets : markets.filter(m => m.sport === selected)
  const visible  = filtered.slice(0, displayCount)
  const hasMore  = filtered.length > displayCount

  const countFor = (key: string) => key === "all" ? markets.length : markets.filter(m => m.sport === key).length

  return (
    <div className="min-h-screen pt-20 md:pt-24 px-4 pb-8 bg-black text-white">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-2">Sports Markets</h1>
          <p className="text-sm text-white/40">
            {loading ? "Loading..." : `${filtered.length} active markets`} • Live from Polymarket
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "TOTAL MARKETS", value: markets.length },
            { label: "SOCCER", value: countFor("soccer") },
            { label: "NBA", value: countFor("nba") },
            { label: "OTHER SPORTS", value: markets.filter(m => !["soccer","nba","nfl"].includes(m.sport)).length },
          ].map(s => (
            <div key={s.label} className="bg-white/5 border border-white/10 p-4">
              <div className="text-xs text-white/40 font-mono mb-1">{s.label}</div>
              <div className="text-2xl font-bold text-white font-mono">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Sport Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          {Object.entries(SPORT_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => { setSelected(key); setDisplayCount(24) }}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs whitespace-nowrap transition-colors border font-mono ${
                selected === key
                  ? "bg-white text-black border-white"
                  : "bg-transparent text-white/50 border-white/10 hover:border-white/30 hover:text-white"
              }`}
            >
              {cfg.name.toUpperCase()}
              <span className="opacity-40 text-[10px]">({countFor(key)})</span>
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
              <AnimatePresence>
                {visible.map((market, idx) => (
                  <motion.a
                    key={market.id}
                    href={market.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.02, 0.5) }}
                    className="bg-[#0A0A0A] border border-white/10 hover:border-white/30 transition-all group overflow-hidden block"
                  >
                    {/* Image */}
                    <div className="relative h-36 bg-gradient-to-br from-white/5 to-black overflow-hidden">
                      {market.image ? (
                        <img
                          src={market.image}
                          alt=""
                          className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                          onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-4xl opacity-20">
                            {market.sport === "soccer" ? "⚽" : market.sport === "nba" ? "🏀" : market.sport === "nfl" ? "🏈" : market.sport === "tennis" ? "🎾" : market.sport === "ufc" ? "🥊" : "🏆"}
                          </span>
                        </div>
                      )}
                      <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm text-white/60 text-[10px] font-mono px-2 py-1 border border-white/10">
                        {formatVolume(market.volume24h)} 24h
                      </div>
                      <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-sm text-white/50 text-[10px] uppercase tracking-wider px-2 py-1 border border-white/10">
                        {market.sport}
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-4">
                      <p className="text-sm text-white line-clamp-2 mb-4 leading-snug group-hover:text-white/90 min-h-[2.5rem]">
                        {market.question}
                      </p>

                      {/* YES / NO */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="flex flex-col items-center py-3 bg-[#22C55E]/10 border border-[#22C55E]/30">
                          <span className="text-[10px] text-[#22C55E]/60 font-mono mb-1 uppercase">{market.outcomes[0] || "Yes"}</span>
                          <span className="text-xl font-bold text-[#22C55E] font-mono leading-none">
                            {(market.yesPrice * 100).toFixed(0)}¢
                          </span>
                        </div>
                        <div className="flex flex-col items-center py-3 bg-[#EF4444]/10 border border-[#EF4444]/30">
                          <span className="text-[10px] text-[#EF4444]/60 font-mono mb-1 uppercase">{market.outcomes[1] || "No"}</span>
                          <span className="text-xl font-bold text-[#EF4444] font-mono leading-none">
                            {(market.noPrice * 100).toFixed(0)}¢
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-white/25 font-mono pt-2 border-t border-white/5">
                        <span>Vol: {formatVolume(market.volumeTotal)}</span>
                        <div className="flex items-center gap-1 text-white/40 group-hover:text-white/70">
                          <span>Polymarket</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </div>
                      </div>
                    </div>
                  </motion.a>
                ))}
              </AnimatePresence>
            </div>

            {hasMore && (
              <div className="text-center mb-4">
                <button
                  onClick={() => setDisplayCount(prev => prev + 24)}
                  className="px-8 py-3 bg-white/5 border border-white/10 text-white hover:bg-white hover:text-black transition-all text-sm"
                >
                  Load more <span className="text-white/40 text-xs">({filtered.length - displayCount} remaining)</span>
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
