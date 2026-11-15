# Integrations and deployment

Configuration flags indicate environment settings, not verified connectivity. Gemini structured output and the authenticated companion were tested live with an existing environment credential and fictional data; the other Google/email/hosting integrations remain unconfigured. Demo notifications never leave the app. See the quality report for evidence.

## Provider setup and acceptance

Use a dedicated project, restricted server keys, private bucket and least-privilege service identity. Prefer workload identity/ADC. Otherwise securely mount a service-account file and set GOOGLE_APPLICATION_CREDENTIALS; do not commit it or put secrets in NEXT_PUBLIC variables.

| Service     | Environment                                                                                                       | Acceptance check                                                                                                                      |
| ----------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Gemini      | GEMINI_API_KEY, GEMINI_MODEL                                                                                      | Confirm account model access; test structured extraction, uncertain fields and safe intent classification with fictional input        |
| Vision      | ADC, GOOGLE_VISION_ENABLED=true                                                                                   | Enable API; JPEG/PNG DOCUMENT_TEXT_DETECTION, visible original and confidence. PDF storage exists, PDF OCR does not                   |
| OAuth       | GOOGLE_CLIENT_ID/SECRET, GOOGLE_REDIRECT_URI                                                                      | Register exact HTTPS `/api/auth/google/callback`; test state rejection, declined consent, new profile and existing-account connection |
| Calendar    | OAuth, TOKEN_ENCRYPTION_KEY                                                                                       | Enable Calendar API; explicit calendar.events.owned consent; test create/reschedule/cancel, duplicate retry and revoked token         |
| Maps/Places | GOOGLE_MAPS_API_KEY                                                                                               | Enable required Places API, restrict key; test geolocation denial, nearby results and provider failure                                |
| Storage     | ADC, GCS_BUCKET                                                                                                   | Private object upload; deny unsigned/cross-patient download; test grant revocation                                                    |
| Firebase    | ADC, FIREBASE_PROJECT_ID, FIREBASE_WEB_API_KEY, FIREBASE_APP_ID, FIREBASE_MESSAGING_SENDER_ID, FIREBASE_VAPID_KEY | Enable FCM, configure web app/VAPID; explicitly opt in and test actual HTTPS browser/device background delivery                       |
| Resend      | RESEND_API_KEY, verified EMAIL_FROM                                                                               | Test recovery and reminders in a real inbox; provider ACCEPTED is not a delivery receipt                                              |

References: [Vision OCR](https://docs.cloud.google.com/vision/docs/fulltext-annotations), [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output?lang=rest), [Firebase web messaging](https://firebase.google.com/docs/cloud-messaging/web/get-started).

Camera, microphone, speech synthesis/recognition and location require actual browser support/permission. Text alternatives remain available. Speech recognition may use the browser vendor's service, disclosed in the UI. Test the actual presentation device and language voices.

## Local production check

With DB running: `npm run build`, `npm run start -- --port 3100`, and separately `npm run worker`. `/api/health` must report connected DB and a fresh healthy worker heartbeat. Production uploads require GCS unless explicitly running a fictional demo.

Early PGlite testing exposed an intermittent PostgreSQL-protocol error with concurrent web/worker connections. The delivered local setup uses native PostgreSQL with a pool of five per process. Original PGlite data and settings were preserved privately; it is no longer the active database. Validate deployment pool sizing against actual connection limits. Local performance can be reproduced with `npx tsx --env-file=.env scripts/measure.ts`; the script refuses non-local/non-demo targets.

## Heroku

Procfile defines web, worker and release; app.json includes PostgreSQL. Prisma CLI and tsx are production dependencies. The release command applies versioned migrations. See Heroku [Procfile](https://devcenter.heroku.com/articles/procfile) and [release phase](https://devcenter.heroku.com/articles/release-phase).

1. Select/create an authorized Heroku app and managed PostgreSQL resource. Review current account charges. No paid resource was created in this delivery.
2. Deploy **sahaaya as the repository root**, excluding the surrounding workspace, .env, .data, credentials and build/test artifacts. Use the committed lockfile.
3. Configure managed DATABASE_URL, exact HTTPS APP_URL, persistent random 32-byte base64 TOKEN_ENCRYPTION_KEY, private GCS/ADC and required provider settings. DEMO_MODE=false for real accounts. Workstation credentials do not exist on dynos.
4. Build with a supported Node satisfying package.json; release runs prisma migrate deploy. Never run prisma dev on Heroku.
5. Scale both web=1 and worker=1. DB_POOL_SIZE defaults to five per process; budget connections for all processes/dynos. Scheduler lock and delivery claims prevent duplicate ownership.
6. Verify HTTPS cookies, heartbeat, auth/access isolation, private files, review→approval→confirmation and configured providers using non-sensitive fixtures.
7. Monitor failed/aged deliveries, stale worker, errors and DB saturation. Enable backups and perform a restore drill. Logs must not contain health payloads.

Heroku filesystem is ephemeral: store persistent medical files in private GCS. Keep the encryption key stable across releases. Review database rollback/recovery separately from app rollback. Final local evidence uses native PostgreSQL, not a managed Heroku database.

Before real patient use, complete live provider acceptance, native-language clinical review, operator privacy/grievance contacts, deletion/export/retention workflows, identity verification, malware scanning, independent security/accessibility review and native-PostgreSQL load/restore testing. Public deployment needs hosting/provider ownership; the local demo works without it.
