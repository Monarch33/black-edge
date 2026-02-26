"""
Feature Engineer - Real-Time Market Feature Computation
High-performance feature engineering for prediction market signals.
Target: <10ms per compute() call on hot path. Zero pandas.
"""

from __future__ import annotations

import time
from collections import defaultdict
from typing import Optional
import numpy as np

from .config import (
    FeatureVector, MarketTick, OrderBookSnapshot, OrderBookLevel, FeatureConfig
)
from .utils import RingBuffer, SentimentIntensityAnalyzer


class FeatureEngineer:
    """
    Real-time feature computation engine for prediction markets.

    Maintains rolling windows of price/volume data and computes
    5 core features optimized for sub-10ms latency.

    Example:
        >>> engineer = FeatureEngineer()
        >>> engineer.ingest_tick(tick)
        >>> engineer.ingest_orderbook(book)
        >>> features = engineer.compute('market-123')
        >>> print(features.order_book_imbalance)
    """

    __slots__ = (
        'config',
        '_prices',           # dict[market_id, RingBuffer] - 24h of prices
        '_volumes',          # dict[market_id, RingBuffer] - 24h of volumes
        '_timestamps',       # dict[market_id, RingBuffer] - 24h of timestamps
        '_orderbooks',       # dict[market_id, OrderBookSnapshot] - latest snapshot
        '_headlines',        # dict[market_id, list[(ts, sentiment)]] - sentiment history
        '_sentiment',        # SentimentIntensityAnalyzer instance
    )

    def __init__(self, config: Optional[FeatureConfig] = None):
        """
        Initialize feature engineer with configuration.

        Args:
            config: Feature engineering config (defaults to FeatureConfig())
        """
        self.config = config or FeatureConfig()

        # Time-series storage: 86400 seconds = 24h at 1 tick/sec
        self._prices = defaultdict(lambda: RingBuffer(86400, dtype=np.float64))
        self._volumes = defaultdict(lambda: RingBuffer(86400, dtype=np.float64))
        self._timestamps = defaultdict(lambda: RingBuffer(86400, dtype=np.int64))

        # Latest orderbook snapshots (one per market)
        self._orderbooks: dict[str, OrderBookSnapshot] = {}

        # Headline sentiment: list of (timestamp_ms, compound_score)
        self._headlines: dict[str, list[tuple[int, float]]] = defaultdict(list)

        # Sentiment analyzer (shared across all markets)
        self._sentiment = SentimentIntensityAnalyzer()

    # ═══════════════════════════════════════════════════════════════════════
    # INGESTION METHODS
    # ═══════════════════════════════════════════════════════════════════════

    def ingest_tick(self, tick: MarketTick) -> None:
        """
        Ingest a price/volume tick into rolling buffers.

        Args:
            tick: Market data tick from WebSocket or REST API
        """
        mid = tick.market_id
        self._prices[mid].append(tick.mid_price)
        self._volumes[mid].append(tick.volume_1h_usd)
        self._timestamps[mid].append(tick.timestamp_ms)

    def ingest_orderbook(self, book: OrderBookSnapshot) -> None:
        """
        Store latest orderbook snapshot (for OBI calculation).

        Args:
            book: Complete L2 orderbook snapshot
        """
        self._orderbooks[book.market_id] = book

    def ingest_headline(self, headline: str, timestamp_ms: int, market_id: str) -> None:
        """
        Analyze sentiment of a news headline and store with timestamp.

        Args:
            headline: News headline text
            timestamp_ms: When the headline was published
            market_id: Which market this headline relates to
        """
        scores = self._sentiment.polarity_scores(headline)
        self._headlines[market_id].append((timestamp_ms, scores['compound']))

        # Keep only last 1000 headlines per market to prevent unbounded growth
        if len(self._headlines[market_id]) > 1000:
            self._headlines[market_id] = self._headlines[market_id][-1000:]

    # ═══════════════════════════════════════════════════════════════════════
    # FEATURE COMPUTATION (HOT PATH - TARGET <10MS)
    # ═══════════════════════════════════════════════════════════════════════

    def compute(self, market_id: str) -> FeatureVector:
        """
        Compute all 5 features for a market in <10ms.

        Features:
        1. Order Book Imbalance (OBI)
        2. Volume Z-Score
        3. Implied Volatility
        4. Momentum 1h
        5. Sentiment Score

        Args:
            market_id: Market to compute features for

        Returns:
            FeatureVector with is_valid=True if sufficient data,
            otherwise is_valid=False
        """
        # Fast-fail if insufficient data
        if not self._has_sufficient_data(market_id):
            return self._invalid_feature_vector(market_id)

        # Get current state (O(1) operations)
        current_ts = int(self._timestamps[market_id].last())
        mid_price = self._prices[market_id].last()

        # Compute features (all optimized for speed)
        obi = self._compute_order_book_imbalance(market_id)
        vol_z = self._compute_volume_z_score(market_id)
        iv = self._compute_implied_volatility(market_id)
        mom = self._compute_momentum_1h(market_id, current_ts)
        sent = self._compute_sentiment_score(market_id, current_ts)

        # Spread calculation
        spread_bps = self._compute_spread_bps(market_id)

        return FeatureVector(
            market_id=market_id,
            timestamp_ms=current_ts,
            order_book_imbalance=obi,
            volume_z_score=vol_z,
            implied_volatility=iv,
            momentum_1h=mom,
            sentiment_score=sent,
            mid_price=mid_price,
            spread_bps=spread_bps,
            is_valid=True
        )

    # ═══════════════════════════════════════════════════════════════════════
    # FEATURE IMPLEMENTATIONS
    # ═══════════════════════════════════════════════════════════════════════

    def _compute_order_book_imbalance(self, market_id: str) -> float:
        """
        Order Book Imbalance (OBI) on top N levels.

        Formula: (bid_volume - ask_volume) / (bid_volume + ask_volume)
        Range: [-1, 1] where +1 = all bids, -1 = all asks

        Returns:
            OBI in [-1, 1], or 0.0 if no book data
        """
        book = self._orderbooks.get(market_id)
        if not book or not book.bids or not book.asks:
            return 0.0

        depth = self.config.obi_depth_levels

        # Sum top N levels (O(N) where N=5)
        bid_vol = sum(level.size for level in book.bids[:depth])
        ask_vol = sum(level.size for level in book.asks[:depth])

        total = bid_vol + ask_vol
        if total == 0:
            return 0.0

        return (bid_vol - ask_vol) / total

    def _compute_volume_z_score(self, market_id: str) -> float:
        """
        Volume Z-Score: (V_current - mean_24h) / std_24h

        Detects abnormal volume spikes (> 2.0 = significant).

        Returns:
            Z-score (unbounded), or 0.0 if insufficient data
        """
        volumes = self._volumes[market_id]
        if volumes.count < 2:
            return 0.0

        current_vol = volumes.last()
        mean_vol = volumes.mean()
        std_vol = volumes.std()

        if std_vol == 0 or np.isnan(std_vol):
            return 0.0

        return (current_vol - mean_vol) / std_vol

    def _compute_implied_volatility(self, market_id: str) -> float:
        """
        Implied Volatility from price variance.

        Formula: std(log_returns) * sqrt(minutes_per_year / window)
        Annualized volatility proxy from recent price action.

        Returns:
            Annualized volatility (e.g., 0.25 = 25%), or 0.0 if insufficient data
        """
        window_min = self.config.volatility_window_minutes

        # Get recent prices (assume 1 tick per second)
        window_ticks = window_min * 60
        prices = self._prices[market_id].tail(window_ticks)

        if len(prices) < 2:
            return 0.0

        # Log returns
        log_returns = np.diff(np.log(prices + 1e-10))  # Epsilon for stability

        if len(log_returns) == 0:
            return 0.0

        # Annualize
        std_returns = np.std(log_returns)
        minutes_per_year = 365.25 * 24 * 60
        annualized_vol = std_returns * np.sqrt(minutes_per_year / window_min)

        return float(annualized_vol)

    def _compute_momentum_1h(self, market_id: str, current_ts: int) -> float:
        """
        Price momentum over 1 hour.

        Formula: (P_now - P_1h_ago) / P_1h_ago
        Clamped to [-0.5, 0.5] to prevent outliers.

        Args:
            market_id: Market ID
            current_ts: Current timestamp in milliseconds

        Returns:
            Momentum in [-0.5, 0.5], or 0.0 if insufficient history
        """
        window_min = self.config.momentum_window_minutes
        window_ms = window_min * 60 * 1000

        prices = self._prices[market_id]
        timestamps = self._timestamps[market_id]

        if prices.count < 2:
            return 0.0

        current_price = prices.last()

        # Get all data for searching
        all_prices = prices.tail(prices.count)
        all_ts = timestamps.tail(timestamps.count)

        # Find price closest to target_ts (1h ago)
        target_ts = current_ts - window_ms
        idx = np.searchsorted(all_ts, target_ts)

        if idx >= len(all_prices) or idx == len(all_prices) - 1:
            # Not enough history
            return 0.0

        old_price = all_prices[idx]

        if old_price == 0 or np.isnan(old_price):
            return 0.0

        momentum = (current_price - old_price) / old_price

        # Clamp to [-0.5, 0.5]
        return float(np.clip(momentum, -0.5, 0.5))

    def _compute_sentiment_score(self, market_id: str, current_ts: int) -> float:
        """
        Exponentially weighted sentiment score with 4h half-life.

        Recent headlines have more weight than old ones.
        Uses exponential decay: weight = exp(-λ * age)

        Args:
            market_id: Market ID
            current_ts: Current timestamp in milliseconds

        Returns:
            Weighted average sentiment in [-1, 1], or 0.0 if no headlines
        """
        headlines = self._headlines.get(market_id, [])

        if not headlines:
            return 0.0

        # Half-life of 4 hours in milliseconds
        half_life_ms = 4 * 60 * 60 * 1000
        lambda_decay = np.log(2) / half_life_ms

        weighted_sum = 0.0
        weight_sum = 0.0

        for ts, sentiment in headlines:
            age_ms = current_ts - ts
            if age_ms < 0:
                continue  # Future headline? Skip

            # Exponential decay weight
            weight = np.exp(-lambda_decay * age_ms)
            weighted_sum += sentiment * weight
            weight_sum += weight

        if weight_sum == 0:
            return 0.0

        return weighted_sum / weight_sum

    def _compute_spread_bps(self, market_id: str) -> float:
        """
        Bid-ask spread in basis points.

        Formula: (ask - bid) / mid * 10000

        Returns:
            Spread in basis points (e.g., 50 = 0.5%), or 0.0 if no book
        """
        book = self._orderbooks.get(market_id)
        if not book or not book.bids or not book.asks:
            return 0.0

        best_bid = book.bids[0].price
        best_ask = book.asks[0].price

        mid = (best_bid + best_ask) / 2
        if mid == 0:
            return 0.0

        spread = best_ask - best_bid
        return (spread / mid) * 10000  # Basis points

    # ═══════════════════════════════════════════════════════════════════════
    # UTILITIES
    # ═══════════════════════════════════════════════════════════════════════

    def _has_sufficient_data(self, market_id: str) -> bool:
        """Check if we have enough data to compute valid features."""
        min_points = self.config.min_data_points
        return (
            self._prices[market_id].count >= min_points and
            market_id in self._orderbooks
        )

    def _invalid_feature_vector(self, market_id: str) -> FeatureVector:
        """Return an invalid feature vector with zeros."""
        return FeatureVector(
            market_id=market_id,
            timestamp_ms=0,
            order_book_imbalance=0.0,
            volume_z_score=0.0,
            implied_volatility=0.0,
            momentum_1h=0.0,
            sentiment_score=0.0,
            mid_price=0.0,
            spread_bps=0.0,
            is_valid=False
        )

    def to_dataframe(self, market_id: str):
        """
        Export historical data to pandas DataFrame (offline/batch only).

        This is the ONLY place pandas is allowed. Never call on hot path.

        Args:
            market_id: Market to export

        Returns:
            pandas.DataFrame with columns: timestamp_ms, price, volume
        """
        import pandas as pd

        prices = self._prices[market_id].tail(self._prices[market_id].count)
        volumes = self._volumes[market_id].tail(self._volumes[market_id].count)
        timestamps = self._timestamps[market_id].tail(self._timestamps[market_id].count)

        return pd.DataFrame({
            'timestamp_ms': timestamps,
            'price': prices,
            'volume': volumes,
        })

    def __repr__(self) -> str:
        n_markets = len(self._prices)
        return f"FeatureEngineer(markets={n_markets}, config={self.config})"
