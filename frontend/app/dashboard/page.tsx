"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { toast } from "sonner"

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
  btc_price:              number
  yes_price:              number
  bs_fair_value:          number
  kelly_fraction:         number
  edge:                   number
  sigma:                  number
  bankroll_usdc_dollars:  number
  active_token_id:        string | null
  active_market_id:       string | null
  credentials_loaded:     boolean
  active_orders_count:    number
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
  const hftWsRef        = useRef<WebSocket | null>(null)
  const hftReconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let backoff = 1_000 // start at 1 s, cap at 8 s

    const connect = () => {
      // Clean up any existing socket before opening a new one
      hftWsRef.current?.close()

      const ws = new WebSocket(`${RUST_WS}/ws`)
      hftWsRef.current = ws

      ws.onopen = () => {
        backoff = 1_000 // reset backoff on successful connection
        setRustOnline(true)
      }

      ws.onmessage = (e: MessageEvent) => {
        try {
          const data: HftMetrics = JSON.parse(e.data as string)
          setHftMetrics(data)
          setRustOnline(true)
          if (data.credentials_loaded) setRustArmed(true)
        } catch {
          // ignore unparseable frames
        }
      }

      ws.onerror = () => {
        setRustOnline(false)
      }

      ws.onclose = () => {
        hftWsRef.current = null
        setRustOnline(false)
        // Reconnect with capped exponential backoff
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
  }, []) // intentionally empty – connect once on mount, reconnect internally

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
      // Step 1 – save to existing Python backend
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

      // Step 2 – arm the Rust HFT execution engine
      if (polygonKey) {
        try {
          const rustRes = await fetch(`${RUST_BASE}/api/engine/credentials`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              polymarket_api_key:   proxyKey,
              polymarket_secret:    secret,
              polymarket_passphrase: passphrase,
              polygon_private_key:  polygonKey,
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
          // Rust engine not running — credentials still saved to Python backend
          toast.warning("Credentials saved. Rust HFT engine is offline (paper-trade mode).")
        }
      } else {
        toast.success("Credentials secured in vault")
      }

      // Clear all sensitive fields from React state after submission
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

  const showVaultOnly = !hasCredentials && !proxyKey && !secret && !passphrase && !polygonKey

  // ── Derived display values ─────────────────────────────────────────────────
  const edgeColor = hftMetrics && hftMetrics.edge >= 0.02
    ? "text-[#10b981]"
    : hftMetrics && hftMetrics.edge > 0
      ? "text-amber-400"
      : "text-[#6b7280]"

  return (
    <div className="min-h-screen bg-black text-white font-mono w-full max-w-[100vw] overflow-x-hidden">
      {/* ── Header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 py-4 bg-black/90 border-b border-white/10 backdrop-blur-sm">
        <Link href="/" className="font-bold text-base tracking-tight flex items-baseline gap-1">
          BLACK<span className="font-serif italic text-[#10b981]">EDGE</span>
        </Link>
        <div className="flex items-center gap-4 sm:gap-6">
          {/* Rust engine status indicator */}
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
            className="px-4 py-2 border border-white/20 text-white/70 hover:border-red-500/50 hover:text-red-400 text-[10px] tracking-widest transition-colors"
          >
            LOGOUT
          </Link>
        </div>
      </header>

      <main className="pt-[72px] flex min-h-screen flex-col lg:flex-row w-full">
        {/* ── Sidebar ── */}
        <aside className="w-full lg:w-[30%] lg:min-w-[300px] border-r border-white/10 p-4 sm:p-6 flex flex-col gap-8">

          {/* ── Vault / Credentials ── */}
          <div>
            <h2 className="text-[10px] tracking-[0.3em] text-[#10b981] mb-4">POLYMARKET API CREDENTIALS</h2>
            {showVaultOnly && (
              <div className="mb-6 p-6 border border-[#10b981]/30 bg-black text-center">
                <p className="text-[#10b981] text-sm font-bold tracking-widest">VAULT ENCRYPTION REQUIRED</p>
                <p className="text-white/40 text-[10px] mt-2">
                  Paste your Polymarket CLOB keys and Polygon signer key to arm the HFT engine.
                </p>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-[9px] tracking-wider text-white/40 mb-2">Proxy Key</label>
                <input
                  type="password"
                  value={proxyKey}
                  onChange={(e) => setProxyKey(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-4 py-3 bg-transparent border border-transparent border-b-white/10 text-white text-sm placeholder-white/20 focus:border-[#10b981] focus:outline-none focus:ring-1 focus:ring-[#10b981]/30 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[9px] tracking-wider text-white/40 mb-2">Secret</label>
                <input
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-4 py-3 bg-transparent border border-transparent border-b-white/10 text-white text-sm placeholder-white/20 focus:border-[#10b981] focus:outline-none focus:ring-1 focus:ring-[#10b981]/30 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[9px] tracking-wider text-white/40 mb-2">Passphrase</label>
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-4 py-3 bg-transparent border border-transparent border-b-white/10 text-white text-sm placeholder-white/20 focus:border-[#10b981] focus:outline-none focus:ring-1 focus:ring-[#10b981]/30 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[9px] tracking-wider text-white/40 mb-2">
                  Polygon Private Key
                  <span className="ml-2 text-amber-500/60">(L2 execution signer)</span>
                </label>
                <input
                  type="password"
                  value={polygonKey}
                  onChange={(e) => setPolygonKey(e.target.value)}
                  placeholder="0x••••••••••••"
                  className="w-full px-4 py-3 bg-transparent border border-transparent border-b-amber-500/20 text-white text-sm placeholder-white/20 focus:border-amber-500/60 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-colors"
                />
                <p className="mt-1 text-[8px] text-white/20">
                  Never transmitted over the network. Held in process RAM only.
                </p>
              </div>
              <button
                onClick={handleSaveCredentials}
                disabled={saving}
                className={`w-full py-3 border text-[10px] tracking-widest transition-colors disabled:opacity-50 ${
                  rustArmed
                    ? "border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                    : "border-[#10b981]/50 text-[#10b981] hover:bg-[#10b981]/10"
                }`}
              >
                {saving
                  ? "ARMING ENGINE..."
                  : rustArmed
                    ? "[ ENGINE ARMED ]"
                    : "SAVE & ARM ENGINE"}
              </button>
            </div>
          </div>

          {/* ── Bot toggle ── */}
          <div>
            <button
              onClick={toggleBot}
              disabled={toggling}
              className={`w-full py-6 border text-[10px] tracking-widest transition-all disabled:opacity-50 ${
                isBotActive
                  ? "bg-[#10b981]/20 border-[#10b981] text-[#10b981] shadow-[0_0_24px_rgba(16,185,129,0.3)]"
                  : "border-white/20 text-white/60 hover:border-white/40 hover:text-white"
              }`}
            >
              {toggling ? "..." : isBotActive ? "[ AGENT ACTIVE ]" : "[ ACTIVATE AUTONOMOUS AGENT ]"}
            </button>
          </div>

          {/* ── Rust HFT live metrics ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[10px] tracking-[0.3em] text-white/40">HFT ENGINE METRICS</h2>
              <span className={`text-[8px] tracking-widest ${rustOnline ? "text-[#10b981]" : "text-white/20"}`}>
                {rustOnline ? "● LIVE" : "○ OFFLINE"}
              </span>
            </div>

            {!rustOnline ? (
              <p className="text-[10px] text-white/20 border border-white/5 p-4">
                Start the Rust engine: <span className="text-white/40">cargo run</span>
              </p>
            ) : (
              <div className="space-y-px border border-white/10">
                {/* BTC Price */}
                <div className="flex justify-between items-center px-3 py-2 bg-white/[0.02]">
                  <span className="text-[9px] tracking-wider text-white/40">BTC SPOT</span>
                  <span className="text-[11px] text-white tabular-nums">
                    ${hftMetrics ? hftMetrics.btc_price.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—"}
                  </span>
                </div>
                {/* YES Price */}
                <div className="flex justify-between items-center px-3 py-2">
                  <span className="text-[9px] tracking-wider text-white/40">YES PRICE</span>
                  <span className="text-[11px] text-amber-400 tabular-nums">
                    {hftMetrics ? fmt(hftMetrics.yes_price) : "—"}
                  </span>
                </div>
                {/* BS Fair Value */}
                <div className="flex justify-between items-center px-3 py-2 bg-white/[0.02]">
                  <span className="text-[9px] tracking-wider text-white/40">BS FAIR VALUE</span>
                  <span className="text-[11px] text-white tabular-nums">
                    {hftMetrics ? fmt(hftMetrics.bs_fair_value) : "—"}
                  </span>
                </div>
                {/* Edge */}
                <div className="flex justify-between items-center px-3 py-2">
                  <span className="text-[9px] tracking-wider text-white/40">EDGE</span>
                  <span className={`text-[11px] tabular-nums font-bold ${edgeColor}`}>
                    {hftMetrics
                      ? `${hftMetrics.edge >= 0 ? "+" : ""}${(hftMetrics.edge * 100).toFixed(2)}%`
                      : "—"}
                  </span>
                </div>
                {/* Kelly */}
                <div className="flex justify-between items-center px-3 py-2 bg-white/[0.02]">
                  <span className="text-[9px] tracking-wider text-white/40">½-KELLY SIZE</span>
                  <span className="text-[11px] text-[#10b981] tabular-nums">
                    {hftMetrics ? `${(hftMetrics.kelly_fraction * 100).toFixed(2)}%` : "—"}
                  </span>
                </div>
                {/* Sigma */}
                <div className="flex justify-between items-center px-3 py-2">
                  <span className="text-[9px] tracking-wider text-white/40">σ (VOL)</span>
                  <span className="text-[11px] text-white/70 tabular-nums">
                    {hftMetrics ? `${(hftMetrics.sigma * 100).toFixed(0)}%` : "—"}
                  </span>
                </div>
                {/* Bankroll */}
                <div className="flex justify-between items-center px-3 py-2 bg-white/[0.02]">
                  <span className="text-[9px] tracking-wider text-white/40">BANKROLL</span>
                  <span className="text-[11px] text-white tabular-nums">
                    {hftMetrics
                      ? `$${hftMetrics.bankroll_usdc_dollars.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
                      : "—"}
                  </span>
                </div>
                {/* Orders */}
                <div className="flex justify-between items-center px-3 py-2">
                  <span className="text-[9px] tracking-wider text-white/40">ACTIVE ORDERS</span>
                  <span className={`text-[11px] tabular-nums ${(hftMetrics?.active_orders_count ?? 0) > 0 ? "text-amber-400" : "text-white/40"}`}>
                    {hftMetrics?.active_orders_count ?? 0}
                  </span>
                </div>
                {/* Armed indicator */}
                <div className="flex justify-between items-center px-3 py-2 bg-white/[0.02]">
                  <span className="text-[9px] tracking-wider text-white/40">EXECUTION</span>
                  <span className={`text-[9px] tracking-widest ${hftMetrics?.credentials_loaded ? "text-[#10b981]" : "text-white/20"}`}>
                    {hftMetrics?.credentials_loaded ? "ARMED" : "DISARMED"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ── Main panel ── */}
        <div className="flex-1 flex flex-col p-4 sm:p-6 gap-6 min-w-0 min-h-0">
          {/* Log terminal */}
          <div className="flex-1 flex flex-col min-h-[50vh] lg:min-h-[calc(100vh-88px-120px)] border border-white/10 bg-black overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500/80" />
              <div className="w-2 h-2 rounded-full bg-amber-500/80" />
              <div className="w-2 h-2 rounded-full bg-[#10b981]/80" />
              <span className="text-[9px] tracking-widest text-white/30 ml-3">LIVE EXECUTION LOGS</span>
              {!autoScroll && (
                <span className="text-[8px] text-white/30 ml-auto">Scroll to bottom to auto-follow</span>
              )}
            </div>
            <div
              ref={logsContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-4 font-mono text-xs"
            >
              {logs.length === 0 && !isBotActive && !engineOffline && (
                <p className="text-white/30">Agent inactive. Activate to see logs.</p>
              )}
              {logs.map((line, i) => (
                <div key={`${i}-${line}`} className={`py-0.5 ${getLogClassName(line)}`}>
                  {line}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>

          {/* Bottom metrics bar */}
          <div className="grid grid-cols-2 gap-4">
            {/* Python P&L */}
            <div className="border border-white/10 p-6 flex items-center justify-between">
              <span className="text-[10px] tracking-widest text-white/40">LIVE PnL</span>
              <span
                className={`text-3xl sm:text-4xl font-bold tracking-tight ${
                  currentPnl !== null && currentPnl >= 0 ? "text-[#10b981]" : "text-red-400"
                }`}
              >
                {currentPnl !== null ? `$${currentPnl.toFixed(2)}` : "—"}
              </span>
            </div>

            {/* Rust edge callout */}
            <div className="border border-white/10 p-6 flex items-center justify-between">
              <span className="text-[10px] tracking-widest text-white/40">HFT EDGE</span>
              <span className={`text-3xl sm:text-4xl font-bold tracking-tight ${edgeColor}`}>
                {hftMetrics
                  ? `${hftMetrics.edge >= 0 ? "+" : ""}${(hftMetrics.edge * 100).toFixed(2)}%`
                  : "—"}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
