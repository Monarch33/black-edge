"""
Black Edge V2 - WebSocket Multiplexed Stream
=============================================
Real-time streaming for signals, whale alerts, narrative shifts, and risk warnings.

Message Types:
- signal_update: New signal every 10 seconds
- whale_alert: When whale trades
- narrative_shift: When NVI is_accelerating
- risk_warning: When Doomer flags risk

Format: {"type": "signal_update", "data": {...}}
"""

from __future__ import annotations

import asyncio
from dataclasses import asdict
from datetime import datetime
from typing import Set

from fastapi import WebSocket, WebSocketDisconnect
import structlog

logger = structlog.get_logger()


class ConnectionManager:
    """
    Manage WebSocket connections for V2 multiplexed stream.

    Supports broadcasting different message types to all connected clients.
    """

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        """Accept and register a new WebSocket connection."""
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info("WebSocket connected", connection_count=len(self.active_connections))

    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection."""
        self.active_connections.discard(websocket)
        logger.info("WebSocket disconnected", connection_count=len(self.active_connections))

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """Send a message to a specific client."""
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error("Failed to send personal message", error=str(e))

    async def broadcast(self, message: dict):
        """Broadcast a message to all connected clients."""
        disconnected = set()

        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error("Failed to broadcast to client", error=str(e))
                disconnected.add(connection)

        # Clean up disconnected clients
        for conn in disconnected:
            self.disconnect(conn)

    @property
    def connection_count(self) -> int:
        """Get current connection count."""
        return len(self.active_connections)


# Global connection manager
manager = ConnectionManager()


async def websocket_handler_v2(websocket: WebSocket):
    """
    Handle WebSocket connections for V2 multiplexed stream.

    Clients connect to /api/v2/ws and receive real-time updates:
    - signal_update: Every 10 seconds
    - whale_alert: When whales trade
    - narrative_shift: When NVI accelerates
    - risk_warning: When Doomer flags
    """
    await manager.connect(websocket)

    try:
        # Send welcome message
        await manager.send_personal_message(
            {
                "type": "welcome",
                "data": {
                    "message": "Connected to Black Edge V2 stream",
                    "timestamp": datetime.utcnow().isoformat()
                }
            },
            websocket
        )

        # Keep connection alive and handle incoming messages
        while True:
            try:
                # Receive message from client (if any)
                data = await asyncio.wait_for(
                    websocket.receive_json(),
                    timeout=30.0  # 30s timeout
                )

                # Handle ping/pong
                if data.get("type") == "ping":
                    await manager.send_personal_message(
                        {"type": "pong", "timestamp": datetime.utcnow().isoformat()},
                        websocket
                    )

            except asyncio.TimeoutError:
                # Send heartbeat if no activity
                await manager.send_personal_message(
                    {"type": "heartbeat", "timestamp": datetime.utcnow().isoformat()},
                    websocket
                )

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("Client disconnected normally")

    except Exception as e:
        logger.error("WebSocket error", error=str(e))
        manager.disconnect(websocket)


async def broadcast_signal_update(market_id: str, signal_data: dict):
    """
    Broadcast a signal update to all connected clients.

    Args:
        market_id: Market identifier
        signal_data: Signal data dict (from SignalOutput)
    """
    await manager.broadcast({
        "type": "signal_update",
        "data": {
            "market_id": market_id,
            **signal_data,
            "timestamp": datetime.utcnow().isoformat()
        }
    })


async def broadcast_whale_alert(whale_address: str, trade_data: dict):
    """
    Broadcast a whale alert to all connected clients.

    Args:
        whale_address: Whale wallet address
        trade_data: Trade details
    """
    await manager.broadcast({
        "type": "whale_alert",
        "data": {
            "whale_address": whale_address,
            **trade_data,
            "timestamp": datetime.utcnow().isoformat()
        }
    })


async def broadcast_narrative_shift(market_id: str, narrative_data: dict):
    """
    Broadcast a narrative shift alert.

    Args:
        market_id: Market identifier
        narrative_data: Narrative signal data
    """
    await manager.broadcast({
        "type": "narrative_shift",
        "data": {
            "market_id": market_id,
            **narrative_data,
            "timestamp": datetime.utcnow().isoformat()
        }
    })


async def broadcast_risk_warning(warning_type: str, details: dict):
    """
    Broadcast a risk warning from Doomer or RiskManager.

    Args:
        warning_type: Type of warning (drawdown, stop_loss, etc.)
        details: Warning details
    """
    await manager.broadcast({
        "type": "risk_warning",
        "data": {
            "warning_type": warning_type,
            **details,
            "timestamp": datetime.utcnow().isoformat()
        }
    })
