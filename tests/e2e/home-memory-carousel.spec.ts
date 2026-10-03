import { expect, test } from '@playwright/test';

test.describe('production home memory carousel', () => {
  test('shows the memory photo as the first hero slide', async ({ page }) => {
    // Memory photos are public homepage content; this test intentionally does
    // not authenticate so Neon Auth onboarding cannot mask the homepage flow.
    test.setTimeout(60_000);
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 45_000 });

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
