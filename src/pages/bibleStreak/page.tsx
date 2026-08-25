import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const CLUB_INFO: Record<string, { name: string; color: string; icon: string }> = {
  '새울림': { name: '새울림', color: '#f59e0b', icon: 'ri-music-line' },
  '천지풍': { name: '천지풍', color: '#10b981', icon: 'ri-palette-line' },
  '천지후': { name: '천지후', color: '#0ea5e9', icon: 'ri-heart-pulse-line' },
  '문화부': { name: '문화부', color: '#f43f5e', icon: 'ri-camera-line' },
  '미지정': { name: '미지정', color: '#888', icon: 'ri-user-line' },
};

interface BadgeInfo {
  name: string;
  icon: string;
  days: number;
  description: string;
}

const ALL_BADGES: BadgeInfo[] = [
  { name: '시작의 한걸음', icon: 'ri-footprint-line', days: 1, description: '첫 묵상 확인 또는 퀴즈 완료!' },
  { name: '말씀 새싹', icon: 'ri-seedling-line', days: 3, description: '3일 연속 말씀 묵상' },
  { name: '말씀의 길', icon: 'ri-road-map-line', days: 7, description: '7일 연속! 일주일을 말씀과 함께' },
  { name: '믿음의 기초', icon: 'ri-anchor-line', days: 14, description: '2주 연속 말씀 묵상' },
  { name: '말씀의 달인', icon: 'ri-book-3-line', days: 30, description: '30일 연속! 한 달을 말씀으로 채웠어요' },
  { name: '말씀 전사', icon: 'ri-shield-star-line', days: 50, description: '50일 연속 도전 성공' },
  { name: '말씀의 성벽', icon: 'ri-building-2-line', days: 100, description: '100일 연속! 말씀의 성벽입니다' },
  { name: '영적 거인', icon: 'ri-star-smile-line', days: 200, description: '200일 연속! 영적 성장의 모범' },
  { name: '말씀의 기둥', icon: 'ri-building-line', days: 365, description: '1년 연속! 말씀의 기둥이 되셨습니다' },
];

interface IndividualStreak {
  streak: number;
  maxStreak: number;
  totalPicks: number;
  lastPickDate: string | null;
  badges: BadgeInfo[];
  nextBadge: BadgeInfo | null;
}

interface ClubOverall {
  club_name: string;
  total_streaks: number;
  member_count: number;
  total_picks: number;
  avg_streak: number;
}

const getKstDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

export default function BibleStreak() {
  const { user } = useAuth();
  const [individual, setIndividual] = useState<IndividualStreak | null>(null);
  const [clubOverall, setClubOverall] = useState<ClubOverall[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'individual' | 'club'>('individual');

  const fetchData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('streak-tracker', {
        body: { userId: user?.id },
      });
      if (data) {
        if (data.individual) setIndividual(data.individual as IndividualStreak);
        if (data.clubOverall) setClubOverall(data.clubOverall as ClubOverall[]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-[70dvh] bg-background-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="relative w-11 h-11 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-[3px] border-primary-200 dark:border-primary-900 animate-spin border-t-transparent"></div>
          </div>
          <p className="text-foreground-600 dark:text-foreground-300 text-sm">말씀 스트릭을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const lastDate = individual?.lastPickDate?.slice(0, 10) ?? null;
  const today = getKstDate();
  const completedToday = lastDate === today;
  const streak = individual?.streak ?? 0;
  const maxStreak = individual?.maxStreak ?? 0;
  const totalPicks = individual?.totalPicks ?? 0;
  const nextBadge = individual?.nextBadge ?? null;
  const badgeProgress = nextBadge ? Math.min((streak / nextBadge.days) * 100, 100) : 100;
  const daysToNext = nextBadge ? Math.max(0, nextBadge.days - streak) : 0;

  return (
    <div className="min-h-screen bg-background-50 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-5 sm:px-6 sm:py-10">
        <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-primary-600 dark:text-primary-400">말씀 습관</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-foreground-950 dark:text-white sm:text-3xl">말씀 스트릭</h1>
              <p className="mt-1 text-sm leading-5 text-foreground-600 dark:text-slate-300">매일 말씀과 함께한 날을 이어가세요.</p>
            </div>
            <button
              type="button"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              aria-label="스트릭 새로고침"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-background-200 bg-background-100 text-foreground-600 active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <i className={`ri-refresh-line text-lg ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </motion.header>

        <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-background-100 p-1 dark:bg-slate-900">
          {(['individual', 'club'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`min-h-11 rounded-xl px-3 text-sm font-bold transition ${
                tab === value
                  ? 'bg-white text-foreground-950 shadow-sm dark:bg-slate-700 dark:text-white'
                  : 'text-foreground-500 dark:text-slate-400'
              }`}
            >
              {value === 'individual' ? '내 스트릭' : '동아리 랭킹'}
            </button>
          ))}
        </div>

        {tab === 'individual' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <section className="overflow-hidden rounded-3xl border border-background-200 bg-background-100 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-950/60">
                  <i className="ri-fire-line text-2xl text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground-800 dark:text-white">현재 스트릭</p>
                  <p className="text-xs text-foreground-500 dark:text-slate-400">하루 한 번만 기록됩니다.</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-amber-50 px-2 py-4 dark:bg-amber-950/30">
                  <p className="text-4xl font-black text-amber-600 dark:text-amber-400">{streak}</p>
                  <p className="mt-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">현재 연속일</p>
                </div>
                <div className="rounded-2xl bg-background-50 px-2 py-4 dark:bg-slate-950">
                  <p className="text-4xl font-black text-foreground-900 dark:text-white">{maxStreak}</p>
                  <p className="mt-1 text-[11px] font-semibold text-foreground-500 dark:text-slate-400">최고 기록</p>
                </div>
                <div className="rounded-2xl bg-background-50 px-2 py-4 dark:bg-slate-950">
                  <p className="text-4xl font-black text-primary-600 dark:text-primary-400">{totalPicks}</p>
                  <p className="mt-1 text-[11px] font-semibold text-foreground-500 dark:text-slate-400">기록한 날</p>
                </div>
              </div>

              <div className={`mt-4 flex items-start gap-3 rounded-2xl border px-4 py-3 ${
                completedToday
                  ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                  : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
              }`}>
                <i className={`${completedToday ? 'ri-checkbox-circle-fill text-emerald-600 dark:text-emerald-400' : 'ri-time-line text-amber-600 dark:text-amber-400'} mt-0.5 text-lg`} />
                <div className="min-w-0">
                  <p className={`text-sm font-bold ${completedToday ? 'text-emerald-800 dark:text-emerald-200' : 'text-amber-800 dark:text-amber-200'}`}>
                    {completedToday ? '오늘 말씀 기록 완료!' : '오늘 기록이 아직 없어요'}
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-foreground-600 dark:text-slate-300">
                    {completedToday ? '오늘은 이미 반영됐어요. 내일 다시 이어가세요.' : '성경완독 묵상 또는 성경퀴즈를 완료하면 오늘 기록이 반영됩니다.'}
                  </p>
                </div>
              </div>
            </section>

            {nextBadge && (
              <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-300">다음 배지</p>
                    <h2 className="mt-1 text-lg font-black text-amber-900 dark:text-amber-100">{nextBadge.name}</h2>
                    <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-200/80">{nextBadge.description}</p>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70 dark:bg-slate-900/60">
                    <i className={`${nextBadge.icon} text-xl text-amber-600 dark:text-amber-400`} />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs font-bold text-amber-800 dark:text-amber-200">
                  <span>{streak}일</span>
                  <span>{nextBadge.days}일</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-amber-200 dark:bg-amber-900">
                  <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${badgeProgress}%` }} />
                </div>
                <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">{daysToNext === 0 ? '곧 달성됩니다!' : `${daysToNext}일 더 이어가면 달성!`}</p>
              </section>
            )}

            <section>
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <p className="text-xs font-bold text-primary-600 dark:text-primary-400">성장 기록</p>
                  <h2 className="mt-1 text-lg font-black text-foreground-900 dark:text-white">말씀 배지</h2>
                </div>
                <p className="text-xs font-semibold text-foreground-500 dark:text-slate-400">{individual?.badges.length ?? 0}/{ALL_BADGES.length} 달성</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {ALL_BADGES.map((badge) => {
                  const earned = individual?.badges.some((b) => b.name === badge.name) ?? false;
                  return (
                    <div
                      key={badge.name}
                      title={badge.description}
                      className={`min-h-[132px] rounded-2xl border p-4 ${
                        earned
                          ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
                          : 'border-background-200 bg-background-100 dark:border-slate-800 dark:bg-slate-900'
                      }`}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${earned ? 'bg-amber-200 dark:bg-amber-900/70' : 'bg-background-200 dark:bg-slate-800'}`}>
                        <i className={`${badge.icon} text-lg ${earned ? 'text-amber-700 dark:text-amber-300' : 'text-foreground-400 dark:text-slate-500'}`} />
                      </div>
                      <p className={`mt-3 text-xs font-black leading-4 ${earned ? 'text-amber-900 dark:text-amber-100' : 'text-foreground-600 dark:text-slate-300'}`}>{badge.name}</p>
                      <p className="mt-1 text-[11px] font-semibold text-foreground-400 dark:text-slate-500">{badge.days}일</p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl border border-background-200 bg-background-100 p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-bold text-primary-600 dark:text-primary-400">스트릭 유지 방법</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Link to="/bible-marathon" className="flex min-h-14 items-center gap-3 rounded-2xl bg-background-50 px-4 active:scale-[0.99] dark:bg-slate-950">
                  <i className="ri-book-open-line text-lg text-primary-600 dark:text-primary-400" />
                  <span className="text-sm font-bold text-foreground-800 dark:text-slate-200">성경완독 묵상 등록</span>
                  <i className="ri-arrow-right-s-line ml-auto text-foreground-300 dark:text-slate-600" />
                </Link>
                <Link to="/bible-quiz" className="flex min-h-14 items-center gap-3 rounded-2xl bg-background-50 px-4 active:scale-[0.99] dark:bg-slate-950">
                  <i className="ri-question-line text-lg text-secondary-600 dark:text-secondary-400" />
                  <span className="text-sm font-bold text-foreground-800 dark:text-slate-200">성경퀴즈 풀기</span>
                  <i className="ri-arrow-right-s-line ml-auto text-foreground-300 dark:text-slate-600" />
                </Link>
              </div>
            </section>
          </motion.div>
        )}

        {tab === 'club' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-4 rounded-3xl border border-primary-100 bg-primary-50 p-5 dark:border-primary-900 dark:bg-primary-950/30">
              <p className="text-xs font-bold text-primary-700 dark:text-primary-300">동아리 전체 현황</p>
              <p className="mt-1 text-sm leading-5 text-primary-900 dark:text-primary-100">총 스트릭과 평균 연속일을 기준으로 동아리 순위를 보여줍니다.</p>
            </div>
            <div className="space-y-3">
              {clubOverall.length === 0 && (
                <div className="rounded-3xl border border-background-200 bg-background-100 p-8 text-center dark:border-slate-800 dark:bg-slate-900">
                  <i className="ri-bar-chart-grouped-line text-3xl text-foreground-300 dark:text-slate-600" />
                  <p className="mt-3 text-sm font-semibold text-foreground-500 dark:text-slate-400">아직 동아리 기록이 없어요.</p>
                </div>
              )}
              {clubOverall.map((club, idx) => {
                const info = CLUB_INFO[club.club_name] || CLUB_INFO['미지정'];
                const maxStreaks = clubOverall[0]?.total_streaks || 1;
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`;
                return (
                  <div key={club.club_name} className="rounded-3xl border border-background-200 bg-background-100 p-4 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center gap-3">
                      <div className="w-9 text-center text-sm font-black text-foreground-700 dark:text-slate-200">{medal}</div>
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: `${info.color}18` }}>
                        <i className={`${info.icon} text-lg`} style={{ color: info.color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-foreground-900 dark:text-white">{info.name}</p>
                        <p className="mt-0.5 text-xs text-foreground-500 dark:text-slate-400">{club.member_count}명 · 평균 {club.avg_streak}일</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-secondary-600 dark:text-secondary-400">{club.total_streaks.toLocaleString()}</p>
                        <p className="text-[11px] font-semibold text-foreground-400 dark:text-slate-500">총 스트릭</p>
                      </div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-background-200 dark:bg-slate-800">
                      <div className="h-full rounded-full" style={{ backgroundColor: info.color, width: `${Math.max(4, (club.total_streaks / maxStreaks) * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
