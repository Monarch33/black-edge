"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { toast } from "sonner"

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  mode?: "login" | "signup"
}

export function AuthModal({ isOpen, onClose, mode = "login" }: AuthModalProps) {
  const [email, setEmail] = useState("")
  const [authMode, setAuthMode] = useState<"login" | "signup">(mode)

  if (!isOpen) return null

  const handleGoogleAuth = async () => {
    try {
      await signIn("google", { callbackUrl: "/" })
      onClose()
    } catch (error) {
      toast.error("Failed to sign in with Google")
      console.error(error)
    }
  }

  const handleAppleAuth = () => {
    toast.info("Apple OAuth coming soon - use Google or Wallet for now")
  }

  const handleEmailAuth = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      toast.error("Please enter your email")
      return
    }
    toast.success(`Magic link sent to ${email}`)
    // TODO: Implement magic link
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="auth-modal-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(12px)',
          zIndex: 9998,
          animation: 'fadeIn 0.3s ease'
        }}
      />

      {/* Modal */}
      <div
        className="auth-modal"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '480px',
          maxWidth: '90vw',
          background: 'linear-gradient(180deg, #0a0a0a 0%, #000 100%)',
          border: '1px solid rgba(0,255,65,0.2)',
          borderRadius: '16px',
          zIndex: 9999,
          animation: 'scaleIn 0.3s ease',
          padding: '40px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            width: '36px',
            height: '36px',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--em)'
            e.currentTarget.style.background = 'rgba(0,255,65,0.05)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          ✕
        </button>

        {/* Header */}
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <div style={{
            fontSize: '11px',
            color: 'var(--em)',
            fontWeight: 600,
            letterSpacing: '0.1em',
            marginBottom: '12px'
          }}>
            BLACK EDGE
          </div>
          <h2 style={{
            fontSize: '28px',
            fontWeight: 700,
            color: '#fff',
            marginBottom: '8px'
          }}>
            {authMode === "login" ? "Welcome Back" : "Get Started"}
          </h2>
          <p style={{
            fontSize: '14px',
            color: 'rgba(255,255,255,0.5)',
            lineHeight: '1.6'
          }}>
            {authMode === "login"
              ? "Sign in to access your trading terminal"
              : "Create your account to start trading"}
          </p>
        </div>

        {/* Auth Methods */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          {/* Google */}
          <button
            onClick={handleGoogleAuth}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '14px 20px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '15px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
              width: '100%'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M19.6 10.23c0-.82-.1-1.42-.25-2.05H10v3.72h5.5c-.15.83-.63 1.99-1.78 2.8l2.77 2.15c1.7-1.57 2.68-3.88 2.68-6.62z" fill="#4285F4"/>
              <path d="M10 20c2.43 0 4.47-.8 5.96-2.18l-2.77-2.15c-.76.53-1.78.87-3.19.87-2.42 0-4.48-1.64-5.22-3.85L1.9 15.09C3.43 18.1 6.48 20 10 20z" fill="#34A853"/>
              <path d="M4.78 11.69c-.38-1.13-.38-2.25 0-3.38L1.9 5.91C.9 7.91.9 11.09 1.9 13.09l2.88-2.4z" fill="#FBBC05"/>
              <path d="M10 4.13c1.37 0 2.59.47 3.55 1.38l2.62-2.62C14.47.89 12.43 0 10 0 6.48 0 3.43 1.9 1.9 4.91l2.88 2.4C5.52 5.77 7.58 4.13 10 4.13z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {/* Apple */}
          <button
            onClick={handleAppleAuth}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '14px 20px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '15px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
              width: '100%'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M15.4 7.7c-.1 0-2.3.1-2.3 2.8 0 3 2.6 4 2.7 4.1 0 0-.2.8-1 1.6-.7.7-1.4 1.4-2.5 1.4s-1.3-.7-2.5-.7c-1.2 0-1.6.7-2.6.7-1 0-1.8-.7-2.6-1.5C3.6 14.9 3 13 3 11.2c0-2.9 1.9-4.4 3.8-4.4 1 0 1.8.7 2.4.7.6 0 1.5-.7 2.6-.7.4 0 1.9.1 2.9 1.4-.1.1-.7.4-.7 1.5zM13 3.7c.5-.6.9-1.5.9-2.4 0-.1 0-.3 0-.3-.9 0-2 .6-2.6 1.3-.5.6-.9 1.4-.9 2.3 0 .1 0 .3 0 .3h.2c.8 0 1.8-.5 2.4-1.2z"/>
            </svg>
            Continue with Apple
          </button>

          {/* Web3 Wallet */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '14px 20px',
              background: 'rgba(0,255,65,0.05)',
              border: '1px solid rgba(0,255,65,0.2)',
              borderRadius: '10px',
              transition: 'all 0.2s',
              width: '100%'
            }}
          >
            <ConnectButton showBalance={false} />
          </div>
        </div>

        {/* Divider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>OR</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
        </div>

        {/* Email Form */}
        <form onSubmit={handleEmailAuth} style={{ marginBottom: '24px' }}>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: '100%',
              padding: '14px 16px',
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '15px',
              marginBottom: '12px',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--em)'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '14px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '15px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
              e.currentTarget.style.borderColor = 'var(--em)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
            }}
          >
            Continue with Email
          </button>
        </form>

        {/* Toggle Login/Signup */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.6)',
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--em)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
          >
            {authMode === "login" ? "Don't have an account? Sign up" : "Already have an account? Log in"}
          </button>
        </div>

        {/* Terms */}
        <p style={{
          marginTop: '24px',
          textAlign: 'center',
          fontSize: '11px',
          color: 'rgba(255,255,255,0.4)',
          lineHeight: '1.5'
        }}>
          By continuing, you agree to our{" "}
          <a href="/terms" style={{ color: 'var(--em)', textDecoration: 'none' }}>
            Terms
          </a>{" "}
          and{" "}
          <a href="/privacy" style={{ color: 'var(--em)', textDecoration: 'none' }}>
            Privacy Policy
          </a>
        </p>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from {
            transform: translate(-50%, -50%) scale(0.9);
            opacity: 0;
          }
          to {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </>
  )
}
