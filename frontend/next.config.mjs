import { withSentryConfig } from "@sentry/nextjs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  outputFileTracingRoot: path.join(__dirname, "../"),
  webpack: (config, { isServer }) => {
    // Fix optional deps from MetaMask SDK / WalletConnect (build warnings)
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
    }
    return config
  },
}

export default withSentryConfig(nextConfig, {
  org: "black-edge",
  project: "javascript-nextjs",

  // Suppress Sentry CLI warnings (source map reference warnings for Vercel infra bundles)
  silent: true,

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Remove sourceMappingURL comments from production bundles after upload
  hideSourceMaps: true,

  // Upload source maps then delete them from the deployment
  sourcemaps: {
    deleteFilesAfterUpload: [
      '.next/static/**/*.map',
      '.next/server/**/*.map',
      '.next/**/*.map',
    ],
  },

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
  },

  webpack: {
    automaticVercelMonitors: true,
  },
});
