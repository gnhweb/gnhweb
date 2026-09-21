export interface Env {
  STORAGE: R2Bucket;
  ALLOWED_ORIGIN: string;
  NEON_JWKS_URL: string;
  NEON_AUTH_ISSUER?: string;
}

const DEFAULT_NEON_DATA_API_URL = 'https://ep-empty-surf-az87wypd.apirest.c-3.ap-southeast-1.aws.neon.tech/neondb';
const json = (body: unknown, status = 200, headers: HeadersInit = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });
function corsHeaders(origin: string, allowedOrigins: string, requestedHeaders?: string | null): HeadersInit {
  const origins = allowedOrigins.split(',').map(v => v.trim()).filter(Boolean);
  const normalizedOrigin = origin.trim();
  const isAllowedPagesPreview = /^https:\/\/(?:[^./]+\.)+gnhwebw?\.pages\.dev$/.test(normalizedOrigin);
  const isAllowedOrigin = normalizedOrigin && (origins.includes(normalizedOrigin) || isAllowedPagesPreview);
  // The frontend uses Bearer Authorization with credentials: 'omit', so a
  // wildcard fallback is valid and prevents browser uploads from being
  // blocked when Cloudflare Pages serves a deployment/custom origin that is
  // not present in the static allow-list.
  const allowOrigin = isAllowedOrigin ? normalizedOrigin : '*';
  const allowHeaders = requestedHeaders?.trim() || 'Authorization,Content-Type,Cache-Control,X-Upsert';
  return {
    'access-control-allow-origin': allowOrigin,
    'access-control-allow-credentials': 'false',
    'access-control-allow-methods': 'GET,PUT,DELETE,OPTIONS',
    'access-control-allow-headers': allowHeaders,
    'access-control-max-age': '86400',
    'access-control-expose-headers': 'ETag,Content-Type',
    vary: 'Origin, Access-Control-Request-Headers',
  };
}
function base64UrlToBytes(value: string): Uint8Array { const normalized = value.replace(/-/g, '+').replace(/_/g, '/'); const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='); const binary = atob(padded); return Uint8Array.from(binary, c => c.charCodeAt(0)); }
function decodeJsonPart(value: string): Record<string, unknown> { return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value))) as Record<string, unknown>; }
async function verifyJwt(token: string, env: Env): Promise<Record<string, unknown>> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const header = decodeJsonPart(parts[0]);
  const payload = decodeJsonPart(parts[1]);
  const alg = typeof header.alg === 'string' ? header.alg : '';
  const kid = typeof header.kid === 'string' ? header.kid : '';
  const exp = typeof payload.exp === 'number' ? payload.exp : 0;
  if (!exp || exp <= Math.floor(Date.now() / 1000)) throw new Error('Expired token');
  if (env.NEON_AUTH_ISSUER && payload.iss !== env.NEON_AUTH_ISSUER) throw new Error('Invalid issuer');
  const jwksResponse = await fetch(env.NEON_JWKS_URL, { headers: { accept: 'application/json' }, cf: { cacheTtl: 300, cacheEverything: true } });
  if (!jwksResponse.ok) throw new Error('JWKS unavailable');
  const jwks = await jwksResponse.json() as { keys?: Array<Record<string, unknown>> };
  const candidates = (jwks.keys ?? []).filter(key => {
    if (typeof key.kid === 'string' && kid && key.kid !== kid) return false;
    return typeof key.alg !== 'string' || key.alg === alg;
  });
  const jwk = candidates.length === 1 ? candidates[0] : candidates.find(key => key.kid === kid);
  if (!jwk) throw new Error('Signing key not found');

  let importAlgorithm: AlgorithmIdentifier;
  let verifyAlgorithm: AlgorithmIdentifier;
  if (alg === 'RS256') {
    importAlgorithm = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
    verifyAlgorithm = importAlgorithm;
  } else if (alg === 'RS384') {
    importAlgorithm = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-384' };
    verifyAlgorithm = importAlgorithm;
  } else if (alg === 'RS512') {
    importAlgorithm = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' };
    verifyAlgorithm = importAlgorithm;
  } else if (alg === 'PS256') {
    importAlgorithm = { name: 'RSA-PSS', hash: 'SHA-256' };
    verifyAlgorithm = { name: 'RSA-PSS', saltLength: 32 };
  } else if (alg === 'PS384') {
    importAlgorithm = { name: 'RSA-PSS', hash: 'SHA-384' };
    verifyAlgorithm = { name: 'RSA-PSS', saltLength: 48 };
  } else if (alg === 'PS512') {
    importAlgorithm = { name: 'RSA-PSS', hash: 'SHA-512' };
    verifyAlgorithm = { name: 'RSA-PSS', saltLength: 64 };
  } else if (alg === 'ES256' || alg === 'ES384' || alg === 'ES512') {
    const hash = alg === 'ES256' ? 'SHA-256' : alg === 'ES384' ? 'SHA-384' : 'SHA-512';
    const namedCurve = alg === 'ES256' ? 'P-256' : alg === 'ES384' ? 'P-384' : 'P-521';
    importAlgorithm = { name: 'ECDSA', namedCurve };
    verifyAlgorithm = { name: 'ECDSA', hash };
  } else if (alg === 'EdDSA') {
    importAlgorithm = { name: 'Ed25519' };
    verifyAlgorithm = { name: 'Ed25519' };
  } else {
    throw new Error('Unsupported token');
  }

  const cryptoKey = await crypto.subtle.importKey('jwk', jwk as JsonWebKey, importAlgorithm, false, ['verify']);
  const data = new TextEncoder().encode(parts[0] + '.' + parts[1]);
  const valid = await crypto.subtle.verify(verifyAlgorithm, cryptoKey, base64UrlToBytes(parts[2]), data);
  if (!valid) throw new Error('Invalid signature');
  return payload;
}
async function requireAuth(request: Request, env: Env): Promise<Record<string, unknown>> { const authorization = request.headers.get('authorization'); if (!authorization?.startsWith('Bearer ')) throw new Error('Unauthorized'); return verifyJwt(authorization.slice('Bearer '.length).trim(), env); }
function objectKey(request: Request): string | null { const url = new URL(request.url); const prefix = '/v1/storage/'; if (!url.pathname.startsWith(prefix)) return null; const key = decodeURIComponent(url.pathname.slice(prefix.length)); return key || null; }
function objectResponse(object: R2ObjectBody, origin: string, env: Env): Response { const headers = new Headers(corsHeaders(origin, env.ALLOWED_ORIGIN)); object.writeHttpMetadata(headers); headers.set('etag', object.httpEtag); headers.set('cache-control', 'public, max-age=31536000, immutable'); return new Response(object.body, { headers }); }
function toStorageItem(object: R2Object, name = object.key): Record<string, unknown> { return { name, id: object.httpEtag, metadata: { size: object.size, mimetype: object.httpMetadata?.contentType, lastModified: object.uploaded.toISOString() }, created_at: object.uploaded.toISOString() }; }
function isOwnMemoryPath(path: string, userId: string): boolean { return path.startsWith(`memories/${userId}/`); }
function isMissionProofPath(path: string): boolean { return path.startsWith('missions/proof/'); }
function missionProofAssignmentId(path: string): string | null { if (!isMissionProofPath(path)) return null; const match = path.match(/^missions\/proof\/(?:[^/]+\/)?(\d+)_/); return match?.[1] ?? null; }
function isOwnNotebookPath(path: string, userId: string): boolean { return path.startsWith(`${userId}/`); }
function notebookStorageKey(path: string): string { return `notebook-files/${path.replace(/^notebook-files\//, '')}`; }
function isOwnAvatarPath(path: string, userId: string): boolean { return path.startsWith(`avatars/${userId}-`); }
function isOperationalStaffPath(path: string): boolean { return path.startsWith('news/') || path.startsWith('banners/') || path.startsWith('club-banners/'); }
function isClubPhotoPath(path: string): boolean { return path.startsWith('club-photos/'); }
async function fetchJson(url: string, authorization: string): Promise<unknown> { const response = await fetch(url, { headers: { authorization, accept: 'application/json' } }); if (!response.ok) throw new Error('Data API request failed'); return response.json(); }
function getCanonicalUserId(payload: Record<string, unknown>): string {
  const userId = payload.sub;
  if (typeof userId !== 'string' || !userId) throw new Error('Authenticated token is missing a valid subject');
  return userId;
}
async function hasOperationalStaffRole(userId: string, authorization: string): Promise<boolean> { const roleUrl = `${DEFAULT_NEON_DATA_API_URL}/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}&is_active=eq.true&role=in.(assistant_zone_leader,teacher,chief,president)&limit=1`; const roles = await fetchJson(roleUrl, authorization); return Array.isArray(roles) && roles.some(row => { const role = row as { role?: unknown }; return role.role === 'assistant_zone_leader' || role.role === 'teacher' || role.role === 'chief' || role.role === 'president'; }); }
async function canManageMissionProof(path: string, userId: string, authorization: string): Promise<boolean> { const assignmentId = missionProofAssignmentId(path); if (!assignmentId) return false; const apiUrl = `${DEFAULT_NEON_DATA_API_URL}/rest/v1/mission_assignments?select=student_id&id=eq.${encodeURIComponent(assignmentId)}&limit=1`; const data = await fetchJson(apiUrl, authorization); const assignment = Array.isArray(data) ? data[0] as { student_id?: unknown } | undefined : undefined; if (typeof assignment?.student_id !== 'string') return false; if (assignment.student_id === userId) return true; const roleUrl = `${DEFAULT_NEON_DATA_API_URL}/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}&is_active=eq.true&role=in.(teacher,chief)&limit=1`; const roles = await fetchJson(roleUrl, authorization); return Array.isArray(roles) && roles.some(row => { const role = row as { role?: unknown }; return role.role === 'teacher' || role.role === 'chief'; }); }
export default { async fetch(request: Request, env: Env): Promise<Response> { const origin = request.headers.get('origin') ?? ''; const requestedHeaders = request.headers.get('access-control-request-headers'); const cors = corsHeaders(origin, env.ALLOWED_ORIGIN, requestedHeaders); if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors }); const key = objectKey(request); if (!key) return json({ error: 'Not found' }, 404, cors); const normalizedKey = key.replace(/^public\//, 'Public/'); const isPublic = normalizedKey.startsWith('Public/'); const bucket = isPublic ? 'Public' : normalizedKey.split('/')[0]; const storageKey = isPublic ? normalizedKey.slice('Public/'.length) : normalizedKey; if (bucket !== 'Public' && bucket !== 'notebook-files') return json({ error: 'Forbidden' }, 403, cors); try { if (request.method === 'GET') { const url = new URL(request.url); const requiresPrivateAuth = url.searchParams.get('list') === 'true' || !isPublic; const authorization = request.headers.get('authorization') ?? '';  const userId = requiresPrivateAuth ? getCanonicalUserId(await requireAuth(request, env)) : ''; if (url.searchParams.get('list') === 'true') { const prefix = url.searchParams.get('prefix') ?? ''; const listPrefix = bucket === 'notebook-files' ? notebookStorageKey(isOwnNotebookPath(prefix, userId) ? prefix : `${userId}/${prefix}`) : prefix; const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? '1000'), 1), 1000); const listed = await env.STORAGE.list({ prefix: listPrefix, limit }); const files = listed.objects.map(object => { const name = bucket === 'notebook-files' ? object.key.slice('notebook-files/'.length) : object.key; return toStorageItem(object, name); }); const folders = listed.delimitedPrefixes.map(folder => ({ name: bucket === 'notebook-files' ? folder.replace(/^notebook-files\//, '').replace(/\/$/, '') : folder.replace(/\/$/, ''), id: null })); return json({ files: [...files, ...folders] }, 200, cors); } if (!isPublic && bucket === 'notebook-files' && (!userId || !isOwnNotebookPath(storageKey, userId))) return json({ error: 'Forbidden' }, 403, cors);
const transform = new URL(request.url).searchParams.get('transform');
if (isPublic && transform) {
  const imageOptions = transform === 'thumb'
    ? { fit: 'scale-down', width: 480, quality: 68, format: 'baseline-jpeg' }
    : transform === 'display'
      ? { fit: 'scale-down', width: 1280, quality: 78, format: 'baseline-jpeg' }
      : null;
  if (!imageOptions) return json({ error: 'Unsupported image transform' }, 400, cors);
  const originUrl = new URL(request.url);
  originUrl.searchParams.delete('transform');
  const transformedResponse = await fetch(originUrl.toString(), { cf: { image: imageOptions } });
  if (transformedResponse.ok || transformedResponse.status === 304) {
    const headers = new Headers(transformedResponse.headers);
    headers.set('cache-control', 'public, max-age=31536000, immutable');
    return new Response(transformedResponse.body, { status: transformedResponse.status, headers });
  }
  return transformedResponse;
}
const object = await env.STORAGE.get(storageKey); if (!object) return json({ error: 'Not found' }, 404, cors); return objectResponse(object, origin, env); }
if (request.method === 'POST') {
  const form = await request.formData();
  const action = form.get('action');
  const token = form.get('access_token');
  if (typeof token !== 'string' || !token) return json({ error: 'Unauthorized' }, 401, cors);
  const tokenPayload = await verifyJwt(token, env);
  const authorization = `Bearer ${token}`;
  const userId = getCanonicalUserId(tokenPayload);

  if (action === 'upload') {
    const formPath = form.get('path');
    const file = form.get('file');
    if (typeof formPath !== 'string' || !file || !(file instanceof File)) {
      return json({ error: 'Invalid upload payload' }, 400, cors);
    }
    const postKey = formPath.replace(/^public\//i, '').replace(/^Public\//, '');
    if (!postKey || postKey.startsWith('/')) return json({ error: 'Forbidden' }, 403, cors);
    const postStorageKey = postKey;
    const canWriteMemory = isOwnMemoryPath(postStorageKey, userId);
    const canWriteMissionProof = isMissionProofPath(postStorageKey) && await canManageMissionProof(postStorageKey, userId, `Bearer ${token}`);
    const canWriteAvatar = isOwnAvatarPath(postStorageKey, userId);
    const canWriteOperational = isOperationalStaffPath(postStorageKey) && await hasOperationalStaffRole(userId, `Bearer ${token}`);
    const canWriteClubPhoto = isClubPhotoPath(postStorageKey) && await hasOperationalStaffRole(userId, `Bearer ${token}`);
    if (!canWriteMemory && !canWriteMissionProof && !canWriteAvatar && !canWriteOperational && !canWriteClubPhoto) {
      const segments = postStorageKey.split('/').filter(Boolean);
      const owner = segments[0] === 'memories' ? (segments[1] ?? '') : '';
      const category = segments[0] ?? '';
      return json({
        error: `Forbidden: upload authorization mismatch (category=${category || 'none'}, pathOwner=${owner.slice(-8) || 'none'}, tokenSub=${userId.slice(-8) || 'none'}, memoryMatch=${canWriteMemory}, missionMatch=${canWriteMissionProof}, avatarMatch=${canWriteAvatar}, operationalMatch=${canWriteOperational}, clubPhotoMatch=${canWriteClubPhoto})`,
      }, 403, cors);
    }
    const contentType = typeof form.get('content_type') === 'string'
      ? String(form.get('content_type'))
      : file.type || 'application/octet-stream';
    const cacheControl = typeof form.get('cache_control') === 'string' ? String(form.get('cache_control')) : '';
    const upsert = form.get('upsert') === 'true';
    if (!upsert && await env.STORAGE.head(postStorageKey)) return json({ error: 'The resource already exists' }, 409, cors);
    const object = await env.STORAGE.put(postStorageKey, file, {
      httpMetadata: { contentType, ...(cacheControl ? { cacheControl } : {}) },
    });
    return json({ data: { path: formPath, id: object.etag, etag: object.etag }, error: null }, 200, cors);
  }

  if (action === 'delete') {
    const pathsValue = form.get('paths');
    if (typeof pathsValue !== 'string') return json({ error: 'Invalid delete payload' }, 400, cors);
    let paths: string[];
    try {
      const parsed = JSON.parse(pathsValue) as unknown;
      if (!Array.isArray(parsed) || !parsed.every(path => typeof path === 'string')) return json({ error: 'Invalid delete payload' }, 400, cors);
      paths = parsed;
    } catch {
      return json({ error: 'Invalid delete payload' }, 400, cors);
    }
    const normalizedPaths = paths.map(path => path.replace(/^public\//, ''));
    const canDeleteMemory = normalizedPaths.length > 0 && normalizedPaths.every(path => isOwnMemoryPath(path, userId));
    const canDeleteMissionProof = normalizedPaths.length > 0 && normalizedPaths.every(isMissionProofPath) && (await Promise.all(normalizedPaths.map(path => canManageMissionProof(path, userId, `Bearer ${token}`)))).every(Boolean);
    const canDeleteAvatar = normalizedPaths.length > 0 && normalizedPaths.every(path => isOwnAvatarPath(path, userId));
    const canDeleteOperational = normalizedPaths.length > 0 && normalizedPaths.every(isOperationalStaffPath) && await hasOperationalStaffRole(userId, `Bearer ${token}`);
    const canDeleteClubPhoto = normalizedPaths.length > 0 && normalizedPaths.every(isClubPhotoPath) && await hasOperationalStaffRole(userId, `Bearer ${token}`);
    if (!canDeleteMemory && !canDeleteMissionProof && !canDeleteAvatar && !canDeleteOperational && !canDeleteClubPhoto) {
      return json({ error: 'Forbidden' }, 403, cors);
    }
    await Promise.all(normalizedPaths.map(path => env.STORAGE.delete(path)));
    return json({ data: null, error: null }, 200, cors);
  }

  return json({ error: 'Unsupported storage action' }, 400, cors);
}
const authorization = request.headers.get('authorization') ?? ''; const tokenPayload = await requireAuth(request, env); const userId = getCanonicalUserId(tokenPayload); if (request.method === 'PUT') { if (bucket === 'notebook-files' && (!userId || !isOwnNotebookPath(storageKey, userId))) return json({ error: 'Forbidden' }, 403, cors); const contentType = request.headers.get('content-type') ?? 'application/octet-stream'; const cacheControl = request.headers.get('cache-control'); const upsert = request.headers.get('x-upsert') === 'true'; if (!upsert) { const existing = await env.STORAGE.head(storageKey); if (existing) return json({ error: 'The resource already exists' }, 409, cors); } const object = await env.STORAGE.put(storageKey, request.body, { httpMetadata: { contentType, ...(cacheControl ? { cacheControl } : {}) } }); return json({ data: { path: key, id: object.etag, etag: object.etag }, error: null }, 200, cors); }
if (request.method === 'DELETE') { const body = request.headers.get('content-type')?.includes('application/json') ? await request.json() as { paths?: string[] } : null; const paths = body?.paths ?? [storageKey]; const normalizedPaths = paths.map(path => path.replace(/^public\//, '')); const canDeleteMemory = bucket === 'Public' && normalizedPaths.every(path => isOwnMemoryPath(path, userId)); const canDeleteMissionProof = bucket === 'Public' && normalizedPaths.every(isMissionProofPath) && await Promise.all(normalizedPaths.map(path => canManageMissionProof(path, userId, authorization!))).then(results => results.every(Boolean)); const canDeleteAvatar = bucket === 'Public' && normalizedPaths.every(path => isOwnAvatarPath(path, userId)); const canDeleteOperational = bucket === 'Public' && normalizedPaths.every(isOperationalStaffPath) && await hasOperationalStaffRole(userId, authorization!); const canDeleteClubPhoto = bucket === 'Public' && normalizedPaths.every(isClubPhotoPath) && await hasOperationalStaffRole(userId, authorization!); const canDeleteNotebook = bucket === 'notebook-files' && paths.every(path => isOwnNotebookPath(path, userId)); if (!userId || (!canDeleteMemory && !canDeleteMissionProof && !canDeleteAvatar && !canDeleteOperational && !canDeleteClubPhoto && !canDeleteNotebook)) return json({ error: 'Forbidden' }, 403, cors); const storagePaths = canDeleteNotebook ? paths.map(notebookStorageKey) : normalizedPaths; await Promise.all(storagePaths.map(path => env.STORAGE.delete(path))); return json({ data: null, error: null }, 200, cors); }
return json({ error: 'Method not allowed' }, 405, cors); } catch (error) { const message = error instanceof Error ? error.message : 'Storage request failed'; const status = message === 'Unauthorized' || message.includes('token') || message.includes('signature') ? 401 : 500; return json({ error: message }, status, cors); } }, } satisfies ExportedHandler<Env>;

