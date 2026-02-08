"""
Risk Manager - Portfolio Optimization & Position Management

Three core components:
1. Portfolio Kelly: Covariance-aware position sizing (log-growth optimization)
2. Trailing Stops: Adaptive stop-loss with high-water mark tracking
3. Cross-Platform Hedging: Arbitrage detection across Polymarket/Kalshi

Plus: CorrelationTracker for real-time correlation monitoring.
"""

from __future__ import annotations

import math
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Optional

import numpy as np
from scipy.optimize import minimize


@dataclass(slots=True)
class KellyWeights:
    """
    Result from portfolio Kelly optimization.

    Attributes:
        weights: Array of position sizes [0, max_leverage] per market
        expected_growth: Expected log-growth rate
        max_drawdown_est: Estimated max drawdown based on covariance
        leverage_used: Total leverage (sum of weights)
        is_half_kelly: Whether half-Kelly was applied due to high drawdown
    """
    weights: np.ndarray
    expected_growth: float
    max_drawdown_est: float
    leverage_used: float
    is_half_kelly: bool


@dataclass(slots=True)
class ArbOpportunity:
    """
    Cross-platform arbitrage opportunity.

    Attributes:
        is_arb: Whether arbitrage exists
        profit_pct: Expected profit percentage (after fees)
        buy_side: Where to buy (e.g., "Polymarket NO")
        sell_side: Where to sell/hedge (e.g., "Kalshi YES")
        required_capital: Total capital needed (normalized to 1.0 outcome)
        polymarket_price: PM YES price
        kalshi_price: Kalshi YES price
    """
    is_arb: bool
    profit_pct: float
    buy_side: str
    sell_side: str
    required_capital: float
    polymarket_price: float
    kalshi_price: float


class TrailingStop:
    """
    Adaptive trailing stop-loss with high-water mark tracking.

    Tracks the highest price since entry and triggers:
    - STOP_LOSS: if price falls below HWM * (1 - stop_pct)
    - TAKE_PROFIT: if edge compresses below take_profit_edge

    Example:
        >>> stop = TrailingStop(entry_price=0.50, stop_pct=0.15)
        >>> stop.update(0.60)  # Price rises, HWM=0.60
        >>> stop.update(0.50)  # Price falls to 0.50 < 0.60*0.85=0.51
        (True, "STOP_LOSS")
    """

    __slots__ = ('entry_price', 'stop_pct', 'take_profit_edge',
                 '_high_water_mark', '_is_triggered')

    def __init__(
        self,
        entry_price: float,
        stop_pct: float = 0.15,
        take_profit_edge: float = 0.01
    ):
        """
        Initialize trailing stop.

        Args:
            entry_price: Entry price for the position
            stop_pct: Stop loss percentage from HWM (default 15%)
            take_profit_edge: Minimum edge to stay in position (default 1%)
        """
        self.entry_price = entry_price
        self.stop_pct = stop_pct
        self.take_profit_edge = take_profit_edge
        self._high_water_mark = entry_price
        self._is_triggered = False

    def update(self, current_price: float, current_edge: Optional[float] = None) -> tuple[bool, str]:
        """
        Update stop with current price.

        Args:
            current_price: Current market price
            current_edge: Current edge estimate (optional, for take-profit)

        Returns:
            (triggered: bool, reason: str) where reason is "STOP_LOSS", "TAKE_PROFIT", or "ACTIVE"
        """
        if self._is_triggered:
            return (True, "ALREADY_TRIGGERED")

        # Update high-water mark
        self._high_water_mark = max(self._high_water_mark, current_price)

        # Check stop loss
        stop_level = self._high_water_mark * (1 - self.stop_pct)
        if current_price < stop_level:
            self._is_triggered = True
            return (True, "STOP_LOSS")

        # Check take profit (edge compression)
        if current_edge is not None and current_edge < self.take_profit_edge:
            self._is_triggered = True
            return (True, "TAKE_PROFIT")

        return (False, "ACTIVE")

    def reset(self, new_entry_price: float):
        """Reset stop for new position."""
        self.entry_price = new_entry_price
        self._high_water_mark = new_entry_price
        self._is_triggered = False

    @property
    def high_water_mark(self) -> float:
        """Get current high-water mark."""
        return self._high_water_mark

    @property
    def is_triggered(self) -> bool:
        """Check if stop has been triggered."""
        return self._is_triggered


class CorrelationTracker:
    """
    Real-time correlation monitoring across markets.

    Tracks 7-day rolling Pearson correlation between market pairs.
    Used to detect correlated clusters for portfolio diversification.

    Example:
        >>> tracker = CorrelationTracker()
        >>> tracker.update("TRUMP_WINS", 0.65, 1000)
        >>> tracker.update("BIDEN_WINS", 0.35, 1000)
        >>> corr = tracker.get_correlation("TRUMP_WINS", "BIDEN_WINS")
        -0.99  # Highly negatively correlated
    """

    __slots__ = ('_price_history', '_window_size', '_min_samples')

    def __init__(self, window_days: int = 7, samples_per_day: int = 1440):
        """
        Initialize correlation tracker.

        Args:
            window_days: Rolling window in days (default 7)
            samples_per_day: Expected samples per day (default 1440 = 1 per minute)
        """
        self._price_history: dict[str, deque] = defaultdict(lambda: deque(maxlen=window_days * samples_per_day))
        self._window_size = window_days * samples_per_day
        self._min_samples = 100  # Minimum samples for valid correlation

    def update(self, market_id: str, price: float, timestamp_ms: int):
        """
        Update price history for a market.

        Args:
            market_id: Market identifier
            price: Current price [0, 1]
            timestamp_ms: Timestamp in milliseconds
        """
        self._price_history[market_id].append((timestamp_ms, price))

    def get_correlation(self, market_a: str, market_b: str) -> float:
        """
        Compute Pearson correlation between two markets.

        Args:
            market_a: First market ID
            market_b: Second market ID

        Returns:
            Pearson correlation [-1, 1], or 0.0 if insufficient data
        """
        history_a = self._price_history.get(market_a, deque())
        history_b = self._price_history.get(market_b, deque())

        if len(history_a) < self._min_samples or len(history_b) < self._min_samples:
            return 0.0

        # Align timestamps (use only overlapping samples)
        prices_a = []
        prices_b = []

        # Convert to dicts for O(1) lookup
        dict_a = {ts: price for ts, price in history_a}
        dict_b = {ts: price for ts, price in history_b}

        # Find common timestamps
        common_ts = set(dict_a.keys()) & set(dict_b.keys())

        if len(common_ts) < self._min_samples:
            return 0.0

        for ts in sorted(common_ts):
            prices_a.append(dict_a[ts])
            prices_b.append(dict_b[ts])

        # Compute Pearson correlation
        arr_a = np.array(prices_a)
        arr_b = np.array(prices_b)

        if np.std(arr_a) < 1e-6 or np.std(arr_b) < 1e-6:
            return 0.0  # No variance → no correlation

        corr = np.corrcoef(arr_a, arr_b)[0, 1]
        return corr if not np.isnan(corr) else 0.0

    def get_correlated_pairs(self, threshold: float = 0.65) -> list[tuple[str, str, float]]:
        """
        Find all market pairs with correlation above threshold.

        Args:
            threshold: Minimum absolute correlation (default 0.65)

        Returns:
            List of (market_a, market_b, correlation) tuples
        """
        pairs = []
        market_ids = list(self._price_history.keys())

        for i, market_a in enumerate(market_ids):
            for market_b in market_ids[i + 1:]:
                corr = self.get_correlation(market_a, market_b)
                if abs(corr) >= threshold:
                    pairs.append((market_a, market_b, corr))

        # Sort by absolute correlation (descending)
        pairs.sort(key=lambda x: abs(x[2]), reverse=True)
        return pairs

    def clear_history(self, market_id: Optional[str] = None):
        """Clear price history for a market (or all markets if None)."""
        if market_id is None:
            self._price_history.clear()
        else:
            self._price_history.pop(market_id, None)


def portfolio_kelly(
    edges: np.ndarray,
    covariance_matrix: np.ndarray,
    max_leverage: float = 0.25,
    current_drawdown: float = 0.0
) -> KellyWeights:
    """
    Covariance-aware Kelly criterion for portfolio optimization.

    Optimizes log-growth: max(w @ edges - 0.5 * w @ cov @ w)
    with constraints:
    - 0 <= w_i <= max_leverage (max 25% per market)
    - sum(w) <= 1.0 (full Kelly) or 0.5 (half-Kelly if drawdown > 10%)
    - Max 50% in any correlated cluster

    Args:
        edges: Array of edge estimates [market_count]
        covariance_matrix: Covariance matrix [market_count, market_count]
        max_leverage: Maximum weight per single market (default 0.25)
        current_drawdown: Current portfolio drawdown (default 0.0)

    Returns:
        KellyWeights with optimal position sizes

    Example:
        >>> edges = np.array([0.10, 0.08, -0.02])  # 10%, 8%, -2% edge
        >>> cov = np.eye(3) * 0.04  # 4% variance, uncorrelated
        >>> weights = portfolio_kelly(edges, cov)
        >>> weights.weights  # Will allocate to positive edge markets
    """
    n_markets = len(edges)

    # Apply half-Kelly if drawdown > 10%
    is_half_kelly = current_drawdown > 0.10
    max_total_leverage = 0.5 if is_half_kelly else 1.0

    # Objective: minimize -log_growth = -(w @ edges - 0.5 * w @ cov @ w)
    def objective(w):
        return -(w @ edges - 0.5 * w @ covariance_matrix @ w)

    # Constraints
    constraints = [
        {'type': 'ineq', 'fun': lambda w: max_total_leverage - np.sum(w)},  # sum(w) <= max_total_leverage
        {'type': 'ineq', 'fun': lambda w: w}  # w >= 0
    ]

    # Bounds: 0 <= w_i <= max_leverage
    bounds = [(0, max_leverage) for _ in range(n_markets)]

    # Initial guess: proportional to edge (clamped to [0, max_leverage])
    w0 = np.clip(edges / np.sum(np.abs(edges) + 1e-6), 0, max_leverage)

    # Optimize
    result = minimize(
        objective,
        w0,
        method='SLSQP',
        bounds=bounds,
        constraints=constraints,
        options={'maxiter': 1000}
    )

    if not result.success:
        # Fallback: uniform allocation to positive edge markets
        weights = np.where(edges > 0, max_leverage / np.sum(edges > 0), 0.0)
    else:
        weights = result.x

    # Guardrail: Max 50% in correlated cluster
    # (Simplified: assume all markets with weight > 0 are in same cluster)
    active_weight = np.sum(weights)
    if active_weight > 0.50:
        weights = weights * (0.50 / active_weight)

    # Calculate expected growth
    expected_growth = weights @ edges - 0.5 * weights @ covariance_matrix @ weights

    # Estimate max drawdown (simplified: 2 * sqrt(portfolio_variance))
    portfolio_variance = weights @ covariance_matrix @ weights
    max_drawdown_est = 2 * math.sqrt(portfolio_variance)

    return KellyWeights(
        weights=weights,
        expected_growth=expected_growth,
        max_drawdown_est=max_drawdown_est,
        leverage_used=np.sum(weights),
        is_half_kelly=is_half_kelly
    )


def detect_arb_opportunity(
    polymarket_price: float,
    kalshi_price: float,
    fees: float = 0.02
) -> ArbOpportunity:
    """
    Detect cross-platform arbitrage between Polymarket and Kalshi.

    Strategy: Buy YES on one platform + NO on the other (or vice versa)
    If total cost < 1.0 - fees → guaranteed profit

    Args:
        polymarket_price: Polymarket YES price [0, 1]
        kalshi_price: Kalshi YES price [0, 1]
        fees: Total fees (default 2%)

    Returns:
        ArbOpportunity with details (is_arb, profit_pct, sides, etc.)

    Example:
        >>> arb = detect_arb_opportunity(0.62, 0.57, fees=0.02)
        >>> arb.is_arb
        True
        >>> arb.profit_pct
        0.031  # ~3.1% profit
    """
    # Calculate NO prices
    polymarket_no = 1.0 - polymarket_price
    kalshi_no = 1.0 - kalshi_price

    # Strategy 1: Buy Polymarket NO + Kalshi YES
    cost_1 = polymarket_no + kalshi_price

    # Strategy 2: Buy Polymarket YES + Kalshi NO
    cost_2 = polymarket_price + kalshi_no

    # Choose cheaper strategy
    if cost_1 < cost_2:
        cost = cost_1
        buy_side = f"Polymarket NO ({polymarket_no:.3f})"
        sell_side = f"Kalshi YES ({kalshi_price:.3f})"
    else:
        cost = cost_2
        buy_side = f"Polymarket YES ({polymarket_price:.3f})"
        sell_side = f"Kalshi NO ({kalshi_no:.3f})"

    # Apply fees
    cost_with_fees = cost * (1 + fees)

    # Check if arbitrage exists (payout 1.0 > cost_with_fees)
    is_arb = cost_with_fees < 1.0
    profit_pct = (1.0 - cost_with_fees) if is_arb else 0.0

    return ArbOpportunity(
        is_arb=is_arb,
        profit_pct=profit_pct,
        buy_side=buy_side,
        sell_side=sell_side,
        required_capital=cost_with_fees,
        polymarket_price=polymarket_price,
        kalshi_price=kalshi_price
    )


class RiskManager:
    """
    Central risk management system.

    Combines:
    1. Portfolio Kelly sizing with covariance awareness
    2. Trailing stops for active positions
    3. Cross-platform arbitrage detection
    4. Real-time correlation tracking

    Example:
        >>> risk_mgr = RiskManager()
        >>>
        >>> # Portfolio sizing
        >>> edges = np.array([0.10, 0.08])
        >>> cov = np.eye(2) * 0.04
        >>> weights = risk_mgr.size_portfolio(edges, cov)
        >>>
        >>> # Trailing stop
        >>> stop_id = risk_mgr.add_trailing_stop("market_123", 0.50)
        >>> triggered, reason = risk_mgr.update_stop(stop_id, 0.45)
        >>>
        >>> # Arbitrage detection
        >>> arb = risk_mgr.detect_arb(0.62, 0.57)
    """

    __slots__ = ('_correlation_tracker', '_trailing_stops', '_stop_counter')

    def __init__(self):
        """Initialize risk manager."""
        self._correlation_tracker = CorrelationTracker()
        self._trailing_stops: dict[str, TrailingStop] = {}
        self._stop_counter = 0

    def size_portfolio(
        self,
        edges: np.ndarray,
        covariance_matrix: np.ndarray,
        max_leverage: float = 0.25,
        current_drawdown: float = 0.0
    ) -> KellyWeights:
        """Portfolio Kelly sizing (wrapper)."""
        return portfolio_kelly(edges, covariance_matrix, max_leverage, current_drawdown)

    def add_trailing_stop(
        self,
        position_id: str,
        entry_price: float,
        stop_pct: float = 0.15,
        take_profit_edge: float = 0.01
    ) -> str:
        """
        Add trailing stop for a position.

        Args:
            position_id: Position identifier
            entry_price: Entry price
            stop_pct: Stop loss percentage (default 15%)
            take_profit_edge: Take profit edge threshold (default 1%)

        Returns:
            Stop ID (for later updates)
        """
        stop = TrailingStop(entry_price, stop_pct, take_profit_edge)
        self._trailing_stops[position_id] = stop
        return position_id

    def update_stop(
        self,
        position_id: str,
        current_price: float,
        current_edge: Optional[float] = None
    ) -> tuple[bool, str]:
        """
        Update trailing stop with current price.

        Args:
            position_id: Position identifier
            current_price: Current market price
            current_edge: Current edge estimate (optional)

        Returns:
            (triggered: bool, reason: str)
        """
        stop = self._trailing_stops.get(position_id)
        if stop is None:
            return (False, "NO_STOP_FOUND")

        return stop.update(current_price, current_edge)

    def remove_stop(self, position_id: str):
        """Remove trailing stop for closed position."""
        self._trailing_stops.pop(position_id, None)

    def detect_arb(
        self,
        polymarket_price: float,
        kalshi_price: float,
        fees: float = 0.02
    ) -> ArbOpportunity:
        """Cross-platform arbitrage detection (wrapper)."""
        return detect_arb_opportunity(polymarket_price, kalshi_price, fees)

    def update_correlation(self, market_id: str, price: float, timestamp_ms: int):
        """Update correlation tracker."""
        self._correlation_tracker.update(market_id, price, timestamp_ms)

    def get_correlation(self, market_a: str, market_b: str) -> float:
        """Get correlation between two markets."""
        return self._correlation_tracker.get_correlation(market_a, market_b)

    def get_correlated_pairs(self, threshold: float = 0.65) -> list[tuple[str, str, float]]:
        """Get correlated market pairs."""
        return self._correlation_tracker.get_correlated_pairs(threshold)

    def get_active_stops(self) -> dict[str, TrailingStop]:
        """Get all active trailing stops."""
        return {k: v for k, v in self._trailing_stops.items() if not v.is_triggered}

    def __repr__(self) -> str:
        return f"RiskManager(active_stops={len(self.get_active_stops())})"
