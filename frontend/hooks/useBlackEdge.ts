"use client";

/**
 * useBlackEdge Hook
 * =================
 * Main hook for connecting to the Black Edge arbitrage engine.
 *
 * Handles:
 * - WebSocket connection management
 * - Authentication with Firebase tokens
 * - Real-time opportunity streaming
 * - Execution requests
 * - UI glitch effects for high-profit opportunities
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  UseBlackEdgeReturn,
  ConnectionStatus,
  User,
  UserTier,
  ArbitrageOpportunity,
  ExecutionRequest,
  ExecutionResult,
  WebSocketMessage,
  MessageType,
  ArbitrageType,
} from "@/types";

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_CONFIG = {
  wsUrl: process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/stream",
  apiUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1",
  autoReconnect: true,
  reconnectInterval: 5000,
  glitchOnHighProfit: true,
  highProfitThreshold: 0.1, // 10% ROI triggers glitch
};

// =============================================================================
// Hook Implementation
// =============================================================================

export function useBlackEdge(
  firebaseToken?: string,
  config = DEFAULT_CONFIG
): UseBlackEdgeReturn {
  // Connection state
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [error, setError] = useState<string>();

  // User state
  const [user, setUser] = useState<User>();

  // Data state
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>(
    []
  );
  const [selectedOpportunity, setSelectedOpportunity] =
    useState<ArbitrageOpportunity>();

  // UI state
  const [isGlitching, setIsGlitching] = useState(false);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const sequenceRef = useRef(0);

  // =============================================================================
  // WebSocket Management
  // =============================================================================

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setStatus("connecting");
    setError(undefined);

    // Build URL with optional token
    let url = config.wsUrl;
    if (firebaseToken) {
      url += `?token=${encodeURIComponent(firebaseToken)}`;
    }

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log("[BlackEdge] Connected");
        setStatus(firebaseToken ? "authenticated" : "connected");
      };

      ws.onclose = (event) => {
        console.log("[BlackEdge] Disconnected", event.code, event.reason);
        setStatus("disconnected");
        wsRef.current = null;

        // Auto-reconnect
        if (config.autoReconnect && event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("[BlackEdge] Reconnecting...");
            connect();
          }, config.reconnectInterval);
        }
      };

      ws.onerror = (event) => {
        console.error("[BlackEdge] Error", event);
        setStatus("error");
        setError("WebSocket connection error");
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (e) {
          console.error("[BlackEdge] Failed to parse message", e);
        }
      };

      wsRef.current = ws;
    } catch (e) {
      console.error("[BlackEdge] Failed to connect", e);
      setStatus("error");
      setError(`Connection failed: ${e}`);
    }
  }, [config.wsUrl, config.autoReconnect, config.reconnectInterval, firebaseToken]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close(1000, "User disconnected");
      wsRef.current = null;
    }

    setStatus("disconnected");
  }, []);

  // =============================================================================
  // Message Handling
  // =============================================================================

  const handleMessage = useCallback(
    (message: WebSocketMessage) => {
      sequenceRef.current = message.sequence;

      switch (message.type) {
        case "opportunity":
          handleOpportunity(message.payload as ArbitrageOpportunity);
          break;

        case "heartbeat":
          handleHeartbeat(message.payload);
          break;

        case "error":
          console.error("[BlackEdge] Server error", message.payload);
          setError((message.payload as { error: string }).error);
          break;

        case "market_update":
          // Handle market updates (for future use)
          break;

        case "risk_alert":
          // Handle risk alerts (for future use)
          break;

        case "execution_result":
          // Handle execution results (for future use)
          break;

        default:
          console.warn("[BlackEdge] Unknown message type", message.type);
      }
    },
    []
  );

  const handleOpportunity = useCallback(
    (opp: ArbitrageOpportunity) => {
      setOpportunities((prev) => {
        // Check if this is an update to an existing opportunity
        const existingIndex = prev.findIndex(
          (o) => o.opportunityId === opp.opportunityId
        );

        if (existingIndex >= 0) {
          // Update existing
          const updated = [...prev];
          updated[existingIndex] = opp;
          return updated;
        } else {
          // Add new (keep last 100)
          return [opp, ...prev].slice(0, 100);
        }
      });

      // Trigger glitch effect for high-profit opportunities
      if (
        config.glitchOnHighProfit &&
        opp.profitPerDollar &&
        opp.profitPerDollar >= config.highProfitThreshold
      ) {
        triggerGlitch();
      }
    },
    [config.glitchOnHighProfit, config.highProfitThreshold]
  );

  const handleHeartbeat = useCallback(
    (payload: unknown) => {
      const data = payload as {
        status?: string;
        tier?: string;
        authenticated?: boolean;
      };

      // Update user info if provided
      if (data.tier) {
        setUser((prev) => ({
          uid: prev?.uid || "unknown",
          tier: data.tier as UserTier,
          isActive: true,
          ...prev,
        }));
      }

      if (data.authenticated) {
        setStatus("authenticated");
      }
    },
    []
  );

  // =============================================================================
  // Actions
  // =============================================================================

  const sendMessage = useCallback((type: string, payload: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...payload }));
    } else {
      console.warn("[BlackEdge] Cannot send message - not connected");
    }
  }, []);

  const authenticate = useCallback(
    (token: string) => {
      sendMessage("auth", { token });
    },
    [sendMessage]
  );

  const subscribe = useCallback(
    (markets: string[]) => {
      sendMessage("subscribe", { markets });
    },
    [sendMessage]
  );

  const unsubscribe = useCallback(
    (markets: string[]) => {
      sendMessage("unsubscribe", { markets });
    },
    [sendMessage]
  );

  const selectOpportunity = useCallback(
    (id: string) => {
      const opp = opportunities.find((o) => o.opportunityId === id);
      setSelectedOpportunity(opp);
    },
    [opportunities]
  );

  const executeOpportunity = useCallback(
    async (request: ExecutionRequest): Promise<ExecutionResult> => {
      const response = await fetch(`${config.apiUrl}/arbitrage/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(firebaseToken && { Authorization: `Bearer ${firebaseToken}` }),
        },
        body: JSON.stringify({
          opportunity_id: request.opportunityId,
          trade_size_usd: request.tradeSizeUsd,
          max_slippage: request.maxSlippage,
          dry_run: request.dryRun,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Execution failed");
      }

      return response.json();
    },
    [config.apiUrl, firebaseToken]
  );

  // =============================================================================
  // UI Effects
  // =============================================================================

  const triggerGlitch = useCallback(() => {
    setIsGlitching(true);
    setTimeout(() => setIsGlitching(false), 300);

    // Also trigger haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate([50, 50, 50]);
    }
  }, []);

  // =============================================================================
  // Lifecycle
  // =============================================================================

  // Auto-connect when token changes
  useEffect(() => {
    if (firebaseToken) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [firebaseToken, connect, disconnect]);

  // =============================================================================
  // Return
  // =============================================================================

  return {
    // Connection state
    status,
    isConnected: status === "connected" || status === "authenticated",
    error,

    // User state
    user,
    isAuthenticated: status === "authenticated",

    // Data
    opportunities,
    selectedOpportunity,

    // Actions
    connect,
    disconnect,
    authenticate,
    subscribe,
    unsubscribe,
    selectOpportunity,
    executeOpportunity,

    // UI state
    isGlitching,
    triggerGlitch,
  };
}

export default useBlackEdge;
