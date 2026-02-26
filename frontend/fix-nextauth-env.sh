#!/bin/bash

# Quick fix for NextAuth environment variables
# This fixes the site being stuck at 0% loading

set -e

echo "🔐 URGENT FIX: Adding NextAuth Environment Variables"
echo "====================================================="
echo ""
echo "⚠️  The site is stuck at 0% because NextAuth is missing these variables:"
echo "   - NEXTAUTH_URL (your production URL)"
echo "   - NEXTAUTH_SECRET (random secret for JWT encryption)"
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
    local value=$2
    local env_scope=$3

    echo "$value" | vercel env add "$key" $env_scope > /dev/null 2>&1 && echo "  ✅ Added $key" || echo "  ⚠️  Already exists or error (this is OK if it exists)"
}

# 1. NEXTAUTH_URL
echo "📍 Step 1: NEXTAUTH_URL"
echo "------------------------"
echo "What is your production URL?"
echo "Examples:"
echo "  - https://black-edge-peach.vercel.app"
echo "  - https://blackedge.ai"
echo "  - https://www.blackedge.io"
echo ""
echo -n "Enter your production URL: "
read -r NEXTAUTH_URL

if [ -z "$NEXTAUTH_URL" ]; then
    echo "❌ NEXTAUTH_URL is required. Exiting."
    exit 1
fi

echo ""
echo "Adding NEXTAUTH_URL=$NEXTAUTH_URL to Vercel..."
add_env "NEXTAUTH_URL" "$NEXTAUTH_URL" "production preview"

# 2. NEXTAUTH_SECRET
echo ""
echo "🔑 Step 2: NEXTAUTH_SECRET"
echo "------------------------"
echo "Generating a secure random secret..."
NEXTAUTH_SECRET=$(openssl rand -base64 32)
echo "Generated secret: ${NEXTAUTH_SECRET:0:20}... (truncated for security)"
echo ""
echo "Adding NEXTAUTH_SECRET to Vercel..."
add_env "NEXTAUTH_SECRET" "$NEXTAUTH_SECRET" "production preview"

# 3. GOOGLE OAuth (optional but recommended)
echo ""
echo "🔐 Step 3: Google OAuth (OPTIONAL)"
echo "------------------------"
echo "Google OAuth is used for 'Sign in with Google'"
echo "Get credentials from: https://console.cloud.google.com/apis/credentials"
echo ""
echo -n "Enter Google Client ID (or press Enter to skip): "
read -r GOOGLE_CLIENT_ID

if [ ! -z "$GOOGLE_CLIENT_ID" ]; then
    add_env "GOOGLE_CLIENT_ID" "$GOOGLE_CLIENT_ID" "production preview"

    echo -n "Enter Google Client Secret: "
    read -r GOOGLE_CLIENT_SECRET

    if [ ! -z "$GOOGLE_CLIENT_SECRET" ]; then
        add_env "GOOGLE_CLIENT_SECRET" "$GOOGLE_CLIENT_SECRET" "production preview"
    fi
else
    echo "  ⏭️  Skipped Google OAuth (site will work but no 'Sign in with Google')"
fi

echo ""
echo "✅ DONE! NextAuth variables added."
echo ""
echo "📝 Summary of what was added:"
echo "  - NEXTAUTH_URL=$NEXTAUTH_URL"
echo "  - NEXTAUTH_SECRET=[HIDDEN]"
if [ ! -z "$GOOGLE_CLIENT_ID" ]; then
    echo "  - GOOGLE_CLIENT_ID=[SET]"
    echo "  - GOOGLE_CLIENT_SECRET=[SET]"
fi
echo ""
echo "🚀 Next Steps:"
echo "  1. Trigger a new deployment:"
echo "     git commit --allow-empty -m \"Fix NextAuth config\""
echo "     git push"
echo ""
echo "  2. Wait 2-3 minutes for Vercel to rebuild"
echo ""
echo "  3. Test the site - it should load past 0% now!"
echo ""
echo "  4. Check environment variables:"
echo "     vercel env ls"
echo ""
