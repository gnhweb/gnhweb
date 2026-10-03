// Production load validation runs from the deploy pipeline after the Pages deployment so results are tied to the deployed commit.
import { chromium } from '@playwright/test';
import { performance } from 'node:perf_hooks';

const baseUrl = (process.env.LOAD_TEST_BASE_URL || 'https://gnhwebw.pages.dev').replace(/\/$/, '');
const stages = [1, 10, 30, 50, 75, 100];
const holdMs = Number(process.env.LOAD_TEST_HOLD_MS || 10_000);
const soakMinutes = Number(process.env.LOAD_TEST_SOAK_MINUTES || 0);
const navigationTimeoutMs = Number(process.env.LOAD_TEST_NAVIGATION_TIMEOUT_MS || 30_000);
const workload = process.env.LOAD_TEST_WORKLOAD || 'mixed';
const mixedRoutes = [
  '/schedule',
  '/clubs',
  '/notices',
  '/games',
  '/tools',
  '/bible-pick',
  '/bible-mbti',
  '/ganghak-news',
  '/sermon-highlight',
  '/hall-of-fame',
  '/search',
];

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

async function runStage(concurrency, stageHoldMs = holdMs) {
  const browser = await chromium.launch({ headless: true });
  const startedAt = performance.now();
  const results = [];
  const workers = Array.from({ length: concurrency }, async (_, index) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const start = performance.now();
    let status = 0;
    let error = '';
    let ttfbMs = 0;
    let domContentLoadedMs = 0;
    let requestCount = 0;
    let serverErrorCount = 0;
    let firstPaintMs = 0;
    let firstContentfulPaintMs = 0;
    let largestContentfulPaintMs = 0;
    let longTaskCount = 0;
    let longTaskTotalMs = 0;
    const requestTargets = new Map();
    const failedRequests = [];
    const recordResponse = (response) => {
      if (response.status() >= 500) {
        serverErrorCount += 1;
        if (failedRequests.length < 5) failedRequests.push(`${response.status()} ${response.url()}`);
      }
    };
    page.on('response', recordResponse);
    page.on('requestfailed', (request) => {
      if (failedRequests.length < 5) failedRequests.push(`${request.url()} :: ${request.failure()?.errorText || 'failed'}`);
    });
    const recordRequest = (request) => {
      requestCount += 1;
      try {
        const url = new URL(request.url());
        const key = `${url.host}${url.pathname}`;
        requestTargets.set(key, (requestTargets.get(key) || 0) + 1);
      } catch {
        // Ignore malformed request URLs; Playwright will still report the navigation result.
      }
    };
    page.on('request', recordRequest);
    try {
      const route = workload === 'homepage'
        ? '/'
        : mixedRoutes[index % mixedRoutes.length];
      const response = await page.goto(baseUrl + route, { waitUntil: 'domcontentloaded', timeout: navigationTimeoutMs });
      status = response?.status() ?? 0;
      if (!response || status >= 500) {
        error = `HTTP ${status || 'no-response'}`;
      } else {
        await page.waitForTimeout(stageHoldMs);
        const timing = await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0];
          const paintEntries = performance.getEntriesByType('paint');
          const fcp = paintEntries.find((entry) => entry.name === 'first-contentful-paint');
          const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
          const lcp = lcpEntries[lcpEntries.length - 1];
          const longTasks = performance.getEntriesByType('longtask');
          return {
            responseStart: navigation?.responseStart ?? 0,
            requestStart: navigation?.requestStart ?? 0,
            domContentLoadedEventEnd: navigation?.domContentLoadedEventEnd ?? 0,
            startTime: navigation?.startTime ?? 0,
            firstPaint: paintEntries.find((entry) => entry.name === 'first-paint')?.startTime ?? 0,
            firstContentfulPaint: fcp?.startTime ?? 0,
            largestContentfulPaint: lcp?.startTime ?? 0,
            longTaskCount: longTasks.length,
            longTaskTotal: longTasks.reduce((sum, entry) => sum + entry.duration, 0),
          };
        });
        if (timing) {
          ttfbMs = Math.round(timing.responseStart - timing.requestStart);
          domContentLoadedMs = Math.round(timing.domContentLoadedEventEnd - timing.startTime);
          firstPaintMs = Math.round(timing.firstPaint);
          firstContentfulPaintMs = Math.round(timing.firstContentfulPaint);
          largestContentfulPaintMs = Math.round(timing.largestContentfulPaint);
          longTaskCount = timing.longTaskCount;
          longTaskTotalMs = Math.round(timing.longTaskTotal);
        }
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      results[index] = {
        durationMs: Math.round(performance.now() - start),
        ttfbMs,
        domContentLoadedMs,
        firstPaintMs,
        firstContentfulPaintMs,
        largestContentfulPaintMs,
        longTaskCount,
        longTaskTotalMs,
        status,
        error,
        requestCount,
        serverErrorCount,
        failedRequests,
        route: workload === 'homepage' ? '/' : mixedRoutes[index % mixedRoutes.length],
        requestTargets: Object.fromEntries(requestTargets),
      };
      await context.close().catch(() => {});
    }
  });
  await Promise.all(workers);
  await browser.close();

  const durations = results.map((result) => result.durationMs);
  const ttfbValues = results.map((result) => result.ttfbMs).filter((value) => value > 0);
  const domContentLoadedValues = results.map((result) => result.domContentLoadedMs).filter((value) => value > 0);
  const firstPaintValues = results.map((result) => result.firstPaintMs).filter((value) => value > 0);
  const firstContentfulPaintValues = results.map((result) => result.firstContentfulPaintMs).filter((value) => value > 0);
  const largestContentfulPaintValues = results.map((result) => result.largestContentfulPaintMs).filter((value) => value > 0);
  const longTaskCounts = results.map((result) => result.longTaskCount);
  const longTaskTotals = results.map((result) => result.longTaskTotalMs);
  const failures = results.filter((result) => result.error || result.status >= 500 || result.serverErrorCount > 0);
  const totalRequests = results.reduce((sum, result) => sum + result.requestCount, 0);
  const requestTargets = {};
  for (const result of results) {
    for (const [target, count] of Object.entries(result.requestTargets)) {
      requestTargets[target] = (requestTargets[target] || 0) + count;
    }
  }
  const topRequestTargets = Object.entries(requestTargets)
    .sort(([, left], [, right]) => right - left)
    .slice(0, 30)
    .map(([target, count]) => ({ target, count }));

  return {
    concurrency,
    total: results.length,
    totalRequests,
    requestsPerSession: Number((totalRequests / results.length).toFixed(2)),
    topRequestTargets,
    success: results.length - failures.length,
    failures: failures.length,
    failureRate: Number(((failures.length / results.length) * 100).toFixed(2)),
    minMs: Math.min(...durations),
    medianMs: percentile(durations, 50),
    p95Ms: percentile(durations, 95),
    p99Ms: percentile(durations, 99),
    maxMs: Math.max(...durations),
    ttfbMedianMs: percentile(ttfbValues, 50),
    ttfbP95Ms: percentile(ttfbValues, 95),
    domContentLoadedMedianMs: percentile(domContentLoadedValues, 50),
    domContentLoadedP95Ms: percentile(domContentLoadedValues, 95),
    firstPaintMedianMs: percentile(firstPaintValues, 50),
    firstPaintP95Ms: percentile(firstPaintValues, 95),
    firstContentfulPaintMedianMs: percentile(firstContentfulPaintValues, 50),
    firstContentfulPaintP95Ms: percentile(firstContentfulPaintValues, 95),
    largestContentfulPaintMedianMs: percentile(largestContentfulPaintValues, 50),
    largestContentfulPaintP95Ms: percentile(largestContentfulPaintValues, 95),
    longTaskCountMedian: percentile(longTaskCounts, 50),
    longTaskCountP95: percentile(longTaskCounts, 95),
    longTaskTotalMedianMs: percentile(longTaskTotals, 50),
    longTaskTotalP95Ms: percentile(longTaskTotals, 95),
    elapsedMs: Math.round(performance.now() - startedAt),
    serverErrorCount: results.reduce((sum, result) => sum + result.serverErrorCount, 0),
    sampleErrors: failures.slice(0, 5).flatMap((result) => result.failedRequests.length ? result.failedRequests : [result.error || `HTTP ${result.status}`]).slice(0, 10),
  };
}

console.log(`Production load target: ${baseUrl}`);
console.log(`${workload === 'homepage' ? 'Read-only homepage' : 'Mixed public-route'} load test. Stages: 1 -> 10 -> 30 -> 50 -> 75 -> 100 concurrent sessions.`);
console.log('Reports total duration, browser TTFB, and DOMContentLoaded separately.');
const allResults = [];
for (const concurrency of stages) {
  console.log(`\n=== ${concurrency} concurrent sessions ===`);
  const result = await runStage(concurrency);
  allResults.push(result);
  console.log(JSON.stringify(result, null, 2));
}
const soakResult = soakMinutes > 0
  ? await runStage(100, soakMinutes * 60_000)
  : null;
if (soakResult) {
  console.log(`\n=== 100 concurrent session soak: ${soakMinutes} minutes ===`);
  console.log(JSON.stringify(soakResult, null, 2));
}
const output = { generatedAt: new Date().toISOString(), baseUrl, workload, holdMs, soakMinutes, navigationTimeoutMs, stages: allResults, soak: soakResult };
console.log('\n=== LOAD_TEST_RESULT_JSON ===');
console.log(JSON.stringify(output, null, 2));
if (allResults.some((result) => result.failureRate >= 5) || (soakResult && soakResult.failureRate >= 5)) process.exitCode = 1;
