import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { active } = body

    const res = await fetch(`${BACKEND_URL}/api/engine/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: active ?? true }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json(data.error || "Failed to toggle", { status: res.status })
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error("[engine/toggle]", error)
    return NextResponse.json({ error: "Network error" }, { status: 500 })
  }
}
