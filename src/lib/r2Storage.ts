type StorageError = { message: string } | null;

type UploadOptions = { contentType?: string; cacheControl?: string; upsert?: boolean };
type StorageFile = { name: string; id: string | null; metadata: { size: number; mimetype?: string; lastModified?: string }; created_at?: string };
type ListOptions = { limit?: number; sortBy?: { column: 'created_at' | 'name'; order: 'asc' | 'desc' } };

const baseUrl = (import.meta.env.VITE_R2_STORAGE_URL as string | undefined)?.replace(/\/$/, '');

const getAccessToken = async (): Promise<string | null> => {
  const auth = (await import('@/lib/neon')).neon.auth;
  const { data } = await auth.getSession();
  return data.session?.access_token ?? null;
};

const normalizeBucket = (bucket: string) => bucket.toLowerCase() === 'public' ? 'Public' : bucket;

const buildUrl = (bucket: string, path: string, params?: URLSearchParams) => {
  if (!baseUrl) throw new Error('VITE_R2_STORAGE_URL is not configured');
  const normalizedBucket = normalizeBucket(bucket);
  const encodedPath = path.split('/').filter(Boolean).map((segment) => encodeURIComponent(segment)).join('/');
  const url = `${baseUrl}/v1/storage/${encodeURIComponent(normalizedBucket)}${encodedPath ? `/${encodedPath}` : ''}`;
  return params?.size ? `${url}?${params.toString()}` : url;
};

const request = async (bucket: string, path: string, init: RequestInit = {}, requiresAuth = true, params?: URLSearchParams): Promise<Response> => {
  const headers = new Headers(init.headers);
  if (requiresAuth) {
    const token = await getAccessToken();
    if (!token) throw new Error('로그인이 필요합니다.');
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(buildUrl(bucket, path, params), { ...init, headers });
};

const parseError = async (response: Response): Promise<StorageError> => {
  if (response.ok) return null;
  try {
    const body = (await response.json()) as { error?: string };
    return { message: body.error ?? `Storage request failed (${response.status})` };
  } catch {
    return { message: `Storage request failed (${response.status})` };
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

export const r2Storage = { enabled: Boolean(baseUrl), from(bucket: string) { return new R2BucketClient(normalizeBucket(bucket)); } };
