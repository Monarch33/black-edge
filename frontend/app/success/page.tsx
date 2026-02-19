"use client"

import { useEffect } from "react"
import Link from "next/link"

export default function SuccessPage() {
  useEffect(() => {
    // Redirect to dashboard after payment — terminal + Polymarket API key
    const t = setTimeout(() => {
      window.location.href = "/dashboard"
    }, 2500)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="min-h-screen bg-black text-white font-mono flex flex-col items-center justify-center p-8">
      <div className="w-16 h-16 rounded-full border-2 border-[#10b981] flex items-center justify-center mb-6 animate-pulse">
        <span className="text-[#10b981] text-2xl">✓</span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight mb-2">Payment successful</h1>
      <p className="text-white/60 text-sm mb-8 text-center max-w-md">
        Redirecting to your terminal... Configure your Polymarket API keys to activate the bot.
      </p>
      <Link
        href="/dashboard"
        className="px-6 py-3 border border-[#10b981] text-[#10b981] text-[10px] tracking-widest hover:bg-[#10b981]/10 transition-colors"
      >
        GO TO DASHBOARD →
      </Link>
    </div>
  )
}
