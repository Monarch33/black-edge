#!/bin/bash

# Black Edge - Vercel Environment Variables Setup
# This script will add all required environment variables to Vercel

set -e

echo "🚀 Black Edge - Vercel Environment Setup"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if logged in
echo -e "${BLUE}Checking Vercel login status...${NC}"
if ! vercel whoami > /dev/null 2>&1; then
    echo -e "${RED}❌ Not logged in to Vercel${NC}"
    echo "Please run: vercel login"
    exit 1
fi

VERCEL_USER=$(vercel whoami | head -n 1)
echo -e "${GREEN}✓ Logged in as: $VERCEL_USER${NC}"
echo ""

# Check if project is linked
if [ ! -d ".vercel" ]; then
    echo -e "${YELLOW}⚠️  Project not linked to Vercel${NC}"
    echo "Let's link it now..."
    echo ""
    vercel link
    echo ""
fi

echo -e "${BLUE}Adding environment variables to Vercel...${NC}"
echo ""

# Function to add env var
add_env() {
    local key=$1
    local value=$2
    local env_type=${3:-production,preview,development}

    if [ -z "$value" ] || [ "$value" == "your_"* ] || [ "$value" == "pk_test_"* ] || [ "$value" == "sk_test_"* ]; then
        echo -e "${YELLOW}⏭️  Skipping $key (placeholder value)${NC}"
        return
    fi

    echo -e "${GREEN}➕ Adding $key${NC}"
    echo "$value" | vercel env add "$key" "$env_type" > /dev/null 2>&1 || echo -e "${YELLOW}   (may already exist)${NC}"
}

# Add variables from .env.production
echo -e "${BLUE}1. Adding production configuration...${NC}"
add_env "NEXT_PUBLIC_API_URL" "https://black-edge-backend-production-e616.up.railway.app"
add_env "NEXT_PUBLIC_WS_URL" "wss://black-edge-backend-production-e616.up.railway.app/ws/stream"
add_env "NEXT_PUBLIC_POLYMARKET_API" "https://gamma-api.polymarket.com"
add_env "NEXT_PUBLIC_VERCEL_ANALYTICS_ID" "auto"

echo ""
echo -e "${BLUE}2. Now let's add the sensitive variables...${NC}"
echo -e "${YELLOW}Please enter the following values (or press ENTER to skip):${NC}"
echo ""

# Sentry
echo -e "${BLUE}Sentry Configuration:${NC}"
read -p "NEXT_PUBLIC_SENTRY_DSN: " SENTRY_DSN
if [ ! -z "$SENTRY_DSN" ]; then
    add_env "NEXT_PUBLIC_SENTRY_DSN" "$SENTRY_DSN"
fi

read -p "SENTRY_AUTH_TOKEN: " SENTRY_TOKEN
if [ ! -z "$SENTRY_TOKEN" ]; then
    add_env "SENTRY_AUTH_TOKEN" "$SENTRY_TOKEN"
fi

echo ""

# NextAuth
echo -e "${BLUE}NextAuth Configuration:${NC}"
read -p "NEXTAUTH_SECRET (or press ENTER to generate): " NEXTAUTH_SECRET
if [ -z "$NEXTAUTH_SECRET" ]; then
    NEXTAUTH_SECRET=$(openssl rand -hex 32)
    echo -e "${GREEN}✓ Generated: $NEXTAUTH_SECRET${NC}"
fi
add_env "NEXTAUTH_SECRET" "$NEXTAUTH_SECRET"

read -p "NEXTAUTH_URL (your production URL): " NEXTAUTH_URL
if [ ! -z "$NEXTAUTH_URL" ]; then
    add_env "NEXTAUTH_URL" "$NEXTAUTH_URL"
fi

echo ""

# Stripe
echo -e "${BLUE}Stripe Configuration:${NC}"
read -p "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: " STRIPE_PUB
if [ ! -z "$STRIPE_PUB" ]; then
    add_env "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" "$STRIPE_PUB"
fi

read -p "STRIPE_SECRET_KEY: " STRIPE_SECRET
if [ ! -z "$STRIPE_SECRET" ]; then
    add_env "STRIPE_SECRET_KEY" "$STRIPE_SECRET"
fi

read -p "STRIPE_WEBHOOK_SECRET: " STRIPE_WEBHOOK
if [ ! -z "$STRIPE_WEBHOOK" ]; then
    add_env "STRIPE_WEBHOOK_SECRET" "$STRIPE_WEBHOOK"
fi

read -p "NEXT_PUBLIC_STRIPE_RUNNER_PRICE_ID: " STRIPE_RUNNER
if [ ! -z "$STRIPE_RUNNER" ]; then
    add_env "NEXT_PUBLIC_STRIPE_RUNNER_PRICE_ID" "$STRIPE_RUNNER"
fi

read -p "NEXT_PUBLIC_STRIPE_WHALE_PRICE_ID: " STRIPE_WHALE
if [ ! -z "$STRIPE_WHALE" ]; then
    add_env "NEXT_PUBLIC_STRIPE_WHALE_PRICE_ID" "$STRIPE_WHALE"
fi

echo ""

# Firebase
echo -e "${BLUE}Firebase Configuration:${NC}"
read -p "NEXT_PUBLIC_FIREBASE_API_KEY: " FIREBASE_KEY
if [ ! -z "$FIREBASE_KEY" ]; then
    add_env "NEXT_PUBLIC_FIREBASE_API_KEY" "$FIREBASE_KEY"
fi

read -p "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: " FIREBASE_DOMAIN
if [ ! -z "$FIREBASE_DOMAIN" ]; then
    add_env "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" "$FIREBASE_DOMAIN"
fi

read -p "NEXT_PUBLIC_FIREBASE_PROJECT_ID: " FIREBASE_PROJECT
if [ ! -z "$FIREBASE_PROJECT" ]; then
    add_env "NEXT_PUBLIC_FIREBASE_PROJECT_ID" "$FIREBASE_PROJECT"
fi

read -p "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: " FIREBASE_BUCKET
if [ ! -z "$FIREBASE_BUCKET" ]; then
    add_env "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET" "$FIREBASE_BUCKET"
fi

read -p "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: " FIREBASE_SENDER
if [ ! -z "$FIREBASE_SENDER" ]; then
    add_env "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID" "$FIREBASE_SENDER"
fi

read -p "NEXT_PUBLIC_FIREBASE_APP_ID: " FIREBASE_APP
if [ ! -z "$FIREBASE_APP" ]; then
    add_env "NEXT_PUBLIC_FIREBASE_APP_ID" "$FIREBASE_APP"
fi

echo ""

# Optional
echo -e "${BLUE}Optional Configuration (press ENTER to skip):${NC}"
read -p "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: " WC_ID
if [ ! -z "$WC_ID" ]; then
    add_env "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID" "$WC_ID"
fi

read -p "NEXT_PUBLIC_ALCHEMY_ID: " ALCHEMY_ID
if [ ! -z "$ALCHEMY_ID" ]; then
    add_env "NEXT_PUBLIC_ALCHEMY_ID" "$ALCHEMY_ID"
fi

read -p "NEXT_PUBLIC_ADMIN_WALLET_ADDRESS: " ADMIN_WALLET
if [ ! -z "$ADMIN_WALLET" ]; then
    add_env "NEXT_PUBLIC_ADMIN_WALLET_ADDRESS" "$ADMIN_WALLET"
fi

echo ""
echo -e "${GREEN}✅ Environment variables setup complete!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Check your Vercel dashboard to verify all variables"
echo "2. Trigger a new deployment: vercel --prod"
echo "3. Or wait for automatic deployment from GitHub"
echo ""
echo -e "${GREEN}🚀 Your app is ready to deploy!${NC}"
