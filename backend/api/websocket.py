"""
WebSocket API: Real-Time Arbitrage Streaming
=============================================
WebSocket endpoint for streaming arbitrage opportunities.
"""

import asyncio
import json
from datetime import datetime
from typing import Optional
from collections import defaultdict

from fastapi import WebSocket, WebSocketDisconnect
import structlog

from config import get_settings
from models.schemas import (
    User,
    UserTier,
    WebSocketMessage,
    MessageType,
    ArbitrageOpportunityResponse,
    ArbitrageTypeEnum,
    redact_opportunity,
)
from .dependencies import authenticate_websocket

logger = structlog.get_logger()
settings = get_settings()


# =============================================================================
# Connection Manager
# =============================================================================

class ConnectionManager:
    """
    Manages WebSocket connections and message broadcasting.
    """

    def __init__(self):
        # Active connections: uid -> WebSocket
        self._connections: dict[str, WebSocket] = {}
        # User data: uid -> User
        self._users: dict[str, User] = {}
        # Subscriptions: uid -> set of market_ids
        self._subscriptions: dict[str, set[str]] = defaultdict(set)
        # Message sequence counters
        self._sequences: dict[str, int] = defaultdict(int)

    async def connect(
        self,
        websocket: WebSocket,
        user: Optional[User] = None,
    ) -> str:
        """
        Accept a WebSocket connection.

        Returns a connection ID (uid or anonymous ID).
        """
        await websocket.accept()

        if user:
            conn_id = user.uid
            self._users[conn_id] = user
        else:
            conn_id = f"anon_{id(websocket)}"
            # Anonymous users get observer tier
            self._users[conn_id] = User(uid=conn_id, tier=UserTier.OBSERVER)

        self._connections[conn_id] = websocket
        logger.info("WebSocket connected", conn_id=conn_id, tier=self._users[conn_id].tier)
        return conn_id

    def disconnect(self, conn_id: str) -> None:
        """Remove a connection."""
        self._connections.pop(conn_id, None)
        self._users.pop(conn_id, None)
        self._subscriptions.pop(conn_id, None)
        self._sequences.pop(conn_id, None)
        logger.info("WebSocket disconnected", conn_id=conn_id)

    def get_user(self, conn_id: str) -> Optional[User]:
        """Get user for a connection."""
        return self._users.get(conn_id)

    def subscribe(self, conn_id: str, market_ids: list[str]) -> None:
        """Subscribe connection to market updates."""
        self._subscriptions[conn_id].update(market_ids)

    def unsubscribe(self, conn_id: str, market_ids: list[str]) -> None:
        """Unsubscribe connection from market updates."""
        self._subscriptions[conn_id] -= set(market_ids)

    async def send_message(
        self,
        conn_id: str,
        message_type: MessageType,
        payload: dict,
    ) -> bool:
        """
        Send a message to a specific connection.

        Returns True if sent successfully, False otherwise.
        """
        websocket = self._connections.get(conn_id)
        if not websocket:
            return False

        self._sequences[conn_id] += 1

        message = WebSocketMessage(
            type=message_type,
            payload=payload,
            sequence=self._sequences[conn_id],
        )

        try:
            await websocket.send_json(message.model_dump(mode="json"))
            return True
        except Exception as e:
            logger.error("Failed to send message", conn_id=conn_id, error=str(e))
            return False

    async def broadcast_opportunity(
        self,
        opportunity: ArbitrageOpportunityResponse,
    ) -> int:
        """
        Broadcast an arbitrage opportunity to all eligible connections.

        Returns the number of connections notified.
        """
        sent_count = 0

        for conn_id, websocket in list(self._connections.items()):
            user = self._users.get(conn_id)
            if not user:
                continue

            # Check if user is subscribed to any of the markets
            subscriptions = self._subscriptions.get(conn_id, set())
            if subscriptions and not any(
                mid in subscriptions for mid in opportunity.market_ids
            ):
                continue

            # Redact based on tier
            redacted_opp = redact_opportunity(opportunity, user.tier)

            # Skip if fully redacted for this tier
            if user.tier == UserTier.OBSERVER and opportunity.arb_type != ArbitrageTypeEnum.NONE:
                # Observers can see that opportunities exist but not details
                pass
            elif user.tier == UserTier.RUNNER and opportunity.arb_type == ArbitrageTypeEnum.COMBINATORIAL:
                # Runners can't see combinatorial arbitrage details
                redacted_opp.arb_type = ArbitrageTypeEnum.COMBINATORIAL  # Keep type visible
                redacted_opp.is_redacted = True

            success = await self.send_message(
                conn_id,
                MessageType.OPPORTUNITY,
                redacted_opp.model_dump(mode="json"),
            )
            if success:
                sent_count += 1

        return sent_count

    async def send_heartbeat(self) -> None:
        """Send heartbeat to all connections."""
        for conn_id in list(self._connections.keys()):
            await self.send_message(
                conn_id,
                MessageType.HEARTBEAT,
                {"timestamp": datetime.utcnow().isoformat()},
            )

    @property
    def connection_count(self) -> int:
        """Number of active connections."""
        return len(self._connections)

    def get_tier_counts(self) -> dict[str, int]:
        """Get connection counts by tier."""
        counts = defaultdict(int)
        for user in self._users.values():
            counts[user.tier.value] += 1
        return dict(counts)


# Global connection manager instance
manager = ConnectionManager()


# =============================================================================
# WebSocket Handler
# =============================================================================

async def websocket_handler(websocket: WebSocket) -> None:
    """
    Handle a WebSocket connection.

    Protocol:
    1. Client connects (optionally with token in query params)
    2. Client can authenticate later with {"type": "auth", "token": "..."}
    3. Client can subscribe with {"type": "subscribe", "markets": [...]}
    4. Server streams opportunities based on subscription and tier
    """
    # Authenticate if token provided in query params
    token = websocket.query_params.get("token")
    user = await authenticate_websocket(websocket, token) if token else None

    conn_id = await manager.connect(websocket, user)

    try:
        # Send initial status
        await manager.send_message(
            conn_id,
            MessageType.HEARTBEAT,
            {
                "status": "connected",
                "tier": manager.get_user(conn_id).tier.value,
                "authenticated": user is not None,
            },
        )

        # Message handling loop
        while True:
            try:
                data = await websocket.receive_json()
                await handle_client_message(conn_id, data)
            except json.JSONDecodeError:
                await manager.send_message(
                    conn_id,
                    MessageType.ERROR,
                    {"error": "Invalid JSON"},
                )

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("WebSocket error", conn_id=conn_id, error=str(e))
    finally:
        manager.disconnect(conn_id)


async def handle_client_message(conn_id: str, data: dict) -> None:
    """Handle an incoming message from a client."""
    msg_type = data.get("type")

    if msg_type == "auth":
        # Late authentication
        token = data.get("token")
        if token:
            user = await authenticate_websocket(None, token)
            if user:
                manager._users[conn_id] = user
                await manager.send_message(
                    conn_id,
                    MessageType.HEARTBEAT,
                    {"status": "authenticated", "tier": user.tier.value},
                )
            else:
                await manager.send_message(
                    conn_id,
                    MessageType.ERROR,
                    {"error": "Authentication failed"},
                )

    elif msg_type == "subscribe":
        markets = data.get("markets", [])
        if markets:
            manager.subscribe(conn_id, markets)
            await manager.send_message(
                conn_id,
                MessageType.HEARTBEAT,
                {"status": "subscribed", "markets": markets},
            )

    elif msg_type == "unsubscribe":
        markets = data.get("markets", [])
        if markets:
            manager.unsubscribe(conn_id, markets)
            await manager.send_message(
                conn_id,
                MessageType.HEARTBEAT,
                {"status": "unsubscribed", "markets": markets},
            )

    elif msg_type == "ping":
        await manager.send_message(
            conn_id,
            MessageType.HEARTBEAT,
            {"pong": True, "timestamp": datetime.utcnow().isoformat()},
        )

    else:
        await manager.send_message(
            conn_id,
            MessageType.ERROR,
            {"error": f"Unknown message type: {msg_type}"},
        )


# =============================================================================
# Background Tasks
# =============================================================================

async def heartbeat_task(interval: float = 30.0) -> None:
    """Background task to send periodic heartbeats."""
    while True:
        await asyncio.sleep(interval)
        await manager.send_heartbeat()
