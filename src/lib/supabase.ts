import { createClient, SupabaseAuthAdapter } from '@neondatabase/neon-js';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

// The URLs below are the verified Neon migration branch endpoints. They are
// intentionally kept as a migration fallback until Vercel environment
// variables are attached to the preview/production environments.
const neonAuthUrl = (import.meta.env.VITE_NEON_AUTH_URL as string | undefined)
  ?? 'https://ep-fancy-rain-azlj6gwv.neonauth.c-3.ap-southeast-1.aws.neon.tech/neondb/auth';
const neonDataApiUrl = (import.meta.env.VITE_NEON_DATA_API_URL as string | undefined)
  ?? 'https://ep-fancy-rain-azlj6gwv.apirest.c-3.ap-southeast-1.aws.neon.tech/neondb/rest/v1';

// ── Global safety net (synchronous – runs BEFORE React mounts) ──
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
          if (k && k.startsWith('sb-')) localStorage.removeItem(k);
        }
      } catch {
        /* localStorage cleanup is always best-effort */
      }
    }
  });
}

const supabaseClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
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

/**
 * Compatibility facade during the migration.
 *
 * Neon exposes a Supabase-compatible database surface through Data API, so
 * database reads/writes and RPC calls can move together without changing the
 * dozens of existing call sites. Storage, Functions, and Realtime remain on
 * Supabase until their dedicated migration tracks are verified.
 */
const neonClient = createClient({
  auth: {
    adapter: SupabaseAuthAdapter(),
    url: neonAuthUrl,
    allowAnonymous: true,
  },
  dataApi: { url: neonDataApiUrl },
});

const neonAuth = neonClient.auth;

export const supabase = new Proxy(supabaseClient, {
  get(target, property, receiver) {
    if (property === 'auth') return neonAuth;
    if (property === 'from' || property === 'rpc') {
      const value = neonClient[property];
      return typeof value === 'function' ? value.bind(neonClient) : value;
    }
    return Reflect.get(target, property, receiver);
  },
});
