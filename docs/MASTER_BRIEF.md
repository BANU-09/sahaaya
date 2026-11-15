# SAHAAYA — COMPLETE NATIONAL HACKATHON MASTER DEVELOPMENT PROMPT
## AI-Powered Elderly Healthcare, Medication Management & Intelligent Family Care Ecosystem

**Product:** SAHAAYA  
**Tagline:** Your Health. Your Family. Always Connected.  
**Product category:** AI Healthcare | Elderly Care | Medication Management | Family Collaboration  
**Primary objective:** Build an innovative, secure, accessible, multilingual, full-stack healthcare platform that goes beyond basic medication reminders.

---

# PART 1 — YOUR ROLE AND DEVELOPMENT OBJECTIVE

Act as a world-class software architect, senior full-stack developer, AI engineer, Google Cloud integration specialist, healthcare technology expert, cybersecurity engineer, accessibility specialist and premium UI/UX designer.

Build SAHAAYA as a complete, production-quality, working web application.

This is a national-level hackathon project evaluated through automated code assessment.

The application must be optimized for all seven evaluation criteria:

1. Code Quality.
2. Security.
3. Efficiency.
4. Testing.
5. Accessibility.
6. Problem Statement Alignment.
7. Google Services Usage.

**IMPORTANT:** Do not optimize only for visual appearance. The actual source code, backend architecture, database operations, API integrations, security controls and test results must demonstrate quality.

Do not create a frontend-only prototype pretending to be a working application.

Do not use fake integrations, fabricated statistics, hardcoded success messages or nonfunctional buttons.

Before implementing, inspect the existing repository and preserve useful existing functionality. Do not unnecessarily replace working code.

Build incrementally, test after each module and fix existing errors before adding further functionality.

# PART 2 — BRAND IDENTITY AND VISUAL EXPERIENCE

## 2.1 Brand identity

Name: SAHAAYA.

Meaning: Help, support and companionship.

Brand philosophy:

"Technology should adapt to elderly people, not force elderly people to adapt to technology."

Create an original professional logo combining:
- A heart representing healthcare.
- Two supportive hands.
- A subtle circular connection representing family collaboration.

Create:
- Primary logo.
- Compact icon.
- Favicon.
- Light and dark logo variations.

The identity must be recognizable and suitable for a healthcare technology company.

## 2.2 Color palette

Do not create a plain white website or a generic blue dashboard.

Use a beautiful, premium, colorful healthcare design.

Primary palette:
- Deep teal: #176B68
- Emerald: #2F9B83
- Mint: #DDF3EA
- Warm cream: #FFF8ED
- Lavender: #EEE8FA
- Coral: #F28C78
- Sky blue: #E4F0FC
- Charcoal: #283B43

Use:
- Teal for primary actions.
- Mint for completed healthcare activities.
- Coral for attention-required states.
- Lavender for AI features.
- Sky blue for doctor and appointment modules.
- Cream for warm backgrounds.

Design requirements:
- Beautiful card layouts.
- Consistent spacing.
- Rounded corners.
- Soft shadows.
- Elegant gradients used selectively.
- Modern typography.
- Beautiful healthcare illustrations.
- Subtle micro-interactions.
- Animated loading indicators.
- Attractive empty states.
- Clear success and error states.

Use Lucide icons consistently.

Do not overcrowd the interface or use excessive animations.

The overall quality should resemble a premium healthcare startup.

# PART 3 — COMPLETE MULTILINGUAL EXPERIENCE

This is a mandatory core feature.

Support:

1. English.
2. Telugu.
3. Tamil.
4. Hindi.
5. Kannada.
6. Malayalam.

Implement a centralized internationalization system.

The entire application must change when the user selects a language.

Translate:
- Landing page.
- Registration.
- Login.
- Dashboard.
- Navigation.
- Medication management.
- Prescriptions.
- Appointments.
- AI assistant.
- Notifications.
- Email content.
- Caregiver alerts.
- Error messages.
- Confirmation dialogs.
- Medical document explanations.
- Emergency information.
- Settings.

Do not translate only headings or navigation labels.

Implement structured translation dictionaries, reusable translation functions and locale-aware date and time formatting.

Support individual language preferences for each member of a family care circle.

Example:

An elderly father uses Telugu, while his daughter uses English. Both access the same healthcare information, but their own interface displays their preferred language.

Implement:
- Language selector.
- Voice input.
- Text-to-speech.
- Read-aloud functionality.
- Multilingual AI responses.
- Language persistence across sessions.

Medical instructions must use verified translations. Preserve medicine names and dosage units accurately. Never allow automatic translation to alter medication strength, frequency or instructions.

# PART 4 — LANDING PAGE AND ONBOARDING

## 4.1 Landing page

Create a stunning, professional landing page.

Sections:

1. Navigation bar with logo and language selector.
2. Hero section.
3. Problem statement.
4. Our solution.
5. Main features.
6. AI capabilities.
7. Family collaboration.
8. Multilingual accessibility.
9. Security and privacy.
10. How it works.
11. Call to action.
12. Footer.

Hero heading:

"Complete Care. Connected Families. Happier Living."

Supporting text:

"An intelligent healthcare companion that helps elderly individuals manage everyday care while keeping the people who matter connected."

Primary buttons:
- Get Started.
- Explore Sahaaya.

Use warm illustrations of elderly individuals and their families.

## 4.2 Registration

Create two registration paths.

**Option A: I am the patient.**

Collect:
- Full name.
- Date of birth.
- Mobile number.
- Email address, optional.
- Preferred language.
- Password.
- Optional quick-access PIN.
- Emergency contact.
- Time zone.
- Accessibility preferences.

Optional healthcare profile:
- Blood group.
- Allergies.
- Medical conditions.
- Current medicines.
- Preferred hospital.
- Primary doctor.

Do not force the user to complete all medical information during signup.

**Option B: I am a family member or caregiver.**

Collect:
- Full name.
- Email.
- Mobile number.
- Relationship with patient.
- Preferred language.
- Patient invitation or linking details.

Require appropriate patient consent before connecting accounts.

## 4.3 Login and authentication

Implement:
- Email and password login.
- Secure Google sign-in using Google OAuth.
- OTP verification where configured.
- Optional PIN-based quick access.
- Password recovery.
- Secure logout.
- Session expiration.
- Device/session management.

Never store passwords or PINs in plain text.

Google sign-in must authenticate the account; it must not automatically grant access to an existing patient's medical profile.

# PART 5 — SHARED FAMILY HEALTHCARE ECOSYSTEM

Build one central patient profile that can be accessed by multiple authorized users.

User roles:

1. Patient.
2. Family administrator.
3. Family member.
4. Caregiver.
5. Doctor.
6. System administrator.

### Patient permissions

The patient can:
- View health records.
- Confirm medicines.
- Manage appointments.
- Upload prescriptions.
- Access AI assistance.
- Invite family members.
- Approve changes.
- Control permissions.
- Review access history.

### Family permissions

With patient authorization, family members can:
- View medical records.
- Manage medication drafts.
- Coordinate appointments.
- Receive reminders.
- Review adherence.
- Upload documents.
- Assign care tasks.
- View family activity.

### Caregiver permissions

Caregivers can:
- View assigned information.
- Record assisted medication administration.
- Confirm doses only when actually administered or witnessed.
- Record observations.
- Complete care tasks.
- Submit handover notes.

### Doctor permissions

Verified doctors can:
- View explicitly shared records.
- Review prescriptions.
- Access authorized medical reports.
- Add consultation notes.
- Provide updated instructions.
- Manage appointments.

Never grant doctor permissions based only on selecting the doctor role during registration.

### Permission management

Implement granular permissions for:
- Profile viewing.
- Medication viewing.
- Medication editing.
- Prescription approval.
- Dose confirmation.
- Appointment management.
- Medical report access.
- Emergency information.
- Family management.

Every sensitive operation must be authorized by the backend, not merely hidden in the frontend.

Create a complete activity and audit log.

# PART 6 — ELDERLY-FIRST DASHBOARD

Create separate dashboard experiences for patients, family members, caregivers and doctors.

## 6.1 Patient dashboard

Desktop navigation:
- Home.
- My Medicines.
- Scan Prescription.
- Appointments.
- My Health.
- Family Circle.
- Sahaaya AI.
- Medical Records.
- Emergency.
- Notifications.
- Settings.

Main dashboard:

**A. Personalized greeting**

"Good morning, [Patient Name]!"

Display date, time, language selector and accessibility settings.

**B. Today's care**

Display:
- Next scheduled medicine.
- Medicine name.
- Verified dosage instruction.
- Time.
- Large TAKEN button.
- REMIND ME LATER button.
- I NEED HELP button.

**C. Daily schedule**

Show:
- Morning.
- Afternoon.
- Evening.
- Night.

**D. Health at a glance**

Display actual:
- Medication adherence.
- Upcoming appointment.
- Pending care tasks.
- Recent observations.

**E. Family connection**

Show connected members and recent updates.

**F. Ask Sahaaya**

Provide prominent voice and text interaction.

**G. Upcoming events**

Show appointments, tests and medicine refills.

The patient dashboard must be understandable within five seconds.

## 6.2 Family dashboard

Show:
- Connected patients.
- Pending care alerts.
- Medication status.
- Upcoming appointments.
- Assigned tasks.
- Recent activity.
- Prescription approvals.
- Adherence analytics.

## 6.3 Caregiver dashboard

Show:
- Assigned patients.
- Today's responsibilities.
- Pending check-ins.
- Medication assistance.
- Handover notes.
- Completed tasks.

## 6.4 Doctor dashboard

Show:
- Authorized patients.
- Appointment schedule.
- Shared medical documents.
- Medication lists.
- Patient visit summaries.
- Consultation notes.

# PART 7 — FLAGSHIP FEATURE: SCAN-TO-CARE AI

Use the device camera to scan:
- Handwritten prescriptions.
- Printed prescriptions.
- Medicine labels.
- Medicine bottles.
- Laboratory reports.
- Appointment slips.
- Discharge summaries.

## Complete workflow

1. Open the camera.
2. Show a simple capture guide.
3. Capture or upload an image.
4. Validate image quality.
5. Send the image through the backend to the OCR service.
6. Extract text.
7. Use AI to structure the extracted information.
8. Display the original image and extracted information side by side.
9. Highlight uncertain fields.
10. Allow manual correction.
11. Ask for confirmation.
12. Save the verified document.
13. Create draft medication entries where applicable.
14. Activate only after authorized approval.

### Prescription extraction

Extract:
- Medicine name.
- Strength.
- Dosage.
- Frequency.
- Duration.
- Timing.
- Route.
- Food instructions.
- Doctor name.
- Prescription date.

Never guess unclear handwriting.

Show confidence and verification states.

### Medicine scanning

Scan medicine packaging or barcodes.

Extract available:
- Product name.
- Brand.
- Generic name.
- Strength.
- Manufacturer.
- Expiry information.
- Batch information.

Do not claim that a medicine is correctly identified from an ordinary photograph of an unidentified pill.

### Medical report extraction

Extract:
- Test name.
- Date.
- Values.
- Units.
- Reference ranges.
- Observations.

Preserve the original report.

Do not diagnose based on extracted information.

# PART 8 — SMARTDOSE MEDICATION INTELLIGENCE

Build a complete medication management engine.

Medication information:
- Name.
- Strength.
- Dosage.
- Frequency.
- Duration.
- Start date.
- End date.
- Food instructions.
- Prescribing doctor.
- Prescription.
- Remaining stock.
- Refill quantity.
- Reminder times.

Support:
- Daily.
- Multiple daily doses.
- Specific weekdays.
- Alternate-day schedules.
- Temporary courses.
- As-needed medication.

Clearly distinguish scheduled medication from as-needed medication.

## Dose tracking

Provide:
- Taken.
- Remind me later.
- Not taken.
- Need help.

Record:
- Scheduled time.
- Actual confirmation time.
- Confirmation source.
- User identity.
- Status.
- Reason, if provided.

Opening a notification must never automatically mark a medicine as taken.

## Intelligent Care Loop

Implement:

1. Dose becomes due.
2. Send first notification.
3. Wait for the configured response period.
4. Send follow-up if unconfirmed.
5. Escalate to the designated caregiver if still unconfirmed.
6. Allow caregiver acknowledgment.
7. Record follow-up action.
8. Close the alert when resolved.

Make escalation configurable.

Do not automatically classify an unconfirmed dose as a confirmed missed dose.

Never recommend doubling a dose after a missed dose.

## Refill intelligence

Calculate estimated remaining stock based on:
- Initial quantity.
- Prescribed schedule.
- Recorded consumption.
- Recorded refills.

Show:
- Estimated remaining quantity.
- Refill reminder.
- Expiry warning.
- Refill history.

Clearly distinguish estimates from verified physical stock.

# PART 9 — SAHAAYA AI COMPANION

Build a context-aware multilingual chatbot.

Support:
- Text.
- Voice.
- Microphone input.
- Text-to-speech.
- Suggested questions.

Example questions:
- What medicines should I take today?
- What is my next appointment?
- Have I missed any medicine?
- Explain this prescription.
- When should I refill my medicines?
- Help me prepare for my doctor's appointment.
- Record how I am feeling today.

AI must retrieve actual authorized data from the backend.

Use structured tool calling or validated backend functions for:
- Reading medication schedules.
- Retrieving appointments.
- Summarizing authorized reports.
- Recording patient-reported symptoms.
- Creating appointment drafts.

Never allow AI to bypass access permissions.

AI safety:
- No independent diagnosis.
- No prescription.
- No dosage changes.
- No stopping medication advice.
- No invented medical records.
- No unsupported drug interaction claims.

For medical uncertainty, direct users to qualified professionals.

For emergency symptoms, recommend immediate appropriate emergency assistance.

# PART 10 — FAMILY CARE CIRCLE

Create:
- Family member invitations.
- Secure invitation links.
- QR-based invitations.
- Acceptance workflow.
- Permission management.
- Member removal.
- Activity timeline.
- Care task management.

Synchronize authorized updates across users.

Example activity timeline:

"8:00 AM — Patient confirmed morning medicine."

"10:30 AM — Caregiver recorded a home visit."

"2:00 PM — Medical report uploaded."

"5:00 PM — Appointment updated."

Record who performed each action.

## Caregiver handover

Allow one caregiver to transfer responsibility to another.

Record:
- Completed tasks.
- Pending medicines.
- Appointment information.
- Important observations.
- Next responsibilities.

The next caregiver receives the handover details in their dashboard.

# PART 11 — DOCTORCONNECT

Create a complete appointment management module.

Doctor details:
- Name.
- Specialization.
- Hospital.
- Contact details.
- Location.
- Consultation hours.

Appointment details:
- Doctor.
- Hospital.
- Date.
- Time.
- Purpose.
- Appointment type.
- Preparation instructions.
- Reports to carry.
- Status.

Support:
- Booking requests.
- Manual appointment creation.
- Rescheduling.
- Cancellation.
- Completion.
- Reminders.
- Consultation notes.

Do not claim that a doctor appointment is confirmed unless an actual booking or verified confirmation exists.

## Doctor Visit Summary

Generate an approved summary containing:
- Current medication list.
- Recent dose events.
- Medical reports.
- Patient-reported symptoms.
- Previous consultation notes.
- Questions for the doctor.

Allow the patient to review and approve before sharing.

After consultation, upload updated prescriptions and use the Scan-to-Care verification workflow.

# PART 12 — HEALTH PATTERN INTELLIGENCE

Create a family-friendly analytics dashboard.

Use real stored information.

Display:
- Medication adherence.
- Missed-dose trends.
- Delayed-dose trends.
- Refill patterns.
- Appointment history.
- Recorded symptoms.
- Vital-sign trends.
- Caregiver activity.

Visualizations:
- Bar charts.
- Line charts.
- Calendar heatmaps.
- Activity timelines.
- Progress indicators.

Provide filters:
- 7 days.
- 30 days.
- 90 days.
- Custom date range.

Use actual records only.

Show "Insufficient data" when necessary.

Do not generate fabricated numbers, fake improvement percentages or misleading medical scores.

Create actionable, explainable insights with dates and source records.

# PART 13 — ONE-TAP EMERGENCY PASSPORT

Display:
- Patient name.
- Emergency contacts.
- Allergies.
- Important conditions.
- Current medications.
- Blood group, if known.
- Primary doctor.
- Preferred hospital.

Provide:
- Emergency contact calling.
- Configured local emergency number.
- Printable emergency card.
- Secure QR-based access.

Protect sensitive information through secure access mechanisms.

Do not claim automatic hospital or emergency-service integration without implementing and verifying it.

# PART 14 — HEALTH JOURNAL

Create a simple daily check-in.

Options:
- Feeling very good.
- Feeling good.
- Not feeling well.
- Need help.

Allow:
- Voice notes.
- Text notes.
- Symptom recording.
- Sleep observations.
- Appetite observations.
- Pain or discomfort notes.

Avoid lengthy questionnaires.

Use patient permissions to control family visibility.

# PART 15 — MEDICAL RECORD VAULT

Categories:
- Prescriptions.
- Laboratory reports.
- Scans.
- Discharge summaries.
- Consultation notes.
- Insurance documents.
- Other records.

Support:
- Camera upload.
- PDF upload.
- Preview.
- Search.
- Categorization.
- Date filters.
- Notes.
- Secure sharing.
- Download.
- Document history.

Store private medical files in protected cloud storage.

Never expose unrestricted public file URLs.

# PART 16 — GOOGLE SERVICES INTEGRATION

This section is mandatory for the evaluation framework.

Integrate genuine Google services that improve the actual application.

Do not simply display Google branding or create dummy integration screens.

## 16.1 Google Gemini API

Use Gemini for:
- Multilingual AI conversations.
- Prescription information structuring.
- Medical document summaries.
- Simple-language explanations.
- Healthcare routine summaries.
- Contextual assistance.

Requirements:
- Server-side API calls.
- Environment-variable configuration.
- Structured JSON outputs.
- Schema validation.
- Prompt safety rules.
- Output verification.
- Error handling.
- Rate limiting.
- Usage monitoring.

AI-generated prescription details must remain drafts until verified.

## 16.2 Google Cloud Vision API

Use Cloud Vision OCR for:
- Printed prescriptions.
- Medicine labels.
- Medical reports.
- Appointment documents.

Workflow:

Camera → Image validation → Cloud Vision OCR → Gemini structuring → Field validation → Human verification → Database.

Do not assume handwritten prescriptions can always be read accurately.

When OCR confidence is insufficient, request a clearer image or manual entry.

## 16.3 Firebase Cloud Messaging

Implement web push notifications.

Requirements:
- Firebase project configuration.
- Web application registration.
- Service worker.
- VAPID configuration where required.
- Push subscription management.
- Backend notification dispatch.
- Device registration.
- Token refresh.
- Notification delivery/error tracking.

Use push notifications for:
- Medication reminders.
- Caregiver alerts.
- Appointment reminders.
- Important family updates.

Respect notification permissions and user preferences.

## 16.4 Google OAuth

Implement secure Google sign-in.

Use the authenticated Google identity only for account authentication.

Do not grant patient medical-record permissions automatically.

## 16.5 Google Calendar API

Implement optional calendar synchronization.

With explicit user authorization:
- Create appointment events.
- Update events.
- Delete cancelled events.
- Synchronize appointment dates.
- Prevent duplicate events.
- Handle token expiration and revoked permissions.

Keep SAHAAYA as the source of truth for its medical records.

## 16.6 Google Maps Platform

Use Google Maps for:
- Nearby hospitals.
- Clinics.
- Pharmacies.
- Directions.
- Location visualization.

Use only when the user requests location-based assistance.

## 16.7 Google integration quality requirements

For each Google integration:
- Use official SDKs or APIs.
- Store credentials securely.
- Document required environment variables.
- Implement proper OAuth scopes.
- Handle API failures.
- Provide loading and error states.
- Test successful and unsuccessful responses.
- Display integration status accurately.

Do not pretend an API is connected when credentials are missing.

Provide a clearly marked demo mode with sample responses only for local demonstrations.

Implement the core application so that it remains usable if an optional Google service becomes unavailable.

Do not send unnecessary personal medical information to third-party services.

---

# PART 17 — NOTIFICATION ENGINE

Support:
- In-app notifications.
- Web push.
- Email.
- Optional SMS.
- Optional WhatsApp.

Notification events:
- Medication due.
- Unconfirmed medication.
- Caregiver escalation.
- Appointment approaching.
- Appointment updated.
- Medicine refill due.
- New invitation.
- Prescription approval request.
- New medical report.
- Caregiver task assignment.

Create notification preferences for each user.

Implement:
- Server-side scheduling.
- Background workers.
- Job retry.
- Idempotency.
- Delivery status.
- Failure handling.
- Quiet hours.
- Time-zone awareness.

Do not rely on a browser tab being open for reminders.

Do not mark a notification delivered merely because the backend accepted a request.

For email, integrate a transactional provider such as Resend or SendGrid.

For web push, use Firebase Cloud Messaging.

Provide a PWA installation experience.

# PART 18 — COMPLETE TECHNICAL ARCHITECTURE

Use:

**Frontend**
- Next.js.
- React.
- TypeScript.
- Tailwind CSS.
- Accessible component library.
- PWA.

**Backend**
- Next.js API routes or a clearly separated Node.js backend.
- REST APIs with documented schemas.
- Server-side authorization.
- Centralized validation.

**Database**
- PostgreSQL.
- Prisma ORM.

**Deployment**
- Heroku-compatible application deployment.
- PostgreSQL service.
- Background worker.
- Environment variables.
- Database migrations.

**AI**
- Google Gemini API.
- Google Cloud Vision.

**Notifications**
- Firebase Cloud Messaging.
- Transactional email provider.

**Optional integrations**
- Google Calendar.
- Google Maps.

Use a modular architecture.

Suggested modules:

- Authentication.
- User management.
- Patient profiles.
- Care circles.
- Permissions.
- Medication management.
- Prescription processing.
- Dose tracking.
- Appointments.
- Medical records.
- Health journal.
- Analytics.
- Notifications.
- AI assistant.
- Google integrations.
- Audit logs.

Separate business logic from UI components.

Avoid oversized components and duplicated business logic.

# PART 19 — DATABASE DESIGN

Create proper relational tables for:

1. Users.
2. Patient profiles.
3. Care circles.
4. Care circle members.
5. Invitations.
6. Permissions.
7. Doctors.
8. Caregivers.
9. Medications.
10. Prescriptions.
11. Medication schedules.
12. Scheduled doses.
13. Dose events.
14. Appointments.
15. Medical documents.
16. Health journal entries.
17. Vital records.
18. Care tasks.
19. Notifications.
20. Push subscriptions.
21. Audit logs.
22. User language preferences.
23. Google integration accounts.
24. Notification preferences.

Requirements:
- Foreign keys.
- Appropriate indexes.
- Unique constraints.
- Database transactions.
- Created and updated timestamps.
- Referential integrity.
- Pagination.
- Proper data types.
- Secure user-to-patient relationships.

All patient data must be protected through server-side authorization.

Use migrations and maintain a documented database schema.

# PART 20 — SECURITY REQUIREMENTS

Security must be designed into every module.

Implement:

1. Secure password hashing.
2. Authentication and session protection.
3. Role-based access control.
4. Patient consent management.
5. Granular permissions.
6. Secure invitation tokens.
7. Access revocation.
8. Audit logging.
9. Encryption in transit.
10. Protected document storage.
11. Input validation.
12. Rate limiting.
13. CSRF protection where applicable.
14. XSS protection.
15. SQL injection prevention.
16. Secure CORS configuration.
17. Environment-variable secret management.
18. Secure error handling.
19. Session expiration.
20. Backup and recovery.

Follow applicable Indian data-protection requirements, including the Digital Personal Data Protection framework and relevant healthcare obligations.

Do not claim compliance certification without verification.

Never expose API keys or service-account credentials in frontend code.

Do not log passwords, access tokens or unnecessary medical information.

Implement the principle of least privilege.

# PART 21 — CODE QUALITY REQUIREMENTS

This section directly targets the automated Code Quality assessment.

Use strict TypeScript.

Enable:
- Strict type checking.
- ESLint.
- Consistent formatting.
- Reusable components.
- Modular service architecture.
- Typed API requests and responses.
- Centralized error handling.
- Input validation.
- Clear naming conventions.
- Consistent file organization.

Avoid:
- `any` wherever avoidable.
- Duplicate code.
- Giant components.
- Unnecessary dependencies.
- Unused imports.
- Dead code.
- Hardcoded credentials.
- Hardcoded business logic in UI components.
- Exposed database operations in frontend code.
- Unhandled promises.
- Silent failures.

Use reusable utilities and shared types.

Add code comments where business rules are complex.

Maintain readable, maintainable code.

Run the linter and TypeScript compiler regularly.

Do not suppress errors merely to make the build pass.

# PART 22 — PERFORMANCE AND EFFICIENCY

Optimize the application for real users and limited devices.

Implement:
- Lazy loading.
- Code splitting.
- Image optimization.
- Efficient API requests.
- Database indexes.
- Pagination.
- Debounced search.
- Server-side filtering.
- Caching where safe.
- Background processing.
- Optimized database queries.
- Efficient state management.

Avoid unnecessary re-rendering.

Do not load every patient's medical document when opening a dashboard.

Load only the information required for the current view.

Use pagination for large activity histories.

Never cache private medical data in a shared cache without appropriate isolation.

Set practical loading and response-time targets, measure them and document the results.

# PART 23 — TESTING STRATEGY

Testing is mandatory, not optional.

Use:

- Vitest for unit tests.
- React Testing Library for frontend component tests.
- Playwright for end-to-end tests.
- API integration tests.
- Database tests.
- Accessibility testing tools.

## 23.1 Unit tests

Test:
- Medication schedule generation.
- Dose status transitions.
- Refill calculations.
- Permission checks.
- Notification timing.
- Language selection.
- Date and time handling.
- Care Loop escalation.

## 23.2 Integration tests

Test:
- Registration.
- Login.
- Family invitations.
- Patient authorization.
- Medication creation.
- Prescription approval.
- Dose confirmation.
- Appointment creation.
- Notification generation.
- Document uploads.
- Google integration failures.

## 23.3 End-to-end tests

Build Playwright workflows.

**Workflow A: Patient onboarding**

Register a patient, select Telugu, complete onboarding and open the dashboard.

**Workflow B: Prescription scanning**

Upload a prescription, extract information, verify details and create a medication draft.

**Workflow C: Medication management**

Approve the medication, generate the schedule and confirm a dose.

**Workflow D: Family synchronization**

Open patient and caregiver accounts separately and verify that authorized updates synchronize.

**Workflow E: Care Loop**

Simulate an unconfirmed dose, trigger escalation and verify caregiver acknowledgment.

**Workflow F: Appointment management**

Create an appointment, set reminders and generate a doctor visit summary.

**Workflow G: Multilingual experience**

Switch between Telugu, Tamil, Hindi and English and verify all essential screens.

**Workflow H: Security**

Verify that unauthorized users cannot access private patient records or perform restricted actions.

## 23.4 Accessibility testing

Test:
- Keyboard navigation.
- Screen reader labels.
- Contrast.
- Focus visibility.
- Touch target size.
- Text scaling.
- Language switching.
- Form errors.
- Accessible notifications.

## 23.5 Test reporting

Generate a test report containing:
- Total tests.
- Passed tests.
- Failed tests.
- Skipped tests.
- Coverage.
- Critical failures.
- Known limitations.

Do not fabricate test results.

Fix critical failures before submission.

Target at least 80% coverage for critical business logic, while prioritizing meaningful tests over coverage percentage alone.

# PART 24 — ACCESSIBILITY AND SENIOR EASY MODE

This is a major product differentiator.

Target WCAG 2.2 AA accessibility.

Implement:

- Large fonts.
- High contrast.
- Large buttons.
- Clear labels.
- Keyboard support.
- Screen reader support.
- Visible focus indicators.
- Accessible form validation.
- Semantic HTML.
- Text scaling.
- Reduced motion support.
- Voice guidance.
- Read-aloud controls.

Create two modes:

**Senior Easy Mode**
- Simplified navigation.
- Large cards.
- One primary action per screen.
- Essential daily tasks first.
- Voice instructions.
- Large confirmation buttons.
- Minimal text.
- Persistent home navigation.

**Standard Mode**
- Full dashboard.
- Detailed analytics.
- Advanced settings.
- Family management.

Allow users to change modes at any time.

Do not rely on colors alone to communicate success, warnings or errors.

Support elderly people with different levels of vision, hearing, motor ability and technical experience.

# PART 25 — REQUIREMENT-TO-FEATURE TRACEABILITY

Create a documented mapping between the original challenge and actual implemented functionality.

| Problem statement requirement | SAHAAYA implementation | Verification |
|---|---|---|
| Daily medication management | SmartDose | Medication CRUD tests |
| Appointment management | DoctorConnect | Appointment workflow tests |
| Shared healthcare profile | Family Care Circle | Multi-account integration tests |
| Secure passcode-based access | PIN and authentication | Authentication tests |
| Authorized viewing and editing | Role-based permissions | Access-control tests |
| Adherence tracking | Dose event engine | Dose history tests |
| Upcoming appointments | Appointment dashboard | Reminder tests |
| Missed medication alerts | Care Loop | Escalation tests |
| Upcoming dose reminders | Scheduler and push | Notification tests |
| Email reminders | Email provider | Email integration tests |
| Innovative healthcare routines | Scan-to-Care and AI Companion | End-to-end demonstration |
| Elderly accessibility | Senior Easy Mode | Accessibility tests |
| Multilingual access | Full application i18n | Language tests |
| Family collaboration | Shared care ecosystem | Synchronization tests |

Every mandatory problem-statement requirement must have:
1. An implemented feature.
2. A backend operation where necessary.
3. A test case.
4. A visible demonstration.

Do not leave a mandatory requirement as a design-only concept.

# PART 26 — ADDITIONAL INNOVATION: CARE CONTINUITY SCORECARD

Create a meaningful family-facing overview with three categories:

1. Medication routine.
2. Appointment and follow-up routine.
3. Caregiver check-in routine.

Statuses:
- On track.
- Needs attention.
- Awaiting confirmation.

Provide the actual underlying tasks and dates.

Do not create an arbitrary medical health score or grade the elderly person.

The scorecard should help family members identify what needs attention.

# PART 27 — HACKATHON DEMONSTRATION MODE

Create a clearly labelled demonstration environment.

Include fictional demo data:
- One elderly patient.
- Two family members.
- One caregiver.
- One verified demo doctor.
- Sample prescriptions.
- Sample medications.
- Sample appointments.
- Sample medical reports.
- Sample medication events.

Make demo accounts and role permissions easy for judges to access.

Provide a reset function for demo data.

Never mix sample records with real patient records.

## Live demonstration journey

1. Open SAHAAYA.
2. Select Telugu.
3. Register or log in as an elderly patient.
4. Scan a prescription.
5. Show extracted information and verification.
6. Approve a medication draft.
7. Display the new daily schedule.
8. Trigger a medication reminder.
9. Confirm the dose.
10. Open a separate family account.
11. Show synchronized patient activity.
12. Simulate an unconfirmed dose.
13. Demonstrate Care Loop escalation.
14. Ask the AI assistant about the next appointment.
15. Generate a doctor visit summary.

Make this entire journey smooth and reliable.

# PART 28 — DEPLOYMENT AND ENVIRONMENT CONFIGURATION

Prepare the application for deployment on Heroku.

Provide:
- Production build.
- Database provisioning.
- Migration execution.
- Background worker configuration.
- Environment variables.
- Health-check endpoint.
- Logging.
- Error monitoring.
- Secure CORS.
- Production configuration.

Create a complete `.env.example`.

Include configuration for:
- Database.
- Authentication.
- AI provider.
- Google Cloud Vision.
- Firebase.
- Google OAuth.
- Google Calendar.
- Google Maps.
- Email provider.
- File storage.
- Application URL.

Do not commit real secrets.

Do not expose service-account keys.

Verify the production build and database migrations.

Make sure the background scheduler works independently of the web process.

# PART 29 — AUTOMATED CODE ASSESSMENT READINESS

Before the final submission, run a complete quality audit.

### Code Quality
- TypeScript compilation.
- Linting.
- Formatting.
- No dead code.
- No exposed secrets.
- Clean architecture.
- Proper validation.

### Security
- Authentication tests.
- RBAC tests.
- Patient consent tests.
- Unauthorized access tests.
- Input validation.
- Rate limiting.
- Secure document access.
- Secret scanning.

### Efficiency
- Database query optimization.
- Index validation.
- Pagination.
- Performance testing.
- Image optimization.
- Efficient API responses.

### Testing
- Unit tests.
- Integration tests.
- End-to-end tests.
- Accessibility tests.
- Security tests.
- Production build tests.

### Accessibility
- WCAG 2.2 AA checks.
- Keyboard navigation.
- Screen reader support.
- Contrast.
- Responsive text scaling.
- Multilingual verification.

### Problem Statement Alignment
- Verify every mandatory requirement.
- Confirm the shared ecosystem.
- Confirm medication management.
- Confirm appointment management.
- Confirm passcode-based access.
- Confirm dose adherence.
- Confirm email reminders.
- Confirm caregiver collaboration.

### Google Services Usage
- Gemini API integration.
- Cloud Vision OCR integration.
- Firebase Cloud Messaging.
- Google OAuth.
- Calendar integration where configured.
- Maps integration where configured.
- Secure API configuration.
- Error handling.
- Real integration tests.

Create a final `QUALITY_REPORT.md` with:
- Evaluation category.
- Checks performed.
- Results.
- Test evidence.
- Known limitations.
- Integration status.
- Remaining work.

Do not claim a score of 100 unless the actual platform reports it.

Never manipulate the evaluation process or fabricate test evidence.

# PART 30 — DEVELOPMENT EXECUTION ORDER

Follow this implementation sequence.

**PHASE 1 — Foundation**
- Project architecture.
- Branding.
- Landing page.
- Authentication.
- PostgreSQL.
- User roles.
- Patient profiles.

**PHASE 2 — Core healthcare**
- Family Care Circle.
- Medication management.
- Dose tracking.
- Appointment management.
- Medical records.

**PHASE 3 — Flagship AI**
- Camera capture.
- Cloud Vision OCR.
- Gemini extraction.
- Verification interface.
- AI Companion.
- Multilingual voice.

**PHASE 4 — Coordination**
- Care Loop.
- Family synchronization.
- Caregiver assignments.
- Notification engine.
- Email and push.

**PHASE 5 — Advanced capabilities**
- Health analytics.
- Emergency Passport.
- Doctor Visit Summary.
- Google Calendar.
- Google Maps.

**PHASE 6 — Quality and deployment**
- Security review.
- Unit tests.
- Integration tests.
- Playwright tests.
- Accessibility audit.
- Performance optimization.
- Production deployment.
- Final quality report.

Do not proceed to a new phase while critical functionality in the previous phase is broken.

# FINAL PRODUCT EXPECTATION

SAHAAYA must not feel like a collection of disconnected healthcare features.

It must function as one intelligent ecosystem.

An elderly woman should be able to scan her prescription using her camera, verify the medicine details, receive understandable reminders in Telugu, confirm her doses and ask an AI assistant about her next appointment.

Her son should be able to see authorized updates from another city.

A caregiver should know which tasks require attention.

A doctor should receive an organized, patient-approved medical summary.

The system should identify unresolved care tasks and coordinate follow-up rather than simply sending notifications.

**The final philosophy:**

"One scan organizes care. One confirmation keeps everyone informed. One connected family makes healthcare more reliable."

Deliver a product that demonstrates genuine innovation, working technology, clean code, strong security, efficient execution, comprehensive testing, exceptional accessibility and meaningful Google Services integration.

The goal is to maximize performance against every published evaluation criterion through actual implementation and verifiable evidence.

**Build SAHAAYA as a complete, intelligent, secure and elderly-first healthcare ecosystem — not just another medicine reminder application.**