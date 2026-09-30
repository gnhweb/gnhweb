import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface MonthlyChampion {
  topClub: { club_name: string; total_score: number };
  topPlayer: { nickname: string; club_name: string; total_score: number };
}

interface MarathonClubChampion {
  club: string;
  label: string;
  chapters: number;
}

interface ConfirmedChampion {
  year: number;
  month: number;
  category: 'quiz' | 'marathon';
  club_key: string;
  club_label: string;
  value: number;
  extra: { topPlayerNickname?: string; topPlayerClub?: string; topPlayerScore?: number } | null;
}

interface HomeAwardsModalProps {
  showAwards: boolean;
  setShowAwards: (value: boolean) => void;
  confirmedQuiz: ConfirmedChampion | null;
  confirmedMarathon: ConfirmedChampion | null;
  monthlyChampion: MonthlyChampion | null;
  marathonChampion: MarathonClubChampion | null;
  setShowLeaderboard: (value: boolean) => void;
}

export default function HomeAwardsModal({
  showAwards,
  setShowAwards,
  confirmedQuiz,
  confirmedMarathon,
  monthlyChampion,
  marathonChampion,
  setShowLeaderboard,
}: HomeAwardsModalProps) {
  return (
<AnimatePresence>
  {showAwards && (
    <motion.div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-foreground-950/60 p-3 backdrop-blur-sm sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) setShowAwards(false); }}
    >
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="relative w-full max-w-lg overflow-hidden rounded-card border border-accent-300/30 bg-background-100 shadow-card-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="home-awards-title"
      >
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent-500/15 blur-2xl" />
        <div className="absolute -left-20 bottom-0 h-36 w-36 rounded-full bg-primary-500/10 blur-2xl" />
        <div className="relative max-h-[82dvh] overflow-y-auto p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-accent-500 text-white shadow-card"><i className="ri-trophy-fill text-xl" /></span>
              <div className="min-w-0"><p className="text-[10px] font-black tracking-[0.16em] text-accent-600 dark:text-accent-300">HONOR & RANKING</p><h2 id="home-awards-title" className="text-lg font-black text-foreground-950">수상 · 실시간 랭킹</h2></div>
            </div>
            <button type="button" onClick={() => setShowAwards(false)} aria-label="닫기" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background-200 text-foreground-600 transition-colors hover:bg-background-300 hover:text-foreground-950 active:scale-95"><i className="ri-close-line text-xl" /></button>
          </div>
          {(confirmedQuiz || confirmedMarathon) && (
            <div className="mt-5">
              <div className="mb-2.5 flex items-center justify-between gap-2"><p className="text-xs font-black text-foreground-800">{confirmedQuiz?.month ?? confirmedMarathon?.month}월 확정 수상</p><Link to="/hall-of-fame" onClick={() => setShowAwards(false)} className="text-[11px] font-bold text-accent-600 dark:text-accent-300">명예의 전당 <i className="ri-arrow-right-s-line" /></Link></div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {confirmedQuiz && <div className="rounded-card border border-accent-300/25 bg-background-50 dark:bg-background-200/70 p-3.5"><p className="flex items-center gap-1 text-[10px] font-bold text-accent-600 dark:text-accent-300"><i className="ri-trophy-fill" /> 성경퀴즈 1위</p><p className="mt-1 truncate text-base font-black text-foreground-950">{confirmedQuiz.club_label}</p><p className="mt-0.5 text-xs font-semibold text-foreground-600 dark:text-foreground-300">{confirmedQuiz.value.toLocaleString()}점</p></div>}
                {confirmedMarathon && <div className="rounded-card border border-primary-300/25 bg-background-50 dark:bg-background-200/70 p-3.5"><p className="flex items-center gap-1 text-[10px] font-bold text-primary-600 dark:text-primary-300"><i className="ri-book-open-fill" /> 성경완독 1위</p><p className="mt-1 truncate text-base font-black text-foreground-950">{confirmedMarathon.club_label}</p><p className="mt-0.5 text-xs font-semibold text-foreground-600 dark:text-foreground-300">{confirmedMarathon.value.toLocaleString()}장 완독</p></div>}
              </div>
            </div>
          )}
          <div className="mt-5 rounded-card border border-primary-300/25 bg-background-50 dark:bg-background-200/70 p-3.5">
            <div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-1.5"><span className="flex h-7 w-7 items-center justify-center rounded-card bg-primary-500 text-white"><i className="ri-bar-chart-grouped-line text-sm" /></span><p className="text-[10px] font-black tracking-[0.14em] text-primary-600 dark:text-primary-300">LIVE</p></div><p className="mt-1 text-base font-black text-foreground-950">{new Date().getMonth() + 1}월 실시간 성경 랭킹</p></div><span className="inline-flex items-center gap-1 rounded-chip bg-primary-100 px-2.5 py-1 text-[10px] font-black text-primary-700 dark:bg-primary-900/40 dark:text-primary-200"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-500" /> 실시간</span></div>
            <div className="mt-3 space-y-2">
              {monthlyChampion && <div className="flex items-center justify-between gap-3 rounded-card bg-gradient-to-r from-accent-500 to-accent-600 px-3.5 py-3 text-white"><div className="flex min-w-0 items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15"><i className="ri-trophy-fill" /></span><div className="min-w-0"><p className="text-[10px] font-bold text-white/75">성경퀴즈 1위</p><p className="truncate text-sm font-black">{monthlyChampion.topClub.club_name}</p></div></div><span className="shrink-0 text-sm font-black">{monthlyChampion.topClub.total_score.toLocaleString()}점</span></div>}
              {marathonChampion && <div className="flex items-center justify-between gap-3 rounded-card bg-gradient-to-r from-primary-500 to-primary-700 px-3.5 py-3 text-white"><div className="flex min-w-0 items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15"><i className="ri-book-open-fill" /></span><div className="min-w-0"><p className="text-[10px] font-bold text-white/75">성경완독 1위</p><p className="truncate text-sm font-black">{marathonChampion.label}</p></div></div><span className="shrink-0 text-sm font-black">{marathonChampion.chapters.toLocaleString()}장</span></div>}
            </div>
            <button type="button" onClick={() => { setShowAwards(false); setShowLeaderboard(true); }} className="mt-2.5 flex min-h-12 w-full items-center justify-between gap-3 rounded-card border border-primary-300/30 bg-background-100 px-3.5 text-left transition-all hover:border-primary-400/50 hover:shadow-card active:scale-[0.99]"><span className="flex min-w-0 items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300"><i className="ri-list-ordered-2 text-sm" /></span><span className="min-w-0"><span className="block text-sm font-black text-foreground-950">전체 리더보드 보기</span><span className="block truncate text-[10px] text-foreground-600 dark:text-foreground-300">전체 순위와 개인 기록을 확인해보세요</span></span></span><i className="ri-arrow-right-s-line shrink-0 text-lg text-primary-600 dark:text-primary-300" /></button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
  );
}
