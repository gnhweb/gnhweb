import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'https://gnhwebw.pages.dev';

type AttendanceRow = {
  id: string;
  status: string;
  user_id: string;
  late_reason?: string | null;
};

type UserRoleRow = {
  user_id: string;
  name: string;
  club: string | null;
  role: string;
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

  await page.goto(`${BASE_URL}/dashboard/attendance`, {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });

  const lateButton = page.getByRole('button', { name: '늦참으로 출석', exact: true });
  if (!(await lateButton.isVisible().catch(() => false))) {
    throw new Error(
      `늦참 버튼이 표시되지 않습니다. url=${page.url()} body=${(await page.locator('body').innerText().catch(() => '')).slice(0, 3000)}`,
    );
  }

  const attendanceResponse = await attendanceResponsePromise;
  const attendanceRows = (await attendanceResponse.json()) as AttendanceRow[];

  for (const existing of attendanceRows) {
    await deleteAttendanceRow(page, attendanceRequestUrl, attendanceAuthorization, existing.id);
  }

  const cleanupCheck = await page.request.get(attendanceResponse.url(), {
    headers: { authorization: attendanceAuthorization },
  });
  expect(cleanupCheck.ok()).toBeTruthy();
  const remainingRows = (await cleanupCheck.json()) as AttendanceRow[];
  expect(remainingRows).toHaveLength(0);

  const locationsEndpoint = new URL(attendanceRequestUrl);
  locationsEndpoint.pathname = locationsEndpoint.pathname.replace(/\/attendance$/, '/attendance_locations');
  locationsEndpoint.search = '?select=latitude,longitude&is_active=eq.true';
  const locationsResponse = await page.request.get(locationsEndpoint.toString(), {
    headers: { authorization: attendanceAuthorization },
  });
  expect(locationsResponse.ok()).toBeTruthy();
  const locationData = (await locationsResponse.json()) as Array<{ latitude: number; longitude: number }>;

  if (locationData.length > 0) {
    await context.setGeolocation({
      latitude: locationData[0].latitude,
      longitude: locationData[0].longitude,
    });
    await context.grantPermissions(['geolocation'], { origin: BASE_URL });
  }

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('불러오는 중...', { exact: true })).toHaveCount(0, {
    timeout: 30_000,
  });

  return { attendanceRequestUrl, attendanceAuthorization };
}

async function getStudentIdentity(
  page: Page,
  attendanceRequestUrl: string,
  authorization: string,
) {
  const attendanceEndpoint = new URL(attendanceRequestUrl);
  const userId = attendanceEndpoint.searchParams.get('user_id')?.replace(/^eq\./, '');
  expect(userId).toBeTruthy();

  const rolesEndpoint = new URL(attendanceRequestUrl);
  rolesEndpoint.pathname = rolesEndpoint.pathname.replace(/\/attendance$/, '/user_roles');
  rolesEndpoint.search = `?select=user_id,name,club,role&user_id=eq.${encodeURIComponent(userId!)}&limit=1`;
  const response = await page.request.get(rolesEndpoint.toString(), {
    headers: { authorization },
  });
  expect(response.ok()).toBeTruthy();
  const rows = (await response.json()) as UserRoleRow[];
  expect(rows).toHaveLength(1);

  return rows[0];
}

test.describe('production attendance authenticated flow', () => {
  test('mission leader can complete the full attendance lifecycle and staff can verify classification', async ({ browser }) => {
    test.setTimeout(240_000);

    const studentEmail = process.env.E2E_MISSION_EMAIL;
    const studentPassword = process.env.E2E_MISSION_PASSWORD;
    const reviewerEmail = process.env.E2E_TEACHER_EMAIL;
    const reviewerPassword = process.env.E2E_TEACHER_PASSWORD;

    test.skip(
      !studentEmail || !studentPassword || !reviewerEmail || !reviewerPassword,
      'Attendance E2E requires E2E_MISSION_* and E2E_TEACHER_* credentials.',
    );

    const studentContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const reviewerContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const studentPage = await studentContext.newPage();
    const reviewerPage = await reviewerContext.newPage();

    let attendanceRequestUrl = '';
    let attendanceAuthorization = '';
    const createdIds: string[] = [];

    const cleanup = async () => {
      if (!attendanceRequestUrl || !attendanceAuthorization) return;
      const response = await studentPage.request.get(attendanceRequestUrl, {
        headers: { authorization: attendanceAuthorization },
      });
      if (!response.ok()) return;
      const rows = (await response.json()) as AttendanceRow[];
      for (const row of rows) {
        await deleteAttendanceRow(studentPage, attendanceRequestUrl, attendanceAuthorization, row.id).catch(() => {});
      }
    };

    try {
      await signIn(studentPage, studentEmail!, studentPassword!);
      ({ attendanceRequestUrl, attendanceAuthorization } = await prepareStudentAttendance(studentPage, studentContext));

      const identity = await getStudentIdentity(studentPage, attendanceRequestUrl, attendanceAuthorization);
      expect(identity.role).not.toBe('teacher');
      expect(identity.role).not.toBe('chief');
      expect(identity.club).toBeTruthy();

      const welcomeHeading = studentPage.getByRole('heading', { name: /님, 환영합니다!$/ }).first();
      await expect(welcomeHeading).toBeVisible({ timeout: 30_000 });
      const studentName = (await welcomeHeading.innerText()).replace(/님, 환영합니다!$/, '').trim();
      expect(studentName).toBeTruthy();

      // 1. 정시 출석: 실제 스마트 출석 버튼을 눌러 DB에 attended가 기록되는지 확인.
      const checkInResponsePromise = studentPage.waitForResponse(
        response =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname.endsWith('/attendance') &&
          response.status() >= 200 &&
          response.status() < 300,
        { timeout: 30_000 },
      );
      await studentPage.getByRole('button', { name: /오늘 출석/ }).click();
      await expect(studentPage.getByText('출석 완료!', { exact: true })).toBeVisible({ timeout: 30_000 });
      const checkInRows = (await (await checkInResponsePromise).json()) as AttendanceRow[];
      expect(checkInRows[0]?.status).toBe('attended');
      if (checkInRows[0]?.id) createdIds.push(checkInRows[0].id);

      // 정시 출석을 취소하면 다시 출석 가능한 상태가 되는지도 확인.
      await studentPage.getByRole('button', { name: '출석 취소하기', exact: true }).click();
      await studentPage.getByRole('button', { name: '네, 취소할게요', exact: true }).click();
      await expect(studentPage.getByRole('button', { name: /오늘 출석/ })).toBeVisible({ timeout: 30_000 });

      // 2. 늦참: 새로고침 후 늦참 UI에서 사유를 입력하고 실제 late 레코드를 만든다.
      await studentPage.reload({ waitUntil: 'domcontentloaded' });
      await expect(studentPage.getByRole('button', { name: '늦참 사유 입력', exact: true })).toBeVisible({ timeout: 30_000 });
      await studentPage.getByRole('button', { name: '늦참 사유 입력', exact: true }).click();

      const lateReason = `E2E 출석 늦참 검증 ${Date.now()}`;
      await studentPage.locator('#late-attendance-reason').fill(lateReason);

      const lateInsertPromise = studentPage.waitForResponse(
        response =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname.endsWith('/attendance') &&
          response.status() >= 200 &&
          response.status() < 300,
        { timeout: 30_000 },
      );
      await studentPage.getByRole('button', { name: '늦참으로 출석', exact: true }).click();
      await expect(studentPage.getByText('늦참 출석과 사유가 기록되었습니다.', { exact: true })).toBeVisible({ timeout: 30_000 });
      const lateRows = (await (await lateInsertPromise).json()) as AttendanceRow[];
      expect(lateRows[0]?.status).toBe('late');
      expect(lateRows[0]?.late_reason).toBe(lateReason);
      if (lateRows[0]?.id) createdIds.push(lateRows[0].id);

      // 늦참을 제거하고 다시 불참 흐름을 실제 UI에서 검증한다.
      await cleanup();
      await studentPage.reload({ waitUntil: 'domcontentloaded' });

      // 3. 불참: 실제 사유 입력 모달과 저장 결과를 확인한다.
      await studentPage.getByRole('button', { name: /오늘은 참석이 어려워요/ }).click();
      const absenceReason = `E2E 출석 불참 검증 ${Date.now()}`;
      await studentPage.locator('textarea').last().fill(absenceReason);

      const absentInsertPromise = studentPage.waitForResponse(
        response =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname.endsWith('/attendance') &&
          response.status() >= 200 &&
          response.status() < 300,
        { timeout: 30_000 },
      );
      await studentPage.getByRole('button', { name: '불참 신고하기', exact: true }).click();
      await expect(studentPage.getByText('불참 신고 완료!', { exact: true })).toBeVisible({ timeout: 30_000 });
      const absentRows = (await (await absentInsertPromise).json()) as AttendanceRow[];
      expect(absentRows[0]?.status).toBe('absent');
      if (absentRows[0]?.id) createdIds.push(absentRows[0].id);

      // 4. 불참도 삭제하면 미응답으로 복귀하는지 확인한다.
      await cleanup();

      await signIn(reviewerPage, reviewerEmail!, reviewerPassword!);
      await reviewerPage.goto(`${BASE_URL}/attendance-board`, {
        waitUntil: 'domcontentloaded',
        timeout: 45_000,
      });

      await expect(reviewerPage.getByRole('heading', { name: '실시간 출석 현황판', exact: true })).toBeVisible({ timeout: 30_000 });

      for (const label of ['출석 완료', '늦참', '불참', '미응답']) {
        await expect(reviewerPage.getByText(label, { exact: true }).first()).toBeVisible();
      }

      // 학생이 출석 기록을 만들지 않은 상태에서는 미응답으로 계산되어야 한다.
      const unresponsiveSection = reviewerPage
        .locator('div.bg-background-100.border.border-background-200.rounded-2xl.p-5')
        .filter({ hasText: /미응답 \(/ })
        .first();
      await expect(unresponsiveSection).toContainText(studentName, { timeout: 30_000 });

      // 5. 실제 늦참 레코드를 하나 다시 만들고 현황판에서 늦참으로만 분류되는지 확인한다.
      await signIn(studentPage, studentEmail!, studentPassword!);
      await studentPage.reload({ waitUntil: 'domcontentloaded' });
      await studentPage.getByRole('button', { name: '늦참 사유 입력', exact: true }).click();
      const finalLateReason = `E2E 최종 늦참 사유 ${Date.now()}`;
      await studentPage.locator('#late-attendance-reason').fill(finalLateReason);
      const finalLateResponsePromise = studentPage.waitForResponse(
        response =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname.endsWith('/attendance') &&
          response.status() >= 200 &&
          response.status() < 300,
        { timeout: 30_000 },
      );
      await studentPage.getByRole('button', { name: '늦참으로 출석', exact: true }).click();
      const finalLateRows = (await (await finalLateResponsePromise).json()) as AttendanceRow[];
      expect(finalLateRows[0]?.status).toBe('late');
      if (finalLateRows[0]?.id) createdIds.push(finalLateRows[0].id);

      await reviewerPage.reload({ waitUntil: 'domcontentloaded' });
      await expect(reviewerPage.getByText(finalLateReason, { exact: true })).toBeVisible({ timeout: 30_000 });

      const lateSection = reviewerPage
        .locator('div.bg-background-100.border.border-background-200.rounded-2xl.p-5')
        .filter({ hasText: /늦참 \(/ })
        .first();
      await expect(lateSection).toContainText(studentName);
      await expect(lateSection).toContainText(finalLateReason);

      await expect(unresponsiveSection).not.toContainText(studentName);

      // 6. 동아리 탭 전환 + 10명 펼치기/접기 상태 초기화를 확인한다.
      const clubLabel = identity.club === 'saeullim'
        ? '새울림'
        : identity.club === 'cheonjipoong'
          ? '천지풍'
          : identity.club === 'cheonjihu'
            ? '천지후'
            : '문화부';

      await reviewerPage.getByRole('tab', { name: new RegExp(clubLabel) }).click();
      await expect(reviewerPage.getByText(`${clubLabel} 출석 현황`, { exact: true })).toBeVisible();

      const expandableSection = reviewerPage
        .locator('div.bg-background-50.rounded-2xl.p-4')
        .filter({ has: reviewerPage.getByRole('button', { name: '더보기', exact: true }) })
        .first();

      if (await expandableSection.count() > 0) {
        await expandableSection.getByRole('button', { name: '더보기', exact: true }).click();
        await expect(expandableSection.getByRole('button', { name: '접기', exact: true })).toBeVisible();
        await reviewerPage.getByRole('tab', { name: '전체' }).click();
        await reviewerPage.getByRole('tab', { name: new RegExp(clubLabel) }).click();
        await expect(expandableSection.getByRole('button', { name: '더보기', exact: true })).toBeVisible();
      }

      await reviewerPage.getByRole('tab', { name: '전체' }).click();
      await expect(reviewerPage.getByText('전체 학생 출석 현황', { exact: true })).toBeVisible();
    } finally {
      await cleanup();
      await reviewerContext.close();
      await studentContext.close();
    }
  });
});
