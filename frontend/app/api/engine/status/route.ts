import { NextResponse } from "next/server"

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/engine/status`, {
      cache: "no-store",
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json({ active: false, pnl: 0, ...data })
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error("[engine/status]", error)
    return NextResponse.json({ active: false, pnl: 0 })
  }
}
