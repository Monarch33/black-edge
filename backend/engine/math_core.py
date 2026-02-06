"""
Mathematical Core: Arbitrage Detection & Optimization
======================================================
Implements convex optimization for arbitrage-free price projection.

This module uses the Frank-Wolfe algorithm to project observed market prices
onto the marginal polytope of valid probability distributions, detecting
and quantifying arbitrage opportunities.

References:
- "Arbitrage-Free Combinatorial Market Making" (Dudik et al.)
- "Unravelling the Probabilistic Forest" (Saguillo et al.)
"""

import numpy as np
from numpy.typing import NDArray
from scipy.optimize import minimize, linear_sum_assignment
from scipy.special import softmax
from dataclasses import dataclass
from typing import Optional
from enum import Enum
import structlog

logger = structlog.get_logger()


class ArbitrageType(Enum):
    """Classification of arbitrage opportunities."""
    NONE = "none"
    LONG_REBALANCING = "long_rebalancing"  # Sum of YES < 1
    SHORT_REBALANCING = "short_rebalancing"  # Sum of YES > 1
    COMBINATORIAL = "combinatorial"  # Cross-market dependency


@dataclass
class ArbitrageOpportunity:
    """Represents a detected arbitrage opportunity."""
    arb_type: ArbitrageType
    market_ids: list[str]
    condition_ids: list[str]
    observed_prices: NDArray[np.float64]
    projected_prices: NDArray[np.float64]
    profit_per_dollar: float
    recommended_positions: dict[str, str]  # condition_id -> "YES" or "NO"
    confidence: float
    execution_risk: float


@dataclass
class MarketState:
    """Current state of a market or set of related markets."""
    market_id: str
    condition_ids: list[str]
    yes_prices: NDArray[np.float64]
    no_prices: NDArray[np.float64]
    volumes: NDArray[np.float64]
    dependency_matrix: Optional[NDArray[np.float64]] = None


class MarginalPolytope:
    """
    Represents the marginal polytope M of valid probability distributions.

    For a set of n conditions in an exhaustive market, the valid distributions
    form a simplex where exactly one condition is true.

    For dependent markets with m + n conditions across two markets,
    the polytope is the convex hull of valid joint outcome vectors.
    """

    def __init__(self, num_conditions: int, dependency_matrix: Optional[NDArray] = None):
        """
        Initialize the marginal polytope.

        Args:
            num_conditions: Total number of conditions
            dependency_matrix: Binary matrix where entry (i,j)=1 means
                              condition i being True implies condition j is False
        """
        self.num_conditions = num_conditions
        self.dependency_matrix = dependency_matrix
        self._vertices = self._compute_vertices()

    def _compute_vertices(self) -> NDArray[np.float64]:
        """
        Compute the vertices of the marginal polytope.

        For independent conditions: vertices are standard basis vectors (simplex).
        For dependent conditions: vertices are valid joint outcome vectors.
        """
        if self.dependency_matrix is None:
            # Simple case: standard simplex vertices
            return np.eye(self.num_conditions)

        # Complex case: enumerate valid outcome vectors respecting dependencies
        vertices = []
        for i in range(2 ** self.num_conditions):
            outcome = np.array([(i >> j) & 1 for j in range(self.num_conditions)])

            # Check if this outcome is valid (respects dependencies)
            if self._is_valid_outcome(outcome):
                vertices.append(outcome)

        if not vertices:
            # Fallback to simplex if no valid outcomes found
            logger.warning("No valid outcomes found, falling back to simplex")
            return np.eye(self.num_conditions)

        return np.array(vertices)

    def _is_valid_outcome(self, outcome: NDArray) -> bool:
        """Check if an outcome vector respects the dependency constraints."""
        if self.dependency_matrix is None:
            return True

        # For each condition that is True, check dependencies
        for i in range(len(outcome)):
            if outcome[i] == 1:
                for j in range(len(outcome)):
                    if self.dependency_matrix[i, j] == 1 and outcome[j] == 1:
                        return False  # Dependency violated
        return True

    def project_frank_wolfe(
        self,
        prices: NDArray[np.float64],
        max_iterations: int = 100,
        tolerance: float = 1e-6,
    ) -> tuple[NDArray[np.float64], float]:
        """
        Project prices onto the marginal polytope using Frank-Wolfe algorithm.

        The Frank-Wolfe algorithm finds the closest point in the polytope
        to the observed prices by iteratively moving toward the best vertex.

        Args:
            prices: Observed market prices (should sum to ~1 for arbitrage-free)
            max_iterations: Maximum iterations for convergence
            tolerance: Convergence tolerance

        Returns:
            Tuple of (projected_prices, distance_to_polytope)
        """
        if len(prices) != self.num_conditions:
            raise ValueError(
                f"Price vector length {len(prices)} != num_conditions {self.num_conditions}"
            )

        # Initialize with closest vertex
        mu = self._find_closest_vertex(prices)

        for iteration in range(max_iterations):
            # Compute gradient: gradient of ||mu - prices||^2 is 2(mu - prices)
            gradient = 2 * (mu - prices)

            # Find the vertex that minimizes the linear approximation
            # (Frank-Wolfe direction-finding subproblem)
            vertex_scores = self._vertices @ gradient
            best_vertex_idx = np.argmin(vertex_scores)
            s = self._vertices[best_vertex_idx]

            # Compute the gap (duality gap for convergence check)
            gap = gradient @ (mu - s)
            if gap < tolerance:
                logger.debug(f"Frank-Wolfe converged at iteration {iteration}")
                break

            # Line search: find optimal step size
            # For quadratic objective, optimal step is:
            # gamma = (gradient @ (mu - s)) / ||s - mu||^2
            d = s - mu
            denom = np.dot(d, d)
            if denom > 1e-10:
                gamma = min(1.0, max(0.0, np.dot(gradient, -d) / denom))
            else:
                gamma = 1.0

            # Update
            mu = mu + gamma * d

        # Compute final distance
        distance = np.linalg.norm(mu - prices)
        return mu, distance

    def _find_closest_vertex(self, prices: NDArray) -> NDArray[np.float64]:
        """Find the vertex closest to the given price vector."""
        distances = np.linalg.norm(self._vertices - prices, axis=1)
        return self._vertices[np.argmin(distances)].astype(np.float64)

    @property
    def vertices(self) -> NDArray[np.float64]:
        """Return the vertices of the polytope."""
        return self._vertices


class ArbitrageDetector:
    """
    Detects arbitrage opportunities in prediction markets.

    Combines the mathematical optimization approach (Frank-Wolfe projection)
    with practical considerations like execution risk and minimum profit thresholds.
    """

    def __init__(
        self,
        min_profit_threshold: float = 0.05,
        max_position_probability: float = 0.95,
    ):
        self.min_profit_threshold = min_profit_threshold
        self.max_position_probability = max_position_probability

    def detect_rebalancing_arbitrage(
        self, market: MarketState
    ) -> Optional[ArbitrageOpportunity]:
        """
        Detect Market Rebalancing Arbitrage within a single market.

        This occurs when the sum of YES prices != 1 for mutually exclusive conditions.

        Args:
            market: Current market state

        Returns:
            ArbitrageOpportunity if found, None otherwise
        """
        yes_sum = np.sum(market.yes_prices)

        # Check if any position exceeds max probability threshold
        if np.any(market.yes_prices > self.max_position_probability):
            logger.debug(
                "Skipping market with high-confidence position",
                market_id=market.market_id,
            )
            return None

        # Determine arbitrage type
        if abs(yes_sum - 1.0) < self.min_profit_threshold:
            return None  # No significant arbitrage

        if yes_sum < 1.0:
            # Long arbitrage: buy all YES positions
            arb_type = ArbitrageType.LONG_REBALANCING
            profit = 1.0 - yes_sum
            positions = {cid: "YES" for cid in market.condition_ids}
        else:
            # Short arbitrage: buy all NO positions (or split and sell YES)
            arb_type = ArbitrageType.SHORT_REBALANCING
            profit = yes_sum - 1.0
            positions = {cid: "NO" for cid in market.condition_ids}

        if profit < self.min_profit_threshold:
            return None

        # Project onto simplex for optimal allocation
        polytope = MarginalPolytope(len(market.yes_prices))
        projected, distance = polytope.project_frank_wolfe(market.yes_prices)

        # Calculate execution risk based on volume
        execution_risk = self._calculate_execution_risk(market.volumes, profit)

        return ArbitrageOpportunity(
            arb_type=arb_type,
            market_ids=[market.market_id],
            condition_ids=market.condition_ids,
            observed_prices=market.yes_prices,
            projected_prices=projected,
            profit_per_dollar=profit,
            recommended_positions=positions,
            confidence=1.0 - distance,
            execution_risk=execution_risk,
        )

    def detect_combinatorial_arbitrage(
        self,
        market1: MarketState,
        market2: MarketState,
        dependency_matrix: NDArray[np.float64],
    ) -> Optional[ArbitrageOpportunity]:
        """
        Detect Combinatorial Arbitrage between dependent markets.

        This occurs when dependent conditions across markets have inconsistent prices.

        Args:
            market1: First market state
            market2: Second market state
            dependency_matrix: Matrix encoding dependencies between conditions

        Returns:
            ArbitrageOpportunity if found, None otherwise
        """
        # Combine conditions from both markets
        all_conditions = market1.condition_ids + market2.condition_ids
        all_prices = np.concatenate([market1.yes_prices, market2.yes_prices])
        all_volumes = np.concatenate([market1.volumes, market2.volumes])

        # Check max probability threshold
        if np.any(all_prices > self.max_position_probability):
            return None

        # Build the marginal polytope for dependent markets
        polytope = MarginalPolytope(len(all_prices), dependency_matrix)

        # Project prices onto the polytope
        projected, distance = polytope.project_frank_wolfe(all_prices)

        # Arbitrage exists if projection moves prices significantly
        price_deviation = np.abs(all_prices - projected)
        max_deviation = np.max(price_deviation)

        if max_deviation < self.min_profit_threshold:
            return None

        # Calculate profit potential
        # For combinatorial arbitrage, profit is the cost difference
        # between buying dependent positions at observed vs projected prices
        profit = np.sum(np.abs(all_prices - projected)) / 2

        if profit < self.min_profit_threshold:
            return None

        # Determine positions: buy where observed < projected (undervalued)
        positions = {}
        for i, cid in enumerate(all_conditions):
            if all_prices[i] < projected[i]:
                positions[cid] = "YES"
            elif all_prices[i] > projected[i]:
                positions[cid] = "NO"

        execution_risk = self._calculate_execution_risk(all_volumes, profit)

        return ArbitrageOpportunity(
            arb_type=ArbitrageType.COMBINATORIAL,
            market_ids=[market1.market_id, market2.market_id],
            condition_ids=all_conditions,
            observed_prices=all_prices,
            projected_prices=projected,
            profit_per_dollar=profit,
            recommended_positions=positions,
            confidence=1.0 - distance / len(all_prices),
            execution_risk=execution_risk,
        )

    def _calculate_execution_risk(
        self, volumes: NDArray, profit: float
    ) -> float:
        """
        Calculate execution risk based on market liquidity.

        Higher volume = lower risk of slippage.
        Risk increases as profit margin decreases relative to volume.
        """
        min_volume = np.min(volumes)
        if min_volume <= 0:
            return 1.0  # Maximum risk if any position has no volume

        # Risk inversely proportional to volume/profit ratio
        volume_ratio = min_volume / (profit * 1000)  # Normalize
        risk = 1.0 / (1.0 + volume_ratio)
        return min(1.0, max(0.0, risk))


class OptimalTradeCalculator:
    """
    Calculates optimal trade sizes using Bregman projections.

    For LMSR-style markets, uses Kullback-Leibler divergence to find
    the trade that projects current prices onto the arbitrage-free set.
    """

    def __init__(self, liquidity_parameter: float = 100.0):
        """
        Args:
            liquidity_parameter: The 'b' parameter in LMSR (higher = more liquidity)
        """
        self.b = liquidity_parameter

    def calculate_optimal_trade(
        self,
        current_prices: NDArray[np.float64],
        target_prices: NDArray[np.float64],
        max_trade_size: float = 1000.0,
    ) -> NDArray[np.float64]:
        """
        Calculate the optimal trade to move from current to target prices.

        Uses KL-divergence minimization for LMSR markets:
        min_delta KL(target || price(q + delta))

        For order book markets, this gives a direction and magnitude
        for the trades needed.

        Args:
            current_prices: Current market prices
            target_prices: Target (arbitrage-free) prices
            max_trade_size: Maximum total trade size in USDC

        Returns:
            Array of trade sizes (positive = buy, negative = sell)
        """
        # Normalize to probability distributions
        current_prob = current_prices / np.sum(current_prices)
        target_prob = target_prices / np.sum(target_prices)

        # For LMSR, price = exp(q_i / b) / sum(exp(q_j / b))
        # Inverse: q_i = b * log(p_i) + constant
        # Trade delta_i = b * (log(target_i) - log(current_i))

        # Avoid log(0) by adding small epsilon
        eps = 1e-10
        current_safe = np.clip(current_prob, eps, 1.0)
        target_safe = np.clip(target_prob, eps, 1.0)

        raw_delta = self.b * (np.log(target_safe) - np.log(current_safe))

        # Scale to max trade size
        total_trade = np.sum(np.abs(raw_delta))
        if total_trade > max_trade_size:
            raw_delta = raw_delta * (max_trade_size / total_trade)

        return raw_delta

    def kl_divergence(
        self, p: NDArray[np.float64], q: NDArray[np.float64]
    ) -> float:
        """
        Calculate KL divergence D_KL(p || q).

        Args:
            p: Target distribution
            q: Current distribution

        Returns:
            KL divergence value
        """
        eps = 1e-10
        p_safe = np.clip(p, eps, 1.0)
        q_safe = np.clip(q, eps, 1.0)
        return float(np.sum(p_safe * np.log(p_safe / q_safe)))
