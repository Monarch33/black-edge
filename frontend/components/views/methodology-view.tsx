"use client"

import { motion } from "framer-motion"
import { AlertTriangle, Lock, Eye, Server, Zap, Shield } from "lucide-react"
import { useEffect, useRef } from "react"

function LiquidityHeatmap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height
    const cols = 20
    const rows = 10
    const cellW = width / cols
    const cellH = height / rows

    // Generate heatmap data
    const data: number[][] = []
    for (let y = 0; y < rows; y++) {
      data[y] = []
      for (let x = 0; x < cols; x++) {
        const dumbMoney = Math.exp(-((x - 5) ** 2 + (y - 5) ** 2) / 30) * 0.8
        const smartMoney = Math.exp(-((x - 15) ** 2 + (y - 5) ** 2) / 20) * 1
        data[y][x] = x < 10 ? dumbMoney : smartMoney
      }
    }

    // Draw heatmap
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const value = data[y][x]
        const isSmartMoney = x >= 10

        if (isSmartMoney) {
          ctx.fillStyle = `rgba(34, 197, 94, ${value})`
        } else {
          ctx.fillStyle = `rgba(220, 38, 38, ${value})`
        }

        ctx.fillRect(x * cellW + 1, y * cellH + 1, cellW - 2, cellH - 2)
      }
    }

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
    ctx.lineWidth = 1
    for (let x = 0; x <= cols; x++) {
      ctx.beginPath()
      ctx.moveTo(x * cellW, 0)
      ctx.lineTo(x * cellW, height)
      ctx.stroke()
    }
    for (let y = 0; y <= rows; y++) {
      ctx.beginPath()
      ctx.moveTo(0, y * cellH)
      ctx.lineTo(width, y * cellH)
      ctx.stroke()
    }

    // Draw divider
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(width / 2, 0)
    ctx.lineTo(width / 2, height)
    ctx.stroke()
    ctx.setLineDash([])

  }, [])

  return (
    <div className="relative overflow-x-auto">
      <canvas
        ref={canvasRef}
        width={600}
        height={300}
        className="w-full min-w-[400px] h-auto"
      />
      {/* Labels */}
      <div className="absolute top-2 left-2 md:left-4 text-[10px] md:text-xs text-red-500/80 font-mono">DUMB MONEY</div>
      <div className="absolute top-2 right-2 md:right-4 text-[10px] md:text-xs text-green-500/80 font-mono">SMART MONEY</div>
      {/* Arrow */}
      <div className="absolute bottom-2 md:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
        <span className="text-[10px] md:text-xs text-white/30 font-mono">LIQUIDITY FLOWS</span>
        <span className="text-white/50">&rarr;</span>
      </div>
    </div>
  )
}

function RealityGapGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height
    const padding = 40

    // Clear
    ctx.clearRect(0, 0, width, height)

    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 10; i++) {
      const x = padding + (i / 10) * (width - padding * 2)
      const y = padding + (i / 10) * (height - padding * 2)
      ctx.beginPath()
      ctx.moveTo(x, padding)
      ctx.lineTo(x, height - padding)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(padding, y)
      ctx.lineTo(width - padding, y)
      ctx.stroke()
    }

    // Crowd Sentiment Line (Red - volatile, emotional)
    ctx.beginPath()
    ctx.strokeStyle = '#DC2626'
    ctx.lineWidth = 2
    const crowdPoints: [number, number][] = []
    for (let i = 0; i <= 100; i++) {
      const x = padding + (i / 100) * (width - padding * 2)
      const baseY = height / 2
      const wave = Math.sin(i * 0.1) * 40 + Math.sin(i * 0.05) * 30
      const spike = i > 30 && i < 40 ? -60 : (i > 60 && i < 70 ? 50 : 0)
      const y = baseY + wave + spike
      crowdPoints.push([x, y])
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Bregman Divergence Line (Green - smooth, mathematical)
    ctx.beginPath()
    ctx.strokeStyle = '#22C55E'
    ctx.lineWidth = 2
    const truthPoints: [number, number][] = []
    for (let i = 0; i <= 100; i++) {
      const x = padding + (i / 100) * (width - padding * 2)
      const baseY = height / 2 + 10
      const smooth = Math.sin(i * 0.03) * 20
      const y = baseY + smooth
      truthPoints.push([x, y])
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Highlight the gap area
    ctx.fillStyle = 'rgba(220, 38, 38, 0.1)'
    ctx.beginPath()
    ctx.moveTo(crowdPoints[35][0], crowdPoints[35][1])
    for (let i = 35; i <= 45; i++) {
      ctx.lineTo(crowdPoints[i][0], crowdPoints[i][1])
    }
    for (let i = 45; i >= 35; i--) {
      ctx.lineTo(truthPoints[i][0], truthPoints[i][1])
    }
    ctx.closePath()
    ctx.fill()

    // "Execute Here" marker
    ctx.fillStyle = '#DC2626'
    ctx.beginPath()
    ctx.arc(crowdPoints[38][0], (crowdPoints[38][1] + truthPoints[38][1]) / 2, 6, 0, Math.PI * 2)
    ctx.fill()

  }, [])

  return (
    <div className="overflow-x-auto">
      <canvas
        ref={canvasRef}
        width={700}
        height={300}
        className="w-full min-w-[400px] h-auto"
      />
    </div>
  )
}

export function MethodologyView() {
  return (
    <div className="pt-24 md:pt-32 pb-16 md:pb-24 overflow-x-hidden">
      {/* Header */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 mb-12 md:mb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-3 mb-4 md:mb-6">
            <Lock className="w-4 h-4 text-red-500" />
            <span className="text-[10px] md:text-xs text-red-500 tracking-[0.2em] md:tracking-[0.3em] uppercase">CLASSIFIED // LEVEL 5</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold text-white mb-4 tracking-tight text-balance">
            THE BLACK BOX
          </h1>
          <p className="text-sm md:text-lg text-white/40 max-w-2xl">
            We don&apos;t guess. We cheat using math. This is how.
          </p>
        </motion.div>
      </section>

      {/* Confidential Banner */}
      <div className="border-y border-red-500/20 bg-red-500/5 py-2 md:py-3 px-4 md:px-6 mb-12 md:mb-16">
        <div className="max-w-5xl mx-auto flex items-center gap-3 md:gap-4">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-[10px] md:text-xs text-red-500/80 tracking-wider">
            CONFIDENTIAL — DO NOT DISTRIBUTE
          </p>
        </div>
      </div>

      {/* Section 1: The Math Core */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 mb-16 md:mb-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 border border-red-500/50 flex items-center justify-center text-xs text-red-500">01</div>
            <h2 className="text-[10px] md:text-xs tracking-[0.2em] md:tracking-[0.3em] text-white/40 uppercase">THE MATH CORE</h2>
          </div>

          {/* Formula Container */}
          <div className="relative border border-white/10 bg-[#020408]">
            {/* Stamp */}
            <div className="absolute top-2 md:top-4 right-2 md:right-4 border-2 border-red-500/40 px-2 md:px-3 py-1 rotate-[-8deg]">
              <span className="text-red-500/60 text-[10px] md:text-xs tracking-widest">TOP SECRET</span>
            </div>

            <div className="p-4 md:p-8 lg:p-12">
              {/* LaTeX-style Equation Display */}
              <div className="text-center mb-8 md:mb-10 overflow-x-auto">
                <div className="inline-block px-4 md:px-8 py-6 md:py-8 bg-white/[0.02] border border-white/5 min-w-fit max-w-[90vw]">
                  <div className="font-mono text-base sm:text-xl md:text-3xl text-white tracking-wide leading-relaxed whitespace-nowrap">
                    {/* Frank-Wolfe Algorithm */}
                    <div className="mb-4 md:mb-6">
                      <span className="text-green-500 italic">x</span>
                      <sup className="text-white/50 text-xs md:text-sm align-super">(k+1)</sup>
                      <span className="text-white/30 mx-2 md:mx-3">=</span>
                      <span className="text-white/70">(1 - &gamma;</span>
                      <sub className="text-white/50 text-xs md:text-sm align-sub">k</sub>
                      <span className="text-white/70">)</span>
                      <span className="text-green-500 italic">x</span>
                      <sup className="text-white/50 text-xs md:text-sm align-super">(k)</sup>
                      <span className="text-white/30 mx-2 md:mx-3">+</span>
                      <span className="text-white/70">&gamma;</span>
                      <sub className="text-white/50 text-xs md:text-sm align-sub">k</sub>
                      <span className="text-red-500 italic">s</span>
                      <sup className="text-white/50 text-xs md:text-sm align-super">(k)</sup>
                    </div>

                    {/* Where clause */}
                    <div className="text-xs md:text-sm text-white/40 mb-3 md:mb-4">where</div>

                    {/* s definition */}
                    <div className="text-sm sm:text-base md:text-xl">
                      <span className="text-red-500 italic">s</span>
                      <sup className="text-white/50 text-[10px] md:text-xs align-super">(k)</sup>
                      <span className="text-white/30 mx-2">=</span>
                      <span className="text-white/50">arg min</span>
                      <sub className="text-white/40 text-[10px] md:text-xs align-sub"> s&isin;M</sub>
                      <span className="text-white/30 mx-2">{'<'}</span>
                      <span className="text-white/70">&nabla;f(</span>
                      <span className="text-green-500 italic">x</span>
                      <sup className="text-white/50 text-[10px] md:text-xs align-super">(k)</sup>
                      <span className="text-white/70">)</span>
                      <span className="text-white/30">,</span>
                      <span className="text-white/70"> s</span>
                      <span className="text-white/30">{'>'}</span>
                    </div>
                  </div>
                </div>

                <p className="mt-4 md:mt-6 text-white/40 text-xs md:text-sm">
                  Convex optimization at atomic speed.
                </p>
              </div>

              <p className="text-white/50 text-xs md:text-sm text-center max-w-xl mx-auto mb-6 md:mb-8">
                While retail traders read news, our Frank-Wolfe solver finds the vector{' '}
                <span className="text-green-500 font-mono italic">x</span> that minimizes risk inside the marginal polytope{' '}
                <span className="text-white/70 font-mono">M</span>. Each iteration costs O(n) and converges in O(1/k).
              </p>

              {/* Variable Definitions */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                <div className="p-3 md:p-4 border border-white/5 bg-white/[0.01]">
                  <p className="font-mono text-green-500 mb-1 md:mb-2 italic text-sm md:text-base">x<sup className="text-[10px] md:text-xs">(k)</sup></p>
                  <p className="text-[10px] md:text-xs text-white/40">Current allocation vector</p>
                </div>
                <div className="p-3 md:p-4 border border-white/5 bg-white/[0.01]">
                  <p className="font-mono text-red-500 mb-1 md:mb-2 italic text-sm md:text-base">s<sup className="text-[10px] md:text-xs">(k)</sup></p>
                  <p className="text-[10px] md:text-xs text-white/40">Optimal descent direction</p>
                </div>
                <div className="p-3 md:p-4 border border-white/5 bg-white/[0.01]">
                  <p className="font-mono text-white/70 mb-1 md:mb-2 text-sm md:text-base">&gamma;<sub className="text-[10px] md:text-xs">k</sub> = 2/(k+2)</p>
                  <p className="text-[10px] md:text-xs text-white/40">Step size (convergent)</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Section 2: The Reality Gap */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 mb-16 md:mb-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 border border-red-500/50 flex items-center justify-center text-xs text-red-500">02</div>
            <h2 className="text-[10px] md:text-xs tracking-[0.2em] md:tracking-[0.3em] text-white/40 uppercase">THE REALITY GAP</h2>
          </div>

          <div className="border border-white/10 bg-[#020408] p-4 md:p-8">
            {/* Graph */}
            <RealityGapGraph />

            {/* Annotation */}
            <div className="mt-6 md:mt-8 p-3 md:p-4 border-l-2 border-red-500 bg-red-500/5">
              <p className="text-white/70 text-xs md:text-sm">
                <span className="text-red-500 font-bold">WE EXECUTE HERE</span> — in the gap between the lie and the truth.
              </p>
            </div>

            {/* Legend */}
            <div className="mt-4 md:mt-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8">
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-red-500" />
                <span className="text-[10px] md:text-xs text-white/40">Crowd Sentiment</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-green-500" />
                <span className="text-[10px] md:text-xs text-white/40">Bregman Divergence</span>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Section 3: Liquidity Heatmap */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 mb-16 md:mb-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 border border-red-500/50 flex items-center justify-center text-xs text-red-500">03</div>
            <h2 className="text-[10px] md:text-xs tracking-[0.2em] md:tracking-[0.3em] text-white/40 uppercase">LIQUIDITY HEATMAP</h2>
          </div>

          <div className="border border-white/10 bg-[#020408] p-4 md:p-8">
            <LiquidityHeatmap />

            {/* Description */}
            <div className="mt-6 md:mt-8 p-4 md:p-6 border border-white/5 bg-white/[0.01]">
              <h3 className="text-xs md:text-sm text-white font-mono mb-3 tracking-wider">NON-PUBLIC DATA</h3>
              <p className="text-white/50 text-xs md:text-sm leading-relaxed mb-4">
                Our model scrapes non-public data sources to adjust the probability curve before the market reacts:
              </p>
              <ul className="space-y-2 text-[10px] md:text-xs text-white/40">
                <li className="flex items-start gap-2">
                  <span className="text-red-500">&bull;</span>
                  <span><span className="text-white/60">Discord Leaks:</span> Private alpha channels, whale group chats</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500">&bull;</span>
                  <span><span className="text-white/60">Dark Pool:</span> Institutional order flow, block trades</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500">&bull;</span>
                  <span><span className="text-white/60">Social:</span> Deleted tweets, private Telegram groups</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500">&bull;</span>
                  <span><span className="text-white/60">On-Chain:</span> Wallet clustering, MEV searcher patterns</span>
                </li>
              </ul>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Section 4: Atomic Execution */}
      <section className="max-w-5xl mx-auto px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 border border-red-500/50 flex items-center justify-center text-xs text-red-500">04</div>
            <h2 className="text-[10px] md:text-xs tracking-[0.2em] md:tracking-[0.3em] text-white/40 uppercase">ATOMIC EXECUTION</h2>
          </div>

          <div className="border border-white/10 bg-[#020408] p-4 md:p-8">
            <div className="grid md:grid-cols-2 gap-6 md:gap-8 items-center">
              {/* Left: Description */}
              <div>
                <h3 className="text-xl md:text-2xl font-bold text-white mb-3 md:mb-4">0-Block Delay</h3>
                <p className="text-white/40 text-xs md:text-sm mb-4 md:mb-6 leading-relaxed">
                  We bribe the validators directly via private RPC to front-run the public mempool.
                  Your orders execute before the crowd even sees the opportunity.
                </p>

                <div className="space-y-3 md:space-y-4">
                  <div className="flex items-start gap-3">
                    <Server className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-white text-xs md:text-sm">Private RPC Uplink</p>
                      <p className="text-white/30 text-[10px] md:text-xs">Direct validator connection</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Zap className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-white text-xs md:text-sm">MEV-Protected Bundle</p>
                      <p className="text-white/30 text-[10px] md:text-xs">Sandwich attack immune</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Shield className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-white text-xs md:text-sm">Atomic Arbitrage</p>
                      <p className="text-white/30 text-[10px] md:text-xs">All-or-nothing execution</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Execution Flow */}
              <div className="border border-white/5 p-4 md:p-6 bg-white/[0.01] overflow-x-auto">
                <div className="space-y-2 md:space-y-3 font-mono text-[10px] md:text-xs min-w-fit">
                  <div className="flex items-center gap-2 text-white/30 whitespace-nowrap">
                    <Eye className="w-3 h-3 shrink-0" />
                    <span>MEMPOOL_SCANNER: Detected...</span>
                  </div>
                  <div className="flex items-center gap-2 text-yellow-500 whitespace-nowrap">
                    <span className="w-3 h-3 flex items-center justify-center shrink-0">&rarr;</span>
                    <span>VALIDATOR_BRIBE: 0.001 ETH</span>
                  </div>
                  <div className="flex items-center gap-2 text-red-500 whitespace-nowrap">
                    <span className="w-3 h-3 flex items-center justify-center shrink-0">&rarr;</span>
                    <span>PRIVATE_RPC: Bypassing queue...</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-500 whitespace-nowrap">
                    <span className="w-3 h-3 flex items-center justify-center shrink-0">&check;</span>
                    <span>EXECUTED: Block #18,847,291</span>
                  </div>
                  <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-white/5 text-green-500 whitespace-nowrap">
                    PROFIT: +$2,847.32 (0.34s)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  )
}
