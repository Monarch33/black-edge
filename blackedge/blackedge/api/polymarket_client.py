"""
Client Polymarket asynchrone — Data Ingestor (Le Radar)
========================================================
Récupère les marchés actifs, filtre volume/liquidité, fetch orderbook.
Backoff exponentiel via tenacity.
"""

import asyncio
import json
import time
from datetime import datetime, timezone

import httpx
import structlog
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from blackedge.api.models import Market, Orderbook, OrderbookLevel, PolymarketToken
from blackedge.config import BlackEdgeSettings

logger = structlog.get_logger()

MIN_REQUEST_INTERVAL = 2.0


def _parse_json_field(value: str | list | None, default: list[str]) -> list[str]:
    """Parse clobTokenIds, outcomes, outcomePrices (JSON string ou list)."""
    if value is None:
        return default
    if isinstance(value, list):
        return [str(v) for v in value]
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return [str(v) for v in parsed]
            return [str(parsed)]
        except json.JSONDecodeError:
            logger.warning("parse_json_field_failed", value=value[:50] if value else "")
            return default
    return default


class PolymarketClient:
    """
    Client asynchrone Polymarket (Gamma + CLOB).
    Filtre : volume ≥ min_volume_usd, liquidité ≥ min_liquidity.
    """

    def __init__(self, settings: BlackEdgeSettings | None = None) -> None:
        self._settings = settings or BlackEdgeSettings()
        self._client: httpx.AsyncClient | None = None
        self._last_request_time: float = 0.0
        self._cache: list[Market] = []

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(15.0, connect=10.0),
                headers={"User-Agent": "BlackEdge/1.0"},
                follow_redirects=True,
            )
        return self._client

    async def _rate_limit(self) -> None:
        now = time.monotonic()
        elapsed = now - self._last_request_time
        if elapsed < MIN_REQUEST_INTERVAL:
            await asyncio.sleep(MIN_REQUEST_INTERVAL - elapsed)
        self._last_request_time = time.monotonic()

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    # -------------------------------------------------------------------------
    # Gamma API — marchés
    # -------------------------------------------------------------------------

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        retry=retry_if_exception_type((httpx.HTTPError, httpx.TimeoutException)),
    )
    async def _fetch_gamma_markets(
        self,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict]:
        """Fetch marchés depuis Gamma API avec retry."""
        await self._rate_limit()
        client = await self._get_client()
        gamma = self._settings.polymarket_gamma_url

        resp = await client.get(
            f"{gamma}/markets",
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
        return resp.json()

    def _parse_market(self, m: dict) -> Market | None:
        """Parse un marché brut en Market Pydantic. Retourne None si invalide."""
        try:
            closed = m.get("closed", False)
            active = m.get("active", True)
            if closed or not active:
                return None

            end_date_str = m.get("endDate", "")
            if end_date_str:
                try:
                    end_dt = datetime.fromisoformat(end_date_str.replace("Z", "+00:00"))
                    if end_dt < datetime.now(timezone.utc):
                        return None
                except Exception:
                    pass

            volume_24h = float(m.get("volume24hr", 0) or 0)
            volume_total = float(m.get("volumeNum", 0) or 0)
            liquidity = float(m.get("liquidityNum", 0) or 0)

            min_vol = self._settings.min_volume_usd
            min_liq = self._settings.min_liquidity
            if volume_total < min_vol and volume_24h < min_vol:
                return None
            if liquidity < min_liq:
                return None

            clob_ids = _parse_json_field(m.get("clobTokenIds"), [])
            outcomes = _parse_json_field(m.get("outcomes"), ["Yes", "No"])
            outcome_prices = _parse_json_field(m.get("outcomePrices"), [])

            if not clob_ids or len(clob_ids) < 2:
                return None

            yes_price = 0.5
            no_price = 0.5
            if len(outcome_prices) >= 2:
                try:
                    yes_price = float(outcome_prices[0])
                    no_price = float(outcome_prices[1])
                except (ValueError, TypeError):
                    pass

            yes_price = max(0.01, min(0.99, yes_price))
            no_price = max(0.01, min(0.99, no_price))

            spread = abs(yes_price - (1.0 - no_price))
            api_spread = m.get("spread")
            if isinstance(api_spread, (int, float)):
                spread = float(api_spread)

            tokens = []
            for i, tid in enumerate(clob_ids):
                outcome_name = outcomes[i] if i < len(outcomes) else ("Yes" if i == 0 else "No")
                price = yes_price if i == 0 else no_price
                tokens.append(PolymarketToken(token_id=tid, outcome=outcome_name, price=price))

            return Market(
                id=str(m.get("id", "")),
                condition_id=m.get("conditionId", ""),
                question=m.get("question", "Unknown"),
                slug=m.get("slug", ""),
                description=m.get("description", "")[:500] if m.get("description") else "",
                yes_price=yes_price,
                no_price=no_price,
                spread=spread,
                volume_24h=volume_24h,
                volume_total=volume_total,
                liquidity=liquidity,
                end_date=end_date_str,
                active=active,
                tokens=tokens,
            )
        except Exception as e:
            logger.debug("parse_market_failed", error=str(e))
            return None

    async def fetch_markets(self, max_markets: int = 50) -> list[Market]:
        """
        Récupère les marchés actifs filtrés (volume ≥ 25k$, liquidité suffisante).
        Triés par volume 24h décroissant.
        """
        raw = await self._fetch_gamma_markets(limit=max_markets * 3)
        markets: list[Market] = []

        for m in raw:
            parsed = self._parse_market(m)
            if parsed:
                markets.append(parsed)

        markets.sort(key=lambda x: x.volume_24h, reverse=True)
        markets = markets[:max_markets]

        if markets:
            self._cache = markets
            logger.info(
                "polymarket_markets_refreshed",
                count=len(markets),
                total_volume_24h=sum(x.volume_24h for x in markets),
            )

        return markets

    def get_cached(self) -> list[Market]:
        """Retourne le cache sans appel API."""
        return self._cache

    # -------------------------------------------------------------------------
    # CLOB API — orderbook
    # -------------------------------------------------------------------------

    @retry(
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((httpx.HTTPError, httpx.TimeoutException)),
    )
    async def fetch_orderbook(self, token_id: str) -> Orderbook | None:
        """Récupère le carnet d'ordres L2 pour un token."""
        await self._rate_limit()
        client = await self._get_client()
        clob = self._settings.polymarket_clob_url

        try:
            resp = await client.get(
                f"{clob}/book",
                params={"token_id": token_id},
            )
            resp.raise_for_status()
            data = resp.json()

            bids = [
                OrderbookLevel(price=float(o.get("price", 0)), size=float(o.get("size", 0)))
                for o in data.get("bids", [])
            ]
            asks = [
                OrderbookLevel(price=float(o.get("price", 0)), size=float(o.get("size", 0)))
                for o in data.get("asks", [])
            ]

            return Orderbook(token_id=token_id, bids=bids, asks=asks)
        except Exception as e:
            logger.warning("orderbook_fetch_failed", token_id=token_id[:20], error=str(e))
            return None
