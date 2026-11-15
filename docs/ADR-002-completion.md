# ADR-002: Complete care workflows without bypassing consent

Status: Accepted. Date: 2026-11-15.

Extend the existing Next.js/PostgreSQL app. Deploy the web app to the user's selected Vercel account and retain an independently hosted worker and managed PostgreSQL. Use existing provider accounts where available. Do not move private records into public deployment artifacts.

Document extraction stores schema-validated, source-linked drafts separately from approved medical records. AI writes are proposed as expiring user-owned drafts, then require explicit review and permission checks at commit. A structured handover snapshots authorized responsibilities and records recipient acknowledgement. Identity verification, optional MFA, signed delivery callbacks and data lifecycle controls share the existing hashed-token, audit and role boundaries.

Alternatives considered: direct AI writes would remove a review step but risk unintended medical changes; separate microservices would add operational burden without a current need. The accepted approach keeps the existing business rules and tests, adds focused service modules, and requires live provider acceptance before claiming an integration works.
