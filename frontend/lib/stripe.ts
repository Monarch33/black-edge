"use client";

/**
 * Stripe Integration
 * ==================
 * Stripe checkout and subscription management.
 */

import { loadStripe, Stripe } from "@stripe/stripe-js";

// Load Stripe
let stripePromise: Promise<Stripe | null>;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

    // DEBUG: Log Stripe configuration
    console.log("🔑 Stripe Configuration Debug:");
    console.log("  - Environment:", process.env.NODE_ENV);
    console.log("  - Key Prefix:", stripeKey ? stripeKey.substring(0, 7) : "NONE");
    console.log("  - Key Length:", stripeKey.length);
    console.log("  - Mode:", stripeKey.startsWith("pk_live_") ? "LIVE" : stripeKey.startsWith("pk_test_") ? "TEST" : "DISABLED");

    if (!stripeKey) {
      console.warn("⚠️ STRIPE: No publishable key configured - payments disabled");
      return Promise.resolve(null);
    } else if (!stripeKey.startsWith("pk_")) {
      console.error("❌ STRIPE ERROR: Invalid key format - must start with pk_live_ or pk_test_");
      return Promise.resolve(null);
    }

    stripePromise = loadStripe(stripeKey);
  }
  return stripePromise;
}

/**
 * Check if Stripe is configured
 */
export function isStripeConfigured(): boolean {
  const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
  return stripeKey.length > 0 && stripeKey.startsWith("pk_");
}

/**
 * Subscription tier prices.
 * Runner $29 = psychological anchor. The Edge $999 = prestige tier.
 */
export const TIER_PRICES = {
  runner: {
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_RUNNER || "",
    amount: 29,
    name: "Runner",
    features: [
      "Real-time market data",
      "Full Council vote breakdown",
      "Kelly criterion position sizing",
      "Real-time terminal + bot",
      "Polymarket API integration",
    ],
  },
  whale: {
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_WHALE || "",
    amount: 999,
    name: "The Edge",
    features: [
      "Everything in Runner",
      "Full REST + WebSocket API",
      "Webhook alerts",
      "Priority signal delivery",
      "Portfolio integration",
      "Dedicated support",
    ],
  },
};

// Log configuration on module load
if (typeof window !== "undefined") {
  console.log("💰 Stripe Price IDs configured:");
  console.log("  - Runner ($29):", TIER_PRICES.runner.priceId || "❌ MISSING");
  console.log("  - The Edge ($999):", TIER_PRICES.whale.priceId || "❌ MISSING");
}

export type StripeTier = "runner" | "whale"

/**
 * Create a Stripe checkout session.
 */
export async function createCheckoutSession(
  tier: StripeTier,
  userId: string,
  options?: { successUrl?: string; cancelUrl?: string }
): Promise<{ sessionId: string; url: string } | null> {
  console.log("💳 Creating Stripe checkout session:");
  console.log("  - Tier:", tier);
  console.log("  - Price ID:", TIER_PRICES[tier].priceId);
  console.log("  - User ID:", userId);

  try {
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    const response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        priceId: TIER_PRICES[tier].priceId,
        userId,
        successUrl: options?.successUrl || `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: options?.cancelUrl || `${origin}/pricing`,
      }),
    })

    console.log("  - Response status:", response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error("❌ Checkout session failed:", errorData);
      throw new Error("Failed to create checkout session");
    }

    const data = await response.json();
    const { sessionId, url } = data;
    console.log("✅ Checkout session created:", sessionId);
    return { sessionId, url };
  } catch (error) {
    console.error("❌ Checkout session error:", error);
    return null;
  }
}

/**
 * Redirect to Stripe checkout.
 */
export async function redirectToCheckout(
  tier: StripeTier,
  userId: string,
  options?: { successUrl?: string; cancelUrl?: string }
): Promise<void> {
  const result = await createCheckoutSession(tier, userId, options);
  if (!result?.url) {
    throw new Error("Failed to create checkout session");
  }
  window.location.href = result.url;
}

/**
 * Open the Stripe billing portal.
 */
export async function openBillingPortal(): Promise<void> {
  try {
    const response = await fetch("/api/stripe/portal", {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Failed to create portal session");
    }

    const { url } = await response.json();
    window.location.href = url;
  } catch (error) {
    console.error("Billing portal error:", error);
    throw error;
  }
}
