import { timingSafeEqual } from 'node:crypto';
import { runScheduler, dispatchNotifications } from '@/server/services/worker';
import { db } from '@/server/db';
import { cleanStorage } from '@/server/integrations/storage';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function POST(request: Request) {
  const expected = process.env.WORKER_SECRET;
  const supplied = request.headers.get('authorization')?.replace(/^Bearer /, '') || '';
  if (
    !expected ||
    expected.length < 32 ||
    supplied.length !== expected.length ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    return new Response(null, { status: 401 });
  try {
    const result = await runScheduler();
    await dispatchNotifications();
    await cleanStorage();
    return Response.json(
      { ok: true, skipped: 'skipped' in result && result.skipped },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    await db.workerHeartbeat.upsert({
      where: { id: 'scheduler' },
      create: { id: 'scheduler', lastRunAt: new Date(), lastError: 'WORKER_FAILED' },
      update: { lastRunAt: new Date(), lastError: 'WORKER_FAILED' },
    });
    return Response.json({ ok: false }, { status: 503 });
  }
}
