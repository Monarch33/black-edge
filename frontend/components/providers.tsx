"use client"

import * as React from "react"
import {
  RainbowKitProvider,
  getDefaultWallets,
  getDefaultConfig,
  darkTheme,
  Theme,
} from "@rainbow-me/rainbowkit"
import {
  argentWallet,
  trustWallet,
  ledgerWallet,
  phantomWallet,
} from "@rainbow-me/rainbowkit/wallets"
import { WagmiProvider, http } from "wagmi"
import { mainnet, polygon, arbitrum, optimism, base } from "wagmi/chains"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import "@rainbow-me/rainbowkit/styles.css"

// Custom Black Edge Theme - Cyberpunk aesthetic
const blackEdgeTheme: Theme = {
  ...darkTheme(),
  colors: {
    ...darkTheme().colors,
    accentColor: "#DC2626",
    accentColorForeground: "#FFFFFF",
    actionButtonBorder: "rgba(220, 38, 38, 0.3)",
    actionButtonBorderMobile: "rgba(220, 38, 38, 0.3)",
    actionButtonSecondaryBackground: "rgba(220, 38, 38, 0.1)",
    closeButton: "rgba(255, 255, 255, 0.5)",
    closeButtonBackground: "rgba(255, 255, 255, 0.05)",
    connectButtonBackground: "#020408",
    connectButtonBackgroundError: "#DC2626",
    connectButtonInnerBackground: "rgba(220, 38, 38, 0.1)",
    connectButtonText: "#FFFFFF",
    connectButtonTextError: "#FFFFFF",
    connectionIndicator: "#22C55E",
    downloadBottomCardBackground: "#020408",
    downloadTopCardBackground: "#0B0E14",
    error: "#DC2626",
    generalBorder: "rgba(255, 255, 255, 0.06)",
    generalBorderDim: "rgba(255, 255, 255, 0.03)",
    menuItemBackground: "rgba(220, 38, 38, 0.1)",
    modalBackdrop: "rgba(0, 0, 0, 0.85)",
    modalBackground: "#020408",
    modalBorder: "rgba(220, 38, 38, 0.2)",
    modalText: "#FFFFFF",
    modalTextDim: "rgba(255, 255, 255, 0.5)",
    modalTextSecondary: "rgba(255, 255, 255, 0.4)",
    profileAction: "rgba(220, 38, 38, 0.1)",
    profileActionHover: "rgba(220, 38, 38, 0.2)",
    profileForeground: "#0B0E14",
    selectedOptionBorder: "rgba(220, 38, 38, 0.5)",
    standby: "#EAB308",
  },
  fonts: {
    body: "'JetBrains Mono', monospace",
  },
  radii: {
    actionButton: "0px",
    connectButton: "0px",
    menuButton: "0px",
    modal: "0px",
    modalMobile: "0px",
  },
  shadows: {
    connectButton: "0 0 20px rgba(220, 38, 38, 0.3)",
    dialog: "0 0 40px rgba(220, 38, 38, 0.2)",
    profileDetailsAction: "0 0 10px rgba(220, 38, 38, 0.1)",
    selectedOption: "0 0 15px rgba(220, 38, 38, 0.3)",
    selectedWallet: "0 0 20px rgba(220, 38, 38, 0.4)",
    walletLogo: "0 0 10px rgba(0, 0, 0, 0.5)",
  },
}

const { wallets } = getDefaultWallets()

const config = getDefaultConfig({
  appName: "BLACK EDGE",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo",
  wallets: [
    ...wallets,
    {
      groupName: "More Options",
      wallets: [argentWallet, trustWallet, ledgerWallet, phantomWallet],
    },
  ],
  chains: [mainnet, polygon, arbitrum, optimism, base],
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [base.id]: http(),
  },
  ssr: true,
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 10,
      refetchInterval: 1000 * 5,
    },
  },
})

interface WalletState {
  connectedWallets: string[]
  activeWallet: string | null
  addWallet: (address: string) => void
  removeWallet: (address: string) => void
  setActiveWallet: (address: string) => void
}

const WalletContext = React.createContext<WalletState | null>(null)

export function useWalletState() {
  const context = React.useContext(WalletContext)
  if (!context) {
    throw new Error("useWalletState must be used within Providers")
  }
  return context
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [connectedWallets, setConnectedWallets] = React.useState<string[]>([])
  const [activeWallet, setActiveWallet] = React.useState<string | null>(null)

  const walletState: WalletState = {
    connectedWallets,
    activeWallet,
    addWallet: (address: string) => {
      setConnectedWallets((prev) =>
        prev.includes(address) ? prev : [...prev, address]
      )
      if (!activeWallet) setActiveWallet(address)
    },
    removeWallet: (address: string) => {
      setConnectedWallets((prev) => prev.filter((w) => w !== address))
      if (activeWallet === address) {
        setActiveWallet(connectedWallets[0] || null)
      }
    },
    setActiveWallet,
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={blackEdgeTheme}
          modalSize="compact"
          showRecentTransactions={true}
          appInfo={{
            appName: "BLACK EDGE",
            learnMoreUrl: "https://blackedge.io/docs",
            disclaimer: ({ Text, Link }) => (
              <Text>
                By connecting, you agree to the{" "}
                <Link href="https://blackedge.io/terms">Terms of Service</Link>{" "}
                and acknowledge the risks of automated trading.
              </Text>
            ),
          }}
        >
          <WalletContext.Provider value={walletState}>
            {children}
          </WalletContext.Provider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export { config }
