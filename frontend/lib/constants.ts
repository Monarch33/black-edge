/**
 * Polymarket Smart Contract Addresses & Constants
 * Network: Polygon Mainnet
 */

export const POLYGON_CHAIN_ID = 137

// Token Addresses
export const USDC_ADDRESS = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" as const // USDC on Polygon (new)
export const USDC_LEGACY_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" as const // USDC.e (legacy)

// Polymarket Conditional Token Framework (CTF)
export const CTF_EXCHANGE_ADDRESS = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E" as const // CTF Exchange
export const CTF_ADAPTER_ADDRESS = "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296" as const // CTF Adapter (Neg Risk)

// Alternative: Polymarket CLOB (Central Limit Order Book) - if available
export const POLYMARKET_CLOB_ADDRESS = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E" as const

// ERC-1155 Conditional Tokens Contract
export const CONDITIONAL_TOKENS_ADDRESS = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045" as const

// Approval amounts
export const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")

// ABI fragments for common operations
export const USDC_ABI = [
  {
    constant: false,
    inputs: [
      { name: "_spender", type: "address" },
      { name: "_value", type: "uint256" }
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    type: "function"
  },
  {
    constant: true,
    inputs: [
      { name: "_owner", type: "address" },
      { name: "_spender", type: "address" }
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    type: "function"
  },
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function"
  }
] as const

export const CTF_EXCHANGE_ABI = [
  {
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "side", type: "uint8" }, // 0 = BUY, 1 = SELL
      { name: "price", type: "uint256" },
      { name: "makerAddress", type: "address" }
    ],
    name: "fillOrder",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "amount", type: "uint256" }
    ],
    name: "buyTokens",
    outputs: [],
    stateMutability: "payable",
    type: "function"
  }
] as const

// Polymarket API endpoints
export const POLYMARKET_API_BASE = "https://clob.polymarket.com"
export const GAMMA_API_BASE = "https://gamma-api.polymarket.com"

// Gas settings
export const GAS_MULTIPLIER = 1.2
export const MAX_GAS_PRICE = BigInt(500_000_000_000) // 500 gwei max
