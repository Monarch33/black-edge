"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { toast } from "sonner"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
const WS_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/^http/, "ws")
const ENGINE_OFFLINE = "[FATAL] ENGINE OFFLINE. CONNECTION REFUSED."

function getLogClassName(line: string): string {
  if (line.includes("[ERROR]")) return "text-red-400"
  if (line.includes("[EXECUTION]") || line.includes("[EDGE]") || line.includes("[P&L]")) return "text-[#10b981]"
  return "text-white/50"
}

export default function DashboardPage() {
  const [proxyKey, setProxyKey] = useState("")
  const [secret, setSecret] = useState("")
  const [isBotActive, setIsBotActive] = useState(false)
  const [currentPnl, setCurrentPnl] = useState<number | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [engineOffline, setEngineOffline] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const scrollToBottom = useCallback(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [logs, scrollToBottom])

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
          setLogs((prev) => [...prev.slice(-99), msg])
        }
      } catch {
        setLogs((prev) => [...prev.slice(-99), e.data])
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

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-black/90 border-b border-white/10 backdrop-blur-sm">
        <Link href="/" className="font-bold text-base tracking-tight flex items-baseline gap-1">
          BLACK<span className="font-serif italic text-[#10b981]">EDGE</span>
        </Link>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
            <span className="text-[10px] tracking-[0.2em] text-[#10b981]">STATUS: CONNECTED</span>
          </div>
          <Link
            href="/"
            className="px-4 py-2 border border-white/20 text-white/70 hover:border-red-500/50 hover:text-red-400 text-[10px] tracking-widest transition-colors"
          >
            LOGOUT
          </Link>
        </div>
      </header>

      {/* Main layout */}
      <main className="pt-[72px] flex min-h-screen">
        {/* Left column — Configuration (30%) */}
        <aside className="w-[30%] min-w-[280px] border-r border-white/10 p-6 flex flex-col gap-8">
          <div>
            <h2 className="text-[10px] tracking-[0.3em] text-[#10b981] mb-4">API CREDENTIALS</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[9px] tracking-wider text-white/40 mb-2">Proxy Key</label>
                <input
                  type="password"
                  value={proxyKey}
                  onChange={(e) => setProxyKey(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:border-[#10b981]/50 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-[9px] tracking-wider text-white/40 mb-2">Secret</label>
                <input
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:border-[#10b981]/50 focus:outline-none transition-colors"
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

        {/* Right column — The Brain (70%) */}
        <div className="flex-1 flex flex-col p-6 gap-6">
          {/* Live Execution Logs */}
          <div className="flex-1 flex flex-col min-h-0 border border-white/10 bg-black overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500/80" />
              <div className="w-2 h-2 rounded-full bg-amber-500/80" />
              <div className="w-2 h-2 rounded-full bg-[#10b981]/80" />
              <span className="text-[9px] tracking-widest text-white/30 ml-3">LIVE EXECUTION LOGS</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
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

          {/* Live PnL */}
          <div className="border border-white/10 p-6 flex items-center justify-between">
            <span className="text-[10px] tracking-widest text-white/40">LIVE PnL</span>
            <span
              className={`text-4xl font-bold tracking-tight ${
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
