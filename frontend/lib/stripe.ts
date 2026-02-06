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
    console.log("  - Key Prefix:", stripeKey.substring(0, 7));
    console.log("  - Key Length:", stripeKey.length);
    console.log("  - Mode:", stripeKey.startsWith("pk_live_") ? "LIVE" : stripeKey.startsWith("pk_test_") ? "TEST" : "INVALID");

    if (!stripeKey) {
      console.error("❌ STRIPE ERROR: No publishable key found in environment");
    } else if (!stripeKey.startsWith("pk_")) {
      console.error("❌ STRIPE ERROR: Invalid key format - must start with pk_live_ or pk_test_");
    }

    stripePromise = loadStripe(stripeKey);
  }
  return stripePromise;
}

/**
 * Subscription tier prices.
 */
export const TIER_PRICES = {
  runner: {
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_RUNNER || "",
    amount: 29,
    name: "Runner",
    features: [
      "Real-time market data",
      "Market Rebalancing Arbitrage",
      "Risk assessments",
      "Email alerts",
    ],
  },
  whale: {
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_WHALE || "",
    amount: 299,
    name: "Whale",
    features: [
      "Everything in Runner",
      "Combinatorial Arbitrage",
      "Raw institutional feed",
      "API execution access",
      "Priority support",
    ],
  },
};

// Log configuration on module load
if (typeof window !== "undefined") {
  console.log("💰 Stripe Price IDs configured:");
  console.log("  - Runner:", TIER_PRICES.runner.priceId || "❌ MISSING");
  console.log("  - Whale:", TIER_PRICES.whale.priceId || "❌ MISSING");
}

/**
 * Create a Stripe checkout session.
 */
export async function createCheckoutSession(
  tier: "runner" | "whale",
  userId: string
): Promise<string | null> {
  console.log("💳 Creating Stripe checkout session:");
  console.log("  - Tier:", tier);
  console.log("  - Price ID:", TIER_PRICES[tier].priceId);
  console.log("  - User ID:", userId);

  try {
    const response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        priceId: TIER_PRICES[tier].priceId,
        userId,
      }),
    });

    console.log("  - Response status:", response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error("❌ Checkout session failed:", errorData);
      throw new Error("Failed to create checkout session");
    }

    const { sessionId } = await response.json();
    console.log("✅ Checkout session created:", sessionId);
    return sessionId;
  } catch (error) {
    console.error("❌ Checkout session error:", error);
    return null;
  }
}

/**
 * Redirect to Stripe checkout.
 */
export async function redirectToCheckout(
  tier: "runner" | "whale",
  userId: string
): Promise<void> {
  const sessionId = await createCheckoutSession(tier, userId);
  if (!sessionId) {
    throw new Error("Failed to create checkout session");
  }

  const stripe = await getStripe();
  if (!stripe) {
    throw new Error("Stripe not loaded");
  }

  const { error } = await stripe.redirectToCheckout({ sessionId });
  if (error) {
    throw error;
  }
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
