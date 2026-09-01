import { expect, test, type Browser, type Page } from '@playwright/test';

const accounts = [
  { role: 'member', email: process.env.E2E_MEMBER_EMAIL, password: process.env.E2E_MEMBER_PASSWORD },
  { role: 'mission', email: process.env.E2E_MISSION_EMAIL, password: process.env.E2E_MISSION_PASSWORD },
  { role: 'teacher', email: process.env.E2E_TEACHER_EMAIL, password: process.env.E2E_TEACHER_PASSWORD },
];

const configured = accounts.every((account) => Boolean(account.email && account.password));

test.describe('wolves and sheep mobile gameplay', () => {
  test.skip(!configured, 'Requires E2E_MEMBER_*, E2E_MISSION_*, and E2E_TEACHER_* secrets.');

  async function signIn(page: Page, email: string, password: string) {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.locator('input[name="email"]').first().fill(email);
    await page.locator('input[name="password"]').first().fill(password);
    await page.locator('button[type="submit"]').first().click();
    const skipPin = page.getByRole('button', { name: '나중에 하기', exact: true });
    if (await skipPin.isVisible({ timeout: 3000 }).catch(() => false)) await skipPin.click();
    await expect(page).not.toHaveURL(/\/login(?:$|[?#])/, { timeout: 15_000 });
  }

  async function createRoom(page: Page) {
    await page.goto('/wolves-and-sheep', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '새 방 만들기', exact: true }).click();
    const roomCode = page.locator('p.text-3xl').filter({ hasText: /^[A-Z2-9]{4}$/ }).first();
    await expect(roomCode).toBeVisible({ timeout: 15_000 });
    return (await roomCode.textContent())?.trim() ?? '';
  }

  async function expectNoHorizontalOverflow(page: Page) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, 'game page has horizontal overflow').toBe(false);
  }

  test('three authenticated players can enter a room and host can start on mobile', async ({ browser }) => {
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);
    const pages = await Promise.all(contexts.map(async (context) => context.pages()[0] ?? context.newPage()));

    try {
      await Promise.all(accounts.map((account, index) => signIn(pages[index], account.email!, account.password!)));

      const roomCode = await createRoom(pages[0]);
      expect(roomCode).toMatch(/^[A-Z2-9]{4}$/);

      await Promise.all([
        pages[1].goto(`/wolves-and-sheep?room=${roomCode}`, { waitUntil: 'domcontentloaded' }),
        pages[2].goto(`/wolves-and-sheep?room=${roomCode}`, { waitUntil: 'domcontentloaded' }),
      ]);

      const participantText = pages[0].locator('text=/참가자 \\(3명/');
      await expect(participantText).toBeVisible({ timeout: 15_000 });
      await expect(pages[1].locator('text=/참가자 \\(3명/')).toBeVisible({ timeout: 15_000 });
      await expect(pages[2].locator('text=/참가자 \\(3명/')).toBeVisible({ timeout: 15_000 });

      const start = pages[0].getByRole('button', { name: '게임 시작', exact: true });
      await expect(start).toBeEnabled({ timeout: 10_000 });
      await start.tap();

      for (const page of pages) {
        await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 });
        await expectNoHorizontalOverflow(page);
      }

      const gameBox = await pages[0].locator('canvas').first().boundingBox();
      expect(gameBox?.width ?? 0).toBeGreaterThan(200);
      expect(gameBox?.height ?? 0).toBeGreaterThan(200);

      const viewport = pages[0].viewportSize();
      expect(viewport).not.toBeNull();
      const x = Math.max(20, Math.floor((viewport?.width ?? 390) * 0.2));
      const y = Math.max(20, Math.floor((viewport?.height ?? 844) * 0.75));
      await pages[0].mouse.move(x, y);
      await pages[0].mouse.down();
      await pages[0].mouse.move(x + 30, y - 20, { steps: 5 });
      await pages[0].mouse.up();

      await expectNoHorizontalOverflow(pages[0]);
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
});
