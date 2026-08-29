import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

const BASE_URL = process.env.E2E_BASE_URL || 'https://gnhweb.vercel.app';
const BASE_ORIGIN = new URL(BASE_URL).origin;

type RoleKey = 'member' | 'mission' | 'teacher' | 'chief' | 'president' | 'assignedTeacher';

const roleCredentials: Record<RoleKey, { email?: string; password?: string }> = {
  member: { email: process.env.E2E_MEMBER_EMAIL, password: process.env.E2E_MEMBER_PASSWORD },
  mission: { email: process.env.E2E_MISSION_EMAIL, password: process.env.E2E_MISSION_PASSWORD },
  teacher: { email: process.env.E2E_TEACHER_EMAIL, password: process.env.E2E_TEACHER_PASSWORD },
  chief: { email: process.env.E2E_CHIEF_EMAIL, password: process.env.E2E_CHIEF_PASSWORD },
  president: { email: process.env.E2E_PRESIDENT_EMAIL, password: process.env.E2E_PRESIDENT_PASSWORD },
  assignedTeacher: { email: process.env.E2E_ASSIGNED_TEACHER_EMAIL, password: process.env.E2E_ASSIGNED_TEACHER_PASSWORD },
};

function routePathsFromRouter(): string[] {
  const source = fs.readFileSync('src/router/config.tsx', 'utf8');
  return [...new Set(
    [...source.matchAll(/path:\s*["'](\/[^"']*)["']/g)]
      .map((m) => m[1])
      .filter((path) => !path.includes(':'))
      .filter((path) => !path.includes('*'))
      .sort(),
  )];
}

const ERROR_MARKERS = [
  'application error',
  'internal server error',
  'chunkloaderror',
  'failed to fetch dynamically imported module',
  'uncaught error',
];
const NOT_FOUND_MARKERS = ['페이지를 찾을 수 없습니다', 'page not found'];
const SAFE_ROUTE_SKIP = [/\/write$/, /\/edit$/, /\/reset-password$/];
const EXPECTED_GUARD_REDIRECTS = new Set(['/login', '/unauthorized', '/forbidden']);

async function attachRuntimeGuards(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/favicon|ResizeObserver|net::ERR_BLOCKED_BY_CLIENT/i.test(text)) return;
    consoleErrors.push(text);
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    try {
      const url = new URL(request.url());
      if (url.origin !== BASE_ORIGIN || url.pathname.endsWith('/favicon.ico')) return;
      failedRequests.push(`${request.url()} :: ${request.failure()?.errorText || 'unknown request failure'}`);
    } catch {}
  });
  return { consoleErrors, pageErrors, failedRequests };
}

function resetGuards(guards: Awaited<ReturnType<typeof attachRuntimeGuards>>) {
  guards.consoleErrors.length = 0;
  guards.pageErrors.length = 0;
  guards.failedRequests.length = 0;
}

async function assertHealthyPage(
  page: Page,
  requestedPath: string,
  guards: Awaited<ReturnType<typeof attachRuntimeGuards>>,
  options: { allowGuardRedirect?: boolean } = {},
) {
  resetGuards(guards);
  const response = await page.goto(`${BASE_URL}${requestedPath}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  expect(response, `No response for ${requestedPath}`).not.toBeNull();
  expect(response!.status(), `HTTP ${response!.status()} on ${requestedPath}`).toBeLessThan(500);
  await page.waitForTimeout(350);

  const body = (await page.locator('body').innerText().catch(() => '')).toLowerCase();
  for (const marker of ERROR_MARKERS) {
    expect(body, `Error marker '${marker}' on ${requestedPath}`).not.toContain(marker);
  }
  const pathname = new URL(page.url()).pathname;
  const validPath = pathname === requestedPath || pathname === '/login' ||
    (options.allowGuardRedirect && EXPECTED_GUARD_REDIRECTS.has(pathname));
  expect(validPath, `Unexpected redirect: ${requestedPath} -> ${pathname}`).toBeTruthy();
  for (const marker of NOT_FOUND_MARKERS) {
    expect(body, `NotFound marker '${marker}' on ${requestedPath}`).not.toContain(marker);
  }
  expect(guards.consoleErrors, `Console errors on ${requestedPath}`).toEqual([]);
  expect(guards.pageErrors, `Page errors on ${requestedPath}`).toEqual([]);
  expect(guards.failedRequests, `Failed same-origin requests on ${requestedPath}`).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  expect(overflow, `Horizontal overflow on ${requestedPath}`).toBeFalsy();
}

async function signIn(page: Page, role: RoleKey) {
  const { email, password } = roleCredentials[role];
  test.skip(!email || !password, `Missing ${role} E2E credentials`);
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.locator('input[name="email"]').fill(email!);
  await page.locator('input[name="password"]').fill(password!);
  await page.getByRole('button', { name: /로그인/i }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 20_000 }).not.toBe('/login');
}

async function crawlLinkedRoutes(page: Page, guards: Awaited<ReturnType<typeof attachRuntimeGuards>>, maxRoutes = 80) {
  // The home route is member-protected, so starting there only discovers /login.
  // Seed the crawl with genuinely public entry points instead.
  const queue = ['/search', '/clubs', '/notices', '/schedule', '/tools', '/games', '/ganghak-news'];
  const visited = new Set<string>();
  while (queue.length && visited.size < maxRoutes) {
    const path = queue.shift()!;
    if (visited.has(path) || SAFE_ROUTE_SKIP.some((rx) => rx.test(path))) continue;
    visited.add(path);
    await assertHealthyPage(page, path, guards);
    const links = await page.locator('a[href]').evaluateAll((els) => els.map((el) => (el as HTMLAnchorElement).href));
    for (const href of links) {
      try {
        const url = new URL(href);
        if (url.origin !== BASE_ORIGIN) continue;
        const pathOnly = url.pathname;
        if (!pathOnly || visited.has(pathOnly) || SAFE_ROUTE_SKIP.some((rx) => rx.test(url.pathname))) continue;
        if (!queue.includes(pathOnly)) queue.push(pathOnly);
      } catch {}
    }
  }
  expect(visited.size, 'Linked production routes crawled').toBeGreaterThan(5);
  return [...visited];
}

test.describe('production public site audit', () => {
  for (const browserName of ['chromium', 'webkit'] as const) {
    test(`linked-route crawl on ${browserName}`, async ({ page }) => {
      test.setTimeout(300_000);
      const guards = await attachRuntimeGuards(page);
      await crawlLinkedRoutes(page, guards, 80);
    });
  }

  test('all registered static routes respond without server errors', async ({ page }) => {
    test.setTimeout(360_000);
    const guards = await attachRuntimeGuards(page);
    const routes = routePathsFromRouter();
    expect(routes.length).toBeGreaterThan(40);
    for (const path of routes) await assertHealthyPage(page, path, guards, { allowGuardRedirect: true });
  });
});

test.describe('production authenticated route audit', () => {
  test('member can load every registered static route without runtime errors', async ({ page }) => {
    test.setTimeout(600_000);
    await signIn(page, 'member');
    const guards = await attachRuntimeGuards(page);
    const routes = routePathsFromRouter().filter((path) => !SAFE_ROUTE_SKIP.some((rx) => rx.test(path)));
    for (const path of routes) {
      await assertHealthyPage(page, path, guards, { allowGuardRedirect: true });
    }
  });

  for (const role of Object.keys(roleCredentials) as RoleKey[]) {
    test(`${role} authenticates and browses core routes`, async ({ page }) => {
      test.setTimeout(240_000);
      await signIn(page, role);
      const guards = await attachRuntimeGuards(page);
      const coreRoutes = ['/', '/search', '/clubs', '/notices', '/schedule', '/dashboard', '/profile'];
      for (const path of coreRoutes) await assertHealthyPage(page, path, guards, { allowGuardRedirect: true });

      if (role === 'teacher' || role === 'assignedTeacher') {
        for (const path of ['/teacher-dashboard', '/teacher-dashboard/quiz-manage', '/teacher-dashboard/quote-manage']) {
          await assertHealthyPage(page, path, guards, { allowGuardRedirect: true });
        }
      }
      if (role === 'chief') await assertHealthyPage(page, '/settings/absence-reasons', guards, { allowGuardRedirect: true });
    });
  }
});

test.describe('critical mobile interactions', () => {
  for (const role of Object.keys(roleCredentials) as RoleKey[]) {
    test(`${role} has usable mobile controls`, async ({ page }) => {
      test.setTimeout(180_000);
      await signIn(page, role);
      const guards = await attachRuntimeGuards(page);
      await assertHealthyPage(page, '/search', guards, { allowGuardRedirect: true });
      const buttons = page.getByRole('button');
      const count = await buttons.count();
      for (let i = 0; i < Math.min(count, 20); i += 1) {
        const box = await buttons.nth(i).boundingBox().catch(() => null);
        if (!box || box.width < 1 || box.height < 1) continue;
        expect(box.width, `Small button width on ${role}`).toBeGreaterThanOrEqual(40);
        expect(box.height, `Small button height on ${role}`).toBeGreaterThanOrEqual(40);
      }
    });
  }
});
