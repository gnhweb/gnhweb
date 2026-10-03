import { expect, test } from '@playwright/test';

test.describe('production home calendar', () => {
  test('renders general and club event dots together without clipping', async ({ page }) => {
    // The home calendar is public content; authentication is not part of this
    // test and would only introduce unrelated Neon Auth onboarding state.
    test.setTimeout(60_000);

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

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 45_000 });

    const scheduleTab = page.getByRole('button', { name: /일정$/ }).first();
    await expect(scheduleTab).toBeVisible({ timeout: 15_000 });
    await scheduleTab.click();

    const calendar = page
      .getByRole('heading', { name: /일정 달력$/ })
      .locator('xpath=..')
      .locator('xpath=..');

    await expect(calendar).toBeVisible({ timeout: 30_000 });

    // The calendar opens on the current month. Move to the injected event month
    // so this test remains valid across month boundaries.
    const targetMonthLabel = `${injectedDate.getFullYear()}년 ${injectedDate.getMonth() + 1}월`;
    const nextMonthButton = calendar.getByRole('button', { name: '다음 달' });
    for (let i = 0; i < 12; i += 1) {
      if (await calendar.getByText(targetMonthLabel, { exact: true }).isVisible().catch(() => false)) break;
      await nextMonthButton.click();
    }
    await expect(calendar.getByText(targetMonthLabel, { exact: true })).toBeVisible();

    const dayButton = calendar
      .locator('button:not([disabled])')
      .filter({ hasText: new RegExp(`^\\s*${injectedDate.getDate()}\\s*$`) })
      .first();

    await expect(dayButton).toBeVisible();

    const dotContainer = calendar.locator('[aria-label="이 날짜의 동아리 일정"]').last();
    await expect(dotContainer).toBeVisible();

    const dotChildren = dotContainer.locator(':scope > span.rounded-full');
    await expect(dotChildren).toHaveCount(4);
    await expect(dotChildren.nth(0)).toHaveClass(/rounded-full/);
    await expect(dotChildren.nth(1)).toHaveClass(/rounded-full/);
    await expect(dotChildren.nth(2)).toHaveClass(/rounded-full/);
    await expect(dotChildren.nth(3)).toHaveClass(/rounded-full/);

    await dayButton.click();
    await expect(calendar.getByText(eventDate, { exact: true })).toBeVisible();
    await expect(calendar.getByText('E2E 전체 일정', { exact: true })).toBeVisible();
    await expect(calendar.getByText('E2E 새울림 일정', { exact: true })).toBeVisible();
  });
});
