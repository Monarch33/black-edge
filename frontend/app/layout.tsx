import React from "react"
import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "sonner"
import "./globals.css"

export const dynamic = 'force-dynamic'

// Enhanced SEO Metadata (Phase 10)
export const metadata: Metadata = {
  metadataBase: new URL('https://blackedge.ai'),

  // Basic Metadata
  title: {
    default: "BLACK EDGE — Asymmetric Intelligence Terminal",
    template: "%s | Black Edge"
  },
  description: "Professional-grade AI intelligence for Polymarket. Multi-agent analysis, real-time orderbook data, whale tracking, and transparent track record. Join 500+ traders.",

  // Keywords
  keywords: [
    "polymarket",
    "prediction markets",
    "AI trading",
    "market intelligence",
    "crypto betting",
    "whale tracking",
    "trading signals",
    "AI agents",
    "orderbook analysis",
    "market making",
    "BTC predictions",
    "political betting",
    "sports betting",
    "DeFi trading"
  ],

  // Authors & Creator
  authors: [{ name: "Black Edge" }],
  creator: "Black Edge",
  publisher: "Black Edge",

  // Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // Icons
  icons: {
    icon: [
      { url: "/logo-blackedge.png" },
      { url: "/logo-blackedge.png", sizes: "32x32", type: "image/png" },
      { url: "/logo-blackedge.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/logo-blackedge.png" },
      { url: "/logo-blackedge.png", sizes: "180x180", type: "image/png" },
    ],
  },

  // Open Graph
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://blackedge.ai",
    siteName: "Black Edge",
    title: "Black Edge | AI-Powered Prediction Market Intelligence",
    description: "Professional-grade AI intelligence for Polymarket. Multi-agent analysis, real-time orderbook data, whale tracking, and 100% transparent track record.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Black Edge - Prediction Market Intelligence",
      },
    ],
  },

  // Twitter Card
  twitter: {
    card: "summary_large_image",
    site: "@blackedgeai",
    creator: "@blackedgeai",
    title: "Black Edge | AI-Powered Prediction Market Intelligence",
    description: "Professional-grade AI intelligence for Polymarket. Multi-agent analysis, real-time orderbook data, whale tracking.",
    images: ["/og-image.png"],
  },

  // Verification
  verification: {
    google: "your-google-site-verification-code",
    // yandex: "your-yandex-verification-code",
    // yahoo: "your-yahoo-verification-code",
  },

  // App Links (for mobile)
  // appleWebApp: {
  //   capable: true,
  //   title: "Black Edge",
  //   statusBarStyle: "black-translucent",
  // },

  // Other
  alternates: {
    canonical: "https://blackedge.ai",
  },

  category: "finance",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Additional Meta Tags */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <meta name="theme-color" content="#000000" />
        <meta name="color-scheme" content="dark" />

        {/* Performance & Preconnect */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* Additional SEO */}
        <meta name="application-name" content="Black Edge" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Black Edge" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Schema.org JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "Black Edge",
              "description": "AI-powered prediction market intelligence platform for Polymarket",
              "url": "https://blackedge.ai",
              "applicationCategory": "FinanceApplication",
              "operatingSystem": "Web",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.8",
                "ratingCount": "500"
              }
            })
          }}
        />
      </head>
      <body>
        {children}
        <Toaster theme="dark" toastOptions={{ style: { background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" } }} />
        <Analytics />
      </body>
    </html>
  )
}
