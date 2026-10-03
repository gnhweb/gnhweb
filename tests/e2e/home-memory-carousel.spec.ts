import { expect, test } from '@playwright/test';

test.describe('production home memory carousel', () => {
  test('shows the memory photo as the first hero slide', async ({ page }) => {
    test.setTimeout(90_000);

    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.locator('input[name="email"]').first().fill(process.env.E2E_MEMBER_EMAIL!);
    await page.locator('input[name="password"]').first().fill(process.env.E2E_MEMBER_PASSWORD!);
    await page.locator('button[type="submit"]').first().click();
    await expect(page).not.toHaveURL(/\/login(?:$|[?#])/, { timeout: 30_000 });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 45_000 });

    const skipPin = page.getByRole('button', { name: '나중에 하기', exact: true });
    const memoryLink = page.getByRole('link', { name: /^추억창 보러가기/ });

    // The PIN prompt is asynchronous after auth. Wait for either the prompt
    // or the actual homepage target, then continue with the target assertion.
    await Promise.race([
      skipPin.waitFor({ state: 'visible', timeout: 45_000 }).then(() => skipPin.click()),
      memoryLink.waitFor({ state: 'visible', timeout: 45_000 }),
    ]);
    if (await skipPin.isVisible().catch(() => false)) {
      await skipPin.click().catch(() => {});
    }
    await expect(memoryLink).toBeVisible({ timeout: 30_000 });

    const memoryLink = page.getByRole('link', { name: /^추억창 보러가기/ });
    await expect(memoryLink).toBeVisible({ timeout: 30_000 });
    await expect(memoryLink).toHaveAttribute('href', '/memory-board');

    const memoryHeading = page.getByRole('heading', { name: '강학 추억 보러가기', exact: true });
    await expect(memoryHeading).toBeVisible({ timeout: 30_000 });

    await expect(page.getByText('추억창', { exact: true })).toBeVisible({ timeout: 10_000 });

    const heroSection = memoryHeading.locator('xpath=ancestor::section[1]');
    const heroImage = heroSection.locator('img').first();
    await expect(heroImage).toBeVisible();
    await expect(heroImage).toHaveAttribute('alt', '강학 추억 보러가기');
    await expect(heroImage).not.toHaveAttribute('src', '/hero/main.svg');

    const cta = heroSection.getByRole('link', { name: /^추억창 보러가기/ });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/memory-board');
  });
});
