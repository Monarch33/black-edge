// ─── AUTH MODAL — Phase 4: Web2 + Web3 hybrid login ──────────────────────────
// Dark glass modal with Google/Apple OAuth stubs + Web3 wallet connect
// ═════════════════════════════════════════════════════════════════════════════

"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (label: string) => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { openConnectModal } = useConnectModal();
  const { address, isConnected } = useAccount();

  // Handle Web3 wallet connect
  const handleWalletConnect = useCallback(() => {
    if (isConnected && address) {
      onSuccess(`${address.slice(0, 6)}...${address.slice(-4)}`);
      return;
    }
    openConnectModal?.();
  }, [isConnected, address, onSuccess, openConnectModal]);

  // Watch for wallet connection
  const handleWeb3Success = useCallback(() => {
    if (isConnected && address) {
      onSuccess(`${address.slice(0, 6)}...${address.slice(-4)}`);
    }
  }, [isConnected, address, onSuccess]);

  // If wallet connects while modal is open
  if (isConnected && address && isOpen) {
    handleWeb3Success();
  }

  // Handle email magic link (stub — wire to NextAuth/Clerk)
  const handleEmailSignIn = useCallback(async () => {
    if (!email.trim()) return;
    setLoading(true);
    // Stub: In production, call NextAuth/Clerk signIn endpoint
    setTimeout(() => {
      onSuccess(email);
      setLoading(false);
    }, 800);
  }, [email, onSuccess]);

  // Handle OAuth (stub — wire to NextAuth/Clerk)
  const handleOAuth = useCallback(
    (provider: string) => {
      // Stub: In production, call NextAuth signIn(provider)
      onSuccess(`${provider} user`);
    },
    [onSuccess]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9998] flex items-center justify-center"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-[380px] rounded-2xl border border-white/[0.06] bg-[#0A0A0A]/95 backdrop-blur-xl shadow-[0_32px_80px_rgba(0,0,0,0.8)] overflow-hidden"
          >
            {/* Top glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-px bg-gradient-to-r from-transparent via-[#00FF88]/20 to-transparent" />

            <div className="p-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-[14px] font-semibold tracking-[-0.01em]" style={{ fontFamily: "Syne" }}>
                    Connect
                  </h2>
                  <p className="text-[11px] text-white/20 mt-1">Sign in to access the terminal</p>
                </div>
                <button onClick={onClose} className="text-white/20 hover:text-white/50 transition-colors text-lg leading-none p-1">
                  &times;
                </button>
              </div>

              {/* Web3 Wallet */}
              <button
                onClick={handleWalletConnect}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all group mb-3"
              >
                <div className="w-8 h-8 rounded-lg bg-[#00FF88]/10 flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="2" y="5" width="12" height="8" rx="1.5" stroke="#00FF88" strokeWidth="1.2" />
                    <path d="M10.5 9a.5.5 0 110 1 .5.5 0 010-1z" fill="#00FF88" />
                    <path d="M4 5V4a2 2 0 012-2h4a2 2 0 012 2v1" stroke="#00FF88" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="text-[13px] font-medium text-white/80 group-hover:text-white transition-colors">Web3 Wallet</div>
                  <div className="text-[10px] text-white/20">MetaMask, WalletConnect, Coinbase</div>
                </div>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="ml-auto opacity-20 group-hover:opacity-40 transition-opacity">
                  <path d="M4.5 3L7.5 6 4.5 9" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-white/[0.04]" />
                <span className="font-mono text-[9px] text-white/[0.08] tracking-[0.15em]">OR</span>
                <div className="flex-1 h-px bg-white/[0.04]" />
              </div>

              {/* OAuth buttons */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => handleOAuth("Google")}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-white/[0.06] hover:border-white/[0.1] hover:bg-white/[0.02] transition-all"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  <span className="text-[11px] text-white/40">Google</span>
                </button>
                <button
                  onClick={() => handleOAuth("Apple")}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-white/[0.06] hover:border-white/[0.1] hover:bg-white/[0.02] transition-all"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white" fillOpacity="0.5">
                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                  </svg>
                  <span className="text-[11px] text-white/40">Apple</span>
                </button>
              </div>

              {/* Email */}
              <div className="space-y-3">
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleEmailSignIn()}
                  className="w-full bg-transparent border border-white/[0.06] rounded-xl px-4 py-3 text-[13px] text-white/80 font-mono placeholder:text-white/[0.1] focus:border-[#00FF88]/20 focus:outline-none transition-colors"
                />
                <button
                  onClick={handleEmailSignIn}
                  disabled={loading || !email.trim()}
                  className="w-full py-3 rounded-xl border border-white/[0.06] text-[11px] font-mono tracking-[0.1em] text-white/30 hover:text-white/60 hover:border-white/[0.12] transition-all disabled:opacity-30"
                >
                  {loading ? "SENDING..." : "CONTINUE WITH EMAIL"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
