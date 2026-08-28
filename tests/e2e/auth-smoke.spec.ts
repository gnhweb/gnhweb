import { expect, test } from '@playwright/test';

const accounts = [
  { role: 'member', email: process.env.E2E_MEMBER_EMAIL, password: process.env.E2E_MEMBER_PASSWORD },
  { role: 'mission', email: process.env.E2E_MISSION_EMAIL, password: process.env.E2E_MISSION_PASSWORD },
  { role: 'teacher', email: process.env.E2E_TEACHER_EMAIL, password: process.env.E2E_TEACHER_PASSWORD },
  // Backward-compatible single-account configuration.
  { role: 'default', email: process.env.E2E_EMAIL, password: process.env.E2E_PASSWORD },
].filter((account, index, all) => {
  if (!account.email || !account.password) return false;
  return all.findIndex((candidate) => candidate.email === account.email) === index;
});

test.describe('authenticated smoke', () => {
  test.skip(accounts.length === 0, 'Configure E2E_*_EMAIL / E2E_*_PASSWORD repository secrets to enable authenticated smoke testing.');

  for (const account of accounts) {
    test(`${account.role} account can sign in without an application error`, async ({ page }) => {
      const pageErrors: string[] = [];
      const consoleErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });

      await page.goto('/login', { waitUntil: 'domcontentloaded' });
      await page.locator('input[name="email"]').fill(account.email!);
      await page.locator('input[name="password"]').fill(account.password!);
      await page.locator('button[type="submit"]').first().click();

      await page.waitForTimeout(2500);
      const current = new URL(page.url());
      const stillOnLogin = current.pathname.endsWith('/login');

      if (stillOnLogin) {
        const loginError = page.getByText(/로그인에 실패|이메일과 비밀번호를 확인|서버 연결이 원활하지 않습니다/).first();
        await expect(loginError).not.toBeVisible();
      } else {
        await expect(page).not.toHaveURL(/\/login(?:$|[?#])/);
      }

      expect(pageErrors, `${account.role}: uncaught page error`).toEqual([]);
      expect(consoleErrors, `${account.role}: console error`).toEqual([]);
    });
  }
});
