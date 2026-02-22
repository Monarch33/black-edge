"use client"

import { useState, useEffect, useRef, useCallback } from "react"
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

export default function DashboardPage() {
  const [proxyKey, setProxyKey] = useState("")
  const [secret, setSecret] = useState("")
  const [hasCredentials, setHasCredentials] = useState(false)
  const [isBotActive, setIsBotActive] = useState(false)
  const [currentPnl, setCurrentPnl] = useState<number | null>(null)
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
        body: JSON.stringify({ proxy_key: proxyKey, secret }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error || "Failed to save credentials")
      } else {
        setProxyKey("")
        setSecret("")
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

  const showVaultOnly = !hasCredentials && !proxyKey && !secret

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
          <AlephStatus isActive={isBotActive} />

          {/* Vault credentials */}
          <div>
            <h2 className="text-[9px] tracking-[0.35em] text-emerald-500/60 mb-4 uppercase">
              Polymarket API Vault
            </h2>

            {showVaultOnly && (
              <div className="mb-5 p-5 border border-emerald-500/20 bg-emerald-500/[0.03] text-center">
                <p className="text-emerald-400 text-[10px] font-bold tracking-[0.2em] uppercase">
                  Vault Encryption Required
                </p>
                <p className="text-white/30 text-[9px] mt-2 leading-relaxed">
                  Paste your Polymarket CLOB keys below to unlock the terminal and authorise Aleph.
                </p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-[9px] tracking-wider text-white/30 mb-2">
                  Proxy Key
                </label>
                <input
                  type="password"
                  value={proxyKey}
                  onChange={(e) => setProxyKey(e.target.value)}
                  placeholder="••••••••••••"
                  className="
                    w-full px-4 py-3 bg-transparent border border-transparent border-b-white/10
                    text-white text-sm placeholder-white/15
                    focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/20
                    transition-colors
                  "
                />
              </div>
              <div>
                <label className="block text-[9px] tracking-wider text-white/30 mb-2">
                  Secret
                </label>
                <input
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="••••••••••••"
                  className="
                    w-full px-4 py-3 bg-transparent border border-transparent border-b-white/10
                    text-white text-sm placeholder-white/15
                    focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/20
                    transition-colors
                  "
                />
              </div>
              <button
                onClick={handleSaveCredentials}
                disabled={saving}
                className="
                  w-full py-3 border border-emerald-500/40 text-emerald-400
                  text-[10px] tracking-[0.25em]
                  hover:bg-emerald-500/10 hover:border-emerald-400
                  hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]
                  transition-all duration-200
                  disabled:opacity-40 disabled:cursor-not-allowed
                "
              >
                {saving ? "ENCRYPTING..." : "SECURE CREDENTIALS"}
              </button>
            </div>
          </div>

          {/* Deploy / halt Aleph */}
          <div>
            <button
              onClick={toggleBot}
              disabled={toggling}
              className={`
                w-full py-5 border text-[10px] tracking-[0.2em] font-bold
                transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed
                ${
                  isBotActive
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.25)]"
                    : "border-white/15 text-white/50 hover:border-emerald-500/40 hover:text-emerald-400/70 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                }
              `}
            >
              {toggling ? "···" : isBotActive ? "[ ALEPH ACTIVE — CLICK TO HALT ]" : "[ DEPLOY ALEPH ]"}
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
