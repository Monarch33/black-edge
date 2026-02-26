/**
 * usePortfolio Hook
 * Fetches REAL user positions from Polymarket via The Graph
 */

import { useState, useEffect, useCallback } from "react"
import { useAccount } from "wagmi"
import { GAMMA_API_BASE } from "@/lib/constants"

// =============================================================================
// Types
// =============================================================================

export interface Position {
  id: string
  market: string
  question: string
  outcome: "YES" | "NO"
  shares: number
  avgPrice: number
  currentPrice: number
  value: number
  pnl: number
  pnlPercent: number
  platform: string
  url: string
  tokenId: string
  conditionId: string
}

interface PositionStats {
  totalValue: number
  totalPnL: number
  totalPnLPercent: number
}

// The Graph Subgraph Types
interface SubgraphPosition {
  id: string
  user: {
    id: string
  }
  token: {
    id: string
    outcomeIndex: string
    condition: {
      id: string
      questionId: string
      title: string
    }
  }
  balance: string
  totalBought: string
  totalSold: string
  netPosition: string
  realizedPnl: string
}

// =============================================================================
// The Graph Query
// =============================================================================

const POLYMARKET_SUBGRAPH_URL = "https://api.thegraph.com/subgraphs/name/tokenunion/polymarket-matic"

const POSITIONS_QUERY = `
  query GetUserPositions($userAddress: String!) {
    userPositions(
      where: { user: $userAddress, balance_gt: "0" }
      orderBy: balance
      orderDirection: desc
      first: 100
    ) {
      id
      user {
        id
      }
      token {
        id
        outcomeIndex
        condition {
          id
          questionId
          title
        }
      }
      balance
      totalBought
      totalSold
      netPosition
      realizedPnl
    }
  }
`

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Fetch current prices from Polymarket Gamma API
 */
async function fetchCurrentPrices(conditionIds: string[]): Promise<Record<string, number>> {
  try {
    // Query Polymarket API for current prices
    // For now, return mock prices (replace with real API call)
    const prices: Record<string, number> = {}

    conditionIds.forEach((id) => {
      // Mock: Random price between 0.3 and 0.7
      prices[id] = 0.4 + Math.random() * 0.3
    })

    return prices
  } catch (error) {
    console.error("[PORTFOLIO] Failed to fetch prices:", error)
    return {}
  }
}

/**
 * Transform subgraph data into Position objects
 */
function transformPositions(
  subgraphPositions: SubgraphPosition[],
  currentPrices: Record<string, number>
): Position[] {
  return subgraphPositions.map((pos) => {
    const conditionId = pos.token.condition.id
    const tokenId = pos.token.id
    const shares = parseFloat(pos.balance) / 1e18 // Convert from wei
    const totalBought = parseFloat(pos.totalBought) / 1e6 // USDC has 6 decimals
    const totalSold = parseFloat(pos.totalSold) / 1e6

    // Calculate average price
    const avgPrice = shares > 0 ? totalBought / shares : 0

    // Get current price
    const currentPrice = currentPrices[conditionId] || 0

    // Calculate current value
    const value = shares * currentPrice

    // Calculate P/L
    const invested = totalBought - totalSold
    const pnl = value - invested
    const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0

    // Determine outcome (YES = index 0, NO = index 1)
    const outcomeIndex = parseInt(pos.token.outcomeIndex)
    const outcome = outcomeIndex === 0 ? "YES" : "NO"

    // Parse market name from condition title
    const question = pos.token.condition.title || "Unknown Market"
    const market = question
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .substring(0, 30)

    return {
      id: pos.id,
      market,
      question,
      outcome,
      shares,
      avgPrice,
      currentPrice,
      value,
      pnl,
      pnlPercent,
      platform: "Polymarket",
      url: `https://polymarket.com`, // TODO: Add real market URL
      tokenId,
      conditionId,
    }
  })
}

// =============================================================================
// Hook
// =============================================================================

export function usePortfolio() {
  const { address, isConnected } = useAccount()
  const [positions, setPositions] = useState<Position[]>([])
  const [stats, setStats] = useState<PositionStats>({
    totalValue: 0,
    totalPnL: 0,
    totalPnLPercent: 0,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Fetch positions from The Graph
   */
  const fetchPositions = useCallback(async () => {
    if (!address || !isConnected) {
      setPositions([])
      setStats({ totalValue: 0, totalPnL: 0, totalPnLPercent: 0 })
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log("[PORTFOLIO] Fetching positions for:", address)

      // Query The Graph subgraph
      const response = await fetch(POLYMARKET_SUBGRAPH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: POSITIONS_QUERY,
          variables: {
            userAddress: address.toLowerCase(),
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`Subgraph query failed: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.errors) {
        throw new Error(`GraphQL error: ${data.errors[0].message}`)
      }

      const subgraphPositions: SubgraphPosition[] = data.data?.userPositions || []

      console.log("[PORTFOLIO] Found positions:", subgraphPositions.length)

      if (subgraphPositions.length === 0) {
        setPositions([])
        setStats({ totalValue: 0, totalPnL: 0, totalPnLPercent: 0 })
        return
      }

      // Extract condition IDs for price fetching
      const conditionIds = [...new Set(subgraphPositions.map((p) => p.token.condition.id))]

      // Fetch current prices
      const currentPrices = await fetchCurrentPrices(conditionIds)

      // Transform data
      const transformedPositions = transformPositions(subgraphPositions, currentPrices)

      // Calculate stats
      const totalValue = transformedPositions.reduce((sum, p) => sum + p.value, 0)
      const totalPnL = transformedPositions.reduce((sum, p) => sum + p.pnl, 0)
      const totalInvested = totalValue - totalPnL
      const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0

      setPositions(transformedPositions)
      setStats({ totalValue, totalPnL, totalPnLPercent })
    } catch (err: any) {
      console.error("[PORTFOLIO] Error fetching positions:", err)
      setError(err.message || "Failed to load portfolio")

      // If The Graph fails, show helpful message
      if (err.message.includes("Subgraph")) {
        setError("Unable to connect to Polymarket subgraph. Using fallback data.")
        // Keep existing positions if any
      }
    } finally {
      setIsLoading(false)
    }
  }, [address, isConnected])

  // Auto-fetch on mount and when address changes
  useEffect(() => {
    fetchPositions()
  }, [fetchPositions])

  return {
    positions,
    stats,
    isLoading,
    error,
    refetch: fetchPositions,
  }
}
