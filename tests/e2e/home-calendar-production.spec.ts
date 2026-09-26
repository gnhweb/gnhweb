import { expect, test } from '@playwright/test';

test.describe('production home calendar', () => {
  test('renders general and club event dots together without clipping', async ({ page }) => {
    const email = process.env.E2E_MEMBER_EMAIL;
    const password = process.env.E2E_MEMBER_PASSWORD;
    test.skip(!email || !password, 'E2E member credentials are not configured.');

    test.setTimeout(90_000);

    const injectedDate = new Date();
    injectedDate.setDate(injectedDate.getDate() + 2);
    const eventDate = [
      injectedDate.getFullYear(),
      String(injectedDate.getMonth() + 1).padStart(2, '0'),
      String(injectedDate.getDate()).padStart(2, '0'),
    ].join('-');

    await page.route('**/*', async (route) => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.pathname.endsWith('/schedules')) {
        const response = await route.fetch();
        const schedules = (await response.json()) as Array<Record<string, unknown>>;
        const injectedSchedules = [
          {
            id: 'e2e-calendar-general',
            title: 'E2E 전체 일정',
            description: null,
            event_date: eventDate,
            event_time: null,
            location: null,
            target_club: null,
          },
          {
            id: 'e2e-calendar-saeullim',
            title: 'E2E 새울림 일정',
            description: null,
            event_date: eventDate,
            event_time: null,
            location: null,
            target_club: 'saeullim',
          },
          {
            id: 'e2e-calendar-cheonjipoong',
            title: 'E2E 천지풍 일정',
            description: null,
            event_date: eventDate,
            event_time: null,
            location: null,
            target_club: 'cheonjipoong',
          },
          {
            id: 'e2e-calendar-cheonjihu',
            title: 'E2E 천지후 일정',
            description: null,
            event_date: eventDate,
            event_time: null,
            location: null,
            target_club: 'cheonjihu',
          },
        ];

        await route.fulfill({
          response,
          json: [...schedules, ...injectedSchedules],
        });
        return;
      }

      await route.continue();
    });

    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.locator('input[name="email"]').first().fill(email!);
    await page.locator('input[name="password"]').first().fill(password!);
    await page.locator('button[type="submit"]').first().click();

    const skipPin = page.getByRole('button', { name: '나중에 하기', exact: true });
    const dismissPinPrompt = async () => {
      if (await skipPin.isVisible({ timeout: 15_000 }).catch(() => false)) {
        await skipPin.click();
        await expect(page).not.toHaveURL(/\/login(?:$|[?#])/, { timeout: 30_000 });
      }
    };

    await expect(page).not.toHaveURL(/\/login(?:$|[?#])/, { timeout: 30_000 });
    await dismissPinPrompt();
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await dismissPinPrompt();

    const scheduleTabLabel = page.getByText('일정', { exact: true }).first();
    await expect(scheduleTabLabel).toBeAttached();
    await scheduleTabLabel.locator('xpath=..').click({ force: true });

    const calendar = page
      .getByRole('heading', { name: '일정 달력', exact: true })
      .locator('xpath=..')
      .locator('xpath=..');

    await expect(calendar).toBeVisible({ timeout: 30_000 });
    await expect(calendar.getByText(`${injectedDate.getFullYear()}년 ${injectedDate.getMonth() + 1}월`, { exact: true })).toBeVisible();

    const dayButton = calendar.getByRole('button', {
      name: new RegExp(`^${injectedDate.getDate()}$`),
    }).first();

    await expect(dayButton).toBeVisible();
    await dayButton.click();

    const dotContainer = calendar.locator('span[aria-label="이 날짜의 일정"]').last();
    await expect(dotContainer).toBeVisible();

    const dotChildren = dotContainer.locator(':scope > span');
    await expect(dotChildren).toHaveCount(4);
    await expect(dotChildren.nth(0)).toHaveClass(/rounded-full/);
    await expect(dotChildren.nth(1)).toHaveClass(/rounded-full/);
    await expect(dotChildren.nth(2)).toHaveClass(/rounded-full/);
    await expect(dotContainer.getByText('+', { exact: true })).toBeVisible();

    await expect(calendar.getByText(eventDate, { exact: true })).toBeVisible();
    await expect(calendar.getByText('E2E 전체 일정', { exact: true })).toBeVisible();
    await expect(calendar.getByText('E2E 새울림 일정', { exact: true })).toBeVisible();
  });
});
