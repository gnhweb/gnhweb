import { createClient, SupabaseAuthAdapter } from '@neondatabase/neon-js';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

// Verified against the Neon migration branch. These remain fallbacks until
// Vercel environment variables are attached to the deployment environments.
const neonAuthUrl = (import.meta.env.VITE_NEON_AUTH_URL as string | undefined)
  ?? 'https://ep-fancy-rain-azlj6gwv.neonauth.c-3.ap-southeast-1.aws.neon.tech/neondb/auth';
const neonDataApiUrl = (import.meta.env.VITE_NEON_DATA_API_URL as string | undefined)
  ?? 'https://ep-fancy-rain-azlj6gwv.apirest.c-3.ap-southeast-1.aws.neon.tech/neondb/rest/v1';

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
 * Neon handles auth plus the Supabase-compatible Data API for from/rpc calls.
 * Storage, Functions, and Realtime stay on Supabase until separately verified.
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
const neonFrom = neonClient.from.bind(neonClient);
const neonRpc = neonClient.rpc.bind(neonClient);

export const supabase = new Proxy(supabaseClient, {
  get(target, property, receiver) {
    if (property === 'auth') return neonAuth;
    if (property === 'from') return neonFrom;
    if (property === 'rpc') return neonRpc;
    return Reflect.get(target, property, receiver);
  },
});
