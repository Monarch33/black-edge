"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Info, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { AlephLogo } from "@/components/AlephLogo"
import { AlephStatus } from "@/components/AlephStatus"
import { TerminalWelcomeTour } from "@/components/TerminalWelcomeTour"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
const WS_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/^http/, "ws")
const ENGINE_OFFLINE = "[FATAL] ENGINE OFFLINE. CONNECTION REFUSED."

function getLogClassName(line: string): string {
  if (line.includes("[ERROR]") || line.includes("[VETO]") || line.includes("[FAIL]")) return "text-red-500"
  if (
    line.includes("[SUCCESS]") ||
    line.includes("[TRADE]") ||
    line.includes("[ALPHA]") ||
    line.includes("[EXECUTION]") ||
    line.includes("[EDGE]") ||
    line.includes("[P&L]")
  )
    return "text-emerald-500"
  return "text-white/35"
}

function formatTimestamp(): string {
  const n = new Date()
  return `[${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}:${String(n.getSeconds()).padStart(2, "0")}]`
}

/** Hoverable info tooltip — pure Tailwind, zero dependencies beyond lucide. */
function Tooltip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center ml-1.5 align-middle">
      <Info
        size={12}
        className="text-zinc-600 cursor-help group-hover:text-zinc-400 transition-colors"
      />
      <span
        className="
          absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50
          w-60 p-3 bg-zinc-900 border border-white/10 rounded-lg
          text-[11px] text-zinc-300 leading-relaxed font-normal tracking-normal
          opacity-0 group-hover:opacity-100
          pointer-events-none
          transition-opacity duration-150
          shadow-[0_8px_32px_rgba(0,0,0,0.6)]
          whitespace-normal
        "
      >
        {text}
      </span>
    </span>
  )
}

export default function DashboardPage() {
  const [proxyKey, setProxyKey] = useState("")
  const [secret, setSecret] = useState("")
  const [passphrase, setPassphrase] = useState("")
  const [polygonKey, setPolygonKey] = useState("")
  const [hasCredentials, setHasCredentials] = useState(false)
  const [isBotActive, setIsBotActive] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [currentPnl, setCurrentPnl] = useState<number | null>(null)
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [engineOffline, setEngineOffline] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const logsContainerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const scrollToBottom = useCallback(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  const handleScroll = useCallback(() => {
    const el = logsContainerRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    const atBottom = scrollHeight - scrollTop - clientHeight < 50
    setAutoScroll(atBottom)
  }, [])

  useEffect(() => {
    if (autoScroll) scrollToBottom()
  }, [logs, autoScroll, scrollToBottom])

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
    const id = setInterval(fetchStatus, 10000)
    return () => clearInterval(id)
  }, [fetchStatus])

  useEffect(() => {
    if (engineOffline) {
      setLogs((prev) => (prev.includes(ENGINE_OFFLINE) ? prev : [...prev, ENGINE_OFFLINE]))
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

        // Engine status events (HUNTING_ALPHA / SCANNING_NOISE)
        if (data.type === "status") {
          setIsThinking(!!data.isThinking)
          if (typeof data.usdcBalance === "number") {
            setUsdcBalance(data.usdcBalance)
          }
          return
        }

        // Regular log messages
        const msg = typeof data.message === "string" ? data.message : String(data.message ?? "")
        if (msg) {
          const ts = formatTimestamp()
          setLogs((prev) => [...prev.slice(-99), `${ts} ${msg}`])
        }
      } catch {
        setLogs((prev) => [...prev.slice(-99), `${formatTimestamp()} ${e.data}`])
      }
    }

    ws.onerror = () => {
      setEngineOffline(true)
      setLogs((prev) => (prev.includes(ENGINE_OFFLINE) ? prev : [...prev, ENGINE_OFFLINE]))
    }

    ws.onclose = () => {
      wsRef.current = null
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [engineOffline])

  const handleSaveCredentials = async () => {
    setSaving(true)
    setEngineOffline(false)
    try {
      const res = await fetch(`${API_BASE}/api/engine/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proxy_key: proxyKey, secret, passphrase, polygon_private_key: polygonKey }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error || "Failed to save credentials")
      } else {
        setProxyKey("")
        setSecret("")
        setPassphrase("")
        setPolygonKey("")
        setHasCredentials(true)
        toast.success("Credentials secured in Aleph vault")
      }
    } catch {
      setEngineOffline(true)
      toast.error("Engine offline")
    } finally {
      setSaving(false)
    }
  }

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

  return (
    <div className="min-h-screen bg-black text-white font-mono w-full max-w-[100vw] overflow-x-hidden">

      {/* ── Aleph Welcome Tour (first visit only) ── */}
      <TerminalWelcomeTour />

      {/* ── Navbar ── */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 py-3 bg-black/95 border-b border-white/[0.07] backdrop-blur-md">
        <AlephLogo size="sm" href="/" />

        <div className="flex items-center gap-4 sm:gap-6">
          {/* Engine status badge */}
          <div className="hidden sm:flex items-center gap-2">
            <span
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                engineOffline ? "bg-red-500" : "bg-emerald-500 animate-pulse"
              }`}
            />
            <span
              className={`text-[9px] tracking-[0.25em] transition-colors ${
                engineOffline ? "text-red-500/70" : "text-emerald-500/70"
              }`}
            >
              {engineOffline ? "ENGINE OFFLINE" : "ALEPH ONLINE"}
            </span>
          </div>

          {/* Logout */}
          <a
            href="/"
            className="
              px-4 py-2 border border-white/15 text-white/50
              text-[9px] tracking-widest
              hover:border-red-500/40 hover:text-red-400/80
              hover:shadow-[0_0_12px_rgba(239,68,68,0.15)]
              transition-all duration-200
            "
          >
            LOGOUT
          </a>
        </div>
      </header>

      {/* ── Main layout ── */}
      <main className="pt-[68px] flex min-h-screen flex-col lg:flex-row w-full">

        {/* ── LEFT SIDEBAR ── */}
        <aside className="w-full lg:w-[30%] lg:min-w-[300px] border-r border-white/[0.07] p-4 sm:p-6 flex flex-col gap-6 bg-zinc-950/50">

          {/* Aleph Status Widget */}
          <AlephStatus isActive={isBotActive} isThinking={isThinking} />

          {/* Vault credentials */}
          <div>
            <h2 className="text-[9px] tracking-[0.35em] text-emerald-500/60 mb-4 uppercase">
              Polymarket API Vault
            </h2>

            <div className="space-y-3">

              {/* Magic link to Polymarket API settings */}
              <a
                href="https://polymarket.com/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between w-full px-3 py-2.5 border border-emerald-500/30 rounded-lg bg-emerald-500/[0.04] hover:border-emerald-500/60 hover:bg-emerald-500/[0.08] transition-all group"
              >
                <span className="text-[10px] tracking-wider text-zinc-300 group-hover:text-white transition-colors">
                  Generate Polymarket API Keys
                </span>
                <ExternalLink size={13} className="text-emerald-500 flex-shrink-0" />
              </a>

              {/* Proxy Key */}
              <div>
                <label className="flex items-center text-[10px] tracking-wider text-zinc-400 mb-1.5 font-medium">
                  Proxy Key
                  <Tooltip text="Your L2 Authentication API Key. Generated automatically when you click 'Create API Key' in your Polymarket settings." />
                </label>
                <input
                  type="password"
                  value={proxyKey}
                  onChange={(e) => setProxyKey(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-3 text-white text-sm placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                />
              </div>

              {/* API Secret */}
              <div>
                <label className="flex items-center text-[10px] tracking-wider text-zinc-400 mb-1.5 font-medium">
                  API Secret
                  <Tooltip text="Your L2 HMAC-SHA256 Secret Key. Polymarket only shows this once when you create the key. Copy it carefully." />
                </label>
                <input
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-3 text-white text-sm placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                />
              </div>

              {/* Passphrase */}
              <div>
                <label className="flex items-center text-[10px] tracking-wider text-zinc-400 mb-1.5 font-medium">
                  Passphrase
                  <Tooltip text="The unique passphrase tied to your L2 API Key. Also shown only once upon creation — do not lose it." />
                </label>
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-3 text-white text-sm placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                />
              </div>

              {/* Polygon Private Key */}
              <div>
                <label className="flex items-center text-[10px] tracking-wider text-zinc-400 mb-1 font-medium">
                  Polygon Private Key
                  <Tooltip text="Your L1 Wallet Private Key. Used locally to sign EIP-712 trading messages on Polygon. It is NEVER transmitted to our servers." />
                </label>
                <input
                  type="password"
                  value={polygonKey}
                  onChange={(e) => setPolygonKey(e.target.value)}
                  placeholder="0x••••••••••••"
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-3 text-white text-sm placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                />
                <a
                  href="https://support.metamask.io/hc/en-us/articles/360015289632-How-to-export-an-account-s-private-key"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1.5 text-[9px] tracking-wider text-zinc-600 hover:text-emerald-500 transition-colors"
                >
                  How to export from MetaMask
                  <ExternalLink size={9} />
                </a>
              </div>

              <button
                onClick={handleSaveCredentials}
                disabled={saving}
                className="w-full py-3 bg-emerald-500 text-black font-bold text-xs uppercase tracking-wide rounded-lg hover:bg-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Encrypting..." : "Seal Vault"}
              </button>
            </div>
          </div>

          {/* Vault Liquidity */}
          {usdcBalance !== null && (
            <div className="flex items-center justify-between px-3 py-2.5 border border-white/[0.06] rounded-lg bg-black/30">
              <span className="text-[9px] tracking-[0.2em] text-white/30 uppercase">Vault Liquidity</span>
              <span className="text-sm font-bold font-mono text-emerald-500">${usdcBalance.toFixed(2)}</span>
            </div>
          )}

          {/* Armed / Disarmed toggle */}
          <div>
            <button
              onClick={toggleBot}
              disabled={toggling}
              className={`
                w-full py-4 font-bold text-xs uppercase tracking-wide rounded-lg
                transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                ${
                  isBotActive
                    ? "bg-emerald-500/10 border border-emerald-500 text-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.3)] hover:bg-red-500/10 hover:border-red-500 hover:text-red-400 hover:shadow-[0_0_24px_rgba(239,68,68,0.2)]"
                    : "bg-red-500/5 border border-red-500/30 text-red-400/70 hover:border-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/5 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                }
              `}
            >
              {toggling
                ? "···"
                : isBotActive
                ? "Aleph Armed & Scanning"
                : "System Disarmed"}
            </button>
          </div>
        </aside>

        {/* ── RIGHT PANEL ── */}
        <div className="flex-1 flex flex-col p-4 sm:p-6 gap-4 min-w-0 min-h-0 bg-black">

          {/* Live execution logs terminal */}
          <div className="flex-1 flex flex-col min-h-[50vh] lg:min-h-[calc(100vh-140px)] border border-white/[0.07] bg-zinc-950 overflow-hidden">

            {/* Terminal chrome bar */}
            <div className="px-4 py-2.5 border-b border-white/[0.07] flex items-center gap-2 bg-zinc-950">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
              <span className="text-[8px] tracking-[0.3em] text-white/20 ml-3 uppercase">
                Aleph · Live Execution Feed
              </span>
              {isBotActive && (
                <span className="ml-auto flex items-center gap-1.5 text-[8px] tracking-widest text-emerald-500/60">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  LIVE
                </span>
              )}
              {!autoScroll && (
                <span className="ml-auto text-[8px] text-white/20">↓ scroll to follow</span>
              )}
            </div>

            {/* Log lines */}
            <div
              ref={logsContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed"
            >
              {logs.length === 0 && !isBotActive && !engineOffline && (
                <p className="text-white/20 text-[10px] tracking-wider">
                  Agent inactive. Deploy Aleph to begin execution feed.
                </p>
              )}
              {logs.map((line, i) => (
                <div key={`${i}-${line}`} className={`py-[1px] ${getLogClassName(line)}`}>
                  {line}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>

          {/* Live PnL bar */}
          <div className="border border-white/[0.07] bg-zinc-950 px-6 py-4 flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-[8px] tracking-[0.3em] text-white/25 uppercase">
                Aleph · Realised P&L
              </span>
              <span className="text-[8px] tracking-wider text-white/15">Current session</span>
            </div>
            <span
              className={`text-3xl sm:text-4xl font-bold tracking-tight tabular-nums ${
                currentPnl !== null && currentPnl >= 0 ? "text-emerald-500" : "text-red-400"
              }`}
            >
              {currentPnl !== null ? `$${currentPnl.toFixed(2)}` : "—"}
            </span>
          </div>
        </div>
      </main>
    </div>
  )
}
