"""
Black Edge V2 - Configuration Module
Type definitions, enums, dataclasses, and constants for the quant system.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


# ═══════════════════════════════════════════════════════════════════════════
# 1. ENUMS
# ═══════════════════════════════════════════════════════════════════════════

class Signal(Enum):
    """Trading signal strength classification."""
    STRONG_BUY = 'STRONG_BUY'
    BUY = 'BUY'
    HOLD = 'HOLD'
    SELL = 'SELL'
    STRONG_SELL = 'STRONG_SELL'


class Side(Enum):
    """Order side for execution."""
    BUY = 'BUY'
    SELL = 'SELL'


class Conviction(Enum):
    """Agent conviction level with numerical weights."""
    STRONG_AGAINST = -2
    AGAINST = -1
    ABSTAIN = 0
    FOR = 1
    STRONG_FOR = 2


class TradeAction(Enum):
    """Trade action decision from the council."""
    LONG = 'LONG'
    SHORT = 'SHORT'
    HOLD = 'HOLD'
    EXIT = 'EXIT'


class AgentRole(Enum):
    """Specialized agent roles in the multi-agent council."""
    SNIPER = 'SNIPER'              # Fast mean-reversion scalper
    NARRATIVE = 'NARRATIVE'        # NLP/sentiment specialist
    WHALE_HUNTER = 'WHALE_HUNTER'  # On-chain flow tracker
    DOOMER = 'DOOMER'              # Risk veto agent
    JUDGE = 'JUDGE'                # Final arbiter/tie-breaker


# ═══════════════════════════════════════════════════════════════════════════
# 2. DATACLASSES - Market Data Structures
# ═══════════════════════════════════════════════════════════════════════════

@dataclass(slots=True)
class OrderBookLevel:
    """Single price level in the order book (CLOB)."""
    price: float
    size: float


@dataclass(slots=True)
class OrderBookSnapshot:
    """Complete order book state at a point in time."""
    market_id: str
    timestamp_ms: int
    bids: list[OrderBookLevel]
    asks: list[OrderBookLevel]


@dataclass(slots=True)
class MarketTick:
    """
    Real-time market data tick from Polymarket WebSocket.
    All fields are instant snapshots, not aggregated.
    """
    market_id: str
    timestamp_ms: int
    mid_price: float
    best_bid: float
    best_ask: float
    bid_depth_usd: float
    ask_depth_usd: float
    volume_1h_usd: float
    volume_24h_usd: float
    trade_count_1h: int
    last_trade_price: float


@dataclass(slots=True)
class FeatureVector:
    """
    Engineered features for ML model input.
    Represents the state of a market at timestamp_ms.
    """
    market_id: str
    timestamp_ms: int
    order_book_imbalance: float   # [-1, 1] buy pressure indicator
    volume_z_score: float          # Std deviations from mean volume
    implied_volatility: float      # Estimated from price variance
    momentum_1h: float             # Rate of change over 1h
    sentiment_score: float         # [-1, 1] from NLP pipeline
    mid_price: float               # Current market price
    spread_bps: float              # Bid-ask spread in basis points
    is_valid: bool                 # Data quality flag


# ═══════════════════════════════════════════════════════════════════════════
# 3. DATACLASSES - Agent Council System
# ═══════════════════════════════════════════════════════════════════════════

@dataclass(slots=True)
class AgentVote:
    """
    Individual agent's vote in the council decision process.
    Each agent analyzes the market and casts a vote with reasoning.
    """
    role: AgentRole
    conviction: Conviction         # How strongly the agent believes
    action: TradeAction            # What the agent wants to do
    size_fraction: float           # Suggested position size [0, 1]
    confidence: float              # [0, 1] certainty in the signal
    reasoning: str                 # Explainable AI - why this vote?
    latency_ms: int                # How long did agent take to decide
    dissent_flags: list[str]       # Warnings/concerns raised


@dataclass(slots=True)
class CouncilDecision:
    """
    Final consensus decision from the multi-agent council.
    Combines all agent votes into a single executable action.
    """
    action: TradeAction
    size_fraction: float           # Final position size [0, max_position_fraction]
    confidence: float              # [0, 1] weighted consensus confidence
    edge_estimate: float           # Expected edge over market price
    votes: list[AgentVote]         # All individual agent votes
    consensus_score: float         # [0, 1] agreement level among agents
    doomer_override: bool          # True if Doomer vetoed the trade
    reasoning: str                 # Aggregated reasoning from all agents
    timestamp_ms: int


# ═══════════════════════════════════════════════════════════════════════════
# 4. DATACLASSES - Configuration Objects
# ═══════════════════════════════════════════════════════════════════════════

@dataclass(slots=True)
class FeatureConfig:
    """Configuration for feature engineering pipeline."""
    obi_depth_levels: int = 5                # How many order book levels to use for OBI
    volume_lookback_hours: int = 24          # Rolling window for volume statistics
    volatility_window_minutes: int = 60      # Window for IV calculation
    momentum_window_minutes: int = 60        # Momentum calculation period
    min_data_points: int = 10                # Minimum samples required for valid features


@dataclass(slots=True)
class ModelConfig:
    """Configuration for the hybrid ML model (XGBoost + NLP)."""
    struct_weight: float = 0.65              # Weight for structured features (XGBoost)
    sentiment_weight: float = 0.20           # Weight for NLP sentiment
    narrative_weight: float = 0.15           # Weight for narrative velocity index
    min_edge: float = 0.03                   # Minimum edge to trigger trade (3%)
    min_confidence: float = 0.55             # Minimum confidence threshold [0, 1]
    max_spread_bps: float = 500              # Max acceptable spread (5%)


@dataclass(slots=True)
class CouncilConfig:
    """Configuration for the multi-agent council system."""
    agent_timeout_ms: int = 500              # Max time per agent to vote
    min_consensus: float = 0.6               # Minimum agreement to execute trade
    doomer_veto_threshold: float = -1.5      # Doomer conviction level for veto
    max_position_fraction: float = 0.25      # Max 25% of capital per position


@dataclass(slots=True)
class SimulationConfig:
    """Configuration for RL training environment."""
    tick_interval_ms: int = 1000             # Time between simulation steps
    initial_cash_usd: float = 1_000_000      # Starting capital
    max_episode_steps: int = 86_400          # Max steps per episode (24h in seconds)
    chaos_agent_probability: float = 0.05    # Chance of adversarial chaos event
    mev_sandwich_probability: float = 0.02   # Chance of MEV sandwich attack


# ═══════════════════════════════════════════════════════════════════════════
# 5. CONSTANTS - Polymarket / Polygon Infrastructure
# ═══════════════════════════════════════════════════════════════════════════

POLYMARKET_CLOB_BASE: str = "https://clob.polymarket.com"
POLYMARKET_WS_URL: str = "wss://ws-subscriptions-clob.polymarket.com/ws/market"
CTF_EXCHANGE_ADDRESS: str = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E"
USDC_ADDRESS: str = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"
