"""
Polymarket CLOB API Client
===========================
Fetches live market data from Polymarket's Central Limit Order Book.
Handles rate limiting, filtering, and normalization for the terminal feed.
"""

import asyncio
import json
import time
from dataclasses import dataclass, field
from typing import Callable, Awaitable

import httpx
import structlog

try:
    import websockets
    WEBSOCKETS_AVAILABLE = True
except ImportError:
    WEBSOCKETS_AVAILABLE = False
    logger = structlog.get_logger()
    logger.warning("websockets library not available, real-time price feeds disabled")

logger = structlog.get_logger()

CLOB_BASE = "https://clob.polymarket.com"
GAMMA_BASE = "https://gamma-api.polymarket.com"
WS_BASE = "wss://ws-subscriptions-clob.polymarket.com/ws/market"


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _parse_clob_token_ids(clob_token_ids) -> list[str]:
    """
    Parse clobTokenIds from Gamma API.

    The field can be:
    - A list: ["0x123...", "0x456..."]
    - A JSON string: '["0x123...", "0x456..."]'
    - A malformed string: "["

    Returns:
        List of token IDs, or empty list if parsing fails
    """
    if not clob_token_ids:
        return []

    # Already a list
    if isinstance(clob_token_ids, list):
        return [str(tid) for tid in clob_token_ids]

    # Try to parse as JSON string
    if isinstance(clob_token_ids, str):
        try:
            parsed = json.loads(clob_token_ids)
            if isinstance(parsed, list):
                return [str(tid) for tid in parsed]
            else:
                # Single token as string
                return [str(parsed)]
        except json.JSONDecodeError:
            # Malformed JSON, return empty
            logger.warning("⚠️ Failed to parse clobTokenIds", value=clob_token_ids[:50])
            return []

    return []

# Minimum 2s between requests to avoid rate limits
MIN_REQUEST_INTERVAL = 2.0

# Only show markets with meaningful volume
MIN_VOLUME_USD = 10_000


@dataclass
class PolymarketToken:
    """A single outcome token (YES or NO side) of a market."""
    token_id: str
    outcome: str  # "Yes" or "No"
    price: float  # 0.0 - 1.0


@dataclass
class PolymarketMarket:
    """Normalized market data from the Polymarket APIs."""
    id: str
    condition_id: str
    question: str
    slug: str
    yes_price: float
    no_price: float
    spread: float
    volume_24h: float
    volume_total: float
    liquidity: float
    end_date: str
    active: bool
    tokens: list[PolymarketToken] = field(default_factory=list)

    @property
    def url(self) -> str:
        return f"https://polymarket.com/event/{self.slug}"

    @property
    def market_name(self) -> str:
        """Short uppercase slug for the terminal feed."""
        q = self.question
        # Truncate long questions
        if len(q) > 50:
            q = q[:47] + "..."
        return q.upper().replace(" ", "_").replace("?", "").replace("'", "")[:40]


class PolymarketClient:
    """
    Async client for Polymarket CLOB + Gamma APIs with WebSocket support.

    Uses the Gamma API for market metadata (question, volume, slug),
    the CLOB API for real-time prices, and WebSocket for live price feeds.
    """

    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None
        self._last_request_time: float = 0.0
        self._cache: list[PolymarketMarket] = []
        self._cache_time: float = 0.0

        # WebSocket state
        self._ws_connection = None
        self._ws_task: asyncio.Task | None = None
        self._subscribed_markets: set[str] = set()
        self._price_callbacks: list[Callable[[str, dict], Awaitable[None]]] = []
        self._ws_enabled = WEBSOCKETS_AVAILABLE

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(15.0, connect=10.0),
                headers={"User-Agent": "BlackEdge/3.0"},
                follow_redirects=True,
            )
        return self._client

    async def _rate_limit(self) -> None:
        """Enforce minimum interval between requests."""
        now = time.monotonic()
        elapsed = now - self._last_request_time
        if elapsed < MIN_REQUEST_INTERVAL:
            await asyncio.sleep(MIN_REQUEST_INTERVAL - elapsed)
        self._last_request_time = time.monotonic()

    async def close(self) -> None:
        # Close WebSocket connection
        if self._ws_task:
            self._ws_task.cancel()
            try:
                await self._ws_task
            except asyncio.CancelledError:
                pass
            self._ws_task = None

        if self._ws_connection:
            try:
                await self._ws_connection.close()
            except Exception:
                pass
            self._ws_connection = None

        # Close HTTP client
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    # -------------------------------------------------------------------------
    # Gamma API — market metadata + volume
    # -------------------------------------------------------------------------

    async def _fetch_gamma_markets(
        self,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict]:
        """Fetch markets from the Gamma API (metadata, volume, slugs)."""
        await self._rate_limit()
        client = await self._get_client()

        try:
            # Fetch from markets endpoint with strict filtering
            resp = await client.get(
                f"{GAMMA_BASE}/markets",
                params={
                    "limit": limit,
                    "offset": offset,
                    "active": "true",
                    "closed": "false",
                    "archived": "false",
                    "order": "volume24hr",
                    "ascending": "false",
                },
            )
            resp.raise_for_status()
            data = resp.json()

            # Additional client-side filtering to ensure we only get active markets
            active_markets = []
            for m in data:
                # Double-check active/closed flags
                if not m.get("closed", False) and m.get("active", True):
                    # Check end date hasn't passed
                    end_date_str = m.get("endDate", "")
                    if end_date_str:
                        try:
                            from datetime import datetime, timezone
                            end_date = datetime.fromisoformat(end_date_str.replace("Z", "+00:00"))
                            if end_date > datetime.now(timezone.utc):
                                active_markets.append(m)
                        except Exception:
                            active_markets.append(m)  # If parsing fails, include it
                    else:
                        active_markets.append(m)

            logger.info(
                "✅ Polymarket Gamma API SUCCESS",
                total_returned=len(data),
                active_filtered=len(active_markets),
            )
            return active_markets
        except httpx.HTTPStatusError as e:
            logger.error(
                "❌ POLYMARKET GAMMA API HTTP ERROR",
                status=e.response.status_code,
                url=str(e.request.url),
                response_text=e.response.text[:500],
            )
            return []
        except Exception as e:
            logger.error(
                "❌ POLYMARKET GAMMA API FAILED",
                error=str(e),
                error_type=type(e).__name__,
                url=GAMMA_BASE,
            )
            return []

    # -------------------------------------------------------------------------
    # CLOB API — real-time prices
    # -------------------------------------------------------------------------

    async def _fetch_clob_price(self, token_id: str) -> float | None:
        """Fetch midpoint price for a token from the CLOB."""
        await self._rate_limit()
        client = await self._get_client()

        try:
            resp = await client.get(
                f"{CLOB_BASE}/price",
                params={"token_id": token_id, "side": "buy"},
            )
            resp.raise_for_status()
            data = resp.json()
            return float(data.get("price", 0))
        except Exception:
            return None

    async def _fetch_clob_prices_batch(self, token_ids: list[str]) -> dict[str, float]:
        """Fetch prices for multiple tokens. Returns {token_id: price}."""
        await self._rate_limit()
        client = await self._get_client()

        try:
            resp = await client.get(
                f"{CLOB_BASE}/prices",
                params={"token_ids": ",".join(token_ids)},
            )
            resp.raise_for_status()
            return {k: float(v) for k, v in resp.json().items()}
        except Exception as e:
            logger.warning("CLOB batch price fetch failed", error=str(e))
            return {}

    # -------------------------------------------------------------------------
    # Public interface
    # -------------------------------------------------------------------------

    async def fetch_markets(self, max_markets: int = 30) -> list[PolymarketMarket]:
        """
        Fetch live markets from Polymarket.
        Returns filtered, volume-sorted markets with real-time prices.

        Rate-limited to respect Polymarket's API constraints.
        """
        raw_markets = await self._fetch_gamma_markets(limit=max_markets * 3)

        if not raw_markets:
            logger.warning("No markets returned from Gamma API, using cache")
            return self._cache

        markets: list[PolymarketMarket] = []
        skipped_closed = 0
        skipped_low_volume = 0

        for m in raw_markets:
            try:
                # CRITICAL: Skip closed/settled markets
                closed = m.get("closed", False)
                active = m.get("active", True)

                if closed or not active:
                    skipped_closed += 1
                    logger.debug("Skipping closed market", question=m.get("question", "")[:50])
                    continue

                # Check end date - skip if already passed
                end_date_str = m.get("endDate", "")
                if end_date_str:
                    try:
                        from datetime import datetime, timezone
                        end_date = datetime.fromisoformat(end_date_str.replace("Z", "+00:00"))
                        now = datetime.now(timezone.utc)
                        if end_date < now:
                            skipped_closed += 1
                            logger.debug("Skipping expired market", question=m.get("question", "")[:50], end_date=end_date_str)
                            continue
                    except Exception:
                        pass  # If date parsing fails, allow the market through

                volume_24h = float(m.get("volume24hr", 0) or 0)
                volume_total = float(m.get("volumeNum", 0) or 0)
                liquidity = float(m.get("liquidityNum", 0) or 0)

                # Filter low-volume markets
                if volume_total < MIN_VOLUME_USD and volume_24h < MIN_VOLUME_USD:
                    skipped_low_volume += 1
                    continue

                # Extract token info from clobTokenIds (parse properly - can be JSON string)
                clob_token_ids = _parse_clob_token_ids(m.get("clobTokenIds"))
                outcomes = m.get("outcomes", [])
                outcome_prices = m.get("outcomePrices", [])

                if not clob_token_ids or len(clob_token_ids) < 2:
                    continue

                # Parse prices — Gamma returns them as strings in outcomePrices
                yes_price = 0.5
                no_price = 0.5
                if outcome_prices and len(outcome_prices) >= 2:
                    try:
                        yes_price = float(outcome_prices[0])
                        no_price = float(outcome_prices[1])
                    except (ValueError, TypeError):
                        pass

                # Clamp prices to valid range
                yes_price = max(0.01, min(0.99, yes_price))
                no_price = max(0.01, min(0.99, no_price))

                spread = abs(yes_price - (1.0 - no_price))

                tokens = []
                for i, tid in enumerate(clob_token_ids):
                    outcome_name = outcomes[i] if i < len(outcomes) else ("Yes" if i == 0 else "No")
                    price = yes_price if i == 0 else no_price
                    tokens.append(PolymarketToken(
                        token_id=tid,
                        outcome=outcome_name,
                        price=price,
                    ))

                market = PolymarketMarket(
                    id=m.get("id", ""),
                    condition_id=m.get("conditionId", ""),
                    question=m.get("question", "Unknown Market"),
                    slug=m.get("slug", ""),
                    yes_price=yes_price,
                    no_price=no_price,
                    spread=spread,
                    volume_24h=volume_24h,
                    volume_total=volume_total,
                    liquidity=liquidity,
                    end_date=m.get("endDate", ""),
                    active=m.get("active", True),
                    tokens=tokens,
                )
                markets.append(market)

            except Exception as e:
                logger.debug("Failed to parse market", error=str(e))
                continue

        # Sort by 24h volume descending
        markets.sort(key=lambda x: x.volume_24h, reverse=True)

        # Cap at max_markets
        markets = markets[:max_markets]

        # Update cache
        if markets:
            self._cache = markets
            self._cache_time = time.monotonic()
            logger.info(
                "Polymarket data refreshed",
                market_count=len(markets),
                skipped_closed=skipped_closed,
                skipped_low_volume=skipped_low_volume,
            )

            # VERIFICATION: Print first 3 markets to prove they're current/active
            if len(markets) >= 3:
                logger.info("📋 TOP 3 ACTIVE MARKETS VERIFICATION:")
                for i, market in enumerate(markets[:3], 1):
                    logger.info(
                        f"Market #{i}",
                        question=market.question,
                        volume_24h=f"${market.volume_24h:,.0f}",
                        end_date=market.end_date,
                        yes_price=f"{market.yes_price:.2%}",
                    )

        return markets

    def get_cached(self) -> list[PolymarketMarket]:
        """Return cached markets without making an API call."""
        return self._cache

    async def get_live_prices(self, token_ids: list[str]) -> dict[str, float]:
        """
        Get live prices for multiple tokens from CLOB.
        Returns {token_id: price} dict.
        """
        if not token_ids:
            return {}

        return await self._fetch_clob_prices_batch(token_ids)

    def get_market_by_id(self, market_id: str) -> PolymarketMarket | None:
        """Get a specific market from cache by ID."""
        for market in self._cache:
            if market.id == market_id or market.condition_id == market_id:
                return market
        return None

    def get_market_stats(self) -> dict:
        """Get statistics about cached markets."""
        if not self._cache:
            return {
                "total_markets": 0,
                "total_volume_24h": 0.0,
                "total_liquidity": 0.0,
                "avg_spread": 0.0,
                "cache_age_seconds": 0.0,
            }

        return {
            "total_markets": len(self._cache),
            "total_volume_24h": sum(m.volume_24h for m in self._cache),
            "total_liquidity": sum(m.liquidity for m in self._cache),
            "avg_spread": sum(m.spread for m in self._cache) / len(self._cache) if self._cache else 0.0,
            "cache_age_seconds": time.monotonic() - self._cache_time if self._cache_time else 0.0,
            "ws_subscriptions": len(self._subscribed_markets),
            "ws_connected": self._ws_connection is not None,
        }

    async def fetch_orderbook(self, token_id: str) -> dict | None:
        """
        Fetch L2 orderbook for a specific token from the CLOB.

        Args:
            token_id: Polymarket CLOB token ID

        Returns:
            Dict with 'bids' and 'asks', each a list of [price, size] pairs,
            or None on failure
        """
        await self._rate_limit()
        client = await self._get_client()

        try:
            resp = await client.get(
                f"{CLOB_BASE}/book",
                params={"token_id": token_id},
            )
            resp.raise_for_status()
            data = resp.json()

            return {
                "bids": [
                    {"price": float(o.get("price", 0)), "size": float(o.get("size", 0))}
                    for o in data.get("bids", [])
                ],
                "asks": [
                    {"price": float(o.get("price", 0)), "size": float(o.get("size", 0))}
                    for o in data.get("asks", [])
                ],
                "token_id": token_id,
            }
        except Exception as e:
            logger.warning("CLOB orderbook fetch failed", token_id=token_id, error=str(e))
            return None

    # -------------------------------------------------------------------------
    # WebSocket - Real-time price feeds
    # -------------------------------------------------------------------------

    def register_price_callback(self, callback: Callable[[str, dict], Awaitable[None]]) -> None:
        """
        Register a callback for real-time price updates.

        Args:
            callback: Async function that receives (token_id: str, price_data: dict)
        """
        if callback not in self._price_callbacks:
            self._price_callbacks.append(callback)
            logger.info("Price callback registered", total_callbacks=len(self._price_callbacks))

    def unregister_price_callback(self, callback: Callable[[str, dict], Awaitable[None]]) -> None:
        """Unregister a price update callback."""
        if callback in self._price_callbacks:
            self._price_callbacks.remove(callback)

    async def start_websocket(self, market_ids: list[str] | None = None) -> bool:
        """
        Start WebSocket connection to Polymarket CLOB for real-time price feeds.

        Args:
            market_ids: Optional list of market IDs to subscribe to initially

        Returns:
            True if connection started successfully, False otherwise
        """
        if not self._ws_enabled:
            logger.warning("WebSocket not available (websockets library not installed)")
            return False

        if self._ws_task and not self._ws_task.done():
            logger.info("WebSocket already running")
            return True

        logger.info("Starting Polymarket WebSocket connection")
        self._ws_task = asyncio.create_task(self._ws_loop())

        # Subscribe to initial markets if provided
        if market_ids:
            await asyncio.sleep(1)  # Give connection time to establish
            for market_id in market_ids:
                await self.subscribe_market(market_id)

        return True

    async def subscribe_market(self, market_id: str) -> bool:
        """
        Subscribe to real-time price updates for a specific market.

        Args:
            market_id: Market condition_id to subscribe to

        Returns:
            True if subscription successful, False otherwise
        """
        if not self._ws_connection or not self._ws_enabled:
            return False

        try:
            subscribe_msg = {
                "type": "subscribe",
                "market_id": market_id,
            }
            await self._ws_connection.send(json.dumps(subscribe_msg))
            self._subscribed_markets.add(market_id)
            logger.info("Subscribed to market", market_id=market_id)
            return True
        except Exception as e:
            logger.error("Failed to subscribe to market", market_id=market_id, error=str(e))
            return False

    async def unsubscribe_market(self, market_id: str) -> bool:
        """Unsubscribe from a market's price updates."""
        if not self._ws_connection or not self._ws_enabled:
            return False

        try:
            unsubscribe_msg = {
                "type": "unsubscribe",
                "market_id": market_id,
            }
            await self._ws_connection.send(json.dumps(unsubscribe_msg))
            self._subscribed_markets.discard(market_id)
            logger.info("Unsubscribed from market", market_id=market_id)
            return True
        except Exception as e:
            logger.error("Failed to unsubscribe from market", market_id=market_id, error=str(e))
            return False

    async def _ws_loop(self) -> None:
        """
        Main WebSocket loop - maintains connection and processes price updates.
        Automatically reconnects on disconnection.
        """
        if not self._ws_enabled:
            return

        import websockets

        reconnect_delay = 1.0
        max_reconnect_delay = 60.0

        while True:
            try:
                logger.info("Connecting to Polymarket WebSocket", url=WS_BASE)

                async with websockets.connect(
                    WS_BASE,
                    ping_interval=20,
                    ping_timeout=10,
                    close_timeout=5,
                ) as ws:
                    self._ws_connection = ws
                    reconnect_delay = 1.0  # Reset delay on successful connection
                    logger.info("✅ Polymarket WebSocket connected")

                    # Resubscribe to all markets after reconnection
                    for market_id in list(self._subscribed_markets):
                        try:
                            subscribe_msg = {"type": "subscribe", "market_id": market_id}
                            await ws.send(json.dumps(subscribe_msg))
                        except Exception as e:
                            logger.warning("Failed to resubscribe", market_id=market_id, error=str(e))

                    # Message handling loop
                    async for message in ws:
                        try:
                            data = json.loads(message)
                            await self._handle_ws_message(data)
                        except json.JSONDecodeError:
                            logger.warning("Invalid JSON from WebSocket", message=message[:100])
                        except Exception as e:
                            logger.error("Error processing WebSocket message", error=str(e))

            except asyncio.CancelledError:
                logger.info("WebSocket loop cancelled")
                break
            except Exception as e:
                logger.error(
                    "WebSocket connection error, reconnecting...",
                    error=str(e),
                    retry_in=reconnect_delay,
                )
                await asyncio.sleep(reconnect_delay)
                reconnect_delay = min(reconnect_delay * 2, max_reconnect_delay)
            finally:
                self._ws_connection = None

    async def _handle_ws_message(self, data: dict) -> None:
        """Process a WebSocket message from Polymarket."""
        msg_type = data.get("type")

        if msg_type == "price_update":
            # Price update format: {"type": "price_update", "token_id": "0x...", "price": 0.65, ...}
            token_id = data.get("token_id")
            if token_id:
                # Update cache if this token belongs to a cached market
                for market in self._cache:
                    for token in market.tokens:
                        if token.token_id == token_id:
                            old_price = token.price
                            token.price = float(data.get("price", token.price))

                            # Update market yes/no prices
                            if token.outcome.lower() == "yes":
                                market.yes_price = token.price
                            else:
                                market.no_price = token.price

                            # Recalculate spread
                            market.spread = abs(market.yes_price - (1.0 - market.no_price))

                            logger.debug(
                                "Price updated via WebSocket",
                                market=market.question[:50],
                                token_id=token_id[:10],
                                old_price=f"{old_price:.3f}",
                                new_price=f"{token.price:.3f}",
                            )

                # Call registered callbacks
                for callback in self._price_callbacks:
                    try:
                        await callback(token_id, data)
                    except Exception as e:
                        logger.error("Price callback error", error=str(e))

        elif msg_type == "market_update":
            # Full market state update
            market_id = data.get("market_id")
            logger.debug("Market update received", market_id=market_id)

        elif msg_type == "error":
            logger.warning("WebSocket error message", error=data.get("message", "unknown"))

        else:
            logger.debug("Unknown WebSocket message type", type=msg_type)
