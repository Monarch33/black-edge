"use client"

import { useEffect, useState } from "react"

/**
 * TerminalWelcomeTour — Aleph speaks directly to the operator.
 *
 * Shows a 3-step overlay modal on the user's first dashboard visit.
 * State persisted in localStorage so it never appears twice.
 *
 * Aleph's voice: authoritative, slightly inhuman, deeply confident.
 */

const STORAGE_KEY = "aleph_tour_complete_v1"

interface Step {
  index: number
  eyebrow: string      // small caps label at top
  headline: string     // Aleph's primary statement
  body: string         // Aleph's explanation
  cta: string          // button label
}

const STEPS: Step[] = [
  {
    index: 0,
    eyebrow: "INITIALISING — ALEPH ONLINE",
    headline: "I am Aleph.",
    body: "The singularity of market data. I process every signal, every variable, every drift in collective probability — before the variables unfold. You have been granted operator access. Let us calibrate your connection.",
    cta: "CONTINUE →",
  },
  {
    index: 1,
    eyebrow: "STEP 01 — SECURE CONDUIT",
    headline: "Connect your Web3 Vault.",
    body: "I require a secure conduit to execute your compound yields on Polymarket. Paste your CLOB API credentials into the vault on your left. Your keys never leave this browser — they are encrypted in-memory and never stored to disk.",
    cta: "UNDERSTOOD →",
  },
  {
    index: 2,
    eyebrow: "STEP 02 — AUTONOMOUS EXECUTION",
    headline: "My parameters are set.",
    body: "I will monitor the global information noise 24 hours a day, 7 days a week. When the mathematical edge aligns — when the Kelly fraction is positive and my confidence threshold is crossed — I will strike. You may step away. I will not sleep.",
    cta: "GRANT ACCESS",
  },
]

export function TerminalWelcomeTour() {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY)
    if (!done) {
      // Brief delay so the dashboard mounts fully first
      const t = setTimeout(() => setVisible(true), 600)
      return () => clearTimeout(t)
    }
  }, [])

  const advance = () => {
    if (animating) return
    if (step < STEPS.length - 1) {
      setAnimating(true)
      setTimeout(() => {
        setStep((s) => s + 1)
        setAnimating(false)
      }, 220)
    } else {
      dismiss()
    }
  }

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1")
    setVisible(false)
  }

  if (!visible) return null

  const current = STEPS[step]

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Aleph onboarding"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/85 backdrop-blur-sm"
        onClick={dismiss}
        aria-hidden="true"
      />

      {/* Card */}
      <div
        className={`relative z-10 w-full max-w-lg mx-4 border border-emerald-500/30 bg-zinc-950 transition-opacity duration-200 ${
          animating ? "opacity-0" : "opacity-100"
        }`}
        style={{
          boxShadow:
            "0 0 60px rgba(16,185,129,0.12), 0 0 120px rgba(16,185,129,0.05), inset 0 1px 0 rgba(16,185,129,0.15)",
        }}
      >
        {/* Top scan line decoration */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />

        <div className="p-8 sm:p-10">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8">
            {STEPS.map((s) => (
              <div
                key={s.index}
                className={`h-px flex-1 transition-colors duration-300 ${
                  s.index <= step ? "bg-emerald-500" : "bg-white/10"
                }`}
              />
            ))}
          </div>

          {/* Eyebrow */}
          <p className="text-[9px] tracking-[0.35em] text-emerald-500/60 mb-4 font-mono">
            {current.eyebrow}
          </p>

          {/* Singularity mark (small, centred) */}
          <div className="flex justify-start mb-6">
            <TourSingularity />
          </div>

          {/* Headline */}
          <h2 className="font-mono text-2xl sm:text-3xl font-bold text-white tracking-tight mb-4 leading-tight">
            {current.headline}
          </h2>

          {/* Body */}
          <p className="font-mono text-sm text-white/50 leading-relaxed mb-10">
            {current.body}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-between gap-4">
            {/* CTA */}
            <button
              onClick={advance}
              className="
                flex-1 py-3 border border-emerald-500/60 text-emerald-400
                text-[10px] tracking-[0.25em] font-mono font-bold
                hover:bg-emerald-500/10 hover:border-emerald-400
                hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]
                transition-all duration-200
                active:scale-[0.98]
              "
            >
              {current.cta}
            </button>

            {/* Skip */}
            <button
              onClick={dismiss}
              className="text-[9px] tracking-widest text-white/20 hover:text-white/50 font-mono transition-colors"
            >
              SKIP
            </button>
          </div>
        </div>

        {/* Bottom decoration */}
        <div className="px-8 sm:px-10 py-3 border-t border-white/5 flex items-center justify-between">
          <span className="text-[8px] tracking-widest text-white/15 font-mono">
            ALEPH · OPERATOR ACCESS LEVEL 1
          </span>
          <span className="text-[8px] tracking-widest text-white/15 font-mono">
            {step + 1} / {STEPS.length}
          </span>
        </div>
      </div>
    </div>
  )
}

/** Tiny animated singularity SVG used inside the tour card */
function TourSingularity() {
  const size = 36
  const cx = size / 2
  const cy = size / 2

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{
        filter: "drop-shadow(0 0 8px rgba(16,185,129,0.7))",
      }}
    >
      <defs>
        <filter id="tour-glow">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="b" />
          <feComposite in="SourceGraphic" in2="b" operator="over" />
        </filter>
      </defs>

      {/* Outer ring */}
      <g
        style={{
          transformOrigin: `${cx}px ${cy}px`,
          animation: "spin-reverse 18s linear infinite",
        }}
      >
        <circle
          cx={cx}
          cy={cy}
          r="15"
          stroke="#10b981"
          strokeWidth="0.7"
          strokeOpacity="0.45"
          strokeDasharray="5 9"
        />
      </g>

      {/* Inner ring */}
      <g
        style={{
          transformOrigin: `${cx}px ${cy}px`,
          animation: "spin 12s linear infinite",
        }}
      >
        <circle
          cx={cx}
          cy={cy}
          r="10"
          stroke="#10b981"
          strokeWidth="0.9"
          strokeOpacity="0.75"
          strokeDasharray="3 4"
        />
        <circle cx={cx} cy={cy - 10} r="1.5" fill="#10b981" opacity="0.9" />
      </g>

      {/* Core */}
      <circle cx={cx} cy={cy} r="4" fill="rgba(16,185,129,0.2)" />
      <circle cx={cx} cy={cy} r="2.2" fill="#10b981" filter="url(#tour-glow)" />
      <circle cx={cx - 0.6} cy={cy - 0.6} r="0.8" fill="white" opacity="0.7" />
    </svg>
  )
}
