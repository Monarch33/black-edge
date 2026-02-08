"use client"

import { motion } from "framer-motion"
import { ArrowUpRight, Github, Send } from "lucide-react"

type View = 'landing' | 'methodology' | 'pricing'

interface FooterProps {
  onNavigate: (view: View) => void
}

export function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="relative py-12 border-t border-white/5">
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
              <div className="w-6 h-6 border border-red-500/50 flex items-center justify-center bg-red-500/5">
                <span className="text-red-500 text-[8px] font-bold">BE</span>
              </div>
              <span className="text-xs tracking-[0.2em] text-white/70">BLACK EDGE</span>
            </div>
            <p className="text-[10px] text-white/30 leading-relaxed mb-4">
              Information wants to be free. Markets want to be efficient. We accelerate both.
            </p>
            <div className="flex items-center gap-3">
              <a href="#" className="text-white/30 hover:text-white/60 transition-colors">
                <Github className="w-4 h-4" />
              </a>
              <a href="#" className="text-white/30 hover:text-white/60 transition-colors">
                <Send className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <p className="text-[10px] text-white/40 tracking-[0.2em] mb-4">NAVIGATION</p>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => onNavigate('landing')}
                  className="text-xs text-white/40 hover:text-white/80 transition-colors"
                >
                  Terminal
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('methodology')}
                  className="text-xs text-white/40 hover:text-white/80 transition-colors"
                >
                  The Black Box
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('pricing')}
                  className="text-xs text-white/40 hover:text-white/80 transition-colors"
                >
                  Access
                </button>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <p className="text-[10px] text-white/40 tracking-[0.2em] mb-4">RESOURCES</p>
            <ul className="space-y-2">
              <li>
                <a href="#" className="group flex items-center gap-1 text-xs text-white/40 hover:text-white/80 transition-colors">
                  API Documentation
                  <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              </li>
              <li>
                <a href="#" className="group flex items-center gap-1 text-xs text-white/40 hover:text-white/80 transition-colors">
                  Technical Paper
                  <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              </li>
              <li>
                <a href="#" className="flex items-center gap-2 text-xs text-white/40 hover:text-white/80 transition-colors">
                  System Status
                  <span className="w-1.5 h-1.5 bg-green-500 animate-pulse" />
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="text-[10px] text-white/40 tracking-[0.2em] mb-4">LEGAL</p>
            <ul className="space-y-2">
              <li>
                <a href="/terms" className="text-xs text-white/40 hover:text-white/80 transition-colors">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="/privacy" className="text-xs text-white/40 hover:text-white/80 transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/risk-disclosure" className="text-xs text-white/40 hover:text-white/80 transition-colors">
                  Risk Disclosure
                </a>
              </li>
            </ul>
          </div>
        </motion.div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[10px] text-white/20">
            &copy; 2026 BLACK EDGE. Not financial advice. DYOR.
          </p>
          <div className="flex items-center gap-4 text-[10px] text-white/20">
            <span>BUILD: v3.1.4</span>
            <span className="w-1 h-1 bg-white/10" />
            <span>UPTIME: 99.97%</span>
            <span className="w-1 h-1 bg-white/10" />
            <span className="text-red-500/60">UNREGULATED</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
