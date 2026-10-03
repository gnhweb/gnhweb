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

    await page.route('**/schedules**', async (route) => {
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
        status: response.status(),
        headers: response.headers(),
        body: JSON.stringify([...schedules, ...injectedSchedules]),
      });
    });

    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.locator('input[name="email"]').first().fill(email!);
    await page.locator('input[name="password"]').first().fill(password!);
    await page.locator('button[type="submit"]').first().click();
    await expect(page).not.toHaveURL(/\/login(?:$|[?#])/, { timeout: 30_000 });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 45_000 });

    const skipPin = page.getByRole('button', { name: '나중에 하기', exact: true });
    const scheduleTab = page.getByRole('button', { name: /일정$/ }).first();

    await Promise.race([
      skipPin.waitFor({ state: 'visible', timeout: 45_000 }).then(() => skipPin.click()),
      scheduleTab.waitFor({ state: 'visible', timeout: 45_000 }),
    ]);
    if (await skipPin.isVisible().catch(() => false)) {
      await skipPin.click().catch(() => {});
    }
    await expect(scheduleTab).toBeVisible({ timeout: 30_000 });
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
    await page.unrouteAll({ behavior: 'wait' });
  });
});
