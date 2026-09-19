"""PostGIS adapter; SQLite uses the tested haversine fallback."""

from sqlalchemy import text
from app.models.entities import Report


def nearby_postgis(db, lat, lon, radius, cutoff):
    ids = db.execute(
        text(
            "SELECT id FROM weather_reports WHERE timestamp >= :cutoff AND ST_DWithin(location, ST_SetSRID(ST_MakePoint(:lon,:lat),4326)::geography,:metres)"
        ),
        {"lat": lat, "lon": lon, "metres": radius * 1000, "cutoff": cutoff},
    ).scalars()
    return [db.get(Report, report_id) for report_id in ids]
