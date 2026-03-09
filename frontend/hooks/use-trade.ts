/**
 * useTrade Hook
 * Executes trades via the backend API (not directly on-chain).
 * The backend handles Polymarket CLOB order placement.
 */

import { useState, useCallback } from "react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export type TradeStatus =
  | "idle"
  | "submitting"
  | "success"
  | "error"

export interface TradeResult {
  status: TradeStatus
  orderId?: string
  error?: string
}

export function useTrade() {
  const [status, setStatus] = useState<TradeStatus>("idle")
  const [error, setError] = useState<string | undefined>()
  const [lastOrderId, setLastOrderId] = useState<string | undefined>()

  /**
   * Execute trade via backend API.
   * The backend uses the user's stored Polymarket credentials
   * to place the order on the CLOB.
   */
  const executeTrade = useCallback(
    async (
      marketId: string,
      outcome: "YES" | "NO",
      amountUSDC: number
    ): Promise<TradeResult> => {
      try {
        setError(undefined)
        setStatus("submitting")

        const response = await fetch(`${API_URL}/api/v2/trade/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token_id: marketId,
            side: outcome === "YES" ? "BUY" : "SELL",
            amount: amountUSDC,
            order_type: "MARKET",
          }),
        })

        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || data.detail || `Trade failed (${response.status})`)
        }

        const data = await response.json()
        const orderId = data.order_id

        setLastOrderId(orderId)
        setStatus("success")

        // Reset status after 3s
        setTimeout(() => setStatus("idle"), 3000)

        return { status: "success", orderId }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Trade failed"
        setStatus("error")
        setError(message)

        // Reset status after 5s
        setTimeout(() => {
          setStatus("idle")
          setError(undefined)
        }, 5000)

        return { status: "error", error: message }
      }
    },
    []
  )

  const reset = useCallback(() => {
    setStatus("idle")
    setError(undefined)
    setLastOrderId(undefined)
  }, [])

  return {
    executeTrade,
    reset,
    status,
    error,
    orderId: lastOrderId,
    isSubmitting: status === "submitting",
    isSuccess: status === "success",
    isError: status === "error",
  }
}
