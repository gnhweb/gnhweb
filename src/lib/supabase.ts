import { createClient, SupabaseAuthAdapter } from '@neondatabase/neon-js';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { r2Storage } from '@/lib/r2Storage';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;
const neonAuthUrl = import.meta.env.VITE_NEON_AUTH_URL as string | undefined;
const neonDataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL as string | undefined;

if (!neonAuthUrl || !neonDataApiUrl) {
  throw new Error('Neon 환경변수(VITE_NEON_AUTH_URL, VITE_NEON_DATA_API_URL)가 설정되지 않았습니다.');
}

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
 * R2 handles the Public bucket when VITE_R2_STORAGE_URL is configured.
 * notebook-files and Supabase Functions/Realtime remain on Supabase until
 * those migration tracks are separately verified.
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
const supabaseStorage = supabaseClient.storage;

export const supabase = new Proxy(supabaseClient, {
  get(target, property, receiver) {
    if (property === 'auth') return neonAuth;
    if (property === 'from') return neonFrom;
    if (property === 'rpc') return neonRpc;
    if (property === 'storage') {
      return new Proxy(supabaseStorage, {
        get(storageTarget, storageProperty, storageReceiver) {
          if (storageProperty === 'from') {
            return (bucket: string) => {
              if (r2Storage.enabled && bucket === 'public') return r2Storage.from('Public');
              if (r2Storage.enabled && bucket === 'Public') return r2Storage.from('Public');
              return supabaseStorage.from(bucket);
            };
          }
          return Reflect.get(storageTarget, storageProperty, storageReceiver);
        },
      });
    }
    return Reflect.get(target, property, receiver);
  },
});
