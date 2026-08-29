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
      const authResponses: Array<{ status: number; body: string }> = [];

      page.on('pageerror', (error) => pageErrors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('response', async (response) => {
        const url = response.url();
        if (!url.includes('/auth/v1/token') || response.request().method() !== 'POST') return;
        let body = '';
        try {
          const json = await response.json();
          body = JSON.stringify({
            error: json?.error,
            error_code: json?.error_code,
            msg: json?.msg,
          });
        } catch {
          body = '';
        }
        authResponses.push({ status: response.status(), body });
      });

      await page.goto('/login', { waitUntil: 'domcontentloaded' });
      await page.locator('input[name="email"]').first().fill(account.email!);
      await page.locator('input[name="password"]').first().fill(account.password!);

      await Promise.all([
        page.waitForResponse((response) => response.url().includes('/auth/v1/token') && response.request().method() === 'POST', { timeout: 15_000 }).catch(() => null),
        page.locator('button[type="submit"]').first().click(),
      ]);

      const authResponse = authResponses.at(-1);
      const visibleError = await page.locator('[class*="rose"], [role="alert"]').first().textContent().catch(() => null);

      // A 4xx here means the supplied E2E credentials themselves are invalid;
      // a 2xx means authentication succeeded and any failure after this point is
      // an application/session/navigation problem.
      expect(authResponse?.status, `${account.role}: Supabase auth response. UI error: ${visibleError ?? 'none'}`).toBe(200);

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
