import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Black Edge - Prediction Market Intelligence',
    short_name: 'Black Edge',
    description: 'AI-powered intelligence for Polymarket. Multi-agent analysis, real-time orderbook data, whale tracking.',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/logo-blackedge.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/logo-blackedge.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    categories: ['finance', 'trading', 'analytics'],
    lang: 'en-US',
    dir: 'ltr',
  }
}
