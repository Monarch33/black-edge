"""
Black Edge Database Models — The Invisible Engine
================================================
User, UserCredentials (encrypted), BotInstance, TradeLogs.
License table kept for Stripe/webhook compatibility.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SQLEnum,
    Float,
    ForeignKey,
    Index,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


# -----------------------------------------------------------------------------
# Base
# -----------------------------------------------------------------------------


class Base(DeclarativeBase):
    """SQLAlchemy declarative base."""

    pass


# -----------------------------------------------------------------------------
# Enums
# -----------------------------------------------------------------------------


class UserTier(str, Enum):
    """Subscription tier — maps to Stripe products."""

    FREE = "free"
    PRO = "pro"
    EDGE = "edge"


class BotStatus(str, Enum):
    """Bot instance lifecycle."""

    IDLE = "idle"
    RUNNING = "running"
    ERROR = "error"
    STOPPED = "stopped"


class LicenseTier(str, Enum):
    """Legacy — license validation."""

    OBSERVER = "observer"
    RUNNER = "runner"
    WHALE = "whale"


class LicenseStatus(str, Enum):
    """Legacy — license status."""

    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"
    CANCELLED = "cancelled"
    TRIAL = "trial"


# -----------------------------------------------------------------------------
# User
# -----------------------------------------------------------------------------


class User(Base):
    """
    Cloud user — pays via Stripe, we run the bot for them.

    Schema:
        - email: Unique login
        - stripe_subscription_id: Active Stripe subscription
        - tier: free | pro | edge
        - is_active: Can use the product
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)

    tier: Mapped[str] = mapped_column(
        SQLEnum(UserTier),
        default=UserTier.FREE,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    credentials: Mapped[Optional["UserCredentials"]] = relationship(
        "UserCredentials",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    bot_instance: Mapped[Optional["BotInstance"]] = relationship(
        "BotInstance",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    trade_logs: Mapped[list["TradeLog"]] = relationship(
        "TradeLog",
        back_populates="user",
        cascade="all, delete-orphan",
    )


# -----------------------------------------------------------------------------
# UserCredentials — Encrypted Polymarket API keys
# -----------------------------------------------------------------------------


class UserCredentials(Base):
    """
    Polymarket API keys — stored ENCRYPTED (Fernet).
    Use db.encryption.encrypt_credential() before insert,
    decrypt_credential() when reading for trading.
    """

    __tablename__ = "user_credentials"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)

    # Stored as ciphertext — never plaintext in DB
    polymarket_proxy_key: Mapped[str] = mapped_column(Text, nullable=False)  # Encrypted
    polymarket_secret: Mapped[str] = mapped_column(Text, nullable=False)  # Encrypted
    polymarket_passphrase: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Encrypted

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User", back_populates="credentials")


# -----------------------------------------------------------------------------
# BotInstance — One per user, status + heartbeat
# -----------------------------------------------------------------------------


class BotInstance(Base):
    """
    Bot state per user — IDLE | RUNNING | ERROR.
    last_heartbeat: When the worker last pinged.
    current_pnl: Running P&L (updated by worker).
    last_log: Last status message ("Scanning market X...").
    """

    __tablename__ = "bot_instances"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)

    status: Mapped[str] = mapped_column(
        SQLEnum(BotStatus),
        default=BotStatus.IDLE,
        nullable=False,
    )
    last_heartbeat: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    current_pnl: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    last_log: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User", back_populates="bot_instance")


# -----------------------------------------------------------------------------
# TradeLog — History of IA-executed trades
# -----------------------------------------------------------------------------


class TradeLog(Base):
    """
    Trade executed by our IA for a user.
    Immutable log — append-only.
    """

    __tablename__ = "trade_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    market_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    market_question: Mapped[str] = mapped_column(Text, default="", nullable=False)

    side: Mapped[str] = mapped_column(String(8), nullable=False)  # YES | NO
    size_usd: Mapped[float] = mapped_column(Float, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)

    ia_probability: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    kelly_fraction: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    status: Mapped[str] = mapped_column(String(32), default="FILLED", nullable=False)  # FILLED | CANCELLED | FAILED
    pnl: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    executed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User", back_populates="trade_logs")

    __table_args__ = (
        Index("ix_trade_logs_user_executed", "user_id", "executed_at"),
    )


# -----------------------------------------------------------------------------
# License (Legacy — Stripe/webhook)
# -----------------------------------------------------------------------------


class License(Base):
    """Legacy license record — kept for /api/auth/verify compatibility."""

    __tablename__ = "licenses"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    user_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    tier: Mapped[str] = mapped_column(
        SQLEnum(LicenseTier),
        default=LicenseTier.RUNNER,
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        SQLEnum(LicenseStatus),
        default=LicenseStatus.ACTIVE,
        nullable=False,
    )

    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    __table_args__ = (Index("ix_licenses_key_status", "key", "status"),)

    def is_valid(self) -> bool:
        if self.status not in (LicenseStatus.ACTIVE, LicenseStatus.TRIAL):
            return False
        if self.expires_at and self.expires_at <= datetime.now(timezone.utc):
            return False
        return True


# -----------------------------------------------------------------------------
# DB Initialization
# -----------------------------------------------------------------------------


def _get_engine_url() -> str:
    """Resolve database URL — prefers config (loads .env.local), else env."""
    import os

    try:
        from config import get_settings
        url = get_settings().database_url
    except Exception:
        url = os.environ.get("DATABASE_URL", "").strip()

    url = (url or "").strip()
    if url:
        return url
    # Fallback for local dev
    data_dir = Path(__file__).resolve().parent.parent / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{data_dir / 'blackedge.db'}"


def init_db() -> None:
    """Create all tables if they don't exist."""
    engine = create_engine(_get_engine_url(), echo=False)
    Base.metadata.create_all(engine)
