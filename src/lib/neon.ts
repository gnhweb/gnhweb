import { createClient, SupabaseAuthAdapter } from '@neondatabase/neon-js';

const authUrl = import.meta.env.VITE_NEON_AUTH_URL as string | undefined;
const dataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL as string | undefined;

if (!authUrl || !dataApiUrl) {
  throw new Error('Neon 환경변수(VITE_NEON_AUTH_URL, VITE_NEON_DATA_API_URL)가 설정되지 않았습니다.');
}

/**
 * Neon unified client.
 *
 * The SupabaseAuthAdapter keeps the existing auth surface compatible while the
 * database layer moves to Neon Data API. Storage, Functions, and Realtime are
 * intentionally not routed through this client yet; those are separate
 * migration tracks and must not silently fall back to an unsupported API.
 */
export const neon = createClient({
  auth: {
    adapter: SupabaseAuthAdapter(),
    url: authUrl,
    allowAnonymous: true,
  },
  dataApi: {
    url: dataApiUrl,
  },
});
