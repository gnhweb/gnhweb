const CLUB_NAME_MAP: Record<string, string> = {
  saeullim: '새울림',
  cheonjipoong: '천지풍',
  cheonjihu: '천지후',
  munhwabu: '문화부',
  cheonhwarae_cheongmyeong: '천화래와 청명',
};

const DEFAULT_NEON_DATA_API_URL = 'https://ep-empty-surf-az87wypd.apirest.c-3.ap-southeast-1.aws.neon.tech/neondb';

type DataApiRow = Record<string, unknown>;

type Env = {
  NEON_JWKS_URL: string;
  NEON_AUTH_ISSUER?: string;
};

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
    console.error('[bible-streak] Data API error:', response.status, detail.slice(0, 300));
    throw new Error('Data API request failed');
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJsonPart(value: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value))) as Record<string, unknown>;
}

async function verifyJwt(token: string, env: Env): Promise<Record<string, unknown>> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const header = decodeJsonPart(parts[0]);
  const payload = decodeJsonPart(parts[1]);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error('Unsupported token');
  const exp = typeof payload.exp === 'number' ? payload.exp : 0;
  if (!exp || exp <= Math.floor(Date.now() / 1000)) throw new Error('Expired token');
  if (env.NEON_AUTH_ISSUER && payload.iss !== env.NEON_AUTH_ISSUER) throw new Error('Invalid issuer');

  const jwksResponse = await fetch(env.NEON_JWKS_URL, {
    headers: { accept: 'application/json' },
    cf: { cacheTtl: 300, cacheEverything: true },
  });
  if (!jwksResponse.ok) throw new Error('JWKS unavailable');
  const jwks = await jwksResponse.json() as { keys?: Array<Record<string, unknown>> };
  const jwk = jwks.keys?.find((key) => key.kid === header.kid && key.kty === 'RSA');
  if (!jwk) throw new Error('Signing key not found');
  const cryptoKey = await crypto.subtle.importKey('jwk', jwk as JsonWebKey, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, base64UrlToBytes(parts[2]), data);
  if (!valid) throw new Error('Invalid signature');
  return payload;
}

export async function requireUserId(request: Request, env: Env): Promise<{ userId: string; authorization: string }> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) throw new Error('Unauthorized');
  const token = authorization.slice('Bearer '.length).trim();
  const claims = await verifyJwt(token, env);
  const userId = typeof claims.sub === 'string' ? claims.sub : '';
  if (!userId) throw new Error('Unauthorized');
  return { userId, authorization };
}

export async function updateBibleStreak(userId: string, authorization: string): Promise<{ streak: number; maxStreak: number } | null> {
  if (!userId) return null;
  try {
    const today = new Date().toISOString().split('T')[0];
    const roles = await dataApiRequest<Array<{ club?: string }>>(
      dataApiUrl(`user_roles?select=club&user_id=eq.${encodeURIComponent(userId)}&limit=1`),
      authorization,
    );
    const club = roles[0]?.club;
    const clubName = club ? (CLUB_NAME_MAP[club] || club) : null;
    const existingRows = await dataApiRequest<DataApiRow[]>(
      dataApiUrl(`bible_streaks?select=*&user_id=eq.${encodeURIComponent(userId)}&limit=1`),
      authorization,
    );
    const existing = existingRows[0];

    if (existing) {
      const lastDate = existing.last_pick_date ? String(existing.last_pick_date).slice(0, 10) : null;
      const streakCount = Number(existing.streak_count || 0);
      const maxStreak = Number(existing.max_streak || 0);
      const totalPicks = Number(existing.total_picks || 0);
      if (lastDate === today) {
        if (clubName && clubName !== existing.club_name) {
          await dataApiRequest<unknown>(
            dataApiUrl(`bible_streaks?user_id=eq.${encodeURIComponent(userId)}`),
            authorization,
            { method: 'PATCH', body: JSON.stringify({ club_name: clubName, updated_at: new Date().toISOString() }) },
          );
        }
        return { streak: streakCount, maxStreak };
      }

      let newStreak = 1;
      if (lastDate) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        if (lastDate === yesterdayStr) newStreak = streakCount + 1;
      }
      const newMax = Math.max(newStreak, maxStreak);
      await dataApiRequest<unknown>(
        dataApiUrl(`bible_streaks?user_id=eq.${encodeURIComponent(userId)}`),
        authorization,
        { method: 'PATCH', body: JSON.stringify({ streak_count: newStreak, max_streak: newMax, last_pick_date: today, total_picks: totalPicks + 1, club_name: clubName || existing.club_name, updated_at: new Date().toISOString() }) },
      );
      return { streak: newStreak, maxStreak: newMax };
    }

    await dataApiRequest<unknown>(dataApiUrl('bible_streaks'), authorization, {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: userId, streak_count: 1, max_streak: 1, last_pick_date: today, total_picks: 1, club_name: clubName, updated_at: new Date().toISOString() }),
    });
    return { streak: 1, maxStreak: 1 };
  } catch (error) {
    console.error('[bible-streak] update error:', error);
    return null;
  }
}
