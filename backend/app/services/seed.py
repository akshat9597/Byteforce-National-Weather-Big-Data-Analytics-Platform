import os, secrets
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from pwdlib import PasswordHash
from app.models.entities import *
from app.services.pipeline import now

CITIES = [
    ("Visakhapatnam", "Visakhapatnam", "Andhra Pradesh", 17.6868, 83.2185),
    ("Mumbai", "Mumbai", "Maharashtra", 19.076, 72.8777),
    ("New Delhi", "New Delhi", "Delhi", 28.6139, 77.209),
    ("Bhubaneswar", "Khordha", "Odisha", 20.2961, 85.8245),
    ("Chennai", "Chennai", "Tamil Nadu", 13.0827, 80.2707),
    ("Bengaluru", "Bengaluru Urban", "Karnataka", 12.9716, 77.5946),
    ("Ahmedabad", "Ahmedabad", "Gujarat", 23.0225, 72.5714),
    ("Jaipur", "Jaipur", "Rajasthan", 26.9124, 75.7873),
    ("Kolkata", "Kolkata", "West Bengal", 22.5726, 88.3639),
    ("Kochi", "Ernakulam", "Kerala", 9.9312, 76.2673),
    ("Vijayawada", "NTR", "Andhra Pradesh", 16.5062, 80.648),
    ("Guntur", "Guntur", "Andhra Pradesh", 16.3067, 80.4365),
    ("Tirupati", "Tirupati", "Andhra Pradesh", 13.6288, 79.4192),
    ("Kurnool", "Kurnool", "Andhra Pradesh", 15.8281, 78.0373),
    ("Pune", "Pune", "Maharashtra", 18.5204, 73.8567),
    ("Puri", "Puri", "Odisha", 19.8135, 85.8312),
    ("Surat", "Surat", "Gujarat", 21.1702, 72.8311),
    ("Jodhpur", "Jodhpur", "Rajasthan", 26.2389, 73.0243),
]
KINDS = [
    "Flooding",
    "Rainfall",
    "Heatwave",
    "Thunderstorm",
    "Strong Winds",
    "Rainfall",
    "Heatwave",
    "Dust Storm",
    "Thunderstorm",
    "Flooding",
    "Rainfall",
    "Lightning",
    "Fog",
    "Hailstorm",
    "Rainfall",
    "Cyclone",
    "Flooding",
    "Heatwave",
]
TEXTS = {
    "Flooding": "Roads submerged with flood water near the market. Traffic movement is restricted.",
    "Rainfall": "Sustained heavy rainfall observed across the city over the last hour.",
    "Heatwave": "Extreme heat conditions reported during afternoon hours. Outdoor workers affected.",
    "Thunderstorm": "Thunder and heavy showers reported with intermittent power disruption.",
    "Strong Winds": "Strong wind gusts reported along the main road; branches obstructing traffic.",
    "Dust Storm": "Dust storm reducing visibility on arterial roads.",
    "Lightning": "Lightning observed near residential areas during the storm.",
    "Fog": "Dense fog reducing visibility below 200 metres on the highway.",
    "Hailstorm": "Hail reported over surrounding agricultural fields.",
    "Cyclone": "Cyclone conditions developing offshore with strong winds along the coast.",
}


def seed(db):
    if not db.scalar(select(User)):
        password = os.getenv("BOOTSTRAP_PASSWORD") or secrets.token_urlsafe(18)
        if not os.getenv("BOOTSTRAP_PASSWORD"):
            print(
                "BYTEFORCE bootstrap password (save securely): " + password, flush=True
            )
        db.add(
            User(
                id="USR-001",
                name="Aditi Sharma",
                email="admin@byteforce.local",
                password_hash=PasswordHash.recommended().hash(password),
                role="Administrator",
                organization="National Operations Centre",
                created_at=now(),
            )
        )
    if db.scalar(select(Event)):
        db.commit()
        return
    for i, (city, district, state, lat, lon) in enumerate(CITIES):
        kind = KINDS[i]
        severity = [
            "High",
            "Moderate",
            "High",
            "Moderate",
            "Low",
            "Moderate",
            "High",
            "Moderate",
            "High",
            "Critical",
        ][i % 10]
        event_id = f"WX-{10001 + i}"
        t = (datetime.now(timezone.utc) - timedelta(hours=i % 8 + 1)).isoformat()
        db.add(
            Event(
                id=event_id,
                event_type=kind,
                latitude=lat,
                longitude=lon,
                city=city,
                district=district,
                state=state,
                severity=severity,
                confidence=0.82 + (i % 4) * 0.04,
                verification_status="Verified" if i % 3 else "Under Review",
                first_detected=t,
                last_updated=now(),
                report_count=8,
                status="Active",
            )
        )
        db.flush()
        for j in range(8):
            stamp = (
                datetime.now(timezone.utc) - timedelta(minutes=i * 9 + j * 4)
            ).isoformat()
            db.add(
                Report(
                    id=f"RPT-{93000 + i * 8 + j}",
                    source_type=["Citizen", "Social", "Official", "RSS"][j % 4],
                    source_name=[
                        "Citizen Portal",
                        "Public Weather Feed",
                        "IMD connector · simulated",
                        "Regional RSS · simulated",
                    ][j % 4],
                    text=f"{TEXTS[kind]} Location: {city}, {state}. Sector {j + 1}.",
                    event_type=kind,
                    latitude=lat + (j % 3) * 0.003,
                    longitude=lon + (j % 3) * 0.002,
                    city=city,
                    district=district,
                    state=state,
                    timestamp=stamp,
                    media_url="",
                    ai_confidence=0.86 + (j % 3) * 0.04,
                    trust_score=52 + (j * 7) % 45,
                    verification_status=[
                        "Verified",
                        "Verified",
                        "Verified",
                        "Pending",
                        "Under Review",
                        "Verified",
                        "Suspicious",
                        "Rejected",
                    ][j],
                    severity=severity,
                    event_id=event_id,
                    duplicate_group_id="",
                    created_at=stamp,
                )
            )
        if severity in ["High", "Critical"]:
            db.add(
                Alert(
                    id=f"ALT-{2400 + i}",
                    event_id=event_id,
                    level="Critical" if severity == "Critical" else "Warning",
                    message=f"{kind} in {city}. Increased monitoring and field verification recommended.",
                    status="Open",
                    created_at=t,
                )
            )
    for i, name in enumerate(
        [
            "IMD Weather API",
            "Citizen Reporting API",
            "Public Weather Dataset",
            "Social Feed Connector",
            "RSS Connector",
        ]
    ):
        db.add(
            DataSource(
                id=f"SRC-{i + 1}",
                name=name,
                type=["Official", "Citizen", "Dataset", "Social", "RSS"][i],
                status="Simulated" if i != 1 else "Connected",
                last_sync=now(),
                records_today=[36, 36, 0, 36, 36][i],
            )
        )
    db.commit()
