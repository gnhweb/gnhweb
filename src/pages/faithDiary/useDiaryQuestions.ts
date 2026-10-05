import { useCallback, useState } from 'react';
import { fetchDiaryQuestions } from '@/lib/nvidiaNim';

const CACHE_PREFIX = 'faith_diary_questions_v1_';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 신앙일기 AI 추천 질문을 불러오고 하루 단위로 캐시하는 훅.
// · reveal(): 처음 버튼을 눌렀을 때 질문을 펼치고 (캐시가 있으면 즉시, 없으면 AI 호출)
// · refresh(): 같은 날에도 새 질문을 다시 받아옴
export function useDiaryQuestions() {
  const [questions, setQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const cacheKey = CACHE_PREFIX + todayKey();

  const load = useCallback(async (force: boolean) => {
    if (!force) {
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw) as unknown;
          if (Array.isArray(parsed) && parsed.length > 0) {
            setQuestions(parsed.filter((q): q is string => typeof q === 'string'));
            setError(null);
            return;
          }
        }
      } catch { /* 캐시 읽기 실패는 무시하고 새로 호출 */ }
    }

    setLoading(true);
    setError(null);
    try {
      const list = await fetchDiaryQuestions();
      setQuestions(list);
      try { localStorage.setItem(cacheKey, JSON.stringify(list)); } catch { /* 저장 실패 무시 */ }
    } catch {
      setError('추천 질문을 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }, [cacheKey]);

  const reveal = useCallback(() => {
    setRevealed(true);
    load(false);
  }, [load]);

  const refresh = useCallback(() => {
    load(true);
  }, [load]);

  return { questions, loading, error, revealed, reveal, refresh };
}