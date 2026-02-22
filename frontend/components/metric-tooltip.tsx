"use client"

import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { Info } from "lucide-react"

interface MetricTooltipProps {
  label: string
  tip: string
}

export function MetricTooltip({ label, tip }: MetricTooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <span className="text-[9px] tracking-wider text-white/40 flex items-center gap-1.5 cursor-help">
            {label}
            <Info size={10} className="text-white/20" />
          </span>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side="top"
            sideOffset={8}
            className="z-[1000] max-w-[260px] p-3 bg-black border border-emerald-500/20 shadow-[0_0_16px_rgba(16,185,129,.1)] font-mono text-[10px] text-white/60 leading-relaxed"
          >
            {tip}
            <TooltipPrimitive.Arrow className="fill-emerald-500/20" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
