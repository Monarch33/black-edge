/**
 * useBotPositions — Positions ouvertes par le bot (paper trades)
 */

import { useState, useEffect, useCallback } from "react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export interface BotPosition {
  id: string
  market_id: string
  question: string
  prediction: string
  confidence: number
  edge: number
  entry_price: number
  size_usd: number
  timestamp: number
}

interface TrackRecord {
  total_predictions: number
  total_resolved: number
  win_rate: number
  total_pnl: number
}

export function useBotPositions() {
  const [positions, setPositions] = useState<BotPosition[]>([])
  const [trackRecord, setTrackRecord] = useState<TrackRecord | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPositions = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [posRes, trRes] = await Promise.all([
        fetch(`${API_URL}/api/positions`),
        fetch(`${API_URL}/api/track-record`),
      ])
      const posData = await posRes.json()
      const trData = await trRes.json()
      setPositions(posData.positions || [])
      setTrackRecord(trData.error ? null : trData)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load positions")
      setPositions([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPositions()
    const interval = setInterval(fetchPositions, 30000)
    return () => clearInterval(interval)
  }, [fetchPositions])

  return { positions, trackRecord, isLoading, error, refetch: fetchPositions }
}
