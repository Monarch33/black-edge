"""
Pydantic Schemas for API
========================
Request/response models for the Black Edge API.
"""

from datetime import datetime
from enum import Enum
from typing import Optional, Any

from pydantic import BaseModel, Field


# =============================================================================
# Enums
# =============================================================================

class UserTier(str, Enum):
    """User subscription tiers."""
    OBSERVER = "observer"  # Free tier - can see logs but no arbitrage
    RUNNER = "runner"  # Paid tier - intra-market arbitrage
    WHALE = "whale"  # Institutional - full access including combinatorial


class ArbitrageTypeEnum(str, Enum):
    """Types of arbitrage opportunities."""
    NONE = "none"
    LONG_REBALANCING = "long_rebalancing"
    SHORT_REBALANCING = "short_rebalancing"
    COMBINATORIAL = "combinatorial"


class MessageType(str, Enum):
    """WebSocket message types."""
    OPPORTUNITY = "opportunity"
    MARKET_UPDATE = "market_update"
    RISK_ALERT = "risk_alert"
    EXECUTION_RESULT = "execution_result"
    ERROR = "error"
    HEARTBEAT = "heartbeat"


# =============================================================================
# User Models
# =============================================================================

class User(BaseModel):
    """User model with subscription info."""
    uid: str
    email: Optional[str] = None
    tier: UserTier = UserTier.OBSERVER
    stripe_customer_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True


class SubscriptionStatus(BaseModel):
    """Subscription status response."""
    tier: UserTier
    is_active: bool
    expires_at: Optional[datetime] = None
    features: list[str] = []


# =============================================================================
# Market Models
# =============================================================================

class ConditionPrice(BaseModel):
    """Price data for a single condition."""
    condition_id: str
    yes_price: float
    no_price: float
    yes_volume: float
    no_volume: float
    last_block: int


class MarketStateResponse(BaseModel):
    """Response with current market state."""
    market_id: str
    conditions: list[ConditionPrice]
    total_liquidity: float
    last_update: datetime


# =============================================================================
# Arbitrage Models
# =============================================================================

class ArbitrageOpportunityResponse(BaseModel):
    """Arbitrage opportunity for API response."""
    opportunity_id: str
    arb_type: ArbitrageTypeEnum
    market_ids: list[str]
    condition_ids: list[str]

    # Pricing (may be redacted for lower tiers)
    profit_per_dollar: Optional[float] = None
    observed_prices: Optional[list[float]] = None
    projected_prices: Optional[list[float]] = None

    # Positions (may be redacted)
    recommended_positions: Optional[dict[str, str]] = None

    # Risk metrics
    confidence: float
    execution_risk: float
    risk_adjusted_profit: Optional[float] = None

    # Metadata
    detected_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None

    # Redaction indicator
    is_redacted: bool = False

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
        }


class ExecutionRequest(BaseModel):
    """Request to execute an arbitrage opportunity."""
    opportunity_id: str
    trade_size_usd: float
    max_slippage: float = 0.02  # 2% default max slippage
    dry_run: bool = True  # Default to simulation


class ExecutionResult(BaseModel):
    """Result of an execution attempt."""
    opportunity_id: str
    success: bool
    transactions: list[str] = []  # Transaction hashes
    actual_profit: Optional[float] = None
    actual_slippage: Optional[float] = None
    error: Optional[str] = None
    executed_at: datetime = Field(default_factory=datetime.utcnow)


# =============================================================================
# Risk Models
# =============================================================================

class RiskAssessmentResponse(BaseModel):
    """Risk assessment for an opportunity."""
    opportunity_id: str
    market_ids: list[str]

    # Risk components (0-1 scale)
    liquidity_risk: float
    volatility_risk: float
    timing_risk: float
    slippage_risk: float
    total_risk: float

    # Recommendations
    risk_adjusted_profit: float
    max_safe_trade_size: float
    recommended_trade_size: float
    execution_window_blocks: int

    confidence: float
    reasoning: str


# =============================================================================
# WebSocket Models
# =============================================================================

class WebSocketMessage(BaseModel):
    """Generic WebSocket message wrapper."""
    type: MessageType
    payload: dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    sequence: int = 0

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
        }


class WebSocketAuthMessage(BaseModel):
    """Authentication message for WebSocket connection."""
    token: str  # Firebase ID token


class WebSocketSubscribeMessage(BaseModel):
    """Subscribe to specific markets or topics."""
    markets: Optional[list[str]] = None
    topics: Optional[list[str]] = None
    min_profit: Optional[float] = None


# =============================================================================
# Utility Functions
# =============================================================================

def redact_opportunity(
    opp: ArbitrageOpportunityResponse,
    tier: UserTier,
) -> ArbitrageOpportunityResponse:
    """
    Redact sensitive data based on user tier.

    Observer: No arbitrage data visible
    Runner: Only intra-market (rebalancing) arbitrage
    Whale: Full access
    """
    if tier == UserTier.WHALE:
        return opp

    # Create redacted copy
    redacted = opp.model_copy()
    redacted.is_redacted = True

    if tier == UserTier.OBSERVER:
        # Observer sees structure but no profit/position data
        redacted.profit_per_dollar = None
        redacted.observed_prices = None
        redacted.projected_prices = None
        redacted.recommended_positions = None
        redacted.risk_adjusted_profit = None
        # Blur market IDs
        redacted.market_ids = [
            f"REDACTED_{mid[:4]}" for mid in opp.market_ids
        ]

    elif tier == UserTier.RUNNER:
        # Runner can see rebalancing but not combinatorial
        if opp.arb_type == ArbitrageTypeEnum.COMBINATORIAL:
            redacted.profit_per_dollar = None
            redacted.observed_prices = None
            redacted.projected_prices = None
            redacted.recommended_positions = None
            redacted.risk_adjusted_profit = None
            redacted.market_ids = [
                f"REDACTED_{mid[:4]}" for mid in opp.market_ids
            ]

    return redacted
