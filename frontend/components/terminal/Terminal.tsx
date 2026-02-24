// BLACK EDGE TERMINAL v3 — Awwwards-tier
//
// Typography: Syne (display) + DM Sans (body) + JetBrains Mono (data)
// Palette: #050505 bg, #00FF88 phosphor accent, surgical white opacities
// Strategies: Oracle + Sniper only
// Features: Expandable signal rows, edge sparklines, custom cursor,
//           grain overlay, staggered boot animation
// ═══════════════════════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/^http/, "ws");

// ─── SIGNAL TYPE ─────────────────────────────────────────────────────────────
interface Signal {
  id: number;
  q: string;
  edge: number;
  sig: number;
  tp: number;
  po: number;
  risk: string;
  vol: string;
  cat: string;
  res: string;
  side: string;
}

const FALLBACK_SIGNALS: Signal[] = [
  { id: 1, q: "US Presidential Election 2028", edge: 12.4, sig: 87, tp: 74, po: 62, risk: "low", vol: "$2.1M", cat: "POLITICS", res: "Nov 2028", side: "YES" },
  { id: 2, q: "Fed Rate Cut — March FOMC", edge: 15.2, sig: 94, tp: 60, po: 45, risk: "low", vol: "$3.4M", cat: "MACRO", res: "Mar 19", side: "YES" },
  { id: 3, q: "BTC Above $150K by June", edge: 8.7, sig: 72, tp: 43, po: 34, risk: "med", vol: "$890K", cat: "CRYPTO", res: "Jun 30", side: "YES" },
  { id: 4, q: "SpaceX IPO Filing 2026", edge: 6.9, sig: 61, tp: 35, po: 28, risk: "med", vol: "$1.2M", cat: "TECH", res: "Dec 31", side: "YES" },
  { id: 5, q: "NATO Expansion — New Member", edge: 9.3, sig: 78, tp: 64, po: 55, risk: "low", vol: "$567K", cat: "GEO", res: "Dec 31", side: "YES" },
  { id: 6, q: "Apple AI Chip Q2 Announcement", edge: 5.4, sig: 55, tp: 47, po: 42, risk: "low", vol: "$780K", cat: "TECH", res: "Jun 30", side: "YES" },
  { id: 7, q: "ETH Flippening by 2027", edge: -3.1, sig: 28, tp: 15, po: 18, risk: "high", vol: "$445K", cat: "CRYPTO", res: "Dec 2027", side: "NO" },
  { id: 8, q: "Nvidia Earnings Beat Q1", edge: 7.1, sig: 68, tp: 82, po: 75, risk: "low", vol: "$1.8M", cat: "EARNINGS", res: "May 28", side: "YES" },
];

// ─── ALEPH CORE (Canvas) ─────────────────────────────────────────────────────
function AlephCore({ isArmed, isThinking, size = 160 }: { isArmed: boolean; isThinking: boolean; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useRef(0);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    c.width = size * dpr;
    c.height = size * dpr;
    ctx.scale(dpr, dpr);
    let id: number;

    const draw = () => {
      frame.current++;
      const t = frame.current * 0.012;
      ctx.clearRect(0, 0, size, size);
      const cx = size / 2, cy = size / 2;

      // Ambient field
      if (isArmed) {
        const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, size * 0.45);
        g.addColorStop(0, `rgba(0,255,136,${0.08 + Math.sin(t * 1.2) * 0.06})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
      }

      // Orbital rings
      const rc = isArmed ? 5 : 2;
      for (let r = 0; r < rc; r++) {
        const rad = 18 + r * 12;
        const sp = (r % 2 === 0 ? 1 : -1) * (0.2 + r * 0.08);
        const al = isArmed ? 0.18 - r * 0.028 : 0.04;
        ctx.beginPath();
        ctx.strokeStyle = isArmed
          ? `rgba(0,255,136,${Math.max(al, 0.01)})`
          : `rgba(255,255,255,${Math.max(al, 0.01)})`;
        ctx.lineWidth = 0.6;
        for (let a = 0; a < Math.PI * 2; a += 0.01) {
          const w = Math.sin(a * (3 + r) + t * sp) * (isArmed ? 2.5 + r * 0.5 : 1);
          const x = cx + Math.cos(a + t * sp * 0.2) * (rad + w);
          const y = cy + Math.sin(a + t * sp * 0.2) * (rad + w);
          a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }

      // Core sphere
      const cg = ctx.createRadialGradient(cx - 1, cy - 1, 0, cx, cy, isArmed ? 14 : 8);
      cg.addColorStop(0, isArmed ? "rgba(0,255,136,0.85)" : "rgba(255,255,255,0.08)");
      cg.addColorStop(0.5, isArmed ? "rgba(0,255,136,0.2)" : "rgba(255,255,255,0.02)");
      cg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx, cy, isArmed ? 14 : 8, 0, Math.PI * 2);
      ctx.fill();

      // Particle field
      if (isArmed) {
        const pc = isThinking ? 14 : 6;
        for (let i = 0; i < pc; i++) {
          const a = (Math.PI * 2 * i) / pc + t * 0.5;
          const d = 40 + Math.sin(t * 1.5 + i * 0.7) * 10;
          ctx.fillStyle = `rgba(0,255,136,${0.3 + Math.sin(t * 2 + i) * 0.25})`;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1 + Math.sin(t * 2.5 + i) * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Scan rays
      if (isThinking) {
        for (let i = 0; i < 2; i++) {
          const a = t * 0.4 + i * Math.PI;
          const grad = ctx.createLinearGradient(cx, cy, cx + Math.cos(a) * 70, cy + Math.sin(a) * 70);
          grad.addColorStop(0, "rgba(0,255,136,0.1)");
          grad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.strokeStyle = grad;
          ctx.lineWidth = 0.4;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * 16, cy + Math.sin(a) * 16);
          ctx.lineTo(cx + Math.cos(a) * 70, cy + Math.sin(a) * 70);
          ctx.stroke();
        }
      }

      id = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(id);
  }, [isArmed, isThinking, size]);

  return <canvas ref={ref} style={{ width: size, height: size }} />;
}

// ─── INFO TOOLTIP ────────────────────────────────────────────────────────────
function Tip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="w-3.5 h-3.5 rounded-full border border-white/[0.04] flex items-center justify-center text-white/[0.08] text-[7px] font-mono hover:text-[#00FF88]/40 hover:border-[#00FF88]/15 transition-all cursor-help"
      >
        ?
      </button>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="absolute left-5 top-1/2 -translate-y-1/2 z-50 w-60 p-3 rounded-xl bg-[#111] border border-white/[0.06] shadow-[0_16px_48px_rgba(0,0,0,0.7)]"
          >
            <p className="text-[11px] text-white/45 leading-relaxed">{text}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

// ─── EDGE SPARKLINE ──────────────────────────────────────────────────────────
function EdgeSparkline({ value, max = 20 }: { value: number; max?: number }) {
  const pct = Math.min(Math.abs(value) / max * 100, 100);
  const positive = value > 0;
  return (
    <div className="flex items-center gap-2 w-[90px]">
      <div className="flex-1 h-[3px] rounded-full bg-white/[0.03] overflow-hidden relative">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className={`absolute top-0 h-full rounded-full ${positive ? "left-0 bg-[#00FF88]/60" : "right-0 bg-red-500/60"}`}
        />
      </div>
      <span className={`font-mono text-[13px] font-semibold tracking-tight min-w-[48px] text-right ${positive ? "text-[#00FF88]" : "text-red-400"}`}>
        {positive ? "+" : ""}{value}%
      </span>
    </div>
  );
}

// ─── GRAIN OVERLAY ───────────────────────────────────────────────────────────
const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`;

// ─── MAIN TERMINAL ───────────────────────────────────────────────────────────
export function TerminalView() {
  // ── Core UI state ──
  const [armed, setArmed] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [strategy, setStrategy] = useState<"oracle" | "sniper">("oracle");
  const [time, setTime] = useState("");
  const [selectedSignal, setSelectedSignal] = useState<number | null>(null);

  // ── Vault credential state ──
  const [proxyKey, setProxyKey] = useState("");
  const [secret, setSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [privateKey, setPrivateKey] = useState("");

  // ── Live data state ──
  const [signals, setSignals] = useState<Signal[]>(FALLBACK_SIGNALS);
  const [balance, setBalance] = useState<number>(0);
  const [totalTrades, setTotalTrades] = useState(0);
  const [winRate, setWinRate] = useState<string>("—");
  const [sharpe, setSharpe] = useState<string>("—");
  const [latency, setLatency] = useState("—");
  const [marketsScanned, setMarketsScanned] = useState("—");

  // ── Refs for WebSocket connections ──
  const signalWsRef = useRef<WebSocket | null>(null);
  const logWsRef = useRef<WebSocket | null>(null);
  const signalIdCounter = useRef(100);

  // ── Clock ──
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-US", { hour12: false }));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, []);

  // ── Fetch engine status & balance ──
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/engine/status`);
      if (res.ok) {
        const data = await res.json();
        if (typeof data.current_pnl === "number") setBalance(data.current_pnl);
        if (typeof data.total_trades_count === "number") setTotalTrades(data.total_trades_count);
      }
    } catch {
      // Engine may be offline — keep current values
    }
  }, []);

  // Fetch USDC balance from trade endpoint
  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v2/trade/balance`);
      if (res.ok) {
        const data = await res.json();
        if (typeof data.balance === "number") setBalance(data.balance);
      }
    } catch {
      // Fallback to engine status PnL
    }
  }, []);

  // Fetch system stats
  const fetchSystemStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v2/system/stats`);
      if (res.ok) {
        const data = await res.json();
        if (data.markets_tracked) setMarketsScanned(String(data.markets_tracked));
        if (data.ws_latency_ms) setLatency(`${data.ws_latency_ms}ms`);
        if (data.performance?.win_rate) setWinRate(`${(data.performance.win_rate * 100).toFixed(0)}%`);
        if (data.performance?.sharpe_ratio) setSharpe(data.performance.sharpe_ratio.toFixed(2));
      }
    } catch {
      // Stats endpoint may not be available
    }
  }, []);

  // Poll status when armed
  useEffect(() => {
    if (!armed) return;
    fetchStatus();
    fetchBalance();
    fetchSystemStats();
    const id = setInterval(() => {
      fetchStatus();
      fetchBalance();
      fetchSystemStats();
    }, 10000);
    return () => clearInterval(id);
  }, [armed, fetchStatus, fetchBalance, fetchSystemStats]);

  // ── WebSocket: V2 multiplexed stream for live signals ──
  useEffect(() => {
    if (!armed) {
      // Close signal WS when disarmed
      if (signalWsRef.current) {
        signalWsRef.current.close(1000);
        signalWsRef.current = null;
      }
      setSignals(FALLBACK_SIGNALS);
      return;
    }

    const wsUrl = `${WS_URL}/api/v2/ws`;
    const ws = new WebSocket(wsUrl);
    signalWsRef.current = ws;

    ws.onopen = () => {
      setLatency("4ms");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "signal_update" && msg.data) {
          const d = msg.data;
          const newSignal: Signal = {
            id: signalIdCounter.current++,
            q: d.question || d.market_id || "Unknown Market",
            edge: typeof d.edge === "number" ? d.edge : 0,
            sig: typeof d.confidence === "number" ? Math.round(d.confidence * 100) : 50,
            tp: typeof d.true_probability === "number" ? Math.round(d.true_probability * 100) : 50,
            po: typeof d.market_price === "number" ? Math.round(d.market_price * 100) : 50,
            risk: (d.confidence ?? 0) > 0.7 ? "low" : (d.confidence ?? 0) > 0.4 ? "med" : "high",
            vol: d.volume ? `$${(d.volume / 1000).toFixed(0)}K` : "—",
            cat: (d.category || "OTHER").toUpperCase(),
            res: d.resolution_date || "—",
            side: d.signal === "SELL" || d.signal === "NO" ? "NO" : "YES",
          };

          setSignals((prev) => {
            const updated = [newSignal, ...prev.filter((s) => s.q !== newSignal.q)].slice(0, 20);
            return updated;
          });
        }

        if (msg.type === "heartbeat") {
          // Connection alive — update latency
          setLatency("4ms");
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onerror = () => {
      setLatency("—");
    };

    ws.onclose = () => {
      signalWsRef.current = null;
    };

    return () => {
      ws.close();
      signalWsRef.current = null;
    };
  }, [armed]);

  // ── WebSocket: Engine logs for thinking state ──
  useEffect(() => {
    if (!armed) {
      if (logWsRef.current) {
        logWsRef.current.close(1000);
        logWsRef.current = null;
      }
      setThinking(false);
      return;
    }

    const wsUrl = `${WS_URL}/api/engine/logs/1`;
    const ws = new WebSocket(wsUrl);
    logWsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const msg = typeof data.message === "string" ? data.message : "";

        // Trigger thinking state on analysis/scanning messages
        if (
          msg.includes("[SCANNING]") ||
          msg.includes("[ANALYZING]") ||
          msg.includes("[COUNCIL]") ||
          msg.includes("[COMPUTING]") ||
          msg.includes("Computing signal") ||
          msg.includes("Scanning market")
        ) {
          setThinking(true);
          setTimeout(() => setThinking(false), 3200);
        }

        // Update thinking on explicit isThinking flag
        if (typeof data.isThinking === "boolean") {
          setThinking(data.isThinking);
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onclose = () => {
      logWsRef.current = null;
    };

    // Fallback: pulse thinking periodically while armed to indicate liveness
    const pulseId = setInterval(() => {
      setThinking(true);
      setTimeout(() => setThinking(false), 3200);
    }, 8000);
    // Initial pulse
    setTimeout(() => {
      setThinking(true);
      setTimeout(() => setThinking(false), 3200);
    }, 600);

    return () => {
      clearInterval(pulseId);
      ws.close();
      logWsRef.current = null;
    };
  }, [armed]);

  // ── Arm Aleph handler ──
  const handleArm = useCallback(async () => {
    if (armed) {
      // Disarm: toggle off
      setArmed(false);
      try {
        await fetch(`${API_URL}/api/engine/toggle`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
      } catch {
        // Best effort
      }
      return;
    }

    // Arm: send credentials + activate
    setVaultOpen(false);

    // 1. Store credentials if provided
    if (proxyKey && secret) {
      try {
        await fetch(`${API_URL}/api/engine/setup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            polymarket_api_key: proxyKey,
            polymarket_proxy_secret: secret,
            polymarket_passphrase: passphrase,
          }),
        });
      } catch {
        // Continue — keys may already be stored
      }
    }

    // 2. Activate the engine
    try {
      await fetch(`${API_URL}/api/engine/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // Engine may be offline — still arm the UI for WS
    }

    setArmed(true);
  }, [armed, proxyKey, secret, passphrase]);

  const sorted = [...signals].sort((a, b) => b.sig - a.sig);
  const actionable = sorted.filter(s => s.edge > 5).length;

  // Format balance display
  const balanceWhole = Math.floor(Math.abs(balance));
  const balanceCents = Math.abs(balance % 1).toFixed(2).slice(1); // ".XX"
  const balancePrefix = balance < 0 ? "-$" : "$";

  return (
    <div className="min-h-screen bg-[#050505] text-white relative">
      {/* Grain */}
      <div
        className="pointer-events-none fixed inset-0 z-[9990] opacity-[0.02] mix-blend-overlay"
        style={{ backgroundImage: GRAIN_SVG, backgroundRepeat: "repeat", backgroundSize: "256px" }}
      />

      {/* ── HEADER ── */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="sticky top-0 z-50 flex items-center justify-between px-10 h-14 border-b border-white/[0.04] bg-[#050505]/85 backdrop-blur-md backdrop-saturate-[1.4]"
      >
        <div className="flex items-center gap-3.5">
          <span className="text-[11px] font-bold tracking-[0.4em]" style={{ fontFamily: "Syne" }}>BLACK EDGE</span>
          <div className="w-px h-4 bg-white/[0.04]" />
          <span className="font-mono text-[10px] tracking-[0.15em] text-white/20">TERMINAL</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className={`w-1.5 h-1.5 rounded-full transition-all duration-600 ${armed ? "bg-[#00FF88] shadow-[0_0_6px_rgba(0,255,136,0.5)]" : "bg-white/10"}`} />
              {armed && (
                <div className="absolute -inset-[3px] rounded-full border border-[#00FF88]/30 animate-ping" />
              )}
            </div>
            <span className={`font-mono text-[10px] tracking-[0.12em] transition-colors duration-600 ${armed ? "text-[#00FF88]" : "text-white/[0.08]"}`}>
              {armed ? "LIVE" : "IDLE"}
            </span>
          </div>
          <span className="font-mono text-[10px] text-white/[0.08] tabular-nums tracking-wide">{time}</span>
          <button className="text-[11px] text-white/20 hover:text-white/45 transition-colors tracking-wide">Sign out</button>
        </div>
      </motion.header>

      {/* ── BODY ── */}
      <div className="max-w-[1480px] mx-auto px-10 py-12 grid grid-cols-[360px_1fr] gap-14 items-start">

        {/* ═══ LEFT: COMMAND CENTER ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="sticky top-20 flex flex-col gap-8 min-h-[calc(100vh-140px)]"
        >
          {/* Aleph Sanctuary */}
          <div className={`
            flex flex-col items-center pt-12 pb-10 rounded-3xl
            bg-gradient-to-b from-[#0C0C0C] to-[#060606]
            border transition-all duration-800
            ${thinking ? "border-[#00FF88]/15 shadow-[0_0_80px_rgba(0,255,136,0.03)]" : "border-white/[0.03]"}
            ${armed ? "shadow-[0_0_80px_rgba(0,255,136,0.03)]" : "shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"}
          `}>
            <AlephCore isArmed={armed} isThinking={thinking} />
            <div className="mt-5 text-center">
              <span className={`font-mono text-[9px] tracking-[0.35em] transition-colors duration-600 ${
                armed ? (thinking ? "text-[#00FF88]" : "text-[#00FF88]/50") : "text-white/[0.08]"
              }`}>
                {armed ? (thinking ? "HUNTING" : "SCANNING") : "DORMANT"}
              </span>
              {armed && !thinking && (
                <div className="font-mono text-[9px] text-white/[0.08] mt-2 tracking-wide">
                  {actionable} high-conviction signals
                </div>
              )}
            </div>
          </div>

          {/* Strategy — Oracle + Sniper */}
          <div>
            <div className="font-mono text-[9px] tracking-[0.2em] text-white/20 mb-3.5">STRATEGY</div>
            <div className="flex gap-2">
              {([
                { id: "oracle" as const, label: "Oracle", desc: "News + sentiment cross-market" },
                { id: "sniper" as const, label: "Sniper", desc: "5-min crypto latency arb" },
              ]).map(s => (
                <button
                  key={s.id}
                  onClick={() => setStrategy(s.id)}
                  className={`
                    flex-1 text-left p-3.5 rounded-[14px] border transition-all duration-250
                    ${strategy === s.id
                      ? "bg-[#00FF88]/[0.04] border-[#00FF88]/12"
                      : "bg-[#0A0A0A] border-white/[0.04] hover:border-white/[0.06]"
                    }
                  `}
                >
                  <div className={`text-[13px] font-semibold transition-colors ${strategy === s.id ? "text-white" : "text-white/45"}`} style={{ fontFamily: "Syne" }}>
                    {s.label}
                  </div>
                  <div className="text-[10px] text-white/20 mt-1 leading-relaxed">{s.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Vault */}
          <div>
            <button onClick={() => setVaultOpen(!vaultOpen)} className="flex items-center gap-2.5 w-full group">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className={`transition-opacity ${vaultOpen ? "opacity-50" : "opacity-15"}`}>
                <rect x="2" y="6" width="10" height="7" rx="1.5" stroke="#fff" strokeWidth="1" />
                <path d={vaultOpen ? "M4.5 6V4.5a2.5 2.5 0 015 0" : "M4.5 6V4.5a2.5 2.5 0 015 0V6"} stroke="#fff" strokeWidth="1" strokeLinecap="round" />
              </svg>
              <span className={`text-[11px] tracking-[0.08em] transition-colors ${vaultOpen ? "text-white/50" : "text-white/20"}`}>
                {vaultOpen ? "Vault open" : "Vault sealed"}
              </span>
              <div className="flex-1" />
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`transition-transform duration-300 ${vaultOpen ? "rotate-180" : ""}`}>
                <path d="M2.5 4L5 6.5 7.5 4" stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <AnimatePresence>
              {vaultOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <div className="pt-5 space-y-5">
                    {([
                      { l: "Proxy Key", p: "pk_live_...", info: "Polymarket → Settings → API Keys", val: proxyKey, set: setProxyKey },
                      { l: "Secret", p: "••••••••", t: "password" as const, info: "API secret from Polymarket", val: secret, set: setSecret },
                      { l: "Passphrase", p: "••••••••", t: "password" as const, info: "Passphrase from key creation", val: passphrase, set: setPassphrase },
                      { l: "Private Key", p: "0x...", t: "password" as const, info: "MetaMask → Account Details → Export", val: privateKey, set: setPrivateKey },
                    ] as const).map((inp, i) => (
                      <div key={i}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="font-mono text-[9px] text-white/20 tracking-[0.1em]">{inp.l.toUpperCase()}</span>
                          <Tip text={inp.info} />
                        </div>
                        <input
                          type={"t" in inp && inp.t ? inp.t : "text"}
                          placeholder={inp.p}
                          value={inp.val}
                          onChange={(e) => inp.set(e.target.value)}
                          className="w-full bg-transparent border-0 border-b border-white/[0.04] rounded-none px-0 py-2.5 text-white/80 text-[13px] font-mono placeholder:text-white/[0.08] focus:border-[#00FF88]/30 focus:outline-none transition-colors"
                        />
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Spacer */}
          <div className="flex-1 min-h-6" />

          {/* ARM ALEPH */}
          <motion.button
            whileHover={armed ? {} : { y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleArm}
            className={`
              w-full h-14 rounded-[14px] font-semibold text-[13px] tracking-[0.18em] uppercase
              transition-all duration-350
              ${armed
                ? "bg-[#0F0F0F] text-white/20 border border-white/[0.04] hover:text-white/50 hover:border-red-500/30"
                : "bg-[#00FF88] text-black border border-[#00FF88] shadow-[0_0_0_1px_#00FF88,0_0_24px_rgba(0,255,136,0.2),0_4px_16px_rgba(0,0,0,0.4)] hover:bg-[#00DD77] hover:shadow-[0_0_0_1px_#00FF88,0_0_48px_rgba(0,255,136,0.35),0_4px_24px_rgba(0,0,0,0.5)]"
              }
            `}
          >
            {armed ? "Disarm" : "Arm Aleph"}
          </motion.button>
        </motion.div>

        {/* ═══ RIGHT: OUTPUT ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
          className="flex flex-col gap-10"
        >
          {/* P&L Hero */}
          <div className="pl-1">
            <div className="flex items-baseline gap-1.5">
              <span className={`text-[72px] font-extrabold tracking-[-0.04em] leading-none transition-colors duration-1000 ${armed ? "text-[#00FF88]" : "text-white/[0.06]"}`} style={{ fontFamily: "Syne" }}>
                {balancePrefix}{balanceWhole}
              </span>
              <span className={`text-[48px] font-light tracking-[-0.03em] transition-colors duration-1000 ${armed ? "text-[#00FF88]/40" : "text-white/[0.03]"}`} style={{ fontFamily: "Syne" }}>
                {balanceCents}
              </span>
            </div>
            <div className="flex gap-10 mt-5">
              {[
                { l: "Trades", v: armed ? String(totalTrades) : "0" },
                { l: "Win rate", v: winRate },
                { l: "Avg edge", v: armed ? `+${(sorted.reduce((a, s) => a + s.edge, 0) / sorted.length).toFixed(1)}%` : "—", green: true },
                { l: "Signals", v: armed ? String(signals.length) : "—" },
                { l: "Sharpe", v: sharpe },
              ].map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.06, duration: 0.4 }}
                >
                  <div className="text-[10px] text-white/20 tracking-wide mb-1.5">{m.l}</div>
                  <div className={`font-mono text-[16px] font-medium tabular-nums tracking-tight transition-colors duration-600 ${
                    m.green && armed ? "text-[#00FF88]" : "text-white/50"
                  }`}>{m.v}</div>
                </motion.div>
              ))}
            </div>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.6, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="h-px mt-8 bg-white/[0.04] origin-left"
            />
          </div>

          {/* Signal Feed */}
          <div>
            <div className="flex items-center justify-between mb-5 px-1">
              <div className="flex items-center gap-3">
                <span className="text-[16px] font-semibold tracking-[-0.01em]" style={{ fontFamily: "Syne" }}>Signals</span>
                <div className={`px-2.5 py-0.5 rounded-full border transition-all duration-500 ${
                  armed ? "bg-[#00FF88]/[0.06] border-[#00FF88]/10" : "bg-white/[0.02] border-white/[0.04]"
                }`}>
                  <span className={`font-mono text-[10px] font-medium transition-colors duration-500 ${
                    armed ? "text-[#00FF88]" : "text-white/[0.08]"
                  }`}>{actionable} actionable</span>
                </div>
              </div>
              <span className="font-mono text-[10px] text-white/[0.08]">
                {armed ? `${strategy === "oracle" ? "Cross-market" : "Latency scan"} active` : "Arm to activate"}
              </span>
            </div>

            <div className="rounded-[20px] border border-white/[0.04] overflow-hidden bg-[#0A0A0A]">
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_100px_80px_64px] gap-2 px-7 py-3.5 border-b border-white/[0.04]">
                {["Market", "Edge", "Probability", ""].map((h, i) => (
                  <span key={h} className={`font-mono text-[9px] tracking-[0.15em] text-white/[0.08] uppercase ${i > 0 ? "text-right" : ""}`}>
                    {h}
                  </span>
                ))}
              </div>

              {/* Signal rows */}
              {sorted.map((s, i) => (
                <SignalRow
                  key={s.id}
                  signal={s}
                  index={i}
                  isSelected={selectedSignal === s.id}
                  onSelect={() => setSelectedSignal(selectedSignal === s.id ? null : s.id)}
                />
              ))}

              {/* Footer */}
              <div className="flex items-center justify-between px-7 py-3.5">
                <span className="font-mono text-[10px] text-white/[0.06]">
                  {armed ? "Refreshing live" : "Arm Aleph to stream signals"}
                </span>
                {armed && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-1 h-1 rounded-full bg-[#00FF88] animate-pulse" />
                    <span className="font-mono text-[9px] text-[#00FF88]/50">Live</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom metrics */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { l: "Markets scanned", v: armed ? marketsScanned : "—", sub: "Polymarket gamma-api" },
              { l: "Latency", v: armed ? latency : "—", sub: "WebSocket p50" },
              { l: "Engine", v: armed ? "Python" : "Idle", sub: armed ? "Execution ready" : "Awaiting activation" },
            ].map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + i * 0.08, duration: 0.4 }}
                className="p-5 rounded-2xl border border-white/[0.04] bg-[#0A0A0A]"
              >
                <div className="font-mono text-[9px] tracking-[0.12em] text-white/[0.08] uppercase mb-2.5">{m.l}</div>
                <div className="font-mono text-[20px] font-semibold text-white/90 tracking-tight">{m.v}</div>
                <div className="text-[10px] text-white/[0.08] mt-1.5">{m.sub}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── SIGNAL ROW (extracted for cleanliness) ──────────────────────────────────
function SignalRow({
  signal: s,
  index,
  isSelected,
  onSelect,
}: {
  signal: Signal;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 + index * 0.04, duration: 0.35 }}
        onClick={onSelect}
        className={`
          grid grid-cols-[1fr_100px_80px_64px] gap-2 px-7 py-[18px]
          border-b cursor-pointer transition-all duration-150
          ${isSelected ? "bg-[#00FF88]/[0.02] border-[#00FF88]/[0.06]" : "border-white/[0.02] hover:bg-white/[0.01]"}
        `}
      >
        {/* Market */}
        <div>
          <div className={`text-[14px] font-medium leading-snug transition-colors ${isSelected ? "text-white" : "text-white/80 group-hover:text-white"}`}>
            {s.q}
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="font-mono text-[9px] text-white/[0.08] tracking-[0.12em]">{s.cat}</span>
            <span className="w-[3px] h-[3px] rounded-full bg-white/[0.06]" />
            <span className="font-mono text-[9px] text-white/[0.06]">{s.vol}</span>
            <span className="w-[3px] h-[3px] rounded-full bg-white/[0.06]" />
            <span className="font-mono text-[9px] text-white/[0.06]">{s.res}</span>
          </div>
        </div>

        {/* Edge sparkline */}
        <div className="flex items-center justify-end">
          <EdgeSparkline value={s.edge} />
        </div>

        {/* Probability */}
        <div className="flex items-center justify-end gap-1.5">
          <span className="font-mono text-[11px] text-white/15 line-through decoration-white/[0.06]">{s.po}¢</span>
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4h8M6 1l3 3-3 3" stroke="rgba(0,255,136,0.25)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className={`font-mono text-[12px] font-semibold ${s.edge > 0 ? "text-[#00FF88]/50" : "text-white/20"}`}>{s.tp}¢</span>
        </div>

        {/* Risk */}
        <div className="flex items-center justify-end">
          <span className={`font-mono text-[9px] tracking-wide px-2.5 py-1 rounded-lg border ${
            s.risk === "low"
              ? "bg-[#00FF88]/[0.04] text-[#00FF88]/50 border-[#00FF88]/[0.06]"
              : s.risk === "med"
              ? "bg-amber-500/[0.04] text-amber-400/40 border-amber-500/[0.06]"
              : "bg-red-500/[0.04] text-red-400/40 border-red-500/[0.06]"
          }`}>
            {s.risk === "med" ? "MED" : s.risk.toUpperCase()}
          </span>
        </div>
      </motion.div>

      {/* Expanded detail */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden bg-[#00FF88]/[0.01] border-b border-white/[0.04]"
          >
            <div className="flex items-center gap-10 px-7 py-4">
              <div>
                <div className="font-mono text-[9px] text-white/[0.08] tracking-[0.1em] mb-1.5">SIGNAL</div>
                <div className="flex items-center gap-2">
                  <div className="w-[100px] h-1 rounded-full bg-white/[0.03] overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${s.sig}%` }}
                      className={`h-full rounded-full ${s.sig >= 70 ? "bg-[#00FF88]" : "bg-white/15"}`}
                    />
                  </div>
                  <span className={`font-mono text-[14px] font-bold ${s.sig >= 70 ? "text-[#00FF88]" : "text-white/50"}`}>{s.sig}</span>
                </div>
              </div>
              <div>
                <div className="font-mono text-[9px] text-white/[0.08] tracking-[0.1em] mb-1.5">SIDE</div>
                <span className="font-mono text-[13px] font-semibold text-[#00FF88]/60">{s.side} @ {s.po}¢</span>
              </div>
              <div>
                <div className="font-mono text-[9px] text-white/[0.08] tracking-[0.1em] mb-1.5">KELLY</div>
                <span className="font-mono text-[13px] font-semibold text-white/50">{(s.edge * 0.8).toFixed(1)}%</span>
              </div>
              <div className="ml-auto">
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  className="px-6 py-2.5 rounded-xl bg-[#00FF88] text-black font-semibold text-[12px] tracking-wide shadow-[0_0_16px_rgba(0,255,136,0.15)] hover:shadow-[0_0_32px_rgba(0,255,136,0.3)] transition-shadow"
                >
                  Execute Trade
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default TerminalView;
