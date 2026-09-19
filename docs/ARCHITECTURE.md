# BYTEFORCE architecture

The Next.js application is the operational client. Browser REST requests use the same-origin `/api` proxy; a credentialed WebSocket on `/ws` carries report-change notifications. The UI re-fetches authoritative records after each change. A 30-second polling fallback recovers missed notifications. User preferences alone use browser storage; records and audit logs are persisted by SQLAlchemy.

## Report lifecycle

1. Pydantic validates input and observation timestamps.
2. The isolated deterministic classifier resolves weather categories from text.
3. Spatial lookup identifies recent evidence. PostgreSQL uses indexed `ST_DWithin`; SQLite uses a haversine fallback.
4. Trust scoring records evidence weights, possible lexical duplicates and an intake score.
5. Fusion finds an active event of the same class in the configured time/radius window, or creates an event.
6. Report, citizen metadata, event changes and a durable outbox notification commit together.
7. A single-worker outbox dispatcher appends to Redis Streams when configured and broadcasts to connected clients. Failed deliveries retry with exponential backoff capped at 256 seconds; successful deliveries are marked durably. Stable message IDs support deduplication after a crash between publish and acknowledgement.
8. An authenticated officer reviews evidence. Rejection and suspicious flags require reasons.
9. The decision, audit entry and notification commit together; event confidence is recomputed from non-rejected reports.
10. A change message refreshes reports, events, alerts and client-side analytics.

An officer verification raises that report's contribution to event confidence to 0.98; unverified reports contribute their intake trust score. This is a transparent development heuristic, not a calibrated probability. Changing policy affects new intake scores, not historical scores.

## GIS

`database/postgis.sql` adds generated geography columns and GiST indexes after base tables exist. Coordinates remain ordinary typed columns for portable development. A district boundary table is provided, but authoritative boundaries are not bundled: import licensed official boundary data before enabling district containment analysis. The operational district filter currently uses submitted district names.

## ML boundaries

`ml/classifier.py` provides the classification contract. `verification/scoring.py` implements lexical similarity and explainable scoring. Replace the classifier with TF-IDF/logistic regression or a transformer without changing callers. Replace lexical deduplication with sentence embeddings and cosine similarity; add image pHash/CLIP and metadata validation behind an evidence-provider contract. The current application deliberately awards no media-reliability points and does not claim forensic verification.

## Streaming and scaling

This release supports one API worker for WebSocket fan-out and simulation. Redis XADD persists bounded stream history when enabled, but cross-worker consumers and acknowledgement groups are not implemented. A transactional outbox relay is implemented for the single worker. Before horizontal scaling, introduce independent ingestion workers, exclusive outbox claims, Redis consumer groups and request idempotency keys. The publisher boundary can then target Kafka. Move analytical aggregates to asynchronous consumers, add partitioned PostgreSQL retention, object storage for media, and Elasticsearch for full-text retrieval. Spark/Flink are later stream-processing choices, not runtime dependencies.

## Security boundary

Passwords use Argon2. Sessions use signed expiring JWTs in HttpOnly, SameSite cookies. Roles are checked in API dependencies, independently of hidden navigation. State-changing browser requests enforce allowed origins. Uploaded files are size-limited, signature-checked and served only to authenticated users. Contact fields are omitted when anonymous and never included in report APIs.

The development service needs additional operational hardening before an Internet-facing deployment: SSO/MFA, distributed rate limiting and abuse protection for the public citizen endpoint, malware scanning, storage quotas, retention and consent policies, TLS reverse proxy, managed secrets, session revocation, backup/restore exercises, and external monitoring. Login throttling is process-local. Run database migrations as a privileged one-shot deployment job rather than granting the runtime schema privileges.

## Evidence and event state

Rejected and Suspicious reports remain visible for duplicate review but do not earn positive corroboration points. Evidence endpoints use the configured radius and temporal window. Restoring a usable report to a closed event reopens the event. High-severity threshold alerts are Warning level; Critical observations create Critical alerts. Archived and resolved alerts do not suppress new alerts.
