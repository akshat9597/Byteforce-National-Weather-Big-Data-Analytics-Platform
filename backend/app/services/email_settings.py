"""Validated server-only email authentication configuration."""

import os


def expiry_minutes():
    value = int(os.getenv("OTP_EXPIRY_MINUTES", "5"))
    if not 1 <= value <= 15:
        raise ValueError("OTP_EXPIRY_MINUTES must be between 1 and 15")
    return value


def cooldown_seconds():
    value = int(os.getenv("OTP_RESEND_COOLDOWN_SECONDS", "45"))
    if not 30 <= value <= 300:
        raise ValueError("OTP_RESEND_COOLDOWN_SECONDS must be between 30 and 300")
    return value
