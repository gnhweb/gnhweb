import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

/**
 * In-memory serial lock for Supabase auth.
 *
 * Why not Navigator LockManager?
 * The default Web Locks based lock is known to hang on some mobile browsers
 * (notably iOS Safari and certain in-app / private-mode webviews), which
 * freezes getSession()/signInWithPassword() and makes login appear to "not work"
 * or bounce back to the logged-out state.
 *
 * This lock simply serializes auth operations within the current tab using a
 * promise chain. It never blocks on cross-tab coordination and can never hang,
 * which is exactly what we want for a login flow that must always complete.
 *
 * Signature matches the auth-js contract: (name, acquireTimeout, fn) => Promise<R>
 */
let authLockChain: Promise<unknown> = Promise.resolve();

async function inMemoryLock<R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> {
  // Chain onto the previous operation so auth calls run one at a time.
  // Swallow the previous op's result/error so one failure can't break the chain.
  const run = authLockChain.then(() => fn(), () => fn());
  authLockChain = run.then(() => undefined, () => undefined);
  return run as Promise<R>;
}

// ── Global safety net (synchronous – runs BEFORE React mounts) ──
// Supabase's autoRefreshToken timer can fire as soon as the client is
// created (module-import time). If the stored refresh token is stale,
// the SDK throws an unhandled rejection BEFORE our React AuthProvider's
// useEffect listeners are attached.  We catch it here, clean up the
// broken session, and let the AuthProvider handle the login redirect.
// ────────────────────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const msg = typeof reason?.message === 'string' ? reason.message : String(reason ?? '');

    if (
      msg.includes('Invalid Refresh Token') ||
      msg.includes('Refresh Token Not Found') ||
      msg.includes('AuthSessionMissingError')
    ) {
      event.preventDefault(); // stop the default "Unhandled Rejection" console noise
      console.warn('[Supabase] Pre-React caught stale auth rejection — cleaning storage:', msg);

      // Nuke all sb-* keys from localStorage so the AuthProvider's
      // getSession() finds nothing and gracefully redirects to /login.
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
    lock: inMemoryLock,
    experimental: { passkey: true },
  },
  // Realtime: supabase-js defaults this to 10 outbound broadcast messages/sec,
  // shared across the ONE websocket for every channel the app opens (all coop
  // games use this same client). Pilgrim's Run co-op alone already sends
  // player position at ~15/sec per client, so with the default limit the SDK
  // was silently throttling/dropping our own outgoing broadcasts client-side
  // before they ever left the browser — which shows up as a teammate's
  // character randomly freezing, vanishing, then popping back once a packet
  // finally got through. Raised with headroom for position + box/gate/stuck
  // broadcasts running at once.
  realtime: {
    params: {
      eventsPerSecond: 30,
    },
  },
});