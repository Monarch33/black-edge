/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'gamma-api.polymarket.com',
      },
      {
        protocol: 'https',
        hostname: '**.polymarket.com',
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
      },
    ],
  },
  // Enable React strict mode for better development experience
  reactStrictMode: true,
  // Ignore build errors for deployment (Turbopack compatibility issues)
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Transpile problematic packages
  transpilePackages: ['@rainbow-me/rainbowkit', '@walletconnect/ethereum-provider'],
  // Turbopack config with exclusions for problematic test files
  turbopack: {
    rules: {
      // Ignore test files in node_modules
      '*.test.{js,ts,tsx}': {
        loaders: [],
        as: '*.js',
      },
      '*.spec.{js,ts,tsx}': {
        loaders: [],
        as: '*.js',
      },
    },
  },
  // Webpack config to exclude test files (fallback for production builds)
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
    }
    // Ignore test files and non-JS files in node_modules
    config.module.rules.push({
      test: /node_modules\/.*\.(test|spec)\.(ts|js)$/,
      use: 'ignore-loader',
    })
    return config
  },
}

module.exports = nextConfig
