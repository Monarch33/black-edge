import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2023-10-16" })

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { priceId, successUrl, cancelUrl } = body

    if (!priceId) return NextResponse.json({ error: "Price ID is required" }, { status: 400 })

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: successUrl || `${request.headers.get("origin")}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${request.headers.get("origin")}/pricing`,
      allow_promotion_codes: true,
      billing_address_collection: "required",
      metadata: { source: "black_edge_website" },
    })

    return NextResponse.json({ sessionId: session.id })
  } catch (error) {
    console.error("Stripe error:", error)
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 500 })
    }
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 })
  }
}
