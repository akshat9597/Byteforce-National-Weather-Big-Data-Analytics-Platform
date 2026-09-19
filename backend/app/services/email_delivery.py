"""Resend and SMTP transports. Never logs recipient, message contents, or credentials."""

import os
import smtplib
import ssl
import resend
from html import escape
from app.services.email_settings import expiry_minutes

resend.default_http_client = resend.RequestsClient(timeout=10)
from email.message import EmailMessage
from contextlib import contextmanager


@contextmanager
def connection():
    host = os.getenv("SMTP_HOST", "")
    sender = os.getenv("SMTP_FROM", "")
    security = os.getenv("SMTP_SECURITY", "starttls")
    if not host or not sender or security not in ("starttls", "ssl", "none"):
        raise RuntimeError("Email delivery is not configured")
    if security == "none" and (
        os.getenv("APP_ENV") == "production"
        or host not in ("localhost", "127.0.0.1", "::1")
    ):
        raise RuntimeError("Unencrypted SMTP is restricted to local development")
    port = int(os.getenv("SMTP_PORT", "465" if security == "ssl" else "587"))
    client = (
        smtplib.SMTP_SSL(host, port, timeout=10, context=ssl.create_default_context())
        if security == "ssl"
        else smtplib.SMTP(host, port, timeout=10)
    )
    try:
        client.ehlo()
        if security == "starttls":
            client.starttls(context=ssl.create_default_context())
            client.ehlo()
        if os.getenv("SMTP_USERNAME"):
            client.login(
                os.environ["SMTP_USERNAME"], os.environ.get("SMTP_PASSWORD", "")
            )
        yield client
    finally:
        client.close()


def deliver_code(recipient, code):
    provider = os.getenv("EMAIL_PROVIDER", "resend").strip().lower()
    if provider == "resend":
        return deliver_resend(recipient, code)
    if provider != "smtp":
        raise RuntimeError("Unsupported email provider")
    return deliver_smtp(recipient, code)


def email_content(code):
    minutes = expiry_minutes()
    text = (
        f"BYTEFORCE\nNational Weather Intelligence & Analytics Platform\n\n"
        f"Your verification code is: {code}\n\nThis code expires in {minutes} minutes.\n"
        "If you did not request this login, you can safely ignore this email. Never share this code."
    )
    html = f"""<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;background:#f3f5f7;font-family:Arial,sans-serif;color:#203247">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" style="max-width:480px;background:white;border:1px solid #dce2e8" cellpadding="24">
    <tr><td><h1 style="font-size:22px;margin:0">BYTEFORCE</h1><p style="font-size:12px;color:#5c6b7b">National Weather Intelligence &amp; Analytics Platform</p>
    <p>Your verification code is:</p><p style="font-size:32px;letter-spacing:8px;font-weight:bold;background:#f0f4f7;padding:18px;text-align:center">{escape(code)}</p>
    <p>This code expires in {minutes} minutes.</p><p style="font-size:13px;color:#5c6b7b">If you did not request this login, you can safely ignore this email. Never share this code.</p>
    </td></tr></table></td></tr></table></body></html>"""
    return text, html


def deliver_resend(recipient, code):
    key = os.getenv("RESEND_API_KEY", "").strip()
    # RESEND_FROM is retained as a compatibility fallback for existing installations.
    sender = os.getenv("EMAIL_FROM", "").strip() or os.getenv("RESEND_FROM", "").strip()
    if not key or not sender:
        raise RuntimeError("Resend is not configured")
    if recipient is None:
        return
    resend.api_key = key
    plain, html = email_content(code)
    try:
        result = resend.Emails.send(
            {
                "from": sender,
                "to": [recipient],
                "subject": "BYTEFORCE Verification Code",
                "text": plain,
                "html": html,
            }
        )
        if not result.get("id"):
            raise RuntimeError("Email delivery unavailable")
        return result["id"]
    except Exception:
        # Provider errors may contain recipients or credentials; never log/return them.
        raise RuntimeError("Email delivery unavailable") from None


def deliver_smtp(recipient, code):
    # Unknown accounts also exercise provider availability, without sending email.
    with connection() as client:
        if recipient is None:
            status, _ = client.noop()
            if status != 250:
                raise RuntimeError("Email service unavailable")
            return
        message = EmailMessage()
        message["From"] = os.environ["SMTP_FROM"]
        message["To"] = recipient
        message["Subject"] = "BYTEFORCE Verification Code"
        plain, html = email_content(code)
        message.set_content(plain)
        message.add_alternative(html, subtype="html")
        refused = client.send_message(message)
        if refused:
            raise RuntimeError("Email delivery refused")
