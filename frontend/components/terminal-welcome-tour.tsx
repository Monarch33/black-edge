"use client"

import { useState, useEffect } from "react"
import { X, Cpu, Wallet, TrendingUp, ChevronRight } from "lucide-react"

const TOUR_KEY = "be_tour_v1"

interface Step {
  icon: React.ReactNode
  tag: string
  title: string
  body: string
  cta: string
  position: "center" | "right" | "left"
}

const STEPS: Step[] = [
  {
    icon: <Cpu size={28} className="text-emerald-400" />,
    tag: "WELCOME",
    title: "Welcome to Black Edge.",
    body: "Let's get your autopilot ready. This terminal gives you real-time access to the AI Council's analysis and autonomous trade execution — powered by your own wallet.",
    cta: "Let's go",
    position: "center",
  },
  {
    icon: <Wallet size={28} className="text-violet-400" />,
    tag: "STEP 1 OF 2",
    title: "Connect your secure Wallet.",
    body: "Your wallet is where your funds and profits live — safely on the Polygon blockchain, under your full control. No one can access it but you. Connect it in the sidebar to enable execution.",
    cta: "Got it",
    position: "right",
  },
  {
    icon: <TrendingUp size={28} className="text-emerald-400" />,
    tag: "STEP 2 OF 2",
    title: "Let the AI work for you.",
    body: "The AI Council scans the market 24/7. When the edge turns green, the bot executes automatically — sized by the Kelly Criterion to protect your bankroll. You can activate or pause it at any time.",
    cta: "Start Trading →",
    position: "left",
  },
]

const POSITION_CLASSES: Record<Step["position"], string> = {
  center: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
  right: "top-1/2 right-8 -translate-y-1/2 max-w-sm",
  left: "top-1/2 left-8 -translate-y-1/2 max-w-sm",
}

export function TerminalWelcomeTour() {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(TOUR_KEY)) setVisible(true)
    } catch {
      // localStorage unavailable in some SSR contexts — safe to ignore
    }
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(TOUR_KEY, "1")
    } catch {}
    setVisible(false)
  }

  const next = () => {
    if (step >= STEPS.length - 1) {
      dismiss()
      return
    }
    setAnimating(true)
    setTimeout(() => {
      setStep((s) => s + 1)
      setAnimating(false)
    }, 180)
  }

  if (!visible) return null

  const current = STEPS[step]

  return (
    <div className="fixed inset-0 z-[300]">
      {/* Dim backdrop — click to skip */}
      <div
        className="absolute inset-0 bg-black/75"
        onClick={dismiss}
      />

      {/* Card */}
      <div
        className={`absolute w-full max-w-md pointer-events-auto transition-all duration-200 ${
          POSITION_CLASSES[current.position]
        } ${animating ? "opacity-0 scale-95" : "opacity-100 scale-100"}`}
        onClick={(e) => e.stopPropagation()}
        style={{ willChange: "transform, opacity" }}
      >
        {/* Glow */}
        <div
          className="absolute -inset-px rounded-sm pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(16,185,129,.18), transparent 70%)",
          }}
        />

        <div
          className="relative bg-black border border-emerald-500/25 shadow-[0_0_60px_rgba(16,185,129,.1),0_32px_64px_rgba(0,0,0,.8)]"
          style={{
            background:
              "linear-gradient(160deg, rgba(16,185,129,.04) 0%, rgba(0,0,0,.98) 50%)",
          }}
        >
          {/* Top accent line */}
          <div
            className="h-px w-full"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(16,185,129,.6) 40%, rgba(139,92,246,.4) 70%, transparent)",
            }}
          />

          <div className="p-7">
            {/* Header row */}
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-center flex-shrink-0">
                  {current.icon}
                </div>
                <div>
                  <div className="font-mono text-[9px] tracking-[.25em] text-emerald-500/70 mb-1">
                    {current.tag}
                  </div>
                  <h3 className="font-mono font-bold text-white text-base leading-tight">
                    {current.title}
                  </h3>
                </div>
              </div>
              <button
                onClick={dismiss}
                className="text-white/20 hover:text-white/60 transition-colors ml-4 flex-shrink-0 mt-1"
                aria-label="Close tour"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <p className="font-mono text-xs text-white/45 leading-relaxed mb-6">
              {current.body}
            </p>

            {/* Progress dots + CTA */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      i === step
                        ? "w-6 bg-emerald-500"
                        : i < step
                        ? "w-2 bg-emerald-500/40"
                        : "w-2 bg-white/10"
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={next}
                className="flex items-center gap-2 px-5 py-2.5 border border-emerald-500/40 bg-emerald-500/8 text-emerald-400 font-mono text-[10px] tracking-widest hover:bg-emerald-500/15 hover:border-emerald-500/60 transition-all"
              >
                {current.cta}
                {step < STEPS.length - 1 && <ChevronRight size={12} />}
              </button>
            </div>
          </div>

          {/* Bottom accent line */}
          <div
            className="h-px w-full"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(16,185,129,.2), transparent)",
            }}
          />
        </div>
      </div>
    </div>
  )
}
