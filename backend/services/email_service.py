"""
Email Service for Black Edge
Handles waitlist signups and automated email sending.
"""

import os
import json
from typing import Optional
from datetime import datetime
from pathlib import Path
import aiohttp


class EmailService:
    """Handles email sending via Resend API and waitlist management."""

    def __init__(self):
        self.api_key = os.getenv("RESEND_API_KEY", "")
        self.from_email = "BLACK EDGE <onboarding@blackedge.io>"
        self.api_url = "https://api.resend.com/emails"

        # Setup storage for waitlist
        self.storage_path = Path(__file__).parent.parent / "data" / "waitlist.json"
        self.storage_path.parent.mkdir(exist_ok=True)

        # Load existing waitlist
        self.waitlist = self._load_waitlist()

    def _load_waitlist(self) -> dict:
        """Load waitlist from disk."""
        if self.storage_path.exists():
            try:
                with open(self.storage_path, 'r') as f:
                    return json.load(f)
            except Exception:
                return {"emails": [], "count": 0}
        return {"emails": [], "count": 0}

    def _save_waitlist(self):
        """Save waitlist to disk."""
        try:
            with open(self.storage_path, 'w') as f:
                json.dump(self.waitlist, f, indent=2)
        except Exception as e:
            print(f"Failed to save waitlist: {e}")

    async def add_to_waitlist(self, email: str) -> dict:
        """
        Add email to waitlist and send welcome email.

        Returns:
            dict with status, queue_position, and optional error
        """
        email = email.lower().strip()

        # Check if already registered
        existing = next((e for e in self.waitlist["emails"] if e["email"] == email), None)
        if existing:
            return {
                "status": "already_registered",
                "queue_position": existing["position"],
                "message": "You're already on the list!",
            }

        # Add to waitlist
        self.waitlist["count"] += 1
        position = self.waitlist["count"]

        entry = {
            "email": email,
            "position": position,
            "timestamp": datetime.utcnow().isoformat(),
        }

        self.waitlist["emails"].append(entry)
        self._save_waitlist()

        # Send welcome email
        email_sent = await self._send_welcome_email(email, position)

        return {
            "status": "success",
            "queue_position": position,
            "email_sent": email_sent,
            "message": "Check your inbox for confirmation",
        }

    async def _send_welcome_email(self, to_email: str, position: int) -> bool:
        """
        Send welcome email via Resend API.

        Returns:
            True if email sent successfully, False otherwise
        """
        if not self.api_key:
            print("⚠️ RESEND_API_KEY not set - skipping email send")
            return False

        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{
            background-color: #0D0D1A;
            color: #ffffff;
            font-family: 'Courier New', monospace;
            padding: 40px 20px;
        }}
        .container {{
            max-width: 600px;
            margin: 0 auto;
            border: 1px solid rgba(220, 38, 38, 0.3);
            background-color: #020408;
            padding: 40px;
        }}
        .header {{
            border-bottom: 1px solid rgba(220, 38, 38, 0.2);
            padding-bottom: 20px;
            margin-bottom: 30px;
        }}
        .logo {{
            color: #DC2626;
            font-size: 12px;
            font-weight: bold;
            letter-spacing: 0.2em;
        }}
        .alert {{
            color: #DC2626;
            font-size: 10px;
            letter-spacing: 0.2em;
            margin-top: 10px;
        }}
        .position {{
            color: #EAB308;
            font-size: 32px;
            font-weight: bold;
            margin: 20px 0;
        }}
        .content {{
            color: rgba(255, 255, 255, 0.7);
            font-size: 14px;
            line-height: 1.8;
        }}
        .terminal {{
            background-color: rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(220, 38, 38, 0.2);
            padding: 20px;
            margin: 20px 0;
            font-size: 12px;
        }}
        .green {{ color: #22C55E; }}
        .red {{ color: #DC2626; }}
        .yellow {{ color: #EAB308; }}
        .footer {{
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            font-size: 10px;
            color: rgba(255, 255, 255, 0.3);
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">■ BLACK EDGE</div>
            <div class="alert">⚠ TRANSMISSION RECEIVED</div>
        </div>

        <div class="content">
            <p>> Access request encrypted...</p>
            <p class="green">> Authentication verified</p>
            <p class="green">> Added to syndicate queue</p>

            <div class="terminal">
                <p>> You are <span class="yellow">#{position}</span> in line</p>
                <p class="yellow">> Estimated activation: 48-72 hours</p>
            </div>

            <p><strong>WHAT HAPPENS NEXT:</strong></p>
            <ul>
                <li>Your credentials are being generated</li>
                <li>Access keys will be sent via encrypted channel</li>
                <li>Terminal access granted upon approval</li>
            </ul>

            <p><strong>WHILE YOU WAIT:</strong></p>
            <ul>
                <li>Review the <a href="https://blackedge.io/technical-paper" style="color: #DC2626;">Technical Paper</a></li>
                <li>Read the <a href="https://blackedge.io/risk-disclosure" style="color: #DC2626;">Risk Disclosure</a></li>
                <li>Monitor <a href="https://blackedge.io/status" style="color: #DC2626;">System Status</a></li>
            </ul>

            <div class="terminal">
                <p class="red">> OPERATIONAL SECURITY REMINDER:</p>
                <p>> Never share your access keys</p>
                <p>> Use hardware wallets only</p>
                <p>> Maintain OPSEC at all times</p>
            </div>

            <p>Stay sharp,<br><strong>BLACK EDGE Operations</strong></p>
        </div>

        <div class="footer">
            <p>&copy; 2026 BLACK EDGE. Not financial advice. DYOR.</p>
            <p>This is an automated message. Do not reply to this email.</p>
        </div>
    </div>
</body>
</html>
"""

        text_content = f"""
BLACK EDGE - TRANSMISSION RECEIVED
{'='*50}

> Access request encrypted...
> Authentication verified
> Added to syndicate queue

You are #{position} in line
Estimated activation: 48-72 hours

WHAT HAPPENS NEXT:
- Your credentials are being generated
- Access keys will be sent via encrypted channel
- Terminal access granted upon approval

WHILE YOU WAIT:
- Review the Technical Paper: https://blackedge.io/technical-paper
- Read the Risk Disclosure: https://blackedge.io/risk-disclosure
- Monitor System Status: https://blackedge.io/status

OPERATIONAL SECURITY REMINDER:
> Never share your access keys
> Use hardware wallets only
> Maintain OPSEC at all times

Stay sharp,
BLACK EDGE Operations

---
© 2026 BLACK EDGE. Not financial advice. DYOR.
This is an automated message. Do not reply to this email.
"""

        payload = {
            "from": self.from_email,
            "to": [to_email],
            "subject": "⚠ BLACK EDGE: Access Request Received",
            "html": html_content,
            "text": text_content,
        }

        try:
            async with aiohttp.ClientSession() as session:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                }

                async with session.post(self.api_url, json=payload, headers=headers) as response:
                    if response.status == 200:
                        print(f"✅ Welcome email sent to {to_email}")
                        return True
                    else:
                        error_text = await response.text()
                        print(f"❌ Email send failed: {response.status} - {error_text}")
                        return False
        except Exception as e:
            print(f"❌ Email send error: {e}")
            return False

    def get_waitlist_count(self) -> int:
        """Get total number of people on waitlist."""
        return self.waitlist["count"]
