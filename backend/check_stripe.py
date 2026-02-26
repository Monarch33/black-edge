#!/usr/bin/env python3
"""
Stripe API Connectivity Test
==============================
Tests if the Stripe secret key is valid and can connect to the API.
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv(".env.local")
load_dotenv()

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")

print("=" * 60)
print("🔐 STRIPE API CONNECTIVITY TEST")
print("=" * 60)
print()

if not STRIPE_SECRET_KEY:
    print("❌ ERROR: STRIPE_SECRET_KEY not found in environment")
    print("   Check your .env.local or .env file")
    sys.exit(1)

# Show key prefix (without exposing the full key)
key_prefix = STRIPE_SECRET_KEY[:7] if len(STRIPE_SECRET_KEY) >= 7 else "INVALID"
key_length = len(STRIPE_SECRET_KEY)

print(f"✅ Stripe key found")
print(f"   - Prefix: {key_prefix}")
print(f"   - Length: {key_length} characters")
print()

# Determine mode
if STRIPE_SECRET_KEY.startswith("sk_live_"):
    print("🔴 Mode: LIVE")
elif STRIPE_SECRET_KEY.startswith("sk_test_"):
    print("🟢 Mode: TEST")
else:
    print("❌ ERROR: Invalid key format")
    print("   Secret key must start with sk_live_ or sk_test_")
    sys.exit(1)

print()
print("Testing API connection...")
print()

try:
    import stripe
    stripe.api_key = STRIPE_SECRET_KEY

    # Test API by listing products (limited to 1 to minimize impact)
    products = stripe.Product.list(limit=1)

    print("✅ API CONNECTION SUCCESSFUL!")
    print(f"   - Products accessible: {len(products.data)} found")
    print()

    # Try to get price information
    try:
        prices = stripe.Price.list(limit=3)
        print(f"✅ Prices accessible: {len(prices.data)} shown")
        for i, price in enumerate(prices.data, 1):
            print(f"   {i}. {price.id} - ${price.unit_amount/100:.2f} {price.currency.upper()}")
        print()
    except Exception as e:
        print(f"⚠️  Could not list prices: {e}")
        print()

    print("=" * 60)
    print("✅ STRIPE CONFIGURATION IS VALID")
    print("=" * 60)

except ImportError:
    print("❌ ERROR: 'stripe' package not installed")
    print("   Run: pip install stripe")
    sys.exit(1)
except stripe.error.AuthenticationError as e:
    print("❌ AUTHENTICATION ERROR")
    print(f"   {e}")
    print()
    print("   This means the API key is invalid or revoked.")
    print("   Check your Stripe dashboard to generate a new key.")
    sys.exit(1)
except Exception as e:
    print(f"❌ API ERROR: {type(e).__name__}")
    print(f"   {e}")
    sys.exit(1)
