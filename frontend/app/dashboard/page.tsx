"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { toast } from "sonner"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
const WS_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/^http/, "ws")
const ENGINE_OFFLINE = "[FATAL] ENGINE OFFLINE. CONNECTION REFUSED."

function getLogClassName(line: string): string {
  if (line.includes("[ERROR]") || line.includes("[VETO]") || line.includes("[FAIL]")) return "text-[#ef4444]"
  if (line.includes("[SUCCESS]") || line.includes("[TRADE]") || line.includes("[ALPHA]") || line.includes("[EXECUTION]") || line.includes("[EDGE]") || line.includes("[P&L]")) return "text-[#10b981]"
  return "text-[#6b7280]"
}

function formatTimestamp(): string {
  const n = new Date()
  return `[${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}:${String(n.getSeconds()).padStart(2,"0")}]`
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
        toast.success("Credentials secured in vault")
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
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 py-4 bg-black/90 border-b border-white/10 backdrop-blur-sm">
        <Link href="/" className="font-bold text-base tracking-tight flex items-baseline gap-1">
          BLACK<span className="font-serif italic text-[#10b981]">EDGE</span>
        </Link>
        <div className="flex items-center gap-4 sm:gap-6">
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
        <aside className="w-full lg:w-[30%] lg:min-w-[280px] border-r border-white/10 p-4 sm:p-6 flex flex-col gap-8">
          <div>
            <h2 className="text-[10px] tracking-[0.3em] text-[#10b981] mb-4">POLYMARKET API CREDENTIALS</h2>
            {showVaultOnly && (
              <div className="mb-6 p-6 border border-[#10b981]/30 bg-black text-center">
                <p className="text-[#10b981] text-sm font-bold tracking-widest">VAULT ENCRYPTION REQUIRED</p>
                <p className="text-white/40 text-[10px] mt-2">Paste your Polymarket CLOB keys below to unlock the terminal.</p>
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
              <button
                onClick={handleSaveCredentials}
                disabled={saving}
                className="w-full py-3 border border-[#10b981]/50 text-[#10b981] text-[10px] tracking-widest hover:bg-[#10b981]/10 transition-colors disabled:opacity-50"
              >
                {saving ? "SAVING..." : "SAVE CREDENTIALS"}
              </button>
            </div>
          </div>

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
        </aside>

        <div className="flex-1 flex flex-col p-4 sm:p-6 gap-6 min-w-0 min-h-0">
          <div className="flex-1 flex flex-col min-h-[50vh] lg:min-h-[calc(100vh-88px)] border border-white/10 bg-black overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500/80" />
              <div className="w-2 h-2 rounded-full bg-amber-500/80" />
              <div className="w-2 h-2 rounded-full bg-[#10b981]/80" />
              <span className="text-[9px] tracking-widest text-white/30 ml-3">LIVE EXECUTION LOGS</span>
              {!autoScroll && <span className="text-[8px] text-white/30 ml-auto">Scroll to bottom to auto-follow</span>}
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
        </div>
      </main>
    </div>
  )
}
