"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"

// ── STATIC SIGNAL DATA ───────────────────────────────────────────
const SIGNALS = [
  { id: 1, q: "US Presidential Election 2028", edge: 12.4, sig: 87, tp: 74, po: 62, risk: "low", vol: "$2.1M", cat: "POLITICS", res: "Nov 2028", side: "YES" },
  { id: 2, q: "Fed Rate Cut — March FOMC", edge: 15.2, sig: 94, tp: 60, po: 45, risk: "low", vol: "$3.4M", cat: "MACRO", res: "Mar 19", side: "YES" },
  { id: 3, q: "BTC Above $150K by June", edge: 8.7, sig: 72, tp: 43, po: 34, risk: "med", vol: "$890K", cat: "CRYPTO", res: "Jun 30", side: "YES" },
  { id: 4, q: "SpaceX IPO Filing 2026", edge: 6.9, sig: 61, tp: 35, po: 28, risk: "med", vol: "$1.2M", cat: "TECH", res: "Dec 31", side: "YES" },
  { id: 5, q: "NATO Expansion — New Member", edge: 9.3, sig: 78, tp: 64, po: 55, risk: "low", vol: "$567K", cat: "GEO", res: "Dec 31", side: "YES" },
  { id: 6, q: "Apple AI Chip Q2 Announcement", edge: 5.4, sig: 55, tp: 47, po: 42, risk: "low", vol: "$780K", cat: "TECH", res: "Jun 30", side: "YES" },
  { id: 7, q: "ETH Flippening by 2027", edge: -3.1, sig: 28, tp: 15, po: 18, risk: "high", vol: "$445K", cat: "CRYPTO", res: "Dec 2027", side: "NO" },
  { id: 8, q: "Nvidia Earnings Beat Q1", edge: 7.1, sig: 68, tp: 82, po: 75, risk: "low", vol: "$1.8M", cat: "EARNINGS", res: "May 28", side: "YES" },
]

// ── ALEPH CORE — Canvas ──────────────────────────────────────────
function AlephCore({ isArmed, isThinking, size = 160 }: { isArmed: boolean; isThinking: boolean; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const frame = useRef(0)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext("2d")!
    const dpr = window.devicePixelRatio || 1
    c.width = size * dpr
    c.height = size * dpr
    ctx.scale(dpr, dpr)
    let id: number

    const draw = () => {
      frame.current++
      const t = frame.current * 0.012
      ctx.clearRect(0, 0, size, size)
      const cx = size / 2, cy = size / 2

      if (isArmed) {
        const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, size * 0.45)
        g.addColorStop(0, `rgba(0,255,136,${0.08 + Math.sin(t * 1.2) * 0.06})`)
        g.addColorStop(1, "rgba(0,0,0,0)")
        ctx.fillStyle = g
        ctx.fillRect(0, 0, size, size)
      }

      const rc = isArmed ? 5 : 2
      for (let r = 0; r < rc; r++) {
        const rad = 18 + r * 12
        const sp = (r % 2 === 0 ? 1 : -1) * (0.2 + r * 0.08)
        const al = isArmed ? 0.18 - r * 0.028 : 0.04
        ctx.beginPath()
        ctx.strokeStyle = isArmed
          ? `rgba(0,255,136,${Math.max(al, 0.01)})`
          : `rgba(255,255,255,${Math.max(al, 0.01)})`
        ctx.lineWidth = 0.6
        for (let a = 0; a < Math.PI * 2; a += 0.01) {
          const w = Math.sin(a * (3 + r) + t * sp) * (isArmed ? 2.5 + r * 0.5 : 1)
          const x = cx + Math.cos(a + t * sp * 0.2) * (rad + w)
          const y = cy + Math.sin(a + t * sp * 0.2) * (rad + w)
          a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.stroke()
      }

      const cg = ctx.createRadialGradient(cx - 1, cy - 1, 0, cx, cy, isArmed ? 14 : 8)
      cg.addColorStop(0, isArmed ? "rgba(0,255,136,0.85)" : "rgba(255,255,255,0.08)")
      cg.addColorStop(0.5, isArmed ? "rgba(0,255,136,0.2)" : "rgba(255,255,255,0.02)")
      cg.addColorStop(1, "rgba(0,0,0,0)")
      ctx.fillStyle = cg
      ctx.beginPath()
      ctx.arc(cx, cy, isArmed ? 14 : 8, 0, Math.PI * 2)
      ctx.fill()

      if (isArmed) {
        const pc = isThinking ? 14 : 6
        for (let i = 0; i < pc; i++) {
          const a = (Math.PI * 2 * i) / pc + t * 0.5
          const d = 40 + Math.sin(t * 1.5 + i * 0.7) * 10
          const alpha = 0.3 + Math.sin(t * 2 + i) * 0.25
          ctx.fillStyle = `rgba(0,255,136,${alpha})`
          ctx.beginPath()
          ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1 + Math.sin(t * 2.5 + i) * 0.4, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      if (isThinking) {
        for (let i = 0; i < 2; i++) {
          const a = t * 0.4 + i * Math.PI
          const grad = ctx.createLinearGradient(cx, cy, cx + Math.cos(a) * 70, cy + Math.sin(a) * 70)
          grad.addColorStop(0, "rgba(0,255,136,0.1)")
          grad.addColorStop(1, "rgba(0,0,0,0)")
          ctx.strokeStyle = grad
          ctx.lineWidth = 0.4
          ctx.beginPath()
          ctx.moveTo(cx + Math.cos(a) * 16, cy + Math.sin(a) * 16)
          ctx.lineTo(cx + Math.cos(a) * 70, cy + Math.sin(a) * 70)
          ctx.stroke()
        }
      }

      id = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(id)
  }, [isArmed, isThinking, size])

  return <canvas ref={ref} style={{ width: size, height: size }} />
}

// ── TOOLTIP ──────────────────────────────────────────────────────
function Tip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{
          width: 14, height: 14, borderRadius: "50%", border: "1px solid var(--t-border)",
          background: "none", color: "var(--t-text-ghost)", fontSize: 7,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "help", transition: "all 0.2s", fontFamily: "'JetBrains Mono', monospace",
        }}
      >?</button>
      {show && (
        <div style={{
          position: "absolute", left: 22, top: "50%", transform: "translateY(-50%)", zIndex: 200,
          width: 240, padding: "12px 14px", borderRadius: 12, background: "#111",
          border: "1px solid var(--t-border)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.02)",
          animation: "tFadeIn 0.12s ease-out",
        }}>
          <p style={{ fontSize: 11, color: "var(--t-text-secondary)", lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>
            {text}
          </p>
        </div>
      )}
    </span>
  )
}

// ── EDGE SPARKLINE ───────────────────────────────────────────────
function EdgeSparkline({ value, max = 20 }: { value: number; max?: number }) {
  const pct = Math.min(Math.abs(value) / max * 100, 100)
  const positive = value > 0
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width: 90 }}>
      <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.03)", overflow: "hidden", position: "relative" }}>
        <div style={{
          position: "absolute", top: 0, height: "100%", borderRadius: 2,
          right: positive ? undefined : 0, left: positive ? 0 : undefined,
          width: `${pct}%`,
          background: positive ? "var(--t-phosphor)" : "#EF4444",
          opacity: 0.6, transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)",
        }} />
      </div>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: "tabular-nums",
        fontSize: 13, fontWeight: 600, letterSpacing: "-0.02em",
        color: positive ? "var(--t-phosphor)" : "#EF4444", minWidth: 48, textAlign: "right",
      }}>
        {positive ? "+" : ""}{value}%
      </span>
    </div>
  )
}

// ── MAIN PAGE ────────────────────────────────────────────────────
export default function DashboardPage() {
  const [armed, setArmed] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [vault, setVault] = useState(false)
  const [strat, setStrat] = useState<"oracle" | "sniper">("oracle")
  const [time, setTime] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [hovRow, setHovRow] = useState<number | null>(null)
  const [selectedSignal, setSelectedSignal] = useState<number | null>(null)
  const [toggling, setToggling] = useState(false)
  const [pnl, setPnl] = useState(0)
  const [totalTrades, setTotalTrades] = useState(0)
  const [armHovered, setArmHovered] = useState(false)
  // Vault credentials
  const [proxyKey, setProxyKey] = useState("")
  const [secret, setSecret] = useState("")
  const [passphrase, setPassphrase] = useState("")
  const [privateKey, setPrivateKey] = useState("")
  const [savingVault, setSavingVault] = useState(false)
  const [vaultSaved, setVaultSaved] = useState(false)

  // Boot
  useEffect(() => { setTimeout(() => setLoaded(true), 100) }, [])

  // Clock
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-US", { hour12: false }))
    tick()
    const i = setInterval(tick, 1000)
    return () => clearInterval(i)
  }, [])

  // Thinking simulation while armed
  useEffect(() => {
    if (!armed) { setThinking(false); return }
    const trigger = () => { setThinking(true); setTimeout(() => setThinking(false), 3200) }
    trigger()
    const i = setInterval(trigger, 5500)
    return () => clearInterval(i)
  }, [armed])

  // Status polling every 10s
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/engine/status")
        const data = await res.json()
        if (typeof data.active === "boolean") setArmed(data.active)
        const pnlVal = data.current_pnl ?? data.pnl
        if (typeof pnlVal === "number") setPnl(pnlVal)
        if (typeof data.total_trades_count === "number") setTotalTrades(data.total_trades_count)
      } catch { /* backend offline — keep local state */ }
    }
    poll()
    const i = setInterval(poll, 10000)
    return () => clearInterval(i)
  }, [])

  // WebSocket — live status & thinking updates
  useEffect(() => {
    const backendUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
      .replace("https://", "wss://")
      .replace("http://", "ws://")
    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout>

    const connect = () => {
      try {
        ws = new WebSocket(`${backendUrl}/api/engine/logs/1`)
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data as string)
            if (msg.type === "status") {
              if (typeof msg.isActive === "boolean") setArmed(msg.isActive)
              if (typeof msg.isThinking === "boolean") setThinking(msg.isThinking)
            }
          } catch { /* malformed message */ }
        }
        ws.onclose = () => { reconnectTimer = setTimeout(connect, 5000) }
        ws.onerror = () => { /* silent — reconnect on close */ }
      } catch { /* WS unavailable */ }
    }

    connect()
    return () => {
      clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [])

  // ARM / DISARM
  const toggleBot = useCallback(async () => {
    if (toggling) return
    setToggling(true)
    const nextArmed = !armed
    try {
      const res = await fetch("/api/engine/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active: nextArmed,
          strategy_news: strat === "oracle",
          strategy_crypto: strat === "sniper",
        }),
      })
      const data = await res.json()
      if (typeof data.active === "boolean") setArmed(data.active)
      else setArmed(nextArmed)
      if (nextArmed) setVault(false)
    } catch {
      setArmed(nextArmed) // optimistic on error
    } finally {
      setToggling(false)
    }
  }, [armed, strat, toggling])

  // SAVE VAULT
  const saveVault = useCallback(async () => {
    if (!proxyKey || !secret || savingVault) return
    setSavingVault(true)
    try {
      await fetch("/api/engine/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proxyKey, secret, passphrase, privateKey }),
      })
      setVaultSaved(true)
      setTimeout(() => setVaultSaved(false), 3000)
    } catch { /* silent */ } finally {
      setSavingVault(false)
    }
  }, [proxyKey, secret, passphrase, privateKey, savingVault])

  const sorted = [...SIGNALS].sort((a, b) => b.sig - a.sig)
  const pnlAbs = Math.abs(pnl)
  const pnlWhole = Math.floor(pnlAbs).toLocaleString()
  const pnlDec = (pnlAbs % 1).toFixed(2).slice(1) // ".XX"

  // ARM button computed styles
  const armStyle: React.CSSProperties = armed
    ? {
        background: "#0F0F0F",
        color: armHovered ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)",
        border: `1px solid ${armHovered ? "rgba(239,68,68,0.35)" : "rgba(255,255,255,0.04)"}`,
        boxShadow: "none",
        transform: "none",
      }
    : {
        background: armHovered ? "#00DD77" : "#00FF88",
        color: "#000",
        border: "1px solid #00FF88",
        boxShadow: armHovered
          ? "0 0 0 1px #00FF88, 0 0 48px rgba(0,255,136,0.35), 0 4px 24px rgba(0,0,0,0.5)"
          : "0 0 0 1px #00FF88, 0 0 24px rgba(0,255,136,0.2), 0 4px 16px rgba(0,0,0,0.4)",
        transform: armHovered ? "translateY(-1px)" : "none",
      }

  return (
    <>
      {/* Terminal-scoped CSS variables + keyframes */}
      <style>{`
        .terminal-root {
          --t-phosphor:       #00FF88;
          --t-phosphor-dim:   rgba(0,255,136,0.5);
          --t-phosphor-ghost: rgba(0,255,136,0.08);
          --t-surface:        #0A0A0A;
          --t-surface-raised: #0F0F0F;
          --t-border:         rgba(255,255,255,0.04);
          --t-text-primary:   rgba(255,255,255,0.88);
          --t-text-secondary: rgba(255,255,255,0.45);
          --t-text-tertiary:  rgba(255,255,255,0.2);
          --t-text-ghost:     rgba(255,255,255,0.08);
        }
        @keyframes tFadeIn     { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes tBreathe    { 0%,100%{opacity:0.4} 50%{opacity:1} }
        @keyframes tBorderGlow { 0%,100%{border-color:rgba(0,255,136,0.06)} 50%{border-color:rgba(0,255,136,0.18)} }
        @keyframes tExpandLine { from{transform:scaleX(0)} to{transform:scaleX(1)} }
        @keyframes tCountUp    { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes tPulseRing  { 0%{transform:scale(1);opacity:0.5} 100%{transform:scale(2.5);opacity:0} }
      `}</style>

      <div
        className="terminal-root"
        style={{ minHeight: "100vh", background: "#050505", color: "#fff", fontFamily: "'DM Sans', system-ui, sans-serif" }}
      >
        {/* ═══ HEADER ════════════════════════════════════════════════ */}
        <header style={{
          position: "sticky", top: 0, zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 40px", height: 56,
          borderBottom: "1px solid var(--t-border)",
          background: "rgba(5,5,5,0.85)", backdropFilter: "blur(16px) saturate(140%)",
          opacity: loaded ? 1 : 0, transform: loaded ? "none" : "translateY(-8px)",
          transition: "all 0.6s cubic-bezier(0.16,1,0.3,1)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.4em", color: "#fff" }}>
              BLACK EDGE
            </span>
            <div style={{ width: 1, height: 16, background: "var(--t-border)" }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.15em", color: "var(--t-text-tertiary)" }}>
              TERMINAL
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ position: "relative" }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: armed ? "var(--t-phosphor)" : "rgba(255,255,255,0.1)",
                  transition: "all 0.6s",
                }} />
                {armed && (
                  <div style={{
                    position: "absolute", inset: -3, borderRadius: "50%",
                    border: "1px solid var(--t-phosphor)", opacity: 0.3,
                    animation: "tPulseRing 2s ease-out infinite",
                  }} />
                )}
              </div>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10, letterSpacing: "0.12em",
                color: armed ? "var(--t-phosphor)" : "var(--t-text-ghost)",
                transition: "color 0.6s",
              }}>
                {armed ? "LIVE" : "IDLE"}
              </span>
            </div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--t-text-ghost)", letterSpacing: "0.05em" }}>
              {time}
            </span>
            <a
              href="/"
              style={{
                fontSize: 11, color: "var(--t-text-tertiary)", cursor: "none",
                fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.04em",
                textDecoration: "none", transition: "color 0.2s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = "var(--t-text-secondary)")}
              onMouseOut={(e) => (e.currentTarget.style.color = "var(--t-text-tertiary)")}
            >
              Sign out
            </a>
          </div>
        </header>

        {/* ═══ BODY ══════════════════════════════════════════════════ */}
        <div style={{
          maxWidth: 1480, margin: "0 auto", padding: "48px 40px 120px",
          display: "grid", gridTemplateColumns: "360px 1fr", gap: 56, alignItems: "start",
        }}>

          {/* ─── LEFT COLUMN ─────────────────────────────────────── */}
          <div style={{
            position: "sticky", top: 80,
            display: "flex", flexDirection: "column", gap: 32,
            opacity: loaded ? 1 : 0, transform: loaded ? "none" : "translateY(16px)",
            transition: "all 0.8s cubic-bezier(0.16,1,0.3,1) 0.1s",
          }}>

            {/* ALEPH SANCTUARY */}
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              padding: "48px 32px 40px", borderRadius: 24,
              background: "linear-gradient(180deg,#0C0C0C 0%,#060606 100%)",
              border: thinking ? "1px solid rgba(0,255,136,0.12)" : "1px solid var(--t-border)",
              boxShadow: armed ? "0 0 80px rgba(0,255,136,0.03)" : "none",
              transition: "all 0.8s ease",
              animation: thinking ? "tBorderGlow 2.5s ease-in-out infinite" : "none",
            }}>
              <AlephCore isArmed={armed} isThinking={thinking} size={160} />
              <div style={{ marginTop: 20, textAlign: "center" }}>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9, letterSpacing: "0.35em",
                  color: armed ? (thinking ? "var(--t-phosphor)" : "var(--t-phosphor-dim)") : "var(--t-text-ghost)",
                  transition: "color 0.6s",
                }}>
                  {armed ? (thinking ? "HUNTING" : "SCANNING") : "DORMANT"}
                </div>
                {armed && !thinking && (
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "var(--t-text-ghost)", marginTop: 8, letterSpacing: "0.1em" }}>
                    {sorted.filter((s) => s.edge > 5).length} high-conviction signals
                  </div>
                )}
              </div>
            </div>

            {/* STRATEGY */}
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.2em", color: "var(--t-text-tertiary)", marginBottom: 14 }}>
                STRATEGY
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {(["oracle", "sniper"] as const).map((id) => {
                  const label = id === "oracle" ? "Oracle" : "Sniper"
                  const desc  = id === "oracle" ? "News + sentiment cross-market" : "5-min crypto latency arb"
                  return (
                    <button
                      key={id}
                      onClick={() => !armed && setStrat(id)}
                      style={{
                        flex: 1, padding: "14px 16px", borderRadius: 14, border: "1px solid", textAlign: "left",
                        cursor: "none", fontFamily: "inherit",
                        transition: "all 0.25s cubic-bezier(0.16,1,0.3,1)",
                        background: strat === id ? "rgba(0,255,136,0.04)" : "var(--t-surface)",
                        borderColor: strat === id ? "rgba(0,255,136,0.12)" : "var(--t-border)",
                        opacity: armed ? 0.5 : 1,
                      }}
                    >
                      <div style={{
                        fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 600,
                        color: strat === id ? "#fff" : "var(--t-text-secondary)",
                        transition: "color 0.2s",
                      }}>{label}</div>
                      <div style={{ fontSize: 10, color: "var(--t-text-tertiary)", marginTop: 4, lineHeight: 1.4 }}>{desc}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* VAULT */}
            <div>
              <button
                onClick={() => setVault(!vault)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  background: "none", border: "none", cursor: "none", fontFamily: "inherit", padding: "4px 0",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ opacity: vault ? 0.5 : 0.15, transition: "opacity 0.3s" }}>
                  <rect x="2" y="6" width="10" height="7" rx="1.5" stroke="#fff" strokeWidth="1" />
                  <path
                    d={vault ? "M4.5 6V4.5a2.5 2.5 0 015 0" : "M4.5 6V4.5a2.5 2.5 0 015 0V6"}
                    stroke="#fff" strokeWidth="1" strokeLinecap="round"
                  />
                </svg>
                <span style={{ fontSize: 11, letterSpacing: "0.08em", color: vault ? "var(--t-text-secondary)" : "var(--t-text-tertiary)", transition: "color 0.3s" }}>
                  {vault ? "Vault open" : "Vault sealed"}
                </span>
                <div style={{ flex: 1 }} />
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transform: vault ? "rotate(180deg)" : "", transition: "transform 0.3s" }}>
                  <path d="M2.5 4L5 6.5 7.5 4" stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <div style={{
                overflow: "hidden",
                transition: "max-height 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.4s, margin-top 0.4s",
                maxHeight: vault ? 560 : 0, opacity: vault ? 1 : 0, marginTop: vault ? 20 : 0,
              }}>
                {([
                  { l: "Proxy Key",   p: "pk_live_...", t: "text"     as const, info: "Polymarket → Settings → API Keys",          val: proxyKey,    set: setProxyKey },
                  { l: "Secret",      p: "••••••••",    t: "password" as const, info: "API secret from Polymarket",                val: secret,      set: setSecret },
                  { l: "Passphrase",  p: "••••••••",    t: "password" as const, info: "Passphrase from key creation",              val: passphrase,  set: setPassphrase },
                  { l: "Private Key", p: "0x...",       t: "password" as const, info: "MetaMask → Account Details → Export",       val: privateKey,  set: setPrivateKey },
                ]).map((inp, i) => (
                  <div key={i} style={{ marginBottom: i < 3 ? 20 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "var(--t-text-tertiary)", letterSpacing: "0.1em" }}>
                        {inp.l.toUpperCase()}
                      </span>
                      <Tip text={inp.info} />
                    </div>
                    <input
                      type={inp.t}
                      placeholder={inp.p}
                      value={inp.val}
                      onChange={(e) => inp.set(e.target.value)}
                      style={{
                        width: "100%", background: "none", border: "none",
                        borderBottom: "1px solid var(--t-border)", borderRadius: 0,
                        padding: "10px 0", color: "var(--t-text-primary)",
                        fontFamily: "'JetBrains Mono', monospace", fontSize: 13,
                        outline: "none", transition: "border-color 0.3s",
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderBottomColor = "rgba(0,255,136,0.35)")}
                      onBlur={(e) => (e.currentTarget.style.borderBottomColor = "var(--t-border)")}
                    />
                  </div>
                ))}
                <button
                  onClick={saveVault}
                  disabled={!proxyKey || !secret || savingVault}
                  style={{
                    marginTop: 24, width: "100%", padding: "12px 0",
                    borderRadius: 10, border: "1px solid",
                    fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 12,
                    letterSpacing: "0.12em", cursor: "none",
                    transition: "all 0.25s",
                    background: vaultSaved ? "rgba(0,255,136,0.06)" : "none",
                    borderColor: vaultSaved ? "rgba(0,255,136,0.25)" : "rgba(255,255,255,0.06)",
                    color: vaultSaved ? "var(--t-phosphor)" : "var(--t-text-secondary)",
                    opacity: !proxyKey || !secret ? 0.4 : 1,
                  }}
                >
                  {savingVault ? "Sealing…" : vaultSaved ? "Credentials sealed ✓" : "Seal vault"}
                </button>
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 24 }} />

            {/* ARM / DISARM */}
            <button
              onClick={toggleBot}
              disabled={toggling}
              onMouseEnter={() => setArmHovered(true)}
              onMouseLeave={() => setArmHovered(false)}
              style={{
                width: "100%", height: 56, borderRadius: 14,
                fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13,
                letterSpacing: "0.18em", textTransform: "uppercase",
                cursor: "none", position: "relative", overflow: "hidden",
                transition: "all 0.35s cubic-bezier(0.16,1,0.3,1)",
                ...armStyle,
              }}
            >
              {toggling ? "…" : armed ? "Disarm" : "Arm Aleph"}
            </button>
          </div>

          {/* ─── RIGHT COLUMN ────────────────────────────────────── */}
          <div style={{
            display: "flex", flexDirection: "column", gap: 40,
            opacity: loaded ? 1 : 0, transform: loaded ? "none" : "translateY(16px)",
            transition: "all 0.8s cubic-bezier(0.16,1,0.3,1) 0.25s",
          }}>

            {/* P&L HERO */}
            <div style={{ padding: "0 4px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: 72, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 0.9,
                  color: armed ? (pnl >= 0 ? "var(--t-phosphor)" : "#EF4444") : "rgba(255,255,255,0.06)",
                  transition: "color 1s cubic-bezier(0.16,1,0.3,1)",
                }}>
                  {armed ? `${pnl < 0 ? "-" : ""}$${pnlWhole}` : "$0"}
                </span>
                <span style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: 48, fontWeight: 300, letterSpacing: "-0.03em",
                  color: armed
                    ? pnl >= 0 ? "rgba(0,255,136,0.4)" : "rgba(239,68,68,0.4)"
                    : "rgba(255,255,255,0.03)",
                  transition: "color 1s cubic-bezier(0.16,1,0.3,1)",
                }}>
                  {armed ? pnlDec : ".00"}
                </span>
              </div>

              <div style={{ marginTop: 20, display: "flex", gap: 40 }}>
                {[
                  { l: "Trades",   v: armed ? String(totalTrades) : "0" },
                  { l: "Win rate", v: "—" },
                  { l: "Avg edge", v: armed ? "+9.3%" : "—", g: true },
                  { l: "Signals",  v: armed ? String(SIGNALS.length) : "—" },
                  { l: "Sharpe",   v: "—" },
                ].map((m, i) => (
                  <div key={i} style={{ animation: loaded ? `tCountUp 0.4s ease-out ${0.4 + i * 0.06}s forwards` : "none", opacity: 0 }}>
                    <div style={{ fontSize: 10, color: "var(--t-text-tertiary)", letterSpacing: "0.04em", marginBottom: 6 }}>{m.l}</div>
                    <div style={{
                      fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: "tabular-nums",
                      fontSize: 16, fontWeight: 500, letterSpacing: "-0.02em",
                      color: (m as { g?: boolean }).g && armed ? "var(--t-phosphor)" : "var(--t-text-secondary)",
                      transition: "color 0.6s",
                    }}>{m.v}</div>
                  </div>
                ))}
              </div>

              <div style={{
                height: 1, marginTop: 32, background: "var(--t-border)",
                transformOrigin: "left",
                animation: loaded ? "tExpandLine 0.8s cubic-bezier(0.16,1,0.3,1) 0.6s forwards" : "none",
                transform: "scaleX(0)",
              }} />
            </div>

            {/* SIGNAL FEED */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, padding: "0 4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 600, color: "var(--t-text-primary)", letterSpacing: "-0.01em" }}>
                    Signals
                  </span>
                  <div style={{
                    padding: "3px 10px", borderRadius: 20,
                    background: armed ? "var(--t-phosphor-ghost)" : "rgba(255,255,255,0.03)",
                    border: "1px solid", borderColor: armed ? "rgba(0,255,136,0.1)" : "var(--t-border)",
                    transition: "all 0.5s",
                  }}>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10, fontWeight: 500,
                      color: armed ? "var(--t-phosphor)" : "var(--t-text-ghost)",
                      transition: "color 0.5s",
                    }}>
                      {sorted.filter((s) => s.edge > 5).length} actionable
                    </span>
                  </div>
                </div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--t-text-ghost)" }}>
                  {armed ? "Refreshing live" : "Arm to activate"}
                </span>
              </div>

              <div style={{ borderRadius: 20, border: "1px solid var(--t-border)", overflow: "hidden", background: "var(--t-surface)" }}>
                {/* Column headers */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px 64px", gap: 8, padding: "14px 28px", borderBottom: "1px solid var(--t-border)" }}>
                  {["Market", "Edge", "Probability", ""].map((h, i) => (
                    <span key={`hdr-${i}`} style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9, letterSpacing: "0.15em", color: "var(--t-text-ghost)",
                      textAlign: i > 0 ? "right" : "left", textTransform: "uppercase",
                    }}>{h}</span>
                  ))}
                </div>

                {/* Signal rows */}
                {sorted.map((s, i) => {
                  const hov = hovRow === s.id
                  const sel = selectedSignal === s.id
                  return (
                    <React.Fragment key={s.id}>
                      <div
                        onMouseEnter={() => setHovRow(s.id)}
                        onMouseLeave={() => setHovRow(null)}
                        onClick={() => setSelectedSignal(sel ? null : s.id)}
                        style={{
                          display: "grid", gridTemplateColumns: "1fr 100px 80px 64px",
                          gap: 8, padding: "18px 28px",
                          borderBottom: "1px solid", borderColor: sel ? "rgba(0,255,136,0.06)" : "var(--t-border)",
                          background: sel ? "rgba(0,255,136,0.02)" : hov ? "rgba(255,255,255,0.01)" : "transparent",
                          cursor: "none", transition: "all 0.15s ease",
                          animation: `tFadeIn 0.35s ease-out ${0.1 + i * 0.04}s forwards`, opacity: 0,
                        }}
                      >
                        {/* Market */}
                        <div>
                          <div style={{
                            fontSize: 14, fontWeight: 500, lineHeight: 1.35,
                            color: hov || sel ? "#fff" : "var(--t-text-primary)",
                            transition: "color 0.15s",
                          }}>{s.q}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "var(--t-text-ghost)", letterSpacing: "0.12em" }}>{s.cat}</span>
                            <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--t-text-ghost)", display: "inline-block" }} />
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "var(--t-text-ghost)" }}>{s.vol}</span>
                            <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--t-text-ghost)", display: "inline-block" }} />
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "var(--t-text-ghost)" }}>{s.res}</span>
                          </div>
                        </div>

                        {/* Edge */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                          <EdgeSparkline value={s.edge} />
                        </div>

                        {/* Probability */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--t-text-tertiary)", textDecoration: "line-through", textDecorationColor: "rgba(255,255,255,0.08)" }}>
                              {s.po}¢
                            </span>
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4h8M6 1l3 3-3 3" stroke="rgba(0,255,136,0.3)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: s.edge > 0 ? "var(--t-phosphor-dim)" : "var(--t-text-tertiary)" }}>
                              {s.tp}¢
                            </span>
                          </div>
                        </div>

                        {/* Risk badge */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                          <span style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 9, letterSpacing: "0.08em", padding: "4px 10px", borderRadius: 8,
                            background: s.risk === "low" ? "rgba(0,255,136,0.06)" : s.risk === "med" ? "rgba(245,158,11,0.06)" : "rgba(239,68,68,0.06)",
                            color: s.risk === "low" ? "rgba(0,255,136,0.6)" : s.risk === "med" ? "rgba(251,191,36,0.5)" : "rgba(248,113,113,0.5)",
                            border: "1px solid",
                            borderColor: s.risk === "low" ? "rgba(0,255,136,0.08)" : s.risk === "med" ? "rgba(245,158,11,0.08)" : "rgba(239,68,68,0.08)",
                          }}>
                            {s.risk === "med" ? "MED" : s.risk.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {sel && (
                        <div style={{
                          padding: "0 28px 20px", borderBottom: "1px solid var(--t-border)",
                          background: "rgba(0,255,136,0.01)", animation: "tFadeIn 0.2s ease-out",
                        }}>
                          <div style={{ display: "flex", gap: 40, paddingTop: 4, flexWrap: "wrap" }}>
                            <div>
                              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "var(--t-text-ghost)", letterSpacing: "0.1em", marginBottom: 6 }}>
                                SIGNAL STRENGTH
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 120, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.03)", overflow: "hidden" }}>
                                  <div style={{
                                    height: "100%", borderRadius: 2, width: `${s.sig}%`,
                                    background: s.sig >= 70 ? "var(--t-phosphor)" : "rgba(255,255,255,0.15)",
                                    transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)",
                                  }} />
                                </div>
                                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: s.sig >= 70 ? "var(--t-phosphor)" : "var(--t-text-secondary)" }}>
                                  {s.sig}
                                </span>
                              </div>
                            </div>
                            <div>
                              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "var(--t-text-ghost)", letterSpacing: "0.1em", marginBottom: 6 }}>
                                RECOMMENDED
                              </div>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: "var(--t-phosphor-dim)" }}>
                                {s.side} @ {s.po}¢
                              </span>
                            </div>
                            <div>
                              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "var(--t-text-ghost)", letterSpacing: "0.1em", marginBottom: 6 }}>
                                KELLY SIZE
                              </div>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: "var(--t-text-secondary)" }}>
                                {(s.edge * 0.8).toFixed(1)}%
                              </span>
                            </div>
                            <div style={{ marginLeft: "auto" }}>
                              <button
                                style={{
                                  padding: "10px 24px", borderRadius: 10, border: "none",
                                  background: "var(--t-phosphor)", color: "#000",
                                  fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 12,
                                  letterSpacing: "0.08em", cursor: "none",
                                  transition: "all 0.2s",
                                  boxShadow: "0 0 16px rgba(0,255,136,0.15)",
                                }}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.boxShadow = "0 0 32px rgba(0,255,136,0.3)"
                                  e.currentTarget.style.transform = "translateY(-1px)"
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.boxShadow = "0 0 16px rgba(0,255,136,0.15)"
                                  e.currentTarget.style.transform = "none"
                                }}
                              >
                                Execute Trade
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  )
                })}

                {/* Table footer */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--t-text-ghost)" }}>
                    {armed
                      ? `${strat === "oracle" ? "Cross-market analysis" : "Crypto latency scan"} active`
                      : "Arm Aleph to stream signals"}
                  </span>
                  {armed && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--t-phosphor)", animation: "tBreathe 2s ease-in-out infinite" }} />
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "var(--t-phosphor-dim)" }}>Live</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SECONDARY METRICS */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
              {[
                { l: "Markets scanned", v: "2,847",           sub: "Polymarket gamma-api" },
                { l: "Latency",         v: "4ms",             sub: "WebSocket p50" },
                { l: "Engine",          v: armed ? "Active" : "Idle",
                  sub: armed ? `${strat === "oracle" ? "Oracle" : "Sniper"} strategy running` : "Awaiting activation" },
              ].map((m, i) => (
                <div key={i} style={{
                  padding: "20px 24px", borderRadius: 16,
                  border: "1px solid var(--t-border)", background: "var(--t-surface)",
                  animation: `tFadeIn 0.4s ease-out ${0.8 + i * 0.08}s forwards`, opacity: 0,
                }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.12em", color: "var(--t-text-ghost)", marginBottom: 10, textTransform: "uppercase" }}>
                    {m.l}
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: "tabular-nums", fontSize: 20, fontWeight: 600, color: "var(--t-text-primary)", letterSpacing: "-0.02em" }}>
                    {m.v}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--t-text-ghost)", marginTop: 6 }}>{m.sub}</div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
