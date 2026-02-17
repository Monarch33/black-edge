"use client"
import { ArrowUpRight } from "lucide-react"
import type { PolyMarket } from '@/hooks/use-polymarket'

export interface CouncilDecision {
  signal: 'BUY' | 'SELL' | 'HOLD' | 'AVOID'
  edge: number
  confidence: number
  consensus_pct: number
  doomer_veto: boolean
  summary: string
}

function CouncilBadge({ decision }: { decision: CouncilDecision }) {
  const colors: Record<string, string> = {
    BUY:   'text-[#22C55E] border-[#22C55E]/30 bg-[#22C55E]/5',
    SELL:  'text-[#EF4444] border-[#EF4444]/30 bg-[#EF4444]/5',
    HOLD:  'text-white/60 border-white/20 bg-white/5',
    AVOID: 'text-[#F59E0B] border-[#F59E0B]/30 bg-[#F59E0B]/5',
  }
  const cls = colors[decision.signal] ?? colors['HOLD']
  return (
    <div className={`mt-2 px-3 py-2 border text-[10px] font-mono ${cls}`}>
      <div className="flex items-center justify-between mb-0.5">
        <span className="tracking-wider">⚡ COUNCIL: {decision.signal}</span>
        {decision.doomer_veto && <span className="text-[#F59E0B]">VETO</span>}
      </div>
      <div className="flex items-center gap-3 text-white/40">
        {decision.edge > 0 && <span>+{(decision.edge * 100).toFixed(1)}% edge</span>}
        <span>{Math.round(decision.consensus_pct)}% consensus</span>
        <span>{Math.round(decision.confidence * 100)}% conf</span>
      </div>
    </div>
  )
}

function PredictionBadge({ yesPrice }: { yesPrice: number }) {
  const pct = Math.round(yesPrice * 100)
  let label = ''
  let color = ''
  if (pct >= 85) { label = 'VERY LIKELY'; color = 'text-[#22C55E]' }
  else if (pct >= 65) { label = 'LIKELY'; color = 'text-[#22C55E]/70' }
  else if (pct >= 45) { label = 'TOSS-UP'; color = 'text-white/50' }
  else if (pct >= 25) { label = 'UNLIKELY'; color = 'text-[#EF4444]/70' }
  else { label = 'VERY UNLIKELY'; color = 'text-[#EF4444]' }
  return (
    <div className="flex items-center gap-2 mt-1">
      <span className={`text-[9px] font-mono tracking-wider ${color}`}>{label}</span>
      <span className="text-[9px] font-mono text-white/40">{pct}%</span>
    </div>
  )
}

function formatVolume(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
  return `${v.toFixed(0)}`
}

const CATEGORY_EMOJI: Record<string, string> = {
  sports: '⚽',
  crypto: '₿',
  politics: '🏛️',
  economy: '📈',
  other: '🌐',
}

export function MarketCard({ market, councilDecision }: { market: PolyMarket; councilDecision?: CouncilDecision }) {
  const yesPct = Math.round(market.yesPrice * 100)
  const noPct = Math.round(market.noPrice * 100)
  const total = yesPct + noPct
  const yesWidth = total > 0 ? (yesPct / total) * 100 : 50

  return (
    <a
      href={market.url || 'https://polymarket.com'}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-[#0A0A0A] border border-white/10 hover:border-white/30 transition-all group overflow-hidden"
    >
      {/* Image */}
      <div className="relative h-32 bg-gradient-to-br from-white/5 to-black overflow-hidden">
        {market.image ? (
          <img
            src={market.image}
            alt=""
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl opacity-10">{CATEGORY_EMOJI[market.category] || '🌐'}</span>
          </div>
        )}
        {market.volume24hr > 0 && (
          <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm text-white/60 text-[10px] font-mono px-2 py-1 border border-white/10">
            {formatVolume(market.volume24hr)} 24h
          </div>
        )}
        <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-sm text-white/50 text-[10px] uppercase tracking-wider px-2 py-1 border border-white/10">
          {market.category}
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <p className="text-sm text-white line-clamp-2 mb-4 leading-snug group-hover:text-white/90 min-h-[2.5rem]">
          {market.question}
        </p>

        {/* YES / NO prices */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="flex flex-col items-center py-3 bg-[#22C55E]/10 border border-[#22C55E]/30">
            <span className="text-[10px] text-[#22C55E]/60 font-mono mb-1 uppercase">
              {market.outcomes[0] || 'Yes'}
            </span>
            <span className="text-xl font-bold text-[#22C55E] font-mono leading-none">
              {yesPct}¢
            </span>
          </div>
          <div className="flex flex-col items-center py-3 bg-[#EF4444]/10 border border-[#EF4444]/30">
            <span className="text-[10px] text-[#EF4444]/60 font-mono mb-1 uppercase">
              {market.outcomes[1] || 'No'}
            </span>
            <span className="text-xl font-bold text-[#EF4444] font-mono leading-none">
              {noPct}¢
            </span>
          </div>
        </div>

        {/* Probability bar */}
        <div className="mb-3">
          <div className="w-full h-1 bg-[#EF4444]/20 overflow-hidden">
            <div
              className="h-full bg-[#22C55E] transition-all duration-500"
              style={{ width: `${yesWidth}%` }}
            />
          </div>
        </div>

        {/* Prediction badge */}
        <PredictionBadge yesPrice={market.yesPrice} />

        {/* Council AI decision */}
        {councilDecision && <CouncilBadge decision={councilDecision} />}

        {/* Footer */}
        <div className="flex items-center justify-between text-[10px] text-white/25 font-mono pt-2 border-t border-white/5 mt-2">
          <span>Vol: {formatVolume(market.volume)}</span>
          {market.edge !== null && market.edge > 0 && (
            <span className="text-[#22C55E]">+{market.edge.toFixed(1)}% edge</span>
          )}
          <div className="flex items-center gap-1 text-white/40 group-hover:text-white/70">
            <span>Polymarket</span>
            <ArrowUpRight className="w-3 h-3" />
          </div>
        </div>
      </div>
    </a>
  )
}
