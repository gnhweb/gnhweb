import { expect, test } from '@playwright/test';

const accounts = [
  { role: 'member', email: process.env.E2E_MEMBER_EMAIL, password: process.env.E2E_MEMBER_PASSWORD },
  { role: 'mission', email: process.env.E2E_MISSION_EMAIL, password: process.env.E2E_MISSION_PASSWORD },
  { role: 'teacher', email: process.env.E2E_TEACHER_EMAIL, password: process.env.E2E_TEACHER_PASSWORD },
  { role: 'chief', email: process.env.E2E_CHIEF_EMAIL, password: process.env.E2E_CHIEF_PASSWORD },
  { role: 'president', email: process.env.E2E_PRESIDENT_EMAIL, password: process.env.E2E_PRESIDENT_PASSWORD },
  { role: 'assigned-teacher', email: process.env.E2E_ASSIGNED_TEACHER_EMAIL, password: process.env.E2E_ASSIGNED_TEACHER_PASSWORD },
];

const configuredAccounts = accounts.filter((account) => Boolean(account.email && account.password));

test.describe('authenticated smoke', () => {
  test.skip(configuredAccounts.length === 0, 'Configure all role-specific E2E_* secrets to enable authenticated smoke testing.');

  for (const account of configuredAccounts) {
    test(`${account.role} account can sign in without an application error`, async ({ page }) => {
      const pageErrors: string[] = [];
      const consoleErrors: string[] = [];

      page.on('pageerror', (error) => pageErrors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });

      await page.goto('/login', { waitUntil: 'domcontentloaded' });
      await page.locator('input[name="email"]').first().fill(account.email!);
      await page.locator('input[name="password"]').first().fill(account.password!);

      const authResponsePromise = page.waitForResponse(
        (response) => response.url().includes('/auth/v1/token') && response.request().method() === 'POST',
        { timeout: 15_000 },
      ).catch(() => null);

      await page.locator('button[type="submit"]').first().click();
      const authResponse = await authResponsePromise;
      let authBody = '';
      if (authResponse) {
        try {
          const json = await authResponse.json();
          authBody = JSON.stringify({ error: json?.error, error_code: json?.error_code, msg: json?.msg });
        } catch {
          authBody = '';
        }
      }

      const visibleError = await page.locator('[class*="rose"], [role="alert"]').first().textContent().catch(() => null);
      expect(authResponse?.status(), `${account.role}: Supabase auth response missing/failed. UI error: ${visibleError ?? 'none'}. Body: ${authBody || 'none'}`).toBe(200);

      const skipPin = page.getByRole('button', { name: '나중에 하기', exact: true });
      if (await skipPin.isVisible({ timeout: 3000 }).catch(() => false)) {
        await skipPin.click();
      }

      await expect(page).not.toHaveURL(/\/login(?:$|[?#])/, { timeout: 15_000 });
      await page.waitForTimeout(750);

      expect(pageErrors, `${account.role}: uncaught page error`).toEqual([]);
      expect(consoleErrors, `${account.role}: console error`).toEqual([]);
    });
  }
});
