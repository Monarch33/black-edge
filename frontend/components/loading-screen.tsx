"use client"

import { motion } from "framer-motion"
import Image from "next/image"

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0D0D1A]">
      <div className="flex flex-col items-center">
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="relative"
        >
          <Image
            src="/logo-blackedge.png"
            alt="Black Edge"
            width={80}
            height={80}
            className="drop-shadow-[0_0_30px_rgba(255,255,255,0.4)]"
            priority
          />

          {/* Outer glow ring */}
          <motion.div
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.5, 0, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute inset-0 border-2 border-white/30 rounded-full"
            style={{ filter: "blur(8px)" }}
          />
        </motion.div>

        <motion.div
          animate={{
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="mt-8 text-white/60 text-sm tracking-[0.3em] font-mono"
        >
          LOADING...
        </motion.div>
      </div>
    </div>
  )
}
