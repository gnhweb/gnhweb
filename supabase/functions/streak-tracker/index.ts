import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface BadgeInfo {
  name: string;
  icon: string;
  days: number;
  description: string;
}

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

function getBadges(streak: number): BadgeInfo[] {
  return BADGES.filter((badge) => badge.days <= streak);
}

function getNextBadge(streak: number): BadgeInfo | null {
  return BADGES.find((badge) => badge.days > streak) || null;
}

function getBearerToken(req: Request): string {
  const header = req.headers.get('Authorization') || '';
  return header.replace(/^Bearer\s+/i, '').trim();
}

async function getAuthenticatedUserId(req: Request, supabaseUrl: string, anonKey: string): Promise<string | null> {
  const token = getBearerToken(req);
  if (!token || !anonKey) return null;
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error) return null;
  return data.user?.id || null;
}

async function parseBody(req: Request): Promise<{ club: string | null }> {
  if (req.method !== 'POST' || !req.body) return { club: null };
  try {
    const body = await req.json();
    return { club: body && typeof body.club === 'string' ? body.club : null };
  } catch {
    return { club: null };
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    if (!supabaseUrl || !serviceRoleKey || !anonKey) return json({ error: '서버 설정이 올바르지 않습니다.' }, 500);

    const authenticatedUserId = await getAuthenticatedUserId(req, supabaseUrl, anonKey);
    const { club } = await parseBody(req);
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const result: Record<string, unknown> = {};

    if (authenticatedUserId) {
      const { data: streakData, error: streakErr } = await admin
        .from('bible_streaks')
        .select('streak_count,max_streak,total_picks,last_pick_date,club_name')
        .eq('user_id', authenticatedUserId)
        .maybeSingle();

      if (streakErr) return json({ error: '스트릭 정보를 불러오지 못했습니다.' }, 500);

      const streak = streakData?.streak_count ?? 0;
      result.individual = {
        streak,
        maxStreak: streakData?.max_streak ?? 0,
        totalPicks: streakData?.total_picks ?? 0,
        lastPickDate: streakData?.last_pick_date ?? null,
        badges: getBadges(streak),
        nextBadge: getNextBadge(streak),
      };

      result.clubName = streakData?.club_name || club || '미지정';
    } else {
      result.individual = null;
      result.clubName = club || null;
    }

    const rankingQuery = club
      ? admin.from('bible_streaks').select('user_id,streak_count,total_picks').eq('club_name', club).order('streak_count', { ascending: false }).limit(20)
      : null;
    if (rankingQuery) {
      const { data: clubRanking, error } = await rankingQuery;
      if (error) return json({ error: '동아리 랭킹을 불러오지 못했습니다.' }, 500);
      result.clubRanking = clubRanking || [];
    }

    const { data: allRank, error: rankingErr } = await admin
      .from('bible_streaks')
      .select('club_name,streak_count,max_streak,total_picks');
    if (rankingErr) return json({ error: '전체 랭킹을 불러오지 못했습니다.' }, 500);

    const clubAgg: Record<string, { totalStreaks: number; memberCount: number; totalPicks: number }> = {};
    for (const row of allRank || []) {
      const name = row.club_name || '미지정';
      if (!clubAgg[name]) clubAgg[name] = { totalStreaks: 0, memberCount: 0, totalPicks: 0 };
      clubAgg[name].totalStreaks += Number(row.streak_count || 0);
      clubAgg[name].memberCount += 1;
      clubAgg[name].totalPicks += Number(row.total_picks || 0);
    }

    result.clubOverall = Object.entries(clubAgg)
      .map(([name, stats]) => ({
        club_name: name,
        total_streaks: stats.totalStreaks,
        member_count: stats.memberCount,
        total_picks: stats.totalPicks,
        avg_streak: stats.memberCount ? Math.round(stats.totalStreaks / stats.memberCount) : 0,
      }))
      .sort((a, b) => b.total_streaks - a.total_streaks);

    return json(result);
  } catch (error) {
    console.error('streak-tracker error:', error);
    return json({ error: '스트릭 정보를 처리하는 중 오류가 발생했습니다.' }, 500);
  }
});
