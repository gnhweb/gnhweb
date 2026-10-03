import { expect, test } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'https://gnhwebw.pages.dev';

async function signIn(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.locator('input[name="email"]').first().fill(email);
  await page.locator('input[name="password"]').first().fill(password);
  await page.locator('button[type="submit"]').first().click();
  await expect(page).not.toHaveURL(/\/login(?:$|[?#])/, { timeout: 30_000 });

  const skipPin = page.getByRole('button', { name: '나중에 하기', exact: true });
  if (await skipPin.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await skipPin.click();
  }
}

test.describe('production memory board CRUD', () => {
  test('teacher can upload and delete a memory photo through the real UI', async ({ page }) => {
    test.setTimeout(120_000);

    const email = process.env.E2E_TEACHER_EMAIL;
    const password = process.env.E2E_TEACHER_PASSWORD;
    test.skip(!email || !password, 'Memory CRUD E2E requires E2E_TEACHER_* credentials.');

    const title = `E2E 추억창 CRUD ${Date.now()}`;
    let uploaded = false;

    page.on('dialog', async dialog => {
      if (dialog.type() === 'confirm') await dialog.accept();
      else await dialog.dismiss();
    });

    try {
      await signIn(page, email!, password!);
      await page.goto(`${BASE_URL}/memory-board`, { waitUntil: 'domcontentloaded', timeout: 45_000 });

      const uploadButton = page.getByRole('button', { name: /사진 올리기/ });
      const skipPin = page.getByRole('button', { name: '나중에 하기', exact: true });

      await Promise.race([
        uploadButton.waitFor({ state: 'visible', timeout: 45_000 }),
        skipPin.waitFor({ state: 'visible', timeout: 45_000 }).then(() => skipPin.click()),
      ]);
      if (await skipPin.isVisible().catch(() => false)) {
        await skipPin.click().catch(() => {});
      }
      await expect(uploadButton).toBeVisible({ timeout: 30_000 });
      await uploadButton.click();

      await page.getByPlaceholder('제목', { exact: true }).fill(title);
      await page.locator('input[type="file"]').setInputFiles({
        name: 'e2e-memory.svg',
        mimeType: 'image/svg+xml',
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#777"/></svg>'),
      });

      const insertResponsePromise = page.waitForResponse(
        response =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname.endsWith('/rest/v1/memory_photos') &&
          response.status() >= 200 &&
          response.status() < 300,
        { timeout: 45_000 },
      );

      await page.getByRole('button', { name: '올리기', exact: true }).click();
      const insertResponse = await insertResponsePromise;
      expect(insertResponse.ok()).toBeTruthy();

      uploaded = true;
      const uploadedPhoto = page.getByRole('img', { name: title, exact: true });
      await expect(uploadedPhoto).toBeVisible({ timeout: 30_000 });
      await uploadedPhoto.click();

      const storageDeletePromise = page.waitForResponse(
        response =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname.endsWith('/v1/storage/public'),
        { timeout: 45_000 },
      );
      const dbDeletePromise = page.waitForResponse(
        response =>
          response.request().method() === 'DELETE' &&
          new URL(response.url()).pathname.endsWith('/rest/v1/memory_photos'),
        { timeout: 45_000 },
      );

      await page.getByRole('button', { name: '삭제', exact: true }).click();
      const [storageDeleteResponse, dbDeleteResponse] = await Promise.all([storageDeletePromise, dbDeletePromise]);
      if (!storageDeleteResponse.ok()) {
        throw new Error(`R2 삭제 실패 HTTP ${storageDeleteResponse.status()}: ${await storageDeleteResponse.text()}`);
      }
      if (!dbDeleteResponse.ok()) {
        throw new Error(`memory_photos 삭제 실패 HTTP ${dbDeleteResponse.status()}: ${await dbDeleteResponse.text()}`);
      }

      await expect(page.getByRole('img', { name: title, exact: true })).toHaveCount(0);
      uploaded = false;
    } finally {
      if (uploaded) {
        const card = page.getByRole('img', { name: title, exact: true }).first();
        if (await card.isVisible().catch(() => false)) {
          await card.click().catch(() => {});
          await page.getByRole('button', { name: '삭제', exact: true }).click().catch(() => {});
          await page.waitForTimeout(1_000);
        }
      }
    }
  });
});
