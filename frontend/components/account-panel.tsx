"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"

interface AccountPanelProps {
  isOpen: boolean
  onClose: () => void
  userAddress?: string
}

interface PackageCardProps {
  name: string
  credits: number
  price: number
  pricePerCredit: number
  packageId: string
  apiKey: string
  popular?: boolean
  onSuccess: () => void
}

function PackageCard({ name, credits, price, pricePerCredit, packageId, apiKey, popular, onSuccess }: PackageCardProps) {
  const [loading, setLoading] = useState(false)

  const handlePurchase = async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/stripe/create-checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            package: packageId,
            success_url: `${window.location.origin}/?payment=success`,
            cancel_url: `${window.location.origin}/?payment=cancelled`,
          }),
        }
      )

      if (response.ok) {
        const data = await response.json()
        // Redirect to Stripe Checkout
        window.location.href = data.checkout_url
      } else {
        toast.error("Failed to create checkout session")
      }
    } catch (error) {
      console.error("Purchase error:", error)
      toast.error("Failed to initiate purchase")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: popular ? 'rgba(0,255,65,0.05)' : 'rgba(255,255,255,0.02)',
      border: popular ? '2px solid var(--em)' : '1px solid rgba(255,255,255,0.1)',
      borderRadius: '12px',
      padding: '24px',
      position: 'relative'
    }}>
      {popular && (
        <div style={{
          position: 'absolute',
          top: '-12px',
          right: '20px',
          background: 'var(--em)',
          color: '#000',
          fontSize: '10px',
          fontWeight: 700,
          padding: '4px 12px',
          borderRadius: '12px',
          letterSpacing: '0.05em'
        }}>
          MOST POPULAR
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
        <div>
          <h4 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
            {name}
          </h4>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
            {credits.toLocaleString()} credits
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--em)' }}>
            ${price}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
            ${pricePerCredit.toFixed(4)}/credit
          </div>
        </div>
      </div>

      <button
        onClick={handlePurchase}
        disabled={loading}
        style={{
          width: '100%',
          padding: '12px',
          background: popular ? 'var(--em)' : 'rgba(0,255,65,0.1)',
          border: popular ? 'none' : '1px solid rgba(0,255,65,0.3)',
          borderRadius: '8px',
          color: popular ? '#000' : 'var(--em)',
          fontSize: '13px',
          fontWeight: 600,
          cursor: loading ? 'wait' : 'pointer',
          transition: 'all 0.2s'
        }}
      >
        {loading ? "Processing..." : "PURCHASE"}
      </button>
    </div>
  )
}

export function AccountPanel({ isOpen, onClose, userAddress }: AccountPanelProps) {
  const { data: session } = useSession()
  const [apiKeyVisible, setApiKeyVisible] = useState(false)
  const [cliCommand, setCliCommand] = useState("mac") // mac, linux, windows
  const [credits, setCredits] = useState(0)
  const [maxCredits, setMaxCredits] = useState(50000)
  const [loading, setLoading] = useState(false)
  const [showPackages, setShowPackages] = useState(false)

  // Get API key from session (stored during login)
  const apiKey = (session?.user as any)?.apiKey || "be_live_" + "•".repeat(32)
  const maskedKey = apiKeyVisible ? apiKey : `be_live_${"•".repeat(32)}`
  const creditPercent = maxCredits > 0 ? (credits / maxCredits) * 100 : 0

  // Fetch credit balance on mount
  useEffect(() => {
    if (isOpen && apiKey && !apiKey.includes("•")) {
      fetchBalance()
    }
  }, [isOpen, apiKey])

  const fetchBalance = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/credits/balance`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setCredits(data.credits)
        setMaxCredits(data.max_credits)
      }
    } catch (error) {
      console.error("Failed to fetch balance:", error)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard!")
  }

  const getInstallCommand = () => {
    switch (cliCommand) {
      case "linux":
        return "sudo npm install -g black-edge-cli"
      default:
        return "npm install -g black-edge-cli"
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="account-panel-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(8px)',
          zIndex: 9998,
          animation: 'fadeIn 0.3s ease'
        }}
      />

      {/* Panel */}
      <div
        className="account-panel"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '480px',
          maxWidth: '100vw',
          height: '100vh',
          background: 'linear-gradient(180deg, #0a0a0a 0%, #000 100%)',
          borderLeft: '1px solid rgba(0,255,65,0.2)',
          zIndex: 9999,
          overflowY: 'auto',
          animation: 'slideInRight 0.3s ease',
          padding: '40px 30px'
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
            width: '40px',
            height: '40px',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
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
        <div style={{ marginBottom: '40px' }}>
          <div style={{
            fontSize: '11px',
            color: 'var(--em)',
            fontWeight: 600,
            letterSpacing: '0.1em',
            marginBottom: '12px'
          }}>
            ACCOUNT & API
          </div>
          <h2 style={{
            fontSize: '28px',
            fontWeight: 700,
            color: '#fff',
            marginBottom: '8px'
          }}>
            Dual-Client Access
          </h2>
          <p style={{
            fontSize: '14px',
            color: 'rgba(255,255,255,0.5)',
            lineHeight: '1.6'
          }}>
            Trade via the Web Terminal or your local CLI. Both consume the same credit pool.
          </p>
        </div>

        {/* Credit Balance */}
        <div style={{
          background: 'rgba(0,255,65,0.03)',
          border: '1px solid rgba(0,255,65,0.2)',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '30px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
              API Credits Remaining
            </span>
            <span style={{
              fontSize: '24px',
              fontWeight: 700,
              color: 'var(--em)',
              fontFamily: 'monospace'
            }}>
              {credits.toLocaleString()} / {maxCredits.toLocaleString()}
            </span>
          </div>

          {/* Progress bar */}
          <div style={{
            width: '100%',
            height: '8px',
            background: 'rgba(0,0,0,0.4)',
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '16px'
          }}>
            <div style={{
              width: `${creditPercent}%`,
              height: '100%',
              background: creditPercent < 20 ? '#ff3333' : creditPercent < 50 ? '#ffaa00' : 'var(--em)',
              transition: 'width 0.3s ease'
            }} />
          </div>

          <button
            onClick={() => setShowPackages(true)}
            disabled={!apiKey || apiKey.includes("•")}
            style={{
              width: '100%',
              padding: '14px',
              background: !apiKey || apiKey.includes("•") ? 'rgba(0,255,65,0.2)' : 'var(--em)',
              border: 'none',
              borderRadius: '8px',
              color: !apiKey || apiKey.includes("•") ? 'rgba(0,0,0,0.4)' : '#000',
              fontSize: '14px',
              fontWeight: 600,
              cursor: !apiKey || apiKey.includes("•") ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (apiKey && !apiKey.includes("•")) {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 0 20px rgba(0,255,65,0.4)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            [ PURCHASE CREDITS ]
          </button>
        </div>

        {/* API Key */}
        <div style={{ marginBottom: '30px' }}>
          <div style={{
            fontSize: '11px',
            color: 'var(--em)',
            fontWeight: 600,
            letterSpacing: '0.1em',
            marginBottom: '12px'
          }}>
            YOUR API KEY
          </div>
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '8px'
          }}>
            <input
              type="text"
              value={maskedKey}
              readOnly
              style={{
                flex: 1,
                padding: '12px 16px',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#fff',
                fontFamily: 'monospace',
                fontSize: '13px'
              }}
            />
            <button
              onClick={() => setApiKeyVisible(!apiKeyVisible)}
              style={{
                padding: '0 16px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '18px'
              }}
            >
              {apiKeyVisible ? "👁️" : "👁️‍🗨️"}
            </button>
            <button
              onClick={() => copyToClipboard(apiKey)}
              style={{
                padding: '0 16px',
                background: 'rgba(0,255,65,0.05)',
                border: '1px solid rgba(0,255,65,0.2)',
                borderRadius: '8px',
                color: 'var(--em)',
                cursor: 'pointer',
                fontSize: '18px'
              }}
            >
              📋
            </button>
          </div>
          <p style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.4)',
            lineHeight: '1.5'
          }}>
            Keep this secret. It authenticates both Web Terminal and CLI access.
          </p>
        </div>

        {/* CLI Power User Section */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '30px'
        }}>
          <div style={{
            fontSize: '11px',
            color: '#fff',
            fontWeight: 600,
            letterSpacing: '0.1em',
            marginBottom: '4px'
          }}>
            ⚡ POWER USER MODE
          </div>
          <div style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.6)',
            marginBottom: '20px'
          }}>
            Run Black Edge directly from your terminal
          </div>

          {/* OS Tabs */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '16px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            paddingBottom: '0'
          }}>
            {['mac', 'linux', 'windows'].map((os) => (
              <button
                key={os}
                onClick={() => setCliCommand(os)}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: cliCommand === os ? '2px solid var(--em)' : '2px solid transparent',
                  color: cliCommand === os ? '#fff' : 'rgba(255,255,255,0.4)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  transition: 'all 0.2s'
                }}
              >
                {os === 'mac' ? 'macOS' : os}
              </button>
            ))}
          </div>

          {/* Install command */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.5)',
              marginBottom: '8px'
            }}>
              // Install via npm
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(0,255,65,0.2)',
              borderRadius: '8px',
              padding: '12px 16px'
            }}>
              <code style={{
                flex: 1,
                fontFamily: 'monospace',
                fontSize: '13px',
                color: 'var(--em)'
              }}>
                {getInstallCommand()}
              </code>
              <button
                onClick={() => copyToClipboard(getInstallCommand())}
                style={{
                  background: 'rgba(0,255,65,0.1)',
                  border: '1px solid rgba(0,255,65,0.3)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  color: 'var(--em)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                COPY
              </button>
            </div>
          </div>

          {/* Start command */}
          <div>
            <div style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.5)',
              marginBottom: '8px'
            }}>
              // Start streaming signals
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(0,255,65,0.2)',
              borderRadius: '8px',
              padding: '12px 16px'
            }}>
              <code style={{
                flex: 1,
                fontFamily: 'monospace',
                fontSize: '13px',
                color: 'var(--em)'
              }}>
                black-edge start
              </code>
              <button
                onClick={() => copyToClipboard("black-edge start")}
                style={{
                  background: 'rgba(0,255,65,0.1)',
                  border: '1px solid rgba(0,255,65,0.3)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  color: 'var(--em)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                COPY
              </button>
            </div>
          </div>
        </div>

        {/* Usage Stats */}
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '30px'
        }}>
          <div style={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.6)',
            marginBottom: '16px'
          }}>
            LAST 7 DAYS
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--em)',
                marginBottom: '4px'
              }}>
                847
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                Signals
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--em)',
                marginBottom: '4px'
              }}>
                +12.4%
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                Avg Edge
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--em)',
                marginBottom: '4px'
              }}>
                62%
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                Win Rate
              </div>
            </div>
          </div>
        </div>

        {/* Connected Address */}
        {userAddress && (
          <div style={{
            padding: '16px',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '8px',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.5)',
            textAlign: 'center',
            fontFamily: 'monospace'
          }}>
            Connected: {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
          </div>
        )}
      </div>

      {/* Credit Packages Modal */}
      {showPackages && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '600px',
            maxWidth: '90vw',
            background: 'linear-gradient(180deg, #0a0a0a 0%, #000 100%)',
            border: '1px solid rgba(0,255,65,0.3)',
            borderRadius: '16px',
            padding: '40px',
            zIndex: 10000,
            boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
          }}
        >
          <button
            onClick={() => setShowPackages(false)}
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
              fontSize: '18px'
            }}
          >
            ✕
          </button>

          <h3 style={{
            fontSize: '24px',
            fontWeight: 700,
            color: '#fff',
            marginBottom: '8px'
          }}>
            Purchase Credits
          </h3>
          <p style={{
            fontSize: '14px',
            color: 'rgba(255,255,255,0.5)',
            marginBottom: '32px'
          }}>
            Choose a package to add credits to your account
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Starter Package */}
            <PackageCard
              name="Starter Pack"
              credits={1000}
              price={10}
              pricePerCredit={0.01}
              packageId="starter"
              apiKey={apiKey}
              onSuccess={() => {
                setShowPackages(false)
                fetchBalance()
              }}
            />

            {/* Pro Package */}
            <PackageCard
              name="Pro Pack"
              credits={10000}
              price={50}
              pricePerCredit={0.005}
              packageId="pro"
              apiKey={apiKey}
              popular={true}
              onSuccess={() => {
                setShowPackages(false)
                fetchBalance()
              }}
            />

            {/* Whale Package */}
            <PackageCard
              name="Whale Pack"
              credits={100000}
              price={400}
              pricePerCredit={0.004}
              packageId="whale"
              apiKey={apiKey}
              onSuccess={() => {
                setShowPackages(false)
                fetchBalance()
              }}
            />
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  )
}
