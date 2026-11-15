# SAHAAYA quality report

**BanuSreya · 15 November 2026**

[Live application](https://sahaaya-mauve.vercel.app) · [Public source](https://github.com/BANU-09/sahaaya) · [CI runs and downloadable test reports](https://github.com/BANU-09/sahaaya/actions/workflows/ci.yml)

This report describes measured results. It does not predict a hackathon score or claim clinical, security, accessibility or regulatory certification.

## Verified results

| Area                              | Evidence and result                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Code quality                      | Strict TypeScript, ESLint and optimized Next.js production build. Reproduce with npm scripts.                                                                                                                                                                                                                                                          |
| Unit/component/provider contracts | 126 tests across 16 files: schedules/DST, validation, crypto, permissions, multilingual text, request limits, analytics, revoked-doctor delivery, calendar privacy, push receipts, email contracts and companion routing. Provider mocks are identified as contract tests.                                                                             |
| Browser and API                   | Release suite includes persistence, invitations, permissions, prescription review/approval, atomic confirmations, caregiver acknowledgement, MFA/recovery/replay protection, export/deletion, document revisions, handovers, custom ranges and reviewed companion drafts. Final counts and commit are in release-validation.json and CI.               |
| Accessibility and mobile          | Axe checks on the dashboard, ten feature screens, privacy and mobile Easy Mode. Six language selection/persistence; 390 px overflow and keyboard/modal checks. Native-speaker and assistive-technology user studies are still needed.                                                                                                                  |
| Public deployment                 | Vercel production build and all three Neon migrations succeeded. Public app, API and database were checked. Cloudflare's scheduled heartbeat was observed healthy independently of a manual invocation.                                                                                                                                                |
| Production functionality          | Seven live checks using a fresh synthetic account: health, anonymous access denial, registration/secure cookie/profile, private upload/download and byte integrity, single-use reviewed draft, reauthenticated export, account deletion/session invalidation. The fixture account was deleted. See production-smoke.json.                              |
| Source access                     | Public BANU-09 repository, BanuSreya authorship, lockfile, migrations, CI, environment template, license and judge walkthrough. Credentials, database files, generated OCR assets and private provider screenshots are excluded.                                                                                                                       |
| Dependency audit                  | Initial release npm audit reported zero vulnerabilities. CI and future releases must recheck; this is not proof of absence of vulnerabilities.                                                                                                                                                                                                         |
| Efficiency                        | Bounded database queries, pooled connections, scheduler/dispatch locks and linear grouping of daily analytics. Earlier local native-PostgreSQL dashboard measurements: 50 successful requests, sequential median 31.6 ms/p95 39.7 ms; five-concurrent median 81.5 ms/p95 90.8 ms. These are local measurements, not public latency or load guarantees. |

## Deployment evidence

- [Production smoke results](docs/evidence/production-smoke.json)
- [Release validation summary](docs/evidence/release-validation.json)
- [Public dashboard screenshot](docs/evidence/public-dashboard.png)
- [Public landing screenshot](docs/evidence/public-home.png)
- [GitHub Actions checks](https://github.com/BANU-09/sahaaya/actions/workflows/ci.yml)

Commit `45b951b` passed GitHub CI on Ubuntu with Node 24 and PostgreSQL 18: [run 43705958710](https://github.com/BANU-09/sahaaya/actions/runs/43705958710). Lint, formatting, coverage, production build, TypeScript and browser/API journeys all succeeded. Check the latest run for subsequent changes; an older green run does not certify a newer commit.

## Integration and maintainability improvements in source

- The API dispatcher delegates account settings, care workflows and emergency operations to focused service modules. Permission checks remain with each operation; account preference updates are transactional.
- A central mutation-route guard rejects missing item IDs before database operations, preventing an omitted ID from becoming a broad Prisma update/delete. Dedicated API regressions cover malformed mutation routes.
- Companion intent routing is isolated from record retrieval. Explicit shortcut IDs support all six languages, summary requests are recognized locally, and treatment-change questions do not become ordinary medication lookups.
- Appointment downloads use authenticated, no-store iCalendar responses with stable event IDs, explicit lifecycle status and no patient names, diagnoses or medication details. Exporting a calendar file does not create a clinic booking or establish automatic calendar sync.
- Keyless Google Maps links open hospital search or directions without sending patient records. Google may ask for location; users can search a city manually.
- Personal accounts have a rate-limited Web Push self-test. A provider acceptance response remains `ACCEPTED`; only the authenticated browser receipt records `DELIVERED`. Shared demo accounts cannot send the test.
- Settings uses accurate labels for encrypted private storage and browser push, rather than implying that GCS or Firebase is active. The Brevo transactional-email adapter is implemented but not activated or inbox-verified.

The current source passed 126 unit tests across 16 files and all 38 browser/API journeys, along with production build, lint, formatting and TypeScript. Targeted coverage across nine listed modules measured 98.76% statements and 99.25% lines; this is not whole-application coverage. The runtime dependency audit reported zero known vulnerabilities. Public deployment evidence is recorded separately from local checks.

## Integration status and limits

- **Live:** Vercel, Neon, encrypted private file storage, Cloudflare ten-minute scheduler, in-app care loop, browser-based Tesseract/PDF OCR.
- **Configured, device delivery not yet verified:** standard Web Push. Real accounts require browser permission; fictional demo identities never send external notifications. The self-test exposes acceptance and device-receipt status separately.
- **Implemented adapters, inactive in this deployment:** Gemini/Vision, Google OAuth/Calendar API/Places API/GCS/Firebase, Resend email/webhooks and Brevo transactional email. An earlier synthetic Gemini contract was checked live, but the free public deployment does not send private health data to cloud AI. Keyless Maps links and calendar-file export are separate from the inactive APIs.
- **Not provided:** SMS, automatic clinic booking, medicine authenticity certification, clinical diagnosis or automatic treatment decisions.
- OCR reads up to five PDF pages and may misread handwriting, decimals and units. A synthetic image was actually recognized and reviewed; there is no clinical handwriting-accuracy claim. A barcode is raw text, not verified medicine identity.
- Upload limit: 3 MB/file. Raw stored file quota: 200 MB. Free hosting may sleep or exhaust quotas. Ten-minute background checks are not an emergency guarantee.
- Before real patient use: publish operational privacy/grievance contacts, validate clinical/native-language content, complete independent security/accessibility review, add malware scanning, establish retention and conduct a managed-database backup/restore drill.

## Reproduce

Use a disposable local database, DEMO_MODE=true and no live notification credentials. Keep the standalone worker stopped during API suites that advance scheduler time.

```sh
npm ci
npx prisma generate
npm run db:migrate
npm test
npm run lint
npm run build
npm run typecheck
# Start the built app on 127.0.0.1:3100 in another terminal, then:
npm run test:e2e
```

GitHub CI provisions PostgreSQL and Chromium automatically. Production smoke checks are intentionally separate: `node scripts/production-smoke.mjs` creates and deletes only its own synthetic account; it never resets the shared demo.
