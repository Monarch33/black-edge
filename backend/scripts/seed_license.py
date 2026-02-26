#!/usr/bin/env python3
"""
Seed a test license for development.
Usage: python scripts/seed_license.py [BE-TEST-XXXX]
"""

import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from db.models import License, LicenseTier, LicenseStatus, init_db
from db.session import get_session
from datetime import datetime, timezone, timedelta


def seed_license(key: str = "BE-TEST-DEV-12345678", tier: str = "runner", days_valid: int = 365) -> None:
    """Insert or update a license in the database."""
    init_db()

    with get_session() as session:
        existing = session.query(License).filter(License.key == key).first()
        if existing:
            existing.status = LicenseStatus.ACTIVE
            existing.tier = LicenseTier(tier)
            existing.expires_at = datetime.now(timezone.utc) + timedelta(days=days_valid)
            existing.updated_at = datetime.now(timezone.utc)
            print(f"✅ Updated existing license: {key[:12]}*** (tier={tier})")
            return

        license_row = License(
            key=key,
            tier=LicenseTier(tier),
            status=LicenseStatus.ACTIVE,
            expires_at=datetime.now(timezone.utc) + timedelta(days=days_valid),
            notes="Seeded for development",
        )
        session.add(license_row)
        print(f"✅ Created license: {key[:12]}*** (tier={tier}, valid {days_valid} days)")


if __name__ == "__main__":
    key = sys.argv[1] if len(sys.argv) > 1 else "BE-TEST-DEV-12345678"
    seed_license(key=key)
