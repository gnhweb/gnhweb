import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import DiaryComposer from '@/pages/faithDiary/components/DiaryComposer';
import DiaryTimeline from '@/pages/faithDiary/components/DiaryTimeline';
import AiQuestions from '@/pages/faithDiary/components/AiQuestions';
import WeeklySummary from '@/pages/faithDiary/components/WeeklySummary';
import {
  buildDiaryDays,
  buildWeekEntries,
  computeStreak,
  formatWeekLabel,
  getWeekDays,
  type FaithEntry,
  type StoryEvent,
  type RepentanceEntry,
  type DiaryFilter,
} from '@/pages/faithDiary/lib';

const FILTERS: { key: DiaryFilter; label: string; icon: string }[] = [
  { key: 'all', label: '전체', icon: 'ri-layout-grid-line' },
  { key: 'journal', label: '말씀 묵상', icon: 'ri-book-open-line' },
  { key: 'moment', label: '신앙의 순간', icon: 'ri-star-line' },
  { key: 'repentance', label: '회개와 기도', icon: 'ri-hand-heart-line' },
];

export default function FaithDiary() {
  const { user } = useAuth();
  const [journals, setJournals] = useState<FaithEntry[]>([]);
  const [moments, setMoments] = useState<StoryEvent[]>([]);
  const [repentances, setRepentances] = useState<RepentanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [filter, setFilter] = useState<DiaryFilter>('all');
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'journal' | 'moment' | 'repentance'; id: string; photoUrl?: string | null } | null>(null);

  useEffect(() => {
    if (user) load();
    else setLoading(false);
  }, [user]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [jRes, mRes, rRes] = await Promise.all([
        supabase.from('faith_journal_entries').select('*').eq('user_id', user.id),
        supabase.from('faith_storybooks').select('*').eq('author_id', user.id),
        supabase.from('repentance_journals').select('*').eq('author_id', user.id),
      ]);
      if (jRes.error) throw jRes.error;
      if (mRes.error) throw mRes.error;
      if (rRes.error) throw rRes.error;
      setJournals((jRes.data || []) as FaithEntry[]);
      setMoments((mRes.data || []) as StoryEvent[]);
      setRepentances((rRes.data || []) as RepentanceEntry[]);
    } catch {
      setError('신앙일기를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const days = useMemo(() => buildDiaryDays(journals, moments, repentances), [journals, moments, repentances]);

  const filteredDays = useMemo(() => {
    if (filter === 'all') return days;
    if (filter === 'journal') return days.filter(d => d.journals.length > 0);
    if (filter === 'moment') return days.filter(d => d.moments.length > 0);
    return days.filter(d => d.repentances.length > 0);
  }, [days, filter]);

  const stats = useMemo(() => {
    const dateStrs = days.map(d => d.date);
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return {
      total: days.length,
      thisMonth: dateStrs.filter(d => d.startsWith(prefix)).length,
      streak: computeStreak(dateStrs),
    };
  }, [days]);

  const week = useMemo(() => getWeekDays(), []);
  const weekEntries = useMemo(() => buildWeekEntries(days, week.days), [days, week.days]);
  const weekLabel = useMemo(() => formatWeekLabel(week.start, week.end), [week]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { kind, id, photoUrl } = confirmDelete;
    try {
      if (kind === 'journal') {
        const { error: e } = await supabase.from('faith_journal_entries').delete().eq('id', id);
        if (e) throw e;
        setJournals(prev => prev.filter(x => x.id !== id));
      } else if (kind === 'moment') {
        if (photoUrl) {
          try {
            const urlObj = new URL(photoUrl);
            const parts = urlObj.pathname.split('/');
            const bucketIndex = parts.findIndex(p => p === 'Public');
            if (bucketIndex !== -1) {
              await supabase.storage.from('Public').remove([parts.slice(bucketIndex + 1).join('/')]);
            }
          } catch { /* 사진 정리 실패는 무시 */ }
        }
        const { error: e } = await supabase.from('faith_storybooks').delete().eq('id', id);
        if (e) throw e;
        setMoments(prev => prev.filter(x => x.id !== id));
      } else {
        const { error: e } = await supabase.from('repentance_journals').delete().eq('id', id);
        if (e) throw e;
        setRepentances(prev => prev.filter(x => x.id !== id));
      }
    } catch {
      setError('삭제 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.');
    }
    setConfirmDelete(null);
  };

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 md:py-14">
        {/* 헤더 */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-gradient-to-br from-primary-500 to-accent-500 mb-5">
              <i className="ri-book-2-line text-3xl text-white"></i>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">신앙일기</h1>
            <p className="text-sm text-foreground-600 leading-relaxed">
              매일 한 번, 말씀 묵상 · 신앙의 순간 · 회개와 기도를<br className="md:hidden" /> 한 곳에 적어보세요
            </p>
            <p className="text-[11px] text-foreground-400 mt-2 inline-flex items-center gap-1">
              <i className="ri-lock-line"></i>
              나만 볼 수 있는 비공개 기록이에요
            </p>
          </div>

          {/* 스트릭 & 통계 */}
          <div className="grid grid-cols-3 gap-2.5 mb-6">
            <div className="rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 p-4 text-center">
              <p className="text-2xl md:text-3xl font-black text-white">{stats.streak}</p>
              <p className="text-[11px] font-semibold text-white/85 mt-1">연속 기록일</p>
            </div>
            <div className="rounded-2xl bg-background-100 border border-background-200 p-4 text-center">
              <p className="text-2xl md:text-3xl font-black text-primary-600">{stats.thisMonth}</p>
              <p className="text-[11px] font-semibold text-foreground-500 mt-1">이번 달 기록</p>
            </div>
            <div className="rounded-2xl bg-background-100 border border-background-200 p-4 text-center">
              <p className="text-2xl md:text-3xl font-black text-foreground-950">{stats.total}</p>
              <p className="text-[11px] font-semibold text-foreground-500 mt-1">전체 기록</p>
            </div>
          </div>

          {error && (
            <div className="bg-accent-100 border border-accent-200 rounded-[20px] p-4 mb-6">
              <p className="text-sm text-accent-700 flex items-center gap-2">
                <i className="ri-error-warning-line"></i>{error}
              </p>
              <button onClick={load} className="mt-2 text-xs text-accent-600 underline cursor-pointer">다시 시도</button>
            </div>
          )}

          {/* 작성 버튼 */}
          <button
            onClick={() => setShowComposer(true)}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-[20px] bg-primary-500 text-background-50 text-sm font-bold hover:bg-primary-600 transition-all cursor-pointer whitespace-nowrap mb-6"
          >
            <i className="ri-quill-pen-line text-base"></i> 오늘의 신앙일기 쓰기
          </button>

          {/* AI 추천 질문 */}
          <div className="mb-6">
            <AiQuestions />
          </div>

          {/* 이번 주 신앙 여정 AI 요약 */}
          <div className="mb-6">
            <WeeklySummary entries={weekEntries} weekLabel={weekLabel} weekKey={week.start} />
          </div>

          {/* 필터 (세그먼트 컨트롤) */}
          <div className="flex gap-1 p-1 rounded-full bg-background-100 border border-background-200 mb-6 overflow-x-auto scrollbar-hide">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  filter === f.key ? 'bg-primary-500 text-background-50' : 'text-foreground-500 hover:text-foreground-800'
                }`}
              >
                <i className={`${f.icon} text-sm`}></i>
                <span className="max-md:hidden">{f.label}</span>
                <span className="md:hidden">{f.label.split(' ')[0]}</span>
              </button>
            ))}
          </div>

          {/* 타임라인 */}
          {loading ? (
            <div className="text-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-primary-400 border-t-transparent animate-spin mx-auto"></div>
            </div>
          ) : filteredDays.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4">
                <i className="ri-book-2-line text-2xl text-primary-300"></i>
              </div>
              <p className="text-sm text-foreground-600 mb-1">
                {days.length === 0 ? '아직 기록이 없어요.' : '이 항목의 기록이 아직 없어요.'}
              </p>
              <p className="text-xs text-foreground-400">오늘의 신앙일기를 써보세요!</p>
            </div>
          ) : (
            <DiaryTimeline
              days={filteredDays}
              filter={filter}
              onDeleteJournal={id => setConfirmDelete({ kind: 'journal', id })}
              onDeleteMoment={(id, photoUrl) => setConfirmDelete({ kind: 'moment', id, photoUrl })}
              onDeleteRepentance={id => setConfirmDelete({ kind: 'repentance', id })}
            />
          )}
        </motion.div>
      </div>

      {/* 작성 모달 */}
      <AnimatePresence>
        {showComposer && user && (
          <DiaryComposer
            userId={user.id}
            onClose={() => setShowComposer(false)}
            onSaved={() => { setShowComposer(false); load(); }}
          />
        )}
      </AnimatePresence>

      {/* 삭제 확인 */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-background-50 rounded-[24px] p-6 w-full max-w-xs text-center"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center mx-auto mb-3">
                <i className="ri-delete-bin-line text-xl"></i>
              </div>
              <p className="text-base font-bold text-foreground-950 mb-1">기록을 삭제할까요?</p>
              <p className="text-xs text-foreground-500 mb-5">삭제한 기록은 되돌릴 수 없어요.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-full border border-background-200 text-sm font-medium text-foreground-600 hover:bg-background-100 cursor-pointer whitespace-nowrap">취소</button>
                <button onClick={handleDelete} className="flex-1 py-2.5 rounded-full bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 cursor-pointer whitespace-nowrap">삭제</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}