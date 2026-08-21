import { supabase } from '@/lib/supabase';
import { getRandomQuote as getStaticRandomQuote } from '@/constants/quotes';

// ──────────────────────────────────────────────
// 오늘의 어록 - DB 연동 + "접속할 때마다 랜덤" + 정적 데이터 폴백
//
// - quotes 테이블(is_active = true)에서 목록을 불러와, 사이트에 들어갈 때마다
//   (그리고 사람마다) 그 목록 중 하나를 완전히 무작위로 골라 보여줍니다.
// - 매번 DB를 호출하지 않도록, localStorage에 {expiresAt, quotes} 형태로
//   목록만 잠깐(1시간) 캐시해두고, 그 목록에서 뽑는 것은 매번 새로 무작위로 합니다.
// - DB 조회가 실패하면(오프라인 등) src/constants/quotes.ts의 정적 QUOTES 배열로 폴백합니다.
// ──────────────────────────────────────────────

const CACHE_KEY = 'quote_list_cache_v2';
const CACHE_TTL_MS = 60 * 60 * 1000; // 목록 캐시 유효 시간: 1시간

interface QuoteListCache {
  expiresAt: number;
  quotes: string[];
}

function pickRandomFromList(quotes: string[]): string {
  if (quotes.length === 0) return getStaticRandomQuote();
  return quotes[Math.floor(Math.random() * quotes.length)];
}

function readCache(): QuoteListCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.expiresAt === 'number' && Array.isArray(parsed.quotes)) {
      if (parsed.expiresAt < Date.now()) return null; // 만료됨
      return parsed as QuoteListCache;
    }
  } catch {
    /* 캐시 파싱 실패는 무시 - 캐시 없이 동작 */
  }
  return null;
}

function writeCache(quotes: string[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ expiresAt: Date.now() + CACHE_TTL_MS, quotes }));
  } catch {
    /* localStorage 저장 실패(용량 초과 등)는 무시 - 캐싱 없이도 정상 동작 */
  }
}

/**
 * 캐시된 목록(또는 정적 QUOTES 배열)에서 즉시(동기, DB 호출 없이) 무작위 어록 하나를 반환합니다.
 * 화면이 처음 렌더링될 때 "깜빡임 없이" 바로 보여줄 초기값을 얻기 위한 동기 함수입니다.
 * 매번 호출할 때마다 새로 무작위로 뽑히므로, 접속(새로고침)할 때마다 다른 어록이 나옵니다.
 */
export function getCachedQuoteOfTheDay(): string {
  const cache = readCache();
  if (cache && cache.quotes.length > 0) {
    return pickRandomFromList(cache.quotes);
  }
  return getStaticRandomQuote();
}

/**
 * quotes 테이블에서 활성화된 어록 목록을 가져와 그중 하나를 무작위로 반환합니다.
 * - 목록은 1시간 동안 캐시하여 접속할 때마다 DB를 호출하지 않도록 하되,
 *   뽑는 것 자체는 호출할 때마다 매번 새로 무작위로 이루어집니다(사람마다·접속마다 다르게 보임).
 * - DB 조회 실패(오프라인 등) 시에는 정적 QUOTES 배열에서 무작위로 폴백합니다.
 */
export async function fetchAndCacheQuoteOfTheDay(): Promise<string> {
  const cache = readCache();
  if (cache && cache.quotes.length > 0) {
    return pickRandomFromList(cache.quotes);
  }

  try {
    const { data, error } = await supabase
      .from('quotes')
      .select('content')
      .eq('is_active', true);

    if (error || !data || data.length === 0) {
      return getStaticRandomQuote();
    }

    const quotes = (data as { content: string }[]).map((row) => row.content);
    writeCache(quotes);
    return pickRandomFromList(quotes);
  } catch {
    return getStaticRandomQuote();
  }
}
