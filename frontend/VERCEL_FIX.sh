#!/bin/bash

# Fix NEXTAUTH_URL to use production domain
# This fixes the 0% loading issue caused by URL mismatch

set -e

echo "🔧 Fixing NEXTAUTH_URL for production"
echo "======================================"
echo ""
echo "Current issue: NEXTAUTH_URL points to a preview URL that changes with each deployment"
echo "Solution: Update to use your production domain"
echo ""

# Check if logged in
if ! vercel whoami > /dev/null 2>&1; then
    echo "❌ Not logged in to Vercel. Run: vercel login"
    exit 1
fi

echo "✅ Logged in as: $(vercel whoami | head -n 1)"
echo ""

# Remove old NEXTAUTH_URL
echo "🗑️  Removing old NEXTAUTH_URL (preview URL)..."
vercel env rm NEXTAUTH_URL production -y > /dev/null 2>&1 || echo "  ⚠️  Already removed or doesn't exist"
vercel env rm NEXTAUTH_URL preview -y > /dev/null 2>&1 || echo "  ⚠️  Already removed or doesn't exist"

# Add new NEXTAUTH_URL with production domain
echo ""
echo "✅ Adding NEXTAUTH_URL with production domain..."
PRODUCTION_URL="https://black-edge-peach.vercel.app"
echo "$PRODUCTION_URL" | vercel env add NEXTAUTH_URL production preview > /dev/null 2>&1 && echo "  ✅ Added NEXTAUTH_URL=$PRODUCTION_URL" || echo "  ⚠️  Error adding variable"

echo ""
echo "✅ DONE!"
echo ""
echo "📝 Summary:"
echo "  - NEXTAUTH_URL now points to: $PRODUCTION_URL"
echo "  - NEXTAUTH_SECRET: [unchanged]"
echo ""
echo "🚀 Next Steps:"
echo "  1. Redeploy to apply changes:"
echo "     vercel --prod"
echo ""
echo "  2. Wait 2-3 minutes for deployment"
echo ""
echo "  3. Visit https://black-edge-peach.vercel.app"
echo "     (Always use this URL, not the preview URLs)"
echo ""
echo "  4. Site should load past 0% now!"
echo ""
