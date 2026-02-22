"use client"

import Link from "next/link"

/**
 * AlephLogo — The Singularity Mark
 *
 * SVG composition:
 *   • Central glowing emerald core dot
 *   • Inner fragmented ring — slow clockwise rotation (12s)
 *   • Outer sparser fragmented ring — slow counter-clockwise (18s)
 *   • "BLACK EDGE" in font-mono tracking-[0.3em]
 *   • "POWERED BY ALEPH" subtext in emerald-500/70
 *
 * Size variants:
 *   "sm"  — navbar usage (32px SVG)
 *   "lg"  — hero / status card usage (64px SVG)
 */

interface AlephLogoProps {
  size?: "sm" | "lg"
  href?: string
  className?: string
}

export function AlephLogo({ size = "sm", href = "/", className = "" }: AlephLogoProps) {
  const dim = size === "sm" ? 32 : 64
  const r1 = size === "sm" ? 10 : 20   // inner ring radius
  const r2 = size === "sm" ? 14 : 28   // outer ring radius
  const cx = dim / 2
  const cy = dim / 2
  const coreR = size === "sm" ? 2.5 : 5

  const logo = (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* ── Singularity SVG ── */}
      <div className="relative flex-shrink-0" style={{ width: dim, height: dim }}>
        <svg
          width={dim}
          height={dim}
          viewBox={`0 0 ${dim} ${dim}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Glow filters */}
          <defs>
            <filter id="aleph-core-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur in="SourceGraphic" stdDeviation={size === "sm" ? "1.5" : "3"} result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="aleph-ring-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation={size === "sm" ? "0.6" : "1.2"} result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Outer diffuse ambient */}
          <circle
            cx={cx}
            cy={cy}
            r={r2 + (size === "sm" ? 3 : 6)}
            fill="rgba(16,185,129,0.04)"
          />

          {/* Outer ring — counter-clockwise, sparser dashes */}
          <g
            style={{
              transformOrigin: `${cx}px ${cy}px`,
              animation: "spin-reverse 18s linear infinite",
            }}
          >
            <circle
              cx={cx}
              cy={cy}
              r={r2}
              stroke="#10b981"
              strokeWidth={size === "sm" ? "0.6" : "1.2"}
              strokeOpacity="0.45"
              strokeDasharray={`${size === "sm" ? "4 6" : "8 12"}`}
              filter="url(#aleph-ring-glow)"
            />
          </g>

          {/* Inner ring — clockwise, tighter dashes */}
          <g
            style={{
              transformOrigin: `${cx}px ${cy}px`,
              animation: "spin 12s linear infinite",
            }}
          >
            <circle
              cx={cx}
              cy={cy}
              r={r1}
              stroke="#10b981"
              strokeWidth={size === "sm" ? "0.8" : "1.6"}
              strokeOpacity="0.7"
              strokeDasharray={`${size === "sm" ? "2.5 3.5" : "5 7"}`}
              filter="url(#aleph-ring-glow)"
            />
            {/* Accent tick at 0° — shows rotation is happening */}
            <circle
              cx={cx}
              cy={cy - r1}
              r={size === "sm" ? "1" : "2"}
              fill="#10b981"
              opacity="0.9"
            />
          </g>

          {/* Core dot + glow */}
          <circle
            cx={cx}
            cy={cy}
            r={coreR * 1.8}
            fill="rgba(16,185,129,0.15)"
          />
          <circle
            cx={cx}
            cy={cy}
            r={coreR}
            fill="#10b981"
            filter="url(#aleph-core-glow)"
          />
          {/* Inner bright highlight */}
          <circle
            cx={cx - coreR * 0.3}
            cy={cy - coreR * 0.3}
            r={coreR * 0.4}
            fill="white"
            opacity="0.6"
          />
        </svg>
      </div>

      {/* ── Wordmark ── */}
      <div className="flex flex-col leading-none">
        <span
          className={`font-mono tracking-[0.3em] font-bold text-white ${
            size === "sm" ? "text-sm" : "text-2xl"
          }`}
        >
          BLACK EDGE
        </span>
        <span
          className={`font-mono tracking-[0.18em] text-emerald-500/70 ${
            size === "sm" ? "text-[8px]" : "text-xs"
          }`}
        >
          POWERED BY ALEPH
        </span>
      </div>
    </div>
  )

  return href ? (
    <Link href={href} className="hover:opacity-90 transition-opacity">
      {logo}
    </Link>
  ) : (
    logo
  )
}
