import { defineConfig, devices } from '@playwright/test';
try {
  process.loadEnvFile('.env');
} catch {
  /* Environment may be injected by CI. */
}
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  retries: 0,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
    channel: process.env.PLAYWRIGHT_BROWSER === 'chromium' ? undefined : 'chrome',
  },
  outputDir: 'test-results/artifacts',
});
