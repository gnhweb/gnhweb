import { handlePrayerRelay } from './prayerRelayFeature';
import { handleQuizLeaderboard } from './quizLeaderboardFeature';
import { handleQuizReport } from './quizReportFeature';
import { handleStreakTracker } from './streakTrackerFeature';
import { handleBibleStreakUpdate } from './bibleStreakUpdateFeature';
import { handleBiblePick } from './biblePickFeature';
import { handleSetupChief } from './setupChiefFeature';
import { handleMonthlyChampionSnapshot } from './monthlyChampionSnapshotFeature';
import { handleWebPush } from './webPushFeature';
import { handleAccountPasswordMigration } from './accountPasswordMigrationFeature';
import { processWebPushQueue } from './webPushQueue';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-web-push-secret',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function requiresNeonJwt(pathname: string): boolean {
  return pathname === '/prayer-relay'
    || pathname === '/quiz-leaderboard'
    || pathname === '/streak-tracker'
    || pathname === '/monthly-champion-snapshot';
}

export default {
  async fetch(req: Request, env: Record<string, string | undefined>): Promise<Response> {
    const url = new URL(req.url);

    // The account migration endpoint owns its origin-aware CORS handling.
    // Route it before the generic OPTIONS response so browser preflight reaches
    // the endpoint-specific Access-Control-Allow-Origin response.
    if (url.pathname === '/account-password-migration') {
      return handleAccountPasswordMigration(req, env);
    }

    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
    if (requiresNeonJwt(url.pathname) && !req.headers.get('authorization')) {
      return json({ error: 'Unauthorized' }, 401);
    }
    if (url.pathname === '/prayer-relay') return handlePrayerRelay(req, env);
    if (url.pathname === '/quiz-leaderboard') return handleQuizLeaderboard(req, env);
    if (url.pathname === '/quiz-report') return handleQuizReport(req, env);
    if (url.pathname === '/streak-tracker') return handleStreakTracker(req, env);
    if (url.pathname === '/bible-streak-update') return handleBibleStreakUpdate(req, env);
    if (url.pathname === '/bible-pick') return handleBiblePick(req, env);
    if (url.pathname === '/setup-chief') return handleSetupChief(req, env);
    if (url.pathname === '/monthly-champion-snapshot') return handleMonthlyChampionSnapshot(req, env);
    if (url.pathname === '/web-push') return handleWebPush(req, env);
    if (url.pathname !== '/web-push-public-key') return json({ error: 'Not Found' }, 404);
    if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
    const publicKey = String(env.WEB_PUSH_VAPID_PUBLIC_KEY || '').trim();
    if (!publicKey) return json({ error: 'VAPID public key is not configured' }, 500);
    return json({ publicKey }, 200, { 'Cache-Control': 'public, max-age=3600' });
  },

  async scheduled(_controller: ScheduledController, env: Record<string, string | undefined>): Promise<void> {
    const result = await processWebPushQueue(env);
    console.log('[web-push-queue] processed', result);
  },
};