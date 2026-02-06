"use client";

/**
 * Wagmi Configuration
 * ===================
 * Web3 wallet connection setup for MetaMask and other wallets.
 */

import { http, createConfig } from "wagmi";
import { polygon } from "wagmi/chains";
import { injected, metaMask } from "wagmi/connectors";

// Configure wagmi for Polygon Mainnet
export const config = createConfig({
  chains: [polygon],
  connectors: [
    injected(),
    metaMask(),
  ],
  transports: {
    [polygon.id]: http(),
  },
});

// Export chain info for reference
export const POLYGON_CHAIN_ID = 137;
export const POLYGON_CHAIN = polygon;
