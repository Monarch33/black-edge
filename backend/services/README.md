# Email Service Setup

The email service handles automated emails for waitlist signups.

## Setup Instructions

### 1. Sign up for Resend (Free Tier)

1. Go to https://resend.com
2. Sign up for a free account
3. Verify your email
4. Get your API key from the dashboard

### 2. Add API Key to Environment

Add to your `.env` file:

```bash
RESEND_API_KEY=re_your_actual_api_key_here
```

### 3. Domain Configuration (Optional for Production)

For production emails from your domain:

1. In Resend dashboard, add your domain
2. Add the provided DNS records (SPF, DKIM, DMARC)
3. Wait for verification (usually 5-15 minutes)
4. Update the `from_email` in `email_service.py` to use your domain

**Development/Testing:**
- Resend's free tier works with verified email addresses
- No domain setup required for testing

### 4. Test the Service

```bash
# Start the backend
uvicorn main:app --reload

# Test the endpoint
curl -X POST "http://localhost:8000/api/subscribe?email=test@example.com"
```

## Features

- ✅ Automatic welcome emails on signup
- ✅ Styled HTML emails with Black Edge branding
- ✅ Queue position tracking
- ✅ Duplicate email detection
- ✅ Persistent waitlist storage (JSON file)
- ✅ Graceful degradation (works without API key, just skips email)

## Email Template

The welcome email includes:
- Confirmation of signup
- Queue position
- Links to documentation
- Operational security reminders
- Estimated wait time

## Waitlist Data

Stored in: `backend/data/waitlist.json`

Structure:
```json
{
  "count": 1234,
  "emails": [
    {
      "email": "user@example.com",
      "position": 1234,
      "timestamp": "2026-02-08T12:34:56.789Z"
    }
  ]
}
```

## Free Tier Limits

Resend Free Tier:
- 3,000 emails/month
- 100 emails/day
- Perfect for MVP/testing
- No credit card required

## Troubleshooting

**Email not sending?**
- Check RESEND_API_KEY is set correctly
- Check backend logs for error messages
- Verify email address format is valid
- Ensure you're not hitting rate limits

**Duplicate signups?**
- Email service automatically detects duplicates
- Returns existing queue position
- No duplicate emails sent

## Production Recommendations

For production deployment:
1. Set up custom domain in Resend
2. Configure proper DNS records
3. Monitor email delivery rates
4. Implement email verification (double opt-in)
5. Add unsubscribe links
6. Consider upgrading to paid plan for higher limits
