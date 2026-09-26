import { expect, test } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'https://gnhwebw.pages.dev';

async function signIn(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.locator('input[name="email"]').first().fill(email);
  await page.locator('input[name="password"]').first().fill(password);
  await page.locator('button[type="submit"]').first().click();

  const skipPin = page.getByRole('button', { name: '나중에 하기', exact: true });
  if (await skipPin.isVisible({ timeout: 15_000 }).catch(() => false)) {
    await skipPin.click();
  }
  await expect(page).not.toHaveURL(/\/login(?:$|[?#])/, { timeout: 30_000 });
}

async function submitProof(page: import('@playwright/test').Page, note: string) {
  await page.goto(`${BASE_URL}/missions/board`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await expect(page.getByRole('heading', { name: '내 작은 사명', exact: true })).toBeVisible({ timeout: 30_000 });

  const assignment = page.getByRole('button', { name: '인증 제출하기', exact: true }).first();
  await expect(assignment).toBeVisible({ timeout: 15_000 });
  await assignment.click();

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles({
    name: 'small-mission-proof.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0xff, 0xd9,
    ]),
  });
  await page.locator('textarea').fill(note);
  await page.getByRole('button', { name: '인증 제출하기', exact: true }).last().click();
  await expect(page.getByText('인증이 제출되었습니다! 승인을 기다려주세요.')).toBeVisible({ timeout: 30_000 });
}

test.describe('production Small Mission authenticated flow', () => {
  test('member claim, submit, reject and reset flow works', async ({ browser }) => {
    test.setTimeout(240_000);

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

      await studentPage.goto(`${BASE_URL}/missions`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await expect(studentPage.getByRole('heading', { name: '작은 사명', exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(studentPage.getByRole('button', { name: /인증 검토/ })).toHaveCount(0);

      const claimButton = studentPage.getByRole('button', { name: '작은 사명 하기', exact: true }).first();
      await expect(claimButton).toBeVisible({ timeout: 15_000 });
      const missionCard = claimButton.locator('xpath=ancestor::div[contains(@class,"rounded-card")]').first();
      const missionTitle = (await missionCard.locator('h2').innerText()).trim();
      await claimButton.click();

      await expect(missionCard.getByText('내 사명', { exact: true })).toBeVisible({ timeout: 30_000 });
      await submitProof(studentPage, `E2E Small Mission 승인 검증 ${Date.now()}`);

      await signIn(reviewerPage, reviewerEmail!, reviewerPassword!);
      await reviewerPage.goto(`${BASE_URL}/missions`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await expect(reviewerPage.getByRole('heading', { name: '작은 사명', exact: true })).toBeVisible({ timeout: 30_000 });
      await reviewerPage.getByRole('button', { name: /인증 검토/ }).click();

      const submittedCard = reviewerPage.locator('div.bg-amber-50').filter({ hasText: missionTitle }).filter({ hasText: 'E2E Small Mission 승인 검증' }).first();
      await expect(submittedCard).toBeVisible({ timeout: 30_000 });
      await submittedCard.getByRole('button', { name: '승인', exact: true }).click();
      await expect(submittedCard).toHaveCount(0);

      await reviewerPage.getByText('인증 완료', { exact: true }).last().waitFor({ state: 'visible', timeout: 15_000 });

      await reviewerPage.getByRole('button', { name: '인증 검토' }).click();
      await expect(reviewerPage.getByText('배정 내역이 없습니다')).not.toBeVisible();

      const completedRow = reviewerPage.locator('div').filter({ hasText: missionTitle }).filter({ hasText: '완료' }).last();
      await expect(completedRow).toBeVisible({ timeout: 15_000 });

      await completedRow.scrollIntoViewIfNeeded();
      const resetButton = reviewerPage.getByRole('button', { name: '인증 초기화', exact: true }).first();
      await expect(resetButton).toBeVisible({ timeout: 15_000 });
      await resetButton.click();
      await expect(completedRow).toHaveCount(0);

      await submitProof(studentPage, `E2E Small Mission 반려 검증 ${Date.now()}`);

      await reviewerPage.reload({ waitUntil: 'domcontentloaded' });
      await reviewerPage.getByRole('button', { name: /인증 검토/ }).click();
      const resubmittedCard = reviewerPage.locator('div.bg-amber-50').filter({ hasText: missionTitle }).filter({ hasText: 'E2E Small Mission 반려 검증' }).first();
      await expect(resubmittedCard).toBeVisible({ timeout: 30_000 });
      await resubmittedCard.getByRole('button', { name: '반려', exact: true }).click();
      const reasonInput = reviewerPage.getByPlaceholder('반려 사유를 입력하세요...');
      await expect(reasonInput).toBeVisible({ timeout: 10_000 });
      await reasonInput.fill('E2E 반려 검증');
      await reviewerPage.getByRole('button', { name: '반려 확정', exact: true }).click();
      await expect(resubmittedCard).toHaveCount(0);

      await studentPage.reload({ waitUntil: 'domcontentloaded' });
      await expect(studentPage.getByText('반려됨', { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(studentPage.getByText('반려 사유: E2E 반려 검증', { exact: true })).toBeVisible({ timeout: 15_000 });

      await reviewerPage.reload({ waitUntil: 'domcontentloaded' });
      await reviewerPage.getByRole('button', { name: /인증 검토/ }).click();
      const rejectedRow = reviewerPage.locator('div').filter({ hasText: missionTitle }).filter({ hasText: '반려' }).last();
      await expect(rejectedRow).toBeVisible({ timeout: 15_000 });
      const finalReset = reviewerPage.getByRole('button', { name: '인증 초기화', exact: true }).first();
      await finalReset.click();

      await studentPage.reload({ waitUntil: 'domcontentloaded' });
      await expect(studentPage.getByText('진행 중', { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(studentPage.getByRole('button', { name: '인증 제출하기', exact: true })).toBeVisible({ timeout: 15_000 });
    } finally {
      await reviewerContext.close();
      await studentContext.close();
    }
  });
});
