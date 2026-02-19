"""CRUD helpers for trade & portfolio persistence."""

from __future__ import annotations

from sqlmodel import select

from blackedge.db.engine import get_session
from blackedge.db.models import Trade, PortfolioSnapshot


def insert_trade(trade: Trade) -> Trade:
    with get_session() as session:
        session.add(trade)
        session.commit()
        session.refresh(trade)
        return trade


def get_open_trades() -> list[Trade]:
    with get_session() as session:
        stmt = select(Trade).where(Trade.status == "OPEN")
        return list(session.exec(stmt).all())


def insert_snapshot(snapshot: PortfolioSnapshot) -> PortfolioSnapshot:
    with get_session() as session:
        session.add(snapshot)
        session.commit()
        session.refresh(snapshot)
        return snapshot
