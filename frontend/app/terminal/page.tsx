"use client"

import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useAccount } from "wagmi"
import { useBotPositions } from "@/hooks/use-bot-positions"
import Link from "next/link"

export default function TerminalPage() {
  const { address, isConnected } = useAccount()
  const { positions, trackRecord, isLoading, error, refetch } = useBotPositions()

  return (
    <main className="min-h-screen bg-black text-white font-mono overflow-x-hidden">
      {/* Grain overlay */}
      <div
        className="fixed inset-0 z-[800] pointer-events-none opacity-[0.028]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "180px",
        }}
      />

      {/* Grid bg */}
      <div
        className="fixed inset-0 z-0 pointer-events-none opacity-[0.018]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.018) 1px, transparent 1px)
          `,
          backgroundSize: "44px 44px",
        }}
      />

      <div className="relative z-10">
        {/* Nav */}
        <nav className="fixed top-0 left-0 right-0 z-500 px-6 py-5 flex items-center justify-between bg-gradient-to-b from-black/85 to-transparent backdrop-blur-sm">
          <div className="font-bold text-base tracking-tight flex items-baseline gap-1">
            BLACK<span className="font-serif italic text-[#10b981]">EDGE</span>
          </div>
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2 text-[8px] tracking-[0.25em] text-[#10b981]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
              LIVE
            </div>
            <ConnectButton.Custom>
              {({ openConnectModal, openAccountModal, account }) => {
                if (account) {
                  return (
                    <button
                      onClick={openAccountModal}
                      className="px-4 py-2 border border-white/12 text-white text-[8px] tracking-[0.2em] bg-white/[0.025] rounded-sm hover:border-[#10b981] hover:bg-[#10b981]/[0.08] transition-all"
                    >
                      {account.displayName}
                    </button>
                  )
                }
                return (
                  <button
                    onClick={openConnectModal}
                    className="px-4 py-2 border border-white/12 text-white text-[8px] tracking-[0.2em] bg-white/[0.025] rounded-sm hover:border-[#10b981] hover:bg-[#10b981]/[0.08] transition-all"
                  >
                    CONNECT WALLET
                  </button>
                )
              }}
            </ConnectButton.Custom>
          </div>
        </nav>

        {/* Hero — visible when NOT connected */}
        {!isConnected && (
          <section className="min-h-screen flex items-center justify-center px-6 pt-24 pb-16">
            <div className="max-w-[900px] mx-auto text-center">
              <div className="text-[8px] tracking-[0.35em] text-[#10b981] flex items-center justify-center gap-3 mb-8">
                <span className="w-7 h-px bg-[#10b981]" />
                PREDICTION MARKET INTELLIGENCE
              </div>
              <h1 className="font-bold text-[clamp(48px,8vw,100px)] leading-[0.95] tracking-[-0.04em] mb-6">
                The <span className="text-[#10b981]">edge</span>
                <br />
                is in the
                <br />
                <span className="font-serif italic text-white/55 text-[0.7em]">data.</span>
              </h1>
              <p className="text-sm text-white/40 max-w-md mx-auto leading-relaxed mb-10">
                5 AI agents analyze every Polymarket position. They debate. They vote. One exists only to say no.
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                <Link
                  href="/#pricing"
                  className="inline-flex items-center gap-2.5 px-8 py-3.5 border border-white/15 text-white text-[9px] tracking-[0.2em] rounded-sm hover:border-[#10b981] transition-all relative overflow-hidden group"
                >
                  <span className="relative z-10">GET ACCESS</span>
                  <span className="relative z-10">→</span>
                  <span className="absolute inset-0 bg-[#10b981] scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300" />
                </Link>
                <ConnectButton.Custom>
                  {({ openConnectModal, account }) =>
                    !account ? (
                      <button
                        onClick={openConnectModal}
                        className="inline-flex items-center gap-2 px-8 py-3.5 border border-[#10b981] text-[#10b981] text-[9px] tracking-[0.2em] rounded-sm hover:bg-[#10b981] hover:text-black transition-all"
                      >
                        CONNECT WALLET
                      </button>
                    ) : null
                  }
                </ConnectButton.Custom>
              </div>
            </div>
          </section>
        )}

        {/* Dashboard — visible when wallet connected */}
        {isConnected && (
          <section className="min-h-screen pt-28 pb-16 px-6">
            <div className="max-w-[1200px] mx-auto">
              <div className="mb-10">
                <div className="text-[8px] tracking-[0.35em] text-[#10b981] flex items-center gap-2.5 mb-4">
                  <span className="w-5 h-px bg-[#10b981]/50" />
                  BOT DASHBOARD
                </div>
                <h2 className="text-[clamp(32px,5vw,56px)] font-bold tracking-[-0.03em] leading-tight">
                  Positions ouvertes
                  <br />
                  <span className="font-serif italic text-white/45">par le bot</span>
                </h2>
                <p className="text-xs text-white/35 mt-3">
                  Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
                </p>
              </div>

              {/* Stats */}
              {trackRecord && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-px border border-white/[0.07] rounded-sm overflow-hidden mb-10">
                  {[
                    { label: "TOTAL TRADES", val: trackRecord.total_predictions },
                    { label: "RÉSOLUS", val: trackRecord.total_resolved },
                    {
                      label: "WIN RATE",
                      val: `${(trackRecord.win_rate * 100).toFixed(1)}%`,
                      green: true,
                    },
                    {
                      label: "TOTAL P&L",
                      val: `$${trackRecord.total_pnl?.toFixed(2) ?? "0"}`,
                      green: (trackRecord.total_pnl ?? 0) >= 0,
                    },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="p-4 bg-white/[0.025] border-r border-white/[0.07] last:border-r-0"
                    >
                      <div
                        className={`text-xl font-bold tracking-tight ${
                          s.green ? "text-[#10b981]" : "text-white"
                        }`}
                      >
                        {s.val}
                      </div>
                      <div className="text-[8px] tracking-[0.2em] text-white/30 mt-1">
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Positions table */}
              <div className="border border-white/[0.07] rounded overflow-hidden bg-black/40 backdrop-blur-xl">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.07] bg-white/[0.02]">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <div className="w-2 h-2 rounded-full bg-yellow-500" />
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-[9px] tracking-[0.2em] text-white/30 ml-3">
                    BLACK EDGE / BOT POSITIONS — LIVE
                  </span>
                </div>
                {isLoading ? (
                  <div className="p-12 text-center text-white/40 text-sm">
                    Chargement des positions...
                  </div>
                ) : error ? (
                  <div className="p-12 text-center text-red-400 text-sm">{error}</div>
                ) : positions.length === 0 ? (
                  <div className="p-12 text-center text-white/40 text-sm">
                    Aucune position ouverte. Le bot analysera les marchés et ouvrira des positions
                    automatiquement.
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="text-[7px] tracking-[0.3em] text-white/20">
                        <th className="text-left p-4 font-normal">MARCHÉ</th>
                        <th className="text-left p-4 font-normal">SIDE</th>
                        <th className="text-left p-4 font-normal">PRIX</th>
                        <th className="text-left p-4 font-normal">SIZE</th>
                        <th className="text-left p-4 font-normal">EDGE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((p) => (
                        <tr
                          key={p.id}
                          className="border-t border-white/[0.025] hover:bg-white/[0.015] transition-colors"
                        >
                          <td className="p-4 font-semibold text-sm">
                            {p.question.length > 50 ? p.question.slice(0, 50) + "…" : p.question}
                          </td>
                          <td className="p-4">
                            <span
                              className={
                                p.prediction === "YES"
                                  ? "text-[#10b981] font-bold"
                                  : "text-red-400 font-bold"
                              }
                            >
                              {p.prediction}
                            </span>
                          </td>
                          <td className="p-4 text-white/70">
                            {(p.entry_price * 100).toFixed(1)}%
                          </td>
                          <td className="p-4 text-white/70">
                            ${p.size_usd?.toFixed(0) ?? "—"}
                          </td>
                          <td className="p-4 text-[#10b981]">
                            +{(p.edge * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="mt-6 flex gap-4">
                <button
                  onClick={refetch}
                  disabled={isLoading}
                  className="px-4 py-2 border border-white/10 text-white/40 hover:border-white/20 hover:text-white/60 text-[8px] tracking-[0.2em] transition-all disabled:opacity-50"
                >
                  REFRESH
                </button>
                <Link
                  href="/#markets"
                  className="px-4 py-2 border border-[#10b981]/30 text-[#10b981] hover:bg-[#10b981]/10 text-[8px] tracking-[0.2em] transition-all"
                >
                  VOIR MARCHÉS
                </Link>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
