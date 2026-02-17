"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Navbar } from "@/components/navbar"
import { LandingView } from "@/components/views/landing-view"
import { MarketsView } from "@/components/views/markets-view"
import { PricingView } from "@/components/views/pricing-view"
import { TerminalView } from "@/components/views/terminal-view"
import { PortfolioView } from "@/components/views/portfolio-view"
import { SportsView } from "@/components/views/sports-view"
import { Crypto5MinView } from "@/components/views/crypto-5min-view"
import { TrackRecordView } from "@/components/views/track-record-view"
import { Footer } from "@/components/footer"

type View = 'landing' | 'markets' | 'crypto5min' | 'sports' | 'pricing' | 'terminal' | 'portfolio' | 'trackrecord'

export default function Home() {
  const [currentView, setCurrentView] = useState<View>('landing')

  const handleNavigate = (view: View) => {
    if (view === currentView) return
    setCurrentView(view)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <main className="min-h-screen bg-black overflow-x-hidden relative">
      <Navbar currentView={currentView} onNavigate={handleNavigate} />

      <AnimatePresence mode="wait">
        <motion.div
          key={currentView}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="relative"
        >
          {currentView === 'landing' && <LandingView />}
          {currentView === 'markets' && <MarketsView />}
          {currentView === 'pricing' && <PricingView />}
          {currentView === 'terminal' && <TerminalView />}
          {currentView === 'portfolio' && <PortfolioView />}
          {currentView === 'sports' && <SportsView />}
          {currentView === 'crypto5min' && <Crypto5MinView />}
          {currentView === 'trackrecord' && <TrackRecordView />}
        </motion.div>
      </AnimatePresence>

      {currentView !== 'terminal' && currentView !== 'portfolio' && <Footer onNavigate={handleNavigate} />}
    </main>
  )
}
