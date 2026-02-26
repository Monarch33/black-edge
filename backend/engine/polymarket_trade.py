"""
Polymarket Trade Execution Module
===================================
Builds transactions for executing trades on Polymarket CTF Exchange.
"""

from typing import Literal
from web3 import Web3
from eth_abi import encode


class PolymarketTradeBuilder:
    """Builds trade transactions for Polymarket CTF Exchange."""

    # Contract addresses on Polygon
    CTF_EXCHANGE = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E"
    NEG_RISK_ADAPTER = "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296"
    NEG_RISK_CTF_EXCHANGE = "0xC5d563A36AE78145C45a50134d48A1215220f80a"
    CONDITIONAL_TOKEN = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045"
    USDC = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"

    # Function signatures
    # fillOrder(Order order, uint256 fillAmount, bytes signature)
    FILL_ORDER_SIGNATURE = "0xfe729aaf"

    def __init__(self, rpc_url: str):
        """
        Initialize with Polygon RPC.

        Args:
            rpc_url: Polygon mainnet RPC URL
        """
        try:
            self.w3 = Web3(Web3.HTTPProvider(rpc_url))
            self.connected = self.w3.is_connected()
        except Exception:
            self.w3 = None
            self.connected = False

    def build_buy_transaction(
        self,
        user_address: str,
        condition_id: str,
        outcome_index: int,  # 0 for NO, 1 for YES
        amount_usdc: float,  # Amount in USDC (e.g., 100.0 = $100)
        max_price: float = 1.0,  # Maximum price willing to pay (0-1)
    ) -> dict:
        """
        Build a transaction to buy outcome tokens on Polymarket.

        Args:
            user_address: User's wallet address
            condition_id: Polymarket condition ID (from market data)
            outcome_index: 0 for NO, 1 for YES
            amount_usdc: Amount to spend in USDC
            max_price: Maximum price per token (slippage protection)

        Returns:
            Transaction dict ready for signing
        """
        if not self.connected:
            return {
                "error": "Not connected to Polygon",
                "suggestion": "Check POLYGON_RPC_URL"
            }

        try:
            user_address = Web3.to_checksum_address(user_address)
        except Exception as e:
            return {"error": f"Invalid address: {e}"}

        # Convert USDC amount to wei (USDC has 6 decimals)
        amount_wei = int(amount_usdc * 1_000_000)

        # For now, we'll build a simplified transaction that interacts with
        # the NegRisk CTF Exchange. In production, this would encode a proper
        # fillOrder call with order book data from Polymarket API.

        # Build transaction data
        # This is a placeholder - real implementation would fetch order book
        # and encode fillOrder with proper order struct and signature
        tx_data = self._encode_buy_order(
            condition_id,
            outcome_index,
            amount_wei,
            max_price
        )

        # Get gas price
        try:
            gas_price = self.w3.eth.gas_price
            base_fee = gas_price
            priority_fee = self.w3.to_wei(30, 'gwei')
        except Exception:
            base_fee = self.w3.to_wei(50, 'gwei')
            priority_fee = self.w3.to_wei(30, 'gwei')

        # Get nonce
        try:
            nonce = self.w3.eth.get_transaction_count(user_address)
        except Exception:
            nonce = 0

        return {
            "to": self.NEG_RISK_CTF_EXCHANGE,
            "from": user_address,
            "value": 0,
            "data": tx_data,
            "gas": 350000,  # Estimated gas for CTF trade
            "maxFeePerGas": base_fee + priority_fee,
            "maxPriorityFeePerGas": priority_fee,
            "nonce": nonce,
            "chainId": 137,
            "type": 2,
        }

    def _encode_buy_order(
        self,
        condition_id: str,
        outcome_index: int,
        amount: int,
        max_price: float
    ) -> str:
        """
        Encode transaction data for buying tokens.

        Note: This is a simplified version. Production implementation would:
        1. Fetch best orders from Polymarket order book API
        2. Encode proper Order struct with all fields
        3. Include maker signature
        4. Handle partial fills
        """
        # For demo purposes, return encoded placeholder
        # Real implementation needs order book integration
        try:
            # Simplified encoding - just demonstrates structure
            # Real calldata would be much more complex
            encoded = encode(
                ['bytes32', 'uint256', 'uint256', 'uint256'],
                [
                    bytes.fromhex(condition_id.replace('0x', '').zfill(64)),
                    outcome_index,
                    amount,
                    int(max_price * 10**18)  # Price in wei
                ]
            )
            return '0x' + encoded.hex()
        except Exception:
            return '0x'

    def build_approval_transaction(
        self,
        user_address: str,
        amount: int = 2**256 - 1  # Max approval (infinite)
    ) -> dict:
        """
        Build USDC approval transaction for CTF Exchange.

        Args:
            user_address: User's wallet address
            amount: Amount to approve (default: infinite)

        Returns:
            Approval transaction dict
        """
        if not self.connected:
            return {
                "error": "Not connected to Polygon"
            }

        try:
            user_address = Web3.to_checksum_address(user_address)
        except Exception as e:
            return {"error": f"Invalid address: {e}"}

        # ERC20 approve(address spender, uint256 amount)
        approve_signature = Web3.keccak(text="approve(address,uint256)")[:4].hex()
        spender = self.NEG_RISK_CTF_EXCHANGE.lower().replace('0x', '').zfill(64)
        amount_hex = hex(amount)[2:].zfill(64)
        tx_data = approve_signature + spender + amount_hex

        # Get nonce
        try:
            nonce = self.w3.eth.get_transaction_count(user_address)
        except Exception:
            nonce = 0

        # Get gas price
        try:
            gas_price = self.w3.eth.gas_price
            base_fee = gas_price
            priority_fee = self.w3.to_wei(30, 'gwei')
        except Exception:
            base_fee = self.w3.to_wei(50, 'gwei')
            priority_fee = self.w3.to_wei(30, 'gwei')

        return {
            "to": self.USDC,
            "from": user_address,
            "value": 0,
            "data": tx_data,
            "gas": 80000,  # Standard ERC20 approval gas
            "maxFeePerGas": base_fee + priority_fee,
            "maxPriorityFeePerGas": priority_fee,
            "nonce": nonce,
            "chainId": 137,
            "type": 2,
        }

    def check_approval(
        self,
        user_address: str
    ) -> dict:
        """
        Check if user has approved USDC for CTF Exchange.

        Args:
            user_address: User's wallet address

        Returns:
            Dict with approval status and amount
        """
        if not self.connected:
            return {"error": "Not connected to Polygon"}

        try:
            user_address = Web3.to_checksum_address(user_address)

            # ERC20 allowance(address owner, address spender)
            allowance_signature = Web3.keccak(text="allowance(address,address)")[:4].hex()
            owner = user_address.lower().replace('0x', '').zfill(64)
            spender = self.NEG_RISK_CTF_EXCHANGE.lower().replace('0x', '').zfill(64)
            call_data = allowance_signature + owner + spender

            result = self.w3.eth.call({
                "to": self.USDC,
                "data": call_data
            })

            allowance = int(result.hex(), 16)

            return {
                "approved": allowance > 0,
                "allowance": allowance,
                "allowance_usdc": allowance / 1_000_000,  # Convert from wei
                "needs_approval": allowance < 1_000_000  # Less than $1
            }

        except Exception as e:
            return {"error": f"Failed to check approval: {e}"}
