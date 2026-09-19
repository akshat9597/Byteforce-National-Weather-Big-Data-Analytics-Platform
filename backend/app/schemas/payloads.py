from pydantic import BaseModel, Field, field_validator
from typing import Literal


class ReportIn(BaseModel):
    text: str = Field(min_length=12, max_length=6000)
    event_type: str = "Other"
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    city: str = Field(min_length=2, max_length=100)
    district: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=100)
    severity: Literal["Low", "Moderate", "High", "Critical"] = "Moderate"
    timestamp: str = ""
    reporter_name: str = Field(default="", max_length=100)
    reporter_contact: str = Field(default="", max_length=150)
    anonymous: bool = True
    media_url: str = ""

    @field_validator("timestamp")
    @classmethod
    def valid_time(cls, v):
        if v:
            from datetime import datetime, timezone, timedelta

            dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                raise ValueError("Timestamp must include timezone")
            if dt > datetime.now(timezone.utc) + timedelta(minutes=5):
                raise ValueError("Timestamp cannot be in the future")
            return dt.astimezone(timezone.utc).isoformat()
        return v


class TextIn(BaseModel):
    text: str = Field(min_length=3, max_length=6000)


class Decision(BaseModel):
    status: Literal[
        "Verified",
        "Under Review",
        "Suspicious",
        "Rejected",
        "Likely Verified",
        "Unverified",
    ] = "Verified"
    reason: str = Field(default="", max_length=2000)


class MergeIn(BaseModel):
    event_id: str


class AlertAction(BaseModel):
    status: Literal["Acknowledged", "Assigned", "Resolved", "Archived"]
    assigned_to: str = ""


class Login(BaseModel):
    email: str
    password: str


class UserIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=5, max_length=200)
    password: str = Field(min_length=12, max_length=128)
    role: Literal["Administrator", "Weather Analyst", "Verification Officer", "Viewer"]


class ConfigIn(BaseModel):
    official_weight: int = Field(ge=0, le=40)
    nearby_weight: int = Field(ge=0, le=30)
    coordinates_weight: int = Field(ge=0, le=20)
    recent_weight: int = Field(ge=0, le=20)
    duplicate_penalty: int = Field(ge=-40, le=0)
    fusion_radius_km: float = Field(ge=0.1, le=50)
    fusion_window_hours: int = Field(ge=1, le=72)
    alert_severity: Literal["High", "Critical"]


class EventDecision(BaseModel):
    status: Literal["Active", "Resolved", "Archived"]
    expected_status: Literal["Active", "Closed", "Resolved", "Archived"]
    reason: str = Field(min_length=5, max_length=2000)

    @field_validator("reason")
    @classmethod
    def require_reason(cls, value):
        if len(value.strip()) < 5:
            raise ValueError("Enter a meaningful reason of at least 5 characters")
        return value.strip()


class EventNote(BaseModel):
    text: str = Field(min_length=5, max_length=4000)

    @field_validator("text")
    @classmethod
    def require_text(cls, value):
        if len(value.strip()) < 5:
            raise ValueError("Enter a note of at least 5 characters")
        return value.strip()
