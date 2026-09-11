import { createAuthClient } from '@neondatabase/auth';
import { SupabaseAuthAdapter } from '@neondatabase/auth/vanilla/adapters';
import { createClient } from '@supabase/supabase-js';
import { r2Storage } from '@/lib/r2Storage';

const legacySupabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
const legacySupabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

const DEFAULT_NEON_AUTH_URL = 'https://ep-empty-surf-az87wypd.neonauth.c-3.ap-southeast-1.aws.neon.tech/neondb/auth';
const DEFAULT_NEON_DATA_API_URL = 'https://ep-empty-surf-az87wypd.apirest.c-3.ap-southeast-1.aws.neon.tech/neondb';

const neonAuthUrl = import.meta.env.VITE_NEON_AUTH_URL || DEFAULT_NEON_AUTH_URL;
const configuredNeonDataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL || DEFAULT_NEON_DATA_API_URL;
const neonDataApiUrl = configuredNeonDataApiUrl.replace(/\/rest\/v1\/?$/, '');

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
  adapter: SupabaseAuthAdapter(),
  allowAnonymous: true,
});

/**
 * Transitional data client:
 * - `.from()` / `.rpc()` use Neon Data API.
 * - functions/realtime remain on the legacy client until those services
 *   are migrated separately.
 * - storage uses the Cloudflare R2 compatibility client.
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

/**
 * Keep the existing Supabase-shaped API without mutating the Supabase client.
 * Supabase client service properties such as `functions` are accessor-only,
 * so Object.assign() throws when trying to replace them.
 */
export const supabase = new Proxy(neonDataClient, {
  get(target, property, receiver) {
    switch (property) {
      case 'auth':
        return authClient;
      case 'storage':
        return r2Storage as unknown as typeof legacySupabase.storage;
      case 'functions':
        return legacySupabase.functions;
      case 'channel':
        return legacySupabase.channel.bind(legacySupabase);
      case 'removeChannel':
        return legacySupabase.removeChannel.bind(legacySupabase);
      case 'removeAllChannels':
        return legacySupabase.removeAllChannels.bind(legacySupabase);
      case 'realtime':
        return legacySupabase.realtime;
      default:
        return Reflect.get(target, property, receiver);
    }
  },
}) as typeof legacySupabase;
