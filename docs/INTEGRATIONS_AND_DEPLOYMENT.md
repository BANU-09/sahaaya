# Integrations and deployment

Author: **BanuSreya**. Public app: https://sahaaya-mauve.vercel.app.

## Active free deployment

| Component         | Configuration                                                                                               | Verification                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Vercel            | Next.js; build applies Prisma migrations, prepares OCR assets and builds the app; Singapore function region | Public HTTPS and deployed demo checked                                                      |
| Neon              | PostgreSQL 18, Singapore, 0.25 CU, five-minute scale-to-zero, pooled runtime URL and direct migration URL   | Migrations, persistence, private-file round-trip and deletion checked                       |
| Cloudflare        | `deploy/cron-worker.mjs`; `*/10 * * * *`; APP_URL plus a reminder-only secret                               | Saved schedule and a subsequent healthy scheduled heartbeat observed                        |
| Private documents | STORAGE_PROVIDER=postgres; AES-256-GCM with a persistent server key; 3 MB/file, 200 MB raw-file quota       | Authenticated round-trip, identical bytes, no-store headers, anonymous denial               |
| On-device OCR     | Tesseract.js + PDF.js workers generated during build; language files downloaded by browser                  | Synthetic image recognized and field-by-field review saved                                  |
| Web Push          | VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY; browser opt-in; validated vendor endpoints                              | Configuration and contracts checked; real device delivery still requires acceptance testing |

The ten-minute interval lets the database suspend between checks. Free quotas may pause services; no paid upgrade or billing commitment is configured. This is a hackathon demonstration rather than a guaranteed clinical monitoring service.

## Secrets and release procedure

1. Link the intended Vercel project. Keep production secrets in the hosting secret manager. This workspace's private copy is `.data/production.env`; it is excluded from Git and deployment uploads. Do not put it in `.env.production.local`, which Next would auto-load during local builds.
2. Set DATABASE_URL (pooled), DIRECT_URL (migrations), APP_URL, TOKEN_ENCRYPTION_KEY, WORKER_SECRET, STORAGE_PROVIDER=postgres, DB_POOL_SIZE=3, DEMO_MODE=true, REMINDER_CHECK_MINUTES=10 and WORKER_HEALTH_TIMEOUT_MS=900000. Keep encryption keys stable.
3. Generate Web Push VAPID keys once. Expose only the public key to the browser. Never use NEXT_PUBLIC for server credentials.
4. Run the checks in QUALITY_REPORT.md, deploy the intended commit and verify `/api/health`. The worker heartbeat must be healthy as well as the database connected.
5. Configure Cloudflare with only APP_URL and WORKER_SECRET. It calls POST `/api/internal/worker`; it does not receive database or encryption credentials. `deploy/wrangler.jsonc` describes the schedule.
6. Run the synthetic production smoke check, open the demo in a real browser and confirm the next scheduled heartbeat. Provider acceptance does not establish device or inbox delivery.

GitHub CI uses a disposable PostgreSQL container and no production secrets. A source push alone does not imply a new Vercel deployment; verify the production release separately.

## Optional adapters — inactive

| Service               | Required configuration                                                               | Acceptance still required                                                                               |
| --------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Google OAuth/Calendar | Client ID/secret, exact HTTPS callback, consent screen; encrypted refresh tokens     | Sign-in/linking, declined consent, calendar creation/update/cancel, revoked token                       |
| Gemini/Vision         | Authorized model/service account and suitable data-processing terms                  | Do not send sensitive data using an unsuitable free tier; consent, input provenance and clinical review |
| Maps/Places           | Restricted server key and eligible project                                           | Location denial, real search and quota/error behavior                                                   |
| GCS                   | Private bucket and workload identity/ADC                                             | Private upload/download, revocation, deletion and retention                                             |
| Firebase              | Web app/VAPID + service identity                                                     | Real supported-device delivery                                                                          |
| Resend                | API key, an authorized verified sending domain and EMAIL_FROM; RESEND_WEBHOOK_SECRET | Email ownership, recovery/reminder inbox delivery, signature verification and retry callbacks           |

Email stays disabled until a different authorized sending domain is selected. SMS and automatic clinic booking are not implemented. Browser speech/camera/location require support and permission; text/manual alternatives remain available.

The old Procfile/app.json are optional adapters for separately provisioned conventional web/worker hosting. Heroku was not used and is not required for the current free setup.

Before real patient use, complete privacy ownership, native-language/clinical review, independent security and accessibility assessment, malware scanning, retention policy and a backup/restore drill. See REQUIREMENTS.md for precise scope.
