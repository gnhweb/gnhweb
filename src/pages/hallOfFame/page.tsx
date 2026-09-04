import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';

interface ChampionRecord {
  id: string;
  year: number;
  month: number;
  category: 'quiz' | 'marathon';
  club_key: string;
  club_label: string;
  value: number;
  extra: { topPlayerNickname?: string; topPlayerClub?: string; topPlayerScore?: number } | null;
  finalized_at: string;
}

interface MonthGroup {
  year: number;
  month: number;
  quiz: ChampionRecord;
}

export default function HallOfFame() {
  const [records, setRecords] = useState<ChampionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    supabase.functions.invoke('monthly-champion-snapshot?mode=list&limit=60', {
      method: 'GET',
    }).then(({ data, error: fnError }) => {
      if (cancelled) return;
      if (fnError) throw fnError;
      setRecords((data?.records as ChampionRecord[]) || []);
    }).catch(() => {
      if (!cancelled) setError(true);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const groups: MonthGroup[] = [];
  for (const r of records) {
    if (r.category !== 'quiz') continue;
    groups.push({ year: r.year, month: r.month, quiz: r });
  }
  groups.sort((a, b) => (b.year - a.year) || (b.month - a.month));

  return (
    <div className="min-h-screen bg-background-50 dark:bg-background-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 md:py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-6 md:mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-card bg-amber-100 dark:bg-background-200 border border-amber-200 dark:border-background-300 mb-5">
              <i className="ri-award-fill text-3xl text-amber-600 dark:text-accent-300"></i>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground-950 dark:text-foreground-950 mb-1">명예의 전당</h1>
            <p className="text-sm text-foreground-600 dark:text-foreground-300">매달 확정된 성경퀴즈 1위 동아리 기록이에요</p>
          </div>

          {error && (
            <div className="mb-6 px-4 py-3 bg-accent-100 dark:bg-background-200 border border-accent-200 dark:border-background-300 rounded-input flex items-center justify-between text-sm text-accent-700 dark:text-accent-300">
              <span className="flex items-center gap-2"><i className="ri-error-warning-line"></i>기록을 불러오는 중 문제가 발생했어요</span>
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 rounded-card bg-background-100 dark:bg-background-100 animate-pulse" />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-16">
              <i className="ri-trophy-line text-4xl text-foreground-300 dark:text-foreground-500 mb-3 block"></i>
              <p className="text-sm text-foreground-500 dark:text-foreground-300">아직 확정된 성경퀴즈 수상 기록이 없어요.</p>
              <p className="text-xs text-foreground-400 dark:text-foreground-400 mt-1">이번 달이 끝나면 첫 기록이 여기에 남아요.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((g) => (
                <div key={`${g.year}-${g.month}`} className="rounded-card border border-background-200 dark:border-background-300 bg-background-100 dark:bg-background-100 p-4 md:p-5">
                  <p className="text-sm font-bold text-foreground-950 dark:text-foreground-950 mb-3">{g.year}년 {g.month}월</p>
                  <div className="rounded-input bg-amber-50 dark:bg-background-200 border border-amber-200 dark:border-background-300 p-4">
                    <p className="text-[11px] font-semibold text-amber-700 dark:text-accent-300 mb-1 flex items-center gap-1"><i className="ri-trophy-fill"></i> 성경퀴즈 1위</p>
                    <div className="flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-black text-base text-foreground-950 dark:text-foreground-950 truncate">{g.quiz.club_label}</p>
                        {g.quiz.extra?.topPlayerNickname && (
                          <p className="text-[10px] text-foreground-400 dark:text-foreground-300 mt-1 truncate">MVP {g.quiz.extra.topPlayerNickname}</p>
                        )}
                      </div>
                      <p className="text-sm font-bold text-foreground-700 dark:text-foreground-200 shrink-0">{g.quiz.value.toLocaleString()}점</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 text-center">
            <Link to="/" className="text-sm text-primary-600 dark:text-primary-300 hover:text-primary-700 dark:hover:text-primary-200 font-semibold inline-flex items-center gap-1 cursor-pointer">
              <i className="ri-arrow-left-line"></i> 홈으로 돌아가기
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
