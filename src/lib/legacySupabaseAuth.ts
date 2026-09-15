import { createClient } from '@supabase/supabase-js';

type VerificationResult = {
  ok: boolean;
  error?: string;
};

const legacySupabaseUrl = String(import.meta.env.VITE_PUBLIC_SUPABASE_URL || '').trim();
const legacySupabaseAnonKey = String(import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || '').trim();

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
