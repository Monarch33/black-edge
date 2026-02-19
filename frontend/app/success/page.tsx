"use client"

import { useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"

export default function SuccessPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const plan = searchParams.get("plan") || "runner"

  useEffect(() => {
    toast.success("Welcome to Black Edge", {
      description: "Your subscription is active. You now have full access to the Runner plan.",
    })
    router.replace("/?view=terminal")
  }, [router])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-[#10b981] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/60 text-sm">Redirecting to Black Edge...</p>
      </div>
    </div>
  )
}
