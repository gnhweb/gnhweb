import { createClient } from '@supabase/supabase-js';

type VerificationResult = {
  ok: boolean;
  error?: string;
};

type MigrationResponseBody = {
  status?: string;
  error?: string;
  legacyStatus?: number;
  legacyError?: string;
  legacyErrorDescription?: string;
};

type MigrationResult = {
  migrated: boolean;
  alreadyMigrated: boolean;
  error?: string;
};

const legacySupabaseUrl = String(import.meta.env.VITE_PUBLIC_SUPABASE_URL || '').trim();
const legacySupabaseAnonKey = String(import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || '').trim();
const migrationApiUrl = String(import.meta.env.VITE_CLOUDFLARE_API_URL || 'https://gnhweb-api.gemini19840314.workers.dev').trim();
const migrationEndpoint = `${migrationApiUrl.replace(/\/$/, '')}/account-password-migration`;

let client: ReturnType<typeof createClient> | null = null;

function getLegacyClient() {
  if (client) return client;
  if (!legacySupabaseUrl || !legacySupabaseAnonKey) return null;

  client = createClient(legacySupabaseUrl, legacySupabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return client;
}

export async function verifyLegacySupabasePassword(email: string, password: string): Promise<VerificationResult> {
  const legacyClient = getLegacyClient();
  if (!legacyClient) {
    return { ok: false, error: '기존 인증 서버 연결 정보가 설정되어 있지 않습니다.' };
  }

  try {
    const { error } = await legacyClient.auth.signInWithPassword({ email, password });
    await legacyClient.auth.signOut();

    if (error) {
      return { ok: false, error: '기존 이메일 또는 비밀번호가 맞지 않습니다.' };
    }

    return { ok: true };
  } catch (error) {
    try {
      await legacyClient.auth.signOut();
    } catch {
      // best effort cleanup
    }
    console.error('[LegacyAuth] verification failed:', error);
    return { ok: false, error: '기존 인증 서버 확인에 실패했습니다. 잠시 후 다시 시도해주세요.' };
  }
}

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
      const diagnostics = [
        typeof body.legacyStatus === 'number' ? `status=${body.legacyStatus}` : '',
        body.legacyError ? `error=${body.legacyError}` : '',
        body.legacyErrorDescription ? `description=${body.legacyErrorDescription}` : '',
      ].filter(Boolean).join(', ');

      return {
        migrated: false,
        alreadyMigrated: false,
        error: diagnostics ? `${body.error || '계정 복구에 실패했습니다.'} (${diagnostics})` : (body.error || '계정 복구에 실패했습니다.'),
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
