"use client"

import React from "react"
import { motion } from "framer-motion"
import { useEffect, useState, useRef } from "react"
import { AlertTriangle, Activity, Globe2, Lock, Send, Shield } from "lucide-react"

const controversialMarkets = [
  { id: "EPSTEIN_LIST_REVEAL", outcome: "YES", value: 12, trend: "+2.4%" },
  { id: "TAIWAN_INVASION_2026", outcome: "NO", value: 88, trend: "-0.8%" },
  { id: "CEO_INDICTMENT", outcome: "YES", value: 64, trend: "+5.2%" },
  { id: "CARTEL_VIOLENCE_INDEX", outcome: null, value: null, trend: "+4%" },
  { id: "ELECTION_FRAUD_PROOF", outcome: "YES", value: 23, trend: "+1.1%" },
  { id: "PANDEMIC_ORIGIN_LEAK", outcome: "YES", value: 41, trend: "+3.7%" },
  { id: "CRYPTO_CEO_ARREST", outcome: "YES", value: 77, trend: "+8.2%" },
  { id: "WHISTLEBLOWER_DEAD", outcome: "NO", value: 34, trend: "-2.1%" },
]

function ControversialTicker() {
  return (
    <div className="w-full overflow-hidden border-y border-red-500/20 bg-red-500/5 py-2 md:py-3">
      <div className="flex animate-scroll-left">
        {[...controversialMarkets, ...controversialMarkets].map((market, i) => (
          <div key={i} className="flex items-center gap-4 md:gap-6 px-4 md:px-8 whitespace-nowrap">
            <span className="text-white/40 text-[10px] md:text-xs">{market.id}</span>
            {market.outcome ? (
              <span className={`text-[10px] md:text-xs ${market.outcome === 'YES' ? 'text-green-500' : 'text-red-500'}`}>
                [{market.outcome}: {market.value}%]
              </span>
            ) : (
              <span className="text-yellow-500 text-[10px] md:text-xs">[{market.trend}]</span>
            )}
            <span className="text-white/20">|</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function WireframeGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hotspots] = useState([
    { lat: 25.0, lng: 121.5, intensity: 0.9, label: "TPE" },
    { lat: 19.4, lng: -99.1, intensity: 0.7, label: "MEX" },
    { lat: 38.9, lng: -77.0, intensity: 0.8, label: "DC" },
    { lat: 51.5, lng: -0.1, intensity: 0.6, label: "LDN" },
    { lat: 1.3, lng: 103.8, intensity: 0.75, label: "SIN" },
  ])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rotation = 0
    let animationId: number

    const draw = () => {
      const width = canvas.width
      const height = canvas.height
      const centerX = width / 2
      const centerY = height / 2
      const radius = Math.min(width, height) * 0.38

      ctx.clearRect(0, 0, width, height)

      // Draw globe wireframe
      ctx.strokeStyle = 'rgba(220, 38, 38, 0.15)'
      ctx.lineWidth = 1

      // Latitude lines
      for (let lat = -80; lat <= 80; lat += 20) {
        ctx.beginPath()
        const latRadius = radius * Math.cos((lat * Math.PI) / 180)
        const y = centerY - radius * Math.sin((lat * Math.PI) / 180)
        ctx.ellipse(centerX, y, latRadius, latRadius * 0.3, 0, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Longitude lines
      for (let lng = 0; lng < 180; lng += 30) {
        ctx.beginPath()
        ctx.strokeStyle = 'rgba(220, 38, 38, 0.1)'
        const angle = ((lng + rotation) * Math.PI) / 180
        ctx.ellipse(centerX, centerY, radius * Math.abs(Math.sin(angle)), radius, 0, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Draw hotspots
      hotspots.forEach((spot) => {
        const lng = spot.lng + rotation
        const x = centerX + radius * 0.8 * Math.cos((spot.lat * Math.PI) / 180) * Math.sin((lng * Math.PI) / 180)
        const y = centerY - radius * 0.8 * Math.sin((spot.lat * Math.PI) / 180)
        const visible = Math.cos((lng * Math.PI) / 180) > -0.2

        if (visible) {
          // Glow
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, 20 * spot.intensity)
          gradient.addColorStop(0, `rgba(220, 38, 38, ${0.8 * spot.intensity})`)
          gradient.addColorStop(0.5, `rgba(220, 38, 38, ${0.3 * spot.intensity})`)
          gradient.addColorStop(1, 'rgba(220, 38, 38, 0)')
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(x, y, 20 * spot.intensity, 0, Math.PI * 2)
          ctx.fill()

          // Core
          ctx.fillStyle = '#DC2626'
          ctx.beginPath()
          ctx.arc(x, y, 3, 0, Math.PI * 2)
          ctx.fill()

          // Label
          ctx.fillStyle = 'rgba(220, 38, 38, 0.8)'
          ctx.font = '10px monospace'
          ctx.fillText(spot.label, x + 8, y + 3)
        }
      })

      rotation += 0.15
      animationId = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animationId)
  }, [hotspots])

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={500}
        height={500}
        className="w-full max-w-[300px] md:max-w-[500px] h-auto mx-auto"
      />
      <div className="absolute top-2 md:top-4 left-2 md:left-4 text-[10px] md:text-xs text-red-500/60">
        <div className="flex items-center gap-2">
          <Activity className="w-3 h-3" />
          <span className="hidden sm:inline">VOLATILITY HOTSPOTS</span>
          <span className="sm:hidden">HOTSPOTS</span>
        </div>
      </div>
    </div>
  )
}

function WaitlistForm() {
  const [email, setEmail] = useState("")
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [queuePosition, setQueuePosition] = useState(0)
  const [isGlitching, setIsGlitching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setIsGlitching(true)
    setError(null)

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const response = await fetch(`${API_URL}/api/subscribe?email=${encodeURIComponent(email)}`, {
        method: "POST",
      })

      const data = await response.json()

      if (data.status === "success" || data.status === "already_registered") {
        setQueuePosition(data.queue_position)
        setIsSubmitted(true)
      } else {
        setError(data.error || "Something went wrong. Please try again.")
      }
    } catch (err) {
      setError("Connection failed. Please check your internet and try again.")
      console.error("Waitlist signup error:", err)
    } finally {
      setIsGlitching(false)
    }
  }

  if (isSubmitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="border border-green-500/30 bg-green-500/5 p-4 md:p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] md:text-xs text-green-500 tracking-widest">TRANSMISSION RECEIVED</span>
        </div>
        <div className="font-mono text-xs md:text-sm text-white/70 space-y-1">
          <p className="text-green-500">{'>'} Access request encrypted...</p>
          <p className="text-green-500">{'>'} Added to queue...</p>
          <p className="text-white mt-4">
            {'>'} You are <span className="text-yellow-500">#{queuePosition}</span> in line
          </p>
          <p className="text-white/40 text-[10px] md:text-xs mt-4">
            {'>'} Expect contact via encrypted channel within 72h
          </p>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="relative"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Lock className="w-4 h-4 text-red-500" />
        <span className="text-[10px] md:text-xs text-red-500 tracking-widest">THE SYNDICATE IS FULL</span>
      </div>

      <h3 className="text-base md:text-lg text-white font-mono mb-2">REQUEST A KEY</h3>
      <p className="text-[10px] md:text-xs text-white/40 mb-4 md:mb-6">Encrypted access only. No normies.</p>

      {/* Form */}
      <form onSubmit={handleSubmit} className="relative">
        {/* Glitchy input container */}
        <div className={`relative ${isGlitching ? 'animate-glitch' : ''}`}>
          {/* Jagged border effect */}
          <div className="absolute -inset-px bg-gradient-to-r from-red-500/20 via-transparent to-red-500/20"
               style={{ clipPath: 'polygon(0 0, 100% 2%, 98% 100%, 2% 98%)' }} />

          <div className="relative border border-red-500/30 bg-[#020408]">
            <div className="flex flex-col sm:flex-row">
              <div className="hidden sm:flex px-3 py-3 border-r border-red-500/20 items-center">
                <Shield className="w-4 h-4 text-red-500/50" />
              </div>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="EMAIL OR SIGNAL ID"
                className="flex-1 bg-transparent px-4 py-3 text-xs md:text-sm font-mono text-white placeholder:text-white/20 focus:outline-none min-h-[48px]"
              />
              <button
                type="submit"
                disabled={!email || isGlitching}
                className="px-4 py-3 bg-red-500/10 border-t sm:border-t-0 sm:border-l border-red-500/30 text-red-500 text-[10px] md:text-xs font-mono tracking-wider hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[48px]"
              >
                {isGlitching ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
                    className="w-4 h-4 border border-red-500 border-t-transparent rounded-full"
                  />
                ) : (
                  <>
                    <span className="hidden sm:inline">ENCRYPT & SEND</span>
                    <span className="sm:hidden">SEND</span>
                    <Send className="w-3 h-3" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Glitch overlay during submission */}
        {isGlitching && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0, 1, 0] }}
            transition={{ duration: 0.1, repeat: Infinity }}
            className="absolute inset-0 bg-red-500/10 pointer-events-none"
          />
        )}
      </form>

      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono"
        >
          {'>'} {error}
        </motion.div>
      )}

      {/* Warning text */}
      <p className="text-[10px] md:text-xs text-white/20 mt-4 font-mono">
        {'>'} By submitting, you agree to maintain operational security.
      </p>
    </motion.div>
  )
}

export function LandingView() {
  const [typedText, setTypedText] = useState("")
  const fullText = "PROFIT FROM THE CHAOS."

  useEffect(() => {
    let i = 0
    const interval = setInterval(() => {
      if (i <= fullText.length) {
        setTypedText(fullText.slice(0, i))
        i++
      } else {
        clearInterval(interval)
      }
    }, 80)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen pt-20 md:pt-24 overflow-x-hidden">
      {/* Hero Section */}
      <section className="px-4 py-10 md:py-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-center">
            {/* Left: Copy */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="order-2 lg:order-1"
            >
              <div className="flex items-center gap-2 mb-4 md:mb-6">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-[10px] md:text-xs text-red-500 tracking-widest">UNCENSORED INTELLIGENCE</span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold text-white mb-4 md:mb-6 leading-[0.9] tracking-tight text-balance">
                {typedText}
                <span className="animate-blink text-red-500">_</span>
              </h1>

              <p className="text-sm md:text-lg text-white/50 mb-6 md:mb-8 max-w-lg leading-relaxed">
                Markets are driven by panic, scandal, and lies.
                <span className="text-white/70"> We quantify the truth.</span>
              </p>

              {/* Waitlist Form */}
              <WaitlistForm />

              {/* Stats */}
              <div className="mt-8 md:mt-12 grid grid-cols-3 gap-4 md:gap-8">
                <div>
                  <div className="text-lg md:text-2xl font-bold text-white">$2.4B</div>
                  <div className="text-[10px] md:text-xs text-white/40 tracking-wider">VOLUME</div>
                </div>
                <div>
                  <div className="text-lg md:text-2xl font-bold text-green-500">+12.4%</div>
                  <div className="text-[10px] md:text-xs text-white/40 tracking-wider">AVG ALPHA</div>
                </div>
                <div>
                  <div className="text-lg md:text-2xl font-bold text-white">0ms</div>
                  <div className="text-[10px] md:text-xs text-white/40 tracking-wider">DELAY</div>
                </div>
              </div>
            </motion.div>

            {/* Right: Globe */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="flex justify-center order-1 lg:order-2"
            >
              <WireframeGlobe />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Controversial Ticker */}
      <ControversialTicker />

      {/* Features Grid */}
      <section className="px-4 py-12 md:py-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {/* Feature 1 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-4 md:p-6 border border-white/5 bg-white/[0.02] hover:border-red-500/30 transition-colors group"
            >
              <div className="w-10 h-10 border border-red-500/30 flex items-center justify-center mb-4 group-hover:bg-red-500/10 transition-colors">
                <Globe2 className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-white text-sm font-medium mb-2 tracking-wider">GLOBAL SCANNER</h3>
              <p className="text-white/40 text-xs leading-relaxed">
                Real-time monitoring of 10,000+ prediction markets across every category. Nothing is off-limits.
              </p>
            </motion.div>

            {/* Feature 2 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="p-4 md:p-6 border border-white/5 bg-white/[0.02] hover:border-red-500/30 transition-colors group"
            >
              <div className="w-10 h-10 border border-red-500/30 flex items-center justify-center mb-4 group-hover:bg-red-500/10 transition-colors">
                <Activity className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-white text-sm font-medium mb-2 tracking-wider">SENTIMENT GAP</h3>
              <p className="text-white/40 text-xs leading-relaxed">
                Our Bregman divergence algorithm detects when crowd sentiment diverges from mathematical truth.
              </p>
            </motion.div>

            {/* Feature 3 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="p-4 md:p-6 border border-white/5 bg-white/[0.02] hover:border-red-500/30 transition-colors group"
            >
              <div className="w-10 h-10 border border-red-500/30 flex items-center justify-center mb-4 group-hover:bg-red-500/10 transition-colors">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-white text-sm font-medium mb-2 tracking-wider">ATOMIC EXECUTION</h3>
              <p className="text-white/40 text-xs leading-relaxed">
                Private RPC uplink bypasses the public mempool. Your orders execute before the crowd sees them.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Terminal Preview */}
      <section className="px-4 py-12 md:py-20">
        <div className="max-w-4xl mx-auto">
          <div className="border border-white/5 bg-[#020408]">
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-3 md:px-4 py-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-red-500/50" />
                <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-yellow-500/50" />
                <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-green-500/50" />
              </div>
              <span className="text-[10px] md:text-xs text-white/30">BLACK_EDGE_TERMINAL_v2.4.1</span>
            </div>
            {/* Terminal Content */}
            <div className="p-4 md:p-6 font-mono text-[10px] md:text-sm overflow-x-auto">
              <div className="text-white/40 mb-2 whitespace-nowrap">{'>'} scanning markets...</div>
              <div className="text-green-500 mb-2 whitespace-nowrap">{'>'} 847 opportunities detected</div>
              <div className="text-white/40 mb-2 whitespace-nowrap">{'>'} filtering by risk threshold: 0.02</div>
              <div className="text-yellow-500 mb-2 whitespace-nowrap">{'>'} ALERT: CEO_INDICTMENT spread widening (+2.4%)</div>
              <div className="text-red-500 mb-2 whitespace-nowrap">{'>'} ARBITRAGE DETECTED: Polymarket/Kalshi delta = $0.034</div>
              <div className="text-white/40 mb-2 whitespace-nowrap">{'>'} calculating optimal position size...</div>
              <div className="text-green-500 whitespace-nowrap">{'>'} READY TO EXECUTE: Opportunity detected $847.23 spread (12.4% edge)</div>
              <div className="text-white mt-4 flex items-center">
                {'>'} <span className="animate-blink ml-1">_</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
