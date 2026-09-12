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
const CLOUDFLARE_AI_GATEWAY = 'https://gnhweb-ai-gateway.gemini19840314.workers.dev';
const CLOUDFLARE_API = import.meta.env.VITE_CLOUDFLARE_API_URL || 'https://gnhweb-api.gemini19840314.workers.dev';
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
      try { for (let i = localStorage.length - 1; i >= 0; i--) { const key = localStorage.key(i); if (key && (key.startsWith('sb-') || key.startsWith('neon-'))) localStorage.removeItem(key); } } catch { /* best-effort */ }
    }
  });
}

const legacySupabase = createClient(legacySupabaseUrl, legacySupabaseAnonKey, { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, storage: typeof window !== 'undefined' ? window.localStorage : undefined, experimental: { passkey: true } } });
const neonAuth = createAuthClient(neonAuthUrl, { adapter: SupabaseAuthAdapter(), allowAnonymous: true });
const neonDataClient = createClient(neonDataApiUrl, 'anonymous', { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false, storage: undefined }, accessToken: async () => { try { return (await neonAuth.getJWTToken?.()) ?? null; } catch { return null; } } });
const authClient = neonAuth as unknown as typeof legacySupabase.auth;
async function queryNeonRows(table: string): Promise<Record<string, unknown>[]> { const { data, error } = await neonDataClient.from(table).select('*'); if (error) throw error; if (!Array.isArray(data)) return []; return data.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null); }
const cloudflareChannels = new Set<CloudflareRealtimeChannel>();
const MIGRATED_CLOUDFLARE_FUNCTIONS = new Set(['meeting-ideas-ai', 'meeting-insight-ai', 'nim-letter', 'nim-coaching', 'nim-counseling', 'nim-quiz', 'nim-mbti', 'prayer-relay', 'quiz-leaderboard', 'quiz-report']);
const cloudflareFunctions = new Proxy(legacySupabase.functions, { get(target, property, receiver) { if (property !== 'invoke') return Reflect.get(target, property, receiver); return async (functionName: string, options?: { body?: unknown; method?: string }) => { const separatorIndex = functionName.indexOf('?'); const baseFunctionName = separatorIndex >= 0 ? functionName.slice(0, separatorIndex) : functionName; const query = separatorIndex >= 0 ? functionName.slice(separatorIndex) : ''; if (!MIGRATED_CLOUDFLARE_FUNCTIONS.has(baseFunctionName)) return target.invoke(functionName, options); const endpoint = baseFunctionName === 'meeting-ideas-ai' ? '/meeting-ideas' : baseFunctionName === 'meeting-insight-ai' ? '/meeting-insight' : baseFunctionName === 'nim-letter' ? '/nim-letter' : baseFunctionName === 'nim-coaching' ? '/nim-coaching' : baseFunctionName === 'nim-counseling' ? '/nim-counseling' : baseFunctionName === 'nim-quiz' ? '/nim-quiz' : baseFunctionName === 'nim-mbti' ? '/nim-mbti' : baseFunctionName === 'prayer-relay' ? '/prayer-relay' : baseFunctionName === 'quiz-leaderboard' ? '/quiz-leaderboard' : '/quiz-report'; try { const jwtRequiredFunction = baseFunctionName === 'prayer-relay' || baseFunctionName === 'quiz-leaderboard' || baseFunctionName === 'quiz-report'; const jwt = jwtRequiredFunction ? await neonAuth.getJWTToken?.() : null; const headers: Record<string, string> = { 'Content-Type': 'application/json' }; if (jwt) headers.Authorization = `Bearer ${jwt}`; const method = options?.method || 'POST'; const response = await fetch(`${jwtRequiredFunction ? CLOUDFLARE_API : CLOUDFLARE_AI_GATEWAY}${endpoint}${query}`, { method, headers, body: method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify(options?.body ?? {}) }); const text = await response.text(); let data: unknown = null; try { data = text ? JSON.parse(text) : null; } catch { data = null; } if (!response.ok) return { data: null, error: new Error(typeof (data as { error?: unknown })?.error === 'string' ? (data as { error: string }).error : `Cloudflare request failed: ${response.status}`) }; return { data, error: null }; } catch (error) { return { data: null, error: error instanceof Error ? error : new Error(String(error)) }; } }; } });
export const supabase = new Proxy(neonDataClient, { get(target, property, receiver) { switch (property) { case 'auth': return authClient; case 'storage': return r2Storage as unknown as typeof legacySupabase.storage; case 'functions': return cloudflareFunctions; case 'channel': return (name: string, options?: Parameters<typeof legacySupabase.channel>[1]) => { if (isCloudflareGameRoom(name)) { const channel = new CloudflareRealtimeChannel(name); cloudflareChannels.add(channel); return channel; } return createNeonRealtimeChannel(legacySupabase.channel(name, options), queryNeonRows); case 'removeChannel': return (channel: ReturnType<typeof legacySupabase.channel>) => { if (channel instanceof CloudflareRealtimeChannel) { cloudflareChannels.delete(channel); void channel.unsubscribe(); return Promise.resolve('ok' as const); } disposeNeonRealtimeChannel(channel); return Promise.resolve('ok' as const); }; case 'removeAllChannels': return () => { cloudflareChannels.forEach((channel) => void channel.unsubscribe()); cloudflareChannels.clear(); disposeAllNeonRealtimeChannels(); return Promise.resolve('ok' as const); }; case 'realtime': return undefined; default: return Reflect.get(target, property, receiver); } } }) as typeof legacySupabase;
