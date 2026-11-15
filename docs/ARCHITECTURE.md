# Architecture and API

Next.js App Router serves the React interface and Node API. PostgreSQL/Prisma persists every care operation. A separate scheduler handles escalation without a browser. Visible dashboards poll authorized records every 15 seconds.

```mermaid
flowchart LR
  Browser[Patient / family / caregiver / doctor] --> Web[Next.js UI + authenticated API]
  Web --> DB[(PostgreSQL)]
  Worker[Scheduler + delivery worker] --> DB
  Worker --> Delivery[Resend / Firebase]
  Web --> Storage[Private Cloud Storage]
  Web --> OCR[Vision → Gemini]
  Web --> Google[OAuth / Calendar / Places]
```

## Code map and model

`src/app` contains routes/styles; `src/components` contains feature screens/accessible controls; `src/lib` holds validation, permissions, localization and schedule math. Business operations are in `src/server/services`, providers in `src/server/integrations`. `prisma/schema.prisma` and versioned SQL migrations are the database source of truth. `scripts/worker.ts` is independently deployable.

A User owns at most one Patient and joins CareCircles through Membership and explicit Permission rows. Each request checks active, non-revoked membership and the required permission. Patient ownership is additionally required for invitations, permission changes, emergency links and summary approval. Doctor invitations require a verified Doctor row. Demo identities cannot access real patients.

Medication has MedicationSchedule, ScheduledDose, immutable DoseEvent, Refill and optional Prescription → Document provenance. Drafts generate no doses. Approval and the worker create an eight-day rolling schedule. Confirmation uses a version guard and transaction; stock deducts only confirmed consumption. As-needed records require explicit verification and a replay-protection request ID. Active prescriptions cannot be silently edited; create a new reviewed draft and archive the superseded regimen.

CareAlert stores escalation separately from dose truth. Acknowledgement does not mark a dose taken or missed. Notification event keys are unique. AVAILABLE is an in-app state; ACCEPTED means provider acceptance, not delivery. PostgreSQL advisory locking serializes scheduler passes; cursor batches of 200 avoid truncating the eligible population. Delivery workers atomically claim 50 jobs, respect recipient quiet hours and retry up to five times. A full scheduling transaction has a 60-second deadline and requires load testing before scale-up.

Appointments preserve request/confirmed/completed/cancelled state; confirmation needs an actual external reference. There is no hospital booking contract. Private documents, journal/vitals, tasks, approved summaries, expiring EmergencyShare, AuditLog, encrypted GoogleAccount, Session, RecoveryToken and WorkerHeartbeat complete the model.

## API

All endpoints are under `/api`. JSON writes require application/json and Origin matching APP_URL. Errors return `{ "error": "localizedKey" }`: 400 input, 401 authentication, 403 permission/consent/origin, 404 missing, 409 conflict, 413 size, 415 media, 423 locked, 429 rate limit, 502 upstream rejection, 503 unavailable. APIs/files use no-store.

| Endpoint                                           | Methods            | Purpose                                             |
| -------------------------------------------------- | ------------------ | --------------------------------------------------- |
| `/health`, `/config`                               | GET                | DB/worker health; configured flags, no secrets      |
| `/auth/register`, `/auth/login`, `/auth/logout`    | POST               | Identity/session                                    |
| `/auth/demo`, `/auth/lock`, `/auth/unlock`         | POST               | Demo; device-bound PIN lock                         |
| `/auth/recover`, `/auth/reset`                     | POST               | Email recovery, single-use token                    |
| `/auth/google/start`, `/auth/google/callback`      | GET                | OAuth state/nonce/PKCE                              |
| `/onboarding`                                      | POST               | Consented self patient profile                      |
| `/me`, `/settings`                                 | GET                | Account, memberships, preferences, sessions         |
| `/settings`, `/sessions/:id`                       | PATCH, DELETE      | Preferences/PIN; revoke session                     |
| `/invitations`                                     | POST               | Accept email-bound invitation                       |
| `/notifications`, `/notifications/:id`             | GET, PATCH         | Inbox/read acknowledgement                          |
| `/push`                                            | GET/POST/DELETE    | Public web config; device subscription              |
| `/patients/:p/dashboard`, `/analytics?days=7`      | GET                | Permission-filtered dashboard; 1–90-day analytics   |
| `/patients/:p/medications`                         | POST               | Create draft                                        |
| `/patients/:p/medications/:id`                     | PATCH/DELETE       | Edit draft; archive                                 |
| `/patients/:p/medications/:id/approve`             | POST               | `{verified:true}`                                   |
| `/patients/:p/medications/:id/refill`              | POST               | `{quantity:30}`                                     |
| `/patients/:p/medications/:id/prn`                 | POST               | UUID requestId, verified, optional witnessed/reason |
| `/patients/:p/doses/:id`                           | POST               | TAKEN/SNOOZED/NOT_TAKEN/HELP                        |
| `/patients/:p/appointments`, `/appointments/:id`   | POST, PATCH        | Create/update                                       |
| `/patients/:p/appointments/:id/calendar`           | POST               | Explicit calendar sync                              |
| `/patients/:p/invitations`, `/members/:id`         | POST, PATCH/DELETE | Owner consent/access                                |
| `/patients/:p/journal`, `/vitals`                  | POST               | Mood/symptoms, manual observations                  |
| `/patients/:p/tasks`, `/tasks/:id`, `/alerts/:id`  | POST, PATCH, PATCH | Assign/complete; acknowledge/resolve                |
| `/patients/:p/documents`                           | GET/POST multipart | Paginated search; JPEG/PNG/PDF ≤8 MiB               |
| `/patients/:p/documents/:id`                       | GET                | Protected attachment download                       |
| `/patients/:p/scan`                                | POST               | documentId+consent or explicit demo sample          |
| `/patients/:p/companion`                           | POST               | question+optional useAI                             |
| `/patients/:p/summaries`, `/summaries/:id`         | POST, GET/PATCH    | Create, read, patient approval                      |
| `/patients/:p/profile`, `/audit`                   | GET/PATCH, GET     | Emergency profile, paginated audit                  |
| `/patients/:p/emergency-share`, `/passport/:token` | POST/DELETE, GET   | One-hour revocable bearer link                      |
| `/demo/reset`, `/demo/simulate`                    | POST               | Labelled fictional scenarios                        |

Payload schemas: `src/lib/validation.ts`; executable examples: `tests/e2e/api.spec.ts`.

## Security and limits

Salted scrypt passwords/PINs; hashed session/share/invitation/reset tokens; HttpOnly SameSite=Lax cookies, Secure for HTTPS; AES-256-GCM OAuth token encryption; no private service-worker cache; server-side permissions and rate limits; MIME signatures and bounded inputs; PHI-free routine error logs. Active grants/revocation are checked per request.

Remaining production work includes verified email/mobile ownership, MFA, malware scanning, data export/deletion/retention policy, an edge WAF, nonce-based CSP (inline Next scripts/styles currently allowed), native managed-PostgreSQL load/backup/restore testing and independent security review. Dashboard lists are bounded; historical files/audit are paginated. These controls do not constitute a compliance or penetration-test certification.
