// ═══════════════════════════════════════════════════════════════════════════════
// BLACK EDGE TERMINAL v3 — Awwwards-tier
//
// Typography: Syne (display) + DM Sans (body) + JetBrains Mono (data)
// Palette: #050505 bg, #00FF88 phosphor accent, surgical white opacities
// Strategies: Oracle + Sniper only
// Features: Expandable signal rows, edge sparklines, custom cursor,
//           grain overlay, staggered boot animation
// ═══════════════════════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Signal {
  id: string;
  question: string;
  edge: number;
  signalStrength: number;
  trueProb: number;
  polyOdds: number;
  risk: string;
  volume: string;
  platform: string;
  url: string;
  prediction: string;
  kellyFraction: number;
  category?: string;
  resolution_date?: string;
}

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
        {positive ? "+" : ""}{value.toFixed(1)}%
      </span>
    </div>
  );
}

// ─── GRAIN OVERLAY ───────────────────────────────────────────────────────────
const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`;

// ─── MAIN TERMINAL ───────────────────────────────────────────────────────────
export function TerminalView() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [strategy, setStrategy] = useState<"oracle" | "sniper">("oracle");
  const [time, setTime] = useState("");
  const [selectedSignal, setSelectedSignal] = useState<string | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  // Fetch signals from backend
  useEffect(() => {
    const fetchSignals = async () => {
      try {
        const response = await fetch(`${API_URL}/api/v2/signals`);
        if (response.ok) {
          const data = await response.json();
          if (data.signals && Array.isArray(data.signals)) {
            setSignals(data.signals);
          }
        }
      } catch (error) {
        console.error("Failed to fetch signals:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSignals();
    // Refresh every 30s
    const interval = setInterval(fetchSignals, 30000);
    return () => clearInterval(interval);
  }, []);

  // Clock
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-US", { hour12: false }));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, []);

  // Thinking pulses
  useEffect(() => {
    if (!armed) { setThinking(false); return; }
    const i = setInterval(() => {
      setThinking(true);
      setTimeout(() => setThinking(false), 3200);
    }, 5500);
    setTimeout(() => { setThinking(true); setTimeout(() => setThinking(false), 3200); }, 600);
    return () => clearInterval(i);
  }, [armed]);

  const sorted = [...signals].sort((a, b) => b.signalStrength - a.signalStrength);
  const actionable = sorted.filter(s => s.edge > 5).length;

  // Map backend risk to low/med/high
  const getRiskLevel = (signal: Signal): "low" | "med" | "high" => {
    const riskStr = signal.risk?.toLowerCase() || "medium";
    if (riskStr.includes("low")) return "low";
    if (riskStr.includes("high")) return "high";
    return "med";
  };

  // Get category from question or default
  const getCategory = (signal: Signal): string => {
    const q = signal.question.toLowerCase();
    if (q.includes("btc") || q.includes("bitcoin") || q.includes("eth") || q.includes("crypto")) return "CRYPTO";
    if (q.includes("election") || q.includes("president") || q.includes("trump")) return "POLITICS";
    if (q.includes("fed") || q.includes("rate") || q.includes("economy")) return "MACRO";
    if (q.includes("spacex") || q.includes("tesla") || q.includes("apple")) return "TECH";
    return signal.category || "MARKET";
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-white/50 text-sm">Loading terminal...</div>
      </div>
    );
  }

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
          <span className="text-[11px] font-bold tracking-[0.4em]" style={{ fontFamily: "Syne, sans-serif" }}>BLACK EDGE</span>
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
          <button onClick={() => signOut({ callbackUrl: "/" })} className="text-[11px] text-white/20 hover:text-white/45 transition-colors tracking-wide">
            Sign out
          </button>
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
                  <div className={`text-[13px] font-semibold transition-colors ${strategy === s.id ? "text-white" : "text-white/45"}`} style={{ fontFamily: "Syne, sans-serif" }}>
                    {s.label}
                  </div>
                  <div className="text-[10px] text-white/20 mt-1 leading-relaxed">{s.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Vault (Polymarket Keys) - Hidden for now */}
          <div style={{ display: "none" }}>
            <button onClick={() => setVaultOpen(!vaultOpen)} className="flex items-center gap-2.5 w-full group">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className={`transition-opacity ${vaultOpen ? "opacity-50" : "opacity-15"}`}>
                <rect x="2" y="6" width="10" height="7" rx="1.5" stroke="#fff" strokeWidth="1" />
                <path d={vaultOpen ? "M4.5 6V4.5a2.5 2.5 0 015 0" : "M4.5 6V4.5a2.5 2.5 0 015 0V6"} stroke="#fff" strokeWidth="1" strokeLinecap="round" />
              </svg>
              <span className={`text-[11px] tracking-[0.08em] transition-colors ${vaultOpen ? "text-white/50" : "text-white/20"}`}>
                {vaultOpen ? "Vault open" : "Vault sealed"}
              </span>
            </button>
          </div>

          {/* Spacer */}
          <div className="flex-1 min-h-6" />

          {/* ARM ALEPH */}
          <motion.button
            whileHover={armed ? {} : { y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { setArmed(!armed); if (!armed) setVaultOpen(false); }}
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
              <span className={`text-[72px] font-extrabold tracking-[-0.04em] leading-none transition-colors duration-1000 ${armed ? "text-[#00FF88]" : "text-white/[0.06]"}`} style={{ fontFamily: "Syne, sans-serif" }}>
                $0
              </span>
              <span className={`text-[48px] font-light tracking-[-0.03em] transition-colors duration-1000 ${armed ? "text-[#00FF88]/40" : "text-white/[0.03]"}`} style={{ fontFamily: "Syne, sans-serif" }}>
                .00
              </span>
            </div>
            <div className="flex gap-10 mt-5">
              {[
                { l: "Trades", v: "0" },
                { l: "Win rate", v: "—" },
                { l: "Avg edge", v: armed && signals.length > 0 ? `+${(signals.reduce((acc, s) => acc + s.edge, 0) / signals.length).toFixed(1)}%` : "—", green: true },
                { l: "Signals", v: armed ? String(signals.length) : "—" },
                { l: "Sharpe", v: "—" },
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
                <span className="text-[16px] font-semibold tracking-[-0.01em]" style={{ fontFamily: "Syne, sans-serif" }}>Signals</span>
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
              {signals.length === 0 ? (
                <div className="px-7 py-12 text-center text-white/20 text-sm">
                  {armed ? "Scanning for signals..." : "Arm Aleph to start scanning"}
                </div>
              ) : (
                sorted.map((s, i) => (
                  <SignalRow
                    key={s.id}
                    signal={s}
                    index={i}
                    isSelected={selectedSignal === s.id}
                    onSelect={() => setSelectedSignal(selectedSignal === s.id ? null : s.id)}
                    category={getCategory(s)}
                    riskLevel={getRiskLevel(s)}
                  />
                ))
              )}

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
              { l: "Markets scanned", v: String(signals.length), sub: "Polymarket gamma-api" },
              { l: "Latency", v: "4ms", sub: "WebSocket p50" },
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
  signal,
  index,
  isSelected,
  onSelect,
  category,
  riskLevel,
}: {
  signal: Signal;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  category: string;
  riskLevel: "low" | "med" | "high";
}) {
  const formatVolume = (vol: string) => {
    // Backend returns volume like "$1.7M" or number
    if (typeof vol === "string" && vol.startsWith("$")) return vol;
    return `$${Number(vol).toFixed(1)}M`;
  };

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
            {signal.question}
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="font-mono text-[9px] text-white/[0.08] tracking-[0.12em]">{category}</span>
            <span className="w-[3px] h-[3px] rounded-full bg-white/[0.06]" />
            <span className="font-mono text-[9px] text-white/[0.06]">{formatVolume(signal.volume)}</span>
            {signal.resolution_date && (
              <>
                <span className="w-[3px] h-[3px] rounded-full bg-white/[0.06]" />
                <span className="font-mono text-[9px] text-white/[0.06]">{signal.resolution_date}</span>
              </>
            )}
          </div>
        </div>

        {/* Edge sparkline */}
        <div className="flex items-center justify-end">
          <EdgeSparkline value={signal.edge} />
        </div>

        {/* Probability */}
        <div className="flex items-center justify-end gap-1.5">
          <span className="font-mono text-[11px] text-white/15 line-through decoration-white/[0.06]">{signal.polyOdds}¢</span>
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4h8M6 1l3 3-3 3" stroke="rgba(0,255,136,0.25)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className={`font-mono text-[12px] font-semibold ${signal.edge > 0 ? "text-[#00FF88]/50" : "text-white/20"}`}>{signal.trueProb}¢</span>
        </div>

        {/* Risk */}
        <div className="flex items-center justify-end">
          <span className={`font-mono text-[9px] tracking-wide px-2.5 py-1 rounded-lg border ${
            riskLevel === "low"
              ? "bg-[#00FF88]/[0.04] text-[#00FF88]/50 border-[#00FF88]/[0.06]"
              : riskLevel === "med"
              ? "bg-amber-500/[0.04] text-amber-400/40 border-amber-500/[0.06]"
              : "bg-red-500/[0.04] text-red-400/40 border-red-500/[0.06]"
          }`}>
            {riskLevel === "med" ? "MED" : riskLevel.toUpperCase()}
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
                      animate={{ width: `${signal.signalStrength}%` }}
                      className={`h-full rounded-full ${signal.signalStrength >= 70 ? "bg-[#00FF88]" : "bg-white/15"}`}
                    />
                  </div>
                  <span className={`font-mono text-[14px] font-bold ${signal.signalStrength >= 70 ? "text-[#00FF88]" : "text-white/50"}`}>{signal.signalStrength}</span>
                </div>
              </div>
              <div>
                <div className="font-mono text-[9px] text-white/[0.08] tracking-[0.1em] mb-1.5">SIDE</div>
                <span className="font-mono text-[13px] font-semibold text-[#00FF88]/60">{signal.prediction} @ {signal.polyOdds}¢</span>
              </div>
              <div>
                <div className="font-mono text-[9px] text-white/[0.08] tracking-[0.1em] mb-1.5">KELLY</div>
                <span className="font-mono text-[13px] font-semibold text-white/50">{(signal.kellyFraction * 100).toFixed(1)}%</span>
              </div>
              <div className="ml-auto">
                <motion.a
                  href={signal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  className="inline-block px-6 py-2.5 rounded-xl bg-[#00FF88] text-black font-semibold text-[12px] tracking-wide shadow-[0_0_16px_rgba(0,255,136,0.15)] hover:shadow-[0_0_32px_rgba(0,255,136,0.3)] transition-shadow"
                >
                  Trade on Polymarket
                </motion.a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default TerminalView;
