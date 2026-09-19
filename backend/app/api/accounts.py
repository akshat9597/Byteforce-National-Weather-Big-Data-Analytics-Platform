"""Profile updates and audited administrator role assignments."""

import json
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Literal
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from app.api.auth import current_user, admin
from app.database.session import get_db
from app.models.entities import User, SystemLog
from app.services.pipeline import now, record

router = APIRouter(prefix="/api", tags=["Accounts"])
Role = Literal["Administrator", "Weather Analyst", "Verification Officer", "Viewer"]


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=2, max_length=100)

    @field_validator("name")
    @classmethod
    def clean(cls, value):
        value = value.strip()
        if len(value) < 2 or any(ord(c) < 32 for c in value):
            raise ValueError("Enter a valid full name")
        return value


class RoleUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Role
    expected_role: Role
    reason: str = Field(min_length=5, max_length=1000)

    @field_validator("reason")
    @classmethod
    def clean(cls, value):
        if len(value.strip()) < 5:
            raise ValueError("Enter a meaningful reason")
        return value.strip()


def public(user):
    return {k: v for k, v in record(user).items() if k != "password_hash"}


def log(db, actor, action, detail):
    db.add(
        SystemLog(
            id=uuid4().hex,
            actor=actor.id,
            action=action,
            detail=json.dumps(detail),
            created_at=now(),
        )
    )


@router.patch("/auth/profile")
def profile(
    data: ProfileUpdate, db: Session = Depends(get_db), user=Depends(current_user)
):
    user.name = data.name
    log(db, user, "user.profile_updated", {"user_id": user.id, "fields": ["name"]})
    db.commit()
    return public(user)


@router.patch("/admin/users/{user_id}/role")
def assign_role(
    user_id: str, data: RoleUpdate, db: Session = Depends(get_db), actor=Depends(admin)
):
    # Serialize role decisions, including concurrent administrators demoting one another.
    if db.bind.dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(26069004)"))
    else:
        db.execute(text("UPDATE users SET role=role WHERE id=:id"), {"id": actor.id})
    db.refresh(actor)
    if actor.role != "Administrator":
        raise HTTPException(
            403, "Your administrator access has changed. Refresh the page."
        )
    if user_id == actor.id:
        raise HTTPException(409, "Another administrator must change your role.")
    user = db.scalar(select(User).where(User.id == user_id).with_for_update())
    if not user:
        raise HTTPException(404, "User not found")
    if user.role != data.expected_role:
        raise HTTPException(
            409, "This role has changed. Refresh the user list before trying again."
        )
    if user.role == data.role:
        return public(user)
    previous = user.role
    user.role = data.role
    log(
        db,
        actor,
        "user.role_changed",
        {
            "user_id": user.id,
            "old_role": previous,
            "new_role": data.role,
            "reason": data.reason,
        },
    )
    db.commit()
    return public(user)
