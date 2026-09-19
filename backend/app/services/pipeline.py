from datetime import datetime, timezone, timedelta
from uuid import uuid4
from sqlalchemy import select
from app.models.entities import Report, Event, CitizenReport, Alert
from app.ml.classifier import classify
from app.services.configuration import get_config
from app.verification.scoring import analyse, distance_km
from app.streaming.outbox import enqueue


def now():
    return datetime.now(timezone.utc).isoformat()


def record(obj):
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


def nearby_reports(db, lat, lon, radius=5, window_hours=24):
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=window_hours)).isoformat()
    if db.bind.dialect.name == "postgresql":
        from app.database.geospatial import nearby_postgis

        return nearby_postgis(db, lat, lon, radius, cutoff)
    return [
        r
        for r in db.scalars(select(Report).where(Report.timestamp >= cutoff))
        if distance_km(lat, lon, r.latitude, r.longitude) <= radius
    ]


def refresh_event(db, event_id):
    event = db.get(Event, event_id)
    reports = list(db.scalars(select(Report).where(Report.event_id == event_id)))
    usable = [r for r in reports if r.verification_status != "Rejected"]
    event.report_count = len(reports)
    event.confidence = (
        round(
            sum(
                0.98 if r.verification_status == "Verified" else r.trust_score / 100
                for r in usable
            )
            / len(usable),
            3,
        )
        if usable
        else 0
    )
    event.verification_status = (
        "Verified"
        if any(r.verification_status == "Verified" for r in usable)
        else "Under Review"
    )
    event.last_updated = now()
    if usable:
        if event.status == "Closed":
            event.status = "Active"
        event.severity = max(
            (r.severity for r in usable),
            key=["Low", "Moderate", "High", "Critical"].index,
        )
    elif event.status == "Active":
        event.status = "Closed"
    return event


def ingest(db, data, source="Citizen", source_name="Citizen Reporting Portal"):
    config = get_config(db)
    prediction = classify(data.text)
    if prediction["event_type"] != "Other":
        data.event_type = prediction["event_type"]
    if not data.timestamp:
        data.timestamp = now()
    nearby = nearby_reports(
        db,
        data.latitude,
        data.longitude,
        config["fusion_radius_km"],
        config["fusion_window_hours"],
    )
    assessment = analyse(data, nearby, config)
    cutoff = (
        datetime.now(timezone.utc) - timedelta(hours=config["fusion_window_hours"])
    ).isoformat()
    candidates = list(
        db.scalars(
            select(Event).where(
                Event.event_type == data.event_type,
                Event.status == "Active",
                Event.last_updated >= cutoff,
            )
        )
    )
    event = next(
        (
            e
            for e in candidates
            if distance_km(data.latitude, data.longitude, e.latitude, e.longitude)
            <= config["fusion_radius_km"]
        ),
        None,
    )
    if not event:
        event = Event(
            id="WX-" + uuid4().hex[:8].upper(),
            event_type=data.event_type,
            latitude=data.latitude,
            longitude=data.longitude,
            city=data.city,
            district=data.district,
            state=data.state,
            severity=data.severity,
            confidence=assessment["trust_score"] / 100,
            verification_status="Under Review",
            first_detected=now(),
            last_updated=now(),
            report_count=0,
            status="Active",
        )
        db.add(event)
        db.flush()
    report = Report(
        id="RPT-" + uuid4().hex[:8].upper(),
        source_type=source,
        source_name=source_name,
        text=data.text,
        event_type=data.event_type,
        latitude=data.latitude,
        longitude=data.longitude,
        city=data.city,
        district=data.district,
        state=data.state,
        timestamp=data.timestamp,
        media_url=data.media_url,
        ai_confidence=prediction["confidence"],
        trust_score=assessment["trust_score"],
        verification_status="Pending",
        severity=data.severity,
        event_id=event.id,
        duplicate_group_id=assessment["duplicates"][0]["id"]
        if assessment["duplicates"]
        else "",
        created_at=now(),
    )
    db.add(report)
    if source == "Citizen":
        db.add(
            CitizenReport(
                id="CIT-" + uuid4().hex[:8],
                weather_report_id=report.id,
                reporter_name="" if data.anonymous else data.reporter_name,
                reporter_contact="" if data.anonymous else data.reporter_contact,
                anonymous=data.anonymous,
                description=data.text,
            )
        )
    db.flush()
    refresh_event(db, event.id)
    if ["Low", "Moderate", "High", "Critical"].index(data.severity) >= [
        "Low",
        "Moderate",
        "High",
        "Critical",
    ].index(config["alert_severity"]) and not db.scalar(
        select(Alert).where(
            Alert.event_id == event.id, Alert.status.not_in(["Resolved", "Archived"])
        )
    ):
        db.add(
            Alert(
                id="ALT-" + uuid4().hex[:6].upper(),
                event_id=event.id,
                level="Critical" if data.severity == "Critical" else "Warning",
                message=f"{data.event_type} reported in {data.city}. Verification and field assessment required.",
                status="Open",
                created_at=now(),
            )
        )
    enqueue(db, {"type": "report.created", "report": record(report)})
    db.commit()
    return report
