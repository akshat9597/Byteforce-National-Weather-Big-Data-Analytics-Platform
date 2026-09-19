-- Applied after the ORM creates its base tables. Safe to run repeatedly.
CREATE EXTENSION IF NOT EXISTS postgis;
ALTER TABLE weather_reports ADD COLUMN IF NOT EXISTS location geography(Point,4326)
 GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude),4326)::geography) STORED;
ALTER TABLE weather_events ADD COLUMN IF NOT EXISTS location geography(Point,4326)
 GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude),4326)::geography) STORED;
CREATE INDEX IF NOT EXISTS reports_location_gist ON weather_reports USING GIST(location);
CREATE INDEX IF NOT EXISTS events_location_gist ON weather_events USING GIST(location);
CREATE INDEX IF NOT EXISTS reports_event_timestamp ON weather_reports(event_id,timestamp);
CREATE INDEX IF NOT EXISTS reports_verification_timestamp ON weather_reports(verification_status,timestamp);
CREATE INDEX IF NOT EXISTS events_category_status ON weather_events(event_type,status);
CREATE TABLE IF NOT EXISTS district_boundaries (
 id text PRIMARY KEY, name text NOT NULL, state text NOT NULL,
 boundary geometry(MultiPolygon,4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS districts_boundary_gist ON district_boundaries USING GIST(boundary);
-- Radius query:
-- SELECT * FROM weather_reports WHERE ST_DWithin(location,
--   ST_SetSRID(ST_MakePoint(:longitude,:latitude),4326)::geography,:radius_m);
-- District query:
-- SELECT e.* FROM weather_events e JOIN district_boundaries d
-- ON ST_Covers(d.boundary,e.location::geometry) WHERE d.id=:district_id;
