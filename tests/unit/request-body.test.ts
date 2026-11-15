import { expect, it } from 'vitest';
import { readJson, readText } from '@/server/errors';
const request = (body: string, type = 'application/json') =>
  new Request('https://example.invalid', {
    method: 'POST',
    headers: { 'Content-Type': type },
    body,
  });
it('accepts JSON with a charset', async () =>
  expect(await readJson(request('{"ok":true}', 'application/json; charset=utf-8'))).toEqual({
    ok: true,
  }));
it('rejects spoofed JSON content types', async () => {
  await expect(readJson(request('{}', 'application/json-evil'))).rejects.toMatchObject({
    status: 415,
  });
});
it('bounds UTF-8 bytes rather than character count', async () => {
  await expect(readJson(request(JSON.stringify('త'.repeat(12000))))).rejects.toMatchObject({
    status: 413,
  });
});
it('rejects declared oversized bodies before reading them', async () => {
  const req = request('{}');
  req.headers.set('Content-Length', '1000000');
  await expect(readJson(req)).rejects.toMatchObject({ status: 413 });
  expect(req.bodyUsed).toBe(false);
});
it('cancels a chunked stream as soon as the byte limit is crossed', async () => {
  let pulls = 0,
    cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls++;
      controller.enqueue(new Uint8Array(20000));
    },
    cancel() {
      cancelled = true;
    },
  });
  const req = new Request('https://example.invalid', {
    method: 'POST',
    body,
    duplex: 'half',
  } as RequestInit);
  await expect(readText(req, 32768)).rejects.toMatchObject({ status: 413 });
  expect(cancelled).toBe(true);
  expect(pulls).toBeLessThanOrEqual(3);
});
