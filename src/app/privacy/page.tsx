import Link from 'next/link';
export default function Privacy() {
  return (
    <main className="document-page">
      <Link href="/">← Sahaaya</Link>
      <h1>Your care, your choice</h1>
      <p>
        Sahaaya stores information that you enter to coordinate medication routines, appointments,
        documents, and care-circle tasks. It is not an emergency service or a substitute for
        clinical care.
      </p>
      <h2>Consent and access</h2>
      <p>
        Only the patient can invite people and grant or revoke care-circle permissions. Revocation
        is checked on subsequent requests. Previously downloaded or printed records cannot be
        recalled. An emergency passport link grants its holder temporary access; share it only with
        someone you trust and revoke it when finished.
      </p>
      <h2>Google and other providers</h2>
      <p>
        The free deployment reads documents on your device using Tesseract OCR. Language files are
        downloaded, but the document stays in your browser until you save it. Saved documents are
        encrypted in the Neon database; Vercel hosts the application. Cloudflare checks reminders
        every ten minutes. Browser push messages contain generic care updates, without medical
        details. Cloud AI, Google Calendar, email and SMS are disabled unless separately configured.
      </p>
      <h2>Demonstration and retention</h2>
      <p>
        The public demonstration uses fictional records and does not deliver external email or push
        notifications. It is unsuitable for real medical data. In Settings you can export your care
        data or delete your account after confirming your identity. Original documents can be
        downloaded separately. Deleted files are queued for cleanup; provider backups may retain
        earlier copies according to their retention policies. Before operating with real users,
        a deployment owner must publish a contact for
        data-access, correction, deletion and grievance requests, establish a retention schedule and
        verified backups, and complete privacy and security review.
      </p>
      <h2>Legal readiness</h2>
      <p>
        This project does not claim DPDP compliance certification, clinical validation, or WCAG
        certification. See the repository quality report for checks actually performed and remaining
        work.
      </p>
    </main>
  );
}
