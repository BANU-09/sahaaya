# SAHAAYA — Round 2 judge's guide

Live: https://sahaaya-mauve.vercel.app

Source: https://github.com/BANU-09/sahaaya

**Problem:** Older adults and their families need a shared, understandable view of medicines, appointments, records and follow-up, while the patient retains control of access.

**Solution:** SAHAAYA turns reviewed information into a coordinated care routine. Its Care Loop connects an unconfirmed dose to a family follow-up and a recorded human response. It does not diagnose, prescribe or silently label a dose as missed.

## Three-minute working demo

1. **0:00–0:25 — Elderly-first access.** Open Explore demo → Patient. Show the six language choices, large actions and Easy Mode in Settings. All demo identities and records are fictional.
2. **0:25–1:05 — Scan to reviewed care.** Open Scan. Use the labelled sample prescription to demonstrate uncertain-field review, an editable medicine draft and explicit approval. Alternatively choose a clear synthetic report and “Read on this device” to run real OCR; review each field against the original. A transcript alone never creates a medication schedule.
3. **1:05–1:35 — Close the care loop.** Confirm a scheduled dose, snooze it or request help. Switch to Family/Caregiver through the demo role selector. Show synchronized status, acknowledgement and a follow-up note. Use the explicitly labelled scenario simulation if no escalation is due during judging.
4. **1:35–2:05 — Shared continuity.** Show an appointment request, caregiver task/handover and the journal. A request becomes confirmed only after a clinic confirmation reference is entered.
5. **2:05–2:35 — Evidence over guesses.** Ask the companion about saved medicines/appointments; show a custom-range heatmap and private document history. Demonstrate a patient-approved visit summary or short-lived Emergency Passport.
6. **2:35–3:00 — Implementation proof.** Show the repository, test results, database-backed persistence and deployment architecture. Explain the free-plan limits and inactive external services plainly.

## Round 2 evidence map

| Criterion | Weight | What to assess |
|---|---:|---|
| Implementation | 20% | Next.js/TypeScript, Prisma migrations, PostgreSQL transactions, independent scheduler, private storage and on-device OCR; see `src/server`, `prisma`, `deploy` |
| Problem–solution alignment | 20% | Elderly-first multilingual interface; patient-controlled family access; reviewed prescriptions; confirmation → follow-up → acknowledgement |
| Functionality | 20% | 80 unit tests and 32 local browser/API journeys; real persistence, replay protection, RBAC, MFA, handover, document history and custom trends |
| UI/UX | 15% | Six languages, responsive layout, Easy Mode, labelled controls, keyboard dialogs, reduced motion; tested axe journeys and 390 px layout |
| Deployment/completeness | 10% | Public HTTPS app with database, private uploads and scheduled worker; provider limits documented |
| GitHub repository | 5% | Source, README, architecture, migrations, environment template, CI, tests and license |
| LinkedIn explanation/tag | 10% | Ready-to-post copy in `LINKEDIN_POST.md`; publish from the entrant's account and select the actual MnM organization mention |

These weights describe the supplied rubric. They do not predict a platform score, rank, shortlist or prize.

## Honest scope boundaries

- Public demo data is fictional. Do not upload real patient records for judging.
- OCR is real, runs in the browser, supports the first five PDF pages, and can misread handwriting/units. Every field needs human review.
- The companion retrieves authorized records and offers reviewed drafts. Cloud generative AI is disabled on this free deployment for private health data.
- Email/SMS, Google sign-in/Calendar/Maps and clinic booking are not live. Adapters and unavailable states do not count as successful provider integrations.
- Background reminders are checked every ten minutes. Free hosting can sleep or hit quotas; notification delivery is not an emergency guarantee.
- Clinical usability, native-language review, independent security review and operational privacy ownership remain prerequisites for use with real patients.
