import { NextRequest, NextResponse } from "next/server"

export type UserTier = "free" | "runner" | "whale"

/** Admin backdoor: wallet address that gets WHALE access without Stripe check */
const ADMIN_WALLET =
  process.env.ADMIN_WALLET_ADDRESS ||
  process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS ||
  ""

/**
 * Check user license status by wallet address.
 * Admin wallet (ADMIN_WALLET_ADDRESS or NEXT_PUBLIC_ADMIN_WALLET_ADDRESS) gets WHALE access without Stripe.
 */
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address")
  if (!address) {
    return NextResponse.json({ tier: "free" as UserTier })
  }

  const normalized = address.toLowerCase()
  if (ADMIN_WALLET && normalized === ADMIN_WALLET.toLowerCase()) {
    return NextResponse.json({ tier: "whale" as UserTier })
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
  try {
    const res = await fetch(`${apiUrl}/api/user/status?address=${encodeURIComponent(address)}`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    })
    if (res.ok) {
      const data = await res.json()
      return NextResponse.json({ tier: data.tier || "free" })
    }
  } catch {
    // Backend may not have this endpoint yet — default to free
  }
  return NextResponse.json({ tier: "free" as UserTier })
}
