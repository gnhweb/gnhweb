import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'https://gnhwebw.pages.dev';

type AttendanceRow = {
  id: string;
  status: string;
  user_id: string;
  late_reason?: string | null;
};

async function signIn(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.locator('input[name="email"]').first().fill(email);
  await page.locator('input[name="password"]').first().fill(password);
  await page.locator('button[type="submit"]').first().click();
  await expect(page).not.toHaveURL(/\/login(?:$|[?#])/, { timeout: 30_000 });
}

async function getTableResponse(page: Page, table: string) {
  const responsePromise = page.waitForResponse(
    response =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname.endsWith(`/${table}`),
    { timeout: 30_000 },
  );
  return responsePromise;
}

async function deleteAttendanceRow(
  page: Page,
  requestUrl: string,
  authorization: string,
  id: string,
) {
  const endpoint = new URL(requestUrl);
  endpoint.search = `?id=eq.${encodeURIComponent(id)}`;
  const response = await page.request.delete(endpoint.toString(), {
    headers: {
      authorization,
      Prefer: 'return=minimal',
    },
  });
  expect(response.ok()).toBeTruthy();
}

async function prepareStudentAttendance(page: Page, context: BrowserContext) {
  let attendanceRequestUrl = '';
  let attendanceAuthorization = '';
  let locationData: Array<{ latitude: number; longitude: number }> = [];

  page.on('request', request => {
    if (
      request.method() === 'GET' &&
      new URL(request.url()).pathname.endsWith('/attendance') &&
      request.headers().authorization
    ) {
      attendanceRequestUrl = request.url();
      attendanceAuthorization = request.headers().authorization;
    }
  });

  const attendanceResponsePromise = getTableResponse(page, 'attendance');
  const locationResponsePromise = getTableResponse(page, 'attendance_locations');

  await page.goto(`${BASE_URL}/dashboard/attendance`, {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });

  const [attendanceResponse, locationResponse] = await Promise.all([
    attendanceResponsePromise,
    locationResponsePromise,
  ]);

  const attendanceRows = (await attendanceResponse.json()) as AttendanceRow[];
  locationData = (await locationResponse.json()) as Array<{ latitude: number; longitude: number }>;

  const existing = attendanceRows.find(row => row.user_id);
  if (existing) {
    await deleteAttendanceRow(page, attendanceRequestUrl, attendanceAuthorization, existing.id);
    await page.reload({ waitUntil: 'domcontentloaded' });
  }

  if (locationData.length > 0) {
    await context.setGeolocation({
      latitude: locationData[0].latitude,
      longitude: locationData[0].longitude,
    });
    await context.grantPermissions(['geolocation'], { origin: BASE_URL });
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
}

test.describe('production attendance authenticated flow', () => {
  test('mission leader can submit late attendance and staff can verify its classification', async ({ browser }) => {
    test.setTimeout(180_000);

    const studentEmail = process.env.E2E_MISSION_EMAIL;
    const studentPassword = process.env.E2E_MISSION_PASSWORD;
    const reviewerEmail = process.env.E2E_TEACHER_EMAIL;
    const reviewerPassword = process.env.E2E_TEACHER_PASSWORD;

    test.skip(
      !studentEmail || !studentPassword || !reviewerEmail || !reviewerPassword,
      'Attendance E2E requires E2E_MISSION_* and E2E_TEACHER_* credentials.',
    );

    const studentContext = await browser.newContext();
    const reviewerContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    const reviewerPage = await reviewerContext.newPage();

    let createdAttendanceId: string | null = null;
    let attendanceRequestUrl = '';
    let attendanceAuthorization = '';

    try {
      await signIn(studentPage, studentEmail!, studentPassword!);

      studentPage.on('request', request => {
        if (
          request.method() === 'GET' &&
          new URL(request.url()).pathname.endsWith('/attendance') &&
          request.headers().authorization
        ) {
          attendanceRequestUrl = request.url();
          attendanceAuthorization = request.headers().authorization;
        }
      });

      await prepareStudentAttendance(studentPage, studentContext);

      await expect(studentPage.getByRole('button', { name: '늦참으로 출석', exact: true })).toBeVisible({
        timeout: 30_000,
      });
      await studentPage.getByRole('button', { name: '늦참 사유 입력', exact: true }).click();

      const reason = `E2E 출석 늦참 검증 ${Date.now()}`;
      await studentPage.locator('textarea[placeholder*="교통 체증"]').fill(reason);

      const insertResponsePromise = studentPage.waitForResponse(
        response =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname.endsWith('/attendance') &&
          response.status() >= 200 &&
          response.status() < 300,
        { timeout: 30_000 },
      );

      await studentPage.getByRole('button', { name: '늦참으로 출석', exact: true }).click();
      await expect(studentPage.getByText('늦참 출석과 사유가 기록되었습니다.')).toBeVisible({
        timeout: 30_000,
      });

      const insertResponse = await insertResponsePromise;
      const insertedRows = (await insertResponse.json()) as AttendanceRow[];
      createdAttendanceId = insertedRows[0]?.id ?? null;
      expect(createdAttendanceId).toBeTruthy();

      await signIn(reviewerPage, reviewerEmail!, reviewerPassword!);
      await reviewerPage.goto(`${BASE_URL}/attendance-board`, {
        waitUntil: 'domcontentloaded',
        timeout: 45_000,
      });

      await expect(reviewerPage.getByRole('heading', { name: '실시간 출석 현황판', exact: true })).toBeVisible({
        timeout: 30_000,
      });

      for (const label of ['출석 완료', '늦참', '불참', '미응답']) {
        await expect(reviewerPage.getByText(label, { exact: true }).first()).toBeVisible();
      }

      await expect(reviewerPage.getByText(reason, { exact: true })).toBeVisible({ timeout: 30_000 });

      const lateSection = reviewerPage
        .locator('div.bg-background-100.border.border-background-200.rounded-2xl.p-5')
        .filter({ hasText: /늦참 \(/ })
        .first();
      await expect(lateSection).toContainText(reason);

      const unresponsiveSection = reviewerPage
        .locator('div.bg-background-100.border.border-background-200.rounded-2xl.p-5')
        .filter({ hasText: /미응답 \(/ })
        .first();
      await expect(unresponsiveSection).not.toContainText(reason);

      const moreButton = reviewerPage.getByRole('button', { name: '더보기', exact: true }).first();
      if (await moreButton.isVisible().catch(() => false)) {
        await moreButton.click();
        await expect(reviewerPage.getByRole('button', { name: '접기', exact: true }).first()).toBeVisible();
        await reviewerPage.getByRole('tab', { name: /새울림/ }).click();
        await reviewerPage.getByRole('tab', { name: '전체' }).click();
        await expect(reviewerPage.getByRole('button', { name: '더보기', exact: true }).first()).toBeVisible();
      }

      await reviewerPage.getByRole('tab', { name: /새울림/ }).click();
      await expect(reviewerPage.getByText('새울림 출석 현황', { exact: true })).toBeVisible();
      await reviewerPage.getByRole('tab', { name: /천지풍/ }).click();
      await expect(reviewerPage.getByText('천지풍 출석 현황', { exact: true })).toBeVisible();
      await reviewerPage.getByRole('tab', { name: '전체' }).click();
      await expect(reviewerPage.getByText('전체 학생 출석 현황', { exact: true })).toBeVisible();
    } finally {
      if (createdAttendanceId && attendanceRequestUrl && attendanceAuthorization) {
        await deleteAttendanceRow(studentPage, attendanceRequestUrl, attendanceAuthorization, createdAttendanceId).catch(() => {});
      }
      await reviewerContext.close();
      await studentContext.close();
    }
  });
});
