"""
Stripe Webhook — POST /api/stripe/webhook
==========================================
Provisions user after successful payment.
Validates Stripe signature → no forged events possible.
"""

from __future__ import annotations

import os

import stripe
import structlog
from fastapi import APIRouter, HTTPException, Request

from api.websocket_manager import engine_logs_manager
from db.models import BotInstance, BotStatus, User, UserTier, init_db
from db.session import get_session

logger = structlog.get_logger()

router = APIRouter(prefix="/api/stripe", tags=["stripe"])


async def _provision_user(customer_email: str, wallet_address: str | None) -> None:
    """Create or update user after successful payment — sync DB call."""
    init_db()

    with get_session() as session:
        user = session.query(User).filter(User.email == customer_email).first()

        if not user:
            user = User(
                email=customer_email,
                tier=UserTier.RUNNER,
                is_active=True,
            )
            session.add(user)
            session.flush()
            logger.info("New user provisioned", email=_mask(customer_email))
        else:
            user.tier = UserTier.RUNNER
            user.is_active = True
            logger.info("Existing user upgraded to runner", email=_mask(customer_email))

        # Init BotInstance if missing
        bot = session.query(BotInstance).filter(BotInstance.user_id == user.id).first()
        if not bot:
            bot = BotInstance(user_id=user.id, status=BotStatus.IDLE)
            session.add(bot)
        else:
            # Only reset to IDLE if in ERROR — keep RUNNING if already active
            if bot.status == BotStatus.ERROR:
                bot.status = BotStatus.IDLE

        user_id = user.id

    # Notify user via WebSocket if connected
    await engine_logs_manager.send_personal_message(
        "[PAYMENT] Payment confirmed. Your bot is now ready. Go to Settings to enter your Polymarket API keys.",
        user_id,
    )


def _mask(email: str) -> str:
    """Mask email for logs — no PII leakage."""
    parts = email.split("@")
    if len(parts) != 2:
        return "***"
    return f"{parts[0][:2]}***@{parts[1]}"


@router.post("/webhook")
async def stripe_webhook(request: Request) -> dict:
    """
    Receive Stripe webhook events.
    Verifies signature using STRIPE_WEBHOOK_SECRET.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "").strip()

    if not webhook_secret:
        logger.warning("STRIPE_WEBHOOK_SECRET not set — webhook ignored")
        raise HTTPException(status_code=400, detail="Webhook secret not configured")

    # Verify Stripe signature
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except stripe.errors.SignatureVerificationError as e:
        logger.warning("Stripe signature verification failed", error=str(e))
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        logger.error("Stripe event construction failed", error=str(e))
        raise HTTPException(status_code=400, detail="Bad webhook payload")

    event_type: str = event["type"]
    logger.info("Stripe event received", type=event_type)

    # ── checkout.session.completed ─────────────────────────────
    if event_type == "checkout.session.completed":
        session_obj = event["data"]["object"]
        customer_email: str = (
            session_obj.get("customer_email")
            or session_obj.get("customer_details", {}).get("email", "")
        )
        wallet_address: str | None = session_obj.get("metadata", {}).get("wallet_address")

        if not customer_email:
            logger.warning("checkout.session.completed without email — skipping provision")
            return {"status": "skipped", "reason": "no_email"}

        await _provision_user(customer_email, wallet_address)
        logger.info("checkout.session.completed provisioned", email=_mask(customer_email))

    # ── invoice.payment_failed ─────────────────────────────────
    elif event_type == "invoice.payment_failed":
        cust_email: str = event["data"]["object"].get("customer_email", "")
        if cust_email:
            with get_session() as session:
                user = session.query(User).filter(User.email == cust_email).first()
                if user:
                    user.is_active = False
                    logger.info("User deactivated (payment failed)", email=_mask(cust_email))

    # ── customer.subscription.deleted ─────────────────────────
    elif event_type == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        stripe_customer_id: str = subscription.get("customer", "")
        if stripe_customer_id:
            with get_session() as session:
                user = session.query(User).filter(
                    User.stripe_customer_id == stripe_customer_id
                ).first()
                if user:
                    user.tier = UserTier.FREE
                    user.is_active = False
                    logger.info("User downgraded (subscription deleted)", customer=stripe_customer_id[:8] + "***")

    return {"status": "ok", "type": event_type}
