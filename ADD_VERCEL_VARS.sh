#!/bin/bash

# Script pour ajouter les variables d'environnement sur Vercel
# Usage: Remplace les valeurs puis exécute: bash ADD_VERCEL_VARS.sh

echo "🔐 Configuration des variables Vercel pour Black Edge"
echo ""
echo "⚠️  AVANT D'EXÉCUTER CE SCRIPT :"
echo "1. Remplace 'YOUR_PUBLISHABLE_KEY' par ta vraie clé pk_test_..."
echo "2. Remplace 'YOUR_SECRET_KEY' par ta vraie clé sk_test_..."
echo "3. Exécute: bash ADD_VERCEL_VARS.sh"
echo ""

# Navigue vers le dossier frontend
cd "$(dirname "$0")/frontend" || exit 1

# Stripe Publishable Key (Frontend - Public)
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production << EOF
YOUR_PUBLISHABLE_KEY
EOF

vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY preview << EOF
YOUR_PUBLISHABLE_KEY
EOF

vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY development << EOF
YOUR_PUBLISHABLE_KEY
EOF

# Stripe Secret Key (Backend - Secret)
vercel env add STRIPE_SECRET_KEY production << EOF
YOUR_SECRET_KEY
EOF

vercel env add STRIPE_SECRET_KEY preview << EOF
YOUR_SECRET_KEY
EOF

vercel env add STRIPE_SECRET_KEY development << EOF
YOUR_SECRET_KEY
EOF

echo ""
echo "✅ Variables Stripe ajoutées avec succès !"
echo ""
echo "🚀 Prochaine étape : Redéployer avec 'npx vercel --prod'"
