import os, secrets, jwt
from datetime import datetime, timezone, timedelta
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.entities import User

SECRET = os.getenv("JWT_SECRET") or secrets.token_urlsafe(48)
if os.getenv("APP_ENV") == "production" and not os.getenv("JWT_SECRET"):
    raise RuntimeError("JWT_SECRET is required in production")


def token(user):
    return jwt.encode(
        {"sub": user.id, "exp": datetime.now(timezone.utc) + timedelta(hours=8)},
        SECRET,
        algorithm="HS256",
    )


def current_user(request: Request, db: Session = Depends(get_db)):
    raw = request.cookies.get("byteforce_session")
    try:
        claims = jwt.decode(raw, SECRET, algorithms=["HS256"])
        user = db.get(User, claims["sub"])
        if not user:
            raise ValueError()
        return user
    except Exception:
        raise HTTPException(401, "Sign in to continue")


def require(*roles):
    def permission(user=Depends(current_user)):
        if user.role not in roles:
            raise HTTPException(403, "Your role does not permit this action")
        return user

    return permission


reviewer = require("Administrator", "Verification Officer")
admin = require("Administrator")


def set_session(response, user):
    response.set_cookie(
        "byteforce_session",
        token(user),
        httponly=True,
        samesite="lax",
        secure=os.getenv("APP_ENV") == "production",
        max_age=28800,
    )
