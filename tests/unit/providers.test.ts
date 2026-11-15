import { afterEach, describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import {
  gemini,
  extractPrescription,
  checkedFetch,
  integrationStatus,
} from '@/server/integrations/google';
import { validateFile } from '@/server/integrations/storage';
import { sendEmail } from '@/server/integrations/notifications';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('provider contracts without live credentials', () => {
  it('does not claim missing Gemini configuration is connected', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    expect(integrationStatus().gemini).toBe(false);
    await expect(gemini('test', z.object({ text: z.string() }))).rejects.toMatchObject({
      code: 'notConfigured',
    });
  });
  it('validates successful Gemini structured output', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'fixture-only');
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({ candidates: [{ content: { parts: [{ text: '{"text":"fixture"}' }] } }] }),
      );
    vi.stubGlobal('fetch', fetch);
    expect(await gemini('test', z.object({ text: z.string() }))).toEqual({ text: 'fixture' });
    expect(fetch.mock.calls[0][0]).toContain('generativelanguage.googleapis.com');
  });
  it('rejects malformed or unsafe shaped output', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'fixture-only');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ candidates: [{ content: { parts: [{ text: '{"text":42}' }] } }] }),
        ),
    );
    await expect(gemini('test', z.object({ text: z.string() }))).rejects.toMatchObject({
      code: 'invalidExtraction',
    });
  });
  it('surfaces provider rejection and network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('upstream', { status: 429 })));
    await expect(checkedFetch('https://example.invalid', {})).rejects.toMatchObject({
      code: 'providerError',
    });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
    await expect(checkedFetch('https://example.invalid', {})).rejects.toMatchObject({
      code: 'serviceUnavailable',
    });
  });
  it('refuses OCR without explicit configuration', async () => {
    vi.stubEnv('GOOGLE_VISION_ENABLED', 'false');
    await expect(extractPrescription(Buffer.alloc(50))).rejects.toMatchObject({
      code: 'notConfigured',
    });
  });
  it('does not call an email provider when unconfigured', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    await expect(sendEmail('test@example.invalid', 'test', 'test', 'test')).rejects.toMatchObject({
      code: 'notConfigured',
    });
  });
  it('returns provider acceptance id, not delivered status', async () => {
    vi.stubEnv('RESEND_API_KEY', 'fixture');
    vi.stubEnv('EMAIL_FROM', 'test@example.invalid');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ id: 'accepted-fixture' })));
    expect(await sendEmail('test@example.invalid', 'test', 'test', 'idempotency-fixture')).toBe(
      'accepted-fixture',
    );
  });
  it('rejects spoofed file MIME and oversized medical files', () => {
    expect(() => validateFile(Buffer.from('<script>alert(1)</script>'), 'image/png')).toThrow();
    expect(() => validateFile(Buffer.alloc(9 * 1024 * 1024), 'application/pdf')).toThrow();
    expect(() =>
      validateFile(Buffer.from('%PDF-1.4\nfictional test fixture'), 'application/pdf'),
    ).not.toThrow();
  });
});
