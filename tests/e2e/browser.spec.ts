import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { DateTime } from 'luxon';
import { randomUUID } from 'node:crypto';
import { db } from '../../src/server/db';
const origin = 'http://127.0.0.1:3100';
async function demo(page: Page, role = 'PATIENT') {
  expect(
    (
      await page.request.post('/api/auth/demo', { headers: { Origin: origin }, data: { role } })
    ).status(),
  ).toBe(200);
  await page.request.patch('/api/settings', {
    headers: { Origin: origin },
    data: { language: 'en', easyMode: false },
  });
}
test.describe.serial('browser journeys and accessibility', () => {
  test('landing and dashboard render without runtime errors, with keyboard access', async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Complete care/ })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Overview', exact: true })).toBeFocused();
    await page.screenshot({ path: 'test-results/landing-final.png', fullPage: true });
    await page.goto('/demo');
    await page.getByRole('button', { name: 'Patient Lakshmi Devi' }).click();
    await expect(page).toHaveURL(/app\/home/);
    await expect(page.getByRole('heading', { name: 'Let’s take care of today.' })).toBeVisible();
    await page.screenshot({ path: 'test-results/dashboard-final.png', fullPage: true });
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    await testInfo.attach('accessibility-dashboard', {
      body: JSON.stringify(results.violations, null, 2),
      contentType: 'application/json',
    });
    expect(results.violations).toEqual([]);
    expect(errors).toEqual([]);
  });
  test('patient onboarding in Telugu creates a persisted account and profile', async ({ page }) => {
    const email = `browser-${randomUUID()}@example.invalid`;
    await page.goto('/register');
    await page.getByRole('combobox', { name: 'Language' }).selectOption('te');
    await page.locator('input[name="name"]').fill('Test Telugu Patient');
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill('Browser test password 2026!');
    await page.locator('input[name="consent"]').check();
    await page.getByRole('button', { name: 'ఖాతా సృష్టించండి', exact: true }).click();
    await expect(page).toHaveURL(/app\/home/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'te');
    await expect(page.getByRole('heading', { name: 'ఈ రోజు సంరక్షణ చూసుకుందాం.' })).toBeVisible();
    await db.user.deleteMany({ where: { email, demo: false } });
  });
  test('scan sample, verify fields, approve schedule, and confirm a dose', async ({ page }) => {
    await demo(page);
    await page.request.post('/api/demo/reset', { headers: { Origin: origin }, data: {} });
    await page.goto('/app/scan');
    await page.getByRole('button', { name: 'Try a labelled sample' }).click();
    await expect(page.getByText('Uncertain · verify against original: Duration')).toBeVisible();
    await page.getByRole('button', { name: 'Add medicine draft', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.locator('input[name="name"]').fill('Fictional workflow medicine');
    await dialog
      .locator('input[name="times"]')
      .fill(DateTime.now().setZone('Asia/Kolkata').plus({ minutes: 10 }).toFormat('HH:mm'));
    await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button', { name: 'Add medicine draft', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await page.goto('/app/medicines');
    await page.getByRole('button', { name: /Awaiting review/ }).click();
    await expect(page.getByRole('heading', { name: /Fictional workflow medicine/ })).toBeVisible();
    await page.getByRole('button', { name: 'Verify & activate schedule' }).click();
    await page.getByRole('dialog').getByRole('checkbox').check();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.getByRole('button', { name: 'Today’s medicines', exact: true }).click();
    const dose = page
      .locator('article')
      .filter({ has: page.getByRole('heading', { name: /Fictional workflow medicine/ }) });
    await dose.getByRole('button', { name: 'I have taken it' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(dose.getByText('Confirmed taken')).toBeVisible();
  });
  test('family synchronizes confirmations, caregiver acknowledges an escalation', async ({
    browser,
    page,
  }) => {
    await demo(page);
    const familyContext = await browser.newContext();
    const familyPage = await familyContext.newPage();
    await familyPage.goto(origin);
    await demo(familyPage, 'FAMILY');
    await familyPage.goto(`${origin}/app/medicines`);
    const dose = familyPage
      .locator('article')
      .filter({ has: familyPage.getByRole('heading', { name: /Fictional workflow medicine/ }) });
    await expect(dose.getByText('Confirmed taken')).toBeVisible();
    await expect(dose.getByRole('button', { name: 'I have taken it' })).toHaveCount(0);
    await page.goto('/app/family');
    await page.getByRole('button', { name: 'Demo: simulate an unconfirmed dose' }).click();
    await expect(
      page.getByRole('heading', { name: 'Caregiver follow-up needed' }).first(),
    ).toBeVisible();
    await demo(familyPage, 'CAREGIVER');
    await familyPage.goto(`${origin}/app/family`);
    await familyPage.getByRole('button', { name: 'Acknowledge & follow up' }).first().click();
    await familyPage
      .getByRole('dialog')
      .getByRole('textbox')
      .fill('Called the patient to check; fictional demo.');
    await familyPage.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
    await expect(familyPage.getByRole('button', { name: 'Resolve alert' }).first()).toBeVisible();
    await familyContext.close();
  });
  test('appointment, grounded companion, and patient-approved visit summary', async ({ page }) => {
    await demo(page);
    await page.goto('/app/appointments');
    await page.getByRole('button', { name: 'Add appointment' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('[name="doctor"]').fill('Dr. Demo Workflow');
    await dialog.locator('[name="specialty"]').fill('General medicine');
    await dialog.locator('[name="hospital"]').fill('Fictional Clinic');
    await dialog
      .locator('[name="startsAt"]')
      .fill(
        DateTime.now().setZone('Asia/Kolkata').plus({ days: 1 }).toFormat("yyyy-MM-dd'T'HH:mm"),
      );
    await dialog.locator('[name="purpose"]').fill('Fictional test visit');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Dr. Demo Workflow' })).toBeVisible();
    await page.locator('textarea[name="questions"]').fill('Review my routine.');
    await page.getByRole('button', { name: 'Prepare doctor visit summary', exact: true }).click();
    await page.getByRole('dialog').getByRole('checkbox').check();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Print' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.goto('/app/assistant');
    await page.getByRole('button', { name: 'Next appointment', exact: true }).click();
    await expect(page.locator('.chat-message.answer')).toContainText('Dr. Demo Workflow');
    await expect(page.locator('.chat-message.answer')).toContainText('Verified record lookup');
  });
  test('feature screens have no serious accessibility violations or runtime errors', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120000);
    await demo(page);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const findings: Record<string, unknown> = {};
    for (const section of [
      'medicines',
      'scan',
      'appointments',
      'health',
      'family',
      'assistant',
      'records',
      'emergency',
      'notifications',
      'settings',
    ]) {
      await page.goto(`/app/${section}`);
      await expect(page.locator('main h1')).toBeVisible();
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      findings[section] = result.violations;
    }
    await testInfo.attach('accessibility-feature-screens', {
      body: JSON.stringify(findings, null, 2),
      contentType: 'application/json',
    });
    expect(Object.entries(findings).filter(([, v]) => (v as unknown[]).length)).toEqual([]);
    expect(errors).toEqual([]);
  });
  test('six languages persist; mobile and Easy Mode work without horizontal overflow', async ({
    page,
  }, testInfo) => {
    await demo(page);
    await page.goto('/app/home');
    for (const [locale, label] of [
      ['te', 'ఈ రోజు సంరక్షణ చూసుకుందాం.'],
      ['ta', 'இன்றைய நலனைக் கவனிப்போம்.'],
      ['hi', 'आज की देखभाल करें।'],
      ['kn', 'ಇಂದಿನ ಆರೈಕೆ ಮಾಡೋಣ.'],
      ['ml', 'ഇന്നത്തെ പരിചരണം നോക്കാം.'],
      ['en', 'Let’s take care of today.'],
    ]) {
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().endsWith('/api/settings') && response.request().method() === 'PATCH',
        ),
        page.locator('.topbar select').selectOption(locale),
      ]);
      await expect(page.getByRole('heading', { name: label })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
    }
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Let’s take care of today.' })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: 'test-results/mobile-final.png', fullPage: true });
    await page.getByRole('button', { name: 'Easy mode', exact: true }).click();
    await expect(page.locator('.app-layout')).toHaveClass(/easy-mode/);
    await expect(page.locator('.dose-actions .button').first()).toHaveCSS('min-height', '58px');
    await page.screenshot({ path: 'test-results/easy-mode-final.png', fullPage: true });
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    await testInfo.attach('accessibility-mobile-easy', {
      body: JSON.stringify(results.violations, null, 2),
      contentType: 'application/json',
    });
    expect(results.violations).toEqual([]);
    await page.request.patch('/api/settings', {
      headers: { Origin: origin },
      data: { easyMode: false, language: 'en' },
    });
  });
});
