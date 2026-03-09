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

  // Handle email — join waitlist via backend API
  const handleEmailSignIn = useCallback(async () => {
    if (!email.trim() || !email.includes("@")) return;
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/api/v2/waitlist/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.ok) {
        onSuccess(email.trim());
      }
    } catch {
      // Service unavailable — still allow local-only access
      onSuccess(email.trim());
    } finally {
      setLoading(false);
    }
  }, [email, onSuccess]);

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
