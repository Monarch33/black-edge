"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function BlackEdgeAd() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), 3000),
      setTimeout(() => setStage(2), 6000),
      setTimeout(() => setStage(3), 9000),
      setTimeout(() => setStage(4), 12000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="fixed inset-0 bg-[#0A0A0A] overflow-hidden flex items-center justify-center font-sans text-[#F5F5F5]">
      {/* Background Grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: stage >= 0 ? 0.15 : 0 }}
        transition={{ duration: 2, ease: EASE }}
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `linear-gradient(to right, #10B981 1px, transparent 1px), linear-gradient(to bottom, #10B981 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      <AnimatePresence mode="wait">
        {/* STAGE 0 — Cold Open */}
        {stage === 0 && (
          <motion.div
            key="cold-open"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 1, ease: EASE }}
            className="flex flex-col items-center z-10"
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: 200 }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut",
              }}
              className="h-[1px] bg-[#10B981] mb-8"
            />
            <h1 className="text-2xl tracking-[0.3em] uppercase font-light">
              The Edge is Quantitative
            </h1>
          </motion.div>
        )}

        {/* STAGE 1 — Product Reveal */}
        {stage === 1 && (
          <motion.div
            key="product-reveal"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 1, ease: EASE }}
            className="relative z-10 w-full max-w-4xl p-8 border border-[#10B981]/20 bg-[#0A0A0A]/80 backdrop-blur-xl rounded-lg shadow-2xl"
          >
            <div className="flex justify-between items-center mb-6 border-b border-[#10B981]/10 pb-4">
              <div className="flex space-x-2">
                <div className="w-2 h-2 rounded-full bg-[#10B981]" />
                <div className="w-2 h-2 rounded-full bg-[#10B981]/30" />
                <div className="w-2 h-2 rounded-full bg-[#10B981]/30" />
              </div>
              <div className="text-[10px] uppercase tracking-widest text-[#10B981]">
                Terminal v3.0 // Active
              </div>
            </div>
            <div className="grid grid-cols-12 gap-4 h-64">
              <div className="col-span-8 bg-[#10B981]/5 rounded p-4 relative overflow-hidden">
                <motion.div
                  animate={{ x: [0, -100, 0] }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(90deg, #10B981, #10B981 1px, transparent 1px, transparent 40px)",
                  }}
                />
                <div className="h-full flex items-end space-x-1">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 20 }}
                      animate={{ height: Math.random() * 80 + 20 }}
                      transition={{
                        duration: 0.5,
                        repeat: Infinity,
                        repeatType: "reverse",
                        delay: i * 0.05,
                      }}
                      className="flex-1 bg-[#10B981]/40"
                    />
                  ))}
                </div>
              </div>
              <div className="col-span-4 space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-12 bg-[#10B981]/10 rounded flex items-center px-4 justify-between"
                  >
                    <div className="w-1/2 h-1 bg-[#10B981]/20 rounded" />
                    <motion.div
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        delay: i * 0.2,
                      }}
                      className="text-[#10B981] text-xs font-mono"
                    >
                      +{(Math.random() * 5).toFixed(2)}%
                    </motion.div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* STAGE 2 — Intelligence in Motion */}
        {stage === 2 && (
          <motion.div
            key="intelligence"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center z-10 w-full max-w-5xl px-8"
          >
            <div className="grid grid-cols-3 gap-8 w-full">
              {[
                { label: "Signal Detection", text: "WAVEFORM LOCKED" },
                { label: "Kelly Criterion", text: "OPTIMAL SIZE: 4.2%" },
                { label: "Portfolio Execution", text: "EXECUTING..." },
              ].map((panel, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.2, duration: 0.8, ease: EASE }}
                  className="flex flex-col items-center space-y-4"
                >
                  <div className="w-full aspect-square border border-[#10B981]/30 rounded-full flex items-center justify-center relative overflow-hidden">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="absolute inset-0 border-t-2 border-[#10B981] rounded-full"
                    />
                    <div className="text-[10px] uppercase tracking-tighter text-[#10B981]/60">
                      {panel.label}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-[#10B981] mb-1 uppercase tracking-widest">
                      {panel.text}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-12"
            >
              <h2 className="text-xl tracking-[0.2em] uppercase font-light text-center">
                AI-Powered Signals. Automated Execution.
              </h2>
            </motion.div>
          </motion.div>
        )}

        {/* STAGE 3 — The Promise / Logo */}
        {stage === 3 && (
          <motion.div
            key="promise"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: EASE }}
            className="flex flex-col items-center z-10"
          >
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-12 h-12 border-2 border-[#10B981] rotate-45 flex items-center justify-center">
                <div className="w-6 h-6 bg-[#10B981]" />
              </div>
              <h1 className="text-5xl font-bold tracking-tighter">
                BLACK EDGE
              </h1>
            </div>
            <p className="text-[#10B981] uppercase tracking-[0.4em] text-sm font-light">
              Prediction Market Intelligence
            </p>
          </motion.div>
        )}

        {/* STAGE 4 — CTA */}
        {stage === 4 && (
          <motion.div
            key="cta"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center z-10"
          >
            <div className="flex items-center space-x-4 mb-8">
              <div className="w-8 h-8 border border-[#10B981] rotate-45 flex items-center justify-center">
                <div className="w-4 h-4 bg-[#10B981]" />
              </div>
              <h1 className="text-3xl font-bold tracking-tighter">
                BLACK EDGE
              </h1>
            </div>
            <div className="relative cursor-pointer">
              <span className="text-2xl font-light tracking-widest">
                blackedge.app
              </span>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ delay: 0.5, duration: 1, ease: EASE }}
                className="absolute -bottom-2 left-0 h-[1px] bg-[#10B981]"
              />
            </div>
            {/* Particle dust */}
            <div className="absolute bottom-10 flex space-x-2">
              {Array.from({ length: 20 }).map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ y: [0, -100], opacity: [0, 0.3, 0] }}
                  transition={{
                    duration: 2 + Math.random() * 2,
                    repeat: Infinity,
                    delay: Math.random() * 2,
                  }}
                  className="w-[1px] h-[1px] bg-white rounded-full"
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
