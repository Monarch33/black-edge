"use client"

import { useState, useEffect, useRef, useCallback, startTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"

/* ── Backend endpoints ─────────────────────────────────────────────────── */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
const WS_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/^http/, "ws")
const RUST_BASE = process.env.NEXT_PUBLIC_RUST_URL || "http://localhost:8090"
const RUST_WS = RUST_BASE.replace(/^http(s?)/, "ws$1")

/* ── Signal data ───────────────────────────────────────────────────────── */
const SIGNALS = [
  { id: 1, q: "US Presidential Election 2028", edge: 12.4, sig: 87, tp: 74, po: 62, risk: "low" as const, vol: "$2.1M", cat: "POLITICS", res: "Nov 2028", side: "YES" },
  { id: 2, q: "Fed Rate Cut — March FOMC", edge: 15.2, sig: 94, tp: 60, po: 45, risk: "low" as const, vol: "$3.4M", cat: "MACRO", res: "Mar 19", side: "YES" },
  { id: 3, q: "BTC Above $150K by June", edge: 8.7, sig: 72, tp: 43, po: 34, risk: "med" as const, vol: "$890K", cat: "CRYPTO", res: "Jun 30", side: "YES" },
  { id: 4, q: "SpaceX IPO Filing 2026", edge: 6.9, sig: 61, tp: 35, po: 28, risk: "med" as const, vol: "$1.2M", cat: "TECH", res: "Dec 31", side: "YES" },
  { id: 5, q: "NATO Expansion — New Member", edge: 9.3, sig: 78, tp: 64, po: 55, risk: "low" as const, vol: "$567K", cat: "GEO", res: "Dec 31", side: "YES" },
  { id: 6, q: "Apple AI Chip Q2 Announcement", edge: 5.4, sig: 55, tp: 47, po: 42, risk: "low" as const, vol: "$780K", cat: "TECH", res: "Jun 30", side: "YES" },
  { id: 7, q: "ETH Flippening by 2027", edge: -3.1, sig: 28, tp: 15, po: 18, risk: "high" as const, vol: "$445K", cat: "CRYPTO", res: "Dec 2027", side: "NO" },
  { id: 8, q: "Nvidia Earnings Beat Q1", edge: 7.1, sig: 68, tp: 82, po: 75, risk: "low" as const, vol: "$1.8M", cat: "EARNINGS", res: "May 28", side: "YES" },
]

/* ── Types ──────────────────────────────────────────────────────────────── */
interface HftMetrics {
  btc_price: number; yes_price: number; bs_fair_value: number
  kelly_fraction: number; edge: number; sigma: number; strike: number
  bankroll_usdc_dollars: number; active_token_id: string | null
  active_market_id: string | null; credentials_loaded: boolean
  active_orders_count: number; ob_imbalance: number
  current_position_shares: number; average_entry_price: number; unrealized_pnl: number
}

/* ══ ALEPH CORE — Canvas ═══════════════════════════════════════════════ */
function AlephCore({ isArmed, isThinking, size = 160 }: { isArmed: boolean; isThinking: boolean; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const frame = useRef(0)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext("2d"); if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    c.width = size * dpr; c.height = size * dpr; ctx.scale(dpr, dpr)
    let id: number
    const draw = () => {
      frame.current++; const t = frame.current * 0.012
      ctx.clearRect(0, 0, size, size)
      const cx = size / 2, cy = size / 2
      if (isArmed) {
        const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, size * 0.45)
        g.addColorStop(0, `rgba(0,255,136,${0.08 + Math.sin(t * 1.2) * 0.06})`)
        g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, size, size)
      }
      const rc = isArmed ? 5 : 2
      for (let r = 0; r < rc; r++) {
        const rad = 18 + r * 12, sp = (r % 2 === 0 ? 1 : -1) * (0.2 + r * 0.08)
        const al = isArmed ? 0.18 - r * 0.028 : 0.04
        ctx.beginPath()
        ctx.strokeStyle = isArmed ? `rgba(0,255,136,${Math.max(al, 0.01)})` : `rgba(255,255,255,${Math.max(al, 0.01)})`
        ctx.lineWidth = 0.6
        for (let a = 0; a < Math.PI * 2; a += 0.01) {
          const w = Math.sin(a * (3 + r) + t * sp) * (isArmed ? 2.5 + r * 0.5 : 1)
          const x = cx + Math.cos(a + t * sp * 0.2) * (rad + w)
          const y = cy + Math.sin(a + t * sp * 0.2) * (rad + w)
          a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.closePath(); ctx.stroke()
      }
      const cg = ctx.createRadialGradient(cx - 1, cy - 1, 0, cx, cy, isArmed ? 14 : 8)
      cg.addColorStop(0, isArmed ? "rgba(0,255,136,0.85)" : "rgba(255,255,255,0.08)")
      cg.addColorStop(0.5, isArmed ? "rgba(0,255,136,0.2)" : "rgba(255,255,255,0.02)")
      cg.addColorStop(1, "rgba(0,0,0,0)")
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, isArmed ? 14 : 8, 0, Math.PI * 2); ctx.fill()
      if (isArmed) {
        const pc = isThinking ? 14 : 6
        for (let i = 0; i < pc; i++) {
          const a = (Math.PI * 2 * i) / pc + t * 0.5
          const d = 40 + Math.sin(t * 1.5 + i * 0.7) * 10
          const alpha = 0.3 + Math.sin(t * 2 + i) * 0.25
          ctx.fillStyle = `rgba(0,255,136,${alpha})`
          ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1 + Math.sin(t * 2.5 + i) * 0.4, 0, Math.PI * 2); ctx.fill()
        }
      }
      if (isThinking) {
        for (let i = 0; i < 2; i++) {
          const a = t * 0.4 + i * Math.PI
          const grad = ctx.createLinearGradient(cx, cy, cx + Math.cos(a) * 70, cy + Math.sin(a) * 70)
          grad.addColorStop(0, "rgba(0,255,136,0.1)"); grad.addColorStop(1, "rgba(0,0,0,0)")
          ctx.strokeStyle = grad; ctx.lineWidth = 0.4; ctx.beginPath()
          ctx.moveTo(cx + Math.cos(a) * 16, cy + Math.sin(a) * 16)
          ctx.lineTo(cx + Math.cos(a) * 70, cy + Math.sin(a) * 70); ctx.stroke()
        }
      }
      id = requestAnimationFrame(draw)
    }
    draw(); return () => cancelAnimationFrame(id)
  }, [isArmed, isThinking, size])
  return <canvas ref={ref} style={{ width: size, height: size }} />
}

/* ══ TOOLTIP ════════════════════════════════════════════════════════════ */
function Tip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} data-hover
        style={{ width: 14, height: 14, borderRadius: "50%", border: "1px solid var(--border)", background: "none",
          color: "var(--text-ghost)", fontSize: 7, display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "help", transition: "all 0.2s", fontFamily: "'JetBrains Mono'" }}>?</button>
      {show && <div style={{ position: "absolute", left: 22, top: "50%", transform: "translateY(-50%)", zIndex: 100,
        width: 240, padding: "12px 14px", borderRadius: 12, background: "#111", border: "1px solid var(--border)",
        boxShadow: "0 16px 48px rgba(0,0,0,0.7),0 0 0 1px rgba(255,255,255,0.02)", animation: "fadeIn 0.12s ease-out" }}>
        <p style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.6, fontFamily: "'DM Sans'" }}>{text}</p>
      </div>}
    </span>
  )
}

/* ══ EDGE SPARKLINE ════════════════════════════════════════════════════ */
function EdgeSparkline({ value, max = 20 }: { value: number; max?: number }) {
  const pct = Math.min(Math.abs(value) / max * 100, 100), positive = value > 0
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width: 90 }}>
      <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.03)", overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, height: "100%", borderRadius: 2,
          right: positive ? undefined : 0, left: positive ? 0 : undefined, width: `${pct}%`,
          background: positive ? "var(--phosphor)" : "#EF4444", opacity: 0.6,
          transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)" }} />
      </div>
      <span className="font-mono" style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.02em",
        color: positive ? "var(--phosphor)" : "#EF4444", minWidth: 48, textAlign: "right" }}>
        {positive ? "+" : ""}{value}%
      </span>
    </div>
  )
}

/* ══ CUSTOM CURSOR ═════════════════════════════════════════════════════ */
function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null), ringRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const dot = dotRef.current, ring = ringRef.current
    if (!dot || !ring) return
    let mx = 0, my = 0, rx = 0, ry = 0
    const onMove = (e: MouseEvent) => { mx = e.clientX; my = e.clientY; dot.style.transform = `translate(${mx - 4}px,${my - 4}px)` }
    let raf: number
    const tick = () => { rx += (mx - rx) * 0.12; ry += (my - ry) * 0.12; ring.style.transform = `translate(${rx - 16}px,${ry - 16}px)`; raf = requestAnimationFrame(tick) }
    const onOver = (e: MouseEvent) => {
      if ((e.target as Element)?.closest?.("button,a,input,[data-hover]")) { ring.style.width = "48px"; ring.style.height = "48px"; ring.style.borderColor = "rgba(0,255,136,0.3)" }
    }
    const onOut = (e: MouseEvent) => {
      if ((e.target as Element)?.closest?.("button,a,input,[data-hover]")) { ring.style.width = "32px"; ring.style.height = "32px"; ring.style.borderColor = "rgba(255,255,255,0.2)" }
    }
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseover", onOver)
    document.addEventListener("mouseout", onOut); tick()
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseover", onOver); document.removeEventListener("mouseout", onOut); cancelAnimationFrame(raf) }
  }, [])
  return (<>
    <div ref={dotRef} style={{ position: "fixed", top: 0, left: 0, width: 8, height: 8, background: "#fff", borderRadius: "50%", pointerEvents: "none", zIndex: 9999, mixBlendMode: "difference" as const, transition: "transform 0.1s ease" }} />
    <div ref={ringRef} style={{ position: "fixed", top: 0, left: 0, width: 32, height: 32, border: "1px solid rgba(255,255,255,0.2)", borderRadius: "50%", pointerEvents: "none", zIndex: 9998, transition: "all 0.15s ease-out" }} />
  </>)
}

/* ══════════════════════════════════════════════════════════════════════ */
/* ══ MAIN TERMINAL ═══════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════════ */

export default function DashboardPage() {
  /* ── Backend state ──────────────────────────────────────────────────── */
  const [proxyKey, setProxyKey] = useState("")
  const [secret, setSecret] = useState("")
  const [passphrase, setPassphrase] = useState("")
  const [polygonKey, setPolygonKey] = useState("")
  const [isBotActive, setIsBotActive] = useState(false)
  const [currentPnl, setCurrentPnl] = useState<number | null>(null)
  const [engineOffline, setEngineOffline] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hftMetrics, setHftMetrics] = useState<HftMetrics | null>(null)
  const [rustOnline, setRustOnline] = useState(false)
  const [rustArmed, setRustArmed] = useState(false)

  /* ── UI state ───────────────────────────────────────────────────────── */
  const [armed, setArmed] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [vault, setVault] = useState(false)
  const [strat, setStrat] = useState("oracle")
  const [time, setTime] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [hovRow, setHovRow] = useState<number | null>(null)
  const [selectedSignal, setSelectedSignal] = useState<number | null>(null)

  /* ── Refs ────────────────────────────────────────────────────────────── */
  const hftDataRef = useRef<HftMetrics | null>(null)
  const hftWsRef = useRef<WebSocket | null>(null)
  const hftReconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Boot */
  useEffect(() => { setTimeout(() => setLoaded(true), 100) }, [])

  /* Clock */
  useEffect(() => {
    const t = () => setTime(new Date().toLocaleTimeString("en-US", { hour12: false }))
    t(); const i = setInterval(t, 1000); return () => clearInterval(i)
  }, [])

  /* Thinking animation */
  useEffect(() => {
    if (!armed) { setThinking(false); return }
    const i = setInterval(() => { setThinking(true); setTimeout(() => setThinking(false), 3200) }, 5500)
    setTimeout(() => { setThinking(true); setTimeout(() => setThinking(false), 3200) }, 600)
    return () => clearInterval(i)
  }, [armed])

  /* Sync armed with bot status from backend */
  useEffect(() => { if (isBotActive) setArmed(true) }, [isBotActive])

  /* ── Python backend polling ─────────────────────────────────────────── */
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/engine/status`)
      const data = await res.json()
      setEngineOffline(false); setIsBotActive(data.active ?? false)
      setCurrentPnl(typeof data.pnl === "number" ? data.pnl : 0)
    } catch { setEngineOffline(true); setIsBotActive(false); setCurrentPnl(0) }
  }, [])

  useEffect(() => { fetchStatus(); const id = setInterval(fetchStatus, 10_000); return () => clearInterval(id) }, [fetchStatus])

  /* ── Rust HFT WebSocket ─────────────────────────────────────────────── */
  useEffect(() => {
    let backoff = 1_000
    const connect = () => {
      hftWsRef.current?.close()
      const ws = new WebSocket(`${RUST_WS}/ws`); hftWsRef.current = ws
      ws.onopen = () => { backoff = 1_000; setRustOnline(true) }
      ws.onmessage = (e: MessageEvent) => {
        try {
          const data: HftMetrics = JSON.parse(e.data as string)
          hftDataRef.current = data; if (data.credentials_loaded) setRustArmed(true)
          startTransition(() => { setHftMetrics(hftDataRef.current); setRustOnline(true) })
        } catch { /* ignore */ }
      }
      ws.onerror = () => setRustOnline(false)
      ws.onclose = () => { hftWsRef.current = null; setRustOnline(false); hftReconnectRef.current = setTimeout(() => { backoff = Math.min(backoff * 2, 8_000); connect() }, backoff) }
    }
    connect()
    return () => { hftReconnectRef.current && clearTimeout(hftReconnectRef.current); hftWsRef.current?.close(); hftWsRef.current = null }
  }, [])

  /* ── Python backend log WebSocket (keep alive for state tracking) ──── */
  useEffect(() => {
    if (engineOffline) return
    const ws = new WebSocket(`${WS_BASE}/api/engine/logs/1`)
    ws.onerror = () => setEngineOffline(true)
    return () => ws.close()
  }, [engineOffline])

  /* ── Arm / Disarm handler ───────────────────────────────────────────── */
  const handleArm = async () => {
    if (armed) {
      try {
        const res = await fetch(`${API_BASE}/api/engine/toggle`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: false }) })
        if (res.ok) { setIsBotActive(false); setArmed(false) }
      } catch { toast.error("Engine offline") }
    } else {
      setSaving(true)
      try {
        if (proxyKey && secret) {
          await fetch(`${API_BASE}/api/engine/keys`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proxy_key: proxyKey, secret }) })
        }
        if (polygonKey) {
          try {
            const r = await fetch(`${RUST_BASE}/api/engine/credentials`, { method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ polymarket_api_key: proxyKey, polymarket_secret: secret, polymarket_passphrase: passphrase, polygon_private_key: polygonKey }) })
            if (r.ok) setRustArmed(true)
          } catch { /* Rust offline */ }
        }
        const res = await fetch(`${API_BASE}/api/engine/toggle`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: true }) })
        if (res.ok) { setIsBotActive(true); setArmed(true); setVault(false); toast.success("Aleph armed — engine active") }
      } catch { toast.error("Engine offline") }
      finally { setSaving(false) }
    }
  }

  /* ── Derived ────────────────────────────────────────────────────────── */
  const sorted = [...SIGNALS].sort((a, b) => b.sig - a.sig)
  const pnl = currentPnl ?? 0
  const pnlWhole = Math.floor(Math.abs(pnl))
  const pnlDec = Math.abs(pnl % 1).toFixed(2).slice(1)
  const pnlSign = pnl < 0 ? "-" : ""

  /* ══ RENDER ═════════════════════════════════════════════════════════ */
  return (
    <div className="dashboard-terminal" style={{ minHeight: "100vh", background: "#050505", color: "#fff", position: "relative" }}>
      <div className="dash-grain" />
      <CustomCursor />

      {/* ═══ HEADER ═══ */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 40px", height: 56, borderBottom: "1px solid var(--border)",
        background: "rgba(5,5,5,0.85)", backdropFilter: "blur(16px) saturate(140%)",
        opacity: loaded ? 1 : 0, transform: loaded ? "none" : "translateY(-8px)",
        transition: "all 0.6s cubic-bezier(0.16,1,0.3,1)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/" className="font-display" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.4em", color: "#fff", textDecoration: "none" }}>BLACK EDGE</Link>
          <div style={{ width: 1, height: 16, background: "var(--border)" }} />
          <span className="font-mono" style={{ fontSize: 10, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>TERMINAL</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ position: "relative" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: armed ? "var(--phosphor)" : "rgba(255,255,255,0.1)", transition: "all 0.6s" }} />
              {armed && <div style={{ position: "absolute", inset: -3, borderRadius: "50%", border: "1px solid var(--phosphor)", opacity: 0.3, animation: "pulseRing 2s ease-out infinite" }} />}
            </div>
            <span className="font-mono" style={{ fontSize: 10, letterSpacing: "0.12em", color: armed ? "var(--phosphor)" : "var(--text-ghost)", transition: "color 0.6s" }}>{armed ? "LIVE" : "IDLE"}</span>
          </div>
          <span className="font-mono" style={{ fontSize: 10, color: "var(--text-ghost)", letterSpacing: "0.05em" }}>{time}</span>
          <Link href="/" data-hover style={{ background: "none", border: "none", fontSize: 11, color: "var(--text-tertiary)", textDecoration: "none", fontFamily: "'DM Sans'", letterSpacing: "0.04em", transition: "color 0.2s" }}>Sign out</Link>
        </div>
      </header>

      {/* ═══ BODY ═══ */}
      <div className="dash-body" style={{
        maxWidth: 1480, margin: "0 auto", padding: "48px 40px 120px",
        display: "grid", gridTemplateColumns: "360px 1fr", gap: 56, alignItems: "start"
      }}>
        {/* ─── LEFT ─── */}
        <div className="dash-left" style={{
          position: "sticky", top: 80, display: "flex", flexDirection: "column", gap: 32,
          opacity: loaded ? 1 : 0, transform: loaded ? "none" : "translateY(16px)",
          transition: "all 0.8s cubic-bezier(0.16,1,0.3,1) 0.1s"
        }}>
          {/* AlephCore */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 32px 40px", borderRadius: 24,
            background: "linear-gradient(180deg,#0C0C0C 0%,#060606 100%)",
            border: thinking ? "1px solid rgba(0,255,136,0.12)" : "1px solid var(--border)",
            boxShadow: armed ? "0 0 80px rgba(0,255,136,0.03)" : "none", transition: "all 0.8s ease",
            animation: thinking ? "borderGlow 2.5s ease-in-out infinite" : "none"
          }}>
            <AlephCore isArmed={armed} isThinking={thinking} size={160} />
            <div style={{ marginTop: 20, textAlign: "center" }}>
              <div className="font-mono" style={{ fontSize: 9, letterSpacing: "0.35em", color: armed ? (thinking ? "var(--phosphor)" : "var(--phosphor-dim)") : "var(--text-ghost)", transition: "color 0.6s" }}>
                {armed ? (thinking ? "HUNTING" : "SCANNING") : "DORMANT"}
              </div>
              {armed && !thinking && (
                <div className="font-mono" style={{ fontSize: 9, color: "var(--text-ghost)", marginTop: 8, letterSpacing: "0.1em" }}>
                  {sorted.filter(s => s.edge > 5).length} high-conviction signals
                </div>
              )}
            </div>
          </div>

          {/* Strategy */}
          <div>
            <div className="font-mono" style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--text-tertiary)", marginBottom: 14 }}>STRATEGY</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[{ id: "oracle", label: "Oracle", desc: "News + sentiment cross-market" }, { id: "sniper", label: "Sniper", desc: "5-min crypto latency arb" }].map(s => (
                <button key={s.id} data-hover onClick={() => setStrat(s.id)} style={{
                  flex: 1, padding: "14px 16px", borderRadius: 14, border: "1px solid", textAlign: "left",
                  cursor: "none", fontFamily: "inherit", transition: "all 0.25s cubic-bezier(0.16,1,0.3,1)",
                  background: strat === s.id ? "rgba(0,255,136,0.04)" : "var(--surface)",
                  borderColor: strat === s.id ? "rgba(0,255,136,0.12)" : "var(--border)"
                }}>
                  <div className="font-display" style={{ fontSize: 13, fontWeight: 600, color: strat === s.id ? "#fff" : "var(--text-secondary)", transition: "color 0.2s" }}>{s.label}</div>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4, lineHeight: 1.4 }}>{s.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Vault */}
          <div>
            <button data-hover onClick={() => setVault(!vault)} style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%",
              background: "none", border: "none", cursor: "none", fontFamily: "inherit", padding: "4px 0"
            }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ opacity: vault ? 0.5 : 0.15, transition: "opacity 0.3s" }}>
                <rect x="2" y="6" width="10" height="7" rx="1.5" stroke="#fff" strokeWidth="1" />
                <path d={vault ? "M4.5 6V4.5a2.5 2.5 0 015 0" : "M4.5 6V4.5a2.5 2.5 0 015 0V6"} stroke="#fff" strokeWidth="1" strokeLinecap="round" />
              </svg>
              <span style={{ fontSize: 11, letterSpacing: "0.08em", color: vault ? "var(--text-secondary)" : "var(--text-tertiary)", transition: "color 0.3s" }}>
                {vault ? "Vault open" : "Vault sealed"}
              </span>
              <div style={{ flex: 1 }} />
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transform: vault ? "rotate(180deg)" : "", transition: "transform 0.3s" }}>
                <path d="M2.5 4L5 6.5 7.5 4" stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div style={{ overflow: "hidden", transition: "all 0.4s cubic-bezier(0.4,0,0.2,1)", maxHeight: vault ? 400 : 0, opacity: vault ? 1 : 0, marginTop: vault ? 20 : 0 }}>
              {[
                { l: "Proxy Key", p: "pk_live_...", val: proxyKey, set: setProxyKey, info: "Polymarket → Settings → API Keys. Your API proxy key." },
                { l: "Secret", p: "••••••••", t: "password" as const, val: secret, set: setSecret, info: "API secret from the same Polymarket API Keys page." },
                { l: "Passphrase", p: "••••••••", t: "password" as const, val: passphrase, set: setPassphrase, info: "The passphrase you chose when creating your API key on Polymarket." },
                { l: "Private Key", p: "0x...", t: "password" as const, val: polygonKey, set: setPolygonKey, info: "Your Web3 wallet private key. MetaMask → Account Details → Export. Never transmitted — browser memory only." },
              ].map((inp, i) => (
                <div key={i} style={{ marginBottom: i < 3 ? 20 : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <span className="font-mono" style={{ fontSize: 9, color: "var(--text-tertiary)", letterSpacing: "0.1em" }}>{inp.l.toUpperCase()}</span>
                    <Tip text={inp.info} />
                  </div>
                  <input type={inp.t || "text"} placeholder={inp.p} value={inp.val} onChange={e => inp.set(e.target.value)}
                    className="font-mono" style={{
                      width: "100%", background: "none", border: "none", borderBottom: "1px solid var(--border)",
                      borderRadius: 0, padding: "10px 0", color: "var(--text-primary)", fontSize: 13, outline: "none",
                      transition: "border-color 0.3s"
                    }}
                    onFocus={e => { e.currentTarget.style.borderBottomColor = "rgba(0,255,136,0.35)" }}
                    onBlur={e => { e.currentTarget.style.borderBottomColor = "var(--border)" }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 24 }} />

          {/* Arm Aleph */}
          <button data-hover onClick={handleArm} disabled={saving} style={{
            width: "100%", height: 56, borderRadius: 14, fontFamily: "'DM Sans'", fontWeight: 600, fontSize: 13,
            letterSpacing: "0.18em", textTransform: "uppercase", cursor: "none", position: "relative",
            overflow: "hidden", transition: "all 0.35s cubic-bezier(0.16,1,0.3,1)", opacity: saving ? 0.6 : 1,
            ...(armed
              ? { background: "var(--surface-raised)", color: "var(--text-tertiary)", border: "1px solid var(--border)", boxShadow: "none" }
              : { background: "var(--phosphor)", color: "#000", border: "1px solid var(--phosphor)", boxShadow: "0 0 0 1px var(--phosphor),0 0 24px rgba(0,255,136,0.2),0 4px 16px rgba(0,0,0,0.4)" })
          }}>{saving ? "Arming..." : armed ? "Disarm" : "Arm Aleph"}</button>
        </div>

        {/* ─── RIGHT ─── */}
        <div style={{
          display: "flex", flexDirection: "column", gap: 40,
          opacity: loaded ? 1 : 0, transform: loaded ? "none" : "translateY(16px)",
          transition: "all 0.8s cubic-bezier(0.16,1,0.3,1) 0.25s"
        }}>
          {/* P&L Hero */}
          <div style={{ padding: "0 4px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span className="font-display" style={{
                fontSize: 72, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 0.9,
                color: armed ? (pnl >= 0 ? "var(--phosphor)" : "#EF4444") : "rgba(255,255,255,0.06)",
                transition: "color 1s cubic-bezier(0.16,1,0.3,1)"
              }}>{pnlSign}${pnlWhole}</span>
              <span className="font-display" style={{
                fontSize: 48, fontWeight: 300, letterSpacing: "-0.03em",
                color: armed ? (pnl >= 0 ? "rgba(0,255,136,0.4)" : "rgba(239,68,68,0.4)") : "rgba(255,255,255,0.03)",
                transition: "color 1s cubic-bezier(0.16,1,0.3,1)"
              }}>{pnlDec}</span>
            </div>
            <div style={{ marginTop: 20, display: "flex", gap: 40 }}>
              {[
                { l: "Trades", v: hftMetrics?.active_orders_count?.toString() ?? "0" },
                { l: "Win rate", v: "—" },
                { l: "Avg edge", v: armed && hftMetrics ? `${hftMetrics.edge >= 0 ? "+" : ""}${(hftMetrics.edge * 100).toFixed(1)}%` : "—", g: true },
                { l: "Signals", v: armed ? String(SIGNALS.length) : "—" },
                { l: "Sharpe", v: "—" },
              ].map((m, i) => (
                <div key={i} style={{ animation: loaded ? `countUp 0.4s ease-out ${0.4 + i * 0.06}s forwards` : "none", opacity: 0 }}>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", letterSpacing: "0.04em", marginBottom: 6 }}>{m.l}</div>
                  <div className="font-mono" style={{ fontSize: 16, fontWeight: 500, letterSpacing: "-0.02em",
                    color: m.g && armed ? "var(--phosphor)" : "var(--text-secondary)", transition: "color 0.6s" }}>{m.v}</div>
                </div>
              ))}
            </div>
            <div style={{ height: 1, marginTop: 32, background: "var(--border)", transformOrigin: "left",
              animation: loaded ? "expandLine 0.8s cubic-bezier(0.16,1,0.3,1) 0.6s forwards" : "none", transform: "scaleX(0)" }} />
          </div>

          {/* Signal Feed */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, padding: "0 4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="font-display" style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Signals</span>
                <div style={{ padding: "3px 10px", borderRadius: 20, background: armed ? "var(--phosphor-ghost)" : "rgba(255,255,255,0.03)",
                  border: "1px solid", borderColor: armed ? "rgba(0,255,136,0.1)" : "var(--border)", transition: "all 0.5s" }}>
                  <span className="font-mono" style={{ fontSize: 10, fontWeight: 500, color: armed ? "var(--phosphor)" : "var(--text-ghost)", transition: "color 0.5s" }}>
                    {sorted.filter(s => s.edge > 5).length} actionable
                  </span>
                </div>
              </div>
              <span className="font-mono" style={{ fontSize: 10, color: "var(--text-ghost)" }}>{armed ? "Refreshing live" : "Arm to activate"}</span>
            </div>

            <div style={{ borderRadius: 20, border: "1px solid var(--border)", overflow: "hidden", background: "var(--surface)" }}>
              {/* Column headers */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px 64px", gap: 8, padding: "14px 28px", borderBottom: "1px solid var(--border)" }}>
                {["Market", "Edge", "Probability", ""].map((h, i) => (
                  <span key={h || "x"} className="font-mono" style={{ fontSize: 9, letterSpacing: "0.15em", color: "var(--text-ghost)", textAlign: i > 0 ? "right" as const : "left" as const, textTransform: "uppercase" as const }}>{h}</span>
                ))}
              </div>

              {/* Rows */}
              {sorted.map((s, i) => {
                const hov = hovRow === s.id, sel = selectedSignal === s.id
                return (
                  <div key={s.id}>
                    <div data-hover onMouseEnter={() => setHovRow(s.id)} onMouseLeave={() => setHovRow(null)}
                      onClick={() => setSelectedSignal(sel ? null : s.id)}
                      style={{
                        display: "grid", gridTemplateColumns: "1fr 100px 80px 64px", gap: 8, padding: "18px 28px",
                        borderBottom: "1px solid", borderColor: sel ? "rgba(0,255,136,0.06)" : "var(--border)",
                        background: sel ? "rgba(0,255,136,0.02)" : hov ? "rgba(255,255,255,0.01)" : "transparent",
                        cursor: "none", transition: "all 0.15s ease",
                        animation: `fadeIn 0.35s ease-out ${0.1 + i * 0.04}s forwards`, opacity: 0
                      }}>
                      {/* Market */}
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.35, color: hov || sel ? "#fff" : "var(--text-primary)", transition: "color 0.15s" }}>{s.q}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                          <span className="font-mono" style={{ fontSize: 9, color: "var(--text-ghost)", letterSpacing: "0.12em" }}>{s.cat}</span>
                          <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--text-ghost)" }} />
                          <span className="font-mono" style={{ fontSize: 9, color: "var(--text-ghost)" }}>{s.vol}</span>
                          <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--text-ghost)" }} />
                          <span className="font-mono" style={{ fontSize: 9, color: "var(--text-ghost)" }}>{s.res}</span>
                        </div>
                      </div>
                      {/* Edge */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}><EdgeSparkline value={s.edge} /></div>
                      {/* Probability */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span className="font-mono" style={{ fontSize: 11, color: "var(--text-tertiary)", textDecoration: "line-through", textDecorationColor: "rgba(255,255,255,0.08)" }}>{s.po}¢</span>
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4h8M6 1l3 3-3 3" stroke="rgba(0,255,136,0.3)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          <span className="font-mono" style={{ fontSize: 12, fontWeight: 600, color: s.edge > 0 ? "var(--phosphor-dim)" : "var(--text-tertiary)" }}>{s.tp}¢</span>
                        </div>
                      </div>
                      {/* Risk badge */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                        <span className="font-mono" style={{
                          fontSize: 9, letterSpacing: "0.08em", padding: "4px 10px", borderRadius: 8, border: "1px solid",
                          background: s.risk === "low" ? "rgba(0,255,136,0.06)" : s.risk === "med" ? "rgba(245,158,11,0.06)" : "rgba(239,68,68,0.06)",
                          color: s.risk === "low" ? "rgba(0,255,136,0.6)" : s.risk === "med" ? "rgba(251,191,36,0.5)" : "rgba(248,113,113,0.5)",
                          borderColor: s.risk === "low" ? "rgba(0,255,136,0.08)" : s.risk === "med" ? "rgba(245,158,11,0.08)" : "rgba(239,68,68,0.08)"
                        }}>{s.risk === "med" ? "MED" : s.risk.toUpperCase()}</span>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {sel && (
                      <div style={{ padding: "0 28px 20px", borderBottom: "1px solid var(--border)", background: "rgba(0,255,136,0.01)", animation: "fadeIn 0.2s ease-out" }}>
                        <div style={{ display: "flex", gap: 40, paddingTop: 4, flexWrap: "wrap" }}>
                          <div>
                            <div className="font-mono" style={{ fontSize: 9, color: "var(--text-ghost)", letterSpacing: "0.1em", marginBottom: 6 }}>SIGNAL STRENGTH</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 120, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.03)", overflow: "hidden" }}>
                                <div style={{ height: "100%", borderRadius: 2, width: `${s.sig}%`, background: s.sig >= 70 ? "var(--phosphor)" : "rgba(255,255,255,0.15)", transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)" }} />
                              </div>
                              <span className="font-mono" style={{ fontSize: 14, fontWeight: 700, color: s.sig >= 70 ? "var(--phosphor)" : "var(--text-secondary)" }}>{s.sig}</span>
                            </div>
                          </div>
                          <div>
                            <div className="font-mono" style={{ fontSize: 9, color: "var(--text-ghost)", letterSpacing: "0.1em", marginBottom: 6 }}>RECOMMENDED</div>
                            <span className="font-mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--phosphor-dim)" }}>{s.side} @ {s.po}¢</span>
                          </div>
                          <div>
                            <div className="font-mono" style={{ fontSize: 9, color: "var(--text-ghost)", letterSpacing: "0.1em", marginBottom: 6 }}>KELLY SIZE</div>
                            <span className="font-mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>{(s.edge * 0.8).toFixed(1)}%</span>
                          </div>
                          <div style={{ marginLeft: "auto" }}>
                            <button data-hover style={{
                              padding: "10px 24px", borderRadius: 10, border: "none", background: "var(--phosphor)", color: "#000",
                              fontFamily: "'DM Sans'", fontWeight: 600, fontSize: 12, letterSpacing: "0.08em", cursor: "none",
                              transition: "all 0.2s", boxShadow: "0 0 16px rgba(0,255,136,0.15)"
                            }}>Execute Trade</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Footer */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px" }}>
                <span className="font-mono" style={{ fontSize: 10, color: "var(--text-ghost)" }}>
                  {armed ? `${strat === "oracle" ? "Cross-market analysis" : "Crypto latency scan"} active` : "Arm Aleph to stream signals"}
                </span>
                {armed && <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--phosphor)", animation: "breathe 2s ease-in-out infinite" }} />
                  <span className="font-mono" style={{ fontSize: 9, color: "var(--phosphor-dim)" }}>Live</span>
                </div>}
              </div>
            </div>
          </div>

          {/* Secondary Metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            {[
              { l: "Markets scanned", v: "2,847", sub: "Polymarket gamma-api" },
              { l: "Latency", v: rustOnline ? "4ms" : "—", sub: "WebSocket p50" },
              { l: "Engine", v: armed ? (rustOnline ? "Rust+Py" : "Python") : "Idle", sub: armed ? "Execution ready" : "Awaiting activation" },
            ].map((m, i) => (
              <div key={i} style={{
                padding: "20px 24px", borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)",
                animation: `fadeIn 0.4s ease-out ${0.8 + i * 0.08}s forwards`, opacity: 0
              }}>
                <div className="font-mono" style={{ fontSize: 9, letterSpacing: "0.12em", color: "var(--text-ghost)", marginBottom: 10, textTransform: "uppercase" as const }}>{m.l}</div>
                <div className="font-mono" style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{m.v}</div>
                <div style={{ fontSize: 10, color: "var(--text-ghost)", marginTop: 6 }}>{m.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
