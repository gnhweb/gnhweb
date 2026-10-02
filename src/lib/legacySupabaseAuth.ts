import { scryptAsync } from '@noble/hashes/scrypt.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';

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

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashForNeonAuth(password: string): Promise<string> {
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const derived = await scryptAsync(utf8ToBytes(password.normalize('NFKC')), utf8ToBytes(salt), {
    N: 16384,
    r: 16,
    p: 1,
    dkLen: 64,
    maxmem: 128 * 16384 * 16 * 2,
  });
  return `${salt}:${bytesToHex(derived)}`;
}

async function requestMigration(endpoint: string, email: string, password: string, passwordHash: string): Promise<Response> {
  return fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, passwordHash }),
  });
}

export async function migrateLegacyAccountPassword(email: string, password: string): Promise<MigrationResult> {
  let lastError: unknown;
  const passwordHash = await hashForNeonAuth(password);

  for (const endpoint of migrationEndpoints) {
    try {
      const response = await requestMigration(endpoint, email, password, passwordHash);

      let body: MigrationResponseBody = {};
      try {
        body = await response.json() as MigrationResponseBody;
      } catch {
        // handled below as a generic migration failure
      }

      if (response.ok) {
        if (!body.status && endpoint !== migrationApiEndpoint) {
          // Pages may serve the SPA HTML with HTTP 200 when the advanced
          // worker route is not active. Treat that as a proxy miss and use
          // the direct API Worker instead of reporting a false migration
          // failure.
          continue;
        }

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
