"""
Engine Logs WebSocket Manager
==============================
ConnectionManager for streaming worker logs to the Frontend Terminal.
Maps user_id -> WebSocket for personal message delivery.
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import WebSocket

import structlog

logger = structlog.get_logger()


class EngineLogsManager:
    """
    Manages WebSocket connections for Engine log streaming.
    Each user_id can have one active connection (latest wins).
    """

    def __init__(self) -> None:
        self._connections: dict[int, WebSocket] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, user_id: int) -> None:
        """Accept connection and register for user_id."""
        await websocket.accept()

        async with self._lock:
            # Replace existing connection if any
            old = self._connections.pop(user_id, None)
            if old:
                try:
                    await old.close()
                except Exception:
                    pass
            self._connections[user_id] = websocket

        logger.info("Engine logs WebSocket connected", user_id=user_id)

    def disconnect(self, user_id: int) -> None:
        """Remove connection for user_id."""
        self._connections.pop(user_id, None)
        logger.info("Engine logs WebSocket disconnected", user_id=user_id)

    async def send_personal_message(self, message: str, user_id: int) -> bool:
        """
        Send a log message to a specific user's WebSocket.
        Returns True if sent, False if user not connected.
        """
        ws = self._connections.get(user_id)
        if not ws:
            return False

        try:
            payload = {
                "type": "log",
                "message": message,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            await ws.send_text(json.dumps(payload))
            return True
        except Exception as e:
            logger.warning("Failed to send log to user", user_id=user_id, error=str(e))
            self.disconnect(user_id)
            return False

    def is_connected(self, user_id: int) -> bool:
        """Check if user has an active connection."""
        return user_id in self._connections

    @property
    def connection_count(self) -> int:
        return len(self._connections)


# Singleton instance
engine_logs_manager = EngineLogsManager()
