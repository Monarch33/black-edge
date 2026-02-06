/**
 * useToast Hook
 * Simple toast notification system
 */

import { useState, useCallback } from "react"
import type { Toast, ToastType } from "@/components/ui/toast"

let toastId = 0

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback(
    (type: ToastType, title: string, description?: string, duration?: number) => {
      const id = `toast-${toastId++}`
      const newToast: Toast = {
        id,
        type,
        title,
        description,
        duration,
      }

      setToasts((prev) => [...prev, newToast])
    },
    []
  )

  const closeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const success = useCallback(
    (title: string, description?: string) => {
      showToast("success", title, description)
    },
    [showToast]
  )

  const error = useCallback(
    (title: string, description?: string) => {
      showToast("error", title, description, 7000) // Error toasts stay longer
    },
    [showToast]
  )

  const info = useCallback(
    (title: string, description?: string) => {
      showToast("info", title, description)
    },
    [showToast]
  )

  return {
    toasts,
    closeToast,
    success,
    error,
    info,
  }
}
