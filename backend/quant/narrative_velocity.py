"""
Narrative Velocity Index (NVI) - Lite Version
Detects when a narrative is ACCELERATING before price moves.

Uses keyword frequency analysis instead of embeddings for speed.
Tracks anomalous spikes in keyword usage via z-score analysis.
"""

from __future__ import annotations

import re
import math
import time
from dataclasses import dataclass
from collections import defaultdict
from typing import Optional

import numpy as np


# ═══════════════════════════════════════════════════════════════════════════
# STOP WORDS & SIGNAL KEYWORDS
# ═══════════════════════════════════════════════════════════════════════════

STOP_WORDS = frozenset([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'can', 'about', 'into', 'through',
    'over', 'after', 'before', 'under', 'between', 'during', 'while',
    'this', 'that', 'these', 'those', 'their', 'there', 'they', 'them',
    'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each',
    'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
    'than', 'then', 'very', 'just', 'also', 'only', 'its', 'your', 'our',
    'my', 'his', 'her', 'said', 'says', 'like', 'even', 'because',
])

# High-signal keywords for prediction markets (financial + political)
SIGNAL_KEYWORDS = frozenset([
    # Political events (high impact)
    'resign', 'resignation', 'impeach', 'impeachment', 'scandal',
    'indicted', 'indictment', 'convicted', 'guilty', 'innocent',
    'victory', 'defeat', 'landslide', 'upset', 'concede', 'concession',
    'endorsement', 'endorse', 'primary', 'caucus', 'debate', 'poll',
    'swing', 'battleground', 'election', 'vote', 'ballot', 'recount',

    # Market events
    'surge', 'soar', 'rally', 'boom', 'breakout', 'breakthrough',
    'collapse', 'crash', 'plunge', 'tumble', 'nosedive',
    'recession', 'depression', 'crisis', 'panic', 'bubble',

    # Breaking news markers
    'breaking', 'urgent', 'alert', 'confirmed', 'unconfirmed',
    'exclusive', 'sources', 'reports', 'announces', 'announcement',

    # Crypto/Tech
    'bitcoin', 'crypto', 'blockchain', 'ethereum', 'regulation',
    'banned', 'approved', 'hack', 'exploit', 'breach',

    # Sentiment shifts
    'bullish', 'bearish', 'optimistic', 'pessimistic', 'confident',
    'uncertain', 'volatile', 'stable', 'momentum', 'reversal',

    # Legal/Regulatory
    'lawsuit', 'settlement', 'ruling', 'verdict', 'appeal',
    'investigation', 'probe', 'subpoena', 'charges', 'fraud',

    # Economic
    'inflation', 'deflation', 'unemployment', 'tariff', 'sanctions',
    'stimulus', 'bailout', 'default', 'bankruptcy', 'merger',
])


# ═══════════════════════════════════════════════════════════════════════════
# DATA STRUCTURES
# ═══════════════════════════════════════════════════════════════════════════

@dataclass(slots=True)
class NarrativeSignal:
    """
    Signal from narrative velocity analysis.

    Attributes:
        market_id: Market identifier
        timestamp_ms: When the signal was computed
        nvi_score: Narrative Velocity Index in [-1, 1]
        dominant_keyword: Keyword with highest velocity
        keyword_velocity: Z-score of dominant keyword
        is_accelerating: Whether narrative is accelerating (|z| >= 2.0)
        top_keywords: Top 5 keywords by velocity
    """
    market_id: str
    timestamp_ms: int
    nvi_score: float
    dominant_keyword: str
    keyword_velocity: float
    is_accelerating: bool
    top_keywords: list[tuple[str, float]]  # (keyword, z_score)


# ═══════════════════════════════════════════════════════════════════════════
# MAIN CLASS
# ═══════════════════════════════════════════════════════════════════════════

class NarrativeVelocityLite:
    """
    Lightweight narrative velocity detector using keyword frequency.

    Tracks keyword frequency spikes to detect when a narrative is
    accelerating before price moves. Uses z-score analysis on hourly
    histograms to identify anomalous keyword velocity.

    The Holy Grail: Detect narrative shifts 1-4 hours before price impact.

    Example:
        >>> nvi = NarrativeVelocityLite()
        >>> nvi.ingest("Breaking: Candidate announces resignation", "market-1", ts)
        >>> signal = nvi.compute("market-1")
        >>> if signal.is_accelerating:
        ...     print(f"🔥 Narrative spike: {signal.dominant_keyword}")
    """

    __slots__ = ('_keyword_events', '_eviction_threshold_ms')

    def __init__(self):
        """Initialize narrative velocity tracker."""
        # Structure: {market_id: {keyword: [timestamps]}}
        self._keyword_events: dict[str, dict[str, list[int]]] = defaultdict(
            lambda: defaultdict(list)
        )

        # Evict events older than 48 hours
        self._eviction_threshold_ms = 48 * 60 * 60 * 1000

    def ingest(self, text: str, market_id: str, timestamp_ms: int) -> list[str]:
        """
        Ingest text and extract/store keywords.

        Args:
            text: Headline or text to analyze
            market_id: Market this text relates to
            timestamp_ms: When the text was published

        Returns:
            List of extracted keywords
        """
        keywords = self._extract_keywords(text)

        # Store timestamp for each keyword
        for keyword in keywords:
            self._keyword_events[market_id][keyword].append(timestamp_ms)

        # Evict old events (>48h)
        self._evict_old_events(market_id, timestamp_ms)

        return keywords

    def compute(self, market_id: str, current_ts: Optional[int] = None) -> NarrativeSignal:
        """
        Compute narrative velocity signal for a market.

        For each tracked keyword:
        1. Count occurrences in last hour (recent_count)
        2. Build 24h hourly histogram (hourly_counts)
        3. Calculate z-score: (recent - mean) / max(std, sqrt(mean))

        The keyword with highest |z| becomes dominant.
        NVI = tanh(z_dominant / 3.0) for compression to [-1, 1]

        Args:
            market_id: Market to analyze
            current_ts: Current timestamp (defaults to now)

        Returns:
            NarrativeSignal with velocity metrics
        """
        if current_ts is None:
            current_ts = int(time.time() * 1000)

        events = self._keyword_events.get(market_id)
        if not events:
            return self._null_signal(market_id, current_ts)

        # Analyze each keyword
        keyword_velocities = []

        for keyword, timestamps in events.items():
            if not timestamps:
                continue

            z_score = self._calculate_keyword_zscore(
                timestamps, current_ts,
                baseline_hours=24,
                detection_minutes=60
            )

            if not math.isnan(z_score) and not math.isinf(z_score):
                keyword_velocities.append((keyword, z_score))

        if not keyword_velocities:
            return self._null_signal(market_id, current_ts)

        # Sort by absolute z-score (highest velocity)
        keyword_velocities.sort(key=lambda x: abs(x[1]), reverse=True)

        # Dominant keyword
        dominant_keyword, z_dominant = keyword_velocities[0]

        # NVI score: tanh compression to [-1, 1]
        nvi_score = math.tanh(z_dominant / 3.0)

        # Is accelerating if |z| >= 2.0 (2 standard deviations)
        is_accelerating = abs(z_dominant) >= 2.0

        # Top 5 keywords
        top_keywords = keyword_velocities[:5]

        return NarrativeSignal(
            market_id=market_id,
            timestamp_ms=current_ts,
            nvi_score=nvi_score,
            dominant_keyword=dominant_keyword,
            keyword_velocity=z_dominant,
            is_accelerating=is_accelerating,
            top_keywords=top_keywords,
        )

    def _extract_keywords(self, text: str) -> list[str]:
        """
        Extract keywords from text.

        Process:
        1. Lowercase
        2. Tokenize with regex [a-z]+
        3. Filter stop words
        4. Keep if: len > 4 OR in SIGNAL_KEYWORDS

        Args:
            text: Input text

        Returns:
            List of extracted keywords
        """
        # Lowercase and tokenize
        tokens = re.findall(r'[a-z]+', text.lower())

        # Filter and select
        keywords = []
        for token in tokens:
            if token in STOP_WORDS:
                continue

            # Keep if long enough OR in signal keywords
            if len(token) > 4 or token in SIGNAL_KEYWORDS:
                keywords.append(token)

        return keywords

    def _calculate_keyword_zscore(
        self,
        timestamps: list[int],
        current_ts: int,
        baseline_hours: int = 24,
        detection_minutes: int = 60,
    ) -> float:
        """
        Calculate z-score for keyword velocity.

        Args:
            timestamps: All timestamps this keyword appeared
            current_ts: Current timestamp
            baseline_hours: Hours of history for baseline (24)
            detection_minutes: Recent window for spike detection (60)

        Returns:
            Z-score (higher = more anomalous)
        """
        # Convert to numpy array for performance
        timestamps_np = np.array(timestamps, dtype=np.int64)

        # Recent window (last hour)
        recent_cutoff = current_ts - (detection_minutes * 60 * 1000)
        recent_count = np.sum(timestamps_np >= recent_cutoff)

        # Baseline window (last 24 hours)
        baseline_cutoff = current_ts - (baseline_hours * 60 * 60 * 1000)
        baseline_timestamps = timestamps_np[timestamps_np >= baseline_cutoff]

        if len(baseline_timestamps) < 2:
            return 0.0

        # Build hourly histogram
        hourly_counts = []
        for h in range(baseline_hours):
            hour_start = current_ts - ((h + 1) * 60 * 60 * 1000)
            hour_end = current_ts - (h * 60 * 60 * 1000)
            count = np.sum((baseline_timestamps >= hour_start) &
                          (baseline_timestamps < hour_end))
            hourly_counts.append(count)

        hourly_counts = np.array(hourly_counts)

        # Statistics
        mean_hourly = np.mean(hourly_counts)
        std_hourly = np.std(hourly_counts)

        # Use robust denominator: max(std, sqrt(mean))
        # This prevents division by zero and handles low-count scenarios
        denominator = max(std_hourly, math.sqrt(max(mean_hourly, 1.0)))

        if denominator == 0:
            return 0.0

        z_score = (recent_count - mean_hourly) / denominator

        return float(z_score)

    def _evict_old_events(self, market_id: str, current_ts: int) -> None:
        """Remove events older than 48 hours to prevent memory bloat."""
        cutoff = current_ts - self._eviction_threshold_ms

        events = self._keyword_events.get(market_id)
        if not events:
            return

        for keyword in list(events.keys()):
            timestamps = events[keyword]
            # Keep only recent timestamps
            events[keyword] = [ts for ts in timestamps if ts >= cutoff]

            # Remove keyword if no events left
            if not events[keyword]:
                del events[keyword]

    def _null_signal(self, market_id: str, timestamp_ms: int) -> NarrativeSignal:
        """Return a null signal when no data available."""
        return NarrativeSignal(
            market_id=market_id,
            timestamp_ms=timestamp_ms,
            nvi_score=0.0,
            dominant_keyword='',
            keyword_velocity=0.0,
            is_accelerating=False,
            top_keywords=[],
        )

    def __repr__(self) -> str:
        n_markets = len(self._keyword_events)
        total_keywords = sum(len(kw) for kw in self._keyword_events.values())
        return (f"NarrativeVelocityLite(markets={n_markets}, "
                f"keywords_tracked={total_keywords})")


# ═══════════════════════════════════════════════════════════════════════════
# STANDALONE FUNCTION
# ═══════════════════════════════════════════════════════════════════════════

def calculate_narrative_velocity_lite(
    keyword_stream: list[tuple[str, int]],
    target_keywords: Optional[set[str]] = None,
    baseline_hours: int = 24,
    detection_minutes: int = 60,
    spike_threshold: float = 2.0,
) -> dict:
    """
    Standalone function to calculate narrative velocity from keyword stream.

    Args:
        keyword_stream: List of (keyword, timestamp_ms) tuples
        target_keywords: Set of keywords to analyze (None = all)
        baseline_hours: Hours of history for baseline
        detection_minutes: Recent window for spike detection
        spike_threshold: Z-score threshold for spike detection

    Returns:
        Dictionary with keys:
        - dominant_keyword: Keyword with highest velocity
        - z_score: Z-score of dominant keyword
        - is_spike: Whether velocity exceeds threshold
        - nvi_score: Normalized score in [-1, 1]
    """
    if not keyword_stream:
        return {
            'dominant_keyword': '',
            'z_score': 0.0,
            'is_spike': False,
            'nvi_score': 0.0,
        }

    # Get current timestamp (latest in stream)
    current_ts = max(ts for _, ts in keyword_stream)

    # Group by keyword
    keyword_groups = defaultdict(list)
    for keyword, ts in keyword_stream:
        if target_keywords is None or keyword in target_keywords:
            keyword_groups[keyword].append(ts)

    if not keyword_groups:
        return {
            'dominant_keyword': '',
            'z_score': 0.0,
            'is_spike': False,
            'nvi_score': 0.0,
        }

    # Calculate z-score for each keyword
    nvi = NarrativeVelocityLite()
    velocities = []

    for keyword, timestamps in keyword_groups.items():
        z = nvi._calculate_keyword_zscore(
            timestamps, current_ts,
            baseline_hours, detection_minutes
        )
        if not math.isnan(z) and not math.isinf(z):
            velocities.append((keyword, z))

    if not velocities:
        return {
            'dominant_keyword': '',
            'z_score': 0.0,
            'is_spike': False,
            'nvi_score': 0.0,
        }

    # Get dominant keyword
    velocities.sort(key=lambda x: abs(x[1]), reverse=True)
    dominant_keyword, z_dominant = velocities[0]

    return {
        'dominant_keyword': dominant_keyword,
        'z_score': z_dominant,
        'is_spike': abs(z_dominant) >= spike_threshold,
        'nvi_score': math.tanh(z_dominant / 3.0),
    }
