import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    environment: 'node',
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'json-summary', 'html'],
      include: [
        'src/lib/schedule.ts',
        'src/lib/permissions.ts',
        'src/lib/validation.ts',
        'src/server/crypto.ts',
        'src/lib/calendar.ts',
        'src/lib/companion-intent.ts',
        'src/server/services/push.ts',
        'src/server/integrations/email.ts',
        'src/server/integrations/http.ts',
      ],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 75 },
    },
  },
});
