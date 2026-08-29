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
  const routes = [...source.matchAll(/path:\s*["'](\/[^"']*)["']/g)]
    .map((m) => m[1])
    .filter((path) => !path.includes(':'))
    .filter((path) => !path.includes('*'));
  return [...new Set(routes)].sort();
}

const ERROR_MARKERS = [
  'application error',
  'internal server error',
  'chunkloaderror',
  'failed to fetch dynamically imported module',
  'uncaught error',
];

const NOT_FOUND_MARKERS = ['페이지를 찾을 수 없습니다', 'page not found'];

async function attachRuntimeGuards(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    try {
      const url = new URL(request.url());
      if (url.origin !== BASE_ORIGIN || url.pathname.endsWith('/favicon.ico')) return;
      const failure = request.failure()?.errorText || 'unknown request failure';
      failedRequests.push(`${request.url()} :: ${failure}`);
    } catch {
      // Ignore malformed/extension requests.
    }
  });

  return { consoleErrors, pageErrors, failedRequests };
}

function resetGuards(guards: Awaited<ReturnType<typeof attachRuntimeGuards>>) {
  guards.consoleErrors.length = 0;
  guards.pageErrors.length = 0;
  guards.failedRequests.length = 0;
}

async function auditPage(page: Page, path: string, guards: Awaited<ReturnType<typeof attachRuntimeGuards>>) {
  resetGuards(guards);
  const response = await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  expect(response, `No response for ${path}`).not.toBeNull();
  expect(response!.status(), `HTTP ${response!.status()} on ${path}`).toBeLessThan(500);
  await page.waitForTimeout(600);

  const body = (await page.locator('body').innerText().catch(() => '')).toLowerCase();
  for (const marker of ERROR_MARKERS) {
    expect(body, `Error marker '${marker}' on ${path}`).not.toContain(marker);
  }

  const pathname = new URL(page.url()).pathname;
  if (pathname === path || pathname === '/login') {
    for (const marker of NOT_FOUND_MARKERS) {
      expect(body, `NotFound marker '${marker}' on ${path}`).not.toContain(marker);
    }
  }

  const meaningfulConsoleErrors = guards.consoleErrors.filter(
    (message) =>
      !message.includes('favicon') &&
      !message.includes('ResizeObserver loop') &&
      !message.toLowerCase().includes('punycode'),
  );

  expect(meaningfulConsoleErrors, `Console errors on ${path}`).toEqual([]);
  expect(guards.pageErrors, `Page errors on ${path}`).toEqual([]);
  expect(guards.failedRequests, `Failed same-origin requests on ${path}`).toEqual([]);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  expect(overflow, `Horizontal overflow on ${path}`).toBeFalsy();
}

async function signIn(page: Page, role: RoleKey) {
  const { email, password } = roleCredentials[role];
  test.skip(!email || !password, `Missing ${role} E2E credentials`);

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Actual login inputs from src/pages/login/page.tsx.
  await page.locator('input[name="email"]').fill(email!);
  await page.locator('input[name="password"]').fill(password!);
  await page.getByRole('button', { name: /로그인/i }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 20000 }).not.toBe('/login');
}

test.describe('production site audit - all registered static routes', () => {
  test('all registered static routes load on mobile Chromium', async ({ page }) => {
    test.setTimeout(300_000);
    const routes = routePathsFromRouter();
    expect(routes.length).toBeGreaterThan(20);
    const guards = await attachRuntimeGuards(page);
    for (const path of routes) await auditPage(page, path, guards);
  });

  test('all registered static routes load on mobile WebKit', async ({ page }) => {
    test.setTimeout(300_000);
    const routes = routePathsFromRouter();
    expect(routes.length).toBeGreaterThan(20);
    const guards = await attachRuntimeGuards(page);
    for (const path of routes) await auditPage(page, path, guards);
  });
});

// Role coverage uses the routes defined by the app rather than an invented permission matrix.
// This catches runtime crashes and broken redirects for every role without mutating production data.
test.describe('production role audit', () => {
  for (const role of Object.keys(roleCredentials) as RoleKey[]) {
    test(`${role} can sign in and browse registered routes`, async ({ page }) => {
      test.setTimeout(360_000);
      await signIn(page, role);
      const routes = routePathsFromRouter();
      const guards = await attachRuntimeGuards(page);
      for (const path of routes) await auditPage(page, path, guards);
    });
  }
});

test.describe('critical mobile interaction audit', () => {
  for (const role of ['member', 'teacher', 'chief', 'assignedTeacher'] as RoleKey[]) {
    test(`${role} keeps key mobile navigation and controls usable`, async ({ page }) => {
      test.setTimeout(150_000);
      await signIn(page, role);
      const guards = await attachRuntimeGuards(page);

      for (const path of ['/search', '/clubs', '/notices', '/schedule', '/dashboard', '/profile']) {
        await auditPage(page, path, guards);
        const buttons = page.getByRole('button');
        const count = await buttons.count();
        for (let i = 0; i < Math.min(count, 12); i += 1) {
          const box = await buttons.nth(i).boundingBox().catch(() => null);
          if (!box || box.width < 1 || box.height < 1) continue;
          expect(box.width, `Small button width on ${path}`).toBeGreaterThanOrEqual(40);
          expect(box.height, `Small button height on ${path}`).toBeGreaterThanOrEqual(40);
        }
      }
    });
  }
});
