import os, sys, tempfile
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///" + str(Path(tempfile.mkdtemp()) / "test.db")
os.environ["SIMULATE_FEED"] = "false"
os.environ["BOOTSTRAP_PASSWORD"] = "Test-Password-2026!"
sys.path.insert(0, str(Path(__file__).parents[1] / "backend"))
from fastapi.testclient import TestClient
from app.main import app
from app.services.pipeline import now
from app.verification.scoring import distance_km


def login(client, email="admin@byteforce.local", password="Test-Password-2026!"):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text


def test_full_lifecycle_and_websocket():
    with TestClient(app) as c:
        login(c)
        before = c.get("/api/events/WX-10001").json()
        with c.websocket_connect(
            "/ws", headers={"origin": "http://localhost:3000"}
        ) as ws:
            response = c.post(
                "/api/citizen-reports",
                json={
                    "text": "Road completely submerged after heavy rainfall near MVP Colony",
                    "event_type": "Other",
                    "latitude": 17.6868,
                    "longitude": 83.2185,
                    "city": "Visakhapatnam",
                    "district": "Visakhapatnam",
                    "state": "Andhra Pradesh",
                    "severity": "High",
                    "anonymous": True,
                },
            )
            assert response.status_code == 201, response.text
            report = response.json()
            assert report["event_type"] == "Flooding"
            assert report["verification_status"] == "Pending"
            assert report["event_id"] == "WX-10001"
            message = ws.receive_json()
            assert message["report"]["id"] == report["id"]
            e = c.get("/api/events/WX-10001").json()
            assert e["report_count"] == before["report_count"] + 1
            confidence = e["confidence"]
            assert (
                c.post(
                    "/api/reports/" + report["id"] + "/reject", json={"reason": ""}
                ).status_code
                == 422
            )
            r = c.post(
                "/api/reports/" + report["id"] + "/verify",
                json={
                    "status": "Verified",
                    "reason": "Corroborated with field observation",
                },
            )
            assert r.status_code == 200, r.text
            assert ws.receive_json()["type"] == "report.updated"
            assert c.get("/api/events/WX-10001").json()["confidence"] > confidence
            evidence = c.get("/api/reports/" + report["id"] + "/evidence").json()
            assert evidence["audit"][0]["new_status"] == "Verified"
            assert any(r["id"] == report["id"] for r in c.get("/api/reports").json())
            assert c.get("/api/analytics/overview").json()["verified"] >= 73


def test_access_controls_and_invalid_inputs():
    with TestClient(app) as c:
        assert c.get("/api/reports").status_code == 401
        login(c)
        r = c.post(
            "/api/admin/users",
            json={
                "name": "Test Viewer",
                "email": "viewer@test.local",
                "password": "Viewer-Password-2026!",
                "role": "Viewer",
            },
        )
        assert r.status_code == 201
        c.post("/api/auth/logout")
        login(c, "viewer@test.local", "Viewer-Password-2026!")
        assert c.get("/api/reports").status_code == 200
        assert c.get("/api/admin/users").status_code == 403
        assert (
            c.post(
                "/api/reports/RPT-93000/verify", json={"status": "Verified"}
            ).status_code
            == 403
        )
        assert c.get("/api/reports/RPT-93000/evidence").status_code == 403
        assert (
            c.post(
                "/api/ml/classify", json={"text": "Dense fog reduces visibility"}
            ).json()["event_type"]
            == "Fog"
        )
        assert (
            c.post(
                "/api/citizen-reports",
                json={
                    "text": "Road flooded",
                    "latitude": 200,
                    "longitude": 83,
                    "city": "Test",
                    "district": "Test",
                    "state": "Test",
                },
            ).status_code
            == 422
        )
        assert (
            c.post(
                "/api/auth/logout", headers={"origin": "https://untrusted.invalid"}
            ).status_code
            == 403
        )


def test_duplicate_merge_and_export_data():
    with TestClient(app) as c:
        login(c)
        body = {
            "text": "Heavy flooding near MVP Colony, roads completely submerged",
            "latitude": 17.6868,
            "longitude": 83.2185,
            "city": "Visakhapatnam",
            "district": "Visakhapatnam",
            "state": "Andhra Pradesh",
            "severity": "Critical",
        }
        first = c.post("/api/reports", json=body).json()
        second = c.post("/api/reports", json=body).json()
        evidence = c.get("/api/reports/" + second["id"] + "/evidence").json()
        assert any(
            d["id"] == first["id"] and d["similarity"] == 100
            for d in evidence["duplicates"]
        )
        assert (
            c.post(
                "/api/reports/" + second["id"] + "/merge", json={"event_id": "WX-10010"}
            ).status_code
            == 200
        )
        assert c.get("/api/events/WX-10010").json()["report_count"] >= 9
        assert (
            c.get(
                "/api/reports?latitude=17.6868&longitude=83.2185&radius=5"
            ).status_code
            == 200
        )
        assert any(
            a["event_id"] == first["event_id"] for a in c.get("/api/alerts").json()
        )
        assert (
            c.post(
                "/api/media", files={"file": ("bad.png", b"not an image", "image/png")}
            ).status_code
            == 415
        )
        assert c.get("/api/health").json()["status"] == "Operational"
        assert distance_km(17.6868, 83.2185, 17.687, 83.2186) < 0.1


def test_admin_policy_and_audit():
    with TestClient(app) as c:
        login(c)
        config = c.get("/api/admin/configuration").json()
        config["coordinates_weight"] = 17
        assert c.patch("/api/admin/configuration", json=config).status_code == 200
        assert c.get("/api/admin/configuration").json()["coordinates_weight"] == 17
        assert c.get("/api/admin/logs").json()[0]["action"] == "configuration.updated"
        config["fusion_radius_km"] = 500
        assert c.patch("/api/admin/configuration", json=config).status_code == 422
        health = c.get("/api/health").json()
        assert health["process_memory_mb"] > 0 and health["review_queue_length"] >= 0


def test_outbox_survives_transport_failure_and_rollback():
    import asyncio
    import json
    from sqlalchemy import create_engine, select, func
    from sqlalchemy.orm import sessionmaker
    from app.database.session import Base
    from app.models.entities import OutboxMessage
    from app.streaming.outbox import enqueue, dispatch_pending

    engine = create_engine("sqlite:///" + str(Path(tempfile.mkdtemp()) / "outbox.db"))
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    with sessions() as db:
        enqueue(db, {"type": "rolled.back"})
        db.flush()
        db.rollback()
        assert db.scalar(select(func.count()).select_from(OutboxMessage)) == 0
        identifier = enqueue(
            db, {"type": "report.created", "report": {"id": "RPT-TEST"}}
        )
        db.commit()

    async def failing_transport(payload):
        raise ConnectionError("Transport unavailable")

    assert asyncio.run(dispatch_pending(failing_transport, sessions)) == 0
    with sessions() as db:
        row = db.get(OutboxMessage, identifier)
        assert row.delivered_at == "" and row.attempts == 1
        assert row.last_error == "ConnectionError"
        assert row.next_attempt_at > row.created_at
        row.next_attempt_at = ""
        db.commit()
    delivered = []

    async def recovered_transport(payload):
        delivered.append(payload)

    assert asyncio.run(dispatch_pending(recovered_transport, sessions)) == 1
    assert asyncio.run(dispatch_pending(recovered_transport, sessions)) == 0
    assert delivered[0]["message_id"] == identifier
    with sessions() as db:
        row = db.get(OutboxMessage, identifier)
        assert row.delivered_at and row.attempts == 2 and row.last_error == ""
    engine.dispose()


def test_reversing_rejection_reopens_event():
    with TestClient(app) as c:
        login(c)
        report = c.post(
            "/api/reports",
            json={
                "text": "Flood waters submerged the road near the test observation point.",
                "latitude": 30.901,
                "longitude": 75.857,
                "city": "Ludhiana",
                "district": "Ludhiana",
                "state": "Punjab",
                "severity": "High",
            },
        ).json()
        assert (
            c.post(
                "/api/reports/" + report["id"] + "/reject",
                json={"reason": "Insufficient evidence at first review"},
            ).status_code
            == 200
        )
        assert c.get("/api/events/" + report["event_id"]).json()["status"] == "Closed"
        assert (
            c.post(
                "/api/reports/" + report["id"] + "/verify",
                json={
                    "status": "Verified",
                    "reason": "New evidence confirms the observation",
                },
            ).status_code
            == 200
        )
        event = c.get("/api/events/" + report["event_id"]).json()
        assert event["status"] == "Active" and event["confidence"] == 0.98


def test_archived_alert_does_not_suppress_new_warning():
    with TestClient(app) as c:
        login(c)
        original = c.get("/api/admin/configuration").json()
        config = {**original, "alert_severity": "High"}
        assert c.patch("/api/admin/configuration", json=config).status_code == 200
        body = {
            "text": "Thunderstorm observed near the test weather station.",
            "latitude": 26.4499,
            "longitude": 80.3319,
            "city": "Kanpur",
            "district": "Kanpur Nagar",
            "state": "Uttar Pradesh",
            "severity": "High",
        }
        first = c.post("/api/reports", json=body).json()
        alert = next(
            a for a in c.get("/api/alerts").json() if a["event_id"] == first["event_id"]
        )
        assert alert["level"] == "Warning"
        assert (
            c.patch(
                "/api/alerts/" + alert["id"], json={"status": "Archived"}
            ).status_code
            == 200
        )
        second = c.post("/api/reports", json={**body, "severity": "Critical"}).json()
        assert second["event_id"] == first["event_id"]
        active = [
            a
            for a in c.get("/api/alerts").json()
            if a["event_id"] == first["event_id"] and a["status"] == "Open"
        ]
        assert len(active) == 1 and active[0]["level"] == "Critical"
        assert any(
            l["action"] == "alert.updated" for l in c.get("/api/admin/logs").json()
        )
        c.patch("/api/admin/configuration", json=original)


def test_rejected_and_suspicious_evidence_cannot_corroborate():
    from types import SimpleNamespace
    from app.schemas.payloads import ReportIn
    from app.verification.scoring import analyse

    data = ReportIn(
        text="Flood water covers this road.",
        latitude=17.68,
        longitude=83.21,
        city="Visakhapatnam",
        district="Visakhapatnam",
        state="Andhra Pradesh",
        event_type="Flooding",
    )
    evidence = [
        SimpleNamespace(
            id="REJECTED",
            text="Flood water covers this road.",
            event_type="Flooding",
            source_type="Official",
            verification_status="Rejected",
            event_id="WX-TEST",
        ),
        SimpleNamespace(
            id="FLAGGED",
            text="Nearby road submerged.",
            event_type="Flooding",
            source_type="Citizen",
            verification_status="Suspicious",
            event_id="WX-TEST",
        ),
    ]
    result = analyse(data, evidence)
    assert result["evidence"][0]["points"] == 0
    assert result["evidence"][1]["points"] == 0
    assert result["duplicates"]  # Adverse duplicate evidence must still be visible.


def test_configured_radius_applies_to_evidence_endpoint():
    with TestClient(app) as c:
        login(c)
        original = c.get("/api/admin/configuration").json()
        config = {**original, "fusion_radius_km": 10, "fusion_window_hours": 12}
        assert c.patch("/api/admin/configuration", json=config).status_code == 200
        data = {
            "text": "Flooding reported near a suburban road.",
            "latitude": 17.76,
            "longitude": 83.2185,
            "city": "Visakhapatnam",
            "district": "Visakhapatnam",
            "state": "Andhra Pradesh",
            "event_type": "Flooding",
        }
        assessment = c.post("/api/verification/analyse", json=data).json()
        assert assessment["evidence"][0]["points"] == config["official_weight"]
        assert "10.0 km / 12 hours" in assessment["evidence"][1]["detail"]
        c.patch("/api/admin/configuration", json=original)


def test_observation_timestamps_are_normalized_for_spatial_windows():
    from app.schemas.payloads import ReportIn
    from datetime import datetime, timezone, timedelta

    stamp = datetime.now(timezone.utc) - timedelta(hours=1)
    local = stamp.astimezone(timezone(timedelta(hours=5, minutes=30)))
    row = ReportIn(
        text="Rainfall observed near the test station.",
        latitude=17,
        longitude=83,
        city="Visakhapatnam",
        district="Visakhapatnam",
        state="Andhra Pradesh",
        timestamp=local.isoformat(),
    )
    assert row.timestamp == stamp.isoformat()


def test_event_operations_notes_permissions_and_conflict():
    with TestClient(app) as c:
        login(c)
        report = c.post(
            "/api/reports",
            json={
                "text": "Flood waters cover the road at the field observation point.",
                "latitude": 27.1767,
                "longitude": 78.0081,
                "city": "Agra",
                "district": "Agra",
                "state": "Uttar Pradesh",
                "severity": "Critical",
            },
        ).json()
        event_id = report["event_id"]
        note = c.post(
            "/api/events/" + event_id + "/notes",
            json={"text": "Field team assigned to check water levels."},
        )
        assert note.status_code == 201
        invalid = c.patch(
            "/api/events/" + event_id + "/status",
            json={"status": "Resolved", "expected_status": "Active", "reason": "     "},
        )
        assert invalid.status_code == 422
        resolved = c.patch(
            "/api/events/" + event_id + "/status",
            json={
                "status": "Resolved",
                "expected_status": "Active",
                "reason": "Field team confirms water has receded.",
            },
        )
        assert resolved.status_code == 200
        detail = c.get("/api/events/" + event_id).json()
        assert detail["status"] == "Resolved"
        assert all(a["status"] == "Resolved" for a in detail["alerts"])
        assert any(t["action"] == "Officer note" for t in detail["timeline"])
        assert any(t["new_status"] == "Resolved" for t in detail["timeline"])
        assert (
            c.patch(
                "/api/events/" + event_id + "/status",
                json={
                    "status": "Archived",
                    "expected_status": "Active",
                    "reason": "Outdated officer view must not overwrite.",
                },
            ).status_code
            == 409
        )
        # Reviewing a report must not undo an explicit event resolution.
        assert (
            c.post(
                "/api/reports/" + report["id"] + "/verify",
                json={
                    "status": "Verified",
                    "reason": "Verified historical observation.",
                },
            ).status_code
            == 200
        )
        assert c.get("/api/events/" + event_id).json()["status"] == "Resolved"
        assert (
            c.patch(
                "/api/events/" + event_id + "/status",
                json={
                    "status": "Active",
                    "expected_status": "Resolved",
                    "reason": "New field evidence requires renewed monitoring.",
                },
            ).status_code
            == 200
        )
        viewer_email = "event-viewer@test.local"
        c.post(
            "/api/admin/users",
            json={
                "name": "Event Viewer",
                "email": viewer_email,
                "password": "Viewer-Password-2026!",
                "role": "Viewer",
            },
        )
        c.post("/api/auth/logout")
        login(c, viewer_email, "Viewer-Password-2026!")
        assert c.get("/api/events/" + event_id).status_code == 200
        assert (
            c.post(
                "/api/events/" + event_id + "/notes",
                json={"text": "Viewer must not add operational notes."},
            ).status_code
            == 403
        )
        assert (
            c.patch(
                "/api/events/" + event_id + "/status",
                json={
                    "status": "Archived",
                    "expected_status": "Active",
                    "reason": "Viewer must not change lifecycle state.",
                },
            ).status_code
            == 403
        )
