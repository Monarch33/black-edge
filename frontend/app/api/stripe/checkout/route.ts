import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured")
  return new Stripe(key, { apiVersion: "2026-01-28.clover" })
}

export async function POST(request: NextRequest) {
  try {
    const stripe = getStripe()
    const body = await request.json()
    const { priceId, userId, successUrl, cancelUrl } = body

    if (!priceId) return NextResponse.json({ error: "Price ID is required" }, { status: 400 })

    const origin = request.headers.get("origin") || request.nextUrl.origin
    const success = successUrl || `${origin}/success?session_id={CHECKOUT_SESSION_ID}`
    const cancel = cancelUrl || `${origin}/pricing`

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: success,
      cancel_url: cancel,
      allow_promotion_codes: true,
      billing_address_collection: "required",
      metadata: {
        source: "black_edge_website",
        ...(userId && { user_id: String(userId) }),
      },
    })

    // Return url for direct redirect (redirectToCheckout deprecated in Stripe.js 2025)
    return NextResponse.json({ sessionId: session.id, url: session.url })
  } catch (error) {
    console.error("Stripe checkout error:", error)
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 500 })
    }
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 })
  }
}
