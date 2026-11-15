import { afterEach, expect, it, vi } from 'vitest';
import { emailConfigured, sendEmail } from '@/server/integrations/email';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it('supports a verified Brevo sender without depending on a Resend key', async () => {
  vi.stubEnv('EMAIL_PROVIDER', 'brevo');
  vi.stubEnv('BREVO_API_KEY', 'fixture-not-a-real-key');
  vi.stubEnv('RESEND_API_KEY', '');
  vi.stubEnv('EMAIL_FROM', 'SAHAAYA <sender@example.invalid>');
  const fetch = vi.fn().mockResolvedValue(Response.json({ messageId: 'accepted-fixture' }));
  vi.stubGlobal('fetch', fetch);
  expect(emailConfigured()).toBe(true);
  expect(
    await sendEmail('recipient@example.invalid', 'Verify', 'Fictional content', 'retry-key'),
  ).toBe('brevo:accepted-fixture');
  expect(fetch.mock.calls[0][0]).toBe('https://api.brevo.com/v3/smtp/email');
  const body = JSON.parse(fetch.mock.calls[0][1].body);
  expect(body.sender).toEqual({ name: 'SAHAAYA', email: 'sender@example.invalid' });
  expect(body.headers).toEqual({ IdempotencyKey: 'retry-key' });
});
it('fails closed for missing credentials, unknown providers and malformed senders', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  vi.stubEnv('EMAIL_PROVIDER', 'brevo');
  vi.stubEnv('BREVO_API_KEY', '');
  vi.stubEnv('EMAIL_FROM', 'sender@example.invalid');
  expect(emailConfigured()).toBe(false);
  vi.stubEnv('BREVO_API_KEY', 'fixture');
  vi.stubEnv('EMAIL_FROM', 'invalid');
  expect(emailConfigured()).toBe(false);
  vi.stubEnv('EMAIL_FROM', 'sender@example.invalid');
  vi.stubEnv('EMAIL_PROVIDER', 'unknown');
  await expect(
    sendEmail('recipient@example.invalid', 'Verify', 'text', 'retry'),
  ).rejects.toMatchObject({ code: 'notConfigured' });
  expect(fetch).not.toHaveBeenCalled();
});
it('does not report acceptance when Brevo omits its message ID', async () => {
  vi.stubEnv('EMAIL_PROVIDER', 'brevo');
  vi.stubEnv('BREVO_API_KEY', 'fixture');
  vi.stubEnv('EMAIL_FROM', 'sender@example.invalid');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({})));
  await expect(
    sendEmail('recipient@example.invalid', 'Verify', 'text', 'retry'),
  ).rejects.toMatchObject({ code: 'providerError' });
});
