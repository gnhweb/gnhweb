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
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.locator('input[name="email"]').first().fill(email);
    await page.locator('input[name="password"]').first().fill(password);

    const authResponsePromise = page.waitForResponse(
      response => {
        const pathname = new URL(response.url()).pathname;
        return response.request().method() === 'POST'
          && (pathname.endsWith('/auth/sign-in/email') || pathname.endsWith('/sign-in/email'));
      },
      { timeout: 20_000 },
    ).catch(() => null);

    await page.locator('button[type="submit"]').first().click();
    const authResponse = await authResponsePromise;

    if (authResponse?.status() === 429) {
      const retryAfter = Number.parseInt(authResponse.headers()['x-retry-after'] || '10', 10);
      await page.waitForTimeout(Math.max(1, Number.isFinite(retryAfter) ? retryAfter : 10) * 1000 + 1_000);
      continue;
    }

    if (authResponse?.ok()) {
      const tokenResponse = await page.request.get(`${BASE_URL}/auth/token`, {
        failOnStatusCode: false,
      });
      if (tokenResponse.ok()) {
        const tokenPayload = (await tokenResponse.json()) as {
          token?: string;
          access_token?: string;
          session?: { access_token?: string };
          data?: { token?: string; access_token?: string };
        };
        const jwt = tokenPayload.token
          ?? tokenPayload.access_token
          ?? tokenPayload.session?.access_token
          ?? tokenPayload.data?.token
          ?? tokenPayload.data?.access_token;
        if (jwt) {
          await page.context().setExtraHTTPHeaders({ Authorization: `Bearer ${jwt}` });
        }
      }
    }

    try {
      await expect(page).not.toHaveURL(/\/login(?:$|[?#])/, { timeout: 20_000 });
      const dismissQuickPassword = page.getByRole('button', { name: '나중에 하기', exact: true });
      if (await dismissQuickPassword.isVisible().catch(() => false)) {
        await dismissQuickPassword.click();
        await expect(dismissQuickPassword).toBeHidden({ timeout: 5_000 }).catch(() => {});
      }
      return;
    } catch (error) {
      if (attempt === 2) {
        const status = authResponse?.status() ?? 'unknown';
        const body = await authResponse?.text().catch(() => '') || '';
        throw new Error(`Production sign-in failed: HTTP ${status}; response=${body.slice(0, 500)}`, { cause: error });
      }
      await page.context().clearCookies();
      await page.waitForTimeout(12_000);
    }
  }
}


async function cancelExistingAttendance(page: Page, attendanceRequestUrl?: string, authorization?: string) {
  await page.goto(`${BASE_URL}/dashboard/attendance`, {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });

  // LateAttendance가 출석 레코드를 비동기로 읽기 때문에 domcontentloaded 직후
  // 버튼을 검사하면 아직 '사유 입력' 상태로 잘못 판단할 수 있다.
  const attendanceStateButton = page.getByRole('button', {
    name: /출석 취소하기|늦참 기록 취소|늦참 사유 입력/,
  }).first();
  await expect(attendanceStateButton).toBeVisible({ timeout: 30_000 });

  const buttonText = await attendanceStateButton.innerText();
  if (buttonText === '출석 취소하기') {
    await attendanceStateButton.click();
    await page.getByRole('button', { name: '네, 취소할게요', exact: true }).click();
    await expect(page.getByRole('button', { name: /오늘 출석/ })).toBeVisible({ timeout: 30_000 });
    return;
  }

  if (buttonText === '늦참 기록 취소') {
    await attendanceStateButton.click();
    await page.getByRole('button', { name: '네, 취소할게요', exact: true }).click();
    await expect(page.getByRole('button', { name: '늦참 사유 입력', exact: true })).toBeVisible({ timeout: 30_000 });
    return;
  }

  if (attendanceRequestUrl && authorization) {
    // Production API에서는 attendance 삭제를 user_id/date 복합 필터로 직접 요청하지 않고
    // 실제 레코드 id를 기준으로 삭제한다. 앱의 실제 삭제 방식과 동일하게 정리한다.
    const endpoint = new URL(attendanceRequestUrl);
    const getResponse = await page.request.get(endpoint.toString(), { headers: { authorization } });
    expect(getResponse.ok()).toBeTruthy();
    const rows = (await getResponse.json()) as AttendanceRow[];

    for (const row of rows) {
      const deleteEndpoint = new URL(attendanceRequestUrl);
      deleteEndpoint.search = `?id=eq.${encodeURIComponent(row.id)}`;
      const deleteResponse = await page.request.delete(deleteEndpoint.toString(), {
        headers: { authorization, prefer: 'return=representation' },
      });
      expect(deleteResponse.ok()).toBeTruthy();
    }

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /오늘 출석/ })).toBeVisible({ timeout: 30_000 });
    return;
  }

  await expect(page.getByRole('button', { name: '늦참 사유 입력', exact: true })).toBeVisible({ timeout: 30_000 });
}

async function forceClearStudentAttendance(page: Page, attendanceRequestUrl: string, authorization: string) {
  const endpoint = new URL(attendanceRequestUrl);
  const response = await page.request.get(endpoint.toString(), { headers: { authorization } });
  expect(response.ok()).toBeTruthy();
  const rows = (await response.json()) as AttendanceRow[];

  for (const row of rows) {
    const deleteEndpoint = new URL(attendanceRequestUrl);
    deleteEndpoint.search = `?id=eq.${encodeURIComponent(row.id)}`;
    const deleteResponse = await page.request.delete(deleteEndpoint.toString(), {
      headers: { authorization, prefer: 'return=representation' },
    });
    expect(deleteResponse.ok()).toBeTruthy();
  }

  const verifyResponse = await page.request.get(endpoint.toString(), { headers: { authorization } });
  expect(verifyResponse.ok()).toBeTruthy();
  const remainingRows = (await verifyResponse.json()) as AttendanceRow[];
  expect(remainingRows).toHaveLength(0);
}

async function cleanupStudentAttendance(page: Page, attendanceRequestUrl: string, authorization: string) {
  const endpoint = new URL(attendanceRequestUrl);
  const response = await page.request.get(endpoint.toString(), { headers: { authorization } });
  expect(response.ok()).toBeTruthy();
  const rows = (await response.json()) as AttendanceRow[];

  if (rows.length === 0) return;

  // 먼저 실제 서비스의 취소 UI를 사용한다. UI가 실패해도 테스트 계정의
  // 오늘 레코드가 남아 다음 CI 실행을 오염시키지 않도록 API 상태를 최종 정리한다.
  await cancelExistingAttendance(page, attendanceRequestUrl, authorization).catch(() => {});

  const verifyResponse = await page.request.get(endpoint.toString(), { headers: { authorization } });
  expect(verifyResponse.ok()).toBeTruthy();
  const remainingRows = (await verifyResponse.json()) as AttendanceRow[];
  if (remainingRows.length > 0) {
    await forceClearStudentAttendance(page, attendanceRequestUrl, authorization);
  }
}
async function prepareStudentAttendance(page: Page, context: BrowserContext) {
  let attendanceRequestUrl = '';
  let attendanceAuthorization = '';

  const attendanceRequestHandler = (request: import('@playwright/test').Request) => {
    if (
      !attendanceRequestUrl &&
      request.method() === 'GET' &&
      new URL(request.url()).pathname.endsWith('/attendance') &&
      request.headers().authorization
    ) {
      attendanceRequestUrl = request.url();
      attendanceAuthorization = request.headers().authorization;
    }
  };
  page.on('request', attendanceRequestHandler);
  await page.goto(`${BASE_URL}/dashboard/attendance`, {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });

  // Neon Auth 세션이 복원된 직후 SmartAttendance가 프로필을 기다리는 동안
  // 페이지는 잠시 '불러오는 중...' 상태가 될 수 있다. API 요청을 즉시 검사하지
  // 않고 실제 출석 UI가 렌더링된 뒤 인증 요청을 확인한다.
  const attendanceAction = page.getByRole('button', {
    name: /오늘 출석|늦참 사유 입력|출석 취소하기|늦참 기록 취소/,
  }).first();
  await expect(attendanceAction).toBeVisible({ timeout: 45_000 });

  if (!attendanceRequestUrl || !attendanceAuthorization) {
    throw new Error(
      `출석 API 인증 요청을 감지하지 못했습니다. url=${page.url()} body=${(await page.locator('body').innerText().catch(() => '')).slice(0, 3000)}`,
    );
  }

  // 페이지에는 SmartAttendance/LateAttendance가 서로 다른 projection으로
  // attendance를 조회한다. 첫 인증 URL만 고정하고 이후 요청으로 덮어쓰지 않는다.
  page.off('request', attendanceRequestHandler);

  await cancelExistingAttendance(page, attendanceRequestUrl, attendanceAuthorization);

  const attendanceResponse = await page.request.get(attendanceRequestUrl, {
    headers: { authorization: attendanceAuthorization },
  });
  expect(attendanceResponse.ok()).toBeTruthy();
  const attendanceRows = (await attendanceResponse.json()) as AttendanceRow[];
  expect(attendanceRows).toHaveLength(0);

  await expect(page.getByRole('button', { name: '늦참으로 출석', exact: true })).toBeVisible({ timeout: 30_000 });

  // SmartAttendance의 초기 조회는 화면 상태에 필요한 컬럼만 요청한다.
  // 이후 상태 검증에서는 늦참 사유까지 포함한 전용 조회 URL을 사용한다.
  const attendanceStateEndpoint = new URL(attendanceRequestUrl);
  attendanceStateEndpoint.searchParams.set('select', 'id,status,user_id,late_reason,absence_reason');
  attendanceRequestUrl = attendanceStateEndpoint.toString();

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
  await expect(page.getByRole('button', { name: '늦참으로 출석', exact: true })).toBeVisible({ timeout: 30_000 });

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

    const cleanup = async () => {
      if (attendanceRequestUrl && attendanceAuthorization) {
        await cleanupStudentAttendance(studentPage, attendanceRequestUrl, attendanceAuthorization).catch(() => {});
      }
    };

    try {
      // 교사 세션은 학생 출석 흐름 도중 다시 로그인하지 않고 미리 확보한다.
      // Neon Auth 세션을 재발급하는 중간 로그인으로 인해 실제 출석 검증이
      // 인증 상태와 무관하게 실패하는 것을 방지한다.
      await signIn(reviewerPage, reviewerEmail!, reviewerPassword!);

      await signIn(studentPage, studentEmail!, studentPassword!);
      ({ attendanceRequestUrl, attendanceAuthorization } = await prepareStudentAttendance(studentPage, studentContext));

      const identity = await getStudentIdentity(studentPage, attendanceRequestUrl, attendanceAuthorization);
      expect(identity.user_id).toBeTruthy();
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
      const checkInResponse = await checkInResponsePromise;
      expect(checkInResponse.ok()).toBeTruthy();
      await expect(studentPage.getByText('출석 완료!', { exact: true })).toBeVisible({ timeout: 30_000 });
      const checkInState = await studentPage.request.get(attendanceRequestUrl, {
        headers: { authorization: attendanceAuthorization },
      });
      expect(checkInState.ok()).toBeTruthy();
      const checkInStateRows = (await checkInState.json()) as AttendanceRow[];
      expect(checkInStateRows[0]?.status).toBe('attended');
      const aiWelcomeConfirm = studentPage.getByRole('button', { name: '확인했어요!', exact: true });
      if (await aiWelcomeConfirm.isVisible().catch(() => false)) {
        await aiWelcomeConfirm.click();
        await expect(aiWelcomeConfirm).toBeHidden({ timeout: 5_000 }).catch(() => {});
      }

      // 정시 출석을 취소하면 다시 출석 가능한 상태가 되는지도 확인.
      const cancelButton = studentPage.locator('button').filter({ hasText: '출석 취소하기' }).first();
      await expect(cancelButton).toBeVisible({ timeout: 10_000 });
      await cancelButton.click();
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
      const lateInsertResponse = await lateInsertPromise;
      expect(lateInsertResponse.ok()).toBeTruthy();
      await expect(studentPage.getByText('오늘 출석 기록이 있습니다.', { exact: true })).toBeVisible({ timeout: 30_000 });
      const lateState = await studentPage.request.get(attendanceRequestUrl, {
        headers: { authorization: attendanceAuthorization },
      });
      expect(lateState.ok()).toBeTruthy();
      const lateStateRows = (await lateState.json()) as AttendanceRow[];
      expect(lateStateRows[0]?.status).toBe('late');

      // 늦참 사유는 최종적으로 교사 현황판에서 실제 표시되는지를 검증한다.
      // Data API의 직접 응답 projection과 화면 표시를 한 assertion으로 묶지 않는다.

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
      const absentInsertResponse = await absentInsertPromise;
      expect(absentInsertResponse.ok()).toBeTruthy();
      await expect(studentPage.getByText('불참 신고 완료!', { exact: true })).toBeVisible({ timeout: 30_000 });
      const absentState = await studentPage.request.get(attendanceRequestUrl, {
        headers: { authorization: attendanceAuthorization },
      });
      expect(absentState.ok()).toBeTruthy();
      const absentStateRows = (await absentState.json()) as AttendanceRow[];
      expect(absentStateRows[0]?.status).toBe('absent');

      // 4. 불참도 삭제하면 미응답으로 복귀하는지 확인한다.
      await cleanup();

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
      // 학생 세션은 이미 유지되고 있으므로 재로그인하지 않는다. Neon Auth의
      // 짧은 인증 제한을 불필요하게 건드리지 않고 동일 세션으로 출석 흐름을 이어간다.
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
      const finalLateResponse = await finalLateResponsePromise;
      expect(finalLateResponse.ok()).toBeTruthy();

      // Production attendance POST 응답은 성공해도 JSON body가 비어 있을 수 있다.
      // POST body를 직접 파싱하지 않고 동일한 인증 세션으로 현재 상태를 재조회한다.
      const finalLateState = await studentPage.request.get(attendanceRequestUrl, {
        headers: { authorization: attendanceAuthorization },
      });
      expect(finalLateState.ok()).toBeTruthy();
      const finalLateRows = (await finalLateState.json()) as AttendanceRow[];
      expect(finalLateRows).toHaveLength(1);
      expect(finalLateRows[0]?.status).toBe('late');

      // 학생 세션의 attendance projection은 late_reason을 반환하지 않을 수 있다.
      // 늦참 사유의 저장 여부는 실제 운영자 권한 세션의 전체 attendance 조회와
      // 현황판 UI 표시까지 이어서 검증한다.
      // 교사 현황판도 먼저 실제 attendance GET이 끝난 것을 확인한 뒤 화면을 검증한다.
      // 이렇게 하면 "API에는 있는데 UI가 아직 렌더링되지 않음"과 "교사 세션에서
      // late_reason 자체가 조회되지 않음"을 구분할 수 있다.
      const reviewerAttendanceResponsePromise = reviewerPage.waitForResponse(
        response =>
          response.request().method() === 'GET' &&
          new URL(response.url()).pathname.endsWith('/attendance') &&
          response.status() >= 200 &&
          response.status() < 300,
        { timeout: 30_000 },
      );
      await reviewerPage.reload({ waitUntil: 'domcontentloaded' });
      const reviewerAttendanceResponse = await reviewerAttendanceResponsePromise;
      expect(reviewerAttendanceResponse.ok()).toBeTruthy();
      const reviewerAttendanceRows = (await reviewerAttendanceResponse.json()) as AttendanceRow[];
      const reviewerLateRow = reviewerAttendanceRows.find(row => row.user_id === identity.user_id);
      expect(reviewerLateRow?.status).toBe('late');
      expect(reviewerLateRow?.late_reason).toBe(finalLateReason);

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
