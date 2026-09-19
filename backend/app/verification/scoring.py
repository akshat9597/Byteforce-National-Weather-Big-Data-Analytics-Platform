from datetime import datetime, timezone
from difflib import SequenceMatcher
import math


def distance_km(lat, lon, lat2, lon2):
    a = (
        math.sin(math.radians(lat2 - lat) / 2) ** 2
        + math.cos(math.radians(lat))
        * math.cos(math.radians(lat2))
        * math.sin(math.radians(lon2 - lon) / 2) ** 2
    )
    return 6371 * 2 * math.asin(min(1, math.sqrt(a)))


def similarity(a, b):
    def words(s):
        return set(
            s.lower()
            .replace("flooded", "flood")
            .replace("flooding", "flood")
            .replace("roads", "road")
            .split()
        )

    x, y = words(a), words(b)
    return max(
        SequenceMatcher(None, a.lower(), b.lower()).ratio(),
        len(x & y) / max(1, len(x | y)),
    )


def analyse(data, nearby, config=None):
    from app.services.configuration import DEFAULTS

    config = config or DEFAULTS
    duplicates = [
        {
            "id": r.id,
            "similarity": round(similarity(data.text, r.text) * 100),
            "event_id": r.event_id,
        }
        for r in nearby
        if similarity(data.text, r.text) > 0.6
    ]
    recent = (
        abs(
            (
                datetime.now(timezone.utc)
                - datetime.fromisoformat(data.timestamp.replace("Z", "+00:00"))
            ).total_seconds()
        )
        < 86400
        if data.timestamp
        else True
    )
    corroborating = [
        r for r in nearby if r.verification_status not in ["Rejected", "Suspicious"]
    ]
    official = any(
        r.source_type == "Official" and r.event_type == data.event_type
        for r in corroborating
    )
    evidence = [
        {
            "label": "Official source correlation",
            "points": config["official_weight"] if official else 0,
            "detail": "Nearby simulated official record"
            if official
            else "No corroborating official record",
        },
        {
            "label": "Nearby similar reports",
            "points": config["nearby_weight"]
            if any(r.event_type == data.event_type for r in corroborating)
            else 0,
            "detail": f"{len(corroborating)} eligible reports within {config['fusion_radius_km']} km / {config['fusion_window_hours']} hours",
        },
        {
            "label": "Coordinates supplied",
            "points": config["coordinates_weight"],
            "detail": "Coordinates present; GPS authenticity not established",
        },
        {
            "label": "Recent timestamp",
            "points": config["recent_weight"] if recent else 0,
            "detail": "Within 24 hours" if recent else "Older than 24 hours",
        },
        {
            "label": "Source reliability",
            "points": 0,
            "detail": "New citizen source; reliability not established",
        },
        {
            "label": "Media consistency",
            "points": 0,
            "detail": "Manual review required; image model not configured",
        },
        {
            "label": "Duplicate evidence",
            "points": config["duplicate_penalty"] if duplicates else 0,
            "detail": f"{len(duplicates)} possible matches; lexical comparison",
        },
    ]
    score = max(0, min(100, sum(e["points"] for e in evidence)))
    return {
        "trust_score": score,
        "status": "Likely Verified"
        if score >= 70
        else "Under Review"
        if score >= 40
        else "Unverified",
        "evidence": evidence,
        "duplicates": duplicates,
        "nearby_reports": [r.id for r in nearby],
    }
