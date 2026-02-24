// ─── ACCOUNT PANEL — Phase 5: API Credit Economy Dashboard ───────────────────
// Slide-out panel with user profile, credit gauge, API key, top-up, usage chart
// ═════════════════════════════════════════════════════════════════════════════

"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface AccountPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userLabel: string;
}

// ─── USAGE SPARKLINE ─────────────────────────────────────────────────────────
function UsageChart({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[3px] h-[48px]">
      {data.map((v, i) => (
        <motion.div
          key={i}
          initial={{ height: 0 }}
          animate={{ height: `${(v / max) * 100}%` }}
          transition={{ delay: i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 rounded-sm bg-[#00FF88]/30 min-h-[2px]"
        />
      ))}
    </div>
  );
}

export function AccountPanel({ isOpen, onClose, userLabel }: AccountPanelProps) {
  const [apiKeyRevealed, setApiKeyRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  // Simulated account data — wire to real API in production
  const credits = { used: 7500, total: 50000 };
  const apiKey = "be_live_sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4";
  const usageData = useMemo(() => [320, 580, 410, 890, 670, 1240, 980], []);
  const daysLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const creditPct = (credits.used / credits.total) * 100;
  const remaining = credits.total - credits.used;

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const maskedKey = `be_live_${"*".repeat(24)}`;
  const displayKey = apiKeyRevealed ? apiKey : maskedKey;

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
            className="fixed right-0 top-0 bottom-0 z-[9998] w-[420px] bg-[#0A0A0A] border-l border-white/[0.04] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-white/[0.04]">
              <div>
                <h2 className="text-[14px] font-semibold tracking-[-0.01em]" style={{ fontFamily: "Syne" }}>
                  Account
                </h2>
                <p className="text-[11px] text-white/20 mt-1 font-mono">{userLabel}</p>
              </div>
              <button onClick={onClose} className="text-white/20 hover:text-white/50 transition-colors text-lg leading-none p-2">
                &times;
              </button>
            </div>

            <div className="px-8 py-8 space-y-8">
              {/* ── Credit Gauge ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[9px] tracking-[0.2em] text-white/20">API CREDITS</span>
                  <span className="font-mono text-[11px] text-white/40">
                    {remaining.toLocaleString()} <span className="text-white/15">/ {credits.total.toLocaleString()}</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/[0.03] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${100 - creditPct}%` }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full rounded-full bg-gradient-to-r from-[#00FF88]/60 to-[#00FF88]/30"
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-mono text-[10px] text-white/[0.08]">{credits.used.toLocaleString()} used</span>
                  <span className="font-mono text-[10px] text-[#00FF88]/40">{remaining.toLocaleString()} remaining</span>
                </div>
              </div>

              {/* ── API Key ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[9px] tracking-[0.2em] text-white/20">BLACK EDGE API KEY</span>
                  <button
                    onClick={() => setApiKeyRevealed(!apiKeyRevealed)}
                    className="font-mono text-[9px] text-white/[0.12] hover:text-white/30 transition-colors tracking-wide"
                  >
                    {apiKeyRevealed ? "HIDE" : "REVEAL"}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-4 py-3 rounded-xl border border-white/[0.04] bg-white/[0.01] font-mono text-[12px] text-white/40 truncate select-all">
                    {displayKey}
                  </div>
                  <button
                    onClick={handleCopyKey}
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

              {/* ── Top-Up Button ── */}
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="w-full h-14 rounded-[14px] font-semibold text-[13px] tracking-[0.18em] uppercase bg-[#00FF88] text-black border border-[#00FF88] shadow-[0_0_0_1px_#00FF88,0_0_24px_rgba(0,255,136,0.2),0_4px_16px_rgba(0,0,0,0.4)] hover:bg-[#00DD77] hover:shadow-[0_0_0_1px_#00FF88,0_0_48px_rgba(0,255,136,0.35),0_4px_24px_rgba(0,0,0,0.5)] transition-all duration-350"
              >
                Purchase Credits
              </motion.button>

              {/* ── Usage Chart ── */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-[9px] tracking-[0.2em] text-white/20">USAGE — LAST 7 DAYS</span>
                  <span className="font-mono text-[10px] text-white/[0.08]">
                    {usageData.reduce((a, b) => a + b, 0).toLocaleString()} calls
                  </span>
                </div>
                <div className="p-5 rounded-2xl border border-white/[0.04] bg-[#060606]">
                  <UsageChart data={usageData} />
                  <div className="flex justify-between mt-3">
                    {daysLabels.map((d) => (
                      <span key={d} className="font-mono text-[8px] text-white/[0.06] flex-1 text-center">
                        {d}
                      </span>
                    ))}
                  </div>
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
                  Stream signals to your local terminal. Uses your API key for authentication.
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
                    <div className="font-mono text-[9px] tracking-[0.2em] text-white/20 mb-1.5">RATE</div>
                    <div className="font-mono text-[14px] text-white/50">$0.002 / call</div>
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
