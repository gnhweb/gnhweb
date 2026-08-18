import { supabase } from '@/lib/supabase';
import { getQuoteOfTheDay as getStaticQuoteOfTheDay, hashDateString } from '@/constants/quotes';

// ──────────────────────────────────────────────
// 오늘의 어록 - DB 연동 + 일 1회 캐싱 + 정적 데이터 폴백
//
// - quotes 테이블(is_active = true)에서 목록을 불러와,
//   기존 getQuoteOfTheDay()와 동일한 "날짜 해시로 하루에 하나 고정" 규칙을 적용합니다.
// - 홈 화면 진입 시마다 DB를 호출하지 않도록, localStorage에
//   {date, quotes} 형태로 캐시해두고 날짜가 바뀔 때만 다시 조회합니다.
// - DB 조회가 실패하면(오프라인 등) src/constants/quotes.ts의 정적 QUOTES 배열로 폴백합니다.
// ──────────────────────────────────────────────

const CACHE_KEY = 'daily_quote_cache_v1';

interface QuoteCache {
  date: string;
  quotes: string[];
}

function getTodayDateStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function pickQuoteFromList(quotes: string[], dateStr: string): string {
  if (quotes.length === 0) return getStaticQuoteOfTheDay();
  const index = hashDateString(dateStr) % quotes.length;
  return quotes[index];
}

function readCache(): QuoteCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.date === 'string' && Array.isArray(parsed.quotes)) {
      return parsed as QuoteCache;
    }
  } catch {
    /* 캐시 파싱 실패는 무시 - 캐시 없이 동작 */
  }
  return null;
}

function writeCache(cache: QuoteCache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* localStorage 저장 실패(용량 초과 등)는 무시 - 캐싱 없이도 정상 동작 */
  }
}

/**
 * 오늘 날짜로 캐시된 목록이 있으면 그 자리에서(동기, DB 호출 없이) 오늘의 어록을 계산해서 반환합니다.
 * 캐시가 없거나 날짜가 바뀐 경우에는 정적 QUOTES 배열 기준의 어록을 우선 반환하고,
 * 최신 데이터는 fetchAndCacheQuoteOfTheDay()가 비동기로 가져와 교체합니다.
 *
 * 화면이 처음 렌더링될 때 "깜빡임 없이" 바로 보여줄 초기값을 얻기 위한 동기 함수입니다.
 */
export function getCachedQuoteOfTheDay(): string {
  const dateStr = getTodayDateStr();
  const cache = readCache();
  if (cache && cache.date === dateStr && cache.quotes.length > 0) {
    return pickQuoteFromList(cache.quotes, dateStr);
  }
  return getStaticQuoteOfTheDay();
}

/**
 * quotes 테이블에서 오늘의 어록을 가져옵니다.
 * - 오늘 날짜로 이미 캐시된 목록이 있으면 DB를 호출하지 않고 캐시로 계산합니다.
 * - 캐시가 없거나 날짜가 바뀌었으면 DB에서 is_active=true인 어록을 전부 불러와
 *   새로 캐싱한 뒤, 그 목록 기준으로 오늘의 어록을 계산해서 반환합니다.
 * - DB 조회 실패(오프라인 등) 시에는 정적 QUOTES 배열 기준의 어록으로 폴백합니다.
 */
export async function fetchAndCacheQuoteOfTheDay(): Promise<string> {
  const dateStr = getTodayDateStr();
  const cache = readCache();
  if (cache && cache.date === dateStr && cache.quotes.length > 0) {
    return pickQuoteFromList(cache.quotes, dateStr);
  }

  try {
    const { data, error } = await supabase
      .from('quotes')
      .select('content')
      .eq('is_active', true);

    if (error || !data || data.length === 0) {
      return getStaticQuoteOfTheDay();
    }

    const quotes = (data as { content: string }[]).map((row) => row.content);
    writeCache({ date: dateStr, quotes });
    return pickQuoteFromList(quotes, dateStr);
  } catch {
    return getStaticQuoteOfTheDay();
  }
}
