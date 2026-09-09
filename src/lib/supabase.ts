import { createAuthClient } from '@neondatabase/auth';
import { createClient } from '@supabase/supabase-js';

const legacySupabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
const legacySupabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

const DEFAULT_NEON_AUTH_URL = 'https://ep-empty-surf-az87wypd.neonauth.c-3.ap-southeast-1.aws.neon.tech/neondb/auth';
const DEFAULT_NEON_DATA_API_URL = 'https://ep-empty-surf-az87wypd.apirest.c-3.ap-southeast-1.aws.neon.tech/neondb/rest/v1';

const neonAuthUrl = import.meta.env.VITE_NEON_AUTH_URL || DEFAULT_NEON_AUTH_URL;
const neonDataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL || DEFAULT_NEON_DATA_API_URL;

export const neonEnabled = Boolean(neonAuthUrl && neonDataApiUrl);

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const msg = typeof reason?.message === 'string' ? reason.message : String(reason ?? '');
    if (
      msg.includes('Invalid Refresh Token') ||
      msg.includes('Refresh Token Not Found') ||
      msg.includes('AuthSessionMissingError')
    ) {
      event.preventDefault();
      console.warn('[Auth] Pre-React caught stale auth rejection — cleaning storage:', msg);
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('sb-') || k.startsWith('neon-'))) localStorage.removeItem(k);
        }
      } catch {
        /* localStorage cleanup is always best-effort */
      }
    }
  });
}

const legacySupabase = createClient(legacySupabaseUrl, legacySupabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    experimental: { passkey: true },
  },
  realtime: {
    params: {
      eventsPerSecond: 30,
    },
  },
});

const neonAuth = createAuthClient(neonAuthUrl, {
  allowAnonymous: true,
});

/**
 * Transitional data client:
 * - `.from()` / `.rpc()` use Neon Data API.
 * - storage/functions/realtime remain on the legacy client until those
 *   Supabase services are migrated separately.
 */
const neonDataClient = createClient(neonDataApiUrl, 'anonymous', {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
    storage: undefined,
  },
  accessToken: async () => {
    try {
      return (await neonAuth.getJWTToken?.()) ?? null;
    } catch {
      return null;
    }
  },
});

const authClient = neonAuth as unknown as typeof legacySupabase.auth;

export const supabase = Object.assign(neonDataClient, {
  auth: authClient,
  storage: legacySupabase.storage,
  functions: legacySupabase.functions,
  channel: legacySupabase.channel.bind(legacySupabase),
  removeChannel: legacySupabase.removeChannel.bind(legacySupabase),
  removeAllChannels: legacySupabase.removeAllChannels.bind(legacySupabase),
  realtime: legacySupabase.realtime,
});
