"""
WebSocket V2: Dual-Client Signal Streaming with Credit Management
==================================================================
Enhanced WebSocket endpoint with:
- API key authentication
- Credit deduction per signal
- Support for both Web Terminal and CLI clients
"""

import asyncio
import json
from datetime import datetime
from typing import Optional, Dict, Set
from fastapi import WebSocket, WebSocketDisconnect, Query
import structlog

# Import will be added to main.py
try:
    from models.user import user_db, User
except ImportError:
    user_db = None
    User = None

logger = structlog.get_logger()


# =============================================================================
# Connection Manager V2
# =============================================================================

class ConnectionManagerV2:
    """
    Enhanced connection manager with credit-based access control.
    """

    def __init__(self):
        # Active connections: conn_id -> WebSocket
        self._connections: Dict[str, WebSocket] = {}
        # User data: conn_id -> User
        self._users: Dict[str, User] = {}
        # Message sequence counters
        self._sequences: Dict[str, int] = {}
        # Client types: conn_id -> "web" | "cli"
        self._client_types: Dict[str, str] = {}

    async def connect(
        self,
        websocket: WebSocket,
        api_key: str,
        client_type: str = "web"
    ) -> tuple[str, Optional[User]]:
        """
        Accept and authenticate a WebSocket connection.

        Returns (conn_id, user) on success.
        Raises exception if authentication fails.
        """
        if not user_db:
            await websocket.close(code=5000, reason="User database not initialized")
            raise ValueError("User database not initialized")

        # Validate API key
        user = user_db.get_user_by_api_key(api_key)
        if not user:
            await websocket.close(code=4001, reason="Invalid API key")
            raise ValueError("Invalid API key")

        # Check if user has credits
        if user.credits <= 0:
            await websocket.close(code=4002, reason="Insufficient credits")
            raise ValueError("Insufficient credits")

        # Accept connection
        await websocket.accept()

        conn_id = f"{user.id}_{id(websocket)}"
        self._connections[conn_id] = websocket
        self._users[conn_id] = user
        self._sequences[conn_id] = 0
        self._client_types[conn_id] = client_type

        logger.info(
            "WebSocket V2 connected",
            conn_id=conn_id,
            user_id=user.id,
            tier=user.tier,
            credits=user.credits,
            client_type=client_type
        )

        # Send welcome message
        await self.send_message(conn_id, {
            "type": "welcome",
            "user_id": user.id,
            "tier": user.tier,
            "credits": user.credits,
            "max_credits": user.max_credits,
            "client_type": client_type,
            "message": f"Connected to Black Edge via {client_type.upper()}"
        })

        return conn_id, user

    def disconnect(self, conn_id: str) -> None:
        """Remove a connection."""
        user = self._users.get(conn_id)
        if user:
            logger.info("WebSocket V2 disconnected", conn_id=conn_id, user_id=user.id)

        self._connections.pop(conn_id, None)
        self._users.pop(conn_id, None)
        self._sequences.pop(conn_id, None)
        self._client_types.pop(conn_id, None)

    def get_user(self, conn_id: str) -> Optional[User]:
        """Get user for a connection."""
        return self._users.get(conn_id)

    async def send_message(self, conn_id: str, payload: dict) -> bool:
        """
        Send a message to a specific connection.
        Returns True if sent successfully.
        """
        websocket = self._connections.get(conn_id)
        if not websocket:
            return False

        self._sequences[conn_id] += 1
        message = {
            **payload,
            "sequence": self._sequences[conn_id],
            "timestamp": datetime.utcnow().isoformat()
        }

        try:
            await websocket.send_json(message)
            return True
        except Exception as e:
            logger.error("Failed to send message", conn_id=conn_id, error=str(e))
            return False

    async def broadcast_signal(
        self,
        signal: dict,
        deduct_credits: bool = True
    ) -> int:
        """
        Broadcast a trading signal to all connected users.
        Deducts 1 credit per signal if deduct_credits=True.

        Returns the number of users who received the signal.
        """
        sent_count = 0

        for conn_id in list(self._connections.keys()):
            user = self._users.get(conn_id)
            if not user:
                continue

            # Check credits before sending
            if user.credits <= 0:
                await self.send_message(conn_id, {
                    "type": "error",
                    "code": "INSUFFICIENT_CREDITS",
                    "message": "You have run out of API credits. Purchase more to continue receiving signals.",
                    "credits_remaining": 0
                })
                continue

            # Deduct credit
            if deduct_credits:
                success = user_db.deduct_credits(
                    user_id=user.id,
                    amount=1,
                    signal_id=signal.get("id"),
                    market_slug=signal.get("market")
                )

                if not success:
                    # User ran out of credits mid-session
                    await self.send_message(conn_id, {
                        "type": "error",
                        "code": "INSUFFICIENT_CREDITS",
                        "message": "You have run out of API credits.",
                        "credits_remaining": 0
                    })
                    continue

            # Send signal
            success = await self.send_message(conn_id, {
                "type": "signal",
                "data": signal,
                "credits_remaining": user.credits
            })

            if success:
                sent_count += 1

                logger.info(
                    "Signal sent",
                    conn_id=conn_id,
                    user_id=user.id,
                    signal_id=signal.get("id"),
                    credits_remaining=user.credits
                )

        return sent_count

    async def send_heartbeat(self) -> None:
        """Send heartbeat to all connections."""
        for conn_id in list(self._connections.keys()):
            user = self._users.get(conn_id)
            if user:
                await self.send_message(conn_id, {
                    "type": "heartbeat",
                    "credits": user.credits,
                    "signals_today": user.signals_generated
                })

    @property
    def connection_count(self) -> int:
        """Number of active connections."""
        return len(self._connections)

    def get_stats(self) -> dict:
        """Get connection statistics."""
        web_count = sum(1 for ct in self._client_types.values() if ct == "web")
        cli_count = sum(1 for ct in self._client_types.values() if ct == "cli")

        tier_counts = {}
        for user in self._users.values():
            tier_counts[user.tier] = tier_counts.get(user.tier, 0) + 1

        return {
            "total_connections": self.connection_count,
            "web_clients": web_count,
            "cli_clients": cli_count,
            "tiers": tier_counts
        }


# Global manager instance
manager_v2 = ConnectionManagerV2()


# =============================================================================
# WebSocket Handler
# =============================================================================

async def websocket_handler_v2(
    websocket: WebSocket,
    api_key: str = Query(..., description="Black Edge API Key"),
    client_type: str = Query("web", description="Client type: web or cli")
):
    """
    WebSocket endpoint for real-time signal streaming.

    Query Parameters:
    - api_key: Black Edge API key (be_live_***)
    - client_type: "web" (browser terminal) or "cli" (local terminal)

    Example connections:
    - Web:  ws://localhost:8000/ws/v2/stream?api_key=be_live_xxx&client_type=web
    - CLI:  ws://localhost:8000/ws/v2/stream?api_key=be_live_xxx&client_type=cli
    """
    conn_id = None

    try:
        # Authenticate and connect
        conn_id, user = await manager_v2.connect(websocket, api_key, client_type)

        # Main message loop
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)

                # Handle client messages
                if message.get("type") == "ping":
                    await manager_v2.send_message(conn_id, {"type": "pong"})

                elif message.get("type") == "get_balance":
                    await manager_v2.send_message(conn_id, {
                        "type": "balance",
                        "credits": user.credits,
                        "max_credits": user.max_credits,
                        "percentage": round((user.credits / user.max_credits) * 100, 1)
                    })

                elif message.get("type") == "get_stats":
                    await manager_v2.send_message(conn_id, {
                        "type": "stats",
                        "signals_today": user.signals_generated,
                        "signals_lifetime": user.total_signals_lifetime,
                        "tier": user.tier
                    })

            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                if conn_id:
                    await manager_v2.send_message(conn_id, {
                        "type": "error",
                        "message": "Invalid JSON"
                    })
            except Exception as e:
                logger.error("WebSocket error", conn_id=conn_id, error=str(e))
                break

    except ValueError as e:
        # Authentication failed (already closed in connect())
        logger.warning("WebSocket auth failed", error=str(e))

    except Exception as e:
        logger.error("WebSocket handler error", error=str(e))

    finally:
        if conn_id:
            manager_v2.disconnect(conn_id)


# =============================================================================
# Background Heartbeat Task
# =============================================================================

async def heartbeat_task_v2():
    """Send periodic heartbeats to all connections."""
    while True:
        await asyncio.sleep(30)  # Every 30 seconds
        try:
            await manager_v2.send_heartbeat()
        except Exception as e:
            logger.error("Heartbeat task error", error=str(e))
