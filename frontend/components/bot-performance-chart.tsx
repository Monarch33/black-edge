"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

const MOCK_DATA = [
  { time: "00:00", pnl: 0, trade: null },
  {
    time: "00:05",
    pnl: 2.5,
    trade:
      "Bot detected 78% win probability \u2192 Executed BUY \u2192 Profit +$2.50",
  },
  { time: "00:10", pnl: 2.5, trade: null },
  {
    time: "00:15",
    pnl: 5.8,
    trade:
      "Orderbook imbalance detected \u2192 Half-Kelly position \u2192 Profit +$3.30",
  },
  { time: "00:20", pnl: 5.8, trade: null },
  {
    time: "00:25",
    pnl: 3.2,
    trade: "Doomer agent vetoed. Stop-loss triggered \u2192 -$2.60",
  },
  {
    time: "00:30",
    pnl: 8.1,
    trade:
      "Strong consensus (4/5 agents) \u2192 Full entry \u2192 Profit +$4.90",
  },
  {
    time: "00:35",
    pnl: 12.5,
    trade:
      "Bot detected 85% win probability \u2192 Executed BUY \u2192 Profit +$4.40",
  },
  { time: "00:40", pnl: 12.5, trade: null },
  {
    time: "00:45",
    pnl: 18.2,
    trade:
      "Narrative shift detected \u2192 Early position \u2192 Profit +$5.70",
  },
  {
    time: "00:50",
    pnl: 22.8,
    trade: "Kelly criterion: max edge \u2192 Profit +$4.60",
  },
  { time: "00:55", pnl: 22.8, trade: null },
  {
    time: "01:00",
    pnl: 28.4,
    trade:
      "5-agent consensus \u2192 Highest confidence \u2192 Profit +$5.60",
  },
]

/* eslint-disable @typescript-eslint/no-explicit-any */
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload
  return (
    <div className="font-mono bg-black/95 border border-emerald-500/30 p-3 max-w-[280px] shadow-[0_0_20px_rgba(16,185,129,.15)]">
      <div className="text-[10px] text-white/40 mb-1">{d.time}</div>
      <div className="text-lg font-bold text-emerald-400">
        +${d.pnl.toFixed(2)}
      </div>
      {d.trade && (
        <div className="text-[10px] text-white/50 mt-2 leading-relaxed border-t border-white/5 pt-2">
          {d.trade}
        </div>
      )}
    </div>
  )
}

export function BotPerformanceChart() {
  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart
          data={MOCK_DATA}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            tick={{
              fill: "rgba(255,255,255,.2)",
              fontSize: 9,
              fontFamily: "monospace",
            }}
            axisLine={{ stroke: "rgba(255,255,255,.06)" }}
            tickLine={false}
          />
          <YAxis
            tick={{
              fill: "rgba(255,255,255,.2)",
              fontSize: 9,
              fontFamily: "monospace",
            }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: "rgba(16,185,129,.2)" }}
          />
          <Area
            type="monotone"
            dataKey="pnl"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#pnlGrad)"
            animationDuration={2000}
            dot={false}
            activeDot={{
              r: 4,
              fill: "#10b981",
              stroke: "#000",
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
