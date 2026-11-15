# Remaining provider setup

The public app, database, private storage, scheduled worker and on-device OCR already operate on the free setup. Calendar-file export and Google Maps links do not require credentials. Google OAuth and transactional email remain inactive until the account owner completes provider configuration and acceptance testing.

Keep credentials in Vercel's encrypted production environment or the ignored `.data/production.env`. Do not paste them in GitHub, source files, screenshots or public issues. Never rename this private file to `.env.production.local`, which Next.js would auto-load during local builds.

## Google sign-in and optional calendar sync

Use the entrant-owned Google account and a dedicated project without enabling billing. Configure the app name as **SAHAAYA** and use the authorized entrant-owned support email.

1. Configure the Google OAuth consent screen and a Web application client.
2. Set the exact authorized redirect URI to `https://sahaaya-mauve.vercel.app/api/auth/google/callback`.
3. Store `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_REDIRECT_URI` in Vercel production secrets.
4. Configure the intended audience/test users according to the provider's current consent requirements. Do not claim public OAuth availability while it only permits named test users.
5. If enabling automatic calendar sync, enable Calendar API and grant the app's requested calendar scope. The application encrypts refresh tokens. Calendar-file export continues to work without this connection.
6. Redeploy, then test Google sign-in, declined consent, account linking, calendar create/update/cancel and revoked access. Provider setup alone is not a passed integration test.

## Free transactional email

The Brevo adapter supports sender verification without requiring the Resend domain workflow. Use only its free plan, an authorized entrant-owned sender and the provider's current sender requirements. Do not buy a domain, credits or a subscription.

1. Complete account activation and verify the authorized sender in Brevo.
2. Store `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY` and `EMAIL_FROM="SAHAAYA <authorized-sender@example.com>"` in Vercel production secrets. Replace the example address with the verified sender.
3. Redeploy, then test ownership verification, recovery and a consented reminder to an authorized test inbox.
4. Confirm actual inbox delivery. The API's message ID proves provider acceptance only. Resend's signed webhook endpoint does not establish Brevo delivery.

Resend remains available as an alternative with `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`, a verified authorized sending domain and, for callbacks, `RESEND_WEBHOOK_SECRET`.

## Notification acceptance and free-plan boundaries

Use a personal test account in a supported browser, enable notifications in Settings, then send a test notification. Record `DELIVERED` only when the authenticated service-worker receipt arrives; `ACCEPTED` is not the same result. Shared fictional demo accounts never send external notifications.

Keep `GEMINI_PRIVATE_DATA_ALLOWED=false` on the unpaid deployment. Do not send personal health information to an unsuitable free cloud-AI service. SMS, automatic clinic booking and paid Google services are not enabled. Existing encrypted storage and browser OCR do not require GCS or Vision activation.

After changing any secrets, run the release checks, deploy, verify `/api/health`, repeat the synthetic production smoke check and verify the intended provider action. Do not mark an integration active solely because credentials exist.
