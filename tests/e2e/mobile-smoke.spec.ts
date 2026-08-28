import { expect, test, type Page } from '@playwright/test';

const publicRoutes = [
  { path: '/login', heading: '로그인' },
  { path: '/clubs', heading: '동아리' },
  { path: '/notices', heading: '공지사항' },
  { path: '/schedule', heading: '일정' },
  { path: '/search', heading: '사이트 검색' },
  { path: '/games', heading: '게임' },
];

function installErrorCapture(page: Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const url = message.location().url;
    if (!url || url.startsWith(page.url().split('/').slice(0, 3).join('/'))) {
      consoleErrors.push(message.text());
    }
  });

  return { pageErrors, consoleErrors };
}

async function expectNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > window.innerWidth + 1;
  });
  expect(hasOverflow, 'mobile page has horizontal overflow').toBe(false);
}

test.describe('mobile public smoke', () => {
  for (const route of publicRoutes) {
    test(`${route.path} loads without horizontal overflow`, async ({ page }) => {
      const errors = installErrorCapture(page);
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      expect(response, `no response for ${route.path}`).not.toBeNull();
      expect(response?.status(), `HTTP status for ${route.path}`).toBeLessThan(500);

      await expect(page.getByRole('heading', { name: route.heading, exact: true }).first()).toBeVisible({ timeout: 15_000 });
      await expectNoHorizontalOverflow(page);

      expect(errors.pageErrors, `page errors on ${route.path}`).toEqual([]);
    });
  }

  test('login form is touch-friendly and keeps page scrollable', async ({ page }) => {
    const errors = installErrorCapture(page);
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    const email = page.locator('input[name="email"]');
    const password = page.locator('input[name="password"]');
    const submit = page.locator('button[type="submit"]').first();

    await expect(email).toBeVisible();
    await expect(password).toBeVisible();
    await expect(submit).toBeVisible();

    const metrics = await page.evaluate(() => {
      const selectors = ['input[name="email"]', 'input[name="password"]', 'button[type="submit"]'];
      return selectors.map((selector) => {
        const el = document.querySelector(selector) as HTMLElement | null;
        const rect = el?.getBoundingClientRect();
        return {
          selector,
          width: rect?.width ?? 0,
          height: rect?.height ?? 0,
          fontSize: el ? Number.parseFloat(getComputedStyle(el).fontSize) : 0,
        };
      });
    });

    for (const metric of metrics) {
      expect(metric.height, `${metric.selector} touch height`).toBeGreaterThanOrEqual(44);
    }
    expect(metrics[0].fontSize, 'email input font size').toBeGreaterThanOrEqual(16);
    expect(metrics[1].fontSize, 'password input font size').toBeGreaterThanOrEqual(16);

    await email.fill('test@example.com');
    await password.fill('not-a-real-password');
    await expectNoHorizontalOverflow(page);

    const scrollState = await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
      return {
        viewport: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });
    expect(scrollState.scrollWidth).toBeLessThanOrEqual(scrollState.viewport + 1);
    expect(errors.pageErrors).toEqual([]);
  });

  test('site search can submit a query on mobile', async ({ page }) => {
    const errors = installErrorCapture(page);
    await page.goto('/search', { waitUntil: 'domcontentloaded' });

    const searchInput = page.getByRole('textbox', { name: '사이트 검색' });
    await searchInput.fill('출석');
    await page.getByRole('button', { name: '검색', exact: true }).click();

    await expect(page).toHaveURL(/\/search\?q=%EC%B6%9C%EC%84%9D/);
    await expectNoHorizontalOverflow(page);
    expect(errors.pageErrors).toEqual([]);
  });
});
