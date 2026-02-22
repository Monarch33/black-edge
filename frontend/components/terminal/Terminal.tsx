"use client"

/**
 * Terminal — HFT Metrics Component
 * ==================================
 * Connects to the Rust black-edge-core engine WebSocket and displays
 * real-time High-Frequency Trading metrics:
 *   - BTC Spot Price (Binance, sub-second refresh)
 *   - Black-Scholes Greeks (Delta, Gamma, Theta, Vega)
 *   - Implied Volatility
 *   - Kelly Criterion position sizing
 *   - Edge vs Polymarket (model price − market price)
 *   - Chainlink oracle lag estimate (ms)
 *   - Execution latency / RPC ping (ms)
 *   - Active market details + countdown to expiry
 *
 * WebSocket: NEXT_PUBLIC_RUST_ENGINE_URL (default: ws://localhost:9000/ws)
 * Message type: "hft_metrics" (see server.rs for schema)
 */

import { useEffect, useRef, useState, useCallback } from "react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface BsResult {
  fair_price: number
  delta: number
  gamma: number
  theta: number
  vega: number
  implied_vol: number
  edge_vs_market: number
}

interface KellyResult {
  fraction: number
  dollar_amount: number
  edge: number
  b: number
}

interface ActiveMarketInfo {
  question: string
  strike: number
  end_time_ms: number
  time_to_expiry_min: number
}

interface HftMetrics {
  type: string
  timestamp_ms: number
  btc_price: number
  btc_bid: number
  btc_ask: number
  bs: BsResult | null
  kelly: KellyResult | null
  polymarket_price: number
  active_market: ActiveMarketInfo | null
  spread_ms: number
  execution_latency_ms: number
  rpc_ping_ms: number
  connected_clients: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | undefined | null, decimals = 4): string {
  if (n == null || isNaN(n)) return "—"
  return n.toFixed(decimals)
}

function fmtPrice(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return "—"
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPct(n: number | undefined | null, decimals = 1): string {
  if (n == null || isNaN(n)) return "—"
  return (n * 100).toFixed(decimals) + "%"
}

function fmtMs(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return "—"
  return n.toFixed(1) + "ms"
}

function edgeColor(edge: number | null | undefined): string {
  if (edge == null) return "text-white/40"
  if (edge >= 0.04) return "text-[#10b981]"
  if (edge >= 0.02) return "text-amber-400"
  if (edge > 0) return "text-white/60"
  return "text-red-400"
}

function expiryCountdown(end_time_ms: number): string {
  const diffMs = end_time_ms - Date.now()
  if (diffMs <= 0) return "EXPIRED"
  const totalSecs = Math.floor(diffMs / 1000)
  const mins = Math.floor(totalSecs / 60)
  const secs = totalSecs % 60
  return `${mins}:${String(secs).padStart(2, "0")}`
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  valueClass = "text-white",
  flash = false,
}: {
  label: string
  value: string
  sub?: string
  valueClass?: string
  flash?: boolean
}) {
  return (
    <div className="flex flex-col gap-1 p-3 border border-white/10 bg-black min-w-0">
      <span className="text-[8px] tracking-[0.2em] text-white/35 uppercase">{label}</span>
      <span
        className={`text-base font-mono font-bold leading-tight ${valueClass} ${flash ? "hft-flash" : ""}`}
      >
        {value}
      </span>
      {sub && <span className="text-[9px] text-white/30 font-mono">{sub}</span>}
    </div>
  )
}

// ─── Terminal Component ───────────────────────────────────────────────────────

export function Terminal() {
  const [metrics, setMetrics] = useState<HftMetrics | null>(null)
  const [connected, setConnected] = useState(false)
  const [lastBtcPrice, setLastBtcPrice] = useState<number | null>(null)
  const [btcFlash, setBtcFlash] = useState(false)
  const [countdown, setCountdown] = useState<string>("—")
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const wsUrl =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_RUST_ENGINE_URL) ||
    "ws://localhost:9000/ws"

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
    }

    ws.onmessage = (e) => {
      try {
        const data: HftMetrics = JSON.parse(e.data)
        if (data.type !== "hft_metrics") return

        setMetrics((prev) => {
          // Flash BTC price when it changes
          if (prev && Math.abs(prev.btc_price - data.btc_price) > 0.01) {
            setBtcFlash(true)
            setTimeout(() => setBtcFlash(false), 200)
          }
          return data
        })
        setLastBtcPrice(data.btc_price)
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = () => {
      setConnected(false)
      wsRef.current = null
      reconnectRef.current = setTimeout(() => connect(), 3000)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [wsUrl])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      wsRef.current?.close(1000, "unmount")
    }
  }, [connect])

  // Update expiry countdown every second
  useEffect(() => {
    const tick = () => {
      if (metrics?.active_market) {
        setCountdown(expiryCountdown(metrics.active_market.end_time_ms))
      } else {
        setCountdown("—")
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [metrics?.active_market?.end_time_ms])

  const bs = metrics?.bs ?? null
  const kelly = metrics?.kelly ?? null
  const mkt = metrics?.active_market ?? null

  return (
    <div className="border border-white/10 bg-black font-mono">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-[#10b981] animate-pulse" : "bg-red-500/60"}`} />
          <span className="text-[9px] tracking-[0.25em] text-white/40">
            HFT ENGINE — BLACK-SCHOLES / KELLY
          </span>
        </div>
        <div className="flex items-center gap-4 text-[8px] tracking-wider text-white/25">
          {connected ? (
            <span className="text-[#10b981]/70">RUST ENGINE ONLINE</span>
          ) : (
            <span className="text-red-400/60 animate-pulse">CONNECTING TO RUST ENGINE...</span>
          )}
          {metrics && (
            <span>{metrics.connected_clients} client{metrics.connected_clients !== 1 ? "s" : ""}</span>
          )}
        </div>
      </div>

      {/* Active market banner */}
      {mkt && (
        <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between gap-4 flex-wrap text-[9px]">
          <span className="text-white/40 truncate max-w-xs">{mkt.question}</span>
          <div className="flex items-center gap-6 shrink-0">
            <span className="text-white/30">
              STRIKE <span className="text-white/60">${fmtPrice(mkt.strike)}</span>
            </span>
            <span className="text-white/30">
              EXPIRES <span className={`font-bold ${countdown === "EXPIRED" ? "text-red-400" : "text-amber-400"}`}>{countdown}</span>
            </span>
          </div>
        </div>
      )}

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-white/5 p-px">
        {/* BTC Spot */}
        <MetricCard
          label="BTC SPOT (BINANCE)"
          value={metrics ? `$${fmtPrice(metrics.btc_price)}` : "—"}
          sub={metrics ? `bid $${fmtPrice(metrics.btc_bid)} / ask $${fmtPrice(metrics.btc_ask)}` : undefined}
          valueClass={btcFlash ? "text-[#10b981]" : "text-white"}
          flash={btcFlash}
        />

        {/* BS Fair Price / Edge */}
        <MetricCard
          label="BS FAIR PRICE"
          value={bs ? fmtPct(bs.fair_price) : "—"}
          sub={
            bs
              ? `POLY ${fmtPct(metrics?.polymarket_price ?? 0)}`
              : "Awaiting market"
          }
          valueClass={edgeColor(bs?.edge_vs_market)}
        />

        {/* Edge */}
        <MetricCard
          label="EDGE VS MARKET"
          value={bs ? (bs.edge_vs_market >= 0 ? "+" : "") + fmtPct(bs.edge_vs_market) : "—"}
          sub={
            kelly && kelly.edge >= 0.02
              ? "TRADEABLE SIGNAL"
              : kelly
              ? "BELOW THRESHOLD"
              : undefined
          }
          valueClass={edgeColor(bs?.edge_vs_market)}
        />

        {/* Greeks */}
        <MetricCard
          label="GREEKS (Δ / IV)"
          value={bs ? `Δ${fmt(bs.delta, 3)}` : "—"}
          sub={bs ? `IV ${fmtPct(bs.implied_vol, 0)} | Γ${fmt(bs.gamma, 4)}` : undefined}
          valueClass="text-white/80"
        />

        {/* Kelly sizing */}
        <MetricCard
          label="KELLY SIZE"
          value={kelly && kelly.fraction > 0 ? fmtPct(kelly.fraction) : "NO SIGNAL"}
          sub={
            kelly && kelly.fraction > 0
              ? `$${kelly.dollar_amount.toFixed(2)} / odds ${fmt(kelly.b, 2)}x`
              : undefined
          }
          valueClass={
            kelly && kelly.fraction > 0 ? "text-[#10b981]" : "text-white/30"
          }
        />

        {/* Latency */}
        <MetricCard
          label="LATENCY"
          value={metrics ? fmtMs(metrics.spread_ms) : "—"}
          sub={
            metrics
              ? `exec ${fmtMs(metrics.execution_latency_ms)} | rpc ${fmtMs(metrics.rpc_ping_ms)}`
              : "Chainlink lag estimate"
          }
          valueClass="text-white/60"
        />
      </div>

      {/* Theta / Vega row (secondary Greeks) */}
      {bs && (
        <div className="grid grid-cols-4 gap-px bg-white/5 p-px border-t border-white/5">
          <MetricCard
            label="THETA (daily)"
            value={fmt(bs.theta, 5)}
            valueClass="text-white/50"
          />
          <MetricCard
            label="VEGA (per 1% vol)"
            value={fmt(bs.vega, 5)}
            valueClass="text-white/50"
          />
          <MetricCard
            label="GAMMA"
            value={fmt(bs.gamma, 5)}
            valueClass="text-white/50"
          />
          <MetricCard
            label="CHAINLINK LAG"
            value={metrics ? `~${metrics.spread_ms}ms` : "—"}
            sub="Binance→Oracle→Polymarket"
            valueClass="text-amber-400/70"
          />
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between gap-4 flex-wrap">
        <span className="text-[8px] tracking-wider text-white/20">
          4Hz · Black-Scholes binary call · Kelly cap 25% · Min edge 2%
        </span>
        {!connected && (
          <span className="text-[8px] tracking-wider text-amber-400/50 animate-pulse">
            Reconnecting to Rust engine...
          </span>
        )}
      </div>

      {/* Flash animation CSS (injected inline to avoid Tailwind purge) */}
      <style>{`
        @keyframes hft-price-flash {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .hft-flash {
          animation: hft-price-flash 0.2s ease-in-out;
        }
      `}</style>
    </div>
  )
}

export default Terminal
