/**
 * Black Edge Terminal Types
 * =========================
 * TypeScript type definitions for the frontend application.
 */

// =============================================================================
// Enums
// =============================================================================

export enum UserTier {
  OBSERVER = "observer",
  RUNNER = "runner",
  WHALE = "whale",
}

export enum ArbitrageType {
  NONE = "none",
  LONG_REBALANCING = "long_rebalancing",
  SHORT_REBALANCING = "short_rebalancing",
  COMBINATORIAL = "combinatorial",
}

export enum MessageType {
  OPPORTUNITY = "opportunity",
  MARKET_UPDATE = "market_update",
  RISK_ALERT = "risk_alert",
  EXECUTION_RESULT = "execution_result",
  ERROR = "error",
  HEARTBEAT = "heartbeat",
}

export enum ConnectionStatus {
  CONNECTING = "connecting",
  CONNECTED = "connected",
  AUTHENTICATED = "authenticated",
  DISCONNECTED = "disconnected",
  ERROR = "error",
}

// =============================================================================
// API Types
// =============================================================================

export interface User {
  uid: string;
  email?: string;
  tier: UserTier;
  isActive: boolean;
}

export interface ArbitrageOpportunity {
  opportunityId: string;
  arbType: ArbitrageType;
  marketIds: string[];
  conditionIds: string[];
  profitPerDollar?: number;
  observedPrices?: number[];
  projectedPrices?: number[];
  recommendedPositions?: Record<string, "YES" | "NO">;
  confidence: number;
  executionRisk: number;
  riskAdjustedProfit?: number;
  detectedAt: string;
  expiresAt?: string;
  isRedacted: boolean;
}

export interface RiskAssessment {
  opportunityId: string;
  marketIds: string[];
  liquidityRisk: number;
  volatilityRisk: number;
  timingRisk: number;
  slippageRisk: number;
  totalRisk: number;
  riskAdjustedProfit: number;
  maxSafeTradeSize: number;
  recommendedTradeSize: number;
  executionWindowBlocks: number;
  confidence: number;
  reasoning: string;
}

export interface ExecutionRequest {
  opportunityId: string;
  tradeSizeUsd: number;
  maxSlippage: number;
  dryRun: boolean;
}

export interface ExecutionResult {
  opportunityId: string;
  success: boolean;
  transactions: string[];
  actualProfit?: number;
  actualSlippage?: number;
  error?: string;
  executedAt: string;
}

export interface SubscriptionStatus {
  tier: UserTier;
  isActive: boolean;
  expiresAt?: string;
  features: string[];
}

// =============================================================================
// WebSocket Types
// =============================================================================

export interface WebSocketMessage<T = unknown> {
  type: MessageType;
  payload: T;
  timestamp: string;
  sequence: number;
}

export interface WebSocketAuthMessage {
  type: "auth";
  token: string;
}

export interface WebSocketSubscribeMessage {
  type: "subscribe";
  markets?: string[];
  topics?: string[];
  minProfit?: number;
}

// =============================================================================
// UI Types
// =============================================================================

export interface TerminalState {
  connectionStatus: ConnectionStatus;
  user?: User;
  opportunities: ArbitrageOpportunity[];
  selectedOpportunity?: ArbitrageOpportunity;
  riskAssessment?: RiskAssessment;
  isGlitching: boolean;
  lastUpdate?: Date;
}

export interface TerminalConfig {
  wsUrl: string;
  apiUrl: string;
  autoReconnect: boolean;
  reconnectInterval: number;
  glitchOnHighProfit: boolean;
  highProfitThreshold: number;
}

// =============================================================================
// Hook Return Types
// =============================================================================

export interface UseBlackEdgeReturn {
  // Connection state
  status: ConnectionStatus;
  isConnected: boolean;
  error?: string;

  // User state
  user?: User;
  isAuthenticated: boolean;

  // Data
  opportunities: ArbitrageOpportunity[];
  selectedOpportunity?: ArbitrageOpportunity;

  // Actions
  connect: () => void;
  disconnect: () => void;
  authenticate: (token: string) => void;
  subscribe: (markets: string[]) => void;
  unsubscribe: (markets: string[]) => void;
  selectOpportunity: (id: string) => void;
  executeOpportunity: (request: ExecutionRequest) => Promise<ExecutionResult>;

  // UI state
  isGlitching: boolean;
  triggerGlitch: () => void;
}
