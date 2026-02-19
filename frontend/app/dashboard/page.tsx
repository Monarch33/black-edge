"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"

const FAKE_LOGS = [
  "[SCAN] Market ID 0x7a3... — Fetching orderbook",
  "[EDGE] Found 12% gap — ETH ETF Approval",
  "[COUNCIL] 4/5 agents positive — Doomer abstained",
  "[KELLY] Optimal size: 4.2% of bankroll",
  "[EXEC] Paper trade logged — YES @ 0.73",
  "[SCAN] Market ID 0x9f2... — Volume spike detected",
  "[EDGE] Found 8% gap — Fed Rate Cut Q3",
  "[COUNCIL] 3/5 agents positive — Veto overridden",
  "[SCAN] Refreshing Polymarket CLOB...",
  "[P&L] +$127.40 — 3 positions resolved",
]

export default function DashboardPage() {
  const [proxyKey, setProxyKey] = useState("")
  const [secret, setSecret] = useState("")
  const [active, setActive] = useState(false)
  const [pnl, setPnl] = useState<number | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [logs, scrollToBottom])

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/engine/status")
      const data = await res.json()
      setActive(data.active ?? false)
      setPnl(typeof data.pnl === "number" ? data.pnl : 0)
    } catch {
      setActive(false)
      setPnl(0)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const id = setInterval(fetchStatus, 10000)
    return () => clearInterval(id)
  }, [fetchStatus])

  useEffect(() => {
    if (!active) return
    const addLog = () => {
      const line = FAKE_LOGS[Math.floor(Math.random() * FAKE_LOGS.length)]
      const ts = new Date().toISOString().slice(11, 19)
      setLogs((prev) => [...prev.slice(-99), `[${ts}] ${line}`])
    }
    addLog()
    const id = setInterval(addLog, 3000)
    return () => clearInterval(id)
  }, [active])

  const handleSaveCredentials = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/engine/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proxyKey, secret }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data?.error || "Failed to save credentials")
      } else {
        setProxyKey("")
        setSecret("")
      }
    } catch {
      alert("Network error")
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async () => {
    setToggling(true)
    try {
      const res = await fetch("/api/engine/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data?.error || "Failed to toggle")
      } else {
        setActive(data.active ?? !active)
      }
    } catch {
      alert("Network error")
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
              onClick={handleToggle}
              disabled={toggling}
              className={`w-full py-6 border text-[10px] tracking-widest transition-all disabled:opacity-50 ${
                active
                  ? "bg-[#10b981]/20 border-[#10b981] text-[#10b981] shadow-[0_0_24px_rgba(16,185,129,0.3)]"
                  : "border-white/20 text-white/60 hover:border-white/40 hover:text-white"
              }`}
            >
              {toggling ? "..." : active ? "[ AGENT ACTIVE ]" : "[ ACTIVATE AUTONOMOUS AGENT ]"}
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
              {logs.length === 0 && !active && (
                <p className="text-white/30">Agent inactive. Activate to see logs.</p>
              )}
              {logs.map((line, i) => (
                <div
                  key={`${i}-${line}`}
                  className={`py-0.5 ${line.includes("[EDGE]") || line.includes("[P&L]") ? "text-[#10b981]" : "text-white/50"}`}
                >
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
                pnl !== null && pnl >= 0 ? "text-[#10b981]" : "text-red-400"
              }`}
            >
              {pnl !== null ? `$${pnl.toFixed(2)}` : "—"}
            </span>
          </div>
        </div>
      </main>
    </div>
  )
}
