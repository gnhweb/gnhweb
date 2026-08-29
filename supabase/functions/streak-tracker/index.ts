import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface BadgeInfo {
  name: string;
  icon: string;
  days: number;
  description: string;
}

const BADGES: BadgeInfo[] = [
  { name: "시작의 한걸음", icon: "ri-footprint-line", days: 1, description: "첫 묵상 확인 또는 퀴즈 완료!" },
  { name: "말씀 새싹", icon: "ri-seedling-line", days: 3, description: "3일 연속 말씀 묵상" },
  { name: "말씀의 길", icon: "ri-road-map-line", days: 7, description: "7일 연속! 일주일을 말씀과 함께" },
  { name: "믿음의 기초", icon: "ri-anchor-line", days: 14, description: "2주 연속 말씀 묵상" },
  { name: "말씀의 달인", icon: "ri-book-3-line", days: 30, description: "30일 연속! 한 달을 말씀으로 채웠어요" },
  { name: "말씀 전사", icon: "ri-shield-star-line", days: 50, description: "50일 연속 도전 성공" },
  { name: "말씀의 성벽", icon: "ri-building-2-line", days: 100, description: "100일 연속! 당신은 말씀의 성벽입니다" },
  { name: "영적 거인", icon: "ri-star-smile-line", days: 200, description: "200일 연속! 영적 성장의 모범" },
  { name: "말씀의 기둥", icon: "ri-building-line", days: 365, description: "1년 연속! 말씀의 기둥이 되셨습니다" },
];

function getBadges(streak: number): BadgeInfo[] {
  return BADGES.filter((badge) => badge.days <= streak);
}

function getNextBadge(streak: number): BadgeInfo | null {
  return BADGES.find((badge) => badge.days > streak) || null;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function getBearerToken(req: Request) {
  const header = req.headers.get("Authorization") || "";
  return header.replace(/^Bearer\s+/i, "").trim();
}

const CLUB_NAME_MAP: Record<string, string> = {
  saeullim: "새울림",
  cheonjipoong: "천지풍",
  cheonjihu: "천지후",
  munhwabu: "문화부",
  cheonhwarae_cheongmyeong: "천화래와 청명",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "서버 설정이 올바르지 않습니다." }, 500);

  try {
    const accessToken = getBearerToken(req);
    let authenticatedUserId: string | null = null;

    // The endpoint stays callable on the public streak page, but an individual
    // streak is only returned when the caller presents a valid authenticated session.
    if (accessToken && anonKey) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: userData } = await userClient.auth.getUser();
      authenticatedUserId = userData.user?.id || null;
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const result: Record<string, unknown> = {};

    if (authenticatedUserId) {
      const [{ data: streakData, error: streakErr }, { data: roleRow }] = await Promise.all([
        admin
          .from("bible_streaks")
          .select("streak_count,max_streak,total_picks,last_pick_date,club_name")
          .eq("user_id", authenticatedUserId)
          .maybeSingle(),
        admin
          .from("user_roles")
          .select("club")
          .eq("user_id", authenticatedUserId)
          .maybeSingle(),
      ]);

      if (streakErr) return json({ error: "스트릭 정보를 불러오지 못했습니다." }, 500);

      const streak = streakData?.streak_count ?? 0;
      result.individual = {
        streak,
        maxStreak: streakData?.max_streak ?? 0,
        totalPicks: streakData?.total_picks ?? 0,
        lastPickDate: streakData?.last_pick_date ?? null,
        badges: getBadges(streak),
        nextBadge: getNextBadge(streak),
      };
      result.clubName = roleRow?.club
        ? (CLUB_NAME_MAP[roleRow.club] || roleRow.club)
        : (streakData?.club_name || "미지정");
    }

    const { data: allRank, error: rankingErr } = await admin
      .from("bible_streaks")
      .select("club_name,streak_count,total_picks");
    if (rankingErr) return json({ error: "동아리 랭킹을 불러오지 못했습니다." }, 500);

    const clubAgg: Record<string, { total_streaks: number; member_count: number; total_picks: number }> = {};
    for (const row of allRank || []) {
      const club = row.club_name || "미지정";
      if (!clubAgg[club]) clubAgg[club] = { total_streaks: 0, member_count: 0, total_picks: 0 };
      clubAgg[club].total_streaks += Number(row.streak_count || 0);
      clubAgg[club].member_count += 1;
      clubAgg[club].total_picks += Number(row.total_picks || 0);
    }

    result.clubOverall = Object.entries(clubAgg)
      .map(([club_name, values]) => ({
        club_name,
        total_streaks: values.total_streaks,
        member_count: values.member_count,
        total_picks: values.total_picks,
        avg_streak: values.member_count ? Number((values.total_streaks / values.member_count).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.avg_streak - a.avg_streak || b.total_streaks - a.total_streaks);

    return json(result);
  } catch (error) {
    console.error("streak-tracker error:", error);
    return json({ error: "스트릭 정보를 처리하는 중 오류가 발생했습니다." }, 500);
  }
});
