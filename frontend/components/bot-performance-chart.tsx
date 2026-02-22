"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"

// 30-day monthly compound growth trajectory ending at +$1,240.50
const MOCK_DATA = [
  { day: "Jan 1",  pnl: 0,       trade: null },
  { day: "Jan 3",  pnl: 68.40,   trade: "Council consensus (4/5) \u2192 BTC YES position \u2192 +$68.40" },
  { day: "Jan 5",  pnl: 142.80,  trade: "Kelly edge 14.3% \u2192 Max position size \u2192 +$74.40" },
  { day: "Jan 7",  pnl: 138.20,  trade: "Doomer veto triggered \u2192 Position cut \u2192 -$4.60" },
  { day: "Jan 9",  pnl: 224.60,  trade: "OB imbalance +0.71 \u2192 Strong BUY signal \u2192 +$86.40" },
  { day: "Jan 11", pnl: 312.40,  trade: "Narrative shift detected \u2192 Early entry \u2192 +$87.80" },
  { day: "Jan 13", pnl: 298.80,  trade: "Stop-loss triggered on macro news \u2192 -$13.60" },
  { day: "Jan 15", pnl: 412.50,  trade: "5-agent consensus \u2192 Full Kelly size \u2192 +$113.70" },
  { day: "Jan 17", pnl: 508.20,  trade: "Sentiment surge 9.1/10 \u2192 BUY \u2192 +$95.70" },
  { day: "Jan 19", pnl: 502.40,  trade: "Doomer: liquidity risk detected \u2192 Partial exit \u2192 -$5.80" },
  { day: "Jan 21", pnl: 618.80,  trade: "BS fair value gap 12% \u2192 Max edge \u2192 +$116.40" },
  { day: "Jan 23", pnl: 742.60,  trade: "BTC breakout signal \u2192 Half-Kelly BUY \u2192 +$123.80" },
  { day: "Jan 25", pnl: 738.90,  trade: "Momentum fading \u2192 Risk-off trim \u2192 -$3.70" },
  { day: "Jan 27", pnl: 898.40,  trade: "Whale accumulation detected \u2192 +$159.50" },
  { day: "Jan 29", pnl: 1082.30, trade: "Full council alpha alert \u2192 Max position \u2192 +$183.90" },
  { day: "Jan 30", pnl: 1240.50, trade: "Final session close \u2192 Kelly compounded \u2192 +$158.20" },
]

/* eslint-disable @typescript-eslint/no-explicit-any */
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload
  const isDown = d.trade?.startsWith("Stop") || d.trade?.startsWith("Doomer") || d.trade?.startsWith("Momentum")
  return (
    <div
      className="font-mono bg-black/98 border max-w-[300px] shadow-[0_0_32px_rgba(16,185,129,.2)]"
      style={{ borderColor: isDown ? "rgba(239,68,68,.3)" : "rgba(16,185,129,.3)" }}
    >
      <div className="px-3 pt-3 pb-0">
        <div className="text-[9px] tracking-wider text-white/30 mb-1">{d.day}</div>
        <div
          className="text-xl font-bold tracking-tight"
          style={{ color: isDown ? "#ef4444" : "#10b981" }}
        >
          +${d.pnl.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </div>
      </div>
      {d.trade && (
        <div className="px-3 pb-3 mt-2 pt-2 border-t border-white/5 text-[10px] text-white/45 leading-relaxed">
          {d.trade}
        </div>
      )}
    </div>
  )
}

export function BotPerformanceChart() {
  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={360}>
        <AreaChart
          data={MOCK_DATA}
          margin={{ top: 10, right: 10, left: 8, bottom: 0 }}
        >
          <defs>
            <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#10b981" stopOpacity={0.45} />
              <stop offset="35%"  stopColor="#10b981" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <filter id="chartGlow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <XAxis
            dataKey="day"
            tick={{ fill: "rgba(255,255,255,.18)", fontSize: 8, fontFamily: "monospace" }}
            axisLine={{ stroke: "rgba(255,255,255,.05)" }}
            tickLine={false}
            interval={2}
          />
          <YAxis
            tick={{ fill: "rgba(255,255,255,.18)", fontSize: 8, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
            width={52}
          />
          <ReferenceLine
            y={0}
            stroke="rgba(255,255,255,.05)"
            strokeDasharray="4 4"
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: "rgba(16,185,129,.25)", strokeWidth: 1, strokeDasharray: "4 2" }}
          />
          <Area
            type="monotone"
            dataKey="pnl"
            stroke="#10b981"
            strokeWidth={2.5}
            fill="url(#pnlGrad)"
            animationDuration={2200}
            animationEasing="ease-out"
            dot={false}
            activeDot={{
              r: 5,
              fill: "#10b981",
              stroke: "#000",
              strokeWidth: 2,
              filter: "drop-shadow(0 0 6px rgba(16,185,129,.8))",
            }}
            style={{ filter: "drop-shadow(0 0 4px rgba(16,185,129,.3))" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
