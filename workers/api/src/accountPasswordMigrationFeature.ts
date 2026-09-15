import { neon } from '@neondatabase/serverless';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const ALLOWED_ORIGINS = new Set([
  'https://gnhweb.vercel.app',
  'https://gnhweb.pages.dev',
  'https://gnhwebw.pages.dev',
  'https://gnhweb.gemini19840314.workers.dev',
]);

const BCRYPT_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

type MigrationEnv = Record<string, string | undefined>;

type MigrationBody = {
  email?: unknown;
  password?: unknown;
};

type LegacyPasswordMap = Record<string, string>;

function headers(origin: string) {
  const result = new Headers({
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
  });
  if (ALLOWED_ORIGINS.has(origin)) result.set('Access-Control-Allow-Origin', origin);
  return result;
}

function json(body: unknown, status: number, origin: string) {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) });
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, Buffer.from(salt, 'hex'), 64, {
    N: 16384,
    r: 16,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `${salt}:${Buffer.from(derived as Uint8Array).toString('hex')}`;
}

function getLegacyPasswordHash(env: MigrationEnv, email: string): string | null {
  const raw = String(env.LEGACY_SUPABASE_PASSWORDS || '').trim();
  if (!raw) return null;

  try {
    const map = JSON.parse(raw) as unknown;
    if (!map || typeof map !== 'object' || Array.isArray(map)) return null;
    const value = (map as LegacyPasswordMap)[email];
    return typeof value === 'string' && BCRYPT_PATTERN.test(value) ? value : null;
  } catch {
    return null;
  }
}

async function verifyLegacyPassword(
  sql: ReturnType<typeof neon>,
  legacyHash: string,
  password: string,
): Promise<boolean> {
  const rows = await sql<{ valid: boolean }[]>`
    SELECT crypt(${password}, ${legacyHash}) = ${legacyHash} AS valid
  `;
  return rows[0]?.valid === true;
}

export async function handleAccountPasswordMigration(
  req: Request,
  env: MigrationEnv,
): Promise<Response> {
  const origin = req.headers.get('Origin') || '';

  if (req.method === 'OPTIONS') {
    const responseHeaders = headers(origin);
    responseHeaders.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'content-type');
    return new Response(null, { status: 204, headers: responseHeaders });
  }

  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405, origin);
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: 'Forbidden' }, 403, origin);

  let body: MigrationBody;
  try {
    body = await req.json() as MigrationBody;
  } catch {
    return json({ error: 'Invalid request' }, 400, origin);
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const databaseUrl = String(env.DATABASE_URL || '').trim();

  if (!email || !password) return json({ error: 'Missing credentials' }, 400, origin);
  if (!databaseUrl) return json({ error: 'DATABASE_URL is not configured' }, 500, origin);

  try {
    const sql = neon(databaseUrl);
    const existing = await sql<{ id: string; password: string | null }[]>`
      SELECT a.id, a.password
      FROM neon_auth.account AS a
      INNER JOIN neon_auth."user" AS u ON u.id = a."userId"
      WHERE a."providerId" = 'credential'
        AND lower(u.email) = ${email}
      LIMIT 1
    `;

    if (!existing.length) return json({ error: 'Neon account not found' }, 404, origin);
    if (existing[0].password) return json({ status: 'already_migrated' }, 200, origin);

    const legacyHash = getLegacyPasswordHash(env, email);
    if (!legacyHash) return json({ error: 'Legacy password migration is not configured for this account' }, 500, origin);

    if (!(await verifyLegacyPassword(sql, legacyHash, password))) {
      return json({ error: 'Legacy credentials are invalid' }, 401, origin);
    }

    const passwordHash = await hashPassword(password);
    const updated = await sql<{ id: string }[]>`
      UPDATE neon_auth.account
      SET password = ${passwordHash}, "updatedAt" = now()
      WHERE id = ${existing[0].id}
        AND "providerId" = 'credential'
        AND password IS NULL
      RETURNING id
    `;

    return json(
      { status: updated.length ? 'migrated' : 'already_migrated' },
      200,
      origin,
    );
  } catch (error) {
    console.error('[account-password-migration] error', error);
    return json({ error: 'Account migration failed' }, 500, origin);
  }
}
