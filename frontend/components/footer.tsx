"use client"

import { motion } from "framer-motion"
import { ArrowUpRight, Github, Send } from "lucide-react"

type View = 'landing' | 'markets' | 'crypto5min' | 'sports' | 'pricing' | 'terminal' | 'portfolio'

interface FooterProps {
  onNavigate: (view: View) => void
}

export function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="relative py-12 border-t border-[#1A1A1A] bg-black">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="grid md:grid-cols-4 gap-8"
        >
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 border border-white/30 flex items-center justify-center bg-[#0A0A0A]">
                <span className="text-white text-[8px] font-bold">BE</span>
              </div>
              <span className="text-xs tracking-[0.2em] text-[#888]">BLACK EDGE</span>
            </div>
            <p className="text-xs text-[#555] leading-relaxed mb-4">
              Prediction market intelligence powered by AI.
            </p>
            <div className="flex items-center gap-3">
              <a href="#" className="text-[#555] hover:text-white transition-colors">
                <Github className="w-4 h-4" />
              </a>
              <a href="#" className="text-[#555] hover:text-white transition-colors">
                <Send className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <p className="text-[10px] text-[#555] tracking-[0.2em] mb-4">NAVIGATION</p>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => onNavigate('landing')}
                  className="text-xs text-[#888] hover:text-white transition-colors"
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('markets')}
                  className="text-xs text-[#888] hover:text-white transition-colors"
                >
                  Markets
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('pricing')}
                  className="text-xs text-[#888] hover:text-white transition-colors"
                >
                  Pricing
                </button>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <p className="text-[10px] text-[#555] tracking-[0.2em] mb-4">RESOURCES</p>
            <ul className="space-y-2">
              <li>
                <a href="/status" className="flex items-center gap-2 text-xs text-[#888] hover:text-white transition-colors">
                  System Status
                  <span className="w-1.5 h-1.5 bg-[#22C55E] animate-pulse" />
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="text-[10px] text-[#555] tracking-[0.2em] mb-4">LEGAL</p>
            <ul className="space-y-2">
              <li>
                <a href="/terms" className="text-xs text-[#888] hover:text-white transition-colors">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="/privacy" className="text-xs text-[#888] hover:text-white transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/risk-disclosure" className="text-xs text-[#888] hover:text-white transition-colors">
                  Risk Disclosure
                </a>
              </li>
            </ul>
          </div>
        </motion.div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-[#1A1A1A] flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[#555]">
            &copy; 2026 Black Edge. Not financial advice.
          </p>
          <div className="flex items-center gap-4 text-xs text-[#555]">
            <span>v3.0</span>
            <span className="w-1 h-1 bg-[#1A1A1A]" />
            <span>Not financial advice</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
