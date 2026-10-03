import { createAuthClient } from '@neondatabase/auth';
import { SupabaseAuthAdapter } from '@neondatabase/auth/vanilla/adapters';
import { createClient } from '@supabase/supabase-js';
import { r2Storage } from '@/lib/r2Storage';
import { CloudflareRealtimeChannel, isCloudflareGameRoom } from '@/lib/cloudflareRealtime';
import { createNeonRealtimeChannel, disposeAllNeonRealtimeChannels, disposeNeonRealtimeChannel } from '@/lib/neonRealtime';

const DEFAULT_NEON_AUTH_URL = 'https://ep-empty-surf-az87wypd.neonauth.c-3.ap-southeast-1.aws.neon.tech/neondb/auth';
const DEFAULT_NEON_DATA_API_URL = 'https://ep-empty-surf-az87wypd.apirest.c-3.ap-southeast-1.aws.neon.tech/neondb';
const legacySupabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL || DEFAULT_NEON_DATA_API_URL;
const legacySupabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || 'anonymous';
const CLOUDFLARE_API = import.meta.env.VITE_CLOUDFLARE_API_URL || 'https://gnhweb-api.gemini19840314.workers.dev';
const CLOUDFLARE_AI_GATEWAY = import.meta.env.VITE_CLOUDFLARE_AI_GATEWAY_URL || 'https://gnhweb-ai-gateway.gemini19840314.workers.dev';
const neonAuthUrl = import.meta.env.VITE_NEON_AUTH_URL || DEFAULT_NEON_AUTH_URL;
const configuredNeonDataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL || DEFAULT_NEON_DATA_API_URL;
const neonDataApiUrl = configuredNeonDataApiUrl.replace(/\/rest\/v1\/?$/, '');
export const neonEnabled = Boolean(neonAuthUrl && neonDataApiUrl);

export async function getNeonJwtToken(): Promise<string | null> {
  try {
    return (await neonAuth.getJWTToken?.(false)) ?? null;
  } catch {
    return null;
  }
}

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
      } catch { /* best-effort */ }
    }
  });
}

const legacySupabase = createClient(legacySupabaseUrl, legacySupabaseAnonKey, {
  // Production authentication is handled by Neon Auth below. Keeping the
  // compatibility client sessionless prevents a second auth bootstrap from
  // reading stale localStorage tokens or starting an unnecessary refresh loop.
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
    storage: undefined,
    experimental: { passkey: true },
  },
});

const neonAuth = createAuthClient(neonAuthUrl, { adapter: SupabaseAuthAdapter(), allowAnonymous: true });
let webPushFlushInFlight: Promise<void> | null = null;

async function flushWebPushQueue(): Promise<void> {
  if (webPushFlushInFlight) return webPushFlushInFlight;

  webPushFlushInFlight = (async () => {
    const jwt = await getNeonJwtToken();
    if (!jwt) return;

    try {
      const response = await fetch(`${CLOUDFLARE_API}/web-push/flush`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: 'application/json',
        },
      });
      if (!response.ok) {
        console.warn('[webPush] 즉시 발송 요청 실패:', response.status);
      }
    } catch (error) {
      console.warn('[webPush] 즉시 발송 요청 중 네트워크 오류:', error);
    }
  })().finally(() => {
    webPushFlushInFlight = null;
  });

  return webPushFlushInFlight;
}

async function neonDataFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (!response.ok) return response;

  const requestUrl = typeof input === 'string'
    ? input
    : input instanceof Request
      ? input.url
      : input.toString();
  const requestMethod = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

  try {
    const parsedUrl = new URL(requestUrl);
    const dataApiPath = new URL(neonDataApiUrl).pathname.replace(/\/$/, '');
    if (requestMethod === 'POST' && parsedUrl.pathname === `${dataApiPath}/notifications`) {
      await flushWebPushQueue();
    }
  } catch {
    // Notification delivery must never turn a successful database write into
    // a client-visible failure.
  }

  return response;
}


const neonDataClient = createClient(neonDataApiUrl, 'anonymous', {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
    storage: undefined,
  },
  global: {
    fetch: neonDataFetch,
  },
  accessToken: async () => {
    try {
      return (await neonAuth.getJWTToken?.(true)) ?? null;
    } catch {
      return null;
    }
  },
});

const authClient = neonAuth as unknown as typeof legacySupabase.auth;

const LIGHTWEIGHT_REALTIME_CHANNELS = new Set([
  'home-quiz-champion-rt',
  'home-marathon-champion-rt',
  'home-schedules-rt',
  'home-attendance-rt',
  'attendance-realtime-admin',
  'attendance-locations-realtime',
]);

function isLightweightRealtimeChannel(name: string): boolean {
  return LIGHTWEIGHT_REALTIME_CHANNELS.has(name)
    || name.startsWith('notifications-menu-counts-')
    || name.startsWith('notifications-count-')
    || name.startsWith('profile-realtime-');
}

function extractEqFilter(filter?: string): { field: string; value: string } | null {
  if (!filter) return null;
  const match = filter.match(/^([A-Za-z_][A-Za-z0-9_]*)=eq\.(.*)$/);
  if (!match) return null;
  return { field: match[1], value: decodeURIComponent(match[2]) };
}

const REALTIME_SNAPSHOT_COLUMNS: Record<string, { key: string; timestamp: string }> = {
  user_roles: { key: 'user_id', timestamp: 'updated_at' },
  user_role_assignments: { key: 'id', timestamp: 'created_at' },
  user_club_assignments: { key: 'id', timestamp: 'created_at' },
  quiz_scores: { key: 'id', timestamp: 'created_at' },
  bible_marathon_entries: { key: 'id', timestamp: 'created_at' },
  schedules: { key: 'id', timestamp: 'updated_at' },
  attendance: { key: 'id', timestamp: 'checked_in_at' },
  attendance_locations: { key: 'id', timestamp: 'updated_at' },
  notifications: { key: 'id', timestamp: 'created_at' },
};

async function queryNeonRows(
  table: string,
  filters: string[] = [],
  lightweight = false,
): Promise<Record<string, unknown>[]> {
  const parsedFilters = filters
    .map(extractEqFilter)
    .filter((filter): filter is { field: string; value: string } => Boolean(filter));

  const buildQuery = (columns: string) => {
    let query = neonDataClient.from(table).select(columns);
    parsedFilters.forEach(({ field, value }) => {
      query = query.eq(field, value);
    });
    return query;
  };

  if (lightweight) {
    const snapshot = REALTIME_SNAPSHOT_COLUMNS[table];
    if (snapshot) {
      let snapshotQuery = buildQuery(`${snapshot.key},${snapshot.timestamp}`);
      snapshotQuery = snapshotQuery
        .order(snapshot.timestamp, { ascending: false })
        .order(snapshot.key, { ascending: false })
        .limit(1);

      const { data, error } = await snapshotQuery;
      if (!error && Array.isArray(data)) {
        const latest = data[0] as unknown as Record<string, unknown> | undefined;
        return [{
          id: String(latest?.[snapshot.key] ?? '__empty__'),
          updated_at: String(latest?.[snapshot.timestamp] ?? ''),
        }];
      }
    }
  }

  const columns = ['*'];
  const uniqueColumns = [...new Set(columns)].join(',');

  const { data, error } = await buildQuery(uniqueColumns);
  if (!error) {
    if (!Array.isArray(data)) return [];
    return data as unknown as Record<string, unknown>[];
  }

  if (!lightweight) throw error;

  // Legacy tables without updated_at keep their existing full-row polling so
  // UPDATE/DELETE detection remains correct.
  const fallback = await buildQuery('*');
  if (fallback.error) throw fallback.error;
  if (!Array.isArray(fallback.data)) return [];
  return fallback.data as unknown as Record<string, unknown>[];
}

const cloudflareChannels = new Set<CloudflareRealtimeChannel>();
const MIGRATED_CLOUDFLARE_FUNCTIONS = new Set([
  'meeting-ideas-ai',
  'meeting-insight-ai',
  'nim-letter',
  'nim-coaching',
  'nim-counseling',
  'nim-quiz',
  'nim-mbti',
  'prayer-relay',
  'quiz-leaderboard',
  'quiz-report',
  'streak-tracker',
  'bible-streak-update',
  'bible-pick',
  'monthly-champion-snapshot',
  'passkey',
]);

const CLOUDFLARE_AI_FUNCTIONS = new Set([
  'meeting-ideas-ai',
  'meeting-insight-ai',
  'nim-letter',
  'nim-coaching',
  'nim-counseling',
  'nim-quiz',
  'nim-mbti',
]);

const cloudflareFunctions = new Proxy(legacySupabase.functions, {
  get(target, property, receiver) {
    if (property !== 'invoke') return Reflect.get(target, property, receiver);

    return async (functionName: string, options?: { body?: unknown; method?: 'PUT' | 'DELETE' | 'GET' | 'POST' | 'PATCH' }) => {
      const separatorIndex = functionName.indexOf('?');
      const baseFunctionName = separatorIndex >= 0 ? functionName.slice(0, separatorIndex) : functionName;
      const query = separatorIndex >= 0 ? functionName.slice(separatorIndex) : '';

      if (!MIGRATED_CLOUDFLARE_FUNCTIONS.has(baseFunctionName)) {
        return target.invoke(functionName, options as Parameters<typeof target.invoke>[1]);
      }

      const endpointMap: Record<string, string> = {
        'meeting-ideas-ai': '/meeting-ideas',
        'meeting-insight-ai': '/meeting-insight',
        'nim-letter': '/nim-letter',
        'nim-coaching': '/nim-coaching',
        'nim-counseling': '/nim-counseling',
        'nim-quiz': '/nim-quiz',
        'nim-mbti': '/nim-mbti',
        'prayer-relay': '/prayer-relay',
        'quiz-leaderboard': '/quiz-leaderboard',
        'quiz-report': '/quiz-report',
        'streak-tracker': '/streak-tracker',
        'bible-streak-update': '/bible-streak-update',
        'bible-pick': '/bible-pick',
        'monthly-champion-snapshot': '/monthly-champion-snapshot',
        'passkey': '/passkey',
      };
      const endpoint = endpointMap[baseFunctionName];
      if (!endpoint) return target.invoke(functionName, options as Parameters<typeof target.invoke>[1]);

      try {
        const jwtRequiredFunction = new Set([
          'prayer-relay',
          'quiz-leaderboard',
          'quiz-report',
          'streak-tracker',
          'bible-streak-update',
          'monthly-champion-snapshot',
          'passkey',
        ]).has(baseFunctionName);
        const quizJwt = baseFunctionName === 'nim-quiz' ? await neonAuth.getJWTToken?.(false) : null;
        const jwt = jwtRequiredFunction ? await neonAuth.getJWTToken?.(false) : quizJwt;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (jwt) headers.Authorization = `Bearer ${jwt}`;

        const method = options?.method || 'POST';
        const baseUrl = CLOUDFLARE_AI_FUNCTIONS.has(baseFunctionName) ? CLOUDFLARE_AI_GATEWAY : CLOUDFLARE_API;
        const response = await fetch(`${baseUrl}${endpoint}${query}`, {
          method,
          headers,
          body: method === 'GET' ? undefined : JSON.stringify(options?.body ?? {}),
        });
        const text = await response.text();
        let data: unknown = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = null;
        }

        if (!response.ok) {
          return {
            data: null,
            error: new Error(
              typeof (data as { error?: unknown })?.error === 'string'
                ? (data as { error: string }).error
                : `Cloudflare request failed: ${response.status}`,
            ),
          };
        }

        return { data, error: null };
      } catch (error) {
        return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
      }
    };
  },
});

export const supabase = new Proxy(neonDataClient, {
  get(target, property, receiver) {
    switch (property) {
      case 'auth':
        return authClient;
      case 'storage':
        return r2Storage as unknown as typeof legacySupabase.storage;
      case 'functions':
        return cloudflareFunctions;
      case 'channel':
        return (name: string, options?: Parameters<typeof legacySupabase.channel>[1]) => {
          if (isCloudflareGameRoom(name)) {
            const channel = new CloudflareRealtimeChannel(name);
            cloudflareChannels.add(channel);
            return channel;
          }
          return createNeonRealtimeChannel(
            neonDataClient.channel(name, options),
            queryNeonRows,
            isLightweightRealtimeChannel(name),
            name,
          );
        };
      case 'removeChannel':
        return (channel: ReturnType<typeof legacySupabase.channel> | CloudflareRealtimeChannel) => {
          const cloudflareChannel = channel as unknown as CloudflareRealtimeChannel;
          if (cloudflareChannels.has(cloudflareChannel)) {
            cloudflareChannels.delete(cloudflareChannel);
            void cloudflareChannel.unsubscribe();
            return Promise.resolve('ok' as const);
          }
          disposeNeonRealtimeChannel(channel as ReturnType<typeof legacySupabase.channel>);
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
