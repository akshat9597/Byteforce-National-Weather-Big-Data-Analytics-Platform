# Resend email OTP acceptance record

## Implemented

Resend's official Python SDK is integrated into the existing FastAPI OTP service. The existing users, database, roles, password authentication and JWT cookie are retained. Email verification creates a new Viewer only when no account exists, preserves existing privileges and updates last login. The existing OTP tables were extended using an idempotent additive migration. No separate authentication system was introduced.

New canonical endpoints: `/api/auth/send-otp` and `/api/auth/verify-otp`. Old challenge-based routes remain deprecated compatibility aliases. Six-digit inputs support paste, autofill, focus movement and backspace. Protected page requests redirect to login and backend role checks remain authoritative. The development sender and a verified custom-domain sender are selected with EMAIL_FROM without code changes.

## Validation on 17 September 2026

- 33 backend tests passed, including the existing weather lifecycle suite and OTP security/migration/failure cases.
- Three analytics regression tests passed.
- Next.js production build and type checks passed.
- Final browser flow successfully requested a real Resend email and showed the six-digit input with a masked recipient.
- The user confirmed: “Received and signed in successfully.” This verifies recipient inbox arrival and real sign-in; the confirmation was user-reported.
- Resend accepted the send and returned a message ID, saved privately on the challenge row. A separate provider delivery-status lookup was rejected with the configured API key; Resend dashboard status was not independently inspected.
- Live HTTP checks confirmed unauthenticated and forged-cookie redirects, authenticated access, existing password/admin login and logout protection.
- Frontend build scan found none of the configured Resend, OTP or JWT secrets in client assets.
- Migration preserved all prior users, roles, password hashes, weather reports and events. A private pre-migration database backup exists under .local/backups.

## Deployment limits

The current sender is Resend's onboarding test sender, restricted to the Resend account email. Verify a domain and update EMAIL_FROM before sending to other users. PostgreSQL row-lock concurrency, container deployment, HTTPS/reverse-proxy configuration and operational load testing still require target-environment validation. No claim of a production security certification is made. Provider acceptance alone is not proof of inbox placement.

See README for configuration, migration, retention, reverse-proxy guidance and the preserved SMTP development inbox option.
