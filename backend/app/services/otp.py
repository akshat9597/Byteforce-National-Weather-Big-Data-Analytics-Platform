"""Database-backed challenges and limits, shared by all application workers."""

import hashlib
import hmac
import os
import secrets
import time
import json
from uuid import uuid4
from sqlalchemy import select, update, text, delete
from sqlalchemy.exc import IntegrityError
from pwdlib import PasswordHash
from app.services.email_settings import expiry_minutes, cooldown_seconds
from fastapi import HTTPException
from app.models.entities import OTPChallenge, AuthRateLimit, User, SystemLog
from app.services.pipeline import now
from app.services.email_delivery import deliver_code


def keyed(value):
    secret = os.getenv("OTP_HASH_SECRET", "")
    if len(secret) < 32:
        raise HTTPException(
            503,
            "Email sign-in is not configured. Use password login or contact your administrator.",
        )
    return hmac.new(secret.encode(), value.encode(), hashlib.sha256).hexdigest()


def lock_transaction(db):
    if db.bind.dialect.name == "sqlite":
        db.execute(text("BEGIN IMMEDIATE"))


def limit(db, key, maximum, seconds, cooldown=0):
    stamp = time.time()
    dialect = db.bind.dialect.name
    if dialect == "postgresql":
        from sqlalchemy.dialects.postgresql import insert
    else:
        from sqlalchemy.dialects.sqlite import insert
    db.execute(
        insert(AuthRateLimit)
        .values(key=key, count=0, reset_at=0, next_allowed=0)
        .on_conflict_do_nothing(index_elements=["key"])
    )
    row = db.scalar(
        select(AuthRateLimit).where(AuthRateLimit.key == key).with_for_update()
    )
    if row.reset_at <= stamp:
        row.count = 0
        row.reset_at = stamp + seconds
    if row.next_allowed > stamp or row.count >= maximum:
        retry = max(
            1,
            int(
                (row.next_allowed if row.next_allowed > stamp else row.reset_at) - stamp
            )
            + 1,
        )
        db.commit()
        raise HTTPException(
            429,
            "Too many attempts. Please wait before trying again.",
            headers={"Retry-After": str(retry)},
        )
    row.count += 1
    row.next_allowed = stamp + cooldown
    db.flush()


def audit(db, action, email_key):
    db.add(
        SystemLog(
            id=uuid4().hex,
            actor="Email authentication",
            action=action,
            detail=json.dumps({"subject": email_key}),
            created_at=now(),
        )
    )


def request_code(db, email, ip):
    email = email.strip().lower()
    email_key = keyed("email:" + email)
    try:
        expiry = expiry_minutes() * 60
        cooldown = cooldown_seconds()
    except (ValueError, TypeError):
        raise HTTPException(
            503, "Email sign-in configuration is unavailable."
        ) from None
    lock_transaction(db)
    cleanup(db)
    limit(db, "otp.request.ip:" + keyed("ip:" + ip), 10, 900)
    limit(db, "otp.request.email:" + email_key, 5, 900, cooldown)
    user = db.scalar(select(User).where(User.email == email))
    db.execute(
        update(OTPChallenge)
        .where(OTPChallenge.email_key == email_key, OTPChallenge.consumed == False)
        .values(consumed=True)
    )
    identifier = uuid4().hex
    code = str(100000 + secrets.randbelow(900000))
    challenge = OTPChallenge(
        id=identifier,
        email_key=email_key,
        email=email,
        created_at=time.time(),
        user_id=user.id if user else None,
        code_hash=keyed(identifier + ":" + code),
        expires_at=time.time() + expiry,
        attempts=0,
        consumed=False,
        ready=False,
    )
    db.add(challenge)
    audit(db, "otp.requested", email_key)
    db.commit()
    try:
        delivery_id = deliver_code(email, code)
    except Exception:
        db.execute(
            update(OTPChallenge)
            .where(OTPChallenge.id == identifier)
            .values(consumed=True)
        )
        audit(db, "otp.delivery_failed", email_key)
        db.commit()
        raise HTTPException(
            503,
            "Unable to send a verification email right now. Try again later or use password login.",
        )
    db.execute(
        update(OTPChallenge)
        .where(OTPChallenge.id == identifier, OTPChallenge.consumed == False)
        .values(ready=True, delivery_id=delivery_id)
    )
    db.commit()
    return {
        "challenge_id": identifier,
        "message": "If the request is valid, a verification code has been sent.",
        "expires_in": expiry,
        "resend_after": cooldown,
        "success": True,
    }


def cleanup(db):
    """Retain expired challenges/buckets for 24 hours, then delete on intake."""
    cutoff = time.time() - 86400
    db.execute(delete(OTPChallenge).where(OTPChallenge.expires_at < cutoff))
    db.execute(
        delete(AuthRateLimit).where(
            AuthRateLimit.reset_at < cutoff, AuthRateLimit.next_allowed < cutoff
        )
    )


def verify_code(db, identifier, code, ip, email=None):
    ip_key = keyed("ip:" + ip)
    lock_transaction(db)
    limit(db, "otp.verify.ip:" + ip_key, 60, 300)
    email_key = (
        keyed("email:" + email)
        if email
        else db.scalar(
            select(OTPChallenge.email_key).where(OTPChallenge.id == identifier)
        )
    )
    if email_key:
        limit(db, "otp.verify.email:" + email_key, 30, 300)
    query = select(OTPChallenge)
    if email:
        # Select the newest request even when consumed: never fall back to an older code.
        query = (
            query.where(OTPChallenge.email_key == email_key)
            .order_by(
                OTPChallenge.created_at.desc().nullslast(), OTPChallenge.id.desc()
            )
            .limit(1)
        )
    else:
        query = query.where(OTPChallenge.id == identifier)
    challenge = db.scalar(query.with_for_update())

    def denied(message):
        if email_key:
            audit(db, "otp.verification_denied", email_key)
        db.commit()
        raise HTTPException(400, message)

    if not challenge or not challenge.ready:
        denied("The verification code is invalid. Request a new code if needed.")
    if challenge.attempts >= 5:
        denied("Too many attempts. Please request another verification code.")
    if challenge.consumed:
        denied("The verification code is invalid or has already been used.")
    if challenge.expires_at <= time.time():
        denied("This verification code has expired. Request a new one.")
    challenge.attempts += 1
    if not hmac.compare_digest(challenge.code_hash, keyed(challenge.id + ":" + code)):
        if challenge.attempts >= 5:
            challenge.consumed = True
        denied(
            "Too many attempts. Please request another verification code."
            if challenge.consumed
            else "The verification code is invalid."
        )
    user = (
        db.scalar(select(User).where(User.email == challenge.email))
        if challenge.email
        else db.get(User, challenge.user_id)
        if challenge.user_id
        else None
    )
    if not user:
        if not challenge.email:
            denied("Request a new verification code to continue.")
        # Existing read-only role, never a role provided by the client.
        user = User(
            id="USR-" + uuid4().hex,
            email=challenge.email,
            name=challenge.email.split("@")[0][:100],
            password_hash=PasswordHash.recommended().hash(secrets.token_urlsafe(48)),
            role="Viewer",
            organization="Public access",
            created_at=now(),
        )
        try:
            with db.begin_nested():
                db.add(user)
                db.flush()
        except IntegrityError:
            # An administrator may have created the account during verification.
            user = db.scalar(select(User).where(User.email == challenge.email))
            if not user:
                raise
        audit(db, "user.otp_account_created", email_key)
    challenge.consumed = True
    challenge.used_at = time.time()
    challenge.user_id = user.id
    user.last_login_at = now()
    audit(db, "otp.verified", email_key)
    audit(db, "user.logged_in", user.id)
    db.commit()
    return user
