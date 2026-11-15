// Cloudflare Workers Free: one cron fetch per ten minutes. No patient data enters this worker.
const worker = {
  async scheduled(_event, env) {
    const response = await fetch(`${env.APP_URL}/api/internal/worker`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.WORKER_SECRET}` },
      signal: AbortSignal.timeout(55000),
    });
    if (!response.ok) throw new Error(`SAHAAYA scheduler returned ${response.status}`);
  },
  fetch() {
    return new Response('Not found', { status: 404 });
  },
};
export default worker;
