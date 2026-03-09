// ─── ACCOUNT PANEL — Slide-out with real bot status & account info ────────────
// ═════════════════════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface AccountPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userLabel: string;
}

export function AccountPanel({ isOpen, onClose, userLabel }: AccountPanelProps) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [totalTrades, setTotalTrades] = useState(0);
  const [currentPnl, setCurrentPnl] = useState(0);
  const [botStatus, setBotStatus] = useState("STOPPED");
  const [lastLog, setLastLog] = useState("");

  const fetchAccountData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/engine/status`);
      if (res.ok) {
        const data = await res.json();
        setTotalTrades(data.total_trades_count ?? 0);
        setCurrentPnl(data.current_pnl ?? 0);
        setBotStatus(data.status ?? "STOPPED");
        setLastLog(data.last_log ?? "");
      }
    } catch {
      // Backend may be offline
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchAccountData();
    }
  }, [isOpen, fetchAccountData]);

  const handleCopyLabel = async () => {
    try {
      await navigator.clipboard.writeText(userLabel);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API requires HTTPS or localhost
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9997] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed right-0 top-0 bottom-0 z-[9998] w-[420px] max-w-[90vw] bg-[#0A0A0A] border-l border-white/[0.04] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-white/[0.04]">
              <div>
                <h2 className="text-[14px] font-semibold tracking-[-0.01em]" style={{ fontFamily: "Syne" }}>
                  Account
                </h2>
                <p className="text-[11px] text-white/20 mt-1 font-mono truncate max-w-[280px]">{userLabel}</p>
              </div>
              <button onClick={onClose} className="text-white/20 hover:text-white/50 transition-colors text-lg leading-none p-2" aria-label="Close">
                &times;
              </button>
            </div>

            <div className="px-8 py-8 space-y-8">
              {/* ── Bot Status ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[9px] tracking-[0.2em] text-white/20">BOT STATUS</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${botStatus === "RUNNING" ? "bg-[#00FF88] animate-pulse" : "bg-white/15"}`} />
                    <span className={`font-mono text-[10px] tracking-wide ${botStatus === "RUNNING" ? "text-[#00FF88]/60" : "text-white/30"}`}>
                      {loading ? "..." : botStatus}
                    </span>
                  </div>
                </div>
                {lastLog && (
                  <p className="font-mono text-[10px] text-white/20 truncate">{lastLog}</p>
                )}
              </div>

              {/* ── Performance Stats ── */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-white/[0.04] bg-[#060606]">
                  <div className="font-mono text-[9px] tracking-[0.12em] text-white/[0.08] uppercase mb-2">Total Trades</div>
                  <div className="font-mono text-[20px] font-semibold text-white/90 tracking-tight">
                    {loading ? "—" : totalTrades}
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-white/[0.04] bg-[#060606]">
                  <div className="font-mono text-[9px] tracking-[0.12em] text-white/[0.08] uppercase mb-2">Current P&L</div>
                  <div className={`font-mono text-[20px] font-semibold tracking-tight ${currentPnl >= 0 ? "text-[#00FF88]" : "text-red-400"}`}>
                    {loading ? "—" : `${currentPnl >= 0 ? "+" : ""}$${currentPnl.toFixed(2)}`}
                  </div>
                </div>
              </div>

              {/* ── Account ID ── */}
              <div>
                <span className="font-mono text-[9px] tracking-[0.2em] text-white/20 block mb-3">ACCOUNT</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-4 py-3 rounded-xl border border-white/[0.04] bg-white/[0.01] font-mono text-[12px] text-white/40 truncate select-all">
                    {userLabel}
                  </div>
                  <button
                    onClick={handleCopyLabel}
                    className={`px-4 py-3 rounded-xl border transition-all font-mono text-[10px] tracking-wide ${
                      copied
                        ? "border-[#00FF88]/20 text-[#00FF88]/60 bg-[#00FF88]/[0.04]"
                        : "border-white/[0.04] text-white/20 hover:text-white/40 hover:border-white/[0.08]"
                    }`}
                  >
                    {copied ? "COPIED" : "COPY"}
                  </button>
                </div>
              </div>

              {/* ── CLI Installation ── */}
              <div>
                <span className="font-mono text-[9px] tracking-[0.2em] text-white/20 block mb-3">BLACK EDGE CLI</span>
                <div className="p-4 rounded-xl border border-white/[0.04] bg-[#060606]">
                  <code className="font-mono text-[11px] text-[#00FF88]/50 leading-relaxed block">
                    npm install -g black-edge-cli
                  </code>
                  <code className="font-mono text-[11px] text-white/30 leading-relaxed block mt-1">
                    black-edge start
                  </code>
                </div>
                <p className="font-mono text-[9px] text-white/[0.08] mt-2">
                  Stream signals to your local terminal.
                </p>
              </div>

              {/* ── Plan Info ── */}
              <div className="p-5 rounded-2xl border border-white/[0.04] bg-[#060606]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-[9px] tracking-[0.2em] text-white/20 mb-1.5">CURRENT PLAN</div>
                    <div className="text-[16px] font-semibold text-white/80" style={{ fontFamily: "Syne" }}>
                      Runner
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[9px] tracking-[0.2em] text-white/20 mb-1.5">STATUS</div>
                    <div className="font-mono text-[14px] text-[#00FF88]/50">Active</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
