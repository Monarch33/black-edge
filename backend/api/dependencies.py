"""
API Dependencies: Authentication & Authorization
=================================================
Dependency injection for FastAPI routes.
"""

from typing import Optional, Annotated
from datetime import datetime

from fastapi import Depends, HTTPException, status, Header, WebSocket
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import structlog

from config import get_settings
from models.schemas import User, UserTier

logger = structlog.get_logger()
settings = get_settings()

# Security scheme
security = HTTPBearer(auto_error=False)


# =============================================================================
# Firebase Auth (Placeholder - implement with firebase-admin)
# =============================================================================

async def verify_firebase_token(token: str) -> Optional[dict]:
    """
    Verify a Firebase ID token and return the decoded claims.

    This is a placeholder - implement with firebase-admin SDK.
    """
    # TODO: Implement actual Firebase verification
    # from firebase_admin import auth
    # try:
    #     decoded = auth.verify_id_token(token)
    #     return decoded
    # except Exception as e:
    #     logger.error("Firebase token verification failed", error=str(e))
    #     return None

    # Placeholder: accept any token for development
    if token.startswith("dev_"):
        return {
            "uid": token.replace("dev_", ""),
            "email": f"{token}@dev.local",
        }
    return None


# =============================================================================
# User Repository (Placeholder - implement with database)
# =============================================================================

class UserRepository:
    """
    Repository for user data.

    Placeholder implementation - replace with actual database.
    """

    _users: dict[str, User] = {}

    @classmethod
    async def get_user(cls, uid: str) -> Optional[User]:
        """Get user by UID."""
        return cls._users.get(uid)

    @classmethod
    async def create_user(cls, uid: str, email: Optional[str] = None) -> User:
        """Create a new user."""
        user = User(
            uid=uid,
            email=email,
            tier=UserTier.OBSERVER,
        )
        cls._users[uid] = user
        return user

    @classmethod
    async def update_tier(cls, uid: str, tier: UserTier) -> Optional[User]:
        """Update user's subscription tier."""
        user = cls._users.get(uid)
        if user:
            user.tier = tier
        return user


# =============================================================================
# Authentication Dependencies
# =============================================================================

async def get_current_user(
    credentials: Annotated[
        Optional[HTTPAuthorizationCredentials],
        Depends(security)
    ],
) -> User:
    """
    Get the current authenticated user.

    Raises HTTPException 401 if not authenticated.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify token
    claims = await verify_firebase_token(credentials.credentials)
    if not claims:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    uid = claims.get("uid")
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing user ID",
        )

    # Get or create user
    user = await UserRepository.get_user(uid)
    if not user:
        user = await UserRepository.create_user(
            uid=uid,
            email=claims.get("email"),
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    return user


async def get_optional_user(
    credentials: Annotated[
        Optional[HTTPAuthorizationCredentials],
        Depends(security)
    ],
) -> Optional[User]:
    """
    Get the current user if authenticated, None otherwise.

    Does not raise exceptions for unauthenticated requests.
    """
    if not credentials:
        return None

    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


# =============================================================================
# Authorization Dependencies
# =============================================================================

def require_tier(min_tier: UserTier):
    """
    Dependency factory that requires a minimum subscription tier.

    Usage:
        @router.get("/premium", dependencies=[Depends(require_tier(UserTier.RUNNER))])
    """
    async def check_tier(user: Annotated[User, Depends(get_current_user)]) -> User:
        tier_order = [UserTier.OBSERVER, UserTier.RUNNER, UserTier.WHALE]
        user_level = tier_order.index(user.tier)
        required_level = tier_order.index(min_tier)

        if user_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This endpoint requires {min_tier.value} tier or higher",
            )
        return user

    return check_tier


# Type aliases for common dependencies
CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[Optional[User], Depends(get_optional_user)]
RunnerUser = Annotated[User, Depends(require_tier(UserTier.RUNNER))]
WhaleUser = Annotated[User, Depends(require_tier(UserTier.WHALE))]


# =============================================================================
# WebSocket Authentication
# =============================================================================

async def authenticate_websocket(
    websocket: WebSocket,
    token: Optional[str] = None,
) -> Optional[User]:
    """
    Authenticate a WebSocket connection.

    Token can be passed as query parameter or in first message.
    """
    if not token:
        # Try to get from query params
        token = websocket.query_params.get("token")

    if not token:
        return None

    claims = await verify_firebase_token(token)
    if not claims:
        return None

    uid = claims.get("uid")
    if not uid:
        return None

    user = await UserRepository.get_user(uid)
    if not user:
        user = await UserRepository.create_user(
            uid=uid,
            email=claims.get("email"),
        )

    return user
