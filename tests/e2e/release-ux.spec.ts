import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
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
