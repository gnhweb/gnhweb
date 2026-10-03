import { expect, test } from '@playwright/test';

test.describe('production home memory carousel', () => {
  test('shows the memory photo as the first hero slide', async ({ page }) => {
    const email = process.env.E2E_MEMBER_EMAIL;
    const password = process.env.E2E_MEMBER_PASSWORD;
    test.skip(!email || !password, 'E2E member credentials are not configured.');

    test.setTimeout(90_000);

    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.locator('input[name="email"]').first().fill(email!);
    await page.locator('input[name="password"]').first().fill(password!);
    await page.locator('button[type="submit"]').first().click();

    const skipPin = page.getByRole('button', { name: '나중에 하기', exact: true });
    const dismissPinPrompt = async () => {
      // Neon Auth may render the first-device PIN prompt after the login
      // redirect. Poll briefly instead of checking visibility only once.
      for (let attempt = 0; attempt < 6; attempt += 1) {
        if (await skipPin.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await skipPin.click();
          await expect(page).not.toHaveURL(/\/login(?:$|[?#])/, { timeout: 30_000 });
          return;
        }
        await page.waitForTimeout(500);
      }
    };

    await expect(page).not.toHaveURL(/\/login(?:$|[?#])/, { timeout: 30_000 });
    await dismissPinPrompt();
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await dismissPinPrompt();

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
