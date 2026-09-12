const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEFAULT_NEON_AUTH_URL = 'https://ep-empty-surf-az87wypd.neonauth.c-3.ap-southeast-1.aws.neon.tech/neondb/auth';
const DEFAULT_NEON_DATA_API_URL = 'https://ep-empty-surf-az87wypd.apirest.c-3.ap-southeast-1.aws.neon.tech/neondb';

type Env = {
  NEON_AUTH_URL?: string;
  NEON_DATA_API_URL?: string;
};

type SignUpResponse = {
  token?: string;
  user?: { id?: string };
  session?: { token?: string };
};

type ExistingChief = { user_id: string; name: string | null };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function dataApiUrl(env: Env, path: string): string {
  const base = (env.NEON_DATA_API_URL || DEFAULT_NEON_DATA_API_URL).replace(/\/$/, '');
  return `${base}/rest/v1/${path}`;
}

async function dataApiRequest<T>(env: Env, path: string, authorization: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('authorization', authorization);
  headers.set('accept', 'application/json');
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');

  const response = await fetch(dataApiUrl(env, path), { ...init, headers });
  const text = await response.text();
  if (!response.ok) {
    console.error('[setup-chief] Data API error:', response.status, text.slice(0, 300));
    throw new Error('Data API request failed');
  }
  return (text ? JSON.parse(text) : null) as T;
}

async function signUpChief(env: Env, email: string, password: string, name: string): Promise<SignUpResponse> {
  const base = (env.NEON_AUTH_URL || DEFAULT_NEON_AUTH_URL).replace(/\/$/, '');
  const response = await fetch(`${base}/sign-up/email`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ name, email, password }),
  });
  const text = await response.text();
  let data: SignUpResponse = {};
  try {
    data = text ? JSON.parse(text) as SignUpResponse : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    const message = typeof (data as { message?: unknown }).message === 'string'
      ? (data as { message: string }).message
      : '계정 생성에 실패했습니다';
    throw new Error(message);
  }
  return data;
}

export async function handleSetupChief(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const gender = typeof body.gender === 'string' && body.gender.trim() ? body.gender.trim() : null;

    if (!email || !password || !name) {
      return json({ error: '이메일, 비밀번호, 이름을 모두 입력해주세요' }, 400);
    }
    if (password.length < 8) return json({ error: '비밀번호는 8자 이상이어야 합니다' }, 400);
    if (password.length > 128) return json({ error: '비밀번호는 128자 이하이어야 합니다' }, 400);

    // Neon Auth's email/password signup is the supported HTTP creation path.
    // The resulting JWT is then used for the user's own user_roles insert, which
    // matches the existing RLS policy for first-time account setup.
    const authData = await signUpChief(env, email, password, name);
    const jwt = authData.token || authData.session?.token;
    const userId = authData.user?.id;
    if (!jwt || !userId) return json({ error: '사용자 생성 응답이 올바르지 않습니다' }, 500);

    const authorization = `Bearer ${jwt}`;

    const existingChief = await dataApiRequest<ExistingChief[]>(
      env,
      'user_roles?select=user_id,name&role=eq.chief&is_active=eq.true&limit=1',
      authorization,
    );
    if (existingChief.length > 0) {
      return json({ error: `이미 부장 계정이 존재합니다: ${existingChief[0].name || '이름 없음'}` }, 400);
    }

    try {
      await dataApiRequest<unknown>(env, 'user_roles', authorization, {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          user_id: userId,
          role: 'chief',
          name,
          club: null,
          zone: null,
          gender,
          is_active: true,
        }),
      });
    } catch (roleError) {
      // Neon Auth user deletion is intentionally not attempted here: the managed
      // Auth HTTP surface does not expose an unauthenticated admin-delete path.
      // Returning the failure avoids claiming a rollback that cannot be guaranteed.
      console.error('[setup-chief] role insert failed:', roleError);
      return json({ error: '권한 설정 중 오류가 발생했습니다. 생성된 계정은 로그인하지 말고 관리자 확인이 필요합니다.' }, 500);
    }

    return json({
      success: true,
      message: '부장 계정이 성공적으로 생성되었습니다. 로그인 페이지로 이동합니다.',
      email,
      name,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '서버 오류가 발생했습니다';
    console.error('[setup-chief] error:', message);
    return json({ error: message }, 500);
  }
}
