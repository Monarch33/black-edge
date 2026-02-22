"use client"

import { useState } from "react"
import { useConnectModal } from "@rainbow-me/rainbowkit"
import {
  Wallet,
  CreditCard,
  Info,
  Download,
  ArrowRight,
  X,
  ExternalLink,
  ChevronLeft,
} from "lucide-react"

interface WalletOnboardingModalProps {
  isOpen: boolean
  onClose: () => void
}

export function WalletOnboardingModal({
  isOpen,
  onClose,
}: WalletOnboardingModalProps) {
  const { openConnectModal } = useConnectModal()
  const [view, setView] = useState<"choose" | "tutorial">("choose")
  const [tutorialStep, setTutorialStep] = useState(1)

  if (!isOpen) return null

  const handleExperienced = () => {
    onClose()
    setTimeout(() => openConnectModal?.(), 120)
  }

  const reset = () => {
    setView("choose")
    setTutorialStep(1)
  }

  const close = () => {
    reset()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{
        background: "rgba(0,0,0,.97)",
      }}
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div
        className="relative w-full max-w-lg bg-black border border-white/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent line */}
        <div
          className="h-px w-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(16,185,129,.5), transparent)",
          }}
        />

        <div className="p-8">
          {/* Close */}
          <button
            onClick={close}
            className="absolute top-4 right-4 text-white/25 hover:text-white/70 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          {view === "choose" ? (
            <>
              <div className="text-center mb-8">
                <Wallet
                  className="mx-auto mb-4 text-emerald-500"
                  size={32}
                />
                <h2 className="font-mono text-xl font-bold text-white tracking-wide">
                  Connect Your Wallet
                </h2>
                <p className="font-mono text-xs text-white/40 mt-2">
                  Choose how you want to get started
                </p>
              </div>

              <div className="space-y-3">
                {/* Option A: Experienced */}
                <button
                  onClick={handleExperienced}
                  className="w-full p-4 border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all flex items-center gap-4 group"
                >
                  <Wallet
                    className="text-emerald-500 flex-shrink-0"
                    size={20}
                  />
                  <div className="text-left">
                    <div className="font-mono text-sm text-white font-bold">
                      I have a Wallet
                    </div>
                    <div className="font-mono text-[10px] text-white/40">
                      MetaMask, Coinbase, WalletConnect...
                    </div>
                  </div>
                  <ArrowRight
                    className="ml-auto text-white/20 group-hover:text-emerald-500 transition-colors"
                    size={16}
                  />
                </button>

                {/* Option B: Beginner */}
                <button
                  onClick={() => setView("tutorial")}
                  className="w-full p-4 border border-white/10 hover:border-white/20 bg-white/[.02] hover:bg-white/[.04] transition-all flex items-center gap-4 group"
                >
                  <Info
                    className="text-violet-400 flex-shrink-0"
                    size={20}
                  />
                  <div className="text-left">
                    <div className="font-mono text-sm text-white font-bold">
                      I&apos;m new, help me start
                    </div>
                    <div className="font-mono text-[10px] text-white/40">
                      We&apos;ll guide you step by step
                    </div>
                  </div>
                  <ArrowRight
                    className="ml-auto text-white/20 group-hover:text-violet-400 transition-colors"
                    size={16}
                  />
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Back button */}
              <button
                onClick={reset}
                className="flex items-center gap-2 text-white/40 hover:text-white/70 font-mono text-xs mb-6 transition-colors"
              >
                <ChevronLeft size={14} /> Back
              </button>

              {/* Progress bar */}
              <div className="flex gap-2 mb-8">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`flex-1 h-1 rounded-full transition-colors duration-300 ${
                      s <= tutorialStep ? "bg-emerald-500" : "bg-white/10"
                    }`}
                  />
                ))}
              </div>

              {/* Step 1: Download MetaMask */}
              {tutorialStep === 1 && (
                <div>
                  <Download className="text-emerald-500 mb-4" size={28} />
                  <h3 className="font-mono text-lg font-bold text-white mb-2">
                    Step 1: Get MetaMask
                  </h3>
                  <p className="font-mono text-xs text-white/40 leading-relaxed mb-6">
                    MetaMask is a free, secure browser extension that acts as
                    your digital wallet. It&apos;s used by millions of people
                    worldwide to safely interact with blockchain apps.
                  </p>
                  <a
                    href="https://metamask.io/download/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 border border-emerald-500/30 bg-emerald-500/5 font-mono text-sm text-emerald-400 hover:bg-emerald-500/10 transition-all"
                  >
                    <Download size={16} />
                    Download MetaMask (Free)
                    <ExternalLink size={12} className="ml-auto" />
                  </a>
                  <button
                    onClick={() => setTutorialStep(2)}
                    className="w-full mt-4 py-3 border border-white/10 font-mono text-xs text-white/60 hover:text-white hover:border-white/20 transition-all"
                  >
                    Already installed? Next Step &rarr;
                  </button>
                </div>
              )}

              {/* Step 2: Fund wallet */}
              {tutorialStep === 2 && (
                <div>
                  <CreditCard className="text-emerald-500 mb-4" size={28} />
                  <h3 className="font-mono text-lg font-bold text-white mb-2">
                    Step 2: Fund Your Wallet
                  </h3>
                  <p className="font-mono text-xs text-white/40 leading-relaxed mb-4">
                    You&apos;ll need a small amount of{" "}
                    <span className="text-white/70">USDC</span> (a
                    dollar-pegged stablecoin) on the{" "}
                    <span className="text-violet-400">Polygon network</span>.
                  </p>
                  <div className="space-y-3 mb-6">
                    <div className="p-3 border border-white/5 bg-white/[.02]">
                      <div className="font-mono text-[10px] text-emerald-400 tracking-wider mb-1">
                        WHAT YOU NEED
                      </div>
                      <div className="font-mono text-xs text-white/50">
                        &bull; USDC.e on Polygon &mdash; your trading capital
                      </div>
                      <div className="font-mono text-xs text-white/50">
                        &bull; ~0.1 POL (MATIC) for gas &mdash; costs less than
                        $0.01
                      </div>
                    </div>
                    <div className="p-3 border border-white/5 bg-white/[.02]">
                      <div className="font-mono text-[10px] text-violet-400 tracking-wider mb-1">
                        HOW TO GET IT
                      </div>
                      <div className="font-mono text-xs text-white/50 leading-relaxed">
                        Buy USDC on Coinbase or Binance, then send it to your
                        MetaMask wallet address. Make sure to select the{" "}
                        <span className="text-violet-400">Polygon</span>{" "}
                        network when withdrawing.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setTutorialStep(3)}
                    className="w-full py-3 border border-emerald-500/30 font-mono text-xs text-emerald-400 hover:bg-emerald-500/10 transition-all"
                  >
                    I&apos;ve funded my wallet &rarr; Next
                  </button>
                </div>
              )}

              {/* Step 3: Connect */}
              {tutorialStep === 3 && (
                <div>
                  <Wallet className="text-emerald-500 mb-4" size={28} />
                  <h3 className="font-mono text-lg font-bold text-white mb-2">
                    Step 3: Connect
                  </h3>
                  <p className="font-mono text-xs text-white/40 leading-relaxed mb-6">
                    You&apos;re ready! Click below to connect your wallet to
                    Black Edge. Your private key is{" "}
                    <span className="text-white/70">never shared</span> &mdash;
                    only your public address is used.
                  </p>
                  <button
                    onClick={handleExperienced}
                    className="w-full py-4 border-2 border-emerald-500/60 bg-emerald-500/10 font-mono text-sm text-emerald-400 font-bold hover:bg-emerald-500/20 transition-all tracking-wider"
                  >
                    CONNECT WALLET
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom accent line */}
        <div
          className="h-px w-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(16,185,129,.3), transparent)",
          }}
        />
      </div>
    </div>
  )
}
