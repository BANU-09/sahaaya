# Security and data handling

SAHAAYA is a hackathon demonstration using fictional records. Do not submit real patient information to the public demo or repository.

Report reproducible, non-sensitive defects through GitHub Issues. Do not include credentials, session cookies, patient records or live exploit details in a public issue. For a sensitive vulnerability, contact the repository owner privately through GitHub before sharing details.

Current controls include patient-scoped authorization, revoked-grant checks, verified-doctor gates, origin checks, hashed passwords/tokens, authenticator MFA with replay protection, encrypted private files and OAuth secrets, streaming request limits, bounded queries and protected background jobs. These are implementation controls, not an independent security certification.

Credentials belong in the hosting secret manager; `.env`, `.data`, `.vercel`, database files and provider dashboard screenshots must stay out of Git. Preserve the encryption key across deployments. Provider acceptance and delivery confirmation are distinct states.

Use disposable local PostgreSQL fixtures for tests. The production smoke script creates and deletes only its own synthetic account and never resets the shared demo.

For operational limitations and current evidence, see [QUALITY_REPORT.md](QUALITY_REPORT.md) and [the deployment runbook](docs/INTEGRATIONS_AND_DEPLOYMENT.md).
