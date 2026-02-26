"""
Stripe Payment Router
=====================
Handles credit purchases via Stripe Checkout.
"""

import os
import stripe
from fastapi import APIRouter, HTTPException, Request, Depends, Header
from typing import Annotated, Optional
from pydantic import BaseModel
import structlog

from models.user import user_db, User
from routers.credits import get_current_user


logger = structlog.get_logger()
router = APIRouter(prefix="/api/stripe", tags=["payments"])

# Initialize Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

# Credit packages
CREDIT_PACKAGES = {
    "starter": {
        "credits": 1000,
        "price": 10_00,  # $10.00 in cents
        "name": "Starter Pack",
        "description": "1,000 API credits"
    },
    "pro": {
        "credits": 10000,
        "price": 50_00,  # $50.00 in cents
        "name": "Pro Pack",
        "description": "10,000 API credits"
    },
    "whale": {
        "credits": 100000,
        "price": 400_00,  # $400.00 in cents
        "name": "Whale Pack",
        "description": "100,000 API credits"
    }
}


# =============================================================================
# Request/Response Models
# =============================================================================

class CheckoutRequest(BaseModel):
    """Request to create a checkout session."""
    package: str  # "starter", "pro", "whale"
    success_url: str = "https://frontend-j1jdbfyg7-finas-projects-31356a2e.vercel.app/dashboard?payment=success"
    cancel_url: str = "https://frontend-j1jdbfyg7-finas-projects-31356a2e.vercel.app/dashboard?payment=cancelled"


class CheckoutResponse(BaseModel):
    """Checkout session response."""
    checkout_url: str
    session_id: str


# =============================================================================
# Endpoints
# =============================================================================

@router.post("/create-checkout", response_model=CheckoutResponse)
async def create_checkout_session(
    request: CheckoutRequest,
    user: Annotated[User, Depends(get_current_user)]
):
    """
    Create a Stripe Checkout session for purchasing credits.

    Returns a checkout URL that the user should be redirected to.
    """
    if request.package not in CREDIT_PACKAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid package. Choose from: {list(CREDIT_PACKAGES.keys())}"
        )

    package = CREDIT_PACKAGES[request.package]

    try:
        # Create Stripe Checkout Session
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": "usd",
                        "product_data": {
                            "name": package["name"],
                            "description": package["description"],
                        },
                        "unit_amount": package["price"],
                    },
                    "quantity": 1,
                }
            ],
            mode="payment",
            success_url=request.success_url,
            cancel_url=request.cancel_url,
            metadata={
                "user_id": user.id,
                "credits": package["credits"],
                "package": request.package
            },
            customer_email=user.email if user.email else None,
        )

        logger.info(
            "Checkout session created",
            user_id=user.id,
            package=request.package,
            session_id=checkout_session.id
        )

        return CheckoutResponse(
            checkout_url=checkout_session.url,
            session_id=checkout_session.id
        )

    except stripe.error.StripeError as e:
        logger.error("Stripe error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Stripe error: {str(e)}")


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """
    Stripe webhook endpoint to handle payment confirmations.

    This endpoint is called by Stripe when a payment is completed.
    It automatically credits the user's account.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    if not webhook_secret:
        logger.warning("STRIPE_WEBHOOK_SECRET not configured")
        # In development, you can skip signature verification
        # In production, this should ALWAYS be verified
        event = stripe.Event.construct_from(
            await request.json(), stripe.api_key
        )
    else:
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, webhook_secret
            )
        except ValueError as e:
            logger.error("Invalid payload", error=str(e))
            raise HTTPException(status_code=400, detail="Invalid payload")
        except stripe.error.SignatureVerificationError as e:
            logger.error("Invalid signature", error=str(e))
            raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle the checkout.session.completed event
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]

        # Extract metadata
        user_id = session["metadata"].get("user_id")
        credits = int(session["metadata"].get("credits", 0))
        package = session["metadata"].get("package")

        if not user_id or credits <= 0:
            logger.error("Invalid webhook metadata", metadata=session["metadata"])
            return {"status": "error", "message": "Invalid metadata"}

        # Credit the user's account
        success = await user_db.add_credits(
            user_id=user_id,
            amount=credits,
            description=f"Stripe purchase: {package} package (${session['amount_total']/100:.2f})"
        )

        if success:
            logger.info(
                "Credits added via Stripe",
                user_id=user_id,
                credits=credits,
                package=package,
                session_id=session["id"]
            )
        else:
            logger.error("Failed to credit user", user_id=user_id, credits=credits)
            return {"status": "error", "message": "Failed to credit user"}

    return {"status": "success"}


@router.get("/packages")
async def get_packages():
    """Get available credit packages."""
    packages = []
    for key, pkg in CREDIT_PACKAGES.items():
        packages.append({
            "id": key,
            "name": pkg["name"],
            "description": pkg["description"],
            "credits": pkg["credits"],
            "price_usd": pkg["price"] / 100,
            "price_per_credit": round((pkg["price"] / 100) / pkg["credits"], 4)
        })

    return {
        "status": "ok",
        "packages": packages
    }
