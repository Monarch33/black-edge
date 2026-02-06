"""
Risk Calculator: Real-Time Execution Risk Estimation
=====================================================
Analyzes market conditions to estimate slippage and execution risk
for arbitrage opportunities.

Key metrics:
- Liquidity depth across the order book
- Historical volatility
- Trade grouping for non-atomic execution risk
"""

import asyncio
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime, timedelta
from collections import defaultdict
import statistics

import numpy as np
from numpy.typing import NDArray
import structlog

from config import get_settings
from .blockchain import OrderFilledEvent, VWAPCalculator

logger = structlog.get_logger()
settings = get_settings()


# =============================================================================
# Data Classes
# =============================================================================

@dataclass
class LiquiditySnapshot:
    """Snapshot of market liquidity at a point in time."""
    token_id: str
    block_number: int
    total_volume: float
    trade_count: int
    avg_trade_size: float
    max_trade_size: float
    price_impact_estimate: float  # Estimated price impact for $1000 trade
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class VolatilityMetrics:
    """Volatility metrics for a token over a time window."""
    token_id: str
    window_blocks: int
    price_std: float  # Standard deviation of prices
    price_range: float  # High - Low
    mean_price: float
    volatility_ratio: float  # std / mean
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class ExecutionRisk:
    """Comprehensive execution risk assessment."""
    opportunity_id: str
    market_ids: list[str]

    # Risk components (0-1 scale, higher = more risk)
    liquidity_risk: float
    volatility_risk: float
    timing_risk: float  # Risk of price movement during execution
    slippage_risk: float

    # Aggregated risk
    total_risk: float
    risk_adjusted_profit: float  # Profit after accounting for expected slippage

    # Recommendations
    max_safe_trade_size: float  # Maximum trade size with acceptable risk
    recommended_trade_size: float
    execution_window_blocks: int  # Recommended blocks to complete trade

    confidence: float
    reasoning: str


@dataclass
class TradeGroup:
    """A group of related trades (potential arbitrage execution)."""
    trades: list[OrderFilledEvent]
    start_block: int
    end_block: int
    total_volume: float
    net_position: dict[str, float]  # token_id -> net amount
    is_arbitrage_candidate: bool
    profit_estimate: float


# =============================================================================
# Risk Calculator
# =============================================================================

class RiskCalculator:
    """
    Calculates execution risk for arbitrage opportunities.

    Uses historical trade data to estimate:
    - Liquidity depth and price impact
    - Volatility and timing risk
    - Optimal trade sizing
    """

    def __init__(
        self,
        analysis_window: int = settings.risk_analysis_window,
        min_profit_threshold: float = settings.min_profit_threshold,
    ):
        self.analysis_window = analysis_window  # ~1 hour on Polygon
        self.min_profit_threshold = min_profit_threshold

        # Trade history for analysis
        self._trades: dict[str, list[OrderFilledEvent]] = defaultdict(list)
        self._price_history: dict[str, list[tuple[int, float]]] = defaultdict(list)

    def record_trade(self, event: OrderFilledEvent) -> None:
        """
        Record a trade for risk analysis.

        Args:
            event: OrderFilled event from blockchain
        """
        token_id = str(event.maker_asset_id)
        self._trades[token_id].append(event)
        self._price_history[token_id].append((event.block_number, event.price))

        # Prune old data
        self._prune_old_data(event.block_number)

    def _prune_old_data(self, current_block: int) -> None:
        """Remove data older than the analysis window."""
        cutoff = current_block - self.analysis_window

        for token_id in list(self._trades.keys()):
            self._trades[token_id] = [
                t for t in self._trades[token_id] if t.block_number >= cutoff
            ]
            self._price_history[token_id] = [
                (b, p) for b, p in self._price_history[token_id] if b >= cutoff
            ]

    def calculate_liquidity(
        self,
        token_id: str,
        current_block: int,
    ) -> LiquiditySnapshot:
        """
        Calculate liquidity metrics for a token.

        Args:
            token_id: Token identifier
            current_block: Current block number

        Returns:
            LiquiditySnapshot with liquidity metrics
        """
        trades = self._trades.get(token_id, [])

        if not trades:
            return LiquiditySnapshot(
                token_id=token_id,
                block_number=current_block,
                total_volume=0,
                trade_count=0,
                avg_trade_size=0,
                max_trade_size=0,
                price_impact_estimate=1.0,  # Maximum impact (no liquidity)
            )

        volumes = [t.maker_amount / 1e6 for t in trades]  # Convert from 6 decimals
        total_volume = sum(volumes)
        trade_count = len(trades)
        avg_trade_size = total_volume / trade_count if trade_count > 0 else 0
        max_trade_size = max(volumes) if volumes else 0

        # Estimate price impact for $1000 trade
        # Simple model: impact = trade_size / (total_volume * liquidity_factor)
        liquidity_factor = 10  # Empirical constant
        impact_1000 = min(1.0, 1000 / (total_volume * liquidity_factor + 1))

        return LiquiditySnapshot(
            token_id=token_id,
            block_number=current_block,
            total_volume=total_volume,
            trade_count=trade_count,
            avg_trade_size=avg_trade_size,
            max_trade_size=max_trade_size,
            price_impact_estimate=impact_1000,
        )

    def calculate_volatility(
        self,
        token_id: str,
        current_block: int,
        window_blocks: Optional[int] = None,
    ) -> VolatilityMetrics:
        """
        Calculate volatility metrics for a token.

        Args:
            token_id: Token identifier
            current_block: Current block number
            window_blocks: Analysis window (default: self.analysis_window)

        Returns:
            VolatilityMetrics with volatility measurements
        """
        if window_blocks is None:
            window_blocks = self.analysis_window

        prices = self._price_history.get(token_id, [])
        cutoff = current_block - window_blocks
        recent_prices = [p for b, p in prices if b >= cutoff]

        if len(recent_prices) < 2:
            return VolatilityMetrics(
                token_id=token_id,
                window_blocks=window_blocks,
                price_std=0,
                price_range=0,
                mean_price=recent_prices[0] if recent_prices else 0,
                volatility_ratio=0,
            )

        mean_price = statistics.mean(recent_prices)
        price_std = statistics.stdev(recent_prices)
        price_range = max(recent_prices) - min(recent_prices)
        volatility_ratio = price_std / mean_price if mean_price > 0 else 0

        return VolatilityMetrics(
            token_id=token_id,
            window_blocks=window_blocks,
            price_std=price_std,
            price_range=price_range,
            mean_price=mean_price,
            volatility_ratio=volatility_ratio,
        )

    def assess_execution_risk(
        self,
        opportunity_id: str,
        market_ids: list[str],
        token_ids: list[str],
        trade_sizes: list[float],
        profit_per_dollar: float,
        current_block: int,
    ) -> ExecutionRisk:
        """
        Comprehensive execution risk assessment for an arbitrage opportunity.

        Args:
            opportunity_id: Unique identifier for the opportunity
            market_ids: Markets involved
            token_ids: Tokens to trade
            trade_sizes: Proposed trade sizes per token
            profit_per_dollar: Expected profit per dollar
            current_block: Current block number

        Returns:
            ExecutionRisk assessment
        """
        # Calculate component risks
        liquidity_snapshots = [
            self.calculate_liquidity(tid, current_block) for tid in token_ids
        ]
        volatility_metrics = [
            self.calculate_volatility(tid, current_block) for tid in token_ids
        ]

        # Liquidity risk: average price impact across tokens
        avg_impact = (
            sum(ls.price_impact_estimate for ls in liquidity_snapshots)
            / len(liquidity_snapshots)
            if liquidity_snapshots else 1.0
        )
        liquidity_risk = min(1.0, avg_impact)

        # Volatility risk: max volatility ratio
        max_volatility = (
            max(vm.volatility_ratio for vm in volatility_metrics)
            if volatility_metrics else 0
        )
        volatility_risk = min(1.0, max_volatility * 10)  # Scale factor

        # Timing risk: based on number of tokens (more tokens = more legs = more risk)
        num_legs = len(token_ids)
        timing_risk = min(1.0, (num_legs - 1) * 0.15)  # 15% per additional leg

        # Slippage risk: combination of liquidity and trade size
        total_trade = sum(trade_sizes)
        min_volume = (
            min(ls.total_volume for ls in liquidity_snapshots)
            if liquidity_snapshots else 0
        )
        slippage_risk = (
            min(1.0, total_trade / (min_volume + 1) * 0.5)
            if min_volume > 0 else 1.0
        )

        # Aggregate risk (weighted average)
        total_risk = (
            liquidity_risk * 0.3 +
            volatility_risk * 0.25 +
            timing_risk * 0.2 +
            slippage_risk * 0.25
        )

        # Risk-adjusted profit
        expected_slippage = total_risk * profit_per_dollar * 0.5  # 50% of risk as slippage
        risk_adjusted_profit = profit_per_dollar - expected_slippage

        # Determine if profitable after risk adjustment
        is_profitable = risk_adjusted_profit >= self.min_profit_threshold

        # Calculate safe trade sizes
        if min_volume > 0:
            # Safe trade is fraction of minimum liquidity
            max_safe = min_volume * 0.1  # 10% of liquidity
            recommended = max_safe * (1 - total_risk)
        else:
            max_safe = 0
            recommended = 0

        # Execution window (more risk = need faster execution)
        if total_risk < 0.3:
            window = 10  # ~20 seconds
        elif total_risk < 0.6:
            window = 5  # ~10 seconds
        else:
            window = 2  # ~4 seconds

        reasoning = self._generate_risk_reasoning(
            liquidity_risk,
            volatility_risk,
            timing_risk,
            slippage_risk,
            is_profitable,
        )

        return ExecutionRisk(
            opportunity_id=opportunity_id,
            market_ids=market_ids,
            liquidity_risk=liquidity_risk,
            volatility_risk=volatility_risk,
            timing_risk=timing_risk,
            slippage_risk=slippage_risk,
            total_risk=total_risk,
            risk_adjusted_profit=risk_adjusted_profit,
            max_safe_trade_size=max_safe,
            recommended_trade_size=recommended,
            execution_window_blocks=window,
            confidence=1 - total_risk,
            reasoning=reasoning,
        )

    def _generate_risk_reasoning(
        self,
        liquidity_risk: float,
        volatility_risk: float,
        timing_risk: float,
        slippage_risk: float,
        is_profitable: bool,
    ) -> str:
        """Generate human-readable risk explanation."""
        parts = []

        if liquidity_risk > 0.5:
            parts.append("LOW LIQUIDITY")
        if volatility_risk > 0.5:
            parts.append("HIGH VOLATILITY")
        if timing_risk > 0.3:
            parts.append("MULTI-LEG TIMING")
        if slippage_risk > 0.5:
            parts.append("SLIPPAGE RISK")

        if not parts:
            parts.append("FAVORABLE CONDITIONS")

        status = "EXECUTABLE" if is_profitable else "REJECT"
        return f"[{status}] {', '.join(parts)}"

    def detect_arbitrage_executions(
        self,
        address: str,
        current_block: int,
        window_blocks: int = 50,
    ) -> list[TradeGroup]:
        """
        Detect potential arbitrage executions by an address.

        Groups trades within a window and checks for arbitrage patterns.

        Args:
            address: Trader address to analyze
            current_block: Current block number
            window_blocks: Block window for grouping

        Returns:
            List of detected trade groups
        """
        # Collect all trades by the address
        address_trades: list[OrderFilledEvent] = []
        for trades in self._trades.values():
            for trade in trades:
                if trade.maker == address or trade.taker == address:
                    address_trades.append(trade)

        if not address_trades:
            return []

        # Sort by block number
        address_trades.sort(key=lambda t: t.block_number)

        # Group trades within window
        groups: list[TradeGroup] = []
        current_group: list[OrderFilledEvent] = []

        for trade in address_trades:
            if trade.block_number > current_block - self.analysis_window:
                if not current_group:
                    current_group.append(trade)
                elif trade.block_number - current_group[-1].block_number <= window_blocks:
                    current_group.append(trade)
                else:
                    # Finalize current group and start new one
                    if len(current_group) >= 2:
                        group = self._analyze_trade_group(current_group)
                        if group:
                            groups.append(group)
                    current_group = [trade]

        # Handle last group
        if len(current_group) >= 2:
            group = self._analyze_trade_group(current_group)
            if group:
                groups.append(group)

        return groups

    def _analyze_trade_group(
        self,
        trades: list[OrderFilledEvent],
    ) -> Optional[TradeGroup]:
        """Analyze a group of trades for arbitrage patterns."""
        if len(trades) < 2:
            return None

        # Calculate net positions
        net_position: dict[str, float] = defaultdict(float)
        total_volume = 0

        for trade in trades:
            maker_token = str(trade.maker_asset_id)
            taker_token = str(trade.taker_asset_id)

            # Assuming maker receives maker_amount of taker_token
            # and gives maker_amount of maker_token
            net_position[maker_token] -= trade.maker_amount / 1e6
            net_position[taker_token] += trade.taker_amount / 1e6

            total_volume += trade.maker_amount / 1e6

        # Check if it's an arbitrage pattern
        # Arbitrage typically results in net profit with near-zero token positions
        is_arbitrage = self._is_arbitrage_pattern(net_position)

        # Estimate profit (simplified)
        profit_estimate = sum(
            abs(v) for v in net_position.values()
        ) * 0.01  # Rough estimate

        return TradeGroup(
            trades=trades,
            start_block=trades[0].block_number,
            end_block=trades[-1].block_number,
            total_volume=total_volume,
            net_position=dict(net_position),
            is_arbitrage_candidate=is_arbitrage,
            profit_estimate=profit_estimate if is_arbitrage else 0,
        )

    def _is_arbitrage_pattern(self, net_position: dict[str, float]) -> bool:
        """
        Check if net positions indicate an arbitrage pattern.

        Arbitrage patterns typically show:
        - Balanced or near-balanced positions across related tokens
        - Small net USDC profit
        """
        positions = list(net_position.values())
        if not positions:
            return False

        # Check for balanced pattern (some positive, some negative)
        has_positive = any(p > 0 for p in positions)
        has_negative = any(p < 0 for p in positions)

        if not (has_positive and has_negative):
            return False

        # Check if roughly balanced
        total = sum(positions)
        max_pos = max(abs(p) for p in positions)

        # Ratio of net to max should be small for arbitrage
        balance_ratio = abs(total) / max_pos if max_pos > 0 else 1

        return balance_ratio < 0.2  # Less than 20% imbalance
