from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session
from app.api.auth import reviewer
from app.database.session import get_db
from app.models.entities import Event, EventLog, Report, Alert
from app.schemas.payloads import EventDecision, EventNote
from app.services.pipeline import now, record
from app.streaming.outbox import enqueue

router = APIRouter(prefix="/api/events", tags=["Event operations"])


@router.patch("/{event_id}/status")
def change_status(
    event_id: str,
    data: EventDecision,
    db: Session = Depends(get_db),
    user=Depends(reviewer),
):
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(404, "Event not found")
    if event.status != data.expected_status:
        raise HTTPException(
            409, "Event status has changed. Refresh and review the latest status."
        )
    if event.status == data.status:
        raise HTTPException(409, "Event already has this status")
    if data.status == "Active" and not db.scalar(
        select(Report.id)
        .where(Report.event_id == event_id, Report.verification_status != "Rejected")
        .limit(1)
    ):
        raise HTTPException(
            422, "An event needs at least one non-rejected report before reopening"
        )
    stamp = now()
    # Compare-and-swap prevents two officers overwriting the same state transition.
    result = db.execute(
        update(Event)
        .where(Event.id == event_id, Event.status == data.expected_status)
        .values(status=data.status, last_updated=stamp)
    )
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(
            409, "Another officer changed this event. Refresh before continuing."
        )
    db.add(
        EventLog(
            id=uuid4().hex,
            event_id=event_id,
            actor=user.name,
            action="Status changed",
            old_status=data.expected_status,
            new_status=data.status,
            reason=data.reason,
            created_at=stamp,
        )
    )
    resolved_alerts = []
    if data.status in ["Resolved", "Archived"]:
        for alert in db.scalars(
            select(Alert).where(
                Alert.event_id == event_id,
                Alert.status.not_in(["Resolved", "Archived"]),
            )
        ):
            alert.status = "Resolved"
            resolved_alerts.append(alert.id)
    if resolved_alerts:
        db.add(
            EventLog(
                id=uuid4().hex,
                event_id=event_id,
                actor=user.name,
                action="Related alerts resolved",
                old_status="",
                new_status="",
                reason=", ".join(resolved_alerts),
                created_at=stamp,
            )
        )
    enqueue(db, {"type": "event.updated", "event_id": event_id})
    db.commit()
    db.refresh(event)
    return record(event)


@router.post("/{event_id}/notes", status_code=201)
def add_note(
    event_id: str,
    data: EventNote,
    db: Session = Depends(get_db),
    user=Depends(reviewer),
):
    if not db.get(Event, event_id):
        raise HTTPException(404, "Event not found")
    note = EventLog(
        id=uuid4().hex,
        event_id=event_id,
        actor=user.name,
        action="Officer note",
        old_status="",
        new_status="",
        reason=data.text,
        created_at=now(),
    )
    db.add(note)
    db.flush()
    enqueue(db, {"type": "event.updated", "event_id": event_id})
    db.commit()
    return record(note)
