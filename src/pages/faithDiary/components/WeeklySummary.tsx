import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useWeeklySummary } from '@/pages/faithDiary/useWeeklySummary';
import WeeklyCardShareModal from '@/pages/faithDiary/components/WeeklyCardShareModal';
import { dominantWeekMood } from '@/pages/faithDiary/lib';
import type { DiaryWeekEntryPayload } from '@/lib/nvidiaNim';

interface WeeklySummaryProps {
  /** 이번 주(월~일)에 해당하는 기록들 */
  entries: DiaryWeekEntryPayload[];
  /** 'M월 D일 ~ M월 D일' 형태의 주간 라벨 */
  weekLabel: string;
  /** 주 식별자(주 시작일) — 보관함 저장 키 */
  weekKey?: string;
}

// 지금까지 쓴 일기를 바탕으로 AI가 이번 주 신앙 여정을 요약해주는 카드.
export default function WeeklySummary({ entries, weekLabel, weekKey }: WeeklySummaryProps) {
  const { summary, loading, error, revealed, reveal, refresh, hasEntries } = useWeeklySummary(entries);
  const [shareOpen, setShareOpen] = useState(false);
  const mood = useMemo(() => dominantWeekMood(entries), [entries]);

  return (
    <div className="rounded-[20px] border border-primary-100 bg-gradient-to-br from-primary-50 to-accent-50 p-5">
      {/* 헤더 */}
      <div className="flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0">
          <i className="ri-route-line text-base"></i>
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground-950">이번 주 신앙 여정</h3>
          <p className="text-[11px] text-foreground-500">{weekLabel} · 지금까지 쓴 일기를 바탕으로 요약해드려요</p>
        </div>
      </div>

      {/* 이번 주 기록이 없을 때 */}
      {!hasEntries ? (
        <div className="mt-4 rounded-xl bg-background-50 border border-background-200 p-4 text-center">
          <p className="text-xs text-foreground-500 leading-relaxed">
            이번 주 기록이 아직 없어요.<br />일기를 쓰면 한 주의 여정을 따뜻하게 돌아봐 드릴게요.
          </p>
        </div>
      ) : !revealed ? (
        <button
          onClick={reveal}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-full bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-sparkling-2-line"></i> 이번 주 여정 요약 받기
        </button>
      ) : loading ? (
        <div className="mt-4 flex items-center justify-center gap-2 py-6 text-sm text-foreground-500">
          <span className="w-4 h-4 rounded-full border-2 border-primary-400 border-t-transparent animate-spin"></span>
          이번 주 여정을 정리하고 있어요...
        </div>
      ) : error ? (
        <div className="mt-4 rounded-xl bg-background-50 border border-background-200 p-3">
          <p className="text-xs text-accent-700 flex items-center gap-1.5">
            <i className="ri-error-warning-line"></i>{error}
          </p>
          <button onClick={refresh} className="mt-2 text-xs text-accent-600 underline cursor-pointer">다시 시도</button>
        </div>
      ) : summary ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 space-y-3"
        >
          {/* 요약 */}
          <div className="rounded-2xl bg-background-50 border border-primary-100 p-4">
            <p className="text-sm text-foreground-700 leading-relaxed whitespace-pre-wrap">{summary.summary}</p>
          </div>

          {/* 핵심 주제 */}
          {summary.themes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {summary.themes.map((t, i) => (
                <span
                  key={`theme-${i}`}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-secondary-100 text-secondary-900"
                >
                  <i className="ri-price-tag-3-line"></i>{t}
                </span>
              ))}
            </div>
          )}

          {/* 기억할 순간 */}
          {summary.highlights.length > 0 && (
            <div className="rounded-2xl bg-background-50 border border-background-200 p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <i className="ri-bookmark-2-line text-accent-500 text-sm"></i>
                <span className="text-[11px] font-bold text-foreground-800">이번 주 기억할 순간</span>
              </div>
              <ul className="space-y-1.5">
                {summary.highlights.map((h, i) => (
                  <li key={`highlight-${i}`} className="flex items-start gap-2 text-sm text-foreground-700 leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-400 flex-shrink-0 mt-2"></span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 격려 + 말씀 */}
          {summary.encouragement && (
            <div className="rounded-2xl bg-accent-50/70 border border-accent-100 p-4">
              <div className="flex items-center gap-1.5 mb-1.5">
                <i className="ri-heart-3-line text-accent-500 text-sm"></i>
                <span className="text-[11px] font-bold text-accent-700">격려의 말</span>
              </div>
              <p className="text-sm text-foreground-700 leading-relaxed whitespace-pre-wrap">{summary.encouragement}</p>
              {summary.verseRef && (
                <p className="mt-2 text-xs text-accent-700 italic">"{summary.verseRef}"</p>
              )}
            </div>
          )}

          {/* 다음 주 한 가지 */}
          {summary.nextFocus && (
            <div className="rounded-2xl bg-background-50 border border-primary-100 p-4">
              <div className="flex items-center gap-1.5 mb-1.5">
                <i className="ri-flag-2-line text-primary-500 text-sm"></i>
                <span className="text-[11px] font-bold text-primary-700">다음 주 한 걸음</span>
              </div>
              <p className="text-sm text-foreground-700 leading-relaxed">{summary.nextFocus}</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              onClick={() => setShareOpen(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full bg-primary-500 text-white text-xs font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-image-add-line"></i> 카드 이미지로 저장·공유
            </button>
            <button
              onClick={refresh}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full border border-primary-200 text-primary-600 text-xs font-semibold hover:bg-primary-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-refresh-line"></i> 다시 요약하기
            </button>
          </div>
        </motion.div>
      ) : null}

      {summary && (
        <WeeklyCardShareModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          summary={summary}
          weekLabel={weekLabel}
          weekKey={weekKey}
          mood={mood}
        />
      )}
    </div>
  );
}