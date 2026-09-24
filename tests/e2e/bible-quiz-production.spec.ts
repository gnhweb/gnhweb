import { expect, test } from '@playwright/test';

test.describe('production Bible quiz', () => {
  test('authenticated member can load quiz questions through the AI gateway', async ({ page }) => {
    const email = process.env.E2E_MEMBER_EMAIL;
    const password = process.env.E2E_MEMBER_PASSWORD;
    test.skip(!email || !password, 'E2E member credentials are not configured.');

    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.locator('input[name="email"]').first().fill(email!);
    await page.locator('input[name="password"]').first().fill(password!);
    await page.locator('button[type="submit"]').first().click();

    const skipPin = page.getByRole('button', { name: '나중에 하기', exact: true });
    await skipPin.click({ timeout: 10_000 }).catch(() => {});
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 60_000 }).not.toBe('/login');

    await page.goto('/bible-quiz', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await expect(page.getByRole('heading', { name: 'AI 성경 퀴즈', exact: true })).toBeVisible({
      timeout: 30_000,
    });

    const startButton = page.getByRole('button', { name: '퀴즈 시작하기', exact: true });
    await expect(startButton).toBeVisible({ timeout: 15_000 });
    await startButton.click();

    await expect(page.getByText(/^1 \/ 10$/)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('button').filter({ hasText: /1/ }).first()).toBeVisible();
  });
});
