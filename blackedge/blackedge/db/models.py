"""SQLModel ORM models — local SQLite persistence."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class Trade(SQLModel, table=True):
    """Single paper-trade record."""

    id: Optional[int] = Field(default=None, primary_key=True)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    market_id: str = Field(index=True)
    market_title: str = ""
    side: str  # "YES" | "NO"
    size_usd: float
    expected_price: float
    ia_probability: float
    confidence: float
    kelly_fraction: float
    status: str = "OPEN"  # OPEN | CLOSED | CANCELLED
    pnl: float = 0.0


class PortfolioSnapshot(SQLModel, table=True):
    """Point-in-time snapshot of portfolio value."""

    id: Optional[int] = Field(default=None, primary_key=True)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    bankroll: float
    open_positions: int
    total_pnl: float
