"""
Crypto 5-Minute Market Scanner
===============================
Discovers and analyzes Polymarket 5-minute BTC Up/Down markets.

Strategy: Latency arbitrage
- Polymarket prices lag behind real BTC spot by 5-30 seconds
- When BTC moves 0.5%+ on Binance and Polymarket still shows ~50/50,
  the "true" probability is already ~80-90% in one direction
- Buy the correct side before the market adjusts

This is the same strategy that turned $313 into $414,000 on 15-min markets.
"""

import asyncio
import time
import math
import json as json_mod
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
import structlog

logger = structlog.get_logger()

# ═══════════════════════════════════════════════════════════════════════════
# CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════

GAMMA_BASE = "https://gamma-api.polymarket.com"
CLOB_BASE = "https://clob.polymarket.com"
BINANCE_REST = "https://api.binance.com"
BINANCE_WS = "wss://stream.binance.com:9443/ws/btcusdt@trade"

# Market slug patterns
SLUG_5M = "btc-updown-5m-{ts}"
SLUG_15M = "btc-updown-15m-{ts}"
SLUG_ETH_15M = "eth-updown-15m-{ts}"

# Minimum price move on Binance to consider as a directional signal
MIN_MOVE_PCT = 0.15  # 0.15% move = signal starts
STRONG_MOVE_PCT = 0.40  # 0.40% move = strong signal
# Maximum market price to buy (don't buy at >70% already priced in)
MAX_ENTRY_PRICE = 0.70
# Minimum edge to consider trading
MIN_EDGE = 0.05  # 5%


# ═══════════════════════════════════════════════════════════════════════════
# DATA STRUCTURES
# ═══════════════════════════════════════════════════════════════════════════

@dataclass
class CryptoShortTermMarket:
    """A 5-minute or 15-minute crypto up/down market."""
    slug: str
    condition_id: str
    question: str
    interval_minutes: int          # 5 or 15
    start_time: datetime           # Start of the interval
    end_time: datetime             # End of the interval
    up_token_id: str               # Token ID for "Up" outcome
    down_token_id: str             # Token ID for "Down" outcome
    up_price: float                # Current Up price (0-1)
    down_price: float              # Current Down price (0-1)
    volume: float                  # Volume in USDC
    is_live: bool                  # Currently in trading window
    time_remaining_seconds: float  # Seconds until resolution


@dataclass
class LatencySignal:
    """Signal from latency arbitrage detection."""
    market_slug: str
    question: str                  # Market question text
    direction: str                 # "UP" or "DOWN"
    binance_move_pct: float        # % move on Binance since interval start
    polymarket_up_price: float     # Current Polymarket Up price
    estimated_true_prob: float     # Our estimated true probability of Up
    edge: float                    # estimated_true_prob - market_price
    confidence: str                # "low", "medium", "high"
    time_remaining_seconds: float  # Time left before resolution
    recommended_side: str          # "BUY_UP" or "BUY_DOWN"
    recommended_token_id: str      # Token to buy
    volume: float                  # Market volume in USDC
    timestamp: float


# ═══════════════════════════════════════════════════════════════════════════
# MAIN SCANNER
# ═══════════════════════════════════════════════════════════════════════════

class Crypto5MinScanner:
    """
    Scans for active 5-minute BTC markets and detects latency arbitrage.

    Architecture:
    1. Every 10 seconds, discover active 5-min markets via Gamma API
    2. Track BTC price via Binance REST (WebSocket optional upgrade)
    3. For each active market:
       a. Get the BTC price at interval start (from Binance klines)
       b. Get current BTC price
       c. Calculate % move since start
       d. Estimate true probability of Up based on the move
       e. Compare to Polymarket price
       f. If edge > threshold → emit LatencySignal
    """

    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None
        self._last_request_time: float = 0.0
        self._active_markets: list[CryptoShortTermMarket] = []
        self._btc_price: float = 0.0
        self._btc_price_time: float = 0.0
        # Cache of interval start prices: {unix_timestamp: btc_price}
        self._interval_start_prices: dict[int, float] = {}

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(10.0, connect=5.0),
                headers={"User-Agent": "BlackEdge/3.0"},
                follow_redirects=True,
            )
        return self._client

    async def _rate_limit(self, min_interval: float = 1.0) -> None:
        now = time.monotonic()
        elapsed = now - self._last_request_time
        if elapsed < min_interval:
            await asyncio.sleep(min_interval - elapsed)
        self._last_request_time = time.monotonic()

    # ─── BTC PRICE FROM BINANCE ───

    async def fetch_btc_price(self) -> float:
        """Get current BTC/USDT price from Binance."""
        client = await self._get_client()
        try:
            resp = await client.get(
                f"{BINANCE_REST}/api/v3/ticker/price",
                params={"symbol": "BTCUSDT"},
            )
            resp.raise_for_status()
            price = float(resp.json()["price"])
            self._btc_price = price
            self._btc_price_time = time.time()
            return price
        except Exception as e:
            logger.warning("Binance price fetch failed", error=str(e))
            return self._btc_price  # Return cached

    async def fetch_btc_price_at_time(self, timestamp_ms: int) -> float:
        """
        Get BTC price at a specific timestamp using Binance klines.
        Used to determine the opening price of a 5-min interval.
        """
        unix_sec = timestamp_ms // 1000

        # Check cache
        if unix_sec in self._interval_start_prices:
            return self._interval_start_prices[unix_sec]

        client = await self._get_client()
        await self._rate_limit(0.5)

        try:
            resp = await client.get(
                f"{BINANCE_REST}/api/v3/klines",
                params={
                    "symbol": "BTCUSDT",
                    "interval": "1m",
                    "startTime": timestamp_ms,
                    "limit": 1,
                },
            )
            resp.raise_for_status()
            klines = resp.json()
            if klines:
                open_price = float(klines[0][1])  # Open price of the 1m candle
                self._interval_start_prices[unix_sec] = open_price
                return open_price
        except Exception as e:
            logger.warning("Binance kline fetch failed", error=str(e))

        return 0.0

    # ─── DISCOVER ACTIVE 5-MIN MARKETS ───

    async def discover_active_markets(self) -> list[CryptoShortTermMarket]:
        """
        Find currently active 5-minute BTC markets on Polymarket.

        Strategy: Generate slug candidates based on current time,
        then verify each via Gamma API.

        Slug format: btc-updown-5m-{unix_timestamp_of_interval_start}
        """
        client = await self._get_client()
        now = datetime.now(timezone.utc)

        # Generate candidate timestamps for current and next intervals
        # Round down to nearest 5 minutes
        minutes_5m = (now.minute // 5) * 5
        current_5m_start = now.replace(minute=minutes_5m, second=0, microsecond=0)

        # Try current interval, previous, and next
        candidates = []
        for offset_minutes in [-10, -5, 0, 5, 10]:
            candidate_time = current_5m_start + timedelta(minutes=offset_minutes)
            ts = int(candidate_time.timestamp())
            candidates.append((ts, candidate_time, 5, "btc"))

        # Also check 15-min markets
        minutes_15m = (now.minute // 15) * 15
        current_15m_start = now.replace(minute=minutes_15m, second=0, microsecond=0)
        for offset_minutes in [-15, 0, 15]:
            candidate_time = current_15m_start + timedelta(minutes=offset_minutes)
            ts = int(candidate_time.timestamp())
            candidates.append((ts, candidate_time, 15, "btc"))
            candidates.append((ts, candidate_time, 15, "eth"))

        markets = []

        for ts, start_time, interval, asset in candidates:
            if interval == 5 and asset == "btc":
                slug = SLUG_5M.format(ts=ts)
            elif interval == 15 and asset == "btc":
                slug = SLUG_15M.format(ts=ts)
            elif interval == 15 and asset == "eth":
                slug = SLUG_ETH_15M.format(ts=ts)
            else:
                continue

            await self._rate_limit(2.0)  # Respect Gamma rate limits

            try:
                resp = await client.get(
                    f"{GAMMA_BASE}/markets",
                    params={"slug": slug},
                )

                if resp.status_code == 200:
                    data = resp.json()

                    # Gamma returns a list; find the matching market
                    market_data = None
                    if isinstance(data, list) and len(data) > 0:
                        market_data = data[0]
                    elif isinstance(data, dict) and data.get("id"):
                        market_data = data

                    if market_data and market_data.get("active", False):
                        end_time = start_time + timedelta(minutes=interval)
                        time_remaining = (end_time - now).total_seconds()

                        # Parse tokens
                        clob_tokens = market_data.get("clobTokenIds", "")
                        tokens = []
                        if isinstance(clob_tokens, str):
                            try:
                                tokens = json_mod.loads(clob_tokens)
                            except Exception:
                                tokens = clob_tokens.split(",") if clob_tokens else []
                        elif isinstance(clob_tokens, list):
                            tokens = clob_tokens

                        up_token = tokens[0] if len(tokens) > 0 else ""
                        down_token = tokens[1] if len(tokens) > 1 else ""

                        # Parse prices
                        outcome_prices = market_data.get("outcomePrices", "")
                        up_price, down_price = 0.5, 0.5
                        if isinstance(outcome_prices, str):
                            try:
                                prices = json_mod.loads(outcome_prices)
                                up_price = float(prices[0]) if len(prices) > 0 else 0.5
                                down_price = float(prices[1]) if len(prices) > 1 else 0.5
                            except Exception:
                                pass
                        elif isinstance(outcome_prices, list):
                            up_price = float(outcome_prices[0]) if len(outcome_prices) > 0 else 0.5
                            down_price = float(outcome_prices[1]) if len(outcome_prices) > 1 else 0.5

                        markets.append(CryptoShortTermMarket(
                            slug=slug,
                            condition_id=market_data.get("conditionId", ""),
                            question=market_data.get("question", ""),
                            interval_minutes=interval,
                            start_time=start_time,
                            end_time=end_time,
                            up_token_id=up_token,
                            down_token_id=down_token,
                            up_price=up_price,
                            down_price=down_price,
                            volume=float(market_data.get("volume", 0) or 0),
                            is_live=time_remaining > 0,
                            time_remaining_seconds=max(0, time_remaining),
                        ))

                        logger.debug("Found active market", slug=slug,
                                   time_remaining=f"{time_remaining:.0f}s")
            except Exception as e:
                logger.debug("Market slug not found", slug=slug, error=str(e))
                continue

        # Filter to only live markets with time remaining
        self._active_markets = [m for m in markets if m.is_live and m.time_remaining_seconds > 30]

        if self._active_markets:
            logger.info(
                "⚡ Active short-term crypto markets",
                total_found=len(self._active_markets),
                markets=[m.slug for m in self._active_markets],
            )

        return self._active_markets

    # ─── LATENCY ARBITRAGE DETECTION ───

    def estimate_true_probability(self, move_pct: float, time_remaining_sec: float) -> float:
        """
        Estimate the true probability of "Up" based on BTC's move since interval start.

        Logic:
        - If BTC has moved +1% in the first minute of a 5-min window,
          the probability of it STILL being up at the end is very high (~85%)
        - The further into the interval and the larger the move, the higher the probability
        - Uses a sigmoid-like function calibrated to observed bot behavior

        Parameters:
            move_pct: % change in BTC since interval start (positive = up)
            time_remaining_sec: seconds until resolution

        Returns:
            Probability of "Up" outcome in [0.05, 0.95]
        """
        # Time factor: less time remaining = more certain
        # At 4 minutes remaining: uncertainty high (factor = 0.5)
        # At 1 minute remaining: uncertainty low (factor = 1.5)
        # At 30 seconds: very certain (factor = 2.0)
        total_interval = 300  # 5 minutes
        elapsed_fraction = 1.0 - (time_remaining_sec / total_interval)
        time_factor = 0.5 + elapsed_fraction * 1.5  # Range: 0.5 to 2.0

        # Move factor: how much BTC has moved
        # 0.10% move = slight signal
        # 0.30% move = moderate signal
        # 0.50%+ move = strong signal
        adjusted_move = move_pct * time_factor

        # Sigmoid mapping: adjusted_move → probability
        # At adjusted_move = 0: prob = 0.5 (random)
        # At adjusted_move = +0.5: prob ≈ 0.75
        # At adjusted_move = +1.0: prob ≈ 0.88
        # At adjusted_move = +2.0: prob ≈ 0.95
        k = 2.5  # Steepness of sigmoid
        prob_up = 1.0 / (1.0 + math.exp(-k * adjusted_move))

        # Clamp
        return max(0.05, min(0.95, prob_up))

    async def scan_for_signals(self) -> list[LatencySignal]:
        """
        Scan all active 5-min markets for latency arbitrage signals.

        Returns list of LatencySignal where edge > MIN_EDGE.
        """
        signals = []

        # Get current BTC price
        current_price = await self.fetch_btc_price()
        if current_price == 0:
            return signals

        for market in self._active_markets:
            if market.time_remaining_seconds < 20:
                continue  # Too close to resolution, skip

            # Get opening price for this interval
            start_ts_ms = int(market.start_time.timestamp() * 1000)
            opening_price = await self.fetch_btc_price_at_time(start_ts_ms)

            if opening_price == 0:
                continue

            # Calculate move since interval start
            move_pct = ((current_price - opening_price) / opening_price) * 100

            # Skip if move is too small
            if abs(move_pct) < MIN_MOVE_PCT:
                continue

            # Estimate true probability
            true_prob_up = self.estimate_true_probability(
                move_pct, market.time_remaining_seconds
            )

            # Determine direction and edge
            if move_pct > 0:
                # BTC is up → buy "Up"
                edge = true_prob_up - market.up_price
                if edge > MIN_EDGE and market.up_price < MAX_ENTRY_PRICE:
                    confidence = "high" if abs(move_pct) > STRONG_MOVE_PCT else "medium"
                    if abs(move_pct) < 0.25:
                        confidence = "low"

                    signals.append(LatencySignal(
                        market_slug=market.slug,
                        question=market.question,
                        direction="UP",
                        binance_move_pct=move_pct,
                        polymarket_up_price=market.up_price,
                        estimated_true_prob=true_prob_up,
                        edge=edge,
                        confidence=confidence,
                        time_remaining_seconds=market.time_remaining_seconds,
                        recommended_side="BUY_UP",
                        recommended_token_id=market.up_token_id,
                        volume=market.volume,
                        timestamp=time.time(),
                    ))
            else:
                # BTC is down → buy "Down"
                true_prob_down = 1.0 - true_prob_up
                edge = true_prob_down - market.down_price
                if edge > MIN_EDGE and market.down_price < MAX_ENTRY_PRICE:
                    confidence = "high" if abs(move_pct) > STRONG_MOVE_PCT else "medium"
                    if abs(move_pct) < 0.25:
                        confidence = "low"

                    signals.append(LatencySignal(
                        market_slug=market.slug,
                        question=market.question,
                        direction="DOWN",
                        binance_move_pct=move_pct,
                        polymarket_up_price=market.up_price,
                        estimated_true_prob=1.0 - true_prob_up,
                        edge=edge,
                        confidence=confidence,
                        time_remaining_seconds=market.time_remaining_seconds,
                        recommended_side="BUY_DOWN",
                        recommended_token_id=market.down_token_id,
                        volume=market.volume,
                        timestamp=time.time(),
                    ))

        # Sort by edge descending
        signals.sort(key=lambda s: s.edge, reverse=True)

        if signals:
            logger.info(
                "⚡ LATENCY SIGNALS DETECTED",
                count=len(signals),
                best_edge=f"{signals[0].edge:.1%}",
                best_market=signals[0].market_slug,
                best_direction=signals[0].direction,
                btc_move=f"{signals[0].binance_move_pct:+.2f}%",
            )

        return signals

    # ─── CLEANUP ───

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None
