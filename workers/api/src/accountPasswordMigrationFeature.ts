import type { Request } from 'cloudflare-worker-types';

export async function handleAccountPasswordMigration(_req: Request, _env: Record<string, string | undefined>): Promise<Response> {
  return new Response(JSON.stringify({ error: 'Account password migration is not enabled yet.' }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' },
  });
}
