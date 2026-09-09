import { createClient, SupabaseAuthAdapter } from '@neondatabase/neon-js';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;
const neonAuthUrl = import.meta.env.VITE_NEON_AUTH_URL as string | undefined;
const neonDataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL as string | undefined;

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
 * Compatibility client during the migration.
 *
 * When Neon Auth environment variables are present, only the auth surface is
 * switched to Neon. Existing DB/Storage/Realtime calls intentionally remain
 * on Supabase until their dedicated migration tracks are verified.
 * Without Neon variables, the existing Supabase auth remains available so a
 * partially configured preview cannot be made unusable.
 */
const neonAuth = neonAuthUrl && neonDataApiUrl
  ? createClient({
      auth: {
        adapter: SupabaseAuthAdapter(),
        url: neonAuthUrl,
        allowAnonymous: true,
      },
      dataApi: { url: neonDataApiUrl },
    }).auth
  : null;

export const supabase = new Proxy(supabaseClient, {
  get(target, property, receiver) {
    if (property === 'auth' && neonAuth) return neonAuth;
    return Reflect.get(target, property, receiver);
  },
});
