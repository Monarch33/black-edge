import { NextRequest, NextResponse } from "next/server"

export type UserTier = "free" | "runner" | "whale"

/**
 * Check user license status by wallet address.
 * Calls backend to verify Stripe subscription tier.
 */
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address")
  if (!address) {
    return NextResponse.json({ tier: "free" as UserTier })
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
