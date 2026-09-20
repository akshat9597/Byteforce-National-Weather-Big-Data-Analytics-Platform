import asyncio, os, time, logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from collections import Counter, defaultdict
from pathlib import Path
from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    Response,
    Request,
    WebSocket,
    WebSocketDisconnect,
    UploadFile,
    File,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from pwdlib import PasswordHash
from app.database.session import Base, engine, SessionLocal, get_db
from app.models.entities import *
from app.schemas.payloads import *
from app.api.event_workflow import router as event_router
from app.api.auth import current_user, reviewer, admin, token, SECRET, set_session
from app.api.otp_auth import router as otp_router
from app.services.configuration import get_config
from app.services.pipeline import ingest, record, now, nearby_reports, refresh_event
from app.services.seed import seed, CITIES, TEXTS, KINDS
from app.ml.classifier import classify
from app.verification.scoring import analyse, distance_km
from app.streaming.hub import hub
from app.streaming.outbox import enqueue, run_dispatcher
from app.utils.telemetry import record_request, snapshot
import jwt

START = time.monotonic()
LOGIN_ATTEMPTS = defaultdict(list)


async def simulate():
    index = 0
    while True:
        await asyncio.sleep(14)
        try:
            city, district, state, lat, lon = CITIES[index % len(CITIES)]
            kind = KINDS[index % len(KINDS)]
            with SessionLocal() as db:
                r = ingest(
                    db,
                    ReportIn(
                        text=TEXTS[kind] + " " + city,
                        latitude=lat,
                        longitude=lon,
                        city=city,
                        district=district,
                        state=state,
                        event_type=kind,
                    ),
                    source="Social",
                    source_name="Simulated public feed",
                )
            index += 1
        except Exception:
            logging.exception("Simulation failed")


@asynccontextmanager
async def lifespan(app):
    Base.metadata.create_all(engine)
    from app.database.migrate_auth import migrate

    migrate(engine)
    if engine.dialect.name == "postgresql":
        sql = Path(__file__).parent / "database" / "postgis.sql"
        with engine.begin() as connection:
            for statement in "\n".join(
                line
                for line in sql.read_text().splitlines()
                if not line.strip().startswith("--")
            ).split(";"):
                if (
                    statement.strip()
                    and not statement.strip().startswith("-- Radius")
                    and not statement.strip().startswith("-- District")
                ):
                    connection.execute(text(statement))
    with SessionLocal() as db:
        seed(db)
    task = (
        asyncio.create_task(simulate())
        if os.getenv("SIMULATE_FEED", "true") == "true"
        else None
    )
    dispatcher = asyncio.create_task(run_dispatcher(hub.publish))
    try:
        yield
    finally:
        tasks = [dispatcher] + ([task] if task else [])
        for running in tasks:
            running.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        if hub.redis:
            await hub.redis.aclose()
            hub.redis = None


app = FastAPI(
    title="BYTEFORCE Weather Intelligence API", version="1.0.0", lifespan=lifespan
)
app.include_router(event_router)
app.include_router(otp_router)
from app.api.accounts import router as account_router

app.include_router(account_router)


from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.responses import JSONResponse


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    if request.url.path.startswith("/api/auth/"):
        return JSONResponse(
            {
                "detail": "Please enter a valid email address and six-digit code where required."
            },
            status_code=422,
        )
    return await request_validation_exception_handler(request, exc)


app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv(
        "ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def safety(request, call_next):
    request_started = time.monotonic()
    if request.method in ["POST", "PATCH", "DELETE"]:
        origin = request.headers.get("origin")
        allowed = os.getenv(
            "ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
        ).split(",")
        if origin and origin not in allowed:
            return JSONResponse({"detail": "Origin not allowed"}, status_code=403)
    # Guest identity is signed server-side; every guest query uses a separate store.
    request.state.guest = False
    raw = request.cookies.get("byteforce_session")
    if raw:
        try:
            claims = jwt.decode(raw, SECRET, algorithms=["HS256"])
            request.state.guest = claims.get("guest") is True
        except jwt.InvalidTokenError:
            pass
    if request.state.guest:
        from app.services.guest import enabled

        path = request.url.path
        if not enabled() and path != "/api/auth/logout":
            return JSONResponse(
                {"detail": "Guest access is disabled."}, status_code=401
            )
        if request.method not in ("GET", "HEAD", "OPTIONS") and path not in (
            "/api/auth/logout",
            "/api/auth/guest",
        ):
            return JSONResponse(
                {
                    "detail": "Guest preview is read-only. Sign in with your own account to make changes."
                },
                status_code=403,
            )
        if path.startswith("/api/media/") or path == "/api/health":
            return JSONResponse(
                {
                    "detail": "Production media and system health are not available in guest preview."
                },
                status_code=403,
            )
    response = await call_next(request)
    record_request(request_started)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    if request.url.path.startswith("/api/auth/"):
        response.headers["Cache-Control"] = "no-store"
    return response


from typing import Literal
from pydantic import BaseModel, ConfigDict


class GuestLogin(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["Administrator", "Viewer"]


@app.get("/api/auth/guest-options")
def guest_options():
    from app.services.guest import enabled

    return {"enabled": enabled()}


@app.post("/api/auth/guest")
def guest_login(data: GuestLogin, response: Response, request: Request):
    from app.services.guest import enabled, sessions

    if not enabled():
        raise HTTPException(403, "Guest access is disabled.")
    key = "guest:" + request.client.host
    current = time.monotonic()
    LOGIN_ATTEMPTS[key] = [t for t in LOGIN_ATTEMPTS[key] if current - t < 300]
    if len(LOGIN_ATTEMPTS[key]) >= 20:
        raise HTTPException(429, "Too many guest sessions. Try again in five minutes.")
    LOGIN_ATTEMPTS[key].append(current)
    with sessions()() as db:
        user = db.get(User, "GUEST-" + data.role)
        set_session(response, user, guest=True)
        return {
            **{k: v for k, v in record(user).items() if k != "password_hash"},
            "is_guest": True,
        }


@app.post("/api/auth/login")
def login(
    data: Login, response: Response, request: Request, db: Session = Depends(get_db)
):
    key = request.client.host
    current = time.monotonic()
    LOGIN_ATTEMPTS[key] = [t for t in LOGIN_ATTEMPTS[key] if current - t < 300]
    if len(LOGIN_ATTEMPTS[key]) >= 10:
        raise HTTPException(429, "Too many attempts. Try again in five minutes.")
    LOGIN_ATTEMPTS[key].append(current)
    u = db.scalar(select(User).where(User.email == data.email.lower()))
    try:
        valid = u and PasswordHash.recommended().verify(data.password, u.password_hash)
    except Exception:
        valid = False
    if not valid:
        raise HTTPException(401, "Incorrect email or password")
    LOGIN_ATTEMPTS.pop(key, None)
    u.last_login_at = now()
    from app.services.otp import audit

    # Password login remains usable even when OTP is not configured.
    audit(db, "user.logged_in", u.id)
    db.commit()
    set_session(response, u)
    return {k: v for k, v in record(u).items() if k != "password_hash"}


@app.post("/api/auth/logout")
def logout(response: Response, request: Request, db: Session = Depends(get_db)):
    from app.services.otp import audit

    try:
        user = current_user(request, db)
    except HTTPException:
        user = None
    if user and not getattr(request.state, "guest", False):
        audit(db, "user.logged_out", user.id)
        db.commit()
    response.delete_cookie(
        "byteforce_session",
        httponly=True,
        samesite="lax",
        secure=os.getenv("APP_ENV") == "production",
    )
    return {"ok": True}


@app.get("/api/auth/me")
def me(request: Request, u=Depends(current_user)):
    return {
        **{k: v for k, v in record(u).items() if k != "password_hash"},
        "is_guest": getattr(request.state, "guest", False),
    }


@app.get("/api/events")
@app.get("/api/map/events")
def events(
    q: str = "",
    state: str = "",
    severity: str = "",
    db: Session = Depends(get_db),
    u=Depends(current_user),
):
    rows = list(db.scalars(select(Event).order_by(Event.last_updated.desc())))
    return [
        record(e)
        for e in rows
        if (not state or e.state == state)
        and (not severity or e.severity == severity)
        and (
            not q
            or q.lower()
            in f"{e.id} {e.city} {e.district} {e.state} {e.event_type}".lower()
        )
    ]


@app.get("/api/events/{event_id}")
def event(event_id: str, db: Session = Depends(get_db), u=Depends(current_user)):
    e = db.get(Event, event_id)
    if not e:
        raise HTTPException(404, "Event not found")
    reports = list(db.scalars(select(Report).where(Report.event_id == event_id)))
    return {
        **record(e),
        "reports": [record(r) for r in reports],
        "sources": dict(Counter(r.source_type for r in reports)),
        "timeline": [
            record(log)
            for log in db.scalars(
                select(EventLog)
                .where(EventLog.event_id == event_id)
                .order_by(EventLog.created_at.desc(), EventLog.id.desc())
            )
        ],
        "alerts": [
            record(a)
            for a in db.scalars(select(Alert).where(Alert.event_id == event_id))
        ],
        "fusion_policy": {
            k: v for k, v in get_config(db).items() if k.startswith("fusion_")
        },
    }


@app.get("/api/reports")
def reports(
    q: str = "",
    state: str = "",
    status: str = "",
    latitude: float | None = None,
    longitude: float | None = None,
    radius: float = 5,
    db: Session = Depends(get_db),
    u=Depends(current_user),
):
    rows = list(
        db.scalars(select(Report).order_by(Report.created_at.desc()).limit(5000))
    )
    return [
        record(r)
        for r in rows
        if (not state or r.state == state)
        and (not status or r.verification_status == status)
        and (
            not q
            or q.lower()
            in f"{r.id} {r.city} {r.district} {r.state} {r.text} {r.event_type}".lower()
        )
        and (
            latitude is None
            or longitude is None
            or distance_km(latitude, longitude, r.latitude, r.longitude)
            <= max(0, min(radius, 500))
        )
    ]


@app.post("/api/reports", status_code=201)
@app.post("/api/citizen-reports", status_code=201)
async def create_report(data: ReportIn, db: Session = Depends(get_db)):
    if data.media_url and not data.media_url.startswith("/api/media/"):
        raise HTTPException(400, "Use an uploaded media file")
    r = ingest(db, data)
    return record(r)


@app.post("/api/ml/classify")
def ml(data: TextIn, u=Depends(current_user)):
    return classify(data.text)


@app.post("/api/verification/analyse")
def analysis(data: ReportIn, db: Session = Depends(get_db), u=Depends(reviewer)):
    config = get_config(db)
    return analyse(
        data,
        nearby_reports(
            db,
            data.latitude,
            data.longitude,
            config["fusion_radius_km"],
            config["fusion_window_hours"],
        ),
        config,
    )


@app.get("/api/reports/{report_id}/evidence")
def evidence(report_id: str, db: Session = Depends(get_db), u=Depends(reviewer)):
    r = db.get(Report, report_id)
    if not r:
        raise HTTPException(404, "Report not found")
    config = get_config(db)
    result = analyse(
        ReportIn(**record(r)),
        [
            n
            for n in nearby_reports(
                db,
                r.latitude,
                r.longitude,
                config["fusion_radius_km"],
                config["fusion_window_hours"],
            )
            if n.id != r.id
        ],
        config,
    )
    result["audit"] = [
        record(l)
        for l in db.scalars(
            select(VerificationLog)
            .where(VerificationLog.report_id == r.id)
            .order_by(VerificationLog.created_at.desc())
        )
    ]
    return result


@app.post("/api/reports/{report_id}/verify")
@app.post("/api/reports/{report_id}/reject")
async def decision(
    report_id: str,
    data: Decision,
    request: Request,
    db: Session = Depends(get_db),
    u=Depends(reviewer),
):
    r = db.get(Report, report_id)
    if not r:
        raise HTTPException(404, "Report not found")
    if request.url.path.endswith("/reject"):
        data.status = "Rejected"
    if data.status in ["Rejected", "Suspicious"] and len(data.reason.strip()) < 5:
        raise HTTPException(422, "Provide a reason of at least 5 characters")
    db.add(
        VerificationLog(
            id=uuid4().hex,
            report_id=r.id,
            reviewed_by=u.name,
            old_status=r.verification_status,
            new_status=data.status,
            reason=data.reason,
            created_at=now(),
        )
    )
    r.verification_status = data.status
    db.flush()
    refresh_event(db, r.event_id)
    enqueue(db, {"type": "report.updated", "report": record(r)})
    db.commit()
    return record(r)


@app.post("/api/reports/{report_id}/merge")
async def merge(
    report_id: str, data: MergeIn, db: Session = Depends(get_db), u=Depends(reviewer)
):
    r = db.get(Report, report_id)
    target = db.get(Event, data.event_id)
    if not r or not target:
        raise HTTPException(404, "Report or event not found")
    old = r.event_id
    r.event_id = target.id
    r.duplicate_group_id = ""
    db.add(
        VerificationLog(
            id=uuid4().hex,
            report_id=r.id,
            reviewed_by=u.name,
            old_status=old,
            new_status=target.id,
            reason="Merged into event",
            created_at=now(),
        )
    )
    db.flush()
    refresh_event(db, old)
    refresh_event(db, target.id)
    enqueue(db, {"type": "report.updated", "report": record(r)})
    db.commit()
    return record(r)


@app.post("/api/reports/{report_id}/keep-separate")
def separate(report_id: str, db: Session = Depends(get_db), u=Depends(reviewer)):
    r = db.get(Report, report_id)
    if not r:
        raise HTTPException(404, "Report not found")
    r.duplicate_group_id = ""
    db.add(
        VerificationLog(
            id=uuid4().hex,
            report_id=r.id,
            reviewed_by=u.name,
            old_status=r.verification_status,
            new_status=r.verification_status,
            reason="Duplicate reviewed: kept separate",
            created_at=now(),
        )
    )
    enqueue(db, {"type": "report.updated", "report": record(r)})
    db.commit()
    return record(r)


@app.get("/api/analytics/overview")
def analytics(db: Session = Depends(get_db), u=Depends(current_user)):
    rows = list(db.scalars(select(Report)))
    events = list(db.scalars(select(Event)))
    today = datetime.now(timezone.utc).date().isoformat()
    return {
        "total": sum(r.created_at.startswith(today) for r in rows),
        "verified": sum(r.verification_status == "Verified" for r in rows),
        "events": sum(e.status == "Active" for e in events),
        "review": sum(
            r.verification_status in ["Pending", "Under Review"] for r in rows
        ),
        "suspicious": sum(r.verification_status == "Suspicious" for r in rows),
        "critical": sum(
            a.status not in ["Resolved", "Archived"] for a in db.scalars(select(Alert))
        ),
        "categories": dict(Counter(r.event_type for r in rows)),
        "sources": dict(Counter(r.source_type for r in rows)),
    }


@app.get("/api/analytics/states")
def states(db: Session = Depends(get_db), u=Depends(current_user)):
    rows = list(db.scalars(select(Report)))
    result = []
    for state in sorted(set(r.state for r in rows)):
        subset = [r for r in rows if r.state == state]
        result.append(
            {
                "state": state,
                "reports": len(subset),
                "events": len(set(r.event_id for r in subset)),
                "verified": sum(r.verification_status == "Verified" for r in subset),
                "high": sum(r.severity in ["High", "Critical"] for r in subset),
            }
        )
    return result


@app.get("/api/alerts")
def alerts(db: Session = Depends(get_db), u=Depends(current_user)):
    return [
        {**record(a), "event": record(db.get(Event, a.event_id))}
        for a in db.scalars(select(Alert).order_by(Alert.created_at.desc()))
    ]


@app.patch("/api/alerts/{alert_id}")
def update_alert(
    alert_id: str, data: AlertAction, db: Session = Depends(get_db), u=Depends(reviewer)
):
    a = db.get(Alert, alert_id)
    if not a:
        raise HTTPException(404, "Alert not found")
    if data.status == "Assigned" and not data.assigned_to.strip():
        raise HTTPException(422, "Assignee is required")
    previous = a.status
    a.status = data.status
    a.assigned_to = data.assigned_to or a.assigned_to
    import json

    db.add(
        SystemLog(
            id=uuid4().hex,
            actor=u.name,
            action="alert.updated",
            detail=json.dumps(
                {
                    "alert_id": a.id,
                    "previous_status": previous,
                    "status": a.status,
                    "assigned_to": a.assigned_to,
                }
            ),
            created_at=now(),
        )
    )
    enqueue(db, {"type": "alert.updated", "alert_id": a.id})
    db.commit()
    return record(a)


@app.get("/api/sources/status")
def sources(db: Session = Depends(get_db), u=Depends(current_user)):
    rows = list(db.scalars(select(Report)))
    return [
        {
            **record(s),
            "records_today": sum(
                r.source_type == s.type and r.created_at[:10] == now()[:10]
                for r in rows
            ),
            "last_sync": max(
                (r.created_at for r in rows if r.source_type == s.type),
                default=s.last_sync,
            ),
            "latency": None,
            "error_rate": None,
        }
        for s in db.scalars(select(DataSource))
    ]


@app.get("/api/admin/users")
def users(db: Session = Depends(get_db), u=Depends(admin)):
    return [
        {k: v for k, v in record(x).items() if k != "password_hash"}
        for x in db.scalars(select(User))
    ]


@app.post("/api/admin/users", status_code=201)
def add_user(data: UserIn, db: Session = Depends(get_db), u=Depends(admin)):
    if db.scalar(select(User).where(User.email == data.email.lower())):
        raise HTTPException(409, "Email already exists")
    row = User(
        id="USR-" + uuid4().hex[:8],
        name=data.name,
        email=data.email.lower(),
        password_hash=PasswordHash.recommended().hash(data.password),
        role=data.role,
        organization=u.organization,
        created_at=now(),
    )
    db.add(row)
    db.commit()
    return {"id": row.id}


@app.get("/api/admin/audit")
def audit(db: Session = Depends(get_db), u=Depends(admin)):
    return [
        record(l)
        for l in db.scalars(
            select(VerificationLog)
            .order_by(VerificationLog.created_at.desc())
            .limit(500)
        )
    ]


@app.get("/api/health")
async def health(db: Session = Depends(get_db)):
    start = time.monotonic()
    db.execute(text("SELECT 1"))
    latency = round((time.monotonic() - start) * 1000, 2)
    redis_status = "Not configured"
    if hub.redis:
        try:
            await hub.redis.ping()
            redis_status = "Operational"
        except Exception:
            redis_status = "Degraded"
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    from sqlalchemy import func

    ingestion = db.scalar(
        select(func.count()).select_from(Report).where(Report.created_at >= cutoff)
    )
    queue = db.scalar(
        select(func.count())
        .select_from(Report)
        .where(Report.verification_status.in_(["Pending", "Under Review"]))
    )
    pending = db.scalar(
        select(func.count())
        .select_from(OutboxMessage)
        .where(OutboxMessage.delivered_at == "")
    )
    retrying = db.scalar(
        select(func.count())
        .select_from(OutboxMessage)
        .where(OutboxMessage.delivered_at == "", OutboxMessage.attempts > 0)
    )
    return {
        **snapshot(),
        "outbox_pending": pending,
        "outbox_retrying": retrying,
        "ingestion_per_minute": ingestion,
        "review_queue_length": queue,
        "status": "Operational",
        "uptime_seconds": round(time.monotonic() - START),
        "database_latency_ms": latency,
        "websocket_clients": len(hub.clients),
        "simulation": os.getenv("SIMULATE_FEED", "true") == "true",
        "services": [
            {"name": "Backend API", "status": "Operational"},
            {
                "name": "Database",
                "status": "Operational",
                "detail": engine.dialect.name,
            },
            {"name": "Redis Streams", "status": redis_status},
            {
                "name": "Streaming Service",
                "status": "Degraded" if retrying else "Operational",
                "detail": f"Durable notifications: {pending} pending, {retrying} retrying · single worker",
            },
            {
                "name": "ML Service",
                "status": "Development",
                "detail": "Deterministic classifier",
            },
            {"name": "Map Service", "status": "External", "detail": "OpenStreetMap"},
            {
                "name": "Weather API",
                "status": "Simulated",
                "detail": "No official credentials configured",
            },
        ],
    }


@app.post("/api/media", status_code=201)
async def upload(file: UploadFile = File(...)):
    allowed = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "video/mp4": ".mp4",
    }
    if file.content_type not in allowed:
        raise HTTPException(415, "Use JPEG, PNG, WebP or MP4")
    content = await file.read(20 * 1024 * 1024 + 1)
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(413, "File must be under 20 MB")
    kind = file.content_type
    valid = (
        (kind == "image/jpeg" and content.startswith(b"\xff\xd8\xff"))
        or (kind == "image/png" and content.startswith(b"\x89PNG\r\n\x1a\n"))
        or (
            kind == "image/webp" and content[:4] == b"RIFF" and content[8:12] == b"WEBP"
        )
        or (kind == "video/mp4" and content[4:8] == b"ftyp")
    )
    if not valid:
        raise HTTPException(415, "File content does not match media type")
    directory = Path(os.getenv("UPLOAD_DIR", "uploads"))
    directory.mkdir(exist_ok=True, parents=True)
    name = uuid4().hex + allowed[kind]
    (directory / name).write_bytes(content)
    return {"url": "/api/media/" + name}


@app.get("/api/media/{name}")
def media(name: str, u=Depends(current_user)):
    if "/" in name or ".." in name:
        raise HTTPException(404)
    path = Path(os.getenv("UPLOAD_DIR", "uploads")) / name
    if not path.is_file():
        raise HTTPException(404)
    return FileResponse(path)


@app.websocket("/ws")
async def websocket(ws: WebSocket):
    try:
        claims = jwt.decode(
            ws.cookies.get("byteforce_session"), SECRET, algorithms=["HS256"]
        )
        if claims.get("guest") is True:
            raise ValueError("Guest sessions cannot subscribe to production reports")
        if ws.headers.get("origin") not in os.getenv(
            "ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
        ).split(","):
            raise ValueError()
    except Exception:
        await ws.close(code=1008)
        return
    await ws.accept()
    hub.clients.add(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        hub.clients.discard(ws)


@app.get("/api/admin/configuration")
def configuration(db: Session = Depends(get_db), u=Depends(admin)):
    from app.services.configuration import get_config

    return get_config(db)


@app.patch("/api/admin/configuration")
def configure(data: ConfigIn, db: Session = Depends(get_db), u=Depends(admin)):
    import json
    from app.services.configuration import get_config

    previous = get_config(db)
    for key, value in data.model_dump().items():
        row = db.get(Configuration, key)
        if row:
            row.value = json.dumps(value)
            row.updated_by = u.name
            row.updated_at = now()
        else:
            db.add(
                Configuration(
                    key=key,
                    value=json.dumps(value),
                    updated_by=u.name,
                    updated_at=now(),
                )
            )
    db.add(
        SystemLog(
            id=uuid4().hex,
            actor=u.name,
            action="configuration.updated",
            detail=json.dumps({"before": previous, "after": data.model_dump()}),
            created_at=now(),
        )
    )
    db.commit()
    return data


@app.get("/api/admin/logs")
def system_logs(db: Session = Depends(get_db), u=Depends(admin)):
    return [
        record(l)
        for l in db.scalars(
            select(SystemLog).order_by(SystemLog.created_at.desc()).limit(500)
        )
    ]


@app.get("/api/analytics/verification-time")
def verification_time(db: Session = Depends(get_db), u=Depends(current_user)):
    durations = []
    for log in db.scalars(
        select(VerificationLog).where(VerificationLog.new_status == "Verified")
    ):
        r = db.get(Report, log.report_id)
        if r:
            durations.append(
                max(
                    0,
                    (
                        datetime.fromisoformat(log.created_at)
                        - datetime.fromisoformat(r.created_at)
                    ).total_seconds()
                    / 60,
                )
            )
    return {
        "average_minutes": round(sum(durations) / len(durations), 1)
        if durations
        else None,
        "sample_count": len(durations),
    }
