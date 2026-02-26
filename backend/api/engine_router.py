"""
Engine API — The Invisible Engine
=================================
POST /setup, /activate, /toggle, /keys
GET  /status, /trades
WS   /logs/{user_id}
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

import httpx
import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from api.websocket_manager import engine_logs_manager
from db.credentials import get_polymarket_credentials_decrypted, save_polymarket_credentials
from db.models import BotInstance, BotStatus, TradeLog, User, UserCredentials, UserTier, init_db
from db.session import get_session

logger = structlog.get_logger()

router = APIRouter(prefix="/api/engine", tags=["engine"])


# -----------------------------------------------------------------------------
# Mock Auth (user_id=1 until Stripe auth)
# -----------------------------------------------------------------------------


def get_current_user_id() -> int:
    """Mock: always return user_id=1. Replace with real auth later."""
    return 1


def ensure_user_and_bot(user_id: int) -> None:
    """Create User and BotInstance if they don't exist."""
    init_db()
    with get_session() as session:
        user = session.query(User).filter(User.id == user_id).first()
        if not user:
            user = User(email=f"user{user_id}@blackedge.io", tier=UserTier.PRO, is_active=True)
            session.add(user)
            session.flush()

        bot = session.query(BotInstance).filter(BotInstance.user_id == user_id).first()
        if not bot:
            bot = BotInstance(user_id=user_id, status=BotStatus.IDLE)
            session.add(bot)


# -----------------------------------------------------------------------------
# Schemas
# -----------------------------------------------------------------------------


class SetupRequest(BaseModel):
    """Onboarding: user submits Polymarket API credentials."""

    polymarket_api_key: str = Field(..., min_length=1, description="Polymarket API / proxy key")
    polymarket_proxy_secret: str = Field(..., min_length=1, description="Polymarket proxy secret")
    polymarket_passphrase: str = Field("", description="Polymarket passphrase (optional)")


class SetupResponse(BaseModel):
    status: str
    message: str
    keys_valid: bool = False


class ActivateResponse(BaseModel):
    status: str
    message: str


class KeysRequest(BaseModel):
    proxy_key: str = Field(..., min_length=1)
    secret: str = Field(..., min_length=1)


class KeysResponse(BaseModel):
    status: str = "success"
    message: str = "Polymarket keys stored securely"


class ToggleResponse(BaseModel):
    status: str = Field(..., description="RUNNING or STOPPED")
    message: str


class StatusResponse(BaseModel):
    status: str = Field(..., description="RUNNING or STOPPED")
    current_pnl: float = Field(0.0)
    total_trades_count: int = Field(0)
    last_log: str = Field("")


# -----------------------------------------------------------------------------
# POST /setup — Onboarding: validate + encrypt Polymarket keys
# -----------------------------------------------------------------------------


async def _ping_polymarket_keys(api_key: str, secret: str) -> bool:
    """Validate Polymarket credentials by calling a lightweight CLOB endpoint."""
    clob_url = os.environ.get("POLYMARKET_CLOB_URL", "https://clob.polymarket.com")
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                f"{clob_url}/time",
                headers={
                    "POLY_API_KEY": api_key,
                    "POLY_SECRET": secret,
                },
            )
            return resp.status_code == 200
    except Exception as e:
        logger.warning("Polymarket ping failed", error=str(e))
        return False


@router.post("/setup", response_model=SetupResponse)
async def setup_polymarket_keys(
    request: SetupRequest,
    user_id: int = Depends(get_current_user_id),
) -> SetupResponse:
    """
    Onboarding endpoint (post-payment).
    1. Ping Polymarket CLOB to validate keys.
    2. Encrypt with Fernet and store in UserCredentials.
    """
    ensure_user_and_bot(user_id)
    init_db()

    keys_valid = await _ping_polymarket_keys(request.polymarket_api_key, request.polymarket_proxy_secret)

    with get_session() as session:
        save_polymarket_credentials(
            session=session,
            user_id=user_id,
            polymarket_proxy_key=request.polymarket_api_key,
            polymarket_secret=request.polymarket_proxy_secret,
            polymarket_passphrase=request.polymarket_passphrase,
        )

    if keys_valid:
        logger.info("Setup complete — keys validated", user_id=user_id)
        return SetupResponse(status="success", message="Keys validated and stored securely", keys_valid=True)

    logger.warning("Setup complete — keys stored but ping failed", user_id=user_id)
    return SetupResponse(
        status="warning",
        message="Keys stored but could not be validated against Polymarket. They may still work.",
        keys_valid=False,
    )


# -----------------------------------------------------------------------------
# POST /activate — Start the bot for this user
# -----------------------------------------------------------------------------


@router.post("/activate", response_model=ActivateResponse)
def activate_bot(
    user_id: int = Depends(get_current_user_id),
) -> ActivateResponse:
    """
    Activate the bot: set status to RUNNING.
    Requires credentials to be set first (/setup).
    """
    ensure_user_and_bot(user_id)
    init_db()

    with get_session() as session:
        creds = session.query(UserCredentials).filter(UserCredentials.user_id == user_id).first()
        if not creds:
            raise HTTPException(status_code=400, detail="No Polymarket credentials. Call /setup first.")

        bot = session.query(BotInstance).filter(BotInstance.user_id == user_id).first()
        if not bot:
            raise HTTPException(status_code=404, detail="BotInstance not found")

        bot.status = BotStatus.RUNNING
        bot.last_heartbeat = datetime.now(timezone.utc)
        bot.last_log = "Bot activated — entering scanner queue..."

    logger.info("Bot activated", user_id=user_id)
    return ActivateResponse(status="RUNNING", message="Bot activated successfully")


# -----------------------------------------------------------------------------
# Legacy /keys endpoint (kept for backward compat)
# -----------------------------------------------------------------------------


@router.post("/keys", response_model=KeysResponse)
def store_polymarket_keys(
    request: KeysRequest,
    user_id: int = Depends(get_current_user_id),
) -> KeysResponse:
    """Store Polymarket API keys (encrypted via Fernet)."""
    ensure_user_and_bot(user_id)
    init_db()

    with get_session() as session:
        save_polymarket_credentials(
            session=session,
            user_id=user_id,
            polymarket_proxy_key=request.proxy_key,
            polymarket_secret=request.secret,
        )

    logger.info("Polymarket keys stored", user_id=user_id)
    return KeysResponse(status="success", message="Polymarket keys stored securely")


# -----------------------------------------------------------------------------
# POST /toggle
# -----------------------------------------------------------------------------


@router.post("/toggle", response_model=ToggleResponse)
def toggle_bot(
    user_id: int = Depends(get_current_user_id),
) -> ToggleResponse:
    """Toggle bot status: IDLE <-> RUNNING."""
    ensure_user_and_bot(user_id)
    init_db()

    with get_session() as session:
        bot = session.query(BotInstance).filter(BotInstance.user_id == user_id).first()
        if not bot:
            raise HTTPException(status_code=404, detail="BotInstance not found")

        if bot.status == BotStatus.RUNNING:
            bot.status = BotStatus.IDLE
            bot.last_log = "Bot stopped by user"
            status_str = "STOPPED"
            message = "Bot stopped"
        else:
            bot.status = BotStatus.RUNNING
            bot.last_heartbeat = datetime.now(timezone.utc)
            bot.last_log = "Bot started — scanning Polymarket..."
            status_str = "RUNNING"
            message = "Bot started"

    logger.info("Bot toggled", user_id=user_id, new_status=status_str)
    return ToggleResponse(status=status_str, message=message)


# -----------------------------------------------------------------------------
# GET /status
# -----------------------------------------------------------------------------


@router.get("/status", response_model=StatusResponse)
def get_engine_status(
    user_id: int = Depends(get_current_user_id),
) -> StatusResponse:
    """Dashboard status: status, current_pnl, total_trades_count, last_log."""
    ensure_user_and_bot(user_id)
    init_db()

    with get_session() as session:
        bot = session.query(BotInstance).filter(BotInstance.user_id == user_id).first()
        if not bot:
            return StatusResponse(status="STOPPED", current_pnl=0.0, total_trades_count=0, last_log="")

        total_trades = session.query(TradeLog).filter(TradeLog.user_id == user_id).count()
        status_str = "RUNNING" if bot.status == BotStatus.RUNNING else "STOPPED"

        return StatusResponse(
            status=status_str,
            current_pnl=bot.current_pnl,
            total_trades_count=total_trades,
            last_log=bot.last_log or "",
        )


# -----------------------------------------------------------------------------
# GET /trades
# -----------------------------------------------------------------------------


@router.get("/trades")
def get_engine_trades(
    user_id: int = Depends(get_current_user_id),
    limit: int = Query(50, ge=1, le=200),
) -> dict:
    """List trades executed by the bot for the dashboard."""
    ensure_user_and_bot(user_id)
    init_db()

    with get_session() as session:
        trades = (
            session.query(TradeLog)
            .filter(TradeLog.user_id == user_id)
            .order_by(TradeLog.executed_at.desc())
            .limit(limit)
            .all()
        )

        return {
            "trades": [
                {
                    "id": t.id,
                    "market_id": t.market_id,
                    "market_question": t.market_question,
                    "side": t.side,
                    "size_usd": t.size_usd,
                    "price": t.price,
                    "ia_probability": t.ia_probability,
                    "confidence": t.confidence,
                    "status": t.status,
                    "pnl": t.pnl,
                    "executed_at": t.executed_at.isoformat() if t.executed_at else None,
                }
                for t in trades
            ],
            "count": len(trades),
        }


# -----------------------------------------------------------------------------
# WebSocket /logs/{user_id}
# -----------------------------------------------------------------------------


@router.websocket("/logs/{user_id}")
async def engine_logs_websocket(websocket: WebSocket, user_id: int) -> None:
    """
    WebSocket for real-time Engine logs.
    Connect: ws://host/api/engine/logs/1
    Receives: {"type": "log", "message": "...", "timestamp": "..."}
    """
    await engine_logs_manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text('{"type": "pong"}')
    except WebSocketDisconnect:
        pass
    finally:
        engine_logs_manager.disconnect(user_id)
