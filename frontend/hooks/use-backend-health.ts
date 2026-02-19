"use client"

import { useState, useEffect, useCallback } from "react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
const PING_INTERVAL_MS = 30_000

export function useBackendHealth() {
  const [isOnline, setIsOnline] = useState<boolean | null>(null)

  const ping = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      })
      const data = await res.json().catch(() => ({}))
      setIsOnline(res.ok && data?.status === "healthy")
    } catch {
      setIsOnline(false)
    }
  }, [])

  useEffect(() => {
    ping()
    const id = setInterval(ping, PING_INTERVAL_MS)
    return () => clearInterval(id)
  }, [ping])

  return { isOnline }
}
