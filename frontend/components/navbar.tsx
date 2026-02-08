"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Zap, Menu, X, ChevronDown, Copy, ExternalLink, Power } from "lucide-react"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useAccount, useBalance, useDisconnect } from "wagmi"
import { useWalletState } from "./providers"
import Image from "next/image"

type View = "landing" | "methodology" | "pricing" | "terminal" | "portfolio"

interface NavbarProps {
  currentView: View
  onNavigate: (view: View) => void
}

function WalletButton() {
  const { address, isConnected, isConnecting } = useAccount()
  const { data: balance } = useBalance({ address })
  const { disconnect } = useDisconnect()
  const { addWallet, connectedWallets } = useWalletState()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (address && isConnected) {
      addWallet(address)
    }
  }, [address, isConnected, addWallet])

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== "loading"
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === "authenticated")

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: { opacity: 0, pointerEvents: "none", userSelect: "none" },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    className="relative flex items-center gap-2 px-4 py-2 border border-white/10 text-white/50 hover:border-red-500/50 hover:text-white/80 text-xs tracking-wider transition-all group min-h-[44px] bg-[#020408]"
                  >
                    {isConnecting ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-3 h-3 border border-red-500 border-t-transparent rounded-full"
                        />
                        <span className="hidden sm:inline">CONNECTING...</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 rounded-full bg-red-500/50 group-hover:bg-red-500 transition-colors" />
                        <span className="hidden sm:inline">CONNECT WALLET</span>
                        <span className="sm:hidden">CONNECT</span>
                      </>
                    )}
                    <span className="absolute inset-0 shadow-[0_0_20px_rgba(220,38,38,0.2)] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/50 text-red-500 text-xs tracking-wider min-h-[44px]"
                  >
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    WRONG NETWORK
                  </button>
                )
              }

              return (
                <div className="relative">
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center gap-2 px-3 py-2 bg-[#020408] border border-green-500/30 text-white/80 text-xs tracking-wider min-h-[44px] hover:border-green-500/50 transition-all"
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); openChainModal() }}
                      className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      {chain.hasIcon && (
                        <div
                          className="w-4 h-4 rounded-full overflow-hidden"
                          style={{ background: chain.iconBackground }}
                        >
                          {chain.iconUrl && (
                            <img alt={chain.name ?? "Chain"} src={chain.iconUrl} className="w-4 h-4" />
                          )}
                        </div>
                      )}
                    </button>
                    <div className="flex flex-col items-start">
                      <span className="text-green-500 font-mono">{account.displayName}</span>
                      <span className="text-[10px] text-white/40">
                        {account.displayBalance ? account.displayBalance : "Loading..."}
                      </span>
                    </div>
                    <ChevronDown className={`w-3 h-3 text-white/40 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  </button>

                  <AnimatePresence>
                    {isDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full right-0 mt-2 w-64 bg-[#020408] border border-white/10 shadow-xl z-50"
                      >
                        <div className="px-4 py-3 border-b border-white/5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-white/40 tracking-widest">CONNECTED WALLET</span>
                            <span className="flex items-center gap-1 text-[10px] text-green-500">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                              LIVE
                            </span>
                          </div>
                        </div>
                        <div className="px-4 py-3 border-b border-white/5">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-white font-mono">{truncateAddress(account.address)}</span>
                            <div className="flex items-center gap-2">
                              <button onClick={copyAddress} className="p-1.5 hover:bg-white/5 transition-colors" title="Copy">
                                <Copy className={`w-3 h-3 ${copied ? "text-green-500" : "text-white/40"}`} />
                              </button>
                              <a
                                href={`https://etherscan.io/address/${account.address}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 hover:bg-white/5 transition-colors"
                                title="Etherscan"
                              >
                                <ExternalLink className="w-3 h-3 text-white/40" />
                              </a>
                            </div>
                          </div>
                          <div className="text-lg text-white font-mono">{account.displayBalance}</div>
                        </div>
                        {connectedWallets.length > 1 && (
                          <div className="px-4 py-3 border-b border-white/5">
                            <span className="text-[10px] text-white/40 tracking-widest mb-2 block">
                              ALL WALLETS ({connectedWallets.length})
                            </span>
                            <div className="space-y-1">
                              {connectedWallets.map((wallet) => (
                                <div
                                  key={wallet}
                                  className={`flex items-center justify-between px-2 py-1.5 text-xs font-mono ${
                                    wallet === account.address
                                      ? "bg-green-500/10 text-green-500"
                                      : "text-white/50 hover:bg-white/5"
                                  }`}
                                >
                                  {truncateAddress(wallet)}
                                  {wallet === account.address && <span className="text-[10px]">ACTIVE</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="p-2">
                          <button
                            onClick={() => { openAccountModal(); setIsDropdownOpen(false) }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/60 hover:bg-white/5 hover:text-white/80 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View Account
                          </button>
                          <button
                            onClick={() => { disconnect(); setIsDropdownOpen(false) }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500/70 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                          >
                            <Power className="w-3 h-3" />
                            Disconnect
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })()}
          </div>
        )
      }}
    </ConnectButton.Custom>
  )
}

export function Navbar({ currentView, onNavigate }: NavbarProps) {
  const [isHovering, setIsHovering] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { isConnected } = useAccount()

  const baseNavItems = [
    { label: "HOME", view: "landing" as View },
    { label: "THE BLACK BOX", view: "methodology" as View },
    { label: "ACCESS", view: "pricing" as View },
  ]

  const connectedNavItems = isConnected ? [
    { label: "TERMINAL", view: "terminal" as View },
    { label: "PORTFOLIO", view: "portfolio" as View },
  ] : []

  const navItems = [...baseNavItems, ...connectedNavItems]

  const handleNavigate = (view: View) => {
    onNavigate(view)
    setIsMobileMenuOpen(false)
  }

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 px-3 md:px-4 py-3 md:py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between px-4 md:px-6 py-3 bg-[#020408]/90 border border-white/[0.06] backdrop-blur-md">
            <button
              onClick={() => handleNavigate("landing")}
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
              className="flex items-center gap-3 group relative"
            >
              {/* Black Edge Logo */}
              <Image
                src="/logo-blackedge.png"
                alt="Black Edge"
                width={40}
                height={40}
                className="hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] transition-all duration-300"
                priority
              />
              <span className="text-white font-bold text-lg tracking-[0.15em] uppercase">
                Black Edge
              </span>
            </button>

            <div className="hidden md:flex items-center gap-8">
              {navItems.map((item) => (
                <button
                  key={item.view}
                  onClick={() => handleNavigate(item.view)}
                  className={`text-xs tracking-widest transition-all duration-300 relative group ${
                    currentView === item.view ? "text-red-500" : "text-white/50 hover:text-white/90"
                  }`}
                >
                  {item.label}
                  {currentView === item.view && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute -bottom-1 left-0 right-0 h-px bg-red-500"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className="absolute -bottom-1 left-0 right-0 h-px bg-white/20 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              <button
                onClick={() => handleNavigate("terminal")}
                className={`relative flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 text-[10px] md:text-xs tracking-wider transition-all group min-h-[44px] ${
                  currentView === "terminal"
                    ? "bg-red-500 text-white border border-red-500"
                    : "bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500/20 hover:border-red-500/50"
                }`}
              >
                <Zap className="w-3 h-3" />
                <span className="hidden sm:inline">LAUNCH TERMINAL</span>
                <span className="sm:hidden">TERMINAL</span>
                {currentView !== "terminal" && (
                  <span className="absolute inset-0 shadow-[0_0_20px_rgba(220,38,38,0.3)] opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
              <div className="hidden md:block">
                <WalletButton />
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden flex items-center justify-center w-11 h-11 border border-white/10 text-white/50"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] md:hidden"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-sm bg-[#020408]/95 border-l border-white/[0.06] backdrop-blur-md z-[70] md:hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                <span className="text-xs text-white/50 tracking-widest">NAVIGATION</span>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-center w-11 h-11 border border-white/10 text-white/50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {navItems.map((item, i) => (
                  <motion.button
                    key={item.view}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                    onClick={() => handleNavigate(item.view)}
                    className={`block w-full text-left text-2xl font-bold tracking-wider py-4 border-b transition-colors min-h-[60px] ${
                      currentView === item.view
                        ? "text-red-500 border-red-500/30"
                        : "text-white/70 border-white/5 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </motion.button>
                ))}
                <motion.button
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 }}
                  onClick={() => handleNavigate("terminal")}
                  className={`block w-full text-left text-2xl font-bold tracking-wider py-4 border-b transition-colors min-h-[60px] ${
                    currentView === "terminal"
                      ? "text-red-500 border-red-500/30"
                      : "text-white/70 border-white/5 hover:text-white"
                  }`}
                >
                  TERMINAL
                </motion.button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-white/[0.06]">
                <WalletButton />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
