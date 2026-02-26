/**
 * Typage des variables d'environnement Next.js (NEXT_PUBLIC_* et server).
 */
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: "development" | "production" | "test"
    /** Backend API base URL */
    NEXT_PUBLIC_API_URL?: string
    /** Stripe publishable key (pk_test_* or pk_live_*) */
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?: string
    /** Stripe Price ID for Runner tier ($29/mo) */
    NEXT_PUBLIC_STRIPE_PRICE_ID_RUNNER?: string
    /** Stripe Price ID for Whale / The Edge tier ($999/mo) */
    NEXT_PUBLIC_STRIPE_PRICE_ID_WHALE?: string
    /** Admin wallet address — bypass paywall, grant WHALE access (optional, server can use ADMIN_WALLET_ADDRESS) */
    NEXT_PUBLIC_ADMIN_WALLET_ADDRESS?: string
  }
}
