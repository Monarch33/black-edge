"""
Black Edge Quant Engine
========================
Transforms raw market data into actionable trading signals.

Implements:
- Kelly Criterion for optimal bet sizing
- Cross-market arbitrage detection
- Volatility index from price history
- Composite signal strength scoring
"""

from __future__ import annotations

import math
import time
from collections import deque
from dataclasses import dataclass, field

import structlog

from .polymarket import PolymarketMarket

logger = structlog.get_logger()


# =============================================================================
# Data Structures
# =============================================================================

@dataclass
class PriceSnapshot:
    """A single price observation for a market."""
    market_id: str
    yes_price: float
    timestamp: float


@dataclass
class QuantSignal:
    """Enriched market data with quant metrics."""

    # Identity
    id: str
    market: str
    question: str
    platform: str
    url: str

    # Raw prices
    yes_price: float
    no_price: float
    spread: float

    # Volume
    volume_24h: float
    volume_total: float
    liquidity: float

    # Quant metrics
    kelly_fraction: float      # Optimal bet size as fraction of bankroll
    kelly_edge: float          # Edge used in Kelly calculation
    volatility_1h: float       # Std dev of price changes (last hour)
    arb_flag: bool             # Cross-market inconsistency detected
    arb_detail: str            # Description of arbitrage if flagged

    # Composite
    signal_strength: int       # 0-100 score
    trend: str                 # "up" | "down" | "neutral"
    risk: str                  # "low" | "medium" | "high"

    def to_api_dict(self) -> dict:
        """Serialize for the /api/opportunities JSON response."""

        def _fmt_volume(v: float) -> str:
            if v >= 1_000_000:
                return f"${v / 1_000_000:.1f}M"
            if v >= 1_000:
                return f"${v / 1_000:.0f}K"
            return f"${v:.0f}"

        return {
            "id": self.id,
            "market": self.market,
            "question": self.question,
            "platform": self.platform,
            "url": self.url,
            "polyOdds": round(self.yes_price * 100),
            "trueProb": round((self.yes_price + self.kelly_edge) * 100),
            "edge": round(self.kelly_edge * 100, 1),
            "volume": _fmt_volume(self.volume_24h),
            "volumeTotal": _fmt_volume(self.volume_total),
            "liquidity": round(self.liquidity),
            "trend": self.trend,
            "risk": self.risk,
            "spread": round(self.spread, 4),
            "kellyFraction": round(self.kelly_fraction, 4),
            "volatility": round(self.volatility_1h, 4),
            "arbFlag": self.arb_flag,
            "arbDetail": self.arb_detail,
            "signalStrength": self.signal_strength,
        }


# =============================================================================
# Quant Engine
# =============================================================================

class QuantEngine:
    """
    The analytical brain of Black Edge.

    Consumes raw PolymarketMarket data and produces QuantSignals enriched
    with Kelly sizing, volatility, arbitrage flags, and signal scores.
    """

    # Price history for volatility. Maps market_id -> deque of PriceSnapshot
    _price_history: dict[str, deque[PriceSnapshot]]

    # Window for volatility calculation (seconds)
    VOLATILITY_WINDOW = 3600  # 1 hour

    # Maximum history entries per market
    MAX_HISTORY = 500

    def __init__(self) -> None:
        self._price_history = {}

    # -------------------------------------------------------------------------
    # Kelly Criterion
    # -------------------------------------------------------------------------

    @staticmethod
    def kelly_criterion(
        win_prob: float,
        odds_decimal: float,
    ) -> tuple[float, float]:
        """
        Calculate optimal bet size using the Kelly Criterion.

        f* = (p * b - q) / b

        where:
            p = probability of winning
            b = decimal odds minus 1 (net payout per $1 wagered)
            q = 1 - p

        Returns (kelly_fraction, edge).
        kelly_fraction is clamped to [0, 0.25] — never risk >25% of bankroll.
        """
        if win_prob <= 0 or win_prob >= 1 or odds_decimal <= 1:
            return 0.0, 0.0

        b = odds_decimal - 1.0
        q = 1.0 - win_prob
        edge = win_prob * b - q
        fraction = edge / b if b > 0 else 0.0

        # Clamp: negative Kelly = no bet, cap at 25%
        fraction = max(0.0, min(0.25, fraction))
        edge = max(0.0, edge)

        return fraction, edge

    @staticmethod
    def implied_odds(price: float) -> float:
        """
        Convert a market price (0-1) to decimal odds.
        Price 0.40 → pays 1/0.40 = 2.50 (you get $2.50 for every $1 wagered).
        """
        if price <= 0.01:
            return 100.0
        return 1.0 / price

    # -------------------------------------------------------------------------
    # Volatility
    # -------------------------------------------------------------------------

    def _record_price(self, market_id: str, yes_price: float) -> None:
        """Record a price observation for volatility tracking."""
        if market_id not in self._price_history:
            self._price_history[market_id] = deque(maxlen=self.MAX_HISTORY)

        self._price_history[market_id].append(PriceSnapshot(
            market_id=market_id,
            yes_price=yes_price,
            timestamp=time.time(),
        ))

    def volatility(self, market_id: str) -> float:
        """
        Calculate annualized volatility (std dev of price changes)
        over the last VOLATILITY_WINDOW seconds.

        Returns 0.0 if insufficient data.
        """
        history = self._price_history.get(market_id)
        if not history or len(history) < 3:
            return 0.0

        cutoff = time.time() - self.VOLATILITY_WINDOW
        prices = [s.yes_price for s in history if s.timestamp >= cutoff]

        if len(prices) < 3:
            return 0.0

        # Calculate returns (price changes)
        returns = [prices[i] - prices[i - 1] for i in range(1, len(prices))]

        # Standard deviation
        mean_r = sum(returns) / len(returns)
        variance = sum((r - mean_r) ** 2 for r in returns) / len(returns)
        return math.sqrt(variance)

    # -------------------------------------------------------------------------
    # Arbitrage Detection
    # -------------------------------------------------------------------------

    @staticmethod
    def detect_arbitrage(markets: list[PolymarketMarket]) -> dict[str, str]:
        """
        Detect cross-market inconsistencies.

        Looks for:
        1. YES + NO ≠ ~1.0 on same market (market mispricing / high spread)
        2. Related markets where sub-event is priced higher than parent event

        Returns {market_id: description}
        """
        arb_flags: dict[str, str] = {}

        for m in markets:
            # Check YES + NO consistency
            total = m.yes_price + m.no_price
            if total < 0.95:
                arb_flags[m.id] = (
                    f"Underpriced: YES({m.yes_price:.2f}) + NO({m.no_price:.2f}) "
                    f"= {total:.2f} < 1.0 — buy both sides for guaranteed {(1-total)*100:.1f}% profit"
                )
            elif total > 1.05:
                arb_flags[m.id] = (
                    f"Overpriced: YES({m.yes_price:.2f}) + NO({m.no_price:.2f}) "
                    f"= {total:.2f} > 1.0 — sell both sides for guaranteed {(total-1)*100:.1f}% profit"
                )

        # Detect parent/child inconsistencies via keyword matching
        # e.g., "Trump wins Texas" priced higher than "Trump wins election"
        slugs = {m.id: m.question.lower() for m in markets}
        prices = {m.id: m.yes_price for m in markets}

        for id_a, q_a in slugs.items():
            for id_b, q_b in slugs.items():
                if id_a >= id_b:
                    continue
                # If A is a subset event of B but priced higher
                if _is_subset_event(q_a, q_b) and prices[id_a] > prices[id_b] + 0.05:
                    arb_flags[id_a] = (
                        f"Subset mispricing: \"{q_a[:40]}\" ({prices[id_a]:.0%}) > "
                        f"parent \"{q_b[:40]}\" ({prices[id_b]:.0%})"
                    )

        return arb_flags

    # -------------------------------------------------------------------------
    # Signal Strength
    # -------------------------------------------------------------------------

    @staticmethod
    def signal_strength(
        kelly_edge: float,
        volume_24h: float,
        volatility: float,
        arb_flag: bool,
        spread: float,
    ) -> int:
        """
        Composite signal score 0-100.

        Weighted components (REALISTIC CALIBRATION):
        - Edge (Kelly):     50 pts max (primary driver)
        - Volume (24h):     20 pts max (sufficient liquidity)
        - Arb flag:         30 pts if detected (rare but powerful)
        - Low spread:       10 pts max (tight markets)
        - Volatility:       10 pts max (price action indicator)
        NO BASE SCORE - earn your points
        """
        score = 0.0  # Start at 0 - must earn points

        # Edge component: 0-50 (MAIN DRIVER)
        # Realistic: 1% edge → 10 pts, 2% → 20 pts, 5% → 50 pts
        edge_pct = kelly_edge * 100
        if edge_pct > 0:
            score += min(50.0, edge_pct * 10.0)  # 10 pts per 1% edge
        else:
            # Negative edge: penalty
            score += max(-20.0, edge_pct * 10.0)  # Can go negative

        # Volume component: 0-20 (sufficient for execution)
        if volume_24h > 0:
            # $10k → 2, $50k → 6, $100k → 8, $500k → 13, $1M → 15, $10M → 20
            vol_score = min(20.0, math.log10(max(volume_24h, 1)) * 5.0 - 15.0)
            score += max(0.0, vol_score)

        # Arb flag: flat 30 if detected (rare and valuable)
        if arb_flag:
            score += 30.0

        # Spread component: lower is better. 0-10
        # spread 0.00 → 10, spread 0.02 → 8, spread 0.05 → 5, spread 0.10 → 0
        score += max(0.0, 10.0 - spread * 100)

        # Volatility: moderate volatility is ideal (not too stable, not too chaotic)
        if 0.01 < volatility < 0.05:
            score += 10.0  # Sweet spot: active but not crazy
        elif 0.005 < volatility < 0.10:
            score += 5.0   # Acceptable range
        elif volatility > 0.10:
            score += 2.0   # Too volatile (risky)
        # Zero volatility gets 0 points (stale market)

        return max(0, min(100, round(score)))

    # -------------------------------------------------------------------------
    # Main Pipeline
    # -------------------------------------------------------------------------

    def analyze(self, markets: list[PolymarketMarket]) -> list[QuantSignal]:
        """
        Full analysis pipeline.
        Takes raw Polymarket data, returns enriched QuantSignals.
        """
        if not markets:
            return []

        # Record prices for volatility
        for m in markets:
            self._record_price(m.id, m.yes_price)

        # Detect cross-market arbitrage
        arb_flags = self.detect_arbitrage(markets)

        signals: list[QuantSignal] = []

        for i, m in enumerate(markets):
            # Kelly calculation
            # "True" probability estimate = yes_price (market consensus)
            # We look for edge vs the implied odds
            implied = self.implied_odds(m.yes_price)

            # REALISTIC EDGE DETECTION (Stricter thresholds for production)
            # Only detect real inefficiencies, not artificial edges

            # Primary edge source: Spread (bid-ask inefficiency)
            # Only use spread if it's significant (>0.5%)
            spread_edge = m.spread * 0.3 if m.spread > 0.005 else 0.0

            # Secondary: Volume-liquidity imbalance (rare but real)
            # Only flag if liquidity is VERY low compared to volume
            liq_ratio = m.liquidity / max(m.volume_24h, 1.0)
            liquidity_edge = 0.0
            if liq_ratio < 0.3 and m.volume_24h > 100_000:  # Stricter: <30% AND significant volume
                liquidity_edge = 0.015  # 1.5% edge on severely stressed markets

            # Tertiary: Arbitrage detection (YES+NO price sum != 1.0)
            # This is already handled separately, but we can add a small boost here
            arb_edge = 0.0
            price_sum = m.yes_price + (1.0 - m.yes_price)  # Should = 1.0
            price_sum_from_market = m.yes_price + m.no_price if hasattr(m, 'no_price') else 1.0
            if abs(price_sum_from_market - 1.0) > 0.02:  # >2% deviation
                arb_edge = 0.01  # Small 1% edge for price inconsistency

            # Total edge (cap at 5% for realism - most markets are efficient)
            total_edge = min(0.05, spread_edge + liquidity_edge + arb_edge)

            # Apply edge: Simple additive model (no complex contrarian logic)
            est_prob = m.yes_price + total_edge
            est_prob = max(0.01, min(0.99, est_prob))

            kelly_f, kelly_e = self.kelly_criterion(est_prob, implied)

            # Volatility
            vol = self.volatility(m.id)

            # Arb
            is_arb = m.id in arb_flags
            arb_detail = arb_flags.get(m.id, "")

            # Signal
            sig = self.signal_strength(kelly_e, m.volume_24h, vol, is_arb, m.spread)

            # Trend: based on price history
            trend = self._compute_trend(m.id)

            # Risk: based on liquidity + volatility
            risk = _classify_risk(m.liquidity, vol, m.volume_24h)

            signals.append(QuantSignal(
                id=str(i + 1),
                market=m.market_name,
                question=m.question,
                platform="Polymarket",
                url=m.url,
                yes_price=m.yes_price,
                no_price=m.no_price,
                spread=m.spread,
                volume_24h=m.volume_24h,
                volume_total=m.volume_total,
                liquidity=m.liquidity,
                kelly_fraction=kelly_f,
                kelly_edge=kelly_e,
                volatility_1h=vol,
                arb_flag=is_arb,
                arb_detail=arb_detail,
                signal_strength=sig,
                trend=trend,
                risk=risk,
            ))

        # Sort by signal strength descending
        signals.sort(key=lambda s: s.signal_strength, reverse=True)

        return signals

    def _compute_trend(self, market_id: str) -> str:
        """Determine trend from recent price history."""
        history = self._price_history.get(market_id)
        if not history or len(history) < 2:
            return "neutral"

        recent = list(history)[-5:]  # Last 5 observations
        if len(recent) < 2:
            return "neutral"

        first = recent[0].yes_price
        last = recent[-1].yes_price
        delta = last - first

        if delta > 0.01:
            return "up"
        elif delta < -0.01:
            return "down"
        return "neutral"


# =============================================================================
# Helpers
# =============================================================================

def _is_subset_event(question_a: str, question_b: str) -> bool:
    """
    Rough heuristic: is question_a a subset/sub-event of question_b?
    e.g., "trump wins texas" is a subset of "trump wins election"
    """
    # Extract key subject
    words_a = set(question_a.split())
    words_b = set(question_b.split())

    # If A contains all key words of B plus extras, A might be more specific
    common = words_a & words_b
    if len(common) < 2:
        return False

    # A is more specific if it has more unique words
    unique_a = words_a - words_b
    unique_b = words_b - words_a

    # Check for state/region names that indicate sub-events
    state_indicators = {
        "texas", "florida", "ohio", "michigan", "pennsylvania",
        "georgia", "arizona", "nevada", "wisconsin", "state",
        "q1", "q2", "q3", "q4", "january", "february", "march",
    }

    return bool(unique_a & state_indicators) and len(unique_b) < 3


def _classify_risk(liquidity: float, volatility: float, volume_24h: float) -> str:
    """Classify risk level based on market characteristics."""
    risk_score = 0

    # Low liquidity = higher risk
    if liquidity < 10_000:
        risk_score += 3
    elif liquidity < 50_000:
        risk_score += 2
    elif liquidity < 200_000:
        risk_score += 1

    # High volatility = higher risk
    if volatility > 0.05:
        risk_score += 2
    elif volatility > 0.02:
        risk_score += 1

    # Low volume = higher risk
    if volume_24h < 5_000:
        risk_score += 2
    elif volume_24h < 50_000:
        risk_score += 1

    if risk_score >= 4:
        return "high"
    elif risk_score >= 2:
        return "medium"
    return "low"
