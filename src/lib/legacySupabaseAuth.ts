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
const migrationApiEndpoint = `${migrationApiUrl.replace(/\/$/, '')}/account-password-migration`;
const migrationEndpoints = typeof window !== 'undefined' && import.meta.env.PROD
  ? [`${window.location.origin}/account-password-migration`, migrationApiEndpoint]
  : [migrationApiEndpoint];

async function requestMigration(endpoint: string, email: string, password: string): Promise<Response> {
  return fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export async function migrateLegacyAccountPassword(email: string, password: string): Promise<MigrationResult> {
  let lastError: unknown;

  for (const endpoint of migrationEndpoints) {
    try {
      const response = await requestMigration(endpoint, email, password);

      let body: MigrationResponseBody = {};
      try {
        body = await response.json() as MigrationResponseBody;
      } catch {
        // handled below as a generic migration failure
      }

      if (response.ok) {
        return {
          migrated: body.status === 'migrated',
          alreadyMigrated: body.status === 'already_migrated',
          error: body.status ? undefined : '계정 복구에 실패했습니다.',
        };
      }

      // A same-origin proxy may be unavailable after a Pages deployment.
      // Fall through to the direct Worker endpoint before reporting failure.
      if (endpoint !== migrationApiEndpoint && (response.status === 404 || response.status >= 500)) {
        continue;
      }

      return {
        migrated: false,
        alreadyMigrated: false,
        error: body.error || '계정 복구에 실패했습니다.',
      };
    } catch (error) {
      lastError = error;
      console.error('[LegacyAuth] migration request failed:', endpoint, error);
    }
  }

  console.error('[LegacyAuth] all migration endpoints failed:', lastError);
  return { migrated: false, alreadyMigrated: false, error: '계정 복구 서버에 연결할 수 없습니다.' };
}
