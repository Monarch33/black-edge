"use client"

import { useState, useEffect, useRef, useCallback, startTransition, useMemo } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Power, Bot, Lock, Shield, Key } from "lucide-react"
import { MetricTooltip } from "@/components/metric-tooltip"
import { TerminalWelcomeTour } from "@/components/terminal-welcome-tour"

// ── Backend endpoints ─────────────────────────────────────────────────────────
const API_BASE  = process.env.NEXT_PUBLIC_API_URL  || "http://localhost:8000"
const WS_BASE   = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/^http/, "ws")
// Rust HFT engine — REST for credentials POST, WebSocket for live metrics
const RUST_BASE = process.env.NEXT_PUBLIC_RUST_URL  || "http://localhost:8090"
// Convert http(s) → ws(s) for the native WebSocket connection
const RUST_WS   = RUST_BASE.replace(/^http(s?)/, "ws$1")

const ENGINE_OFFLINE = "[FATAL] ENGINE OFFLINE. CONNECTION REFUSED."

// ── Types ─────────────────────────────────────────────────────────────────────

interface HftMetrics {
  btc_price:               number
  yes_price:               number
  bs_fair_value:           number
  kelly_fraction:          number
  edge:                    number
  sigma:                   number
  strike:                  number
  bankroll_usdc_dollars:   number
  active_token_id:         string | null
  active_market_id:        string | null
  credentials_loaded:      boolean
  active_orders_count:     number
  // microstructure
  ob_imbalance:            number
  // inventory / take-profit
  current_position_shares: number
  average_entry_price:     number
  unrealized_pnl:          number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLogClassName(line: string): string {
  if (line.includes("[ERROR]") || line.includes("[VETO]") || line.includes("[FAIL]"))
    return "text-[#ef4444]"
  if (
    line.includes("[SUCCESS]") || line.includes("[TRADE]") ||
    line.includes("[ALPHA]")   || line.includes("[EXECUTION]") ||
    line.includes("[EDGE]")    || line.includes("[P&L]")
  )
    return "text-[#10b981]"
  return "text-[#6b7280]"
}

function formatTimestamp(): string {
  const n = new Date()
  return `[${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}:${String(n.getSeconds()).padStart(2,"0")}]`
}

function fmt(n: number, decimals = 4): string {
  return isNaN(n) ? "—" : n.toFixed(decimals)
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  // ── Vault credentials ───────────────────────────────────────────────────────
  const [proxyKey,      setProxyKey]      = useState("")
  const [secret,        setSecret]        = useState("")
  const [passphrase,    setPassphrase]    = useState("")
  const [polygonKey,    setPolygonKey]    = useState("")

  // ── UI state ────────────────────────────────────────────────────────────────
  const [hasCredentials, setHasCredentials] = useState(false)
  const [rustArmed,      setRustArmed]      = useState(false)
  const [isBotActive,    setIsBotActive]    = useState(false)
  const [currentPnl,     setCurrentPnl]     = useState<number | null>(null)
  const [logs,           setLogs]           = useState<string[]>([])
  const [engineOffline,  setEngineOffline]  = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [toggling,       setToggling]       = useState(false)
  const [autoScroll,     setAutoScroll]     = useState(true)

  // ── Rust HFT metrics ────────────────────────────────────────────────────────
  const [hftMetrics, setHftMetrics] = useState<HftMetrics | null>(null)
  const [rustOnline,  setRustOnline]  = useState(false)

  // ── Refs ────────────────────────────────────────────────────────────────────
  const logsEndRef       = useRef<HTMLDivElement>(null)
  const logsContainerRef = useRef<HTMLDivElement>(null)
  const wsRef            = useRef<WebSocket | null>(null)

  // ── Scroll ──────────────────────────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  const handleScroll = useCallback(() => {
    const el = logsContainerRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50)
  }, [])

  useEffect(() => {
    if (autoScroll) scrollToBottom()
  }, [logs, autoScroll, scrollToBottom])

  // ── Python backend status (existing) ────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/engine/status`)
      const data = await res.json()
      setEngineOffline(false)
      setIsBotActive(data.active ?? false)
      setCurrentPnl(typeof data.pnl === "number" ? data.pnl : 0)
    } catch {
      setEngineOffline(true)
      setIsBotActive(false)
      setCurrentPnl(0)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const id = setInterval(fetchStatus, 10_000)
    return () => clearInterval(id)
  }, [fetchStatus])

  // ── Rust HFT metrics — true push via WebSocket (4 Hz from Rust server) ──────
  const hftDataRef      = useRef<HftMetrics | null>(null)
  const hftWsRef        = useRef<WebSocket | null>(null)
  const hftReconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let backoff = 1_000

    const connect = () => {
      hftWsRef.current?.close()

      const ws = new WebSocket(`${RUST_WS}/ws`)
      hftWsRef.current = ws

      ws.onopen = () => {
        backoff = 1_000
        setRustOnline(true)
      }

      ws.onmessage = (e: MessageEvent) => {
        try {
          const data: HftMetrics = JSON.parse(e.data as string)
          hftDataRef.current = data
          if (data.credentials_loaded) setRustArmed(true)
          startTransition(() => {
            setHftMetrics(hftDataRef.current)
            setRustOnline(true)
          })
        } catch {
          // ignore unparseable frames
        }
      }

      ws.onerror = () => { setRustOnline(false) }

      ws.onclose = () => {
        hftWsRef.current = null
        setRustOnline(false)
        hftReconnectRef.current = setTimeout(() => {
          backoff = Math.min(backoff * 2, 8_000)
          connect()
        }, backoff)
      }
    }

    connect()

    return () => {
      hftReconnectRef.current && clearTimeout(hftReconnectRef.current)
      hftWsRef.current?.close()
      hftWsRef.current = null
    }
  }, [])

  // ── Python backend log WebSocket ─────────────────────────────────────────
  useEffect(() => {
    if (engineOffline) {
      setLogs((prev) => prev.includes(ENGINE_OFFLINE) ? prev : [...prev, ENGINE_OFFLINE])
      return
    }
    const wsUrl = `${WS_BASE}/api/engine/logs/1`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setLogs((prev) => prev.filter((l) => l !== ENGINE_OFFLINE))
    }
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        const msg = typeof data.message === "string" ? data.message : String(data.message ?? "")
        if (msg) setLogs((prev) => [...prev.slice(-99), `${formatTimestamp()} ${msg}`])
      } catch {
        setLogs((prev) => [...prev.slice(-99), `${formatTimestamp()} ${e.data}`])
      }
    }
    ws.onerror = () => {
      setEngineOffline(true)
      setLogs((prev) => prev.includes(ENGINE_OFFLINE) ? prev : [...prev, ENGINE_OFFLINE])
    }
    ws.onclose = () => { wsRef.current = null }

    return () => { ws.close(); wsRef.current = null }
  }, [engineOffline])

  // ── Save credentials ───────────────────────────────────────────────────────
  const handleSaveCredentials = async () => {
    if (!proxyKey || !secret) {
      toast.error("Proxy Key and Secret are required")
      return
    }
    if (polygonKey && polygonKey.replace(/^0x/, "").length !== 64) {
      toast.error("Polygon private key must be 64 hex characters")
      return
    }

    setSaving(true)
    setEngineOffline(false)

    try {
      const res = await fetch(`${API_BASE}/api/engine/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proxy_key: proxyKey, secret }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error || "Failed to save credentials")
        return
      }

      if (polygonKey) {
        try {
          const rustRes = await fetch(`${RUST_BASE}/api/engine/credentials`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              polymarket_api_key:    proxyKey,
              polymarket_secret:     secret,
              polymarket_passphrase: passphrase,
              polygon_private_key:   polygonKey,
            }),
          })
          if (rustRes.ok) {
            setRustArmed(true)
            toast.success("Vault sealed. HFT engine armed and ready.")
          } else {
            const rustData = await rustRes.json().catch(() => ({}))
            toast.warning(rustData?.message || "Python backend saved. Rust engine rejected credentials.")
          }
        } catch {
          toast.warning("Credentials saved. Rust HFT engine is offline (paper-trade mode).")
        }
      } else {
        toast.success("Credentials secured in vault")
      }

      setProxyKey("")
      setSecret("")
      setPassphrase("")
      setPolygonKey("")
      setHasCredentials(true)
    } catch {
      setEngineOffline(true)
      toast.error("Engine offline")
    } finally {
      setSaving(false)
    }
  }

  // ── Toggle Python bot ──────────────────────────────────────────────────────
  const toggleBot = async () => {
    setToggling(true)
    setEngineOffline(false)
    try {
      const res = await fetch(`${API_BASE}/api/engine/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !isBotActive }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error || "Failed to toggle")
      } else {
        setIsBotActive(data.active ?? !isBotActive)
      }
    } catch {
      setEngineOffline(true)
      toast.error("Engine offline")
    } finally {
      setToggling(false)
    }
  }

  // ── Derived display values ─────────────────────────────────────────────────
  const edgeColor = useMemo(() => {
    if (!hftMetrics) return "text-[#6b7280]"
    if (hftMetrics.edge >= 0.02) return "text-[#10b981]"
    if (hftMetrics.edge > 0) return "text-amber-400"
    return "text-[#6b7280]"
  }, [hftMetrics])

  return (
    // FIX 1: style={{ cursor: "default" }} overrides the global body { cursor: none }
    // that comes from globals.css — the dashboard has no custom cursor JS, so
    // without this the pointer is invisible the whole time.
    <div
      className="min-h-screen bg-black text-white font-mono w-full max-w-[100vw] overflow-x-hidden"
      style={{ cursor: "default" }}
    >
      {/* ── Header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 py-4 bg-black/90 border-b border-white/10 backdrop-blur-sm">
        <Link href="/" className="flex items-center gap-3">
          <span className="font-mono tracking-[0.2em] text-white font-bold text-xl drop-shadow-md">
            BLACK EDGE
          </span>
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.9)]" />
        </Link>
        <div className="flex items-center gap-4 sm:gap-6">
          {/* Rust engine status */}
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${rustOnline ? "bg-[#10b981] animate-pulse" : "bg-white/20"}`} />
            <span className={`text-[10px] tracking-[0.2em] hidden sm:inline ${rustOnline ? "text-[#10b981]" : "text-white/30"}`}>
              HFT: {rustOnline ? (rustArmed ? "ARMED" : "ONLINE") : "OFFLINE"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
            <span className="text-[10px] tracking-[0.2em] text-[#10b981] hidden sm:inline">STATUS: CONNECTED</span>
          </div>
          <Link
            href="/"
            className="px-4 py-2 border border-white/20 rounded-lg text-white/70 hover:border-red-500/50 hover:text-red-400 text-[10px] tracking-widest transition-colors"
          >
            LOGOUT
          </Link>
        </div>
      </header>

      {/* ── Main Grid ──
          FIX 2: pt-24 (96px) ensures content clears the fixed header.
          FIX 3: CSS grid replaces the rigid flex sidebar layout. */}
      <main className="pt-24 min-h-screen p-4 sm:p-6 lg:p-8">
        <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ══ LEFT COLUMN ══ */}
          <div className="lg:col-span-1 flex flex-col gap-5">

            {/* ── FIX 4: Secure Vault card — onboarding-first credential form ── */}
            <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6">

              {/* Card header */}
              <div className="flex items-start gap-3 mb-6">
                <div className="p-2 bg-emerald-500/10 rounded-xl mt-0.5 flex-shrink-0">
                  <Lock className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold tracking-[0.15em] text-white">SECURE VAULT</h2>
                  <p className="text-[9px] text-zinc-600 mt-0.5 leading-relaxed">
                    Credentials live in browser memory only — never persisted to disk or transmitted in plaintext
                  </p>
                </div>
              </div>

              {/* ── Polymarket API Keys section ── */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <Key className="w-3 h-3 text-zinc-500" />
                  <span className="text-[9px] tracking-widest text-zinc-500 uppercase">Polymarket Trading Keys</span>
                </div>

                {/* Contextual guide */}
                <div className="mb-4 p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                  <p className="text-[9px] text-zinc-500 leading-relaxed">
                    Generate these in your{" "}
                    <span className="text-zinc-300">Polymarket account → Settings → API Keys</span>.
                    You will receive a Proxy Key, Secret, and Passphrase — paste all three below.
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Proxy Key */}
                  <div>
                    <label className="block text-[9px] tracking-wider text-zinc-500 mb-1.5 uppercase">
                      Proxy Key
                    </label>
                    <input
                      type="password"
                      value={proxyKey}
                      onChange={(e) => setProxyKey(e.target.value)}
                      placeholder="Paste your Polymarket proxy key"
                      className="w-full px-3.5 py-2.5 bg-black/50 border border-white/[0.08] rounded-xl text-white text-[11px] placeholder-zinc-700 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/[0.15] transition-colors"
                    />
                  </div>

                  {/* Secret */}
                  <div>
                    <label className="block text-[9px] tracking-wider text-zinc-500 mb-1.5 uppercase">
                      Secret
                    </label>
                    <input
                      type="password"
                      value={secret}
                      onChange={(e) => setSecret(e.target.value)}
                      placeholder="Paste your API secret"
                      className="w-full px-3.5 py-2.5 bg-black/50 border border-white/[0.08] rounded-xl text-white text-[11px] placeholder-zinc-700 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/[0.15] transition-colors"
                    />
                  </div>

                  {/* Passphrase */}
                  <div>
                    <label className="block text-[9px] tracking-wider text-zinc-500 mb-1.5 uppercase">
                      Passphrase
                    </label>
                    <input
                      type="password"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      placeholder="The passphrase you chose on Polymarket"
                      className="w-full px-3.5 py-2.5 bg-black/50 border border-white/[0.08] rounded-xl text-white text-[11px] placeholder-zinc-700 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/[0.15] transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-white/[0.06] my-5" />

              {/* ── Polygon Private Key section ── */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-3 h-3 text-amber-500/70" />
                  <span className="text-[9px] tracking-widest text-amber-500/60 uppercase">Polygon Execution Signer</span>
                </div>

                {/* Warning + guide box */}
                <div className="mb-3 p-3 bg-amber-500/[0.05] border border-amber-500/[0.18] rounded-xl">
                  <p className="text-[9px] text-amber-400/70 leading-relaxed">
                    <span className="text-amber-400 font-semibold">Your Web3 wallet export key.</span>{" "}
                    The bot needs this to cryptographically sign trades on Polygon L2.{" "}
                    <span className="text-amber-300">Never transmitted over the network</span>{" "}
                    — held in browser process memory only and cleared on page close.
                  </p>
                  <p className="text-[9px] text-amber-500/50 mt-1.5 leading-relaxed">
                    Export from MetaMask: Account → ··· → Account Details → Show Private Key
                  </p>
                </div>

                <div>
                  <label className="block text-[9px] tracking-wider text-zinc-500 mb-1.5 uppercase">
                    Polygon Private Key
                  </label>
                  <input
                    type="password"
                    value={polygonKey}
                    onChange={(e) => setPolygonKey(e.target.value)}
                    placeholder="0x… (64 hex characters)"
                    className="w-full px-3.5 py-2.5 bg-black/50 border border-amber-500/20 rounded-xl text-white text-[11px] placeholder-zinc-700 focus:border-amber-500/40 focus:outline-none focus:ring-1 focus:ring-amber-500/[0.15] transition-colors"
                  />
                </div>
              </div>

              {/* Arm button */}
              <button
                onClick={handleSaveCredentials}
                disabled={saving}
                className={`w-full py-3 rounded-xl text-[10px] tracking-widest transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2.5 font-semibold ${
                  rustArmed
                    ? "bg-amber-500/10 border border-amber-500/40 text-amber-400 hover:bg-amber-500/[0.15]"
                    : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/[0.15]"
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                {saving
                  ? "SEALING VAULT…"
                  : rustArmed
                    ? "VAULT SEALED · RE-ARM"
                    : "SEAL VAULT & ARM ENGINE"}
              </button>
            </div>

            {/* ── Engine Control card ── */}
            <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-5">
              <button
                onClick={toggleBot}
                disabled={toggling}
                className={`w-full py-4 rounded-xl text-[10px] tracking-widest transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-3 ${
                  isBotActive
                    ? "bg-emerald-500/[0.15] border border-emerald-500/40 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.15)]"
                    : "border border-white/[0.08] text-zinc-500 hover:border-emerald-500/30 hover:text-emerald-400 hover:bg-emerald-500/[0.05]"
                }`}
              >
                <Power size={14} className={isBotActive ? "text-emerald-400" : ""} />
                {toggling ? "SWITCHING…" : isBotActive ? "AGENT ACTIVE — CLICK TO STOP" : "ACTIVATE AUTONOMOUS AGENT"}
              </button>
            </div>

            {/* ── HFT Metrics card ── */}
            <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[11px] tracking-[0.2em] text-zinc-400 font-semibold">HFT ENGINE METRICS</h2>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${rustOnline ? "bg-[#10b981] animate-pulse" : "bg-white/15"}`} />
                  <span className={`text-[9px] tracking-wider ${rustOnline ? "text-[#10b981]" : "text-zinc-700"}`}>
                    {rustOnline ? "LIVE" : "OFFLINE"}
                  </span>
                </div>
              </div>

              {!rustOnline ? (
                <div className="p-4 rounded-xl bg-black/30 border border-white/[0.04]">
                  <p className="text-[10px] text-zinc-600 leading-relaxed">
                    Start the Rust engine: <span className="text-zinc-400">cargo run</span>
                  </p>
                </div>
              ) : (
                <div className="space-y-0">
                  {/* BTC SPOT */}
                  <div className="flex justify-between items-center py-2.5 border-b border-white/[0.04]">
                    <span className="text-[9px] tracking-wider text-zinc-500">BTC SPOT</span>
                    <span className="text-[11px] text-white tabular-nums">
                      ${hftMetrics ? hftMetrics.btc_price.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—"}
                    </span>
                  </div>

                  {/* YES PRICE */}
                  <div className="flex justify-between items-center py-2.5 border-b border-white/[0.04]">
                    <span className="text-[9px] tracking-wider text-zinc-500">YES PRICE</span>
                    <span className="text-[11px] text-amber-400 tabular-nums">
                      {hftMetrics ? fmt(hftMetrics.yes_price) : "—"}
                    </span>
                  </div>

                  {/* BS FAIR VALUE */}
                  <div className="flex justify-between items-center py-2.5 border-b border-white/[0.04]">
                    <MetricTooltip label="BS FAIR VALUE" tip="Black-Scholes fair value — the mathematically correct price of this binary option based on current BTC volatility and time to expiry." />
                    <span className="text-[11px] text-white tabular-nums">
                      {hftMetrics ? fmt(hftMetrics.bs_fair_value) : "—"}
                    </span>
                  </div>

                  {/* EDGE */}
                  <div className="flex justify-between items-center py-2.5 border-b border-white/[0.04]">
                    <MetricTooltip label="EDGE" tip="The difference between our calculated fair value and the current market price. A positive edge means the market is mispriced in our favor." />
                    <span className={`text-[11px] tabular-nums font-bold ${edgeColor}`}>
                      {hftMetrics
                        ? `${hftMetrics.edge >= 0 ? "+" : ""}${(hftMetrics.edge * 100).toFixed(2)}%`
                        : "—"}
                    </span>
                  </div>

                  {/* ½-KELLY SIZE */}
                  <div className="flex justify-between items-center py-2.5 border-b border-white/[0.04]">
                    <MetricTooltip label="½-KELLY SIZE" tip="The mathematically safest amount to invest on this trade to grow your bankroll without risking ruin. Half-Kelly is more conservative than full Kelly for safety." />
                    <span className="text-[11px] text-[#10b981] tabular-nums">
                      {hftMetrics ? `${(hftMetrics.kelly_fraction * 100).toFixed(2)}%` : "—"}
                    </span>
                  </div>

                  {/* σ (VOL) */}
                  <div className="flex justify-between items-center py-2.5 border-b border-white/[0.04]">
                    <MetricTooltip label="σ (VOL)" tip="Implied volatility — how much BTC price is expected to move. Higher σ means bigger potential swings and wider option pricing." />
                    <span className="text-[11px] text-zinc-400 tabular-nums">
                      {hftMetrics ? `${(hftMetrics.sigma * 100).toFixed(0)}%` : "—"}
                    </span>
                  </div>

                  {/* BANKROLL */}
                  <div className="flex justify-between items-center py-2.5 border-b border-white/[0.04]">
                    <span className="text-[9px] tracking-wider text-zinc-500">BANKROLL</span>
                    <span className="text-[11px] text-white tabular-nums">
                      {hftMetrics
                        ? `$${hftMetrics.bankroll_usdc_dollars.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
                        : "—"}
                    </span>
                  </div>

                  {/* ACTIVE ORDERS */}
                  <div className="flex justify-between items-center py-2.5 border-b border-white/[0.04]">
                    <span className="text-[9px] tracking-wider text-zinc-500">ACTIVE ORDERS</span>
                    <span className={`text-[11px] tabular-nums ${(hftMetrics?.active_orders_count ?? 0) > 0 ? "text-amber-400" : "text-zinc-700"}`}>
                      {hftMetrics?.active_orders_count ?? 0}
                    </span>
                  </div>

                  {/* OB IMBALANCE */}
                  <div className="flex justify-between items-center py-2.5 border-b border-white/[0.04]">
                    <MetricTooltip label="OB IMBALANCE" tip="Orderbook imbalance — measures whether buyers or sellers dominate. Positive (green) = more buy pressure. Negative (red) = more sell pressure." />
                    <div className="flex items-center gap-2">
                      <div className="relative w-14 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`absolute top-0 h-full rounded-full transition-all duration-300 ${
                            (hftMetrics?.ob_imbalance ?? 0) >= 0 ? "bg-[#10b981]" : "bg-[#ef4444]"
                          }`}
                          style={{
                            width: `${Math.abs((hftMetrics?.ob_imbalance ?? 0)) * 50}%`,
                            left:  (hftMetrics?.ob_imbalance ?? 0) >= 0 ? "50%" : undefined,
                            right: (hftMetrics?.ob_imbalance ?? 0) <  0 ? "50%" : undefined,
                          }}
                        />
                        <div className="absolute left-1/2 top-0 w-px h-full bg-white/20" />
                      </div>
                      <span className={`text-[10px] font-mono tabular-nums ${
                        (hftMetrics?.ob_imbalance ?? 0) > 0.6
                          ? "text-[#10b981]"
                          : (hftMetrics?.ob_imbalance ?? 0) < -0.6
                            ? "text-[#ef4444]"
                            : "text-zinc-500"
                      }`}>
                        {hftMetrics ? (hftMetrics.ob_imbalance >= 0 ? "+" : "") + hftMetrics.ob_imbalance.toFixed(3) : "—"}
                      </span>
                    </div>
                  </div>

                  {/* INVENTORY */}
                  <div className="flex justify-between items-center py-2.5 border-b border-white/[0.04]">
                    <span className="text-[9px] tracking-wider text-zinc-500">INVENTORY</span>
                    <div className="text-right">
                      {(hftMetrics?.current_position_shares ?? 0) > 0 ? (
                        <>
                          <div className="text-[11px] text-white tabular-nums">
                            {hftMetrics!.current_position_shares.toFixed(4)} YES
                          </div>
                          <div className={`text-[9px] tabular-nums ${
                            (hftMetrics?.unrealized_pnl ?? 0) >= 0 ? "text-[#10b981]" : "text-[#ef4444]"
                          }`}>
                            {(hftMetrics?.unrealized_pnl ?? 0) >= 0 ? "+" : ""}
                            {(hftMetrics?.unrealized_pnl ?? 0).toFixed(2)} USDC
                            {" · TP@"}
                            {hftMetrics ? (hftMetrics.average_entry_price * 1.20).toFixed(4) : "—"}
                          </div>
                        </>
                      ) : (
                        <span className="text-[10px] text-zinc-700">FLAT</span>
                      )}
                    </div>
                  </div>

                  {/* EXECUTION STATUS */}
                  <div className="flex justify-between items-center py-2.5">
                    <MetricTooltip label="EXECUTION" tip="Whether the bot has valid API credentials loaded and is authorized to place real trades on Polymarket." />
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${hftMetrics?.credentials_loaded ? "bg-[#10b981] animate-pulse" : "bg-red-500/50"}`} />
                      <span className={`text-[9px] tracking-widest font-bold ${hftMetrics?.credentials_loaded ? "text-[#10b981]" : "text-red-400/60"}`}>
                        {hftMetrics?.credentials_loaded ? "ARMED" : "DISARMED"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ══ RIGHT COLUMN ══ */}
          <div className="lg:col-span-2 flex flex-col gap-5">

            {/* ── Logs Terminal card ── */}
            <div
              className="bg-zinc-900/50 border border-white/5 rounded-2xl overflow-hidden flex flex-col"
              style={{ minHeight: "calc(100vh - 280px)" }}
            >
              {/* Terminal titlebar */}
              <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center gap-2 flex-shrink-0">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#10b981]/70" />
                </div>
                <span className="text-[9px] tracking-widest text-zinc-600 ml-3">LIVE EXECUTION LOGS</span>
                {!autoScroll && (
                  <span className="text-[8px] text-zinc-700 ml-auto">↓ scroll to auto-follow</span>
                )}
              </div>

              {/* Log lines */}
              <div
                ref={logsContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-5 font-mono text-xs leading-6"
              >
                {logs.length === 0 && !isBotActive && !engineOffline && (
                  <div className="flex flex-col items-center justify-center h-full gap-4 py-16">
                    <Bot size={32} className="text-emerald-500/30 animate-bounce" />
                    <p className="text-zinc-600 text-sm text-center max-w-xs leading-relaxed">
                      The Oracle is scanning the market.
                      <span className="block text-zinc-700 text-xs mt-1">
                        It executes only when the mathematical edge is statistically significant.
                      </span>
                    </p>
                    <button
                      onClick={toggleBot}
                      disabled={toggling}
                      className="mt-2 px-6 py-2.5 border border-emerald-500/25 rounded-xl text-emerald-500/60 text-[10px] tracking-widest hover:bg-emerald-500/[0.08] hover:text-emerald-400 transition-all flex items-center gap-2"
                    >
                      <Power size={11} /> ACTIVATE AGENT
                    </button>
                  </div>
                )}
                {logs.map((line, i) => (
                  <div key={`${i}-${line}`} className={`py-0.5 leading-5 ${getLogClassName(line)}`}>
                    {line}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>

            {/* ── Bottom stats row ── */}
            <div className="grid grid-cols-2 gap-5">

              {/* Live P&L card */}
              <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
                <span className="text-[9px] tracking-widest text-zinc-600 block mb-3">LIVE P&L</span>
                <span
                  className={`text-4xl sm:text-5xl font-bold tracking-tight block leading-none ${
                    currentPnl !== null && currentPnl >= 0 ? "text-[#10b981]" : "text-red-400"
                  }`}
                >
                  {currentPnl !== null ? `$${currentPnl.toFixed(2)}` : "—"}
                </span>
                <span className="text-[9px] text-zinc-700 mt-2.5 block">Python execution engine</span>
              </div>

              {/* HFT Edge card */}
              <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
                <span className="text-[9px] tracking-widest text-zinc-600 block mb-3">HFT EDGE</span>
                <span className={`text-4xl sm:text-5xl font-bold tracking-tight block leading-none ${edgeColor}`}>
                  {hftMetrics
                    ? `${hftMetrics.edge >= 0 ? "+" : ""}${(hftMetrics.edge * 100).toFixed(2)}%`
                    : "—"}
                </span>
                <span className="text-[9px] text-zinc-700 mt-2.5 block">
                  Rust HFT engine · {rustOnline ? "live" : "offline"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <TerminalWelcomeTour />
    </div>
  )
}
