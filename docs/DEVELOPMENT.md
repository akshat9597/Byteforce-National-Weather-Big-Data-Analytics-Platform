# BYTEFORCE development and operations guide

**National Weather Intelligence & Analytics Platform**

BYTEFORCE is a locally runnable operational weather workspace for India. It connects citizen observations, simulated source feeds, geospatial event fusion, evidence-based verification and analytical views in one persistent application.

The interface uses a dark operational sidebar, restrained status colours, national map, dense report tables and accountable review workflows. It is not affiliated with IMD or any government agency.

## Features

- Overview with live calculated KPIs, national event map, priority alerts and source charts.
- Live incoming reports with pause/resume, status/source search and CSV/JSON exports.
- Leaflet/OpenStreetMap map, severity markers, clustering, density layer and verification filters.
- Consolidated events, associated reports, confidence, source diversity and activity charts.
- Citizen reporting with coordinate capture, observation time, optional contact details, anonymity and image/video upload.
- Classification, trust scoring, lexical duplicate detection and configurable spatial/temporal event fusion.
- Verification queue, reasoned rejection, suspicious flags, merging and durable audit history.
- Social feed simulation, hashtag filtering, analytics, state/district summaries and alert response actions.
- Role-based sign-in, user creation, editable evidence weights/fusion/alert policies and system logs.
- Service health checks, source registry, persistent storage and WebSocket notifications.
- 144 seeded reports across 18 Indian locations in 10 states and territories, with an optional new observation every 14 seconds.

## Technology stack

Frontend: Next.js 15, React 19, TypeScript, Recharts, Leaflet, OpenStreetMap, Lucide and Radix accessible dialog primitives. Styling uses a custom CSS design system rather than Tailwind/shadcn scaffolding.

Backend: FastAPI, Python, Pydantic, SQLAlchemy, PostgreSQL/PostGIS, optional Redis Streams, Argon2 and JWT sessions. SQLite is the zero-service local development fallback. Docker Compose provides PostgreSQL/PostGIS and Redis.

## Installation and local development

Requirements: Node.js 22 or later, npm, Python 3.12 or later. Docker is optional.

```sh
cp .env.example .env
# Edit BOOTSTRAP_PASSWORD and JWT_SECRET before first start.
./scripts/dev.sh
```

Open [the local workspace](http://localhost:3000). Sign in as `admin@byteforce.local` with your configured bootstrap password. If no bootstrap password is configured, a random password is printed once on initial database creation. Bootstrap variables only create the first account; they do not reset an existing password.


### Backend setup separately

```sh
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
# Export environment variables or load .env in your shell.
.venv/bin/uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

### Frontend setup separately

```sh
npm ci --prefix frontend
npm run dev --prefix frontend
```

The frontend proxies REST calls to `http://127.0.0.1:8000`. WebSockets connect to the same browser hostname on port 8000 by default. Set the frontend environment variables before building if using a reverse proxy or remote backend.

### Database setup

The API creates its tables and seeds only an empty database. SQLite persists to `byteforce.db`. For PostgreSQL, configure `DATABASE_URL=postgresql+psycopg://user:password@host:5432/byteforce`. Startup installs PostGIS geography columns and indexes from `backend/app/database/postgis.sql`; the database role must be authorised to install PostGIS, or an administrator should provision it first.

District boundary geometry storage and query examples are included. Licensed boundary data must be loaded separately. Generated point geography supports indexed radius searches; SQLite falls back to haversine distance.

## Running with Docker

```sh
cp .env.example .env
# Set strong BOOTSTRAP_PASSWORD, JWT_SECRET and a URL-safe POSTGRES_PASSWORD.
docker compose up --build
```

Compose starts the frontend on 3000, backend on 8000, PostGIS and Redis. Database and Redis ports are not exposed to the host. Named volumes persist database, stream and upload data. This Compose file is configured for local HTTP; production HTTPS must set `APP_ENV=production` and appropriate allowed origins.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLAlchemy database URL; SQLite by default |
| `BOOTSTRAP_PASSWORD` | Initial administrator password |
| `JWT_SECRET` | Persistent signing secret; mandatory in production |
| `APP_ENV` | Set `production` for Secure session cookies |
| `ALLOWED_ORIGINS` | Comma-separated browser origins |
| `SIMULATE_FEED` | `true` generates reports every 14 seconds |
| `REDIS_URL` | Optional Redis Streams publisher |
| `UPLOAD_DIR` | Server-side media directory |
| `API_INTERNAL_URL` | Frontend server's REST backend URL |
| `NEXT_PUBLIC_WS_URL` | Browser WebSocket URL; set at build time |
| `POSTGRES_PASSWORD` | Compose database password |

## API documentation

[Interactive OpenAPI documentation](http://localhost:8000/docs) is served by FastAPI. Sign in through the browser first for cookie-authenticated calls, or use `/api/auth/login` with a cookie-preserving API client.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/events`, `/api/events/{id}` | Event list and detail |
| GET | `/api/reports` | Search reports, optionally by radius |
| POST | `/api/reports`, `/api/citizen-reports` | Citizen observation intake |
| POST | `/api/ml/classify` | Deterministic classification |
| POST | `/api/verification/analyse` | Evidence scoring |
| GET | `/api/reports/{id}/evidence` | Evidence, duplicates, audit history |
| POST | `/api/reports/{id}/verify`, `/reject` | Officer decisions |
| POST | `/api/reports/{id}/merge`, `/keep-separate` | Duplicate review |
| GET | `/api/analytics/overview`, `/states`, `/verification-time` | Analytics |
| GET | `/api/map/events` | Map-ready events |
| GET | `/api/sources/status`, `/api/health` | Operations |
| GET/PATCH | `/api/alerts`, `/api/alerts/{id}` | Alert workflow |
| GET/POST | `/api/admin/users` | User management |
| GET/PATCH | `/api/admin/configuration` | Evidence and fusion policy |
| GET | `/api/admin/audit`, `/api/admin/logs` | Audit history |
| POST/GET | `/api/media`, `/api/media/{name}` | Media storage/retrieval |
| WS | `/ws` | Authenticated report notifications |

## AI/ML architecture and data pipeline

The initial classifier is deterministic and isolated behind `classify(text)`. Text deduplication uses lexical similarity. Image forensic verification, sentence embeddings and calibrated confidence models are not installed. The UI identifies these limits and does not label low-confidence observations as fake.

The pipeline validates, classifies, scores, spatially correlates and persists a report together with a durable notification in one transaction. A bounded outbox dispatcher retries failed delivery with exponential backoff. Alert actions are audited and broadcast to other clients. Officers independently verify evidence. Verification changes recalculate event confidence and trigger UI refreshes. See [architecture documentation](ARCHITECTURE.md) for the data flow and scaling boundaries.

Official-source records, social feeds and connector statuses are development simulations. There are no connected government APIs, live social accounts or issued public warnings. Rainfall density is a report-density visualisation, not measured precipitation.

## Folder structure

```text
frontend/
  app/          # Next.js routes and shared theme
  components/   # Shell, map, charts, tables and accessible drawers
  features/     # Domain screens and workflows
  services/     # Typed API client and exports
  hooks/        # REST/WebSocket data lifecycle
  types/        # Shared domain types
backend/app/
  api/          # Authentication and role dependencies
  models/       # SQLAlchemy entities
  schemas/      # Pydantic payloads
  services/     # Intake, seed, fusion and configuration
  ml/           # Classification abstraction
  verification/ # Evidence scoring and duplicate similarity
  streaming/    # WebSocket/Redis publisher
  database/     # Sessions, PostGIS migration and spatial adapter
scripts/        # Development and seed commands
docker/         # Application images
docs/           # Architecture and operating notes
tests/          # API lifecycle and security integration tests
```

## Validation

```sh
.venv/bin/pytest -q tests
npm run build --prefix frontend
```

Tests cover flood intake through WebSocket delivery and verification, confidence/analytics changes, role enforcement, invalid input, required rejection reasons, origin enforcement, duplicates, merging, media validation and radius lookup. Browser checks cover sign-in, navigation and reporting/review flows. Docker/PostGIS must be separately exercised on a host with Docker available.

## Future scaling and production readiness

The application is a working development system with a production-style interface and modular service boundaries. Before use for operational public safety, connect licensed authoritative feeds, validate confidence models, run load/security/accessibility reviews, import district boundaries, introduce managed identity and media scanning, and configure backups, retention and monitoring.

The current broadcaster is single-worker. A transactional outbox provides at-least-once notification delivery with stable message IDs and retries. Redis persists messages but does not yet provide distributed fan-out. Distributed workers and idempotent consumer groups are the next steps before moving ingestion to Kafka, processing to Spark/Flink, retrieval to Elasticsearch and media to object storage. Tables currently return at most 5,000 recent reports; server-side cursor pagination and analytical rollups are necessary at national scale.

### Reliability regression coverage

Additional tests cover transactional notification rollback and retry, reversing a rejection to reopen an event, archived-alert handling, correct Warning/Critical thresholds, adverse evidence exclusion and configurable evidence radius. The health API reports `outbox_pending` and `outbox_retrying`; the Streaming Service row identifies delayed delivery. This dispatcher must run in a single API worker. Delivered outbox rows are retained for inspection; a deployment-specific retention job is still required.

## Event dossiers and response workflow

Open an event from Weather Events, or choose **Open full event dossier** in a map detail panel. Every event has a protected, shareable `/weather-events/{id}` URL containing its associated reports, source distribution, related alerts and officer timeline. Export the associated reports as CSV or the complete dossier as JSON.

Administrators and verification officers can add notes, resolve, archive or reopen an event. State changes require a reason and use an expected-status check to prevent conflicting officer decisions. Resolving or archiving resolves outstanding alerts for that event. Report evidence and history are retained. Subsequent report reviews do not automatically reopen an explicitly resolved or archived event.

Additional endpoints:

- `PATCH /api/events/{id}/status`: `{status, expected_status, reason}`.
- `POST /api/events/{id}/notes`: `{text}`.
- `GET /api/events/{id}` now includes timeline, related alerts and the current fusion policy.

Analytics time-series charts cover 24 hours, 7 days, 30 days or a custom date range. Custom boundaries use India Standard Time, and exports contain the selected observations. The event-category chart counts distinct events. The verification-time summary is explicitly an all-time measure.

Run date-range regression tests with `node --test tests/test_analytics.mjs` (Node 22.18+). Backend integration tests include event notes, lifecycle changes, related-alert resolution, conflicting updates and viewer permissions.

## Email OTP sign-in with Resend

BYTEFORCE reuses its FastAPI authentication, SQLAlchemy users/OTP tables, and eight-hour HttpOnly JWT cookie. Password login remains available. New users are created **only after successful email verification**, with the existing read-only **Viewer** role. Existing names, profiles and roles are preserved. An administrator must assign any elevated role. Viewer access includes the existing read-only weather reports and analytics; anonymous citizen submission remains available.

### Configuration

Install `backend/requirements.txt`. Set these server-only values in `.env` (or deployment secrets):

```dotenv
EMAIL_PROVIDER=resend
RESEND_API_KEY=your-private-resend-key
EMAIL_FROM="BYTEFORCE <onboarding@resend.dev>"
OTP_EXPIRY_MINUTES=5
OTP_RESEND_COOLDOWN_SECONDS=45
OTP_HASH_SECRET=an-independent-random-secret-of-at-least-32-characters
```

Never put real keys in `.env.example`, source code, or variables prefixed `NEXT_PUBLIC_`. Keep the existing `OTP_HASH_SECRET`; rotating it invalidates pending challenges and starts new pseudonymous rate buckets. Restart the backend after changing configuration. The Python Resend SDK uses a ten-second network timeout. No provider credentials, OTPs or raw provider errors are returned to clients or logged by the adapter. The application does not fall back to SMTP when Resend fails.

The sender format uses angle brackets, **not Markdown mail links**. Resend's `onboarding@resend.dev` test sender only delivers to the email associated with your Resend account. To send to other users, verify your domain in Resend and change only:

```dotenv
EMAIL_FROM="BYTEFORCE <auth@byteforce.in>"
```

See [Resend's Python guide](https://resend.com/docs/send-with-python) and [test-sender restrictions](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain). Provider acceptance is distinct from delivery, and delivery is distinct from placement in the inbox; inspect Resend's email dashboard and the recipient inbox/spam folder. A provider message ID is retained on the private OTP row for operational tracing.

### API and controls

- `POST /api/auth/send-otp`: `{email}`. Returns `success`, a generic message, challenge ID, `expires_in`, and `resend_after`; never the code.
- `POST /api/auth/verify-otp`: `{email, otp}`. Consumes the newest challenge, finds/creates the account and sets the existing session cookie.
- `GET /api/auth/me` and `POST /api/auth/logout` retain their existing roles in the application.
- Existing `/api/auth/otp/request` and `/api/auth/otp/verify` are deprecated compatibility aliases backed by the same service, for already-open clients. They are hidden from OpenAPI and can be removed after clients migrate.

Codes are generated cryptographically on the backend, with six digits and no leading zero. An HMAC-SHA256 keyed with an independent server secret protects the low-entropy code at rest; a database dump alone does not enable code guessing. Each code expires after five minutes by default, permits at most five verification attempts and is consumed atomically. Resending invalidates older requests. Codes, sessions and API keys are never logged; audit actions use a pseudonymous email subject or internal user ID. Last login is updated for both OTP and password logins.

Server-enforced shared database limits are five sends per email and ten sends per IP per 15 minutes, with a 45-second cooldown. Verification is also limited to 30 attempts per email and 60 per IP per five minutes. HTTP 429 includes `Retry-After`. Database/provider failures return generic HTTP 503 errors. Incorrect, expired, exhausted and already-used codes cannot authenticate. Request bodies reject extra fields such as client-supplied roles. SQLite uses immediate transactions; PostgreSQL uses row locks. Limits are shared across app workers; the weather stream dispatcher retains its existing single-worker deployment constraint.

The frontend masks the email at the code step, supports six numeric inputs, full-code paste, autofill, focus movement and backspace navigation, and keeps password login available. Unauthenticated page requests redirect to `/login?next=...`; the server checks the session with the backend, and the backend independently enforces API authentication/roles. `/submit-report` remains public. Successful login returns to the original local destination or the overview dashboard.

### Database rollout and cleanup

Back up the database before deployment. The idempotent additive migration adds `users.last_login_at` and `otp_challenges.email`, `created_at`, `used_at`, and `delivery_id`, without deleting users, weather data or roles. Existing OTP tables are reused.

```sh
# DATABASE_URL must point to the intended deployment database.
PYTHONPATH=backend .venv/bin/python -m app.database.migrate_auth
```

Local backend startup also applies the migration before seeding. Existing challenges without an email still work for an existing user through the compatibility endpoint; request a new code to use the new email-based endpoint. Expired challenges and expired rate buckets older than 24 hours are deleted during new OTP requests. An optional daily job for idle installations is:

```sh
PYTHONPATH=backend .venv/bin/python scripts/cleanup_auth.py
```

Docker forwards the Resend variables only to the backend. Set `APP_ENV=production`, strong persistent secrets, correct `ALLOWED_ORIGINS`, HTTPS and `wss` endpoints in production. Configure trusted reverse proxies for accurate client IP limits; do not accept arbitrary client-supplied forwarding headers. Apply migrations before starting multiple workers. Validate PostGIS/PostgreSQL concurrency on the target infrastructure before operational rollout.

### Local SMTP compatibility

For offline development only, use `EMAIL_PROVIDER=smtp`, `SMTP_HOST=127.0.0.1`, `SMTP_PORT=1025`, `SMTP_SECURITY=none`, and `SMTP_FROM=no-reply@byteforce.local`. Install `backend/requirements-dev.txt` and start `.venv/bin/python scripts/dev_mail.py`. Private `.eml` files are saved under `.local/mail` and never forwarded. SMTP is retained for existing deployments; Resend is the default. The host loopback inbox is not reachable at the same address inside Docker.

### Verification

Run `.venv/bin/pytest -q`, `node --test tests/test_analytics.mjs`, and `npm run build --prefix frontend`. OTP tests cover success, wrong/expired/used codes, exhausted attempts, concurrent single consumption, cooldown, resend invalidation, email normalization, invalid addresses, role injection, provider/database failures, account creation, role preservation, logout, protected APIs, rate limits, cleanup and migration preservation. See `docs/email-otp.md` for current acceptance evidence and limitations.

## Account management

Settings now lets signed-in users edit their display name. Email, organisation and role cannot be changed through this profile endpoint. Updates are recorded in System Logs. Admin → User Management shows last sign-in and provides role changes with a required reason. Existing sessions read current permissions from the database on each API request. Self-role changes are blocked; a second administrator must make them. Expected-role checks prevent stale edits, and serialized role decisions prevent concurrent administrators from demoting one another after losing permission. Actual privileged assignments are always administrator actions.

- `PATCH /api/auth/profile`: `{name}`.
- `PATCH /api/admin/users/{id}/role`: `{role, expected_role, reason}`.

Expired sessions detected by operational API requests redirect to login with an explanatory message and the original destination. No database migration is required for these controls. Account tests cover profile-field restrictions, audit logging, role changes, stale edits, self-demotion protection, immediate backend permission changes and concurrent role changes on SQLite. PostgreSQL concurrency should be validated on deployment infrastructure.

### Guest login previews

The login page offers **Guest Admin** and **Guest Viewer**. Both create a one-hour
HttpOnly session using the existing authentication cookie. They display only
sample data in a separate temporary SQLite store; production users, reports,
media and realtime messages are never shared with guest sessions. The admin
preview exposes administrator navigation, but all data-changing requests are
blocked server-side. Sign out to use an ordinary email/password or OTP account.
Production system health is intentionally unavailable in the preview.

Set `GUEST_LOGIN_ENABLED=false` on the backend to hide these options and revoke
access for existing guest sessions. The default is `true`. Guest data is
regenerated after a process restart; no production database migration is needed.
Deploy both backend and frontend for the buttons to become available online.
