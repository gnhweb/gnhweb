import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  { name: '믿음의 기초', icon: 'ri-anchor-line', days: 14, description: '2주 연속 말씀 뽑기' },
  { name: '말씀의 달인', icon: 'ri-book-3-line', days: 30, description: '30일 연속! 한 달을 말씀으로 채웠어요' },
  { name: '말씀 전사', icon: 'ri-shield-star-line', days: 50, description: '50일 연속 도전 성공' },
  { name: '말씀의 성벽', icon: 'ri-building-2-line', days: 100, description: '100일 연속! 당신은 말씀의 성벽입니다' },
  { name: '영적 거인', icon: 'ri-star-smile-line', days: 200, description: '200일 연속! 영적 성장의 모범' },
  { name: '말씀의 기둥', icon: 'ri-building-line', days: 365, description: '1년 연속! 말씀의 기둥이 되셨습니다' },
];

function getBadges(streak: number): BadgeInfo[] {
  return BADGES.filter(b => b.days <= streak);
}

function getNextBadge(streak: number): BadgeInfo | null {
  return BADGES.find(b => b.days > streak) || null;
}

async function parseParams(req: Request): Promise<{ userId: string | null; club: string | null }> {
  let userId: string | null = null;
  let club: string | null = null;

  // 1. Try JSON body first (POST or GET with body)
  if (req.body) {
    try {
      const cloned = req.clone();
      const body = await cloned.json();
      if (body && typeof body === 'object') {
        if (body.userId) userId = String(body.userId);
        if (body.club) club = String(body.club);
      }
    } catch { /* not JSON or empty */ }
  }

  // 2. Fallback to URL query params
  if (!userId || !club) {
    const url = new URL(req.url);
    if (!userId) userId = url.searchParams.get('userId');
    if (!club) club = url.searchParams.get('club');
  }

  return { userId, club };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    );

    // Accept both GET and POST
    if (req.method === 'GET' || req.method === 'POST') {
      const { userId, club } = await parseParams(req);

      let result: Record<string, unknown> = {};

      // 개인 스트릭
      if (userId) {
        const { data: streakData, error: streakErr } = await supabase
          .from('bible_streaks')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (streakErr) {
          console.error('streak query error:', streakErr);
          result.individual = { streak: 0, maxStreak: 0, totalPicks: 0, badges: [], nextBadge: BADGES[0] };
        } else if (streakData) {
          result.individual = {
            streak: streakData.streak_count,
            maxStreak: streakData.max_streak,
            totalPicks: streakData.total_picks,
            lastPickDate: streakData.last_pick_date,
            badges: getBadges(streakData.streak_count),
            nextBadge: getNextBadge(streakData.streak_count),
          };
        } else {
          result.individual = { streak: 0, maxStreak: 0, totalPicks: 0, badges: [], nextBadge: BADGES[0] };
        }
      }

      // 동아리 랭킹
      if (club) {
        const { data: clubRank } = await supabase
          .from('bible_streaks')
          .select('user_id, streak_count, total_picks')
          .eq('club_name', club)
          .order('streak_count', { ascending: false })
          .limit(20);
        result.clubRanking = clubRank || [];
      }

      // 전체 동아리 순위
      const { data: allRank } = await supabase
        .from('bible_streaks')
        .select('club_name, streak_count, max_streak, total_picks')
        .order('streak_count', { ascending: false });

      const clubAgg: Record<string, { totalStreaks: number; memberCount: number; totalPicks: number }> = {};
      for (const row of (allRank || [])) {
        const cn = row.club_name || '미지정';
        if (!clubAgg[cn]) clubAgg[cn] = { totalStreaks: 0, memberCount: 0, totalPicks: 0 };
        clubAgg[cn].totalStreaks += row.streak_count;
        clubAgg[cn].memberCount += 1;
        clubAgg[cn].totalPicks += row.total_picks;
      }

      result.clubOverall = Object.entries(clubAgg)
        .map(([name, s]) => ({
          club_name: name,
          total_streaks: s.totalStreaks,
          member_count: s.memberCount,
          total_picks: s.totalPicks,
          avg_streak: Math.round(s.totalStreaks / s.memberCount),
        }))
        .sort((a, b) => b.total_streaks - a.total_streaks);

      return new Response(JSON.stringify(result), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '서버 오류';
    console.error('streak-tracker error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
