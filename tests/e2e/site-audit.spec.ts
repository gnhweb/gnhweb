import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

const BASE_URL = process.env.E2E_BASE_URL || 'https://gnhweb.vercel.app';

type RoleKey =
  | 'member'
  | 'mission'
  | 'teacher'
  | 'chief'
  | 'president'
  | 'assignedTeacher';

const roleCredentials: Record<RoleKey, { email?: string; password?: string }> = {
  member: {
    email: process.env.E2E_MEMBER_EMAIL,
    password: process.env.E2E_MEMBER_PASSWORD,
  },
  mission: {
    email: process.env.E2E_MISSION_EMAIL,
    password: process.env.E2E_MISSION_PASSWORD,
  },
  teacher: {
    email: process.env.E2E_TEACHER_EMAIL,
    password: process.env.E2E_TEACHER_PASSWORD,
  },
  chief: {
    email: process.env.E2E_CHIEF_EMAIL,
    password: process.env.E2E_CHIEF_PASSWORD,
  },
  president: {
    email: process.env.E2E_PRESIDENT_EMAIL,
    password: process.env.E2E_PRESIDENT_PASSWORD,
  },
  assignedTeacher: {
    email: process.env.E2E_ASSIGNED_TEACHER_EMAIL,
    password: process.env.E2E_ASSIGNED_TEACHER_PASSWORD,
  },
};

function routePathsFromRouter(): string[] {
  const source = fs.readFileSync('src/router/config.tsx', 'utf8');
  const routes = [...source.matchAll(/path:\s*["'](\/[^"']*)["']/g)]
    .map((m) => m[1])
    .filter((path) => !path.includes(':'))
    .filter((path) => !path.includes('*'));

  return [...new Set(routes)].sort();
}

function errorText(text: string): boolean {
  const normalized = text.toLowerCase();
  return [
    'application error',
    'internal server error',
    'chunkloaderror',
    'failed to fetch dynamically imported module',
    'uncaught error',
  ].some((needle) => normalized.includes(needle));
}

async function attachRuntimeGuards(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText || 'unknown request failure';
    if (!request.url().includes('favicon')) failedRequests.push(`${request.url()} :: ${failure}`);
  });

  return { consoleErrors, pageErrors, failedRequests };
}

async function openAndAudit(page: Page, path: string, guards: Awaited<ReturnType<typeof attachRuntimeGuards>>) {
  const response = await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  expect(response, `No response for ${path}`).not.toBeNull();
  expect(response!.status(), `HTTP ${response!.status()} on ${path}`).toBeLessThan(500);

  await page.waitForTimeout(700);

  const bodyText = await page.locator('body').innerText().catch(() => '');
  expect(errorText(bodyText), `Application error text on ${path}`).toBeFalsy();

  expect(guards.pageErrors, `Page errors on ${path}: ${guards.pageErrors.join(' | ')}`).toEqual([]);

  const meaningfulConsoleErrors = guards.consoleErrors.filter(
    (message) =>
      !message.includes('favicon') &&
      !message.includes('ResizeObserver loop') &&
      !message.toLowerCase().includes('punycode'),
  );
  expect(meaningfulConsoleErrors, `Console errors on ${path}`).toEqual([]);

  expect(guards.failedRequests, `Failed requests on ${path}`).toEqual([]);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  expect(overflow, `Horizontal overflow on ${path}`).toBeFalsy();
}

test.describe('production site audit - all static routes', () => {
  test('all registered static routes load without 5xx/runtime errors in mobile Chromium', async ({ page }) => {
    test.setTimeout(180_000);
    const routes = routePathsFromRouter();
    expect(routes.length).toBeGreaterThan(20);

    const guards = await attachRuntimeGuards(page);
    for (const path of routes) {
      guards.consoleErrors.length = 0;
      guards.pageErrors.length = 0;
      guards.failedRequests.length = 0;
      await openAndAudit(page, path, guards);
    }
  });

  test('all registered static routes load without 5xx/runtime errors in mobile WebKit', async ({ page }) => {
    test.setTimeout(180_000);
    const routes = routePathsFromRouter();
    expect(routes.length).toBeGreaterThan(20);

    const guards = await attachRuntimeGuards(page);
    for (const path of routes) {
      guards.consoleErrors.length = 0;
      guards.pageErrors.length = 0;
      guards.failedRequests.length = 0;
      await openAndAudit(page, path, guards);
    }
  });
});

async function signIn(page: Page, role: RoleKey) {
  const { email, password } = roleCredentials[role];
  test.skip(!email || !password, `Missing ${role} E2E credentials`);

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('이메일').fill(email!);
  await page.getByPlaceholder('비밀번호').fill(password!);
  await page.getByRole('button', { name: /로그인/i }).click();

  await expect.poll(() => new URL(page.url()).pathname, { timeout: 20000 }).not.toBe('/login');
}

const roleRouteMatrix: Record<RoleKey, string[]> = {
  member: ['/dashboard', '/dashboard/attendance', '/profile', '/clubs', '/notices', '/schedule', '/search'],
  mission: ['/dashboard', '/dashboard/attendance', '/profile', '/missions', '/mission-board', '/mission-leaderboard', '/mission-wall'],
  teacher: ['/teacher-dashboard', '/teacher-dashboard/quiz-manage', '/teacher-dashboard/quote-manage', '/settings/attendance-location'],
  chief: ['/dashboard', '/settings/absence-reasons', '/admin/roles', '/admin/approvals'],
  president: ['/dashboard', '/reports/weekly', '/reports/growth', '/reports/events', '/review'],
  assignedTeacher: ['/teacher-dashboard', '/teacher-dashboard/quiz-manage', '/teacher-dashboard/quote-manage', '/pds-planner', '/leadership-diary'],
};

test.describe('production role access audit', () => {
  for (const role of Object.keys(roleRouteMatrix) as RoleKey[]) {
    test(`${role} can open its core production pages without runtime errors`, async ({ page }) => {
      test.setTimeout(120_000);
      await signIn(page, role);
      const guards = await attachRuntimeGuards(page);

      for (const path of roleRouteMatrix[role]) {
        guards.consoleErrors.length = 0;
        guards.pageErrors.length = 0;
        guards.failedRequests.length = 0;
        await openAndAudit(page, path, guards);
      }
    });
  }
});

const criticalForms = [
  '/notices/write',
  '/schedule/write',
  '/reports/weekly/write',
  '/pds-planner',
  '/leadership-diary',
  '/meetings/write',
  '/visitations/write',
  '/ganghak-news/write',
];

test.describe('production critical form screens', () => {
  test('critical write/planning screens are reachable without a runtime error', async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, 'assignedTeacher');
    const guards = await attachRuntimeGuards(page);

    for (const path of criticalForms) {
      guards.consoleErrors.length = 0;
      guards.pageErrors.length = 0;
      guards.failedRequests.length = 0;
      await openAndAudit(page, path, guards);
    }
  });
});
