import { runScheduler, dispatchNotifications } from '../src/server/services/worker';
import { db } from '../src/server/db';
import { cleanStorage } from '../src/server/integrations/storage';
let stopping = false;
process.on('SIGINT', () => {
  stopping = true;
});
process.on('SIGTERM', () => {
  stopping = true;
});
const interval = Math.max(5000, Number(process.env.WORKER_INTERVAL_MS || 30000));
while (!stopping) {
  try {
    await runScheduler();
    await dispatchNotifications();
    await cleanStorage();
  } catch {
    console.error('scheduler_failed');
    await db.workerHeartbeat
      .upsert({
        where: { id: 'scheduler' },
        create: { id: 'scheduler', lastRunAt: new Date(), lastError: 'scheduler_failed' },
        update: { lastError: 'scheduler_failed' },
      })
      .catch(() => console.error('heartbeat_failed'));
  }
  if (!stopping) await new Promise((resolve) => setTimeout(resolve, interval));
}
await db.$disconnect();
