import { requireUserId } from './bibleStreakFeature';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, PATCH, OPTIONS',
};

const DEFAULT_NEON_DATA_API_URL = 'https://ep-empty-surf-az87wypd.apirest.c-3.ap-southeast-1.aws.neon.tech/neondb';

type Env = {
  NEON_JWKS_URL: string;
  NEON_AUTH_ISSUER?: string;
};

type RoleRow = { role: string };
type UserRow = { name?: string | null };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function dataApiUrl(path: string): string {
  return `${DEFAULT_NEON_DATA_API_URL}/rest/v1/${path}`;
}

async function dataApiRequest<T>(url: string, authorization: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('authorization', authorization);
  headers.set('accept', 'application/json');
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('[quiz-report] Data API error:', response.status, detail.slice(0, 300));
    throw new Error('Data API request failed');
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

async function hasManageRole(userId: string, authorization: string): Promise<boolean> {
  const roles = await dataApiRequest<RoleRow[]>(
    dataApiUrl(`user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}&limit=1`),
    authorization,
  );
  if (roles[0]?.role === 'teacher' || roles[0]?.role === 'chief') return true;

  const assignments = await dataApiRequest<RoleRow[]>(
    dataApiUrl(`user_role_assignments?select=role&user_id=eq.${encodeURIComponent(userId)}`),
    authorization,
  );
  return assignments.some((row) => row.role === 'teacher' || row.role === 'chief');
}

export async function handleQuizReport(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST' && request.method !== 'PATCH') return json({ error: 'Method not allowed' }, 405);

  try {
    const { userId, authorization } = await requireUserId(request, env);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;

    if (request.method === 'POST') {
      const questionText = typeof body.question_text === 'string' ? body.question_text.trim() : '';
      if (!questionText) return json({ error: '제보할 문제 정보가 없습니다.' }, 400);

      const users = await dataApiRequest<UserRow[]>(
        dataApiUrl(`user_roles?select=name&user_id=eq.${encodeURIComponent(userId)}&limit=1`),
        authorization,
      );
      const reporterName = users[0]?.name || '익명';
      const questionId = typeof body.question_id === 'string' && body.question_id ? body.question_id : null;
      const options = Array.isArray(body.question_options) ? body.question_options : null;
      const answer = typeof body.question_answer === 'string' && body.question_answer ? body.question_answer.slice(0, 500) : null;
      const reason = typeof body.reason === 'string' && body.reason ? body.reason.slice(0, 300) : null;

      await dataApiRequest<unknown>(dataApiUrl('quiz_question_reports'), authorization, {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          question_id: questionId,
          question_text: questionText.slice(0, 2000),
          question_options: options,
          question_answer: answer,
          reason,
          reporter_id: userId,
          reporter_name: reporterName,
          status: 'pending',
        }),
      });
      return json({ success: true });
    }

    if (!body.report_id) return json({ error: '제보 ID가 없습니다.' }, 400);
    if (!(await hasManageRole(userId, authorization))) {
      return json({ error: '교사 또는 부장만 제보를 처리할 수 있습니다.' }, 403);
    }

    const status = typeof body.status === 'string' && body.status ? body.status : 'resolved';
    await dataApiRequest<unknown>(
      dataApiUrl(`quiz_question_reports?id=eq.${encodeURIComponent(String(body.report_id))}`),
      authorization,
      { method: 'PATCH', body: JSON.stringify({ status }) },
    );
    return json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '제보 처리 중 오류가 발생했습니다.';
    const status = message === 'Unauthorized' || message.includes('token') || message.includes('signature') ? 401 : 500;
    console.error('[quiz-report] error:', message);
    return json({ error: status === 401 ? '로그인이 필요합니다.' : message }, status);
  }
}
