// deno-lint-ignore-file no-explicit-any
// 말씀 스트릭(연속 일수) 업데이트 공통 로직.
//
// 예전에는 "말씀뽑기"(bible-pick)를 할 때만 스트릭이 올라갔지만,
// 이제는 "성경완독"(bible_marathon_entries가 confirmed 될 때)과
// "성경퀴즈"(quiz_scores에 응시 기록이 쌓일 때) 두 활동으로만 스트릭이 오른다.
// 같은 날 두 활동을 모두 해도 하루에 한 번만 증가한다 — 이미 오늘 날짜로
// 기록되어 있으면(last_pick_date === today) 그대로 반환하고 건너뛴다.
// 동아리 enum -> 한글명 매핑 (quiz-leaderboard와 동일 기준)
const CLUB_NAME_MAP: Record<string, string> = {
  saeullim: '새울림',
  cheonjipoong: '천지풍',
  cheonjihu: '천지후',
  munhwabu: '문화부',
  cheonhwarae_cheongmyeong: '천화래와 청명',
};

export async function updateBibleStreak(
  supabase: any,
  userId: string,
): Promise<{ streak: number; maxStreak: number } | null> {
  if (!userId) return null;

  try {
    const today = new Date().toISOString().split('T')[0];

    // 동아리 랭킹 집계용 — 매번 최신 소속으로 갱신 (동아리 변경 시에도 정확히 반영)
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('club')
      .eq('user_id', userId)
      .maybeSingle();
    const clubName = roleRow?.club ? (CLUB_NAME_MAP[roleRow.club] || roleRow.club) : null;

    const { data: existing } = await supabase
      .from('bible_streaks')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      const lastDate = existing.last_pick_date
        ? new Date(existing.last_pick_date).toISOString().split('T')[0]
        : null;

      if (lastDate === today) {
        // 오늘 이미 다른 활동(완독 또는 퀴즈)으로 스트릭이 반영됨 — 중복 증가 방지
        if (clubName && clubName !== existing.club_name) {
          await supabase.from('bible_streaks').update({ club_name: clubName }).eq('user_id', userId);
        }
        return { streak: existing.streak_count, maxStreak: existing.max_streak };
      }

      if (lastDate) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const isConsecutive = lastDate === yesterdayStr;
        const newStreak = isConsecutive ? existing.streak_count + 1 : 1;
        const newMax = Math.max(newStreak, existing.max_streak);
        await supabase.from('bible_streaks').update({
          streak_count: newStreak,
          max_streak: newMax,
          last_pick_date: today,
          total_picks: existing.total_picks + 1,
          club_name: clubName || existing.club_name,
          updated_at: new Date().toISOString(),
        }).eq('user_id', userId);
        return { streak: newStreak, maxStreak: newMax };
      }

      await supabase.from('bible_streaks').update({
        streak_count: 1,
        max_streak: Math.max(1, existing.max_streak),
        last_pick_date: today,
        total_picks: existing.total_picks + 1,
        club_name: clubName || existing.club_name,
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId);
      return { streak: 1, maxStreak: Math.max(1, existing.max_streak) };
    }

    await supabase.from('bible_streaks').insert({
      user_id: userId,
      streak_count: 1,
      max_streak: 1,
      last_pick_date: today,
      total_picks: 1,
      club_name: clubName,
      updated_at: new Date().toISOString(),
    });
    return { streak: 1, maxStreak: 1 };
  } catch (err) {
    console.error('updateBibleStreak error:', err);
    return null;
  }
}
