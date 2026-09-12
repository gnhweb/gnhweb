import { requireUserId } from './bibleStreakFeature';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Env = { NEON_JWKS_URL: string; NEON_AUTH_ISSUER?: string };
type DataApiRow = Record<string, unknown>;
const DEFAULT_NEON_DATA_API_URL = 'https://ep-empty-surf-az87wypd.apirest.c-3.ap-southeast-1.aws.neon.tech/neondb';
function dataApiUrl(path: string): string { return `${DEFAULT_NEON_DATA_API_URL}/rest/v1/${path}`; }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }); }

async function dataApiRequest<T>(url: string, authorization: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('authorization', authorization);
  headers.set('accept', 'application/json');
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) throw new Error('Data API request failed');
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

async function canManageOtherUser(userId: string, authorization: string): Promise<boolean> {
  const roles = await dataApiRequest<Array<{ role?: string }>>(dataApiUrl(`user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}&limit=1`), authorization);
  if (roles[0]?.role === 'teacher' || roles[0]?.role === 'chief') return true;
  const assignments = await dataApiRequest<Array<{ role?: string }>>(dataApiUrl(`user_role_assignments?select=role&user_id=eq.${encodeURIComponent(userId)}`), authorization);
  return assignments.some((row) => row.role === 'teacher' || row.role === 'chief');
}

async function updateStreak(userId: string, authorization: string): Promise<{ streak: number; maxStreak: number } | null> {
  const today = new Date().toISOString().split('T')[0];
  const roles = await dataApiRequest<Array<{ club?: string }>>(dataApiUrl(`user_roles?select=club&user_id=eq.${encodeURIComponent(userId)}&limit=1`), authorization);
  const club = roles[0]?.club;
  const clubMap: Record<string, string> = { saeullim: '새울림', cheonjipoong: '천지풍', cheonjihu: '천지후', munhwabu: '문화부', cheonhwarae_cheongmyeong: '천화래와 청명' };
  const clubName = club ? (clubMap[club] || club) : null;
  const rows = await dataApiRequest<DataApiRow[]>(dataApiUrl(`bible_streaks?select=*&user_id=eq.${encodeURIComponent(userId)}&limit=1`), authorization);
  const existing = rows[0];
  if (!existing) {
    await dataApiRequest<unknown>(dataApiUrl('bible_streaks'), authorization, { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ user_id: userId, streak_count: 1, max_streak: 1, last_pick_date: today, total_picks: 1, club_name: clubName, updated_at: new Date().toISOString() }) });
    return { streak: 1, maxStreak: 1 };
  }
  const lastDate = existing.last_pick_date ? String(existing.last_pick_date).slice(0, 10) : null;
  const current = Number(existing.streak_count || 0);
  const max = Number(existing.max_streak || 0);
  const total = Number(existing.total_picks || 0);
  if (lastDate === today) return { streak: current, maxStreak: max };
  let next = 1;
  if (lastDate) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (lastDate === yesterday.toISOString().split('T')[0]) next = current + 1;
  }
  const nextMax = Math.max(next, max);
  await dataApiRequest<unknown>(dataApiUrl(`bible_streaks?user_id=eq.${encodeURIComponent(userId)}`), authorization, { method: 'PATCH', body: JSON.stringify({ streak_count: next, max_streak: nextMax, last_pick_date: today, total_picks: total + 1, club_name: clubName || existing.club_name, updated_at: new Date().toISOString() }) });
  return { streak: next, maxStreak: nextMax };
}

export async function handleBibleStreakUpdate(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { userId: callerId, authorization } = await requireUserId(request, env);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const requestedUserId = typeof body.userId === 'string' ? body.userId.trim() : '';
    if (!requestedUserId) return json({ error: 'userId가 필요합니다.' }, 400);
    if (requestedUserId !== callerId && !(await canManageOtherUser(callerId, authorization))) return json({ error: '다른 사용자의 스트릭은 교사 또는 부장만 갱신할 수 있습니다.' }, 403);
    const streak = await updateStreak(requestedUserId, authorization);
    return json({ streak: streak || undefined });
  } catch (error) {
    const message = error instanceof Error ? error.message : '서버 오류';
    const status = message === 'Unauthorized' || message.includes('token') || message.includes('signature') ? 401 : 500;
    return json({ error: status === 401 ? '로그인이 필요합니다.' : message }, status);
  }
}
