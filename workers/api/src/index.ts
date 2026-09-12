import { handlePrayerRelay } from './prayerRelayFeature';
import { handleQuizLeaderboard } from './quizLeaderboardFeature';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

export default {
  async fetch(req: Request, env: Record<string, string | undefined>): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

    const url = new URL(req.url);
    if (url.pathname === '/prayer-relay') return handlePrayerRelay(req, env);
    if (url.pathname === '/quiz-leaderboard') return handleQuizLeaderboard(req, env);

    if (url.pathname !== '/web-push-public-key') {
      return json({ error: 'Not Found' }, 404);
    }

    if (req.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
    }

    const publicKey = String(env.WEB_PUSH_VAPID_PUBLIC_KEY || '').trim();
    if (!publicKey) {
      return json({ error: 'VAPID public key is not configured' }, 500);
    }

    return json({ publicKey }, 200, {
      'Cache-Control': 'public, max-age=3600',
    });
  },
};
