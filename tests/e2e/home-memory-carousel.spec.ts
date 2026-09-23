import { expect, test } from '@playwright/test';

test.describe('production home memory carousel', () => {
  test('shows the memory photo as the first hero slide', async ({ page }) => {
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

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 45_000 });

    const memoryLink = page.getByRole('link', { name: '추억창 보러가기', exact: true });
    await expect(memoryLink).toBeVisible({ timeout: 60_000 });
    await expect(memoryLink).toHaveAttribute('href', '/memory-board');

    const memoryHeading = page.getByRole('heading', { name: /우리의 추억을.*다시 만나보세요/s });
    await expect(memoryHeading).toBeVisible();

    const firstSlideButton = page.getByRole('button', { name: '1번 슬라이드로 이동', exact: true });
    await expect(firstSlideButton).toBeVisible({ timeout: 20_000 });
    await firstSlideButton.click();

    await expect(page.getByText('추억창', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(memoryHeading).toBeVisible();

    const heroImage = memoryHeading.locator('xpath=ancestor::section[1]').locator('img').first();
    await expect(heroImage).toBeVisible();
    await expect(heroImage).toHaveAttribute('alt', /우리의 추억을.*다시 만나보세요/s);
    await expect(heroImage).not.toHaveAttribute('src', '/hero/main.svg');
  });
});
