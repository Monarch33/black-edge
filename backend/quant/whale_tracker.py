"""
Whale Tracker - Smart Money Flow Detection
Identifies and monitors high-performing traders (whales) on-chain.

Components:
1. SQL schemas for trade tracking and whale identification
2. In-memory watchlist with O(1) lookup
3. Async WebSocket listener for real-time whale alerts
"""

from __future__ import annotations

import json
import asyncio
import logging
import time
from dataclasses import dataclass, asdict
from typing import Optional, Callable
from collections import defaultdict


# ═══════════════════════════════════════════════════════════════════════════
# PARTIE 1 : SQL QUERIES
# ═══════════════════════════════════════════════════════════════════════════

SQL_CREATE_TRADES_TABLE = """
CREATE TABLE IF NOT EXISTS trades (
    tx_hash TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    market_id TEXT NOT NULL,
    outcome_token TEXT NOT NULL,  -- 'YES' or 'NO'
    side TEXT NOT NULL,            -- 'BUY' or 'SELL'
    price REAL NOT NULL,           -- Price paid (0-1 range)
    size_usd REAL NOT NULL,        -- Position size in USD
    timestamp_ms INTEGER NOT NULL,
    resolved_outcome TEXT,         -- 'YES', 'NO', or NULL if unresolved
    resolution_price REAL          -- Final price at resolution (0 or 1)
);

CREATE INDEX IF NOT EXISTS idx_trades_wallet ON trades(wallet_address);
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp_ms);
CREATE INDEX IF NOT EXISTS idx_trades_market ON trades(market_id);
CREATE INDEX IF NOT EXISTS idx_trades_resolved ON trades(resolved_outcome);
"""

SQL_IDENTIFY_WHALES = """
WITH trade_outcomes AS (
    SELECT
        tx_hash,
        wallet_address,
        market_id,
        outcome_token,
        side,
        price,
        size_usd,
        timestamp_ms,
        resolved_outcome,
        resolution_price,
        -- Determine if trade was a winner
        CASE
            WHEN resolved_outcome IS NULL THEN NULL  -- Unresolved
            -- BUY YES + market resolves YES = win
            WHEN side = 'BUY' AND outcome_token = 'YES' AND resolved_outcome = 'YES' THEN 1
            -- BUY NO + market resolves NO = win
            WHEN side = 'BUY' AND outcome_token = 'NO' AND resolved_outcome = 'NO' THEN 1
            -- SELL YES + market resolves NO = win (shorted YES)
            WHEN side = 'SELL' AND outcome_token = 'YES' AND resolved_outcome = 'NO' THEN 1
            -- SELL NO + market resolves YES = win (shorted NO)
            WHEN side = 'SELL' AND outcome_token = 'NO' AND resolved_outcome = 'YES' THEN 1
            ELSE 0
        END AS is_win,
        -- Calculate PnL per trade
        CASE
            WHEN resolved_outcome IS NULL THEN 0  -- Can't calculate yet
            -- BUY: PnL = size * (1/price - 1) if win, else -size
            WHEN side = 'BUY' AND outcome_token = resolved_outcome THEN
                size_usd * (1.0 / price - 1.0)
            WHEN side = 'BUY' AND outcome_token != resolved_outcome THEN
                -size_usd
            -- SELL: PnL = size * (price - resolution_price)
            WHEN side = 'SELL' THEN
                size_usd * (price - resolution_price)
            ELSE 0
        END AS trade_pnl
    FROM trades
    WHERE resolved_outcome IS NOT NULL  -- Only resolved markets for stats
),
wallet_stats AS (
    SELECT
        wallet_address,
        COUNT(*) AS total_trades,
        SUM(CASE WHEN is_win IS NOT NULL THEN 1 ELSE 0 END) AS total_resolved_trades,
        SUM(size_usd) AS total_volume_usd,
        AVG(size_usd) AS avg_trade_size_usd,
        -- Win rate: wins / total_resolved_trades
        CAST(SUM(CASE WHEN is_win = 1 THEN 1 ELSE 0 END) AS REAL) /
            NULLIF(SUM(CASE WHEN is_win IS NOT NULL THEN 1 ELSE 0 END), 0) AS win_rate,
        SUM(trade_pnl) AS total_pnl,
        MAX(timestamp_ms) AS last_active_ms
    FROM trade_outcomes
    GROUP BY wallet_address
),
wallet_returns AS (
    SELECT
        ws.*,
        -- Sharpe ratio approximation: (total_return / avg_trade_size) / sqrt(n_trades)
        -- Higher Sharpe = better risk-adjusted returns
        CASE
            WHEN ws.total_trades > 0 AND ws.avg_trade_size_usd > 0 THEN
                (ws.total_pnl / ws.avg_trade_size_usd) / SQRT(ws.total_trades)
            ELSE 0
        END AS sharpe_ratio
    FROM wallet_stats ws
)
SELECT
    wallet_address,
    total_volume_usd,
    total_trades,
    total_resolved_trades,
    win_rate,
    total_pnl AS pnl_usd,
    sharpe_ratio,
    avg_trade_size_usd,
    last_active_ms
FROM wallet_returns
WHERE total_volume_usd >= %(min_volume_usd)s
  AND win_rate >= %(min_win_rate)s
  AND total_resolved_trades >= 20
ORDER BY sharpe_ratio DESC, pnl_usd DESC
LIMIT %(top_n)s;
"""


# ═══════════════════════════════════════════════════════════════════════════
# PARTIE 2 : WHALE WATCHLIST (IN-MEMORY)
# ═══════════════════════════════════════════════════════════════════════════

@dataclass
class WhaleWallet:
    """
    Whale wallet metadata for high-performing traders.

    Attributes:
        address: Wallet address (checksummed)
        total_volume_usd: Lifetime trading volume
        total_trades: Number of trades
        win_rate: Win rate on resolved trades [0, 1]
        pnl_usd: Total profit/loss in USD
        sharpe_ratio: Risk-adjusted return metric
        avg_trade_size_usd: Average position size
        last_active_ms: Last trade timestamp
        rank: Ranking in watchlist (1 = best)
    """
    address: str
    total_volume_usd: float
    total_trades: int
    win_rate: float
    pnl_usd: float
    sharpe_ratio: float
    avg_trade_size_usd: float
    last_active_ms: int
    rank: int = 0


class WhaleWatchlist:
    """
    In-memory watchlist of high-performing traders (whales).

    Provides O(1) lookup for whale detection and fast querying.
    Can be loaded from SQL query results or persisted to JSON.

    Example:
        >>> watchlist = WhaleWatchlist()
        >>> watchlist.load_from_query_results(rows)
        >>> if watchlist.is_whale("0x123..."):
        ...     whale = watchlist.get("0x123...")
        ...     print(f"Rank #{whale.rank} whale with {whale.win_rate:.1%} WR")
    """

    __slots__ = ('_whales', '_ranked_list')

    def __init__(self):
        """Initialize empty watchlist."""
        self._whales: dict[str, WhaleWallet] = {}
        self._ranked_list: list[WhaleWallet] = []

    def load_from_query_results(self, rows: list[dict]) -> int:
        """
        Load whales from SQL query results.

        Args:
            rows: List of dicts from SQL_IDENTIFY_WHALES query

        Returns:
            Number of whales loaded
        """
        self._whales.clear()
        self._ranked_list.clear()

        for rank, row in enumerate(rows, start=1):
            whale = WhaleWallet(
                address=row['wallet_address'],
                total_volume_usd=row['total_volume_usd'],
                total_trades=row['total_trades'],
                win_rate=row['win_rate'],
                pnl_usd=row['pnl_usd'],
                sharpe_ratio=row['sharpe_ratio'],
                avg_trade_size_usd=row['avg_trade_size_usd'],
                last_active_ms=row['last_active_ms'],
                rank=rank
            )
            self._whales[whale.address.lower()] = whale
            self._ranked_list.append(whale)

        return len(self._whales)

    def load_from_json(self, filepath: str) -> int:
        """
        Load watchlist from JSON file.

        Args:
            filepath: Path to JSON file

        Returns:
            Number of whales loaded
        """
        with open(filepath, 'r') as f:
            data = json.load(f)

        rows = []
        for whale_data in data:
            rows.append({
                'wallet_address': whale_data['address'],
                'total_volume_usd': whale_data['total_volume_usd'],
                'total_trades': whale_data['total_trades'],
                'win_rate': whale_data['win_rate'],
                'pnl_usd': whale_data['pnl_usd'],
                'sharpe_ratio': whale_data['sharpe_ratio'],
                'avg_trade_size_usd': whale_data['avg_trade_size_usd'],
                'last_active_ms': whale_data['last_active_ms'],
            })

        return self.load_from_query_results(rows)

    def save_to_json(self, filepath: str) -> None:
        """
        Save watchlist to JSON file.

        Args:
            filepath: Path to JSON file
        """
        data = [asdict(whale) for whale in self._ranked_list]
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)

    def is_whale(self, address: str) -> bool:
        """
        Check if address is in watchlist (O(1) lookup).

        Args:
            address: Wallet address (case-insensitive)

        Returns:
            True if address is a whale
        """
        return address.lower() in self._whales

    def get(self, address: str) -> Optional[WhaleWallet]:
        """
        Get whale data for address.

        Args:
            address: Wallet address (case-insensitive)

        Returns:
            WhaleWallet if found, None otherwise
        """
        return self._whales.get(address.lower())

    def top_n(self, n: int) -> list[WhaleWallet]:
        """
        Get top N whales by rank.

        Args:
            n: Number of whales to return

        Returns:
            List of WhaleWallet ordered by rank
        """
        return self._ranked_list[:n]

    def __len__(self) -> int:
        """Return number of whales in watchlist."""
        return len(self._whales)

    def __repr__(self) -> str:
        return f"WhaleWatchlist(size={len(self._whales)})"


# ═══════════════════════════════════════════════════════════════════════════
# PARTIE 3 : WHALE ALERT LISTENER (ASYNC WEBSOCKET)
# ═══════════════════════════════════════════════════════════════════════════

@dataclass
class WhaleAlert:
    """
    Alert triggered when a whale executes a trade.

    Attributes:
        whale: WhaleWallet that triggered alert
        tx_hash: Transaction hash
        market_id: Market being traded
        side: 'BUY' or 'SELL'
        size_usd: Trade size in USD
        timestamp_ms: When trade occurred
    """
    whale: WhaleWallet
    tx_hash: str
    market_id: str
    side: str
    size_usd: float
    timestamp_ms: int


class WhaleAlertListener:
    """
    Async WebSocket listener for on-chain whale activity.

    Monitors CTF Exchange events and triggers alerts when whales trade.
    Includes automatic reconnection and cooldown anti-spam.

    Example:
        >>> def handle_alert(alert: WhaleAlert):
        ...     print(f"🐋 Whale #{alert.whale.rank} traded ${alert.size_usd:,.0f}")
        >>>
        >>> listener = WhaleAlertListener(watchlist, ws_url, ctf_address, handle_alert)
        >>> await listener.start()
    """

    __slots__ = (
        'watchlist',
        'ws_url',
        'ctf_exchange_address',
        'on_alert',
        '_cooldowns',
        '_cooldown_seconds',
        '_logger',
    )

    def __init__(
        self,
        watchlist: WhaleWatchlist,
        ws_url: str,
        ctf_exchange_address: str,
        on_alert: Callable[[WhaleAlert], None]
    ):
        """
        Initialize whale alert listener.

        Args:
            watchlist: WhaleWatchlist to check against
            ws_url: WebSocket URL (e.g., Alchemy/QuickNode)
            ctf_exchange_address: CTF Exchange contract address
            on_alert: Callback function for alerts
        """
        self.watchlist = watchlist
        self.ws_url = ws_url
        self.ctf_exchange_address = ctf_exchange_address.lower()
        self.on_alert = on_alert

        # Cooldown tracking: {address: last_alert_timestamp}
        self._cooldowns: dict[str, float] = {}
        self._cooldown_seconds = 60  # 60s cooldown per whale

        self._logger = logging.getLogger(__name__)
        self._logger.setLevel(logging.INFO)

    async def start(self) -> None:
        """
        Start listening with infinite reconnection loop.

        Never returns. Reconnects automatically on disconnect.
        """
        reconnect_delay = 1.0
        max_reconnect_delay = 60.0

        while True:
            try:
                self._logger.info(f"Connecting to WebSocket: {self.ws_url[:50]}...")

                # NOTE: This is a placeholder - actual WebSocket connection
                # would use websockets library or web3.py AsyncHTTPProvider
                async with self._connect_websocket() as ws:
                    self._logger.info("✓ Connected. Subscribing to CTF Exchange logs...")

                    await self._subscribe(ws)
                    await self._listen(ws)

            except Exception as e:
                self._logger.error(f"WebSocket error: {e}")
                self._logger.info(f"Reconnecting in {reconnect_delay:.1f}s...")

                await asyncio.sleep(reconnect_delay)
                reconnect_delay = min(reconnect_delay * 2, max_reconnect_delay)
            else:
                # Clean disconnect, reset delay
                reconnect_delay = 1.0

    async def _connect_websocket(self):
        """
        Connect to WebSocket provider.

        NOTE: This is a placeholder. In production, use:
        - websockets library: `await websockets.connect(self.ws_url)`
        - web3.py: Web3.AsyncHTTPProvider or custom WebSocketProvider
        """
        # Placeholder context manager for testing
        class DummyWebSocket:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                pass

            async def send(self, data):
                pass

            async def recv(self):
                await asyncio.sleep(0.1)  # Simulate network delay
                return '{"result": "0x123"}'  # Dummy response

        return DummyWebSocket()

    async def _subscribe(self, ws) -> None:
        """
        Subscribe to CTF Exchange Transfer/OrderFilled events.

        Args:
            ws: WebSocket connection
        """
        # Subscribe to logs from CTF Exchange
        subscription = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "eth_subscribe",
            "params": [
                "logs",
                {
                    "address": self.ctf_exchange_address,
                    "topics": []  # All events
                }
            ]
        }

        await ws.send(json.dumps(subscription))
        self._logger.info(f"Subscribed to logs from {self.ctf_exchange_address[:10]}...")

    async def _listen(self, ws) -> None:
        """
        Listen for events and check for whale activity.

        Args:
            ws: WebSocket connection
        """
        while True:
            message = await ws.recv()
            data = json.loads(message)

            # Parse log event
            if 'params' in data and 'result' in data['params']:
                log = data['params']['result']
                await self._process_log(log)

    async def _process_log(self, log: dict) -> None:
        """
        Process a single log event.

        Args:
            log: Parsed log data from WebSocket
        """
        # Extract addresses from topics (first topic is event signature)
        # Topics are indexed parameters
        topics = log.get('topics', [])
        if len(topics) < 2:
            return

        # Typically:
        # topics[0] = event signature hash (keccak256 of event signature)
        # topics[1] = from address (if indexed)
        # topics[2] = to address (if indexed)

        # Extract addresses (last 20 bytes of topic)
        addresses_to_check = []
        for topic in topics[1:]:  # Skip event signature
            if topic and len(topic) >= 42:
                address = '0x' + topic[-40:]  # Last 20 bytes = 40 hex chars
                addresses_to_check.append(address.lower())

        # Check if any address is a whale
        for address in addresses_to_check:
            if self.watchlist.is_whale(address):
                if not self._is_on_cooldown(address):
                    whale = self.watchlist.get(address)

                    # Create alert (simplified - in production parse full event data)
                    alert = WhaleAlert(
                        whale=whale,
                        tx_hash=log.get('transactionHash', '0x?'),
                        market_id=log.get('address', 'unknown'),
                        side='BUY',  # Would parse from event data
                        size_usd=10000.0,  # Would parse from event data
                        timestamp_ms=int(time.time() * 1000)
                    )

                    # Log alert
                    self._logger.warning(
                        f"🐋 WHALE ALERT: Rank #{whale.rank} "
                        f"({whale.win_rate*100:.1f}% WR) "
                        f"{alert.side} ${alert.size_usd:,.0f} on market {alert.market_id[:15]}..."
                    )

                    # Trigger callback
                    try:
                        self.on_alert(alert)
                    except Exception as e:
                        self._logger.error(f"Alert callback error: {e}")

                    # Set cooldown
                    self._cooldowns[address] = time.time()

    def _is_on_cooldown(self, address: str) -> bool:
        """
        Check if address is on cooldown (60s anti-spam).

        Args:
            address: Wallet address

        Returns:
            True if on cooldown
        """
        last_alert = self._cooldowns.get(address)
        if last_alert is None:
            return False

        elapsed = time.time() - last_alert
        return elapsed < self._cooldown_seconds

    def __repr__(self) -> str:
        return f"WhaleAlertListener(watchlist_size={len(self.watchlist)})"
