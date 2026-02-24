"""
User and API Credit Models
===========================
Handles user authentication, API key generation, and credit management.
"""

import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class User(BaseModel):
    """User account model."""
    id: str
    email: Optional[EmailStr] = None
    wallet_address: Optional[str] = None
    google_id: Optional[str] = None
    apple_id: Optional[str] = None

    # API Key (generated once, never expires)
    api_key: str
    api_key_hash: str  # SHA-256 hash for secure storage

    # Credit balance
    credits: int = 0
    max_credits: int = 50000

    # Subscription tier
    tier: str = "free"  # free, runner, whale

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None

    # Usage stats
    signals_generated: int = 0
    total_signals_lifetime: int = 0


class APIKey(BaseModel):
    """API Key validation model."""
    key: str
    user_id: str
    is_valid: bool = True
    last_used: Optional[datetime] = None


class CreditTransaction(BaseModel):
    """Credit transaction log."""
    id: str
    user_id: str
    amount: int  # Positive for purchase, negative for usage
    type: str  # "purchase", "signal", "refund"
    description: str
    balance_after: int
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Optional metadata
    signal_id: Optional[str] = None
    market_slug: Optional[str] = None


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
# In-Memory User Database (Replace with real DB in production)
# =============================================================================

class UserDatabase:
    """Simple in-memory user database for demo purposes."""

    def __init__(self):
        self.users: dict[str, User] = {}
        self.api_keys: dict[str, str] = {}  # api_key -> user_id
        self.transactions: list[CreditTransaction] = []

    def create_user(
        self,
        email: Optional[str] = None,
        wallet_address: Optional[str] = None,
        google_id: Optional[str] = None,
        apple_id: Optional[str] = None,
        tier: str = "free"
    ) -> User:
        """Create a new user with an API key."""
        user_id = secrets.token_urlsafe(16)
        api_key = generate_api_key()
        api_key_hash = hash_api_key(api_key)

        # Set initial credits based on tier
        initial_credits = {
            "free": 100,
            "runner": 10000,
            "whale": 100000
        }.get(tier, 100)

        user = User(
            id=user_id,
            email=email,
            wallet_address=wallet_address,
            google_id=google_id,
            apple_id=apple_id,
            api_key=api_key,
            api_key_hash=api_key_hash,
            credits=initial_credits,
            tier=tier
        )

        self.users[user_id] = user
        self.api_keys[api_key] = user_id

        # Log initial credit grant
        self.add_transaction(
            user_id=user_id,
            amount=initial_credits,
            type="purchase",
            description=f"Initial {tier} tier credits"
        )

        return user

    def get_user_by_id(self, user_id: str) -> Optional[User]:
        """Get user by ID."""
        return self.users.get(user_id)

    def get_user_by_api_key(self, api_key: str) -> Optional[User]:
        """Get user by API key."""
        user_id = self.api_keys.get(api_key)
        if user_id:
            user = self.users.get(user_id)
            if user:
                # Update last login
                user.last_login = datetime.utcnow()
            return user
        return None

    def get_user_by_wallet(self, wallet_address: str) -> Optional[User]:
        """Get user by wallet address."""
        for user in self.users.values():
            if user.wallet_address and user.wallet_address.lower() == wallet_address.lower():
                return user
        return None

    def add_credits(self, user_id: str, amount: int, description: str = "Credit purchase") -> bool:
        """Add credits to a user's account."""
        user = self.users.get(user_id)
        if not user:
            return False

        user.credits = min(user.credits + amount, user.max_credits)

        self.add_transaction(
            user_id=user_id,
            amount=amount,
            type="purchase",
            description=description
        )

        return True

    def deduct_credits(
        self,
        user_id: str,
        amount: int = 1,
        signal_id: Optional[str] = None,
        market_slug: Optional[str] = None
    ) -> bool:
        """Deduct credits from a user's account for signal generation."""
        user = self.users.get(user_id)
        if not user:
            return False

        if user.credits < amount:
            return False

        user.credits -= amount
        user.signals_generated += 1
        user.total_signals_lifetime += 1

        self.add_transaction(
            user_id=user_id,
            amount=-amount,
            type="signal",
            description=f"Signal generated: {market_slug or 'unknown'}",
            signal_id=signal_id,
            market_slug=market_slug
        )

        return True

    def add_transaction(
        self,
        user_id: str,
        amount: int,
        type: str,
        description: str,
        signal_id: Optional[str] = None,
        market_slug: Optional[str] = None
    ) -> None:
        """Log a credit transaction."""
        user = self.users.get(user_id)
        if not user:
            return

        transaction = CreditTransaction(
            id=secrets.token_urlsafe(12),
            user_id=user_id,
            amount=amount,
            type=type,
            description=description,
            balance_after=user.credits,
            signal_id=signal_id,
            market_slug=market_slug
        )

        self.transactions.append(transaction)

    def get_user_credits(self, user_id: str) -> Optional[UserCredits]:
        """Get user credit balance and stats."""
        user = self.users.get(user_id)
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


# Global database instance
user_db = UserDatabase()


# =============================================================================
# Seed Demo Users
# =============================================================================

def seed_demo_users():
    """Create demo users for testing."""

    # Free tier user
    free_user = user_db.create_user(
        email="demo@blackedge.com",
        tier="free"
    )

    # Runner tier user (with wallet)
    runner_user = user_db.create_user(
        wallet_address="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        tier="runner"
    )

    # Whale tier user
    whale_user = user_db.create_user(
        email="whale@blackedge.com",
        wallet_address="0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        tier="whale"
    )

    print("✅ Demo users created:")
    print(f"  FREE:   {free_user.api_key} ({free_user.credits} credits)")
    print(f"  RUNNER: {runner_user.api_key} ({runner_user.credits} credits)")
    print(f"  WHALE:  {whale_user.api_key} ({whale_user.credits} credits)")


if __name__ == "__main__":
    seed_demo_users()
