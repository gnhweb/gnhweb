import { neon } from '@neondatabase/serverless';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type WebAuthnCredential,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { requireUserId } from './bibleStreakFeature';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Cache-Control': 'no-store',
};

const RP_NAME = '강릉학생회';
const ALLOWED_RP_ORIGINS = new Set([
  'https://gnhwebw.pages.dev',
  'https://gnhweb.vercel.app',
]);
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function getWebAuthnConfig(request: Request): { rpID: string; origin: string } {
  const origin = request.headers.get('Origin')?.replace(/\/$/, '');
  if (!origin || !ALLOWED_RP_ORIGINS.has(origin)) {
    throw new Error('지원되지 않는 웹사이트 주소입니다. 공식 사이트에서 다시 시도해주세요.');
  }
  return { rpID: new URL(origin).hostname, origin };
}

type Env = {
  DATABASE_URL?: string;
  NEON_JWKS_URL: string;
  NEON_AUTH_ISSUER?: string;
};

type CredentialRow = {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  transports: string[];
  friendly_name: string | null;
  created_at: string;
  last_used_at: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToBase64Url(value: Uint8Array): string {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function getDatabase(env: Env) {
  const databaseUrl = String(env.DATABASE_URL || '').trim();
  if (!databaseUrl) throw new Error('DATABASE_URL is not configured');
  return neon(databaseUrl);
}

async function getCurrentUser(sql: ReturnType<typeof neon>, userId: string) {
  const result = await sql.query('SELECT id, name, email FROM neon_auth."user" WHERE id = $1 LIMIT 1', [userId]);
  return (result.rows as Array<{ id: string; name: string; email: string }>)[0] ?? null;
}

async function getCredentials(sql: ReturnType<typeof neon>, userId: string): Promise<CredentialRow[]> {
  const result = await sql.query(
    'SELECT id, user_id, credential_id, public_key, counter, transports, friendly_name, created_at, last_used_at FROM public.passkey_credentials WHERE user_id = $1 ORDER BY created_at ASC',
    [userId],
  );
  return result.rows as CredentialRow[];
}

async function consumeChallenge(sql: ReturnType<typeof neon>, userId: string, purpose: 'registration' | 'authentication') {
  const result = await sql.query(
    'SELECT id, challenge FROM public.passkey_challenges WHERE user_id = $1 AND purpose = $2 AND expires_at > now() ORDER BY created_at DESC LIMIT 1',
    [userId, purpose],
  );
  const row = (result.rows as Array<{ id: string; challenge: string }>)[0];
  if (!row) return null;
  await sql.query('DELETE FROM public.passkey_challenges WHERE id = $1', [row.id]);
  return row.challenge;
}

async function saveChallenge(sql: ReturnType<typeof neon>, userId: string, purpose: 'registration' | 'authentication', challenge: string) {
  await sql.query('DELETE FROM public.passkey_challenges WHERE user_id = $1 AND purpose = $2', [userId, purpose]);
  await sql.query(
    'INSERT INTO public.passkey_challenges (user_id, challenge, purpose, expires_at) VALUES ($1, $2, $3, $4)',
    [userId, challenge, purpose, new Date(Date.now() + CHALLENGE_TTL_MS).toISOString()],
  );
}

export async function handlePasskey(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { userId } = await requireUserId(request, env);
    const sql = getDatabase(env);
    const action = new URL(request.url).searchParams.get('action') || '';
    const webAuthnConfig = getWebAuthnConfig(request);

    if (request.method === 'GET' && action === 'list') {
      const credentials = await getCredentials(sql, userId);
      return json({ passkeys: credentials.map((credential) => ({
        id: credential.id,
        friendly_name: credential.friendly_name || undefined,
        created_at: credential.created_at,
        last_used_at: credential.last_used_at || undefined,
      })) });
    }

    if (request.method === 'POST' && action === 'register-options') {
      const user = await getCurrentUser(sql, userId);
      if (!user) return json({ error: '사용자 정보를 찾을 수 없습니다.' }, 404);
      const credentials = await getCredentials(sql, userId);
      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: webAuthnConfig.rpID,
        userID: new TextEncoder().encode(userId),
        userName: user.email,
        // 일부 Android/Samsung WebAuthn 구현은 name과 displayName이 다를 때
        // 등록 옵션을 비정상적으로 처리할 수 있어 안정적으로 동일한 값을 사용합니다.
        userDisplayName: user.email,
        attestationType: 'none',
        supportedAlgorithmIDs: [-7, -257],
        excludeCredentials: credentials.map((credential) => ({
          id: credential.credential_id,
          transports: credential.transports as AuthenticatorTransportFuture[],
        })),
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          // Android 플랫폼 인증기 호환성을 위해 discoverable credential은
          // required가 아닌 preferred로 요청합니다. userVerification은 반드시 요구합니다.
          residentKey: 'preferred',
          userVerification: 'required',
        },
      });
      await saveChallenge(sql, userId, 'registration', options.challenge);
      return json(options);
    }

    if (request.method === 'POST' && action === 'register-verify') {
      const body = await request.json() as { credential?: unknown; friendlyName?: unknown };
      const expectedChallenge = await consumeChallenge(sql, userId, 'registration');
      if (!expectedChallenge) return json({ error: '생체인증 등록 요청이 만료되었습니다. 다시 시도해주세요.' }, 400);

      const verification = await verifyRegistrationResponse({
        response: body.credential as RegistrationResponseJSON,
        expectedChallenge,
        expectedOrigin: webAuthnConfig.origin,
        expectedRPID: webAuthnConfig.rpID,
        requireUserVerification: true,
        supportedAlgorithmIDs: [-7, -257],
      });
      if (!verification.verified || !verification.registrationInfo) {
        return json({ error: '생체인증 등록을 확인하지 못했습니다.' }, 400);
      }

      const credential = verification.registrationInfo.credential;
      const transports = Array.isArray(credential.transports) ? credential.transports : [];
      const friendlyName = typeof body.friendlyName === 'string' && body.friendlyName.trim()
        ? body.friendlyName.trim().slice(0, 100)
        : null;

      await sql.query(
        'INSERT INTO public.passkey_credentials (user_id, credential_id, public_key, counter, transports, friendly_name) VALUES ($1, $2, $3, $4, $5, $6)',
        [userId, credential.id, bytesToBase64Url(credential.publicKey), credential.counter, transports, friendlyName],
      );
      return json({ passkey: { id: credential.id, friendly_name: friendlyName || undefined, created_at: new Date().toISOString() } });
    }

    if (request.method === 'POST' && action === 'auth-options') {
      const credentials = await getCredentials(sql, userId);
      if (!credentials.length) return json({ error: '등록된 생체인식이 없습니다.' }, 404);
      const options = await generateAuthenticationOptions({
        rpID: webAuthnConfig.rpID,
        userVerification: 'required',
        allowCredentials: credentials.map((credential) => ({
          id: credential.credential_id,
          transports: credential.transports as any,
        })),
      });
      await saveChallenge(sql, userId, 'authentication', options.challenge);
      return json(options);
    }

    if (request.method === 'POST' && action === 'auth-verify') {
      const body = await request.json() as { credential?: { id?: unknown } };
      const credentialId = typeof body.credential?.id === 'string' ? body.credential.id : '';
      if (!credentialId) return json({ error: '생체인증 응답이 올바르지 않습니다.' }, 400);
      const expectedChallenge = await consumeChallenge(sql, userId, 'authentication');
      if (!expectedChallenge) return json({ error: '생체인증 요청이 만료되었습니다. 다시 시도해주세요.' }, 400);

      const result = await sql.query(
        'SELECT id, user_id, credential_id, public_key, counter, transports, friendly_name, created_at, last_used_at FROM public.passkey_credentials WHERE user_id = $1 AND credential_id = $2 LIMIT 1',
        [userId, credentialId],
      );
      const stored = (result.rows as CredentialRow[])[0];
      if (!stored) return json({ error: '등록된 생체인증 정보를 찾을 수 없습니다.' }, 404);

      const credential: WebAuthnCredential = {
        id: stored.credential_id,
        publicKey: base64UrlToBytes(stored.public_key),
        counter: Number(stored.counter),
        transports: stored.transports as AuthenticatorTransportFuture[],
      };
      const verification = await verifyAuthenticationResponse({
        response: body.credential as AuthenticationResponseJSON,
        expectedChallenge,
        expectedOrigin: webAuthnConfig.origin,
        expectedRPID: webAuthnConfig.rpID,
        credential,
        requireUserVerification: true,
      });
      if (!verification.verified) return json({ error: '생체인증에 실패했습니다.' }, 401);

      await sql.query(
        'UPDATE public.passkey_credentials SET counter = $1, last_used_at = now(), updated_at = now() WHERE id = $2',
        [verification.authenticationInfo.newCounter, stored.id],
      );
      return json({ verified: true });
    }

    if (request.method === 'DELETE' && action === 'delete') {
      const body = await request.json() as { id?: unknown };
      const id = typeof body.id === 'string' ? body.id : '';
      if (!id) return json({ error: '생체인증 정보를 지정해주세요.' }, 400);
      const result = await sql.query(
        'DELETE FROM public.passkey_credentials WHERE id = $1 AND user_id = $2 RETURNING id',
        [id, userId],
      );
      if (!result.rows.length) return json({ error: '생체인증 정보를 찾을 수 없습니다.' }, 404);
      return json({ success: true });
    }

    return json({ error: 'Not Found' }, 404);
  } catch (error) {
    console.error('[passkey] error:', error);
    const message = error instanceof Error ? error.message : '서버 오류';
    const status = message === 'Unauthorized' || message.includes('token') || message.includes('signature') ? 401 : 500;
    return json({ error: message }, status);
  }
}
