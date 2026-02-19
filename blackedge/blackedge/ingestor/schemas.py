"""Pydantic v2 schemas for Polymarket API responses."""

from __future__ import annotations

from pydantic import BaseModel, Field


class PolymarketToken(BaseModel):
    token_id: str = ""
    outcome: str = ""
    price: float = 0.0


class PolymarketMarket(BaseModel):
    """Normalized representation of a single Polymarket event/market."""

    condition_id: str
    question_id: str = ""
    title: str = ""
    description: str = ""
    market_slug: str = ""
    active: bool = True
    closed: bool = False
    volume_usd: float = Field(default=0.0, alias="volume")
    liquidity_usd: float = Field(default=0.0, alias="liquidity")
    outcomes: list[str] = []
    outcome_prices: list[float] = []
    best_bid: float = 0.0
    best_ask: float = 0.0
    spread: float = 0.0

    model_config = {"populate_by_name": True}


class OrderbookLevel(BaseModel):
    price: float
    size: float


class Orderbook(BaseModel):
    market_id: str
    bids: list[OrderbookLevel] = []
    asks: list[OrderbookLevel] = []
    spread: float = 0.0
    mid_price: float = 0.0
