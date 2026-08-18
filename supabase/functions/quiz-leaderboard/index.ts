import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QuizScore {
  user_id: string;
  nickname: string;
  club_name: string;
  score: number;
  total_questions: number;
  correct_count: number;
  difficulty: string;
  topic?: string;
}

function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  return { start, end };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    );

    const url = new URL(req.url);

    // GET - 리더보드 조회
    if (req.method === 'GET') {
      const club = url.searchParams.get('club');
      const difficulty = url.searchParams.get('difficulty');
      const userId = url.searchParams.get('user_id');
      const monthly = url.searchParams.get('monthly') === 'true';
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);

      let bodyParams: Record<string, string> = {};
      try {
        if (req.body) {
          const cloned = req.clone();
          bodyParams = await cloned.json();
        }
      } catch { /* */ }

      const effectiveClub = club || bodyParams.club || null;
      const effectiveDifficulty = difficulty || bodyParams.difficulty || null;
      const effectiveUserId = userId || bodyParams.user_id || null;

      // user_roles에서 최신 club_name을 가져오기 위한 매핑
      const { data: allUserRoles } = await supabase
        .from('user_roles')
        .select('user_id, club')
        .eq('is_active', true);

      const clubMap = new Map<string, string>();
      if (allUserRoles) {
        for (const r of allUserRoles) {
          if (r.club) clubMap.set(r.user_id, r.club);
        }
      }

      // club enum -> Korean name 매핑
      const CLUB_NAME_MAP: Record<string, string> = {
        saeullim: '새울림',
        cheonjipoong: '천지풍',
        cheonjihu: '천지후',
        munhwabu: '문화부',
        cheonhwarae_cheongmyeong: '천화래와 청명',
      };

      let query = supabase.from('quiz_scores').select('*');

      if (effectiveClub) query = query.eq('club_name', effectiveClub);
      if (effectiveDifficulty) query = query.eq('difficulty', effectiveDifficulty);

      // Apply monthly filter
      if (monthly) {
        const { start, end } = getMonthRange();
        query = query.gte('created_at', start).lt('created_at', end);
      }

      const { data: allScores, error } = await query;
      if (error) throw error;

      // 특정 유저의 누적 통계
      if (effectiveUserId) {
        const userRows = (allScores || []).filter(r => r.user_id === effectiveUserId);
        const totalScore = userRows.reduce((sum, r) => sum + (r.score || 0), 0);
        const totalCorrect = userRows.reduce((sum, r) => sum + (r.correct_count || 0), 0);
        const totalQuestions = userRows.reduce((sum, r) => sum + (r.total_questions || 0), 0);
        const gamesPlayed = userRows.length;
        const bestScore = userRows.length > 0 ? Math.max(...userRows.map(r => r.score)) : 0;

        return new Response(JSON.stringify({
          user_id: effectiveUserId,
          total_score: totalScore,
          total_correct: totalCorrect,
          total_questions: totalQuestions,
          games_played: gamesPlayed,
          best_score: bestScore,
          accuracy: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
          monthly,
          sessions: userRows.sort((a: { created_at: string }, b: { created_at: string }) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          ),
        }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      // same user_id별 누적 합산 (최신 club_name은 user_roles에서 가져옴)
      const userCumulative = new Map<string, {
        user_id: string;
        nickname: string;
        club_name: string;
        total_score: number;
        total_correct: number;
        total_questions: number;
        games_played: number;
        best_score: number;
      }>();

      for (const row of (allScores || [])) {
        const existing = userCumulative.get(row.user_id);
        // user_roles에서 최신 club_name을 가져와 한글명으로 변환
        const latestClub = clubMap.get(row.user_id);
        const latestClubName = latestClub ? (CLUB_NAME_MAP[latestClub] || latestClub) : row.club_name;

        if (!existing) {
          userCumulative.set(row.user_id, {
            user_id: row.user_id,
            nickname: row.nickname,
            club_name: latestClubName || row.club_name,
            total_score: row.score || 0,
            total_correct: row.correct_count || 0,
            total_questions: row.total_questions || 0,
            games_played: 1,
            best_score: row.score || 0,
          });
        } else {
          existing.total_score += row.score || 0;
          existing.total_correct += row.correct_count || 0;
          existing.total_questions += row.total_questions || 0;
          existing.games_played += 1;
          if ((row.score || 0) > existing.best_score) {
            existing.best_score = row.score || 0;
          }
          if (row.nickname) existing.nickname = row.nickname;
          // 최신 club_name을 우선 사용
          existing.club_name = latestClubName || existing.club_name;
        }
      }

      const uniqueScores = [...userCumulative.values()]
        .sort((a, b) => b.total_score - a.total_score)
        .slice(0, limit);

      // 동아리별 집계 (최신 club_name 기준)
      const clubMap2 = new Map<string, {
        club_name: string;
        total_score: number;
        member_count: number;
        total_correct: number;
        total_questions: number;
      }>();

      for (const u of userCumulative.values()) {
        const cn = u.club_name;
        if (!clubMap2.has(cn)) {
          clubMap2.set(cn, {
            club_name: cn,
            total_score: 0,
            member_count: 0,
            total_correct: 0,
            total_questions: 0,
          });
        }
        const entry = clubMap2.get(cn)!;
        entry.total_score += u.total_score;
        entry.member_count += 1;
        entry.total_correct += u.total_correct;
        entry.total_questions += u.total_questions;
      }

      const clubRanking = [...clubMap2.values()]
        .map(c => ({
          ...c,
          avg_score: c.member_count > 0 ? Math.round(c.total_score / c.member_count) : 0,
          accuracy: c.total_questions > 0 ? Math.round((c.total_correct / c.total_questions) * 100) : 0,
        }))
        .sort((a, b) => b.total_score - a.total_score);

      const topClub = clubRanking.length > 0 ? clubRanking[0] : null;
      const topPlayer = uniqueScores.length > 0 ? uniqueScores[0] : null;

      return new Response(JSON.stringify({ scores: uniqueScores, clubRanking, topClub, topPlayer, monthly }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // POST - 점수 저장
    if (req.method === 'POST') {
      const body: QuizScore = await req.json();

      if (!body.user_id || !body.nickname || !body.club_name || body.score === undefined) {
        return new Response(JSON.stringify({ error: '필수 항목이 누락되었습니다.' }), {
          status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      const { data: inserted, error: insertError } = await supabase
        .from('quiz_scores')
        .insert({
          user_id: body.user_id,
          nickname: body.nickname,
          club_name: body.club_name,
          score: body.score,
          total_questions: body.total_questions || 8,
          correct_count: body.correct_count || 0,
          difficulty: body.difficulty || 'normal',
          topic: body.topic || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const { data: userAll } = await supabase
        .from('quiz_scores')
        .select('score, correct_count, total_questions')
        .eq('user_id', body.user_id);

      const cumulative = (userAll || []).reduce(
        (acc, r) => ({
          total_score: acc.total_score + (r.score || 0),
          total_correct: acc.total_correct + (r.correct_count || 0),
          total_questions: acc.total_questions + (r.total_questions || 0),
          games_played: acc.games_played + 1,
          accuracy: acc.total_questions + r.total_questions > 0
            ? Math.round(((acc.total_correct + r.correct_count) / (acc.total_questions + r.total_questions)) * 100)
            : 0,
        }),
        { total_score: 0, total_correct: 0, total_questions: 0, games_played: 0, accuracy: 0 }
      );

      return new Response(JSON.stringify({
        success: true,
        session: inserted,
        cumulative,
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // DELETE - 리더보드 초기화 (부장 전용)
    if (req.method === 'DELETE') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: '인증 정보가 없습니다.' }), {
          status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) {
        return new Response(JSON.stringify({ error: '인증에 실패했습니다.' }), {
          status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      // 호출자의 역할 확인 (기본 역할 + 추가 역할 전부 확인)
      const { data: roleRow } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      const { data: extraRoles } = await supabase
        .from('user_role_assignments')
        .select('role')
        .eq('user_id', user.id);

      const allRoles = [roleRow?.role, ...(extraRoles || []).map((r: { role: string }) => r.role)].filter(Boolean);
      const isChief = allRoles.includes('chief');

      if (!isChief) {
        return new Response(JSON.stringify({ error: '부장만 리더보드를 초기화할 수 있습니다.' }), {
          status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      const { error: deleteError } = await supabase
        .from('quiz_scores')
        .delete()
        .not('id', 'is', null);

      if (deleteError) throw deleteError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : '서버 오류';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});