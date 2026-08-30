import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

const BASE_URL = process.env.E2E_BASE_URL || 'https://gnhweb.vercel.app';
const BASE_ORIGIN = new URL(BASE_URL).origin;
type RoleKey = 'member' | 'mission' | 'teacher' | 'chief' | 'president' | 'assignedTeacher';
const credentials: Record<RoleKey, { email?: string; password?: string }> = {
  member: { email: process.env.E2E_MEMBER_EMAIL, password: process.env.E2E_MEMBER_PASSWORD }, mission: { email: process.env.E2E_MISSION_EMAIL, password: process.env.E2E_MISSION_PASSWORD }, teacher: { email: process.env.E2E_TEACHER_EMAIL, password: process.env.E2E_TEACHER_PASSWORD }, chief: { email: process.env.E2E_CHIEF_EMAIL, password: process.env.E2E_CHIEF_PASSWORD }, president: { email: process.env.E2E_PRESIDENT_EMAIL, password: process.env.E2E_PRESIDENT_PASSWORD }, assignedTeacher: { email: process.env.E2E_ASSIGNED_TEACHER_EMAIL, password: process.env.E2E_ASSIGNED_TEACHER_PASSWORD },
};
const SKIP_ROUTES = [/\/write$/, /\/edit$/, /\/reset-password$/];
const ERROR_MARKERS = ['application error', 'internal server error', 'chunkloaderror', 'failed to fetch dynamically imported module', 'uncaught error'];
const NOT_FOUND_MARKERS = ['페이지를 찾을 수 없습니다', 'page not found'];
const GUARD_REDIRECTS = new Set(['/login', '/unauthorized', '/forbidden']);

function routesFromRouter() {
  const source = fs.readFileSync('src/router/config.tsx', 'utf8');
  return [...new Set([...source.matchAll(/path:\s*["'](\/[^"']*)["']/g)].map(m => m[1]).filter(p => !p.includes(':') && !p.includes('*')).sort())];
}
async function guards(page: Page) {
  const consoleErrors: string[] = [], pageErrors: string[] = [], failedRequests: string[] = [];
  page.on('console', m => { if (m.type() === 'error' && !/favicon|ResizeObserver|ERR_BLOCKED_BY_CLIENT/i.test(m.text())) consoleErrors.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('requestfailed', r => { try { const u = new URL(r.url()); if (u.origin === BASE_ORIGIN && !u.pathname.endsWith('/favicon.ico')) failedRequests.push(`${r.url()} :: ${r.failure()?.errorText || 'unknown'}`); } catch {} });
  return { consoleErrors, pageErrors, failedRequests };
}
async function assertPage(page: Page, path: string, g: Awaited<ReturnType<typeof guards>>, allowGuard = true) {
  g.consoleErrors.length = 0; g.pageErrors.length = 0; g.failedRequests.length = 0;
  const response = await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  expect(response, `No response for ${path}`).not.toBeNull(); expect(response!.status(), `HTTP ${response!.status()} on ${path}`).toBeLessThan(500); await page.waitForTimeout(500);
  const body = (await page.locator('body').innerText().catch(() => '')).toLowerCase();
  for (const marker of ERROR_MARKERS) expect(body, `${marker} on ${path}`).not.toContain(marker);
  const actual = new URL(page.url()).pathname; expect(actual === path || (allowGuard && GUARD_REDIRECTS.has(actual)), `Unexpected redirect: ${path} -> ${actual}`).toBeTruthy();
  for (const marker of NOT_FOUND_MARKERS) expect(body, `NotFound on ${path}`).not.toContain(marker);
  expect(g.consoleErrors, `Console errors on ${path}`).toEqual([]); expect(g.pageErrors, `Page errors on ${path}`).toEqual([]); expect(g.failedRequests, `Failed same-origin requests on ${path}`).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2), `Horizontal overflow on ${path}`).toBeTruthy();
}
async function signIn(page: Page, role: RoleKey) {
  const { email, password } = credentials[role]; test.skip(!email || !password, `Missing ${role} E2E credentials`);
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  const loginForm = page.locator('form').filter({ has: page.locator('input[name="email"]') }).first();
  await loginForm.locator('input[name="email"]').fill(email!);
  await loginForm.locator('input[name="password"]').fill(password!);
  await loginForm.locator('button[type="submit"]').click();

  // The current login flow may require a first-time PIN setup modal before it
  // navigates away from /login. Dismiss the optional prompt first; otherwise
  // waiting for the URL to change deadlocks the E2E test for 60 seconds.
  const skipPin = page.getByRole('button', { name: '나중에 하기' });
  await skipPin.click({ timeout: 10_000 }).catch(() => {});
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 60_000 }).not.toBe('/login');
}
const coreRoutes = ['/', '/search', '/clubs', '/notices', '/schedule', '/dashboard', '/profile'];

test.describe('production public audit', () => {
  test('linked public routes', async ({ page }) => { test.setTimeout(300_000); const g = await guards(page); const queue = ['/search','/clubs','/notices','/schedule','/tools','/games','/ganghak-news']; const visited = new Set<string>(); while (queue.length && visited.size < 80) { const path = queue.shift()!; if (visited.has(path) || SKIP_ROUTES.some(r=>r.test(path))) continue; visited.add(path); await assertPage(page,path,g,true); const links = await page.locator('a[href]').evaluateAll(es=>es.map(e=>(e as HTMLAnchorElement).href)); for (const href of links) { try { const u=new URL(href); if(u.origin===BASE_ORIGIN&&!visited.has(u.pathname)&&!SKIP_ROUTES.some(r=>r.test(u.pathname))) queue.push(u.pathname); } catch {} } } expect(visited.size).toBeGreaterThan(5); });
  test('all registered static routes respond', async ({ page }) => { test.setTimeout(360_000); const g=await guards(page); for(const path of routesFromRouter()){ if(SKIP_ROUTES.some(r=>r.test(path))) continue; await assertPage(page,path,g,true); } });
});

test.describe('production authenticated audit', () => {
  test('member loads every registered non-write route', async ({ page }) => { test.setTimeout(600_000); await signIn(page,'member'); const g=await guards(page); for(const path of routesFromRouter()){ if(SKIP_ROUTES.some(r=>r.test(path))) continue; await assertPage(page,path,g,true); } });
  for(const role of Object.keys(credentials) as RoleKey[]) test(`${role} loads core and role routes`, async ({ page }) => { test.setTimeout(300_000); await signIn(page,role); const g=await guards(page); for(const path of coreRoutes) await assertPage(page,path,g,true); if(role==='teacher'||role==='assignedTeacher') for(const path of ['/teacher-dashboard','/teacher-dashboard/quiz-manage','/teacher-dashboard/quote-manage']) await assertPage(page,path,g,true); if(role==='chief') await assertPage(page,'/settings/absence-reasons',g,true); });
});

test.describe('critical mobile controls', () => {
  for(const role of Object.keys(credentials) as RoleKey[]) test(`${role} has usable controls`, async ({ page }) => { test.setTimeout(180_000); await signIn(page,role); const g=await guards(page); await assertPage(page,'/search',g,true); const buttons=page.getByRole('button'); for(let i=0,n=Math.min(await buttons.count(),20);i<n;i++){const box=await buttons.nth(i).boundingBox().catch(()=>null); if(!box||box.width<1||box.height<1) continue; expect(box.width,`Small button width on ${role}`).toBeGreaterThanOrEqual(40); expect(box.height,`Small button height on ${role}`).toBeGreaterThanOrEqual(40);} });
});
