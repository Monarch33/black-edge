"""
Auth API — License Verification
===============================
POST /api/auth/verify — Validates Black Edge license keys.
Used by the CLI at startup. Invalid/expired → 403.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field

import structlog

from db.session import get_session
from db.models import License, LicenseStatus, LicenseTier, init_db

logger = structlog.get_logger()

router = APIRouter(prefix="/api/auth", tags=["auth"])


# -----------------------------------------------------------------------------
# Schemas
# -----------------------------------------------------------------------------


class VerifyRequest(BaseModel):
    """Request body for license verification."""

    key: str = Field(..., min_length=8, max_length=64, description="License key (e.g. BE-xxx)")


class VerifyResponse(BaseModel):
    """Successful verification response."""

    valid: bool = True
    tier: str = Field(..., description="observer | runner | whale")
    expires_at: str | None = Field(None, description="ISO datetime or null for lifetime")
    message: str = "License valid"


# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------


@router.post("/verify", response_model=VerifyResponse)
async def verify_license(
    request: VerifyRequest,
    x_forwarded_for: str | None = Header(None),
    user_agent: str | None = Header(None),
) -> VerifyResponse:
    """
    Verify a Black Edge license key.

    - **200**: License valid → returns tier, expires_at
    - **403**: Invalid, expired, or revoked → CLI must exit

    The CLI calls this at startup. If the response is not valid,
    the bot must self-destruct (exit with error).
    """
    key = request.key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="key is required")

    logger.info("License verification request", key_prefix=key[:8] + "***", has_forwarded=x_forwarded_for is not None)

    # Ensure DB exists
    init_db()

    with get_session() as session:
        license_row = session.query(License).filter(License.key == key).first()

        if not license_row:
            logger.warning("License not found", key_prefix=key[:8] + "***")
            raise HTTPException(
                status_code=403,
                detail={
                    "valid": False,
                    "error": "not_found",
                    "message": "License key not found. Purchase a license at blackedge.io",
                },
            )

        if not license_row.is_valid():
            if license_row.status == LicenseStatus.EXPIRED:
                err = "expired"
                msg = "License has expired. Renew at blackedge.io"
            elif license_row.status in (LicenseStatus.REVOKED, LicenseStatus.CANCELLED):
                err = "revoked"
                msg = "License has been revoked."
            elif license_row.expires_at and license_row.expires_at <= datetime.now(timezone.utc):
                err = "expired"
                msg = "License has expired. Renew at blackedge.io"
            else:
                err = "invalid_key"
                msg = "License is not active."
            logger.warning("License invalid", key_prefix=key[:8] + "***", reason=err)
            raise HTTPException(
                status_code=403,
                detail={"valid": False, "error": err, "message": msg},
            )

        expires_str = None
        if license_row.expires_at:
            expires_str = license_row.expires_at.isoformat()

        logger.info(
            "License verified",
            key_prefix=key[:8] + "***",
            tier=license_row.tier.value,
            expires_at=expires_str,
        )

        return VerifyResponse(
            valid=True,
            tier=license_row.tier.value,
            expires_at=expires_str,
            message="License valid",
        )
