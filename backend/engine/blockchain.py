"""
Blockchain Module: Polygon RPC & Event Decoding
================================================
Real-time interaction with Polymarket smart contracts on Polygon.

This module decodes events from:
- CTF Exchange (binary markets)
- NegRisk Adapter (multi-outcome markets)
- Conditional Token Contract (token operations)
"""

import asyncio
import json
from dataclasses import dataclass, field
from typing import AsyncIterator, Optional, Callable, Any
from collections import defaultdict
from decimal import Decimal
import time

import numpy as np
from numpy.typing import NDArray
from web3 import AsyncWeb3, Web3
from web3.providers import AsyncHTTPProvider
from web3.contract import AsyncContract
from web3.types import LogReceipt, HexBytes
import structlog

from config import get_settings

logger = structlog.get_logger()
settings = get_settings()


# =============================================================================
# ABI Definitions
# =============================================================================

# Minimal ABIs for event decoding - only include what we need

ORDER_FILLED_ABI = {
    "anonymous": False,
    "inputs": [
        {"indexed": True, "name": "orderHash", "type": "bytes32"},
        {"indexed": True, "name": "maker", "type": "address"},
        {"indexed": True, "name": "taker", "type": "address"},
        {"indexed": False, "name": "makerAssetId", "type": "uint256"},
        {"indexed": False, "name": "takerAssetId", "type": "uint256"},
        {"indexed": False, "name": "makerAmountFilled", "type": "uint256"},
        {"indexed": False, "name": "takerAmountFilled", "type": "uint256"},
        {"indexed": False, "name": "fee", "type": "uint256"},
    ],
    "name": "OrderFilled",
    "type": "event",
}

ORDERS_MATCHED_ABI = {
    "anonymous": False,
    "inputs": [
        {"indexed": True, "name": "takerOrderHash", "type": "bytes32"},
        {"indexed": True, "name": "makerOrderHash", "type": "bytes32"},
        {"indexed": False, "name": "takerAssetId", "type": "uint256"},
        {"indexed": False, "name": "makerAssetId", "type": "uint256"},
        {"indexed": False, "name": "takerAmountFilled", "type": "uint256"},
        {"indexed": False, "name": "makerAmountFilled", "type": "uint256"},
    ],
    "name": "OrdersMatched",
    "type": "event",
}

POSITION_SPLIT_ABI = {
    "anonymous": False,
    "inputs": [
        {"indexed": True, "name": "stakeholder", "type": "address"},
        {"indexed": False, "name": "collateralToken", "type": "address"},
        {"indexed": True, "name": "parentCollectionId", "type": "bytes32"},
        {"indexed": True, "name": "conditionId", "type": "bytes32"},
        {"indexed": False, "name": "partition", "type": "uint256[]"},
        {"indexed": False, "name": "amount", "type": "uint256"},
    ],
    "name": "PositionSplit",
    "type": "event",
}

POSITIONS_MERGE_ABI = {
    "anonymous": False,
    "inputs": [
        {"indexed": True, "name": "stakeholder", "type": "address"},
        {"indexed": False, "name": "collateralToken", "type": "address"},
        {"indexed": True, "name": "parentCollectionId", "type": "bytes32"},
        {"indexed": True, "name": "conditionId", "type": "bytes32"},
        {"indexed": False, "name": "partition", "type": "uint256[]"},
        {"indexed": False, "name": "amount", "type": "uint256"},
    ],
    "name": "PositionsMerge",
    "type": "event",
}

POSITIONS_CONVERTED_ABI = {
    "anonymous": False,
    "inputs": [
        {"indexed": True, "name": "stakeholder", "type": "address"},
        {"indexed": True, "name": "marketId", "type": "bytes32"},
        {"indexed": True, "name": "indexSet", "type": "uint256"},
        {"indexed": False, "name": "amount", "type": "uint256"},
    ],
    "name": "PositionsConverted",
    "type": "event",
}

# Combined ABI for contract interaction
CONDITIONAL_TOKEN_ABI = [
    ORDER_FILLED_ABI,
    ORDERS_MATCHED_ABI,
    POSITION_SPLIT_ABI,
    POSITIONS_MERGE_ABI,
]

NEG_RISK_ADAPTER_ABI = [
    POSITIONS_CONVERTED_ABI,
]


# =============================================================================
# Data Classes
# =============================================================================

@dataclass
class OrderFilledEvent:
    """Decoded OrderFilled event from CTF Exchange."""
    order_hash: str
    maker: str
    taker: str
    maker_asset_id: int  # Token ID
    taker_asset_id: int  # Token ID
    maker_amount: int  # Amount in wei
    taker_amount: int  # Amount in wei
    fee: int
    block_number: int
    transaction_hash: str
    timestamp: float = field(default_factory=time.time)

    @property
    def price(self) -> float:
        """Calculate the price of the trade (taker pays / maker receives)."""
        if self.maker_amount == 0:
            return 0.0
        # Price = USDC amount / token amount
        # Assuming one side is USDC (6 decimals) and other is tokens (6 decimals)
        return self.taker_amount / self.maker_amount


@dataclass
class PositionsConvertedEvent:
    """
    Decoded PositionsConverted event from NegRisk Adapter.

    The indexSet is a bitmask indicating which NO tokens are converted:
    - If bit i is 1: NO token for outcome i is input
    - Output: YES tokens for outcomes where bit is 0
    """
    stakeholder: str
    market_id: str
    index_set: int  # Bitmask
    amount: int
    block_number: int
    transaction_hash: str
    timestamp: float = field(default_factory=time.time)

    def decode_index_set(self, num_outcomes: int) -> dict[int, str]:
        """
        Decode the indexSet bitmask to determine token conversions.

        Args:
            num_outcomes: Total number of outcomes in the market

        Returns:
            Dict mapping outcome index to "INPUT_NO" or "OUTPUT_YES"
        """
        result = {}
        for i in range(num_outcomes):
            if (self.index_set >> i) & 1:
                result[i] = "INPUT_NO"
            else:
                result[i] = "OUTPUT_YES"
        return result


@dataclass
class VWAPData:
    """Volume-Weighted Average Price data for a token."""
    token_id: str
    vwap: float
    total_volume: float
    trade_count: int
    last_price: float
    last_block: int
    last_update: float = field(default_factory=time.time)


@dataclass
class MarketPriceState:
    """Current price state for a market."""
    market_id: str
    condition_id: str
    yes_price: float
    no_price: float
    yes_volume: float
    no_volume: float
    last_block: int
    last_update: float = field(default_factory=time.time)


# =============================================================================
# Blockchain Client
# =============================================================================

class PolygonClient:
    """
    Async client for interacting with Polygon blockchain.

    Handles WebSocket connections for real-time event streaming
    and RPC calls for historical data.
    """

    def __init__(
        self,
        rpc_url: str = settings.polygon_rpc_url,
        ws_url: str = settings.polygon_ws_url,
    ):
        self.rpc_url = rpc_url
        self.ws_url = ws_url
        self._web3: Optional[AsyncWeb3] = None
        self._ws_web3: Optional[AsyncWeb3] = None
        self._contracts: dict[str, AsyncContract] = {}

    async def connect(self) -> None:
        """Establish connections to Polygon RPC and WebSocket."""
        # HTTP connection for queries
        self._web3 = AsyncWeb3(AsyncWeb3.AsyncHTTPProvider(self.rpc_url))

        # Check connection
        connected = await self._web3.is_connected()
        if not connected:
            raise ConnectionError(f"Failed to connect to Polygon RPC: {self.rpc_url}")

        logger.info("Connected to Polygon RPC", url=self.rpc_url)

        # Initialize contracts
        await self._init_contracts()

    async def _init_contracts(self) -> None:
        """Initialize contract instances for event decoding."""
        if not self._web3:
            raise RuntimeError("Web3 not connected")

        # Conditional Token Contract (for OrderFilled, PositionSplit, etc.)
        self._contracts["conditional_token"] = self._web3.eth.contract(
            address=Web3.to_checksum_address(settings.conditional_token_address),
            abi=CONDITIONAL_TOKEN_ABI,
        )

        # NegRisk Adapter (for PositionsConverted)
        self._contracts["neg_risk_adapter"] = self._web3.eth.contract(
            address=Web3.to_checksum_address(settings.neg_risk_adapter_address),
            abi=NEG_RISK_ADAPTER_ABI,
        )

        # CTF Exchange
        self._contracts["ctf_exchange"] = self._web3.eth.contract(
            address=Web3.to_checksum_address(settings.ctf_exchange_address),
            abi=CONDITIONAL_TOKEN_ABI,
        )

        logger.info("Contracts initialized")

    async def get_latest_block(self) -> int:
        """Get the latest block number."""
        if not self._web3:
            raise RuntimeError("Web3 not connected")
        return await self._web3.eth.block_number

    async def get_block_timestamp(self, block_number: int) -> int:
        """Get timestamp for a specific block."""
        if not self._web3:
            raise RuntimeError("Web3 not connected")
        block = await self._web3.eth.get_block(block_number)
        return block["timestamp"]

    async def stream_events(
        self,
        from_block: int,
        event_filter: Optional[dict] = None,
    ) -> AsyncIterator[LogReceipt]:
        """
        Stream events from the blockchain starting at from_block.

        Args:
            from_block: Starting block number
            event_filter: Optional filter for specific events

        Yields:
            LogReceipt objects for each event
        """
        if not self._web3:
            raise RuntimeError("Web3 not connected")

        current_block = from_block

        while True:
            latest_block = await self.get_latest_block()

            if current_block <= latest_block:
                # Fetch logs in batches to avoid RPC limits
                batch_size = 1000
                to_block = min(current_block + batch_size, latest_block)

                try:
                    logs = await self._web3.eth.get_logs({
                        "fromBlock": current_block,
                        "toBlock": to_block,
                        "address": [
                            settings.conditional_token_address,
                            settings.ctf_exchange_address,
                            settings.neg_risk_adapter_address,
                        ],
                        **(event_filter or {}),
                    })

                    for log in logs:
                        yield log

                    current_block = to_block + 1

                except Exception as e:
                    logger.error("Error fetching logs", error=str(e))
                    await asyncio.sleep(1)
            else:
                # Wait for new blocks
                await asyncio.sleep(2)  # Polygon block time ~2s

    async def disconnect(self) -> None:
        """Close connections."""
        self._web3 = None
        self._ws_web3 = None
        logger.info("Disconnected from Polygon")


# =============================================================================
# Event Decoder
# =============================================================================

class EventDecoder:
    """
    Decodes raw blockchain events into typed data structures.

    Handles the complexity of decoding different event types from
    various Polymarket contracts.
    """

    # Event signatures (keccak256 of event signature)
    ORDER_FILLED_TOPIC = Web3.keccak(text="OrderFilled(bytes32,address,address,uint256,uint256,uint256,uint256,uint256)")
    ORDERS_MATCHED_TOPIC = Web3.keccak(text="OrdersMatched(bytes32,bytes32,uint256,uint256,uint256,uint256)")
    POSITION_SPLIT_TOPIC = Web3.keccak(text="PositionSplit(address,address,bytes32,bytes32,uint256[],uint256)")
    POSITIONS_MERGE_TOPIC = Web3.keccak(text="PositionsMerge(address,address,bytes32,bytes32,uint256[],uint256)")
    POSITIONS_CONVERTED_TOPIC = Web3.keccak(text="PositionsConverted(address,bytes32,uint256,uint256)")

    def __init__(self):
        self._web3 = Web3()  # For decoding utilities

    def decode_event(self, log: LogReceipt) -> Optional[OrderFilledEvent | PositionsConvertedEvent]:
        """
        Decode a log receipt into a typed event.

        Args:
            log: Raw log receipt from the blockchain

        Returns:
            Typed event object or None if unrecognized
        """
        if not log.get("topics"):
            return None

        topic0 = log["topics"][0]

        if topic0 == self.ORDER_FILLED_TOPIC:
            return self._decode_order_filled(log)
        elif topic0 == self.POSITIONS_CONVERTED_TOPIC:
            return self._decode_positions_converted(log)

        return None

    def _decode_order_filled(self, log: LogReceipt) -> Optional[OrderFilledEvent]:
        """Decode an OrderFilled event."""
        try:
            topics = log["topics"]
            data = log["data"]

            # Indexed parameters are in topics
            order_hash = topics[1].hex() if isinstance(topics[1], (bytes, HexBytes)) else topics[1]
            maker = self._decode_address(topics[2])
            taker = self._decode_address(topics[3])

            # Non-indexed parameters are in data
            decoded_data = self._web3.codec.decode(
                ["uint256", "uint256", "uint256", "uint256", "uint256"],
                data if isinstance(data, bytes) else bytes.fromhex(data[2:])
            )

            return OrderFilledEvent(
                order_hash=order_hash,
                maker=maker,
                taker=taker,
                maker_asset_id=decoded_data[0],
                taker_asset_id=decoded_data[1],
                maker_amount=decoded_data[2],
                taker_amount=decoded_data[3],
                fee=decoded_data[4],
                block_number=log["blockNumber"],
                transaction_hash=log["transactionHash"].hex() if isinstance(log["transactionHash"], (bytes, HexBytes)) else log["transactionHash"],
            )
        except Exception as e:
            logger.error("Failed to decode OrderFilled", error=str(e))
            return None

    def _decode_positions_converted(self, log: LogReceipt) -> Optional[PositionsConvertedEvent]:
        """
        Decode a PositionsConverted event from NegRisk Adapter.

        CRITICAL: The indexSet is a bitmask where:
        - Bit i = 1 means NO token for outcome i is INPUT
        - Output is YES tokens for indices where bit = 0
        """
        try:
            topics = log["topics"]
            data = log["data"]

            stakeholder = self._decode_address(topics[1])
            market_id = topics[2].hex() if isinstance(topics[2], (bytes, HexBytes)) else topics[2]
            index_set = int(topics[3].hex() if isinstance(topics[3], (bytes, HexBytes)) else topics[3], 16)

            # Amount is in data
            decoded_data = self._web3.codec.decode(
                ["uint256"],
                data if isinstance(data, bytes) else bytes.fromhex(data[2:])
            )

            return PositionsConvertedEvent(
                stakeholder=stakeholder,
                market_id=market_id,
                index_set=index_set,
                amount=decoded_data[0],
                block_number=log["blockNumber"],
                transaction_hash=log["transactionHash"].hex() if isinstance(log["transactionHash"], (bytes, HexBytes)) else log["transactionHash"],
            )
        except Exception as e:
            logger.error("Failed to decode PositionsConverted", error=str(e))
            return None

    def _decode_address(self, topic: bytes | HexBytes | str) -> str:
        """Decode an address from a 32-byte topic."""
        if isinstance(topic, (bytes, HexBytes)):
            hex_str = topic.hex()
        else:
            hex_str = topic

        # Address is right-padded in 32-byte topic
        return Web3.to_checksum_address("0x" + hex_str[-40:])


# =============================================================================
# VWAP Calculator
# =============================================================================

class VWAPCalculator:
    """
    Calculates Volume-Weighted Average Price for tokens.

    Maintains a sliding window of trades and computes VWAP
    over configurable block ranges.
    """

    def __init__(
        self,
        block_window: int = settings.vwap_block_window,
        carry_forward_blocks: int = settings.price_carry_forward_blocks,
    ):
        self.block_window = block_window
        self.carry_forward_blocks = carry_forward_blocks

        # Trade history: token_id -> list of (block, price, volume)
        self._trades: dict[str, list[tuple[int, float, float]]] = defaultdict(list)

        # Last known VWAP: token_id -> VWAPData
        self._vwap_cache: dict[str, VWAPData] = {}

    def add_trade(
        self,
        token_id: str,
        price: float,
        volume: float,
        block_number: int,
    ) -> None:
        """
        Record a new trade for VWAP calculation.

        Args:
            token_id: The token identifier
            price: Trade price
            volume: Trade volume (token amount)
            block_number: Block number of the trade
        """
        self._trades[token_id].append((block_number, price, volume))

        # Prune old trades outside the analysis window
        cutoff = block_number - settings.risk_analysis_window
        self._trades[token_id] = [
            t for t in self._trades[token_id] if t[0] >= cutoff
        ]

    def get_vwap(
        self,
        token_id: str,
        current_block: int,
        window: Optional[int] = None,
    ) -> Optional[VWAPData]:
        """
        Calculate VWAP for a token over the specified window.

        Args:
            token_id: The token identifier
            current_block: Current block number
            window: Block window for VWAP (default: self.block_window)

        Returns:
            VWAPData or None if no trades in window
        """
        if window is None:
            window = self.block_window

        trades = self._trades.get(token_id, [])
        if not trades:
            # Check cache for carry-forward
            cached = self._vwap_cache.get(token_id)
            if cached and (current_block - cached.last_block) <= self.carry_forward_blocks:
                return cached
            return None

        # Filter trades within window
        cutoff = current_block - window
        recent_trades = [(b, p, v) for b, p, v in trades if b >= cutoff]

        if not recent_trades:
            # Use last known price if within carry-forward window
            cached = self._vwap_cache.get(token_id)
            if cached and (current_block - cached.last_block) <= self.carry_forward_blocks:
                return cached
            return None

        # Calculate VWAP
        total_value = sum(p * v for _, p, v in recent_trades)
        total_volume = sum(v for _, _, v in recent_trades)

        if total_volume == 0:
            return None

        vwap = total_value / total_volume
        last_trade = max(recent_trades, key=lambda x: x[0])

        vwap_data = VWAPData(
            token_id=token_id,
            vwap=vwap,
            total_volume=total_volume,
            trade_count=len(recent_trades),
            last_price=last_trade[1],
            last_block=last_trade[0],
        )

        # Update cache
        self._vwap_cache[token_id] = vwap_data

        return vwap_data

    def get_market_prices(
        self,
        market_id: str,
        condition_ids: list[str],
        current_block: int,
    ) -> dict[str, MarketPriceState]:
        """
        Get current price state for all conditions in a market.

        Args:
            market_id: Market identifier
            condition_ids: List of condition IDs in the market
            current_block: Current block number

        Returns:
            Dict mapping condition_id to MarketPriceState
        """
        result = {}

        for cid in condition_ids:
            yes_token = f"{cid}_YES"
            no_token = f"{cid}_NO"

            yes_vwap = self.get_vwap(yes_token, current_block)
            no_vwap = self.get_vwap(no_token, current_block)

            if yes_vwap or no_vwap:
                result[cid] = MarketPriceState(
                    market_id=market_id,
                    condition_id=cid,
                    yes_price=yes_vwap.vwap if yes_vwap else 0.0,
                    no_price=no_vwap.vwap if no_vwap else 0.0,
                    yes_volume=yes_vwap.total_volume if yes_vwap else 0.0,
                    no_volume=no_vwap.total_volume if no_vwap else 0.0,
                    last_block=max(
                        yes_vwap.last_block if yes_vwap else 0,
                        no_vwap.last_block if no_vwap else 0,
                    ),
                )

        return result


# =============================================================================
# Blockchain Pipeline
# =============================================================================

class BlockchainPipeline:
    """
    Main pipeline for ingesting and processing blockchain data.

    Coordinates the PolygonClient, EventDecoder, and VWAPCalculator
    to provide real-time market data.
    """

    def __init__(self):
        self.client = PolygonClient()
        self.decoder = EventDecoder()
        self.vwap_calculator = VWAPCalculator()
        self._running = False
        self._callbacks: list[Callable[[OrderFilledEvent | PositionsConvertedEvent], Any]] = []

    def register_callback(
        self,
        callback: Callable[[OrderFilledEvent | PositionsConvertedEvent], Any],
    ) -> None:
        """Register a callback for processed events."""
        self._callbacks.append(callback)

    async def start(self, from_block: Optional[int] = None) -> None:
        """
        Start the blockchain pipeline.

        Args:
            from_block: Starting block (default: latest)
        """
        await self.client.connect()

        if from_block is None:
            from_block = await self.client.get_latest_block()

        self._running = True
        logger.info("Starting blockchain pipeline", from_block=from_block)

        async for log in self.client.stream_events(from_block):
            if not self._running:
                break

            event = self.decoder.decode_event(log)
            if event is None:
                continue

            # Update VWAP calculator for OrderFilled events
            if isinstance(event, OrderFilledEvent):
                # Determine token IDs and update VWAP
                # Token ID format depends on Polymarket's token structure
                token_id = str(event.maker_asset_id)
                self.vwap_calculator.add_trade(
                    token_id=token_id,
                    price=event.price,
                    volume=event.maker_amount,
                    block_number=event.block_number,
                )

            # Notify callbacks
            for callback in self._callbacks:
                try:
                    result = callback(event)
                    if asyncio.iscoroutine(result):
                        await result
                except Exception as e:
                    logger.error("Callback error", error=str(e))

    async def stop(self) -> None:
        """Stop the blockchain pipeline."""
        self._running = False
        await self.client.disconnect()
        logger.info("Blockchain pipeline stopped")

    def get_current_prices(
        self,
        market_id: str,
        condition_ids: list[str],
    ) -> dict[str, MarketPriceState]:
        """Get current prices for a market."""
        # This would need the current block - simplified for now
        return self.vwap_calculator.get_market_prices(
            market_id, condition_ids, 0  # Would be actual current block
        )


# =============================================================================
# Transaction Builder (For Execution)
# =============================================================================

class TransactionBuilder:
    """
    Builds unsigned transactions for arbitrage execution.

    The frontend calls this, receives tx data, and asks MetaMask to sign.
    This keeps private keys on the user's side (secure).
    """

    # Polymarket Contract Addresses on Polygon
    CTF_EXCHANGE = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E"
    NEG_RISK_ADAPTER = "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296"
    NEG_RISK_CTF_EXCHANGE = "0xC5d563A36AE78145C45a50134d48A1215220f80a"
    CONDITIONAL_TOKEN = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045"
    USDC = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"

    def __init__(self, rpc_url: str):
        """
        Initialize with Polygon RPC URL.

        Args:
            rpc_url: Polygon mainnet RPC URL (Alchemy/Infura)
        """
        self.w3 = Web3(Web3.HTTPProvider(rpc_url)) if rpc_url else None
        self._connected = self.w3.is_connected() if self.w3 else False

    def create_arbitrage_tx(
        self,
        user_address: str,
        opportunity_id: str = "default",
        trade_data: Optional[bytes] = None,
    ) -> dict:
        """
        Create an unsigned arbitrage transaction.

        Args:
            user_address: User's wallet address (from MetaMask)
            opportunity_id: Opportunity identifier for tracking
            trade_data: Encoded calldata for the arbitrage (from math_core)

        Returns:
            Unsigned transaction dict ready for MetaMask signing
        """
        if not self._connected:
            return {
                "error": "Not connected to Polygon RPC",
                "suggestion": "Check your POLYGON_RPC_URL in .env"
            }

        # Validate address
        try:
            user_address = Web3.to_checksum_address(user_address)
        except Exception as e:
            return {"error": f"Invalid address: {e}"}

        # Get current gas prices
        try:
            gas_price = self.w3.eth.gas_price
            base_fee = gas_price
            priority_fee = self.w3.to_wei(30, 'gwei')  # Polygon standard
        except Exception:
            base_fee = self.w3.to_wei(50, 'gwei')
            priority_fee = self.w3.to_wei(30, 'gwei')

        # Get nonce
        try:
            nonce = self.w3.eth.get_transaction_count(user_address)
        except Exception:
            nonce = 0

        # Build the transaction
        # For now, this is a placeholder that calls the CTF Exchange
        # In production, trade_data would contain the actual swap calldata
        tx = {
            "to": self.NEG_RISK_CTF_EXCHANGE,
            "from": user_address,
            "value": 0,  # No MATIC needed, just USDC approval
            "data": trade_data.hex() if trade_data else "0x",
            "gas": 300000,  # Estimate, should be calculated per trade
            "maxFeePerGas": base_fee + priority_fee,
            "maxPriorityFeePerGas": priority_fee,
            "nonce": nonce,
            "chainId": 137,  # Polygon Mainnet
            "type": 2,  # EIP-1559
        }

        # Add metadata for frontend
        return {
            **tx,
            "_meta": {
                "opportunity_id": opportunity_id,
                "target_contract": "NegRisk CTF Exchange",
                "network": "Polygon Mainnet",
                "warning": "This is a real transaction. Review carefully before signing.",
            }
        }

    def create_usdc_approval_tx(
        self,
        user_address: str,
        amount: int = 2**256 - 1,  # Max approval (infinite)
    ) -> dict:
        """
        Create USDC approval transaction for the exchange.

        Must be executed before arbitrage if user hasn't approved yet.
        """
        if not self._connected:
            return {"error": "Not connected to Polygon RPC"}

        user_address = Web3.to_checksum_address(user_address)

        # ERC20 approve(address spender, uint256 amount) = 0x095ea7b3
        approve_data = (
            "0x095ea7b3"
            + self.NEG_RISK_CTF_EXCHANGE[2:].lower().zfill(64)
            + hex(amount)[2:].zfill(64)
        )

        try:
            nonce = self.w3.eth.get_transaction_count(user_address)
            gas_price = self.w3.eth.gas_price
        except Exception:
            nonce = 0
            gas_price = self.w3.to_wei(50, 'gwei')

        return {
            "to": self.USDC,
            "from": user_address,
            "value": 0,
            "data": approve_data,
            "gas": 60000,
            "maxFeePerGas": gas_price + self.w3.to_wei(30, 'gwei'),
            "maxPriorityFeePerGas": self.w3.to_wei(30, 'gwei'),
            "nonce": nonce,
            "chainId": 137,
            "type": 2,
            "_meta": {
                "action": "USDC Approval",
                "spender": "NegRisk CTF Exchange",
            }
        }

    def get_connection_status(self) -> dict:
        """Check RPC connection status."""
        if not self.w3:
            return {"connected": False, "error": "No RPC URL configured"}

        try:
            block = self.w3.eth.block_number
            return {
                "connected": True,
                "network": "Polygon Mainnet",
                "chainId": 137,
                "latestBlock": block,
            }
        except Exception as e:
            return {"connected": False, "error": str(e)}
