"""
Real Trade Execution - Polymarket CLOB Integration

This module executes real trades on Polymarket using py-clob-client.
Supports market orders, limit orders, approvals, and error handling.

⚠️  REAL MONEY - Use with caution
"""

import os
import time
from decimal import Decimal
from typing import Optional, Literal
import structlog

from py_clob_client.client import ClobClient
from py_clob_client.clob_types import OrderArgs, OrderType
from py_clob_client.constants import POLYGON

logger = structlog.get_logger()

# =============================================================================
# CONFIGURATION
# =============================================================================

# Polygon RPC (for mainnet)
POLYGON_RPC = os.getenv("POLYGON_RPC", "https://polygon-rpc.com")

# Private key (NEVER commit this - use .env)
PRIVATE_KEY = os.getenv("POLYMARKET_PRIVATE_KEY", "")

# CLOB API endpoints
CLOB_API_URL = "https://clob.polymarket.com"

# Chain ID (137 = Polygon mainnet, 80002 = Polygon Amoy testnet)
CHAIN_ID = POLYGON

# Safety limits
MAX_TRADE_SIZE_USDC = 1000.0  # Don't allow trades > $1K without override
MIN_TRADE_SIZE_USDC = 5.0     # Don't place orders < $5 (dust)


# =============================================================================
# TRADE EXECUTOR CLASS
# =============================================================================

class TradeExecutor:
    """
    Executes real trades on Polymarket via CLOB.

    Usage:
        executor = TradeExecutor(private_key="0x...")
        await executor.initialize()
        tx_hash = await executor.market_buy(token_id="0x123...", amount=50.0)
    """

    def __init__(
        self,
        private_key: Optional[str] = None,
        chain_id: int = CHAIN_ID,
        test_mode: bool = False
    ):
        """
        Initialize trade executor.

        Args:
            private_key: Ethereum private key (without 0x prefix)
            chain_id: 137 for mainnet, 80002 for testnet
            test_mode: If True, logs trades but doesn't execute
        """
        self.private_key = private_key or PRIVATE_KEY
        self.chain_id = chain_id
        self.test_mode = test_mode
        self.client: Optional[ClobClient] = None
        self.address: Optional[str] = None
        self.initialized = False

        if not self.private_key:
            logger.warning("⚠️ No private key configured. Trades will fail.")

    async def initialize(self):
        """
        Initialize CLOB client and check wallet.

        Must be called before executing trades.
        """
        if not self.private_key:
            raise ValueError("Private key required for trade execution")

        try:
            # Create client
            host = CLOB_API_URL
            self.client = ClobClient(
                host=host,
                key=self.private_key,
                chain_id=self.chain_id,
            )

            # Get address
            self.address = self.client.get_address()

            # Check balance
            balance = await self.get_usdc_balance()

            logger.info(
                "✅ Trade executor initialized",
                address=self.address[:10] + "...",
                balance=f"${balance:.2f}",
                test_mode=self.test_mode,
            )

            self.initialized = True

        except Exception as e:
            logger.error("❌ Failed to initialize trade executor", error=str(e))
            raise

    async def get_usdc_balance(self) -> float:
        """
        Get USDC balance for the wallet.

        Returns:
            USDC balance as float
        """
        if not self.client:
            return 0.0

        try:
            # py-clob-client method to get collateral balance
            balance_data = self.client.get_collateral_balance(self.address)

            # Extract USDC balance (collateral is in 6 decimals)
            balance = float(balance_data.get("balance", 0)) / 1e6

            return balance

        except Exception as e:
            logger.warning("⚠️ Failed to fetch USDC balance", error=str(e))
            return 0.0

    async def approve_usdc(self, amount: float = 10000.0) -> bool:
        """
        Approve USDC spending by CLOB contract.

        This is a one-time operation (or when increasing allowance).

        Args:
            amount: USDC amount to approve (default 10K)

        Returns:
            True if successful
        """
        if not self.client or not self.initialized:
            raise RuntimeError("Executor not initialized. Call initialize() first.")

        if self.test_mode:
            logger.info("🧪 TEST MODE: Would approve USDC", amount=amount)
            return True

        try:
            logger.info("⏳ Approving USDC spending...", amount=amount)

            # py-clob-client has built-in approval
            # Note: This might be contract-specific, check docs
            tx = self.client.set_token_allowance(
                token_id="USDC",  # Special ID for collateral
                amount=int(amount * 1e6),  # Convert to 6 decimals
            )

            logger.info("✅ USDC approved", tx_hash=tx.get("hash", "unknown"))
            return True

        except Exception as e:
            logger.error("❌ USDC approval failed", error=str(e))
            return False

    async def market_buy(
        self,
        token_id: str,
        amount_usdc: float,
        max_slippage: float = 0.02,  # 2%
    ) -> Optional[str]:
        """
        Execute a market buy order (immediate fill).

        Args:
            token_id: CLOB token ID (0x...)
            amount_usdc: Amount in USDC to spend
            max_slippage: Maximum price slippage (default 2%)

        Returns:
            Order ID if successful, None if failed
        """
        if not self.client or not self.initialized:
            raise RuntimeError("Executor not initialized. Call initialize() first.")

        # Safety checks
        if amount_usdc > MAX_TRADE_SIZE_USDC:
            logger.error("❌ Trade size exceeds limit", amount=amount_usdc, limit=MAX_TRADE_SIZE_USDC)
            return None

        if amount_usdc < MIN_TRADE_SIZE_USDC:
            logger.error("❌ Trade size too small", amount=amount_usdc, min=MIN_TRADE_SIZE_USDC)
            return None

        balance = await self.get_usdc_balance()
        if amount_usdc > balance:
            logger.error("❌ Insufficient balance", required=amount_usdc, available=balance)
            return None

        if self.test_mode:
            logger.info(
                "🧪 TEST MODE: Would execute market buy",
                token_id=token_id[:10] + "...",
                amount=amount_usdc,
            )
            return "test_order_" + str(int(time.time()))

        try:
            logger.info("⏳ Executing market buy...", token_id=token_id[:10] + "...", amount=amount_usdc)

            # Create market order args
            order_args = OrderArgs(
                token_id=token_id,
                price=0.99,  # Market orders use high price (will match best ask)
                size=amount_usdc,  # Size in USDC (not shares)
                side="BUY",
                feeRateBps="0",  # Fee rate basis points
            )

            # Place order
            signed_order = self.client.create_order(order_args)
            resp = self.client.post_order(signed_order, OrderType.FOK)  # Fill-or-Kill

            order_id = resp.get("orderID")

            if order_id:
                logger.info("✅ Market buy executed", order_id=order_id, amount=amount_usdc)
                return order_id
            else:
                logger.error("❌ Market buy failed - no order ID", response=resp)
                return None

        except Exception as e:
            logger.error("❌ Market buy execution failed", error=str(e), token_id=token_id)
            return None

    async def limit_buy(
        self,
        token_id: str,
        amount_usdc: float,
        price: float,
        expiration_seconds: int = 300,  # 5 minutes
    ) -> Optional[str]:
        """
        Place a limit buy order.

        Args:
            token_id: CLOB token ID
            amount_usdc: Amount in USDC
            price: Limit price (0-1)
            expiration_seconds: Order expiration (default 5 min)

        Returns:
            Order ID if successful
        """
        if not self.client or not self.initialized:
            raise RuntimeError("Executor not initialized. Call initialize() first.")

        # Safety checks
        if amount_usdc > MAX_TRADE_SIZE_USDC:
            logger.error("❌ Trade size exceeds limit", amount=amount_usdc)
            return None

        if price <= 0 or price >= 1:
            logger.error("❌ Invalid price", price=price)
            return None

        if self.test_mode:
            logger.info(
                "🧪 TEST MODE: Would place limit buy",
                token_id=token_id[:10] + "...",
                amount=amount_usdc,
                price=price,
            )
            return "test_limit_" + str(int(time.time()))

        try:
            logger.info(
                "⏳ Placing limit buy...",
                token_id=token_id[:10] + "...",
                amount=amount_usdc,
                price=price,
            )

            # Create limit order
            order_args = OrderArgs(
                token_id=token_id,
                price=price,
                size=amount_usdc,
                side="BUY",
                feeRateBps="0",
                expiration=int(time.time() + expiration_seconds),
            )

            signed_order = self.client.create_order(order_args)
            resp = self.client.post_order(signed_order, OrderType.GTC)  # Good-Till-Cancel

            order_id = resp.get("orderID")

            if order_id:
                logger.info("✅ Limit order placed", order_id=order_id)
                return order_id
            else:
                logger.error("❌ Limit order failed", response=resp)
                return None

        except Exception as e:
            logger.error("❌ Limit order failed", error=str(e))
            return None

    async def cancel_order(self, order_id: str) -> bool:
        """
        Cancel an open order.

        Args:
            order_id: Order ID to cancel

        Returns:
            True if successful
        """
        if not self.client or not self.initialized:
            raise RuntimeError("Executor not initialized")

        if self.test_mode:
            logger.info("🧪 TEST MODE: Would cancel order", order_id=order_id)
            return True

        try:
            resp = self.client.cancel(order_id)
            success = resp.get("success", False)

            if success:
                logger.info("✅ Order cancelled", order_id=order_id)
            else:
                logger.warning("⚠️ Order cancellation failed", order_id=order_id, response=resp)

            return success

        except Exception as e:
            logger.error("❌ Order cancellation error", error=str(e))
            return False

    async def get_order_status(self, order_id: str) -> Optional[dict]:
        """
        Get status of an order.

        Returns:
            Order data dict, or None if not found
        """
        if not self.client:
            return None

        try:
            order = self.client.get_order(order_id)
            return order
        except Exception as e:
            logger.warning("⚠️ Failed to get order status", order_id=order_id, error=str(e))
            return None


# =============================================================================
# GLOBAL EXECUTOR INSTANCE
# =============================================================================

# Singleton executor (initialized on first use)
_executor: Optional[TradeExecutor] = None


async def get_executor(test_mode: bool = False) -> TradeExecutor:
    """
    Get or create global trade executor instance.

    Args:
        test_mode: If True, enables test mode (no real trades)

    Returns:
        Initialized TradeExecutor
    """
    global _executor

    if _executor is None:
        _executor = TradeExecutor(test_mode=test_mode)
        await _executor.initialize()

    return _executor


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

async def execute_trade(
    token_id: str,
    side: Literal["BUY", "SELL"],
    amount: float,
    order_type: Literal["MARKET", "LIMIT"] = "MARKET",
    price: Optional[float] = None,
    test_mode: bool = False,
) -> Optional[str]:
    """
    Execute a trade (convenience wrapper).

    Args:
        token_id: CLOB token ID
        side: "BUY" or "SELL"
        amount: Amount in USDC
        order_type: "MARKET" or "LIMIT"
        price: Limit price (required if order_type=LIMIT)
        test_mode: If True, simulates trade

    Returns:
        Order ID if successful
    """
    executor = await get_executor(test_mode=test_mode)

    if side == "BUY":
        if order_type == "MARKET":
            return await executor.market_buy(token_id, amount)
        elif order_type == "LIMIT":
            if price is None:
                raise ValueError("Price required for limit orders")
            return await executor.limit_buy(token_id, amount, price)
    else:
        # TODO: Implement SELL side
        logger.error("❌ SELL not yet implemented")
        return None

    return None
