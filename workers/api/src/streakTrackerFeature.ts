const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

type Env = {
  NEON_JWKS_URL: string;
  NEON_AUTH_ISSUER?: string;
};
type DataApiRow = Record<string, unknown>;

type BadgeInfo = { name: string; icon: string; days: number; description: string };

const BADGES: BadgeInfo[] = [
  { name: '시작의 한걸음', icon: 'ri-footprint-line', days: 1, description: '첫 묵상 확인 또는 퀴즈 완료!' },
  { name: '말씀 새싹', icon: 'ri-seedling-line', days: 3, description: '3일 연속 말씀 묵상' },
  { name: '말씀의 길', icon: 'ri-road-map-line', days: 7, description: '7일 연속! 일주일을 말씀과 함께' },
  { name: '믿음의 기초', icon: 'ri-anchor-line', days: 14, description: '2주 연속 말씀 묵상' },
  { name: '말씀의 달인', icon: 'ri-book-3-line', days: 30, description: '30일 연속! 한 달을 말씀으로 채웠어요' },
  { name: '말씀 전사', icon: 'ri-shield-star-line', days: 50, description: '50일 연속 도전 성공' },
  { name: '말씀의 성벽', icon: 'ri-building-2-line', days: 100, description: '100일 연속! 말씀의 성벽입니다' },
  { name: '영적 거인', icon: 'ri-star-smile-line', days: 200, description: '200일 연속! 영적 성장의 모범' },
  { name: '말씀의 기둥', icon: 'ri-building-line', days: 365, description: '1년 연속! 말씀의 기둥이 되셨습니다' },
];

const CLUB_NAME_MAP: Record<string, string> = {
  saeullim: '새울림',
  cheonjipoong: '천지풍',
  cheonjihu: '천지후',
  munhwabu: '문화부',
  cheonhwarae_cheongmyeong: '천화래와 청명',
};
const DEFAULT_NEON_DATA_API_URL = 'https://ep-empty-surf-az87wypd.apirest.c-3.ap-southeast-1.aws.neon.tech/neondb';

function dataApiUrl(path: string): string { return `${DEFAULT_NEON_DATA_API_URL}/rest/v1/${path}`; }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }); }

async function dataApiRequest<T>(url: string, authorization: string): Promise<T> {
  const headers = new Headers({ accept: 'application/json' });
  if (authorization) headers.set('authorization', authorization);
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error('Data API request failed');
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

function getBadges(streak: number): BadgeInfo[] { return BADGES.filter((badge) => badge.days <= streak); }
function getNextBadge(streak: number): BadgeInfo | null { return BADGES.find((badge) => badge.days > streak) || null; }

export async function handleStreakTracker(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'GET' && request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authorization = request.headers.get('authorization') || '';
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) as Record<string, unknown> : {};
    const club = typeof body.club === 'string' ? body.club : new URL(request.url).searchParams.get('club');

    let authenticatedUserId: string | null = null;
    if (authorization.startsWith('Bearer ')) {
      const { requireUserId } = await import('./bibleStreakFeature');
      try { authenticatedUserId = (await requireUserId(request, env)).userId; } catch { authenticatedUserId = null; }
    }

    const result: Record<string, unknown> = {};
    if (authenticatedUserId) {
      const rows = await dataApiRequest<DataApiRow[]>(dataApiUrl(`bible_streaks?select=streak_count,max_streak,total_picks,last_pick_date,club_name&user_id=eq.${encodeURIComponent(authenticatedUserId)}&limit=1`), authorization);
      const streakData = rows[0];
      const streak = Number(streakData?.streak_count || 0);
      result.individual = {
        streak,
        maxStreak: Number(streakData?.max_streak || 0),
        totalPicks: Number(streakData?.total_picks || 0),
        lastPickDate: streakData?.last_pick_date || null,
        badges: getBadges(streak),
        nextBadge: getNextBadge(streak),
      };
      result.clubName = streakData?.club_name || club || '미지정';
    } else {
      result.individual = null;
      result.clubName = club || null;
    }

    if (club) {
      result.clubRanking = await dataApiRequest<DataApiRow[]>(dataApiUrl(`bible_streaks?select=user_id,streak_count,total_picks&club_name=eq.${encodeURIComponent(CLUB_NAME_MAP[club] || club)}&order=streak_count.desc&limit=20`), authorization);
    }

    const allRank = await dataApiRequest<DataApiRow[]>(dataApiUrl('bible_streaks?select=club_name,streak_count,max_streak,total_picks'), authorization);
    const clubAgg: Record<string, { totalStreaks: number; memberCount: number; totalPicks: number }> = {};
    for (const row of allRank || []) {
      const name = typeof row.club_name === 'string' && row.club_name ? row.club_name : '미지정';
      if (!clubAgg[name]) clubAgg[name] = { totalStreaks: 0, memberCount: 0, totalPicks: 0 };
      clubAgg[name].totalStreaks += Number(row.streak_count || 0);
      clubAgg[name].memberCount += 1;
      clubAgg[name].totalPicks += Number(row.total_picks || 0);
    }
    result.clubOverall = Object.entries(clubAgg).map(([name, stats]) => ({
      club_name: name,
      total_streaks: stats.totalStreaks,
      member_count: stats.memberCount,
      total_picks: stats.totalPicks,
      avg_streak: stats.memberCount ? Math.round(stats.totalStreaks / stats.memberCount) : 0,
    })).sort((a, b) => b.total_streaks - a.total_streaks);

    return json(result);
  } catch (error) {
    console.error('[streak-tracker] error:', error);
    return json({ error: '스트릭 정보를 처리하는 중 오류가 발생했습니다.' }, 500);
  }
}
