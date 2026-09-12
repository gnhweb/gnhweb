import { createAuthClient } from '@neondatabase/auth';
import { SupabaseAuthAdapter } from '@neondatabase/auth/vanilla/adapters';
import { createClient } from '@supabase/supabase-js';
import { r2Storage } from '@/lib/r2Storage';
import { CloudflareRealtimeChannel, isCloudflareGameRoom } from '@/lib/cloudflareRealtime';
import { createNeonRealtimeChannel, disposeAllNeonRealtimeChannels, disposeNeonRealtimeChannel } from '@/lib/neonRealtime';

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
    if (msg.includes('Invalid Refresh Token') || msg.includes('Refresh Token Not Found') || msg.includes('AuthSessionMissingError')) {
      event.preventDefault();
      console.warn('[Auth] Pre-React caught stale auth rejection — cleaning storage:', msg);
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('sb-') || key.startsWith('neon-'))) localStorage.removeItem(key);
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
});

const neonAuth = createAuthClient(neonAuthUrl, {
  adapter: SupabaseAuthAdapter(),
  allowAnonymous: true,
});

/**
 * Transitional client:
 * - `.from()` / `.rpc()` use Neon Data API.
 * - `auth` uses Neon Auth.
 * - storage uses Cloudflare R2.
 * - database-change channels use Neon Data API polling.
 * - game broadcast/presence channels use Cloudflare Durable Objects.
 * - `functions` remains on Supabase only for services not yet migrated.
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

async function queryNeonRows(table: string): Promise<Record<string, unknown>[]> {
  const { data, error } = await neonDataClient.from(table).select('*');
  if (error) throw error;
  if (!Array.isArray(data)) return [];
  return data.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null);
}

const cloudflareChannels = new Set<CloudflareRealtimeChannel>();

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
        return (name: string, options?: Parameters<typeof legacySupabase.channel>[1]) => {
          if (isCloudflareGameRoom(name)) {
            const channel = new CloudflareRealtimeChannel(name);
            cloudflareChannels.add(channel);
            return channel;
          }
          return createNeonRealtimeChannel(legacySupabase.channel(name, options), queryNeonRows);
        };
      case 'removeChannel':
        return (channel: ReturnType<typeof legacySupabase.channel>) => {
          if (channel instanceof CloudflareRealtimeChannel) {
            cloudflareChannels.delete(channel);
            void channel.unsubscribe();
            return Promise.resolve('ok' as const);
          }
          disposeNeonRealtimeChannel(channel);
          return Promise.resolve('ok' as const);
        };
      case 'removeAllChannels':
        return () => {
          cloudflareChannels.forEach((channel) => void channel.unsubscribe());
          cloudflareChannels.clear();
          disposeAllNeonRealtimeChannels();
          return Promise.resolve('ok' as const);
        };
      case 'realtime':
        return undefined;
      default:
        return Reflect.get(target, property, receiver);
    }
  },
}) as typeof legacySupabase;
