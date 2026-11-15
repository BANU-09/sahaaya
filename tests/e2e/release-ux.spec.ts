import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { getText } from '../../src/lib/i18n';

test('free calendar, Maps and companion shortcuts work without provider credentials', async ({
  page,
}) => {
  const login = await page.request.post('/api/auth/demo', {
    headers: { Origin: 'http://127.0.0.1:3100' },
    data: { role: 'PATIENT' },
  });
  expect(login.status()).toBe(200);
  await page.request.patch('/api/settings', {
    headers: { Origin: 'http://127.0.0.1:3100' },
    data: { language: 'en', easyMode: false },
  });
  await page.goto('/app/appointments');
  const calendar = page.getByRole('link', { name: 'Download calendar event' }).first();
  await expect(calendar).toBeVisible();
  const download = await page.request.get((await calendar.getAttribute('href'))!);
  expect(download.status()).toBe(200);
  expect(await download.text()).toContain('BEGIN:VCALENDAR');
  await page.goto('/app/emergency');
  await expect(page.getByRole('link', { name: 'Find hospitals on Google Maps' })).toHaveAttribute(
    'href',
    'https://www.google.com/maps/search/?api=1&query=hospitals+near+me',
  );
  await page.goto('/app/assistant');
  await page
    .locator('.suggested-questions')
    .getByRole('button', { name: getText('en', 'visitSummary'), exact: true })
    .click();
  await expect(page.locator('.chat-message.answer')).toContainText('Metformin');
  await page.goto('/app/settings');
  await expect(page.getByText('Encrypted private file storage')).toBeVisible();
  await expect(page.getByText('Browser push notifications')).toBeVisible();
  await expect(
    page.getByRole('button', { name: getText('en', 'pushReminders'), exact: true }),
  ).toBeDisabled();
});
test('demo shows a loading state instead of a false configuration error', async ({ page }) => {
  let release: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/config', async (route) => {
    await ready;
    await route.continue();
  });
  await page.goto('/demo');
  await expect(page.getByRole('status')).toBeVisible();
  await expect(page.getByText('Service is not configured', { exact: true })).toHaveCount(0);
  release();
  await expect(page.getByRole('button', { name: 'Patient Lakshmi Devi' })).toBeVisible();
});
test('privacy explains account rights in all six languages and remains accessible on mobile', async ({
  page,
}) => {
  await page.goto('/privacy');
  for (const locale of ['te', 'ta', 'hi', 'kn', 'ml', 'en']) {
    await page.locator('select').selectOption(locale);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('main h2')).toHaveCount(3);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
});
