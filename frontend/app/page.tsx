"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Navbar } from "@/components/navbar"
import { LandingView } from "@/components/views/landing-view"
import { MethodologyView } from "@/components/views/methodology-view"
import { PricingView } from "@/components/views/pricing-view"
import { TerminalView } from "@/components/views/terminal-view"
import { PortfolioView } from "@/components/views/portfolio-view"
import { Footer } from "@/components/footer"

type View = 'landing' | 'methodology' | 'pricing' | 'terminal' | 'portfolio'

export default function Home() {
  const [currentView, setCurrentView] = useState<View>('landing')
  const [isTransitioning, setIsTransitioning] = useState(false)

  const handleNavigate = (view: View) => {
    if (view === currentView) return
    setIsTransitioning(true)
    setTimeout(() => {
      setCurrentView(view)
      window.scrollTo({ top: 0, behavior: 'instant' })
      setTimeout(() => setIsTransitioning(false), 100)
    }, 400)
  }

  return (
    <main className="min-h-screen bg-[#020408] overflow-x-hidden relative">
      {/* Scanline overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.03]">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(255,255,255,0.1)_2px,rgba(255,255,255,0.1)_4px)]" />
      </div>

      {/* Glitch transition overlay */}
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-[#020408] flex items-center justify-center"
          >
            <div className="relative">
              <motion.div
                animate={{
                  x: [0, -3, 3, -2, 2, 0],
                  opacity: [1, 0.8, 1, 0.7, 1, 1],
                }}
                transition={{ duration: 0.3, repeat: 2 }}
                className="text-2xl text-red-500 font-mono tracking-wider"
              >
                DECRYPTING...
              </motion.div>
              <motion.div
                className="absolute inset-0 text-2xl text-cyan-500 font-mono tracking-wider"
                animate={{
                  x: [0, 3, -3, 2, -2, 0],
                  opacity: [0.5, 0.3, 0.5, 0.4, 0.5, 0],
                }}
                transition={{ duration: 0.3, repeat: 2 }}
              >
                DECRYPTING...
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Navbar currentView={currentView} onNavigate={handleNavigate} />

      <AnimatePresence mode="wait">
        <motion.div
          key={currentView}
          initial={{ opacity: 0, filter: "blur(10px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, filter: "blur(10px)" }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          {currentView === 'landing' && <LandingView />}
          {currentView === 'methodology' && <MethodologyView />}
          {currentView === 'pricing' && <PricingView />}
          {currentView === 'terminal' && <TerminalView />}
          {currentView === 'portfolio' && <PortfolioView />}
        </motion.div>
      </AnimatePresence>

      {currentView !== 'terminal' && currentView !== 'portfolio' && <Footer onNavigate={handleNavigate} />}
    </main>
  )
}
