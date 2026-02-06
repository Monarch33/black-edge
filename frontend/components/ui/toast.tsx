"use client"

import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle, AlertTriangle, Info, X } from "lucide-react"
import { useEffect } from "react"

export type ToastType = "success" | "error" | "info"

export interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
  duration?: number
}

interface ToastProps {
  toast: Toast
  onClose: (id: string) => void
}

function ToastIcon({ type }: { type: ToastType }) {
  switch (type) {
    case "success":
      return <CheckCircle className="w-5 h-5 text-green-500" />
    case "error":
      return <AlertTriangle className="w-5 h-5 text-red-500" />
    case "info":
      return <Info className="w-5 h-5 text-blue-500" />
  }
}

export function ToastItem({ toast, onClose }: ToastProps) {
  const { id, type, title, description, duration = 5000 } = toast

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose(id)
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [id, duration, onClose])

  const bgColor =
    type === "success"
      ? "bg-green-500/10 border-green-500/30"
      : type === "error"
      ? "bg-red-500/10 border-red-500/30"
      : "bg-blue-500/10 border-blue-500/30"

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className={`w-full max-w-md border ${bgColor} bg-[#020408]/95 backdrop-blur-sm p-4 shadow-2xl`}
    >
      <div className="flex items-start gap-3">
        <ToastIcon type={type} />
        <div className="flex-1">
          <div className="text-sm text-white font-mono tracking-wider mb-1">{title}</div>
          {description && <div className="text-xs text-white/60 font-mono">{description}</div>}
        </div>
        <button
          onClick={() => onClose(id)}
          className="text-white/30 hover:text-white/60 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  )
}

interface ToastContainerProps {
  toasts: Toast[]
  onClose: (id: string) => void
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onClose={onClose} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}
