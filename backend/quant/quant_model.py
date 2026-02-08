"""
Quant Model - The Central Brain
Hybrid ML model fusing structured features, sentiment, and narrative velocity
into actionable trading signals with confidence scoring.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

from .config import Signal, Side, FeatureVector, ModelConfig
from .narrative_velocity import NarrativeSignal


@dataclass(slots=True)
class SignalOutput:
    """
    Complete trading signal output from QuantModel.

    Combines structured features, sentiment, and narrative velocity
    into a single actionable signal with confidence metrics.

    Attributes:
        market_id: Market identifier
        timestamp_ms: When signal was computed
        signal: STRONG_BUY, BUY, HOLD, SELL, STRONG_SELL
        edge: Expected edge over market price
        confidence: [0, 1] overall confidence
        final_probability: Model's predicted probability [0, 1]
        market_price: Current market price
        recommended_side: BUY or SELL
        tradeable: Passes all risk filters
        struct_contribution: Tower A probability
        sentiment_contribution: Tower B probability
        narrative_velocity: NVI score if accelerating
        whale_alignment: True if whales aligned, False if opposed
    """
    market_id: str
    timestamp_ms: int
    signal: Signal
    edge: float
    confidence: float
    final_probability: float
    market_price: float
    recommended_side: Side
    tradeable: bool
    struct_contribution: float
    sentiment_contribution: float
    narrative_velocity: float
    whale_alignment: Optional[bool]


class QuantModel:
    """
    Hybrid quantitative model for prediction market signals.

    Fuses three information towers:
    - Tower A: Structured features (order book, volume, momentum)
    - Tower B: Sentiment analysis (NLP)
    - Tower C: Narrative velocity (keyword spikes)

    Uses ensemble weighting to produce final probability estimate,
    then converts to trading signal with confidence scoring.

    The Holy Grail Architecture:
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │  Tower A    │  │  Tower B    │  │  Tower C    │
    │ Structured  │  │  Sentiment  │  │  Narrative  │
    │  Features   │  │     NLP     │  │  Velocity   │
    └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
           │                │                │
           └────────────────┼────────────────┘
                            ▼
                    ┌───────────────┐
                    │   Ensemble    │
                    │  (Weighted)   │
                    └───────┬───────┘
                            ▼
                    ┌───────────────┐
                    │ Edge + Signal │
                    │  Classification│
                    └───────────────┘

    Example:
        >>> model = QuantModel()
        >>> signal = model.compute_signal(features, narrative, whale_aligned=True)
        >>> if signal.tradeable and signal.signal == Signal.STRONG_BUY:
        ...     execute_trade(signal.market_id, 'BUY', signal.edge)
    """

    __slots__ = ('config',)

    def __init__(self, config: Optional[ModelConfig] = None):
        """
        Initialize quant model with configuration.

        Args:
            config: Model configuration (defaults to ModelConfig())
        """
        self.config = config or ModelConfig()

    def compute_signal(
        self,
        features: FeatureVector,
        narrative: Optional[NarrativeSignal] = None,
        whale_is_aligned: Optional[bool] = None
    ) -> SignalOutput:
        """
        Compute complete trading signal from all inputs.

        Args:
            features: Engineered features from FeatureEngineer
            narrative: Narrative velocity signal (optional)
            whale_is_aligned: Whether whales are trading same direction (optional)

        Returns:
            SignalOutput with signal, edge, confidence, and attribution
        """
        # Validate input
        if not features.is_valid:
            return self._null_signal(features.market_id, features.timestamp_ms)

        # ═══ TOWER A: Structured Features ═══
        p_struct = self._compute_struct_probability(features)

        # ═══ TOWER B: Sentiment ═══
        p_sentiment = self._sigmoid(features.sentiment_score * 3.0)

        # ═══ TOWER C: Narrative Velocity ═══
        nvi_score = 0.0
        if narrative is not None and narrative.is_accelerating:
            nvi_score = narrative.nvi_score

        p_narrative = (nvi_score + 1.0) / 2.0  # Map [-1, 1] to [0, 1]

        # ═══ ENSEMBLE: Weight Combination ═══
        # If narrative is missing, redistribute its weight
        if narrative is None:
            w_struct = self.config.struct_weight + self.config.narrative_weight * 0.7
            w_sent = self.config.sentiment_weight + self.config.narrative_weight * 0.3
            w_narr = 0.0
        else:
            w_struct = self.config.struct_weight
            w_sent = self.config.sentiment_weight
            w_narr = self.config.narrative_weight

        final_prob = (
            w_struct * p_struct +
            w_sent * p_sentiment +
            w_narr * p_narrative
        )

        # Clamp to valid probability range
        final_prob = max(0.01, min(0.99, final_prob))

        # ═══ EDGE CALCULATION ═══
        market_price = features.mid_price
        edge = final_prob - market_price

        # ═══ CONFIDENCE SCORING ═══
        confidence = self._compute_confidence(
            features, narrative, whale_is_aligned
        )

        # ═══ SIGNAL CLASSIFICATION ═══
        signal = self._classify_signal(edge, confidence)

        # ═══ TRADEABLE FILTER ═══
        tradeable = (
            abs(edge) >= self.config.min_edge and
            confidence >= self.config.min_confidence and
            features.spread_bps <= self.config.max_spread_bps
        )

        # ═══ RECOMMENDED SIDE ═══
        recommended_side = Side.BUY if edge > 0 else Side.SELL

        return SignalOutput(
            market_id=features.market_id,
            timestamp_ms=features.timestamp_ms,
            signal=signal,
            edge=edge,
            confidence=confidence,
            final_probability=final_prob,
            market_price=market_price,
            recommended_side=recommended_side,
            tradeable=tradeable,
            struct_contribution=p_struct,
            sentiment_contribution=p_sentiment,
            narrative_velocity=nvi_score,
            whale_alignment=whale_is_aligned,
        )

    def _compute_struct_probability(self, features: FeatureVector) -> float:
        """
        Tower A: Compute probability from structured features.

        Process:
        1. Start with market price as base
        2. Adjust for order book imbalance (+/- 6% * OBI)
        3. Adjust for volume anomalies (tanh(vol_z/3) * 4% * sign(OBI))
        4. Adjust for momentum (momentum_1h * 0.5)
        5. Apply volatility dampening (1 / (1 + IV))
        6. Clamp to [0.01, 0.99]

        Args:
            features: Feature vector

        Returns:
            Probability estimate in [0.01, 0.99]
        """
        # Base: current market price
        base = features.mid_price

        # Adjustment 1: Order Book Imbalance
        # OBI in [-1, 1] where +1 = all bids (bullish)
        # Move price +/- 6% based on pressure
        obi_adjustment = 0.06 * features.order_book_imbalance

        # Adjustment 2: Volume Z-Score
        # High volume spike + positive OBI = strong signal
        # Use tanh for bounded influence
        vol_adjustment = (
            math.tanh(features.volume_z_score / 3.0) * 0.04 *
            math.copysign(1.0, features.order_book_imbalance)
        )

        # Adjustment 3: Momentum
        # Direct momentum signal (already in [-0.5, 0.5])
        momentum_adjustment = features.momentum_1h * 0.5

        # Combine adjustments
        adjusted = base + obi_adjustment + vol_adjustment + momentum_adjustment

        # Adjustment 4: Volatility Dampening
        # High IV = uncertain outcome, dampen adjustments
        iv_damping = 1.0 / (1.0 + features.implied_volatility)

        # Apply dampening (keep base, dampen adjustments)
        final = base + (adjusted - base) * iv_damping

        # Clamp to valid probability range
        return max(0.01, min(0.99, final))

    def _compute_confidence(
        self,
        features: FeatureVector,
        narrative: Optional[NarrativeSignal],
        whale_is_aligned: Optional[bool]
    ) -> float:
        """
        Compute overall confidence in the signal.

        Uses geometric mean of component confidences, then applies
        whale alignment boost/penalty.

        Args:
            features: Feature vector
            narrative: Narrative signal (optional)
            whale_is_aligned: Whale alignment (optional)

        Returns:
            Confidence score in [0, 1]
        """
        confidences = []

        # Structured feature confidence
        # High when OBI and volume agree, low when spread is wide
        struct_conf = (
            abs(features.order_book_imbalance) * 0.5 +
            min(abs(features.volume_z_score) / 3.0, 1.0) * 0.3 +
            (1.0 - min(features.spread_bps / self.config.max_spread_bps, 1.0)) * 0.2
        )
        confidences.append(struct_conf)

        # Sentiment confidence (absolute value = strength)
        sent_conf = min(abs(features.sentiment_score), 1.0)
        confidences.append(sent_conf)

        # Narrative confidence (if present)
        if narrative is not None and narrative.is_accelerating:
            narr_conf = abs(narrative.nvi_score)
            confidences.append(narr_conf)

        # Geometric mean (penalizes low individual confidences)
        if len(confidences) == 0:
            base_confidence = 0.5
        else:
            product = 1.0
            for c in confidences:
                product *= max(c, 0.01)  # Avoid zero
            base_confidence = product ** (1.0 / len(confidences))

        # Whale alignment boost
        if whale_is_aligned is True:
            whale_boost = 1.15  # +15% confidence boost
        elif whale_is_aligned is False:
            whale_boost = 0.85  # -15% confidence penalty
        else:
            whale_boost = 1.0   # No adjustment

        final_confidence = base_confidence * whale_boost

        return max(0.0, min(1.0, final_confidence))

    def _classify_signal(self, edge: float, confidence: float) -> Signal:
        """
        Classify edge + confidence into discrete signal.

        Uses strength = |edge| * confidence as the metric.

        Thresholds:
        - strength > 0.08 → STRONG_BUY/SELL
        - strength > 0.03 → BUY/SELL
        - otherwise → HOLD

        Args:
            edge: Expected edge (can be negative)
            confidence: Confidence in [0, 1]

        Returns:
            Signal enum (STRONG_BUY/BUY/HOLD/SELL/STRONG_SELL)
        """
        strength = abs(edge) * confidence

        if strength > 0.08:
            # Strong signal
            return Signal.STRONG_BUY if edge > 0 else Signal.STRONG_SELL
        elif strength > 0.03:
            # Normal signal
            return Signal.BUY if edge > 0 else Signal.SELL
        else:
            # Weak signal
            return Signal.HOLD

    @staticmethod
    def _sigmoid(x: float) -> float:
        """Sigmoid activation with clipping for numerical stability."""
        x = max(-10.0, min(10.0, x))  # Clip to prevent overflow
        return 1.0 / (1.0 + math.exp(-x))

    def _null_signal(self, market_id: str, timestamp_ms: int) -> SignalOutput:
        """Return a null/HOLD signal when data is insufficient."""
        return SignalOutput(
            market_id=market_id,
            timestamp_ms=timestamp_ms,
            signal=Signal.HOLD,
            edge=0.0,
            confidence=0.0,
            final_probability=0.5,
            market_price=0.5,
            recommended_side=Side.BUY,
            tradeable=False,
            struct_contribution=0.5,
            sentiment_contribution=0.5,
            narrative_velocity=0.0,
            whale_alignment=None,
        )

    def __repr__(self) -> str:
        return f"QuantModel(config={self.config})"
