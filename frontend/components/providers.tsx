"use client"

import * as React from "react"
import {
  getDefaultConfig,
  RainbowKitProvider,
  darkTheme,
} from "@rainbow-me/rainbowkit"
import { WagmiProvider } from "wagmi"
import { QueryClientProvider, QueryClient } from "@tanstack/react-query"
import { mainnet, polygon, arbitrum, optimism, base } from "wagmi/chains"
import "@rainbow-me/rainbowkit/styles.css"

const config = getDefaultConfig({
  appName: "BLACK EDGE",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo",
  chains: [mainnet, polygon, arbitrum, optimism, base],
  ssr: true,
})

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#10b981",
            accentColorForeground: "#000",
            borderRadius: "none",
          })}
          modalSize="compact"
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
