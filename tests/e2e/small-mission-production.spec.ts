import { expect, test, type Page } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'https://gnhwebw.pages.dev';

async function signIn(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.locator('input[name="email"]').first().fill(email);
  await page.locator('input[name="password"]').first().fill(password);
  await page.locator('button[type="submit"]').first().click();
  await expect(page).not.toHaveURL(/\/login(?:$|[?#])/, { timeout: 30_000 });
}

async function dismissPin(page: Page, pageHeading?: string) {
  const skipPin = page.getByRole('button', { name: '나중에 하기', exact: true });
  if (!pageHeading) {
    if (await skipPin.isVisible({ timeout: 45_000 }).catch(() => false)) await skipPin.click();
    return;
  }

  const heading = page.getByRole('heading', { name: pageHeading, exact: true });
  const winner = await Promise.race([
    heading.waitFor({ state: 'visible', timeout: 45_000 }).then(() => 'page'),
    skipPin.waitFor({ state: 'visible', timeout: 45_000 }).then(() => 'pin'),
  ]).catch(() => null);

  if (winner === 'pin') {
    await skipPin.click();
    await heading.waitFor({ state: 'visible', timeout: 30_000 });
  }
}

async function submitProof(page: Page, note: string) {
  await page.goto(`${BASE_URL}/missions/board`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await expect(page.getByRole('heading', { name: '내 작은 사명', exact: true })).toBeVisible({ timeout: 30_000 });

  const submitButton = page.getByRole('button', { name: '인증 제출하기', exact: true }).first();
  await expect(submitButton).toBeVisible({ timeout: 15_000 });
  await submitButton.click();

  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'small-mission-proof.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]),
  });
  await page.locator('textarea').fill(note);
  await page.getByRole('button', { name: '인증 제출하기', exact: true }).last().click();
  await expect(page.getByText('인증이 제출되었습니다! 승인을 기다려주세요.')).toBeVisible({ timeout: 30_000 });
}

test.describe('production Small Mission authenticated flow', () => {
  test('student claim/submit/reject/reset flow works and student cannot review', async ({ browser }) => {
    test.setTimeout(180_000);

    const studentEmail = process.env.E2E_MISSION_EMAIL;
    const studentPassword = process.env.E2E_MISSION_PASSWORD;
    const reviewerEmail = process.env.E2E_TEACHER_EMAIL;
    const reviewerPassword = process.env.E2E_TEACHER_PASSWORD;

    test.skip(
      !studentEmail || !studentPassword || !reviewerEmail || !reviewerPassword,
      'Small Mission E2E requires E2E_MISSION_* and E2E_TEACHER_* credentials.',
    );

    const studentContext = await browser.newContext();
    const reviewerContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    const reviewerPage = await reviewerContext.newPage();

    try {
      await signIn(studentPage, studentEmail!, studentPassword!);
      const diagnostics: string[] = [];
      studentPage.on('console', message => { if (message.type() === 'error') diagnostics.push(`console: ${message.text()}`); });
      studentPage.on('pageerror', error => diagnostics.push(`pageerror: ${error.message}`));
      studentPage.on('requestfailed', request => diagnostics.push(`requestfailed: ${request.url()} :: ${request.failure()?.errorText || 'unknown'}`));
      await studentPage.goto(`${BASE_URL}/missions`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await dismissPin(studentPage, '작은 사명');
      try {
        await expect(studentPage.getByRole('heading', { name: '작은 사명', exact: true })).toBeVisible({ timeout: 30_000 });
      } catch (error) {
        throw new Error(`/missions did not render. url=${studentPage.url()} body=${(await studentPage.locator('body').innerText().catch(() => '')).slice(0, 1200)} diagnostics=${diagnostics.join(' | ')}`, { cause: error });
      }
      await expect(studentPage.getByRole('button', { name: /인증 검토/ })).toHaveCount(0);

      const claimButton = studentPage.getByRole('button', { name: '작은 사명 하기', exact: true }).first();
      let missionTitle: string;
      let needsReviewerReset = false;

      if (await claimButton.count()) {
        const missionCard = claimButton.locator('xpath=ancestor::div[contains(@class,"rounded-card")]').first();
        missionTitle = (await missionCard.locator('h2').innerText()).trim();
        await claimButton.click();
        await expect(missionCard.getByText('내 사명', { exact: true })).toBeVisible({ timeout: 30_000 });
      } else {
        // The E2E account may already have a mission from a previous run.
        // Reuse an existing assigned mission so the test is repeatable without
        // inserting or deleting production test data.
        await studentPage.goto(`${BASE_URL}/missions/board`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
        await expect(studentPage.getByRole('heading', { name: '내 작은 사명', exact: true })).toBeVisible({ timeout: 30_000 });
        const reusableCard = studentPage
          .locator('div.bg-background-100.border.rounded-card.p-4')
          .first();
        await expect(reusableCard).toBeVisible({ timeout: 15_000 });
        missionTitle = (await reusableCard.locator('h2').innerText()).trim();
        needsReviewerReset = true;
      }

      if (needsReviewerReset) {
        await signIn(reviewerPage, reviewerEmail!, reviewerPassword!);
        await reviewerPage.goto(`${BASE_URL}/missions`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
        await dismissPin(reviewerPage, '작은 사명');
        await reviewerPage.getByRole('button', { name: /인증 검토/ }).click();
        const resetCard = reviewerPage
          .locator('div.bg-background-100.border.rounded-card.p-4')
          .filter({ hasText: missionTitle })
          .filter({ has: reviewerPage.getByRole('button', { name: '인증 초기화', exact: true }) })
          .first();
        await expect(resetCard).toBeVisible({ timeout: 30_000 });
        await resetCard.getByRole('button', { name: '인증 초기화', exact: true }).click();
        await expect(resetCard.getByRole('button', { name: '인증 초기화', exact: true })).toHaveCount(0, { timeout: 30_000 });
        await studentPage.reload({ waitUntil: 'domcontentloaded' });
      }

      await submitProof(studentPage, `E2E Small Mission 검증 ${Date.now()}`);

      if (!needsReviewerReset) await signIn(reviewerPage, reviewerEmail!, reviewerPassword!);
      await reviewerPage.goto(`${BASE_URL}/missions`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await dismissPin(reviewerPage);
      await expect(reviewerPage.getByRole('heading', { name: '작은 사명', exact: true })).toBeVisible({ timeout: 30_000 });
      const reviewTab = reviewerPage.getByRole('button', { name: /인증 검토/ });
      await expect(reviewTab).toBeVisible({ timeout: 15_000 });
      await reviewTab.click();

      const submittedCard = reviewerPage.locator('div.bg-amber-50').filter({ hasText: missionTitle }).filter({ hasText: 'E2E Small Mission 검증' }).first();
      await expect(submittedCard).toBeVisible({ timeout: 30_000 });
      const rejectRequestPromise = reviewerPage.waitForRequest(
        request => request.method() === 'POST' && request.url().includes('/rpc/review_mission_assignment'),
        { timeout: 30_000 },
      );
      await submittedCard.getByRole('button', { name: '반려', exact: true }).click();
      const reasonInput = reviewerPage.getByPlaceholder('반려 사유를 입력하세요...');
      await reasonInput.fill('E2E 반려 검증');
      await reviewerPage.getByRole('button', { name: '반려 확정', exact: true }).click();
      const rejectRequest = await rejectRequestPromise;
      const rejectPayload = rejectRequest.postDataJSON() as { p_assignment_id?: number; p_action?: string };
      expect(rejectPayload.p_action).toBe('reject');
      expect(rejectPayload.p_assignment_id).toBeGreaterThan(0);
      await expect(submittedCard).toHaveCount(0);

      await studentPage.reload({ waitUntil: 'domcontentloaded' });
      await expect(studentPage.getByText('반려됨', { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(studentPage.getByText('반려 사유: E2E 반려 검증', { exact: true })).toBeVisible({ timeout: 15_000 });

      // A reviewer can reset a rejected proof back to the assigned state.
      // reset_mission_proof is intentionally exercised through the real RPC because
      // the current UI exposes its reset button only while an assignment is submitted.
      const resetRejectedResult = await reviewerPage.evaluate(
        async ({ url, assignmentId }) => {
          const resetUrl = url.replace('/review_mission_assignment', '/reset_mission_proof');
          const response = await fetch(resetUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ p_assignment_id: assignmentId }),
          });
          return { status: response.status, body: await response.text() };
        },
        { url: rejectRequest.url(), assignmentId: rejectPayload.p_assignment_id },
      );
      expect(resetRejectedResult.status).toBe(200);
      expect(JSON.parse(resetRejectedResult.body)).toMatchObject({ ok: true, status: 'assigned' });

      await studentPage.reload({ waitUntil: 'domcontentloaded' });
      await expect(studentPage.getByText('진행 중', { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(studentPage.getByRole('button', { name: '인증 제출하기', exact: true })).toBeVisible({ timeout: 15_000 });

      // Resubmit after reset and verify reviewer approval.
      await submitProof(studentPage, `E2E Small Mission 승인 검증 ${Date.now()}`);

      await reviewerPage.reload({ waitUntil: 'domcontentloaded' });
      await reviewerPage.getByRole('button', { name: /인증 검토/ }).click();
      const approvalCard = reviewerPage.locator('div.bg-amber-50').filter({ hasText: missionTitle }).filter({ hasText: 'E2E Small Mission 승인 검증' }).first();
      await expect(approvalCard).toBeVisible({ timeout: 30_000 });

      const approveRequestPromise = reviewerPage.waitForRequest(
        request => request.method() === 'POST' && request.url().includes('/rpc/review_mission_assignment'),
        { timeout: 30_000 },
      );
      await approvalCard.getByRole('button', { name: '승인', exact: true }).click();
      const approveRequest = await approveRequestPromise;
      const approvePayload = approveRequest.postDataJSON() as { p_assignment_id?: number; p_action?: string };
      expect(approvePayload.p_action).toBe('approve');
      expect(approvePayload.p_assignment_id).toBeGreaterThan(0);
      await expect(approvalCard).toHaveCount(0, { timeout: 30_000 });

      await studentPage.reload({ waitUntil: 'domcontentloaded' });
      await expect(studentPage.getByText('인증 완료', { exact: true })).toBeVisible({ timeout: 30_000 });

      // The reviewer-only reset RPC must also work after approval.
      const resetResult = await reviewerPage.evaluate(
        async ({ url, assignmentId }) => {
          const resetUrl = url.replace('/review_mission_assignment', '/reset_mission_proof');
          const response = await fetch(resetUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ p_assignment_id: assignmentId }),
          });
          return { status: response.status, body: await response.text() };
        },
        { url: approveRequest.url(), assignmentId: approvePayload.p_assignment_id },
      );
      expect(resetResult.status).toBe(200);
      expect(JSON.parse(resetResult.body)).toMatchObject({ ok: true, status: 'assigned' });

      // The same reviewer RPC must reject a normal member.
      const unauthorizedResult = await studentPage.evaluate(
        async ({ url, assignmentId }) => {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              p_assignment_id: assignmentId,
              p_action: 'approve',
              p_reject_reason: null,
            }),
          });
          return { status: response.status, body: await response.text() };
        },
        { url: approveRequest.url(), assignmentId: approvePayload.p_assignment_id },
      );
      expect(unauthorizedResult.status).toBeGreaterThanOrEqual(400);

      await studentPage.reload({ waitUntil: 'domcontentloaded' });
      await expect(studentPage.getByText('진행 중', { exact: true })).toBeVisible({ timeout: 30_000 });
    } finally {
      await reviewerContext.close();
      await studentContext.close();
    }
  });
});
