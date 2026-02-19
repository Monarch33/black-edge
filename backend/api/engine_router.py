"""
Engine API — The Invisible Engine
=================================
Endpoints for the Frontend Dashboard.
POST /keys, POST /toggle, GET /status
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

import structlog

from api.websocket_manager import engine_logs_manager
from db.credentials import get_polymarket_credentials_decrypted, save_polymarket_credentials
from db.models import BotInstance, BotStatus, TradeLog, User, UserTier, init_db
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


class KeysRequest(BaseModel):
    """Request body for storing Polymarket keys."""

    proxy_key: str = Field(..., min_length=1, description="Polymarket proxy key")
    secret: str = Field(..., min_length=1, description="Polymarket secret")


class KeysResponse(BaseModel):
    """Response after storing keys."""

    status: str = "success"
    message: str = "Polymarket keys stored securely"


class ToggleResponse(BaseModel):
    """Response after toggling bot."""

    status: str = Field(..., description="RUNNING or STOPPED")
    message: str


class StatusResponse(BaseModel):
    """Dashboard status for Frontend."""

    status: str = Field(..., description="RUNNING or STOPPED")
    current_pnl: float = Field(0.0, description="Current P&L")
    total_trades_count: int = Field(0, description="Total trades executed")
    last_log: str = Field("", description="Last status message (e.g. Scanning Polymarket...)")


# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------


@router.post("/keys", response_model=KeysResponse)
def store_polymarket_keys(
    request: KeysRequest,
    user_id: int = Depends(get_current_user_id),
) -> KeysResponse:
    """
    Store Polymarket API keys (encrypted via Fernet).
    """
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


@router.post("/toggle", response_model=ToggleResponse)
def toggle_bot(
    user_id: int = Depends(get_current_user_id),
) -> ToggleResponse:
    """
    Toggle bot status: IDLE <-> RUNNING.
    """
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


@router.get("/status", response_model=StatusResponse)
def get_engine_status(
    user_id: int = Depends(get_current_user_id),
) -> StatusResponse:
    """
    Dashboard status: status, current_pnl, total_trades_count, last_log.
    """
    ensure_user_and_bot(user_id)
    init_db()

    with get_session() as session:
        bot = session.query(BotInstance).filter(BotInstance.user_id == user_id).first()
        if not bot:
            return StatusResponse(
                status="STOPPED",
                current_pnl=0.0,
                total_trades_count=0,
                last_log="",
            )

        total_trades = session.query(TradeLog).filter(TradeLog.user_id == user_id).count()

        status_str = "RUNNING" if bot.status == BotStatus.RUNNING else "STOPPED"

        return StatusResponse(
            status=status_str,
            current_pnl=bot.current_pnl,
            total_trades_count=total_trades,
            last_log=bot.last_log or "",
        )


@router.get("/trades")
def get_engine_trades(
    user_id: int = Depends(get_current_user_id),
    limit: int = Query(50, ge=1, le=200),
) -> dict:
    """
    List trades executed by the bot for the dashboard.
    """
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
            # Keep connection alive, optional: receive pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text('{"type": "pong"}')
    except WebSocketDisconnect:
        pass
    finally:
        engine_logs_manager.disconnect(user_id)
