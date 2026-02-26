import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { proxyKey, secret } = body

    const res = await fetch(`${BACKEND_URL}/api/engine/keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proxy_key: proxyKey, secret }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json({ error: data.error || "Failed to save credentials" }, { status: res.status })
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error("[engine/keys]", error)
    return NextResponse.json({ error: "Backend unavailable" }, { status: 503 })
  }
}
