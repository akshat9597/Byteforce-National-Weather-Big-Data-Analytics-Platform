from sqlalchemy import String, Float, Integer, Boolean, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database.session import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str]
    email: Mapped[str] = mapped_column(String, unique=True)
    password_hash: Mapped[str]
    role: Mapped[str]
    organization: Mapped[str]
    created_at: Mapped[str]
    last_login_at: Mapped[str | None] = mapped_column(nullable=True)


class Report(Base):
    __tablename__ = "weather_reports"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    source_type: Mapped[str]
    source_name: Mapped[str]
    text: Mapped[str] = mapped_column(Text)
    event_type: Mapped[str]
    latitude: Mapped[float]
    longitude: Mapped[float]
    city: Mapped[str]
    district: Mapped[str]
    state: Mapped[str]
    timestamp: Mapped[str]
    media_url: Mapped[str] = mapped_column(default="")
    ai_confidence: Mapped[float]
    trust_score: Mapped[int]
    verification_status: Mapped[str]
    severity: Mapped[str]
    event_id: Mapped[str] = mapped_column(ForeignKey("weather_events.id"))
    duplicate_group_id: Mapped[str] = mapped_column(default="")
    created_at: Mapped[str]


class Event(Base):
    __tablename__ = "weather_events"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    event_type: Mapped[str]
    latitude: Mapped[float]
    longitude: Mapped[float]
    city: Mapped[str]
    district: Mapped[str]
    state: Mapped[str]
    severity: Mapped[str]
    confidence: Mapped[float]
    verification_status: Mapped[str]
    first_detected: Mapped[str]
    last_updated: Mapped[str]
    report_count: Mapped[int]
    status: Mapped[str]


class CitizenReport(Base):
    __tablename__ = "citizen_reports"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    weather_report_id: Mapped[str] = mapped_column(ForeignKey("weather_reports.id"))
    reporter_name: Mapped[str]
    reporter_contact: Mapped[str]
    anonymous: Mapped[bool]
    description: Mapped[str]


class VerificationLog(Base):
    __tablename__ = "verification_logs"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    report_id: Mapped[str] = mapped_column(ForeignKey("weather_reports.id"))
    reviewed_by: Mapped[str]
    old_status: Mapped[str]
    new_status: Mapped[str]
    reason: Mapped[str]
    created_at: Mapped[str]


class DataSource(Base):
    __tablename__ = "data_sources"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str]
    type: Mapped[str]
    status: Mapped[str]
    last_sync: Mapped[str]
    records_today: Mapped[int]


class Alert(Base):
    __tablename__ = "alerts"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("weather_events.id"))
    level: Mapped[str]
    message: Mapped[str]
    status: Mapped[str]
    created_at: Mapped[str]
    assigned_to: Mapped[str] = mapped_column(default="")


class Configuration(Base):
    __tablename__ = "configuration"
    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[str] = mapped_column(Text)
    updated_by: Mapped[str]
    updated_at: Mapped[str]


class SystemLog(Base):
    __tablename__ = "system_logs"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    actor: Mapped[str]
    action: Mapped[str]
    detail: Mapped[str] = mapped_column(Text)
    created_at: Mapped[str]


class OutboxMessage(Base):
    """Persisted in the same transaction as the record it describes."""

    __tablename__ = "outbox_messages"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    payload: Mapped[str] = mapped_column(Text)
    created_at: Mapped[str]
    delivered_at: Mapped[str] = mapped_column(default="", index=True)
    attempts: Mapped[int] = mapped_column(default=0)
    next_attempt_at: Mapped[str] = mapped_column(default="", index=True)
    last_error: Mapped[str] = mapped_column(default="")


class EventLog(Base):
    __tablename__ = "event_logs"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("weather_events.id"), index=True)
    actor: Mapped[str]
    action: Mapped[str]
    old_status: Mapped[str]
    new_status: Mapped[str]
    reason: Mapped[str] = mapped_column(Text)
    created_at: Mapped[str]


class OTPChallenge(Base):
    __tablename__ = "otp_challenges"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    email_key: Mapped[str] = mapped_column(String, index=True)
    email: Mapped[str | None] = mapped_column(nullable=True)
    created_at: Mapped[float | None] = mapped_column(nullable=True)
    used_at: Mapped[float | None] = mapped_column(nullable=True)
    delivery_id: Mapped[str | None] = mapped_column(nullable=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    code_hash: Mapped[str]
    expires_at: Mapped[float]
    attempts: Mapped[int] = mapped_column(default=0)
    consumed: Mapped[bool] = mapped_column(default=False)
    ready: Mapped[bool] = mapped_column(default=False)


class AuthRateLimit(Base):
    __tablename__ = "auth_rate_limits"
    key: Mapped[str] = mapped_column(String, primary_key=True)
    count: Mapped[int] = mapped_column(default=0)
    reset_at: Mapped[float] = mapped_column(default=0)
    next_allowed: Mapped[float] = mapped_column(default=0)
