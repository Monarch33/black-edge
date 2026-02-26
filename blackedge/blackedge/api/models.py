"""
Modèles Pydantic — API Polymarket
=================================
Schémas pour Market, Orderbook, Token.
"""

from pydantic import BaseModel, Field


class PolymarketToken(BaseModel):
    """Token outcome (YES ou NO) d'un marché."""

    token_id: str
    outcome: str = Field(..., description="Yes ou No")
    price: float = Field(ge=0.0, le=1.0, description="Prix 0.0–1.0")


class OrderbookLevel(BaseModel):
    """Niveau du carnet d'ordres (bid ou ask)."""

    price: float = Field(ge=0.0, le=1.0)
    size: float = Field(ge=0.0)


class Orderbook(BaseModel):
    """Carnet d'ordres L2 pour un token."""

    token_id: str
    bids: list[OrderbookLevel] = Field(default_factory=list)
    asks: list[OrderbookLevel] = Field(default_factory=list)

    @property
    def best_bid(self) -> float | None:
        """Meilleur prix d'achat."""
        if not self.bids:
            return None
        return max(b.price for b in self.bids)

    @property
    def best_ask(self) -> float | None:
        """Meilleur prix de vente."""
        if not self.asks:
            return None
        return min(a.price for a in self.asks)

    @property
    def spread(self) -> float | None:
        """Spread (ask - bid)."""
        if self.best_bid is None or self.best_ask is None:
            return None
        return self.best_ask - self.best_bid


class Market(BaseModel):
    """
    Marché Polymarket normalisé.
    Filtre : volume ≥ 25k$, liquidité suffisante.
    """

    id: str
    condition_id: str
    question: str
    slug: str
    description: str = ""
    yes_price: float = Field(ge=0.0, le=1.0)
    no_price: float = Field(ge=0.0, le=1.0)
    spread: float = Field(ge=0.0)
    volume_24h: float = Field(ge=0.0)
    volume_total: float = Field(ge=0.0)
    liquidity: float = Field(ge=0.0)
    end_date: str = ""
    active: bool = True
    tokens: list[PolymarketToken] = Field(default_factory=list)

    @property
    def url(self) -> str:
        return f"https://polymarket.com/event/{self.slug}"

    @property
    def market_probability(self) -> float:
        """Probabilité implicite du marché (YES)."""
        return self.yes_price
