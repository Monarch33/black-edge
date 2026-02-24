"""
Credits API Router
==================
Endpoints for managing user credits and API keys with PostgreSQL async support.
"""

from fastapi import APIRouter, HTTPException, Header, Depends
from typing import Optional, Annotated
from pydantic import BaseModel
import structlog

from models.user import user_db, UserCredits, User


logger = structlog.get_logger()
router = APIRouter(prefix="/api/credits", tags=["credits"])


# =============================================================================
# Request/Response Models
# =============================================================================

class BalanceResponse(BaseModel):
    """Credit balance response."""
    user_id: str
    credits: int
    max_credits: int
    percentage: float
    tier: str
    signals_generated_today: int
    total_signals_lifetime: int
    status: str = "ok"


class PurchaseRequest(BaseModel):
    """Credit purchase request."""
    amount: int
    payment_method: str = "stripe"


class DeductRequest(BaseModel):
    """Manual credit deduction (admin only)."""
    amount: int = 1
    reason: str = "Signal generated"


# =============================================================================
# Authentication Dependency
# =============================================================================

async def get_current_user(
    authorization: Annotated[Optional[str], Header()] = None,
    x_api_key: Annotated[Optional[str], Header()] = None
) -> User:
    """
    Extract and validate API key from request headers.
    Supports both Authorization: Bearer <key> and X-API-Key: <key>
    """
    api_key = None

    # Try Authorization header first (Bearer token)
    if authorization and authorization.startswith("Bearer "):
        api_key = authorization.replace("Bearer ", "")

    # Fallback to X-API-Key header
    if not api_key and x_api_key:
        api_key = x_api_key

    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="Missing API key. Include 'Authorization: Bearer <key>' or 'X-API-Key: <key>' header."
        )

    # Validate API key (async)
    user = await user_db.get_user_by_api_key(api_key)
    if not user:
        logger.warning("Invalid API key attempt", api_key_prefix=api_key[:10])
        raise HTTPException(
            status_code=401,
            detail="Invalid API key."
        )

    logger.info("User authenticated", user_id=user.id, tier=user.tier)
    return user


# =============================================================================
# Endpoints
# =============================================================================

@router.get("/balance", response_model=BalanceResponse)
async def get_balance(user: Annotated[User, Depends(get_current_user)]):
    """
    Get current credit balance for authenticated user.

    Headers:
    - Authorization: Bearer be_live_xxx
    OR
    - X-API-Key: be_live_xxx
    """
    credits = await user_db.get_user_credits(user.id)
    if not credits:
        raise HTTPException(status_code=404, detail="User not found")

    return BalanceResponse(
        user_id=credits.user_id,
        credits=credits.credits,
        max_credits=credits.max_credits,
        percentage=credits.percentage,
        tier=credits.tier,
        signals_generated_today=credits.signals_generated_today,
        total_signals_lifetime=credits.total_signals_lifetime
    )


@router.post("/purchase")
async def purchase_credits(
    request: PurchaseRequest,
    user: Annotated[User, Depends(get_current_user)]
):
    """
    Purchase additional credits.
    In production, this would integrate with Stripe.
    """
    if request.amount <= 0 or request.amount > 1000000:
        raise HTTPException(status_code=400, detail="Invalid amount")

    success = await user_db.add_credits(
        user_id=user.id,
        amount=request.amount,
        description=f"Credit purchase via {request.payment_method}"
    )

    if not success:
        raise HTTPException(status_code=500, detail="Failed to add credits")

    credits = await user_db.get_user_credits(user.id)

    logger.info(
        "Credits purchased",
        user_id=user.id,
        amount=request.amount,
        new_balance=credits.credits if credits else 0
    )

    return {
        "status": "ok",
        "amount_added": request.amount,
        "new_balance": credits.credits if credits else 0,
        "message": f"Successfully added {request.amount} credits"
    }


@router.post("/deduct")
async def deduct_credits(
    request: DeductRequest,
    user: Annotated[User, Depends(get_current_user)]
):
    """
    Deduct credits manually (used by WebSocket signal stream).
    """
    success = await user_db.deduct_credits(
        user_id=user.id,
        amount=request.amount
    )

    if not success:
        logger.warning("Credit deduction failed", user_id=user.id, amount=request.amount)
        raise HTTPException(
            status_code=402,  # Payment Required
            detail="Insufficient credits"
        )

    credits = await user_db.get_user_credits(user.id)

    logger.info(
        "Credits deducted",
        user_id=user.id,
        amount=request.amount,
        new_balance=credits.credits if credits else 0
    )

    return {
        "status": "ok",
        "amount_deducted": request.amount,
        "new_balance": credits.credits if credits else 0
    }


@router.get("/transactions")
async def get_transactions(
    user: Annotated[User, Depends(get_current_user)],
    limit: int = 50
):
    """Get recent credit transactions for authenticated user."""
    transactions = await user_db.get_transactions(user.id, limit)

    return {
        "status": "ok",
        "count": len(transactions),
        "transactions": transactions
    }


@router.get("/usage-stats")
async def get_usage_stats(user: Annotated[User, Depends(get_current_user)]):
    """Get usage statistics for the last 7 days."""
    # In production, this would query a time-series database
    # For now, return mock data that matches the frontend

    return {
        "status": "ok",
        "period": "last_7_days",
        "stats": {
            "signals_generated": 847,
            "avg_edge": 12.4,
            "win_rate": 62,
            "total_profit": 4250.00,
            "markets_analyzed": 156
        }
    }


# =============================================================================
# Admin Endpoints (No auth for demo)
# =============================================================================

@router.post("/admin/create-user")
async def admin_create_user(
    email: Optional[str] = None,
    wallet_address: Optional[str] = None,
    tier: str = "free"
):
    """
    Admin endpoint to create a new user.
    Returns the generated API key.
    """
    user, api_key = await user_db.create_user(
        email=email,
        wallet_address=wallet_address,
        tier=tier
    )

    logger.info("User created", user_id=user.id, tier=tier)

    return {
        "status": "ok",
        "user_id": user.id,
        "api_key": api_key,  # ONLY return this once!
        "credits": user.credits,
        "tier": user.tier,
        "message": "⚠️ Save this API key - it won't be shown again!"
    }


@router.get("/admin/users")
async def admin_list_users():
    """Admin endpoint to list all users."""
    all_users = await user_db.get_all_users()

    users = [
        {
            "id": u.id,
            "email": u.email,
            "wallet": u.wallet_address,
            "tier": u.tier,
            "credits": u.credits,
            "signals": u.total_signals_lifetime
        }
        for u in all_users
    ]

    return {
        "status": "ok",
        "count": len(users),
        "users": users
    }
