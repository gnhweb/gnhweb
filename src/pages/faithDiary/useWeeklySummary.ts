import { useCallback, useState } from 'react';
import {
  fetchDiaryWeeklySummary,
  type DiaryWeekEntryPayload,
  type DiaryWeekSummary,
} from '@/lib/nvidiaNim';
import { getWeekCacheKey } from '@/pages/faithDiary/lib';

const CACHE_PREFIX = 'faith_diary_week_summary_v1_';

interface CachedSummary extends DiaryWeekSummary {
  /** 생성 당시 기록 개수 — 개수가 달라지면 캐시를 무효화하고 다시 요약 */
  entryCount: number;
}

// 이번 주 신앙 여정 AI 요약을 불러오고, 같은 주 안에서는 결과를 재사용하는 훅.
// · reveal(): 처음 버튼을 눌렀을 때 요약을 펼침 (캐시가 있으면 즉시, 없으면 AI 호출)
// · refresh(): 캐시를 무시하고 새로 요약
export function useWeeklySummary(entries: DiaryWeekEntryPayload[]) {
  const [summary, setSummary] = useState<DiaryWeekSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const cacheKey = CACHE_PREFIX + getWeekCacheKey();

  const load = useCallback(async (force: boolean) => {
    if (entries.length === 0) {
      setError('이번 주 기록이 아직 없어요. 일기를 쓰면 여정을 요약해드릴게요.');
      return;
    }

    if (!force) {
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw) as CachedSummary;
          if (parsed && typeof parsed.summary === 'string' && parsed.entryCount === entries.length) {
            setSummary(parsed);
            setError(null);
            return;
          }
        }
      } catch { /* 캐시 읽기 실패는 무시하고 새로 호출 */ }
    }

    setLoading(true);
    setError(null);
    try {
      const result = await fetchDiaryWeeklySummary(entries);
      setSummary(result);
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ ...result, entryCount: entries.length }));
      } catch { /* 저장 실패 무시 */ }
    } catch {
      setError('이번 주 요약을 만들지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }, [cacheKey, entries]);

  const reveal = useCallback(() => {
    setRevealed(true);
    load(false);
  }, [load]);

  const refresh = useCallback(() => {
    load(true);
  }, [load]);

  return { summary, loading, error, revealed, reveal, refresh, hasEntries: entries.length > 0 };
}