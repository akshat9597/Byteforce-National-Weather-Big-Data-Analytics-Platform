import json
from app.models.entities import Configuration

DEFAULTS = {
    "official_weight": 25,
    "nearby_weight": 20,
    "coordinates_weight": 15,
    "recent_weight": 10,
    "duplicate_penalty": -15,
    "fusion_radius_km": 5,
    "fusion_window_hours": 24,
    "alert_severity": "Critical",
}


def get_config(db):
    result = dict(DEFAULTS)
    for key in DEFAULTS:
        row = db.get(Configuration, key)
        if row:
            result[key] = json.loads(row.value)
    return result
