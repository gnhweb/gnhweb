const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

const CLUB_LABEL_MAP: Record<string, string> = {
  saeullim: '새울림',
  cheonjipoong: '천지풍',
  cheonjihu: '천지후',
  munhwabu: '문화부',
  cheonhwarae_cheongmyeong: '천화래와 청명',
};

interface ChampionRow {
  year: number;
  month: number;
  category: 'quiz' | 'marathon';
  club_key: string;
  club_label: string;
  value: number;
  extra: Record<string, unknown> | null;
}

const DATA_API_URL = 'https://ep-empty-surf-az87wypd.apirest.c-3.ap-southeast-1.aws.neon.tech/neondb';

async function neonRequest<T>(env: Record<string, string | undefined>, path: string, init?: RequestInit): Promise<T> {
  const url = `${env.NEON_DATA_API_URL || DATA_API_URL}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(env.NEON_DATA_API_KEY ? { Authorization: `Bearer ${env.NEON_DATA_API_KEY}` } : {}),
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`Neon Data API ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, ...NO_CACHE_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function computeQuizChampion(env: Record<string, string | undefined>, year: number, month: number, start: string, end: string): Promise<ChampionRow | null> {
  const query = `?select=user_id,nickname,club_name,score,correct_count,total_questions,created_at&created_at=gte.${encodeURIComponent(start)}&created_at=lt.${encodeURIComponent(end)}`;
  const allScores = await neonRequest<Array<{ user_id: string; nickname: string; club_name: string; score: number | null }>>(env, `/quiz_scores${query}`);
  if (!allScores.length) return null;

  const roles = await neonRequest<Array<{ user_id: string; club: string | null }>>(env, `/user_roles?select=user_id,club&is_active=eq.true`);
  const clubMap = new Map<string, string>();
  roles.forEach((r) => { if (r.club) clubMap.set(r.user_id, r.club); });

  const userTotals = new Map<string, { nickname: string; club_name: string; total_score: number }>();
  const clubTotals = new Map<string, number>();
  for (const row of allScores) {
    const latestClub = clubMap.get(row.user_id);
    const clubName = latestClub ? (CLUB_LABEL_MAP[latestClub] || latestClub) : row.club_name;
    const current = userTotals.get(row.user_id);
    if (!current) userTotals.set(row.user_id, { nickname: row.nickname, club_name: clubName, total_score: row.score || 0 });
    else {
      current.total_score += row.score || 0;
      current.club_name = clubName;
      if (row.nickname) current.nickname = row.nickname;
    }
  }
  for (const user of userTotals.values()) clubTotals.set(user.club_name, (clubTotals.get(user.club_name) || 0) + user.total_score);
  const topClub = [...clubTotals.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!topClub) return null;
  const topPlayer = [...userTotals.values()].sort((a, b) => b.total_score - a.total_score)[0] || null;
  return {
    year, month, category: 'quiz', club_key: topClub[0], club_label: topClub[0], value: topClub[1],
    extra: topPlayer ? { topPlayerNickname: topPlayer.nickname, topPlayerClub: topPlayer.club_name, topPlayerScore: topPlayer.total_score } : null,
  };
}

async function computeMarathonChampion(env: Record<string, string | undefined>, year: number, month: number, start: string, end: string): Promise<ChampionRow | null> {
  const query = `?select=student_club,book,chapter_start,chapter_end,status,confirmed_at&status=eq.confirmed&confirmed_at=gte.${encodeURIComponent(start)}&confirmed_at=lt.${encodeURIComponent(end)}`;
  const data = await neonRequest<Array<{ student_club: string | null; book: string; chapter_start: number | null; chapter_end: number | null }>>(env, `/bible_marathon_entries${query}`);
  if (!data.length) return null;
  const clubChapterSets = new Map<string, Set<string>>();
  data.forEach((entry) => {
    if (!entry.student_club) return;
    const startCh = entry.chapter_start ?? 1;
    const endCh = entry.chapter_end ?? startCh;
    if (!clubChapterSets.has(entry.student_club)) clubChapterSets.set(entry.student_club, new Set());
    const set = clubChapterSets.get(entry.student_club)!;
    for (let chapter = startCh; chapter <= endCh; chapter++) set.add(`${entry.book}:${chapter}`);
  });
  const ranked = [...clubChapterSets.entries()].map(([club, set]) => ({ club, chapters: set.size })).sort((a, b) => b.chapters - a.chapters);
  if (!ranked.length) return null;
  const top = ranked[0];
  return { year, month, category: 'marathon', club_key: top.club, club_label: CLUB_LABEL_MAP[top.club] || top.club, value: top.chapters, extra: null };
}

export async function handleMonthlyChampionSnapshot(request: Request, env: Record<string, string | undefined>): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: { ...CORS_HEADERS, ...NO_CACHE_HEADERS } });
  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get('mode') || 'latest';
    if (mode === 'finalize') {
      const year = Number.parseInt(url.searchParams.get('year') || '', 10);
      const month = Number.parseInt(url.searchParams.get('month') || '', 10);
      const start = url.searchParams.get('start');
      const end = url.searchParams.get('end');
      if (!year || !month || !start || !end) return jsonResponse({ error: 'year, month, start, end가 모두 필요합니다.' }, 400);
      const [quizChampion, marathonChampion] = await Promise.all([
        computeQuizChampion(env, year, month, start, end),
        computeMarathonChampion(env, year, month, start, end),
      ]);
      const rows = [quizChampion, marathonChampion].filter((row): row is ChampionRow => row !== null);
      if (rows.length) {
        await neonRequest(env, '/club_monthly_champions', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(rows) });
      }
      const finalized = await neonRequest<ChampionRow[]>(env, `/club_monthly_champions?select=*&year=eq.${year}&month=eq.${month}`);
      return jsonResponse({ year, month, records: finalized });
    }
    if (mode === 'latest') {
      const results: Record<string, unknown> = {};
      for (const category of ['quiz', 'marathon'] as const) {
        const rows = await neonRequest<ChampionRow[]>(env, `/club_monthly_champions?select=*&category=eq.${category}&order=year.desc,month.desc&limit=1`);
        results[category] = rows[0] || null;
      }
      return jsonResponse(results);
    }
    if (mode === 'list') {
      const parsedLimit = Number.parseInt(url.searchParams.get('limit') || '60', 10);
      const limit = Math.min(Number.isFinite(parsedLimit) ? parsedLimit : 60, 200);
      const records = await neonRequest<ChampionRow[]>(env, `/club_monthly_champions?select=*&order=year.desc,month.desc&limit=${limit}`);
      return jsonResponse({ records });
    }
    return jsonResponse({ error: '알 수 없는 mode 입니다.' }, 400);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : '서버 오류' }, 500);
  }
}
