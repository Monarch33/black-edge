"use client"

import { useEffect, useRef, useState } from "react"

/**
 * AlephStatus — The Copilot Presence Widget
 *
 * Renders a card that gives Aleph physical presence inside the Terminal:
 *   • Large breathing singularity SVG (animate-pulse + drop-shadow)
 *   • Scrolling terminal feed of live (simulated) Aleph cognition logs
 *   • Status indicator that reflects the real bot active state
 */

const FEED_LINES = [
  "> ALEPH_CORE: Online",
  "> COGNITIVE_ENGINE: Bayesian Inference Active",
  "> INGESTING: 42 Global Data Streams",
  "> SCANNING: Political Risk Index ↑2.4%",
  "> CROSS_REF: 847 Polymarket Markets Indexed",
  "> STATUS: Hunting for Alpha...",
  "> SENTIMENT_DRIFT: Detected in US Political Sector",
  "> PROBABILITY_DELTA: Recalibrating models...",
  "> KELLY_CRITERION: Calculating optimal fraction",
  "> EDGE_DETECTOR: Scanning for Δ > 15%",
  "> VOLATILITY_SURFACE: Reading options flow",
  "> ORACLE_MODULE: Querying LLM ensemble",
  "> MEMORY_SYNC: Updating priors from last cycle",
  "> ALEPH_CORE: All systems nominal",
  "> POLYMARKET_WS: Orderbook depth nominal",
  "> WATCHLIST: 12 Markets flagged for review",
  "> ALPHA_SIGNAL: Awaiting confirmation...",
  "> STATUS: Hunting for Alpha...",
]

interface AlephStatusProps {
  isActive: boolean
}

export function AlephStatus({ isActive }: AlephStatusProps) {
  const [visibleLines, setVisibleLines] = useState<string[]>([
    FEED_LINES[0],
    FEED_LINES[1],
  ])
  const feedIndexRef = useRef(2)
  const containerRef = useRef<HTMLDivElement>(null)

  // Cycle through feed lines every 1.8 seconds when active
  useEffect(() => {
    if (!isActive) return
    const id = setInterval(() => {
      const next = FEED_LINES[feedIndexRef.current % FEED_LINES.length]
      feedIndexRef.current++
      setVisibleLines((prev) => [...prev.slice(-6), next])
    }, 1800)
    return () => clearInterval(id)
  }, [isActive])

  // Auto-scroll feed
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [visibleLines])

  return (
    <div className="border border-white/10 bg-zinc-950 p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] tracking-[0.3em] text-white/40 uppercase">
          Aleph Copilot
        </span>
        <div className="flex items-center gap-2">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isActive
                ? "bg-emerald-500 animate-pulse"
                : "bg-white/20"
            }`}
          />
          <span
            className={`text-[8px] tracking-widest ${
              isActive ? "text-emerald-500" : "text-white/25"
            }`}
          >
            {isActive ? "ACTIVE" : "STANDBY"}
          </span>
        </div>
      </div>

      {/* Singularity — breathing SVG */}
      <div className="flex justify-center py-2">
        <div
          className={`relative ${isActive ? "animate-aleph-breathe" : "opacity-40"}`}
          style={{
            filter: isActive
              ? "drop-shadow(0 0 16px rgba(16,185,129,0.6)) drop-shadow(0 0 32px rgba(16,185,129,0.2))"
              : "none",
          }}
        >
          <AlephSingularitySVG size={64} animate={isActive} />
        </div>
      </div>

      {/* Terminal feed */}
      <div
        ref={containerRef}
        className="overflow-hidden flex flex-col gap-0.5 min-h-[120px] max-h-[120px]"
        aria-live="polite"
        aria-label="Aleph cognition feed"
      >
        {visibleLines.map((line, i) => {
          const isCurrent = i === visibleLines.length - 1
          return (
            <div
              key={`${i}-${line}`}
              className={`font-mono text-[10px] leading-relaxed transition-opacity duration-500 ${
                isCurrent
                  ? "text-emerald-400 animate-aleph-flicker"
                  : i === visibleLines.length - 2
                  ? "text-emerald-500/60"
                  : "text-white/20"
              }`}
            >
              {line}
              {isCurrent && isActive && (
                <span className="ml-0.5 inline-block w-1.5 h-3 bg-emerald-400 align-middle animate-pulse" />
              )}
            </div>
          )
        })}
      </div>

      {/* Divider + system stats */}
      <div className="border-t border-white/5 pt-3 grid grid-cols-3 gap-2 text-center">
        {[
          { label: "STREAMS", value: isActive ? "42" : "—" },
          { label: "MARKETS", value: isActive ? "847" : "—" },
          { label: "LATENCY", value: isActive ? "<1ms" : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-[8px] tracking-wider text-white/25">{label}</span>
            <span
              className={`text-xs font-bold font-mono ${
                isActive ? "text-emerald-500" : "text-white/20"
              }`}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared singularity SVG (reused by AlephLogo too, at large size)
// ---------------------------------------------------------------------------

function AlephSingularitySVG({
  size,
  animate,
}: {
  size: number
  animate: boolean
}) {
  const cx = size / 2
  const cy = size / 2
  const r1 = size * 0.31
  const r2 = size * 0.44
  const coreR = size * 0.08

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <filter id="as-core-glow">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="as-ring-glow">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Ambient halo */}
      <circle cx={cx} cy={cy} r={r2 + 8} fill="rgba(16,185,129,0.05)" />

      {/* Outer ring */}
      <g
        style={{
          transformOrigin: `${cx}px ${cy}px`,
          animation: animate ? "spin-reverse 18s linear infinite" : "none",
        }}
      >
        <circle
          cx={cx}
          cy={cy}
          r={r2}
          stroke="#10b981"
          strokeWidth="1"
          strokeOpacity="0.4"
          strokeDasharray="8 14"
          filter="url(#as-ring-glow)"
        />
        <circle cx={cx} cy={cy - r2} r="2" fill="#10b981" opacity="0.5" />
      </g>

      {/* Inner ring */}
      <g
        style={{
          transformOrigin: `${cx}px ${cy}px`,
          animation: animate ? "spin 12s linear infinite" : "none",
        }}
      >
        <circle
          cx={cx}
          cy={cy}
          r={r1}
          stroke="#10b981"
          strokeWidth="1.4"
          strokeOpacity="0.7"
          strokeDasharray="5 7"
          filter="url(#as-ring-glow)"
        />
        <circle cx={cx} cy={cy - r1} r="2.5" fill="#10b981" opacity="0.9" />
      </g>

      {/* Core glow layers */}
      <circle cx={cx} cy={cy} r={coreR * 2.5} fill="rgba(16,185,129,0.12)" />
      <circle cx={cx} cy={cy} r={coreR * 1.5} fill="rgba(16,185,129,0.25)" />
      <circle cx={cx} cy={cy} r={coreR} fill="#10b981" filter="url(#as-core-glow)" />
      <circle
        cx={cx - coreR * 0.3}
        cy={cy - coreR * 0.3}
        r={coreR * 0.4}
        fill="white"
        opacity="0.7"
      />
    </svg>
  )
}
