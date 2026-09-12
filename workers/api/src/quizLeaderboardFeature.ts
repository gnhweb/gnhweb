import { requireUserId, updateBibleStreak } from './bibleStreakFeature';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
};

const DEFAULT_NEON_DATA_API_URL = 'https://ep-empty-surf-az87wypd.apirest.c-3.ap-southeast-1.aws.neon.tech/neondb';
const CLUB_NAME_MAP: Record<string, string> = {
  saeullim: '새울림',
  cheonjipoong: '천지풍',
  cheonjihu: '천지후',
  munhwabu: '문화부',
  cheonhwarae_cheongmyeong: '천화래와 청명',
};

type Env = {
  NEON_JWKS_URL: string;
  NEON_AUTH_ISSUER?: string;
};

type QuizScore = {
  user_id: string;
  nickname: string;
  club_name: string;
  score: number;
  total_questions?: number;
  correct_count?: number;
  difficulty?: string;
  topic?: string;
};

type ScoreRow = QuizScore & { id: string; created_at: string };

type RoleRow = { user_id: string; club?: string; role?: string; is_active?: boolean };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

function dataApiUrl(path: string): string {
  return `${DEFAULT_NEON_DATA_API_URL}/rest/v1/${path}`;
}

async function dataApiRequest<T>(url: string, authorization = '', init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (authorization) headers.set('authorization', authorization);
  headers.set('accept', 'application/json');
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('[quiz-leaderboard] Data API error:', response.status, detail.slice(0, 300));
    throw new Error('Data API request failed');
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

function getMonthRange() {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
  };
}

function withScoreFilters(params: URLSearchParams): string {
  const filters: string[] = [];
  const club = params.get('club');
  const difficulty = params.get('difficulty');
  const monthly = params.get('monthly') === 'true';
  if (club) filters.push(`club_name=eq.${encodeURIComponent(club)}`);
  if (difficulty) filters.push(`difficulty=eq.${encodeURIComponent(difficulty)}`);
  if (monthly) {
    const { start, end } = getMonthRange();
    filters.push(`created_at=gte.${encodeURIComponent(start)}`);
    filters.push(`created_at=lt.${encodeURIComponent(end)}`);
  }
  return filters.length ? `&${filters.join('&')}` : '';
}

export async function handleQuizLeaderboard(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const url = new URL(request.url);
    const authorization = request.headers.get('authorization') || '';

    if (request.method === 'GET') {
      const requestedUserId = url.searchParams.get('user_id');
      const monthly = url.searchParams.get('monthly') === 'true';
      const limitValue = Number.parseInt(url.searchParams.get('limit') || '50', 10);
      const limit = Math.min(Number.isFinite(limitValue) ? Math.max(limitValue, 1) : 50, 100);
      let effectiveUserId: string | null = null;
      if (requestedUserId) {
        if (!authorization) return json({ error: '인증 정보가 없습니다.' }, 401);
        const auth = await requireUserId(request, env);
        if (auth.userId !== requestedUserId) return json({ error: '본인의 기록만 조회할 수 있습니다.' }, 403);
        effectiveUserId = auth.userId;
      }

      const allUserRoles = await dataApiRequest<RoleRow[]>(
        dataApiUrl('user_roles?select=user_id,club&is_active=eq.true'),
        authorization,
      );
      const clubMap = new Map<string, string>();
      for (const role of allUserRoles) {
        if (role.club) clubMap.set(role.user_id, role.club);
      }

      const scoreRows = await dataApiRequest<ScoreRow[]>(
        dataApiUrl(`quiz_scores?select=*&order=created_at.desc${withScoreFilters(url.searchParams)}`),
        authorization,
      );

      if (effectiveUserId) {
        const userRows = scoreRows.filter((row) => row.user_id === effectiveUserId);
        const totalScore = userRows.reduce((sum, row) => sum + (row.score || 0), 0);
        const totalCorrect = userRows.reduce((sum, row) => sum + (row.correct_count || 0), 0);
        const totalQuestions = userRows.reduce((sum, row) => sum + (row.total_questions || 0), 0);
        const bestScore = userRows.length ? Math.max(...userRows.map((row) => row.score)) : 0;
        return json({
          user_id: effectiveUserId,
          total_score: totalScore,
          total_correct: totalCorrect,
          total_questions: totalQuestions,
          games_played: userRows.length,
          best_score: bestScore,
          accuracy: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
          monthly,
          sessions: userRows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
        });
      }

      const userCumulative = new Map<string, { user_id: string; nickname: string; club_name: string; total_score: number; total_correct: number; total_questions: number; games_played: number; best_score: number }>();
      for (const row of scoreRows) {
        const latestClub = clubMap.get(row.user_id);
        const latestClubName = latestClub ? (CLUB_NAME_MAP[latestClub] || latestClub) : row.club_name;
        const existing = userCumulative.get(row.user_id);
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
          existing.best_score = Math.max(existing.best_score, row.score || 0);
          if (row.nickname) existing.nickname = row.nickname;
          existing.club_name = latestClubName || existing.club_name;
        }
      }

      const uniqueScores = [...userCumulative.values()].sort((a, b) => b.total_score - a.total_score).slice(0, limit);
      const clubMap2 = new Map<string, { club_name: string; total_score: number; member_count: number; total_correct: number; total_questions: number }>();
      for (const user of userCumulative.values()) {
        const existing = clubMap2.get(user.club_name) || { club_name: user.club_name, total_score: 0, member_count: 0, total_correct: 0, total_questions: 0 };
        existing.total_score += user.total_score;
        existing.member_count += 1;
        existing.total_correct += user.total_correct;
        existing.total_questions += user.total_questions;
        clubMap2.set(user.club_name, existing);
      }
      const clubRanking = [...clubMap2.values()]
        .map((club) => ({ ...club, avg_score: club.member_count ? Math.round(club.total_score / club.member_count) : 0, accuracy: club.total_questions ? Math.round((club.total_correct / club.total_questions) * 100) : 0 }))
        .sort((a, b) => b.total_score - a.total_score);

      return json({
        scores: uniqueScores,
        clubRanking,
        topClub: clubRanking[0] || null,
        topPlayer: uniqueScores[0] || null,
        monthly,
      });
    }

    if (request.method === 'POST') {
      const { userId, authorization: userAuthorization } = await requireUserId(request, env);
      const body = await request.json().catch(() => ({})) as Partial<QuizScore>;
      if (!body.nickname || !body.club_name || body.score === undefined) {
        return json({ error: '필수 항목이 누락되었습니다.' }, 400);
      }
      const sessionRows = await dataApiRequest<ScoreRow[]>(dataApiUrl('quiz_scores'), userAuthorization, {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          user_id: userId,
          nickname: body.nickname,
          club_name: body.club_name,
          score: body.score,
          total_questions: body.total_questions || 8,
          correct_count: body.correct_count || 0,
          difficulty: body.difficulty || 'normal',
          topic: body.topic || null,
        }),
      });
      const userAll = await dataApiRequest<Array<Pick<ScoreRow, 'score' | 'correct_count' | 'total_questions'>>>(
        dataApiUrl(`quiz_scores?select=score,correct_count,total_questions&user_id=eq.${encodeURIComponent(userId)}`),
        userAuthorization,
      );
      const cumulative = userAll.reduce((acc, row) => ({
        total_score: acc.total_score + (row.score || 0),
        total_correct: acc.total_correct + (row.correct_count || 0),
        total_questions: acc.total_questions + (row.total_questions || 0),
        games_played: acc.games_played + 1,
        accuracy: acc.total_questions + (row.total_questions || 0) > 0
          ? Math.round(((acc.total_correct + (row.correct_count || 0)) / (acc.total_questions + (row.total_questions || 0))) * 100)
          : 0,
      }), { total_score: 0, total_correct: 0, total_questions: 0, games_played: 0, accuracy: 0 });
      const streak = await updateBibleStreak(userId, userAuthorization);
      return json({ success: true, session: sessionRows[0] || null, cumulative, streak: streak || undefined });
    }

    if (request.method === 'DELETE') {
      const { userId, authorization: userAuthorization } = await requireUserId(request, env);
      const roles = await dataApiRequest<RoleRow[]>(
        dataApiUrl(`user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}&limit=1`),
        userAuthorization,
      );
      const assignments = await dataApiRequest<Array<{ role: string }>>(
        dataApiUrl(`user_role_assignments?select=role&user_id=eq.${encodeURIComponent(userId)}`),
        userAuthorization,
      );
      const isChief = roles[0]?.role === 'chief' || assignments.some((role) => role.role === 'chief');
      if (!isChief) return json({ error: '부장만 리더보드를 초기화할 수 있습니다.' }, 403);
      await dataApiRequest<unknown>(dataApiUrl('quiz_scores?id=not.is.null'), userAuthorization, { method: 'DELETE' });
      return json({ success: true });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (error) {
    const message = error instanceof Error ? error.message : '서버 오류';
    const status = message === 'Unauthorized' || message.includes('token') || message.includes('signature') ? 401 : 500;
    console.error('[quiz-leaderboard] error:', message);
    return json({ error: message }, status);
  }
}
