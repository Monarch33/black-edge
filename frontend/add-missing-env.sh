#!/bin/bash

# Quick script to add Firebase, Sentry, and Stripe variables to Vercel

set -e

echo "🔐 Adding Firebase, Sentry, and Stripe environment variables"
echo "=============================================================="
echo ""

# Check if logged in
if ! vercel whoami > /dev/null 2>&1; then
    echo "❌ Not logged in to Vercel. Run: vercel login"
    exit 1
fi

echo "✅ Logged in as: $(vercel whoami | head -n 1)"
echo ""

# Function to add env var
add_env() {
    local key=$1
    local prompt=$2

    echo -n "$prompt: "
    read -r value

    if [ ! -z "$value" ]; then
        echo "$value" | vercel env add "$key" production preview > /dev/null 2>&1 && echo "  ✅ Added $key" || echo "  ⚠️  Already exists or error"
    else
        echo "  ⏭️  Skipped"
    fi
}

echo "🔥 FIREBASE CONFIGURATION"
echo "------------------------"
add_env "NEXT_PUBLIC_FIREBASE_API_KEY" "Firebase API Key"
add_env "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" "Firebase Auth Domain (e.g., project.firebaseapp.com)"
add_env "NEXT_PUBLIC_FIREBASE_PROJECT_ID" "Firebase Project ID"
add_env "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET" "Firebase Storage Bucket (e.g., project.appspot.com)"
add_env "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID" "Firebase Messaging Sender ID"
add_env "NEXT_PUBLIC_FIREBASE_APP_ID" "Firebase App ID"

echo ""
echo "🐛 SENTRY CONFIGURATION"
echo "------------------------"
add_env "NEXT_PUBLIC_SENTRY_DSN" "Sentry DSN"
add_env "SENTRY_AUTH_TOKEN" "Sentry Auth Token"

echo ""
echo "💳 STRIPE CONFIGURATION"
echo "------------------------"
add_env "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" "Stripe Publishable Key (pk_live_...)"
add_env "STRIPE_SECRET_KEY" "Stripe Secret Key (sk_live_...)"
add_env "STRIPE_WEBHOOK_SECRET" "Stripe Webhook Secret (whsec_...)"
add_env "NEXT_PUBLIC_STRIPE_RUNNER_PRICE_ID" "Stripe Runner Price ID (price_...)"
add_env "NEXT_PUBLIC_STRIPE_WHALE_PRICE_ID" "Stripe Whale Price ID (price_...)"

echo ""
echo "🌐 NEXTAUTH CONFIGURATION (CRITICAL)"
echo "------------------------"
add_env "NEXTAUTH_URL" "Your production URL (e.g., https://black-edge-peach.vercel.app)"

echo ""
echo "🔑 Generating NEXTAUTH_SECRET..."
NEXTAUTH_SECRET=$(openssl rand -base64 32)
echo "Generated secure secret: ${NEXTAUTH_SECRET:0:15}... (truncated for security)"
echo "$NEXTAUTH_SECRET" | vercel env add "NEXTAUTH_SECRET" production preview > /dev/null 2>&1 && echo "  ✅ Added NEXTAUTH_SECRET" || echo "  ⚠️  Already exists or error"

echo ""
echo "✅ Done! Check with: vercel env ls"
echo ""
echo "🚀 To redeploy: vercel --prod"
