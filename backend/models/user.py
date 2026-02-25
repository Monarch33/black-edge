"""
User and API Credit Models with PostgreSQL
==========================================
Handles user authentication, API key generation, and credit management using SQLAlchemy async.
"""

import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import Column, String, Integer, DateTime, Boolean, Text, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import Base, async_session_maker


# =============================================================================
# SQLAlchemy ORM Models (Database Tables)
# =============================================================================

class UserModel(Base):
    """User table in PostgreSQL."""
    __tablename__ = "users"

    id = Column(String(64), primary_key=True)
    email = Column(String(255), unique=True, nullable=True, index=True)
    wallet_address = Column(String(255), unique=True, nullable=True, index=True)
    google_id = Column(String(255), unique=True, nullable=True, index=True)
    apple_id = Column(String(255), unique=True, nullable=True, index=True)

    # API Key (hashed for security)
    api_key_hash = Column(String(64), unique=True, nullable=False, index=True)

    # Credit balance
    credits = Column(Integer, default=0, nullable=False)
    max_credits = Column(Integer, default=50000, nullable=False)

    # Subscription tier
    tier = Column(String(20), default="free", nullable=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_login = Column(DateTime, nullable=True)

    # Usage stats
    signals_generated = Column(Integer, default=0, nullable=False)
    total_signals_lifetime = Column(Integer, default=0, nullable=False)


class TransactionModel(Base):
    """Credit transaction log in PostgreSQL."""
    __tablename__ = "transactions"

    id = Column(String(64), primary_key=True)
    user_id = Column(String(64), nullable=False, index=True)
    amount = Column(Integer, nullable=False)  # Positive for purchase, negative for usage
    type = Column(String(20), nullable=False)  # "purchase", "signal", "refund"
    description = Column(Text, nullable=False)
    balance_after = Column(Integer, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Optional metadata
    signal_id = Column(String(64), nullable=True)
    market_slug = Column(String(255), nullable=True)


# =============================================================================
# Pydantic Models (API Responses)
# =============================================================================

class User(BaseModel):
    """User account model for API responses."""
    id: str
    email: Optional[EmailStr] = None
    wallet_address: Optional[str] = None
    google_id: Optional[str] = None
    apple_id: Optional[str] = None
    credits: int = 0
    max_credits: int = 50000
    tier: str = "free"
    created_at: datetime
    last_login: Optional[datetime] = None
    signals_generated: int = 0
    total_signals_lifetime: int = 0

    class Config:
        from_attributes = True


class CreditTransaction(BaseModel):
    """Credit transaction log."""
    id: str
    user_id: str
    amount: int
    type: str
    description: str
    balance_after: int
    timestamp: datetime
    signal_id: Optional[str] = None
    market_slug: Optional[str] = None

    class Config:
        from_attributes = True


class UserCredits(BaseModel):
    """User credit balance response."""
    user_id: str
    credits: int
    max_credits: int
    percentage: float
    tier: str
    signals_generated_today: int
    total_signals_lifetime: int


# =============================================================================
# API Key Generation
# =============================================================================

def generate_api_key() -> str:
    """Generate a secure API key with be_live_ prefix."""
    random_part = secrets.token_urlsafe(32)
    return f"be_live_{random_part}"


def hash_api_key(api_key: str) -> str:
    """Hash an API key for secure storage."""
    return hashlib.sha256(api_key.encode()).hexdigest()


def verify_api_key(provided_key: str, stored_hash: str) -> bool:
    """Verify an API key against its stored hash."""
    return hash_api_key(provided_key) == stored_hash


# =============================================================================
# Async Database Operations
# =============================================================================

class UserDatabase:
    """PostgreSQL user database with async operations."""

    async def create_user(
        self,
        email: Optional[str] = None,
        wallet_address: Optional[str] = None,
        google_id: Optional[str] = None,
        apple_id: Optional[str] = None,
        tier: str = "free"
    ) -> tuple[User, str]:
        """Create a new user with an API key. Returns (User, api_key)."""
        user_id = secrets.token_urlsafe(16)
        api_key = generate_api_key()
        api_key_hash = hash_api_key(api_key)

        # Set initial credits based on tier
        initial_credits = {
            "free": 100,
            "starter": 100,  # Same as free, for purchases
            "pro": 10000,
            "whale": 100000
        }.get(tier, 100)

        async with async_session_maker() as session:
            # Create user
            db_user = UserModel(
                id=user_id,
                email=email,
                wallet_address=wallet_address,
                google_id=google_id,
                apple_id=apple_id,
                api_key_hash=api_key_hash,
                credits=initial_credits,
                tier=tier
            )
            session.add(db_user)

            # Log initial credit grant
            transaction = TransactionModel(
                id=secrets.token_urlsafe(12),
                user_id=user_id,
                amount=initial_credits,
                type="purchase",
                description=f"Initial {tier} tier credits",
                balance_after=initial_credits
            )
            session.add(transaction)

            await session.commit()
            await session.refresh(db_user)

            return User.model_validate(db_user), api_key

    async def get_user_by_id(self, user_id: str) -> Optional[User]:
        """Get user by ID."""
        async with async_session_maker() as session:
            result = await session.execute(
                select(UserModel).where(UserModel.id == user_id)
            )
            db_user = result.scalar_one_or_none()
            return User.model_validate(db_user) if db_user else None

    async def get_user_by_api_key(self, api_key: str) -> Optional[User]:
        """Get user by API key."""
        api_key_hash = hash_api_key(api_key)

        async with async_session_maker() as session:
            result = await session.execute(
                select(UserModel).where(UserModel.api_key_hash == api_key_hash)
            )
            db_user = result.scalar_one_or_none()

            if db_user:
                # Update last login
                db_user.last_login = datetime.utcnow()
                await session.commit()
                return User.model_validate(db_user)

            return None

    async def get_user_by_wallet(self, wallet_address: str) -> Optional[User]:
        """Get user by wallet address."""
        async with async_session_maker() as session:
            result = await session.execute(
                select(UserModel).where(
                    func.lower(UserModel.wallet_address) == wallet_address.lower()
                )
            )
            db_user = result.scalar_one_or_none()
            return User.model_validate(db_user) if db_user else None

    async def add_credits(self, user_id: str, amount: int, description: str = "Credit purchase") -> bool:
        """Add credits to a user's account."""
        async with async_session_maker() as session:
            result = await session.execute(
                select(UserModel).where(UserModel.id == user_id)
            )
            db_user = result.scalar_one_or_none()

            if not db_user:
                return False

            db_user.credits = min(db_user.credits + amount, db_user.max_credits)

            # Log transaction
            transaction = TransactionModel(
                id=secrets.token_urlsafe(12),
                user_id=user_id,
                amount=amount,
                type="purchase",
                description=description,
                balance_after=db_user.credits
            )
            session.add(transaction)

            await session.commit()
            return True

    async def deduct_credits(
        self,
        user_id: str,
        amount: int = 1,
        signal_id: Optional[str] = None,
        market_slug: Optional[str] = None
    ) -> bool:
        """Deduct credits from a user's account for signal generation."""
        async with async_session_maker() as session:
            result = await session.execute(
                select(UserModel).where(UserModel.id == user_id)
            )
            db_user = result.scalar_one_or_none()

            if not db_user or db_user.credits < amount:
                return False

            db_user.credits -= amount
            db_user.signals_generated += 1
            db_user.total_signals_lifetime += 1

            # Log transaction
            transaction = TransactionModel(
                id=secrets.token_urlsafe(12),
                user_id=user_id,
                amount=-amount,
                type="signal",
                description=f"Signal generated: {market_slug or 'unknown'}",
                balance_after=db_user.credits,
                signal_id=signal_id,
                market_slug=market_slug
            )
            session.add(transaction)

            await session.commit()
            return True

    async def get_user_credits(self, user_id: str) -> Optional[UserCredits]:
        """Get user credit balance and stats."""
        user = await self.get_user_by_id(user_id)
        if not user:
            return None

        return UserCredits(
            user_id=user_id,
            credits=user.credits,
            max_credits=user.max_credits,
            percentage=round((user.credits / user.max_credits) * 100, 1),
            tier=user.tier,
            signals_generated_today=user.signals_generated,
            total_signals_lifetime=user.total_signals_lifetime
        )

    async def get_all_users(self) -> list[User]:
        """Get all users (admin endpoint)."""
        async with async_session_maker() as session:
            result = await session.execute(select(UserModel))
            db_users = result.scalars().all()
            return [User.model_validate(u) for u in db_users]

    async def get_transactions(self, user_id: str, limit: int = 50) -> list[CreditTransaction]:
        """Get user transaction history."""
        async with async_session_maker() as session:
            result = await session.execute(
                select(TransactionModel)
                .where(TransactionModel.user_id == user_id)
                .order_by(TransactionModel.timestamp.desc())
                .limit(limit)
            )
            transactions = result.scalars().all()
            return [CreditTransaction.model_validate(t) for t in transactions]


# Global database instance
user_db = UserDatabase()


# =============================================================================
# Seed Demo Users
# =============================================================================

async def seed_demo_users():
    """Create demo users for testing."""
    from database import init_db

    # Initialize database tables
    await init_db()

    # Check if users already exist
    existing_users = await user_db.get_all_users()
    if existing_users:
        print(f"✅ Database already has {len(existing_users)} users")
        return

    # Free tier user
    free_user, free_key = await user_db.create_user(
        email="demo@blackedge.com",
        tier="free"
    )

    # Pro tier user (with wallet)
    pro_user, pro_key = await user_db.create_user(
        wallet_address="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        tier="pro"
    )

    # Whale tier user
    whale_user, whale_key = await user_db.create_user(
        email="whale@blackedge.com",
        wallet_address="0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        tier="whale"
    )

    print("✅ Demo users created:")
    print(f"  FREE:  {free_key[:20]}... ({free_user.credits} credits)")
    print(f"  PRO:   {pro_key[:20]}... ({pro_user.credits} credits)")
    print(f"  WHALE: {whale_key[:20]}... ({whale_user.credits} credits)")


if __name__ == "__main__":
    import asyncio
    asyncio.run(seed_demo_users())
