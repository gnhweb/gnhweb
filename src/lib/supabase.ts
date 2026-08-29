import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

// ── Global safety net (synchronous – runs BEFORE React mounts) ──
// Supabase's autoRefreshToken timer can fire as soon as the client is
// created (module-import time). If the stored refresh token is stale,
// the SDK can reject before the React AuthProvider listeners are attached.
// Only handle the known stale-session errors here; ordinary authentication
// failures must remain visible to the login form instead of being treated as
// a dead session.
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
      console.warn('[Supabase] Pre-React caught stale auth rejection — cleaning storage:', msg);

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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    // Let supabase-js use its supported lock implementation. A hand-rolled
    // Promise-chain lock can deadlock when auth methods invoke other auth
    // operations internally, which can leave signInWithPassword hanging on
    // mobile browsers and make every login attempt appear to remain on /login.
    experimental: { passkey: true },
  },
  realtime: {
    params: {
      eventsPerSecond: 30,
    },
  },
});
