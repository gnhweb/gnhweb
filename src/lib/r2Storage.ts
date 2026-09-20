type StorageError = { message: string } | null;
type UploadOptions = { contentType?: string; cacheControl?: string; upsert?: boolean };
type StorageFile = { name: string; id: string | null; metadata: { size: number; mimetype?: string; lastModified?: string }; created_at?: string };
type ListOptions = { limit?: number; sortBy?: { column: 'created_at' | 'name'; order: 'asc' | 'desc' } };

const DEFAULT_R2_STORAGE_URL = 'https://gnhweb-storage.gemini19840314.workers.dev';
const configuredStorageUrl = (import.meta.env.VITE_R2_STORAGE_URL as string | undefined)?.trim();
const baseUrl = (() => {
  if (!configuredStorageUrl) return DEFAULT_R2_STORAGE_URL;
  try {
    const url = new URL(configuredStorageUrl);
    return url.hostname === new URL(DEFAULT_R2_STORAGE_URL).hostname
      ? configuredStorageUrl.replace(/\/$/, '')
      : DEFAULT_R2_STORAGE_URL;
  } catch {
    return DEFAULT_R2_STORAGE_URL;
  }
})();

const getAccessToken = async (): Promise<string | null> => {
  const auth = (await import('@/lib/neon')).neon.auth;
  const { data } = await auth.getSession();
  return data.session?.access_token ?? null;
};

const normalizeBucket = (bucket: string) => bucket.toLowerCase() === 'public' ? 'Public' : bucket;

const buildUrl = (bucket: string, path: string, params?: URLSearchParams) => {
  const normalizedBucket = normalizeBucket(bucket);
  const encodedPath = path.split('/').filter(Boolean).map((segment) => encodeURIComponent(segment)).join('/');
  // Keep the public bucket segment lowercase so the existing URL-path parser in
  // legacy photo-management screens can extract R2 object paths correctly.
  const urlBucket = normalizedBucket === 'Public' ? 'public' : encodeURIComponent(normalizedBucket);
  const url = `${baseUrl}/v1/storage/${urlBucket}${encodedPath ? `/${encodedPath}` : ''}`;
  const query = params?.toString();
  return query ? `${url}?${query}` : url;
};

const request = async (bucket: string, path: string, init: RequestInit = {}, requiresAuth = true, params?: URLSearchParams): Promise<Response> => {
  const headers = new Headers(init.headers);
  if (requiresAuth) {
    const token = await getAccessToken();
    if (!token) throw new Error('로그인이 필요합니다.');
    headers.set('Authorization', `Bearer ${token}`);
  }
  const requestParams = new URLSearchParams(params);
  // Version the authenticated Storage endpoint so browsers cannot reuse a
  // stale CORS preflight cached before the current Storage Worker headers.
  requestParams.set('cors', '2');
  const url = buildUrl(bucket, path, requestParams);
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await fetch(url, { ...init, headers, mode: 'cors', credentials: 'omit' });
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise(resolve => window.setTimeout(resolve, 350));
    }
  }
  if (lastError instanceof TypeError) {
    const online = typeof navigator !== 'undefined' ? navigator.onLine : null;
    const pageOrigin = typeof window !== 'undefined' ? window.location.origin : 'unknown';
    const detail = lastError.message?.trim();
    const status = online === false ? '현재 브라우저가 오프라인 상태입니다.' : '브라우저가 Storage 서버의 응답을 받기 전에 요청을 차단했을 가능성이 있습니다.';
    throw new Error(
      `Storage 네트워크 요청 실패: ${new URL(url).origin} (페이지: ${pageOrigin}) — ${status}${detail ? ` 원본 오류: ${detail}` : ''}`,
    );
  }
  throw new Error(lastError instanceof Error ? lastError.message : 'Storage request failed');
};

const parseError = async (response: Response): Promise<StorageError> => {
  if (response.ok) return null;
  try {
    const body = (await response.json()) as { error?: string };
    return { message: body.error ?? `Storage request failed (HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''})` };
  } catch {
    return { message: `Storage request failed (HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''})` };
  }
};

class R2BucketClient {
  constructor(private readonly bucket: string) {}

  async upload(path: string, file: File | Blob, options: UploadOptions = {}) {
    const headers: Record<string, string> = { 'content-type': options.contentType ?? file.type ?? 'application/octet-stream', 'x-upsert': String(options.upsert ?? false) };
    if (options.cacheControl) headers['cache-control'] = options.cacheControl;
    const response = await request(this.bucket, path, { method: 'PUT', headers, body: file });
    const error = await parseError(response);
    if (error) return { data: null, error };
    const data = (await response.json()) as { data: { path: string; id: string; etag: string } };
    return { data: data.data, error: null };
  }

  getPublicUrl(path: string) { return { data: { publicUrl: buildUrl(this.bucket, path) } }; }

  async remove(paths: string[]) {
    const response = await request(this.bucket, '', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ paths }) });
    const error = await parseError(response);
    return { data: error ? null : paths.map((path) => ({ name: path })), error };
  }

  async list(prefix = '', options: ListOptions = {}) {
    const query = new URLSearchParams({ list: 'true' });
    if (prefix) query.set('prefix', prefix);
    if (options.limit) query.set('limit', String(options.limit));
    if (options.sortBy) { query.set('sortBy', options.sortBy.column); query.set('sortOrder', options.sortBy.order); }
    const response = await request(this.bucket, '', { method: 'GET', headers: { accept: 'application/json' } }, true, query);
    const error = await parseError(response);
    if (error) return { data: null, error };
    const body = (await response.json()) as { files: StorageFile[] };
    return { data: body.files, error: null };
  }
}

export const r2Storage = { enabled: true, from(bucket: string) { return new R2BucketClient(normalizeBucket(bucket)); } };
