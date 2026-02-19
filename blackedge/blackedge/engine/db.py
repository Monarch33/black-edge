"""
SQLite / SQLAlchemy — Persistance locale
========================================
Table trades : id, timestamp, market_id, side, size, expected_price, status, pnl.
"""

from datetime import datetime
from pathlib import Path

from sqlalchemy import (
    DateTime,
    Float,
    String,
    Text,
    create_engine,
    select,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from blackedge.config import BlackEdgeSettings


class Base(DeclarativeBase):
    pass


class Trade(Base):
    """Enregistrement d'un trade (paper ou live)."""

    __tablename__ = "trades"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    market_id: Mapped[str] = mapped_column(String(64), index=True)
    market_question: Mapped[str] = mapped_column(String(512), default="")
    side: Mapped[str] = mapped_column(String(8))  # YES | NO
    size_usd: Mapped[float] = mapped_column(Float)
    expected_price: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(32), default="PAPER_OPEN")  # PAPER_OPEN | PAPER_CLOSED | ...
    pnl: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[str] = mapped_column(Text, default="")


def get_engine(settings: BlackEdgeSettings | None = None) -> None:
    """Initialise l'engine (singleton)."""
    pass  # Utilisé pour compatibilité


class TradeDB:
    """Accès SQLite synchrone pour les trades."""

    def __init__(self, settings: BlackEdgeSettings | None = None) -> None:
        self._settings = settings or BlackEdgeSettings()
        path = Path(self._settings.db_path)
        if not path.is_absolute():
            path = Path.cwd() / path
        path.parent.mkdir(parents=True, exist_ok=True)
        url = f"sqlite:///{path.absolute()}"
        self._engine = create_engine(url, echo=False)
        Base.metadata.create_all(self._engine)
        self._session_factory = sessionmaker(
            self._engine, expire_on_commit=False, autoflush=False
        )

    def insert_trade(
        self,
        market_id: str,
        market_question: str,
        side: str,
        size_usd: float,
        expected_price: float,
        status: str = "PAPER_OPEN",
        pnl: float = 0.0,
        notes: str = "",
    ) -> int:
        """Insère un trade et retourne l'ID."""
        with self._session_factory() as session:
            t = Trade(
                market_id=market_id,
                market_question=market_question[:512],
                side=side,
                size_usd=size_usd,
                expected_price=expected_price,
                status=status,
                pnl=pnl,
                notes=notes,
            )
            session.add(t)
            session.commit()
            return t.id

    def update_trade(self, trade_id: int, status: str, pnl: float = 0.0) -> None:
        """Met à jour un trade (clôture)."""
        with self._session_factory() as session:
            t = session.get(Trade, trade_id)
            if t:
                t.status = status
                t.pnl = pnl
                session.commit()

    def get_open_trades(self) -> list[Trade]:
        """Retourne les trades ouverts."""
        with self._session_factory() as session:
            stmt = select(Trade).where(Trade.status == "PAPER_OPEN")
            return list(session.scalars(stmt).all())

    def get_all_trades(self, limit: int = 100) -> list[Trade]:
        """Retourne les N derniers trades."""
        with self._session_factory() as session:
            stmt = select(Trade).order_by(Trade.timestamp.desc()).limit(limit)
            return list(session.scalars(stmt).all())

    def get_total_pnl(self) -> float:
        """PnL cumulé (tous trades)."""
        with self._session_factory() as session:
            from sqlalchemy import func

            result = session.execute(select(func.sum(Trade.pnl))).scalar()
            return float(result or 0.0)
