import os
from contextlib import contextmanager
from fastapi import APIRouter, Depends, Request, Response, HTTPException
from pydantic import BaseModel, Field, field_validator, ConfigDict
from email_validator import validate_email, EmailNotValidError
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from app.database.session import get_db
from app.services.otp import request_code, verify_code
from app.api.auth import set_session
from app.services.pipeline import record

router = APIRouter(prefix="/api/auth", tags=["Email authentication"])


def normalize_email(value):
    value = value.strip().lower()
    # Keep existing local bootstrap accounts usable for the explicit SMTP inbox.
    if os.getenv("EMAIL_PROVIDER") == "smtp" and value.endswith("@byteforce.local"):
        import re

        if re.fullmatch(r"[a-z0-9._+\-]+@byteforce\.local", value):
            return value
    try:
        return validate_email(
            value,
            check_deliverability=False,
            test_environment=os.getenv("APP_ENV") == "test",
        ).normalized.lower()
    except EmailNotValidError:
        raise ValueError("Enter a valid email address") from None


class OTPRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=5, max_length=254)

    @field_validator("email")
    @classmethod
    def email_address(cls, value):
        return normalize_email(value)


class EmailOTPVerify(OTPRequest):
    otp: str = Field(pattern=r"^[0-9]{6}$")


class OTPVerify(BaseModel):
    model_config = ConfigDict(extra="forbid")
    challenge_id: str = Field(pattern=r"^[a-f0-9]{32}$")
    code: str = Field(pattern=r"^[0-9]{6}$")


@contextmanager
def operation(db):
    try:
        yield
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            503, "Sign-in is temporarily unavailable. Please try again shortly."
        ) from None


def authenticated(response, user):
    set_session(response, user)
    return {k: v for k, v in record(user).items() if k != "password_hash"}


@router.post("/send-otp")
@router.post("/otp/request", deprecated=True, include_in_schema=False)
def request_otp(data: OTPRequest, request: Request, db: Session = Depends(get_db)):
    with operation(db):
        return request_code(
            db, data.email, request.client.host if request.client else "unknown"
        )


@router.post("/verify-otp")
def verify_email_otp(
    data: EmailOTPVerify,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    with operation(db):
        user = verify_code(
            db,
            None,
            data.otp,
            request.client.host if request.client else "unknown",
            email=data.email,
        )
        return authenticated(response, user)


# Compatibility route for already-open clients; uses the same challenge/session service.
@router.post("/otp/verify", deprecated=True, include_in_schema=False)
def verify_otp(
    data: OTPVerify, request: Request, response: Response, db: Session = Depends(get_db)
):
    with operation(db):
        return authenticated(
            response,
            verify_code(
                db,
                data.challenge_id,
                data.code,
                request.client.host if request.client else "unknown",
            ),
        )
