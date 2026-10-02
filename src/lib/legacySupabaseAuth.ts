type MigrationResponseBody = {
  status?: string;
  error?: string;
};

type MigrationResult = {
  migrated: boolean;
  alreadyMigrated: boolean;
  error?: string;
};

const migrationApiUrl = String(import.meta.env.VITE_CLOUDFLARE_API_URL || 'https://gnhweb-api.gemini19840314.workers.dev').trim();
const migrationEndpoint = `${migrationApiUrl.replace(/\/$/, '')}/account-password-migration`;

export async function migrateLegacyAccountPassword(email: string, password: string): Promise<MigrationResult> {
  try {
    const response = await fetch(migrationEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    let body: MigrationResponseBody = {};
    try {
      body = await response.json() as MigrationResponseBody;
    } catch {
      // handled below as a generic migration failure
    }

    if (!response.ok) {
      return {
        migrated: false,
        alreadyMigrated: false,
        error: body.error || '계정 복구에 실패했습니다.',
      };
    }

    return {
      migrated: body.status === 'migrated',
      alreadyMigrated: body.status === 'already_migrated',
    };
  } catch (error) {
    console.error('[LegacyAuth] migration request failed:', error);
    return { migrated: false, alreadyMigrated: false, error: '계정 복구 서버에 연결할 수 없습니다.' };
  }
}
