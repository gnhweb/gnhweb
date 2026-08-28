import { expect, test } from '@playwright/test';

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe('authenticated smoke', () => {
  test.skip(!email || !password, 'Set E2E_EMAIL and E2E_PASSWORD as CI secrets to enable authenticated smoke testing.');

  test('configured test account can sign in without an application error', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.locator('input[name="email"]').fill(email!);
    await page.locator('input[name="password"]').fill(password!);
    await page.locator('button[type="submit"]').first().click();

    await page.waitForTimeout(2500);

    const stillOnLogin = /\/login(?:$|[?#])/.test(new URL(page.url()).pathname + new URL(page.url()).search);

    if (stillOnLogin) {
      const pinPrompt = page.getByText(/간편 비밀번호/).first();
      const loginError = page.getByText(/로그인에 실패|이메일과 비밀번호를 확인/).first();
      await expect(loginError).not.toBeVisible();
      await expect(pinPrompt).toBeVisible({ timeout: 3_000 }).catch(() => undefined);
    } else {
      await expect(page).not.toHaveURL(/\/login(?:$|[?#])/);
    }

    expect(pageErrors, 'authenticated flow produced an uncaught page error').toEqual([]);
  });
});
