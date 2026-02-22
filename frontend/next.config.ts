import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Allow images from any HTTPS origin (add specific domains as needed)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },

  // Silence noisy build warnings from heavy deps (three.js, framer-motion)
  webpack(config) {
    config.externals = config.externals || []
    return config
  },
}

export default nextConfig
