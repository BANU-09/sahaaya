import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/server/services/worker', () => ({
  runScheduler: vi.fn(),
  dispatchNotifications: vi.fn(),
}));
import { POST } from '@/app/api/internal/worker/route';
import { runScheduler } from '@/server/services/worker';
afterEach(() => vi.unstubAllEnvs());
it('rejects a multibyte worker credential without throwing or running the scheduler', async () => {
  vi.stubEnv('WORKER_SECRET', 'x'.repeat(64));
  const response = await POST(
    new Request('https://example.invalid/api/internal/worker', {
      method: 'POST',
      headers: { Authorization: `Bearer ${'é'.repeat(64)}` },
    }),
  );
  expect(response.status).toBe(401);
  expect(runScheduler).not.toHaveBeenCalled();
});
