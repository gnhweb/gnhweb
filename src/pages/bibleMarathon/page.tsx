import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { CLUB_LABELS } from '@/types/auth';
import type { ClubType } from '@/types/auth';

const ALL_BOOKS: { name: string; short: string; total: number }[] = [
  { name: '창세기', short: '창', total: 50 }, { name: '출애굽기', short: '출', total: 40 }, { name: '레위기', short: '레', total: 27 },
  { name: '민수기', short: '민', total: 36 }, { name: '신명기', short: '신', total: 34 }, { name: '여호수아', short: '수', total: 24 },
  { name: '사사기', short: '삿', total: 21 }, { name: '룻기', short: '룻', total: 4 }, { name: '사무엘상', short: '삼상', total: 31 },
  { name: '사무엘하', short: '삼하', total: 24 }, { name: '열왕기상', short: '왕상', total: 22 }, { name: '열왕기하', short: '왕하', total: 25 },
  { name: '역대상', short: '대상', total: 29 }, { name: '역대하', short: '대하', total: 36 }, { name: '에스라', short: '스', total: 10 },
  { name: '느헤미야', short: '느', total: 13 }, { name: '에스더', short: '에', total: 10 }, { name: '욥기', short: '욥', total: 42 },
  { name: '시편', short: '시', total: 150 }, { name: '잠언', short: '잠', total: 31 }, { name: '전도서', short: '전', total: 12 },
  { name: '아가', short: '아', total: 8 }, { name: '이사야', short: '사', total: 66 }, { name: '예레미야', short: '렘', total: 52 },
  { name: '예레미야애가', short: '애', total: 5 }, { name: '에스겔', short: '겔', total: 48 }, { name: '다니엘', short: '단', total: 12 },
  { name: '호세아', short: '호', total: 14 }, { name: '요엘', short: '욜', total: 3 }, { name: '아모스', short: '암', total: 9 },
  { name: '오바댜', short: '옵', total: 1 }, { name: '요나', short: '욘', total: 4 }, { name: '미가', short: '미', total: 7 },
  { name: '나훔', short: '나', total: 3 }, { name: '하박국', short: '합', total: 3 }, { name: '스바냐', short: '습', total: 3 },
  { name: '학개', short: '학', total: 2 }, { name: '스가랴', short: '슥', total: 14 }, { name: '말라기', short: '말', total: 4 },
  { name: '마태복음', short: '마', total: 28 }, { name: '마가복음', short: '막', total: 16 }, { name: '누가복음', short: '눅', total: 24 },
  { name: '요한복음', short: '요', total: 21 }, { name: '사도행전', short: '행', total: 28 }, { name: '로마서', short: '롬', total: 16 },
  { name: '고린도전서', short: '고전', total: 16 }, { name: '고린도후서', short: '고후', total: 13 }, { name: '갈라디아서', short: '갈', total: 6 },
  { name: '에베소서', short: '엡', total: 6 }, { name: '빌립보서', short: '빌', total: 4 }, { name: '골로새서', short: '골', total: 4 },
  { name: '데살로니가전서', short: '살전', total: 5 }, { name: '데살로니가후서', short: '살후', total: 3 }, { name: '디모데전서', short: '딤전', total: 6 },
  { name: '디모데후서', short: '딤후', total: 4 }, { name: '디도서', short: '딛', total: 3 }, { name: '빌레몬서', short: '몬', total: 1 },
  { name: '히브리서', short: '히', total: 13 }, { name: '야고보서', short: '약', total: 5 }, { name: '베드로전서', short: '벧전', total: 5 },
  { name: '베드로후서', short: '벧후', total: 3 }, { name: '요한일서', short: '요일', total: 5 }, { name: '요한이서', short: '요이', total: 1 },
  { name: '요한삼서', short: '요삼', total: 1 }, { name: '유다서', short: '유', total: 1 }, { name: '요한계시록', short: '계', total: 22 },
];

const TOTAL_CHAPTERS = ALL_BOOKS.reduce((sum, b) => sum + b.total, 0);

/** 레벨 정의 */
const LEVELS = [
  { name: '말씀 씨앗', min: 0, icon: 'ri-seedling-line', color: 'text-emerald-600', bg: 'bg-emerald-100' },
  { name: '말씀 새싹', min: 50, icon: 'ri-plant-line', color: 'text-green-600', bg: 'bg-green-100' },
  { name: '말씀 나무', min: 150, icon: 'ri-tree-line', color: 'text-teal-600', bg: 'bg-teal-100' },
  { name: '말씀 숲', min: 300, icon: 'ri-landscape-line', color: 'text-cyan-600', bg: 'bg-cyan-100' },
  { name: '말씀 산', min: 500, icon: 'ri-flag-line', color: 'text-sky-600', bg: 'bg-sky-100' },
  { name: '말씀 우주', min: 800, icon: 'ri-planet-line', color: 'text-indigo-600', bg: 'bg-indigo-100' },
  { name: '말씀 완성', min: 1189, icon: 'ri-star-smile-line', color: 'text-amber-600', bg: 'bg-amber-100' },
];

/** 업적 배지 정의 (16개로 확장) */
const ACHIEVEMENTS = [
  { id: 'first_read', name: '첫 묵상', desc: '첫 번째 묵상을 등록했어요', icon: 'ri-bookmark-line', threshold: 1 },
  { id: 'five_chapters', name: '다섯 장의 시작', desc: '5장 확정 완료', icon: 'ri-book-2-line', threshold: 5 },
  { id: 'ten_days', name: '열흘의 말씀', desc: '10일 연속 묵상 등록', icon: 'ri-calendar-check-line', threshold: 10 },
  { id: 'twenty_chapters', name: '스무 장의 여정', desc: '20장 확정 완료', icon: 'ri-book-read-line', threshold: 20 },
  { id: 'thirty_days', name: '한 달의 약속', desc: '30일 연속 묵상 등록', icon: 'ri-fire-line', threshold: 30 },
  { id: 'fifty_chapters', name: '반백 장 도전', desc: '50장 확정 완료', icon: 'ri-book-3-line', threshold: 50 },
  { id: 'three_books', name: '세 권 완독', desc: '3권의 성경을 완독했어요', icon: 'ri-book-open-line', threshold: 3 },
  { id: 'hundred_chapters', name: '백 장 정복', desc: '100장 확정 완료', icon: 'ri-medal-line', threshold: 100 },
  { id: 'five_books', name: '다섯 권 완독', desc: '5권의 책을 완독했어요', icon: 'ri-book-3-line', threshold: 5 },
  { id: 'two_hundred', name: '이백 장 도약', desc: '200장 확정 완료', icon: 'ri-rocket-line', threshold: 200 },
  { id: 'ten_books', name: '열 권 정복', desc: '10권의 성경을 완독했어요', icon: 'ri-stack-line', threshold: 10 },
  { id: 'five_hundred', name: '오백 장 기적', desc: '500장 확정 완료', icon: 'ri-trophy-line', threshold: 500 },
  { id: 'twenty_books', name: '스무 권의 지혜', desc: '20권의 성경을 완독했어요', icon: 'ri-book-2-line', threshold: 20 },
  { id: 'old_testament', name: '구약 정복자', desc: '구약 39권 완독', icon: 'ri-shield-star-line', threshold: 39 },
  { id: 'thousand', name: '천 장의 여정', desc: '1000장 확정 완료', icon: 'ri-star-line', threshold: 1000 },
  { id: 'full_bible', name: '신구약 완독', desc: '신구약 66권 1189장 완독!', icon: 'ri-vip-crown-line', threshold: 66 },
];

interface MarathonEntry {
  id: string;
  user_id: string;
  student_name: string;
  student_club: string;
  book: string;
  chapter: string;
  chapter_start: number;
  chapter_end: number;
  status: 'pending' | 'confirmed' | 'rejected';
  confirmed_by?: string;
  confirmed_at?: string;
  created_at: string;
}

function chapterLabel(start: number, end: number): string {
  if (start === end) return `${start}장`;
  return `${start}-${end}장`;
}

/** 현재 레벨 계산 */
function getLevel(confirmed: number) {
  return [...LEVELS].reverse().find(l => confirmed >= l.min) || LEVELS[0];
}

/** 다음 레벨까지 남은 장 수 */
function getNextLevel(confirmed: number) {
  const currentIdx = LEVELS.findIndex(l => confirmed < l.min);
  if (currentIdx === -1) return null;
  const next = LEVELS[currentIdx];
  const prev = LEVELS[currentIdx - 1] || { min: 0 };
  return { name: next.name, icon: next.icon, current: confirmed - prev.min, total: next.min - prev.min };
}

export default function BibleMarathon() {
  const { user, profile, hasRole } = useAuth();
  const isTeacherOrChief = user && (hasRole('teacher') || hasRole('chief'));
  const isChief = hasRole('chief');
  const assignedClub = profile?.assigned_teacher_id as ClubType | undefined;

  const [entries, setEntries] = useState<MarathonEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedBook, setSelectedBook] = useState('');
  const [chapterStart, setChapterStart] = useState(1);
  const [chapterEnd, setChapterEnd] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');
  const [clubFilter, setClubFilter] = useState<'all' | ClubType>('all');
  const [selectedBookName, setSelectedBookName] = useState<string | null>(null);

  const [tab, setTab] = useState<'progress' | 'achievements'>('progress');

  const selectedBookTotal = ALL_BOOKS.find(b => b.name === selectedBook)?.total ?? 1;

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('bible_marathon_entries')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setEntries((data as MarathonEntry[]) || []);
    } catch {
      setError('데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  // Supabase Realtime: 실시간 데이터 동기화
  useEffect(() => {
    const channel = supabase
      .channel('bible-marathon-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bible_marathon_entries' },
        () => { loadEntries(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadEntries]);

  const handleBookChange = (bookName: string) => {
    setSelectedBook(bookName);
    setChapterStart(1);
    const total = ALL_BOOKS.find(b => b.name === bookName)?.total ?? 1;
    setChapterEnd(total);
  };

  const handleSubmitReading = async () => {
    if (!selectedBook || !chapterStart || !chapterEnd || !profile || submitting) return;
    if (chapterStart > chapterEnd) {
      setError('시작 장이 끝 장보다 클 수 없습니다.');
      return;
    }
    if (chapterEnd > selectedBookTotal) {
      setError(`${selectedBook}은(는) ${selectedBookTotal}장까지 있습니다.`);
      return;
    }

    setSubmitting(true);
    setError(null);
    setSubmitMsg('');

    try {
      const label = chapterLabel(chapterStart, chapterEnd);
      const { error: insertErr } = await supabase
        .from('bible_marathon_entries')
        .insert({
          user_id: user!.id,
          student_name: profile.name,
          student_club: profile.club || null,
          book: selectedBook,
          chapter: label,
          chapter_start: chapterStart,
          chapter_end: chapterEnd,
          status: isTeacherOrChief ? 'confirmed' : 'pending',
        });

      if (insertErr) throw insertErr;
      if (isTeacherOrChief) {
        // 자동 확정(교사/부장 본인 등록)이므로 이 시점에 바로 스트릭 반영
        supabase.functions.invoke('bible-streak-update', { body: { userId: user!.id } }).catch(() => {});
      }
      setSelectedBook('');
      setChapterStart(1);
      setChapterEnd(1);
      setSubmitMsg(isTeacherOrChief
        ? '묵상 완료가 등록되었어요! 자동으로 확정 처리되어 게이지에 반영됩니다.'
        : '묵상 완료가 등록되었어요! 담당 교사님 확인 후 게이지에 반영됩니다.'
      );
      await loadEntries();
    } catch {
      setSubmitMsg('');
      setError('등록 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const sendNotification = async (targetUserId: string, type: string, title: string, message: string, linkUrl: string) => {
    try {
      await supabase.from('notifications').insert({
        user_id: targetUserId,
        type,
        title,
        message,
        is_read: false,
        link_url: linkUrl,
      });
    } catch { /* noop */ }
  };

  const handleTeacherConfirm = async (entry: MarathonEntry) => {
    if (!profile) return;
    try {
      const { error: updateErr } = await supabase
        .from('bible_marathon_entries')
        .update({ status: 'confirmed', confirmed_by: profile.name, confirmed_at: new Date().toISOString() })
        .eq('id', entry.id);
      if (updateErr) throw updateErr;
      supabase.functions.invoke('bible-streak-update', { body: { userId: entry.user_id } }).catch(() => {});
      await sendNotification(entry.user_id, 'bible_confirm', '묵상 확인 완료', `${profile.name} 선생님이 ${entry.book} ${entry.chapter} 묵상을 확인했습니다.`, '/bible-marathon');
      await loadEntries();
    } catch { setError('확인 처리 중 오류가 발생했습니다.'); }
  };

  const handleTeacherReject = async (entry: MarathonEntry) => {
    if (!profile) return;
    try {
      const { error: updateErr } = await supabase
        .from('bible_marathon_entries')
        .update({ status: 'rejected', confirmed_by: profile.name, confirmed_at: new Date().toISOString() })
        .eq('id', entry.id);
      if (updateErr) throw updateErr;
      await sendNotification(entry.user_id, 'bible_reject', '묵상 반려', `${profile.name} 선생님이 ${entry.book} ${entry.chapter} 묵상을 반려했습니다.`, '/bible-marathon');
      await loadEntries();
    } catch { setError('반려 처리 중 오류가 발생했습니다.'); }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('정말 이 등록을 삭제할까요? 삭제 즉시 게이지에서 제외됩니다.')) return;
    try {
      const { error: deleteErr } = await supabase.from('bible_marathon_entries').delete().eq('id', entryId);
      if (deleteErr) throw deleteErr;
      await loadEntries();
    } catch { setError('삭제 중 오류가 발생했습니다.'); }
  };

  const bookProgress = ALL_BOOKS.map(book => {
    const confirmedEntries = entries.filter(e => e.book === book.name && e.status === 'confirmed');
    const confirmedSet = new Set<number>();
    confirmedEntries.forEach(e => {
      for (let c = (e.chapter_start ?? 1); c <= (e.chapter_end ?? e.chapter_start ?? 1); c++) {
        if (c <= book.total) confirmedSet.add(c);
      }
    });
    return { ...book, confirmed: confirmedSet.size };
  });

  const totalConfirmed = bookProgress.reduce((sum, b) => sum + b.confirmed, 0);
  const percentage = TOTAL_CHAPTERS > 0 ? Math.round((totalConfirmed / TOTAL_CHAPTERS) * 100) : 0;

  const goalEndDate = '2026-12-31';
  const daysLeft = Math.max(0, Math.ceil((new Date(goalEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));

  const allPending = entries.filter(e => e.status === 'pending');

  const filteredPending = (() => {
    if (!isTeacherOrChief) return [];
    if (isChief && clubFilter === 'all') return allPending;
    const targetClub = isChief ? clubFilter : assignedClub;
    if (targetClub && targetClub !== 'all') return allPending.filter(e => e.student_club === targetClub);
    return allPending;
  })();

  const allClubs = [...new Set(entries.map(e => e.student_club).filter(Boolean))] as ClubType[];

  // ── 게이미피케이션: 스트릭 계산 ──
  const myEntries = entries.filter(e => e.user_id === user?.id && e.status === 'confirmed');
  const streak = (() => {
    if (myEntries.length === 0) return 0;
    const dates = [...new Set(myEntries.map(e => e.created_at.split('T')[0]))].sort().reverse();
    let count = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const firstDate = new Date(dates[0]);
    firstDate.setHours(0, 0, 0, 0);
    const oneDay = 24 * 60 * 60 * 1000;
    const daysDiff = Math.floor((today.getTime() - firstDate.getTime()) / oneDay);
    if (daysDiff > 1) return 0;

    const checkDate = daysDiff === 0 ? today : yesterday;
    for (let i = 0; i < dates.length; i++) {
      const d = new Date(dates[i]);
      d.setHours(0, 0, 0, 0);
      const expected = new Date(checkDate);
      expected.setDate(expected.getDate() - i);
      if (d.getTime() === expected.getTime()) count++;
      else break;
    }
    return count;
  })();

  // ── 레벨 ──
  const level = getLevel(totalConfirmed);
  const nextLevel = getNextLevel(totalConfirmed);

  // ── 업적 ──
  const completedBooks = bookProgress.filter(b => b.confirmed === b.total).length;
  const unlockedAchievements = ACHIEVEMENTS.filter(a => {
    if (a.id === 'first_read') return totalConfirmed >= 1;
    if (a.id === 'five_chapters') return totalConfirmed >= 5;
    if (a.id === 'ten_days') return streak >= 10;
    if (a.id === 'twenty_chapters') return totalConfirmed >= 20;
    if (a.id === 'thirty_days') return streak >= 30;
    if (a.id === 'fifty_chapters') return totalConfirmed >= 50;
    if (a.id === 'three_books') return completedBooks >= 3;
    if (a.id === 'hundred_chapters') return totalConfirmed >= 100;
    if (a.id === 'five_books') return completedBooks >= 5;
    if (a.id === 'two_hundred') return totalConfirmed >= 200;
    if (a.id === 'ten_books') return completedBooks >= 10;
    if (a.id === 'five_hundred') return totalConfirmed >= 500;
    if (a.id === 'twenty_books') return completedBooks >= 20;
    if (a.id === 'old_testament') return completedBooks >= 39;
    if (a.id === 'thousand') return totalConfirmed >= 1000;
    if (a.id === 'full_bible') return completedBooks >= 66;
    return false;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-amber-100 border border-amber-200 mb-5">
              <i className="ri-book-open-line text-3xl text-amber-600"></i>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">성경 완독 마라톤</h1>
            <p className="text-sm text-foreground-600">
              신구약 {ALL_BOOKS.length}권 {TOTAL_CHAPTERS}장 — 장 단위로 정확하게 등록하고 진행률을 확인하세요!
            </p>
          </div>

          {/* ── 게이미피케이션 대시보드 ── */}
          {user && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-background-100 border border-background-200 rounded-[20px] p-5 mb-6"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                {/* 레벨 */}
                <div className={`${level.bg} rounded-2xl p-4 text-center`}>
                  <i className={`${level.icon} text-2xl ${level.color} mb-1 block`}></i>
                  <p className="text-[10px] text-foreground-500 font-medium uppercase tracking-wider">레벨</p>
                  <p className={`text-sm font-black ${level.color}`}>{level.name}</p>
                </div>

                {/* 스트릭 */}
                <div className="bg-amber-50 rounded-2xl p-4 text-center">
                  <motion.i
                    className="ri-fire-line text-2xl text-amber-500 mb-1 block"
                    animate={{ scale: streak > 0 ? [1, 1.15, 1] : 1 }}
                    transition={{ duration: 1.5, repeat: streak > 0 ? Infinity : 0 }}
                  ></motion.i>
                  <p className="text-[10px] text-foreground-500 font-medium uppercase tracking-wider">연속 묵상</p>
                  <p className="text-sm font-black text-amber-600">{streak}일</p>
                </div>

                {/* 포인트(장 수) */}
                <div className="bg-emerald-50 rounded-2xl p-4 text-center">
                  <i className="ri-check-double-line text-2xl text-emerald-500 mb-1 block"></i>
                  <p className="text-[10px] text-foreground-500 font-medium uppercase tracking-wider">확정 장수</p>
                  <p className="text-sm font-black text-emerald-600">{totalConfirmed.toLocaleString()}</p>
                </div>

                {/* 업적 개수 */}
                <div className="bg-violet-50 rounded-2xl p-4 text-center">
                  <i className="ri-trophy-line text-2xl text-violet-500 mb-1 block"></i>
                  <p className="text-[10px] text-foreground-500 font-medium uppercase tracking-wider">획득 업적</p>
                  <p className="text-sm font-black text-violet-600">{unlockedAchievements.length}/{ACHIEVEMENTS.length}</p>
                </div>
              </div>

              {/* 레벨 진행 바 */}
              {nextLevel && (
                <div className="bg-background-50 rounded-xl p-3 border border-background-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <i className={`${nextLevel.icon} text-xs text-foreground-500`}></i>
                      <span className="text-xs text-foreground-600">
                        다음 레벨: <strong>{nextLevel.name}</strong>
                      </span>
                    </div>
                    <span className="text-xs text-foreground-500">
                      {nextLevel.current}/{nextLevel.total}장
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-background-200 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (nextLevel.current / nextLevel.total) * 100)}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600"
                    ></motion.div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* 탭: 진행현황 / 업적 */}
          {user && (
            <div className="flex mx-auto mb-6 bg-background-100 rounded-full p-1 max-w-xs">
              <button onClick={() => setTab('progress')} className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${tab === 'progress' ? 'bg-amber-500 text-background-50' : 'text-foreground-500'}`}>
                진행 현황
              </button>
              <button onClick={() => setTab('achievements')} className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${tab === 'achievements' ? 'bg-amber-500 text-background-50' : 'text-foreground-500'}`}>
                업적 배지
              </button>
            </div>
          )}

          {/* 업적 탭 */}
          {tab === 'achievements' && user && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {ACHIEVEMENTS.map(ach => {
                  const unlocked = unlockedAchievements.some(u => u.id === ach.id);
                  return (
                    <motion.div
                      key={ach.id}
                      whileHover={{ scale: unlocked ? 1.05 : 1 }}
                      className={`rounded-2xl p-4 text-center border-2 transition-all ${
                        unlocked ? 'bg-amber-50 border-amber-300' : 'bg-background-100 border-background-200 opacity-50'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${
                        unlocked ? 'bg-amber-200' : 'bg-background-200'
                      }`}>
                        <i className={`${ach.icon} text-xl ${unlocked ? 'text-amber-700' : 'text-foreground-400'}`}></i>
                      </div>
                      <p className={`text-xs font-bold ${unlocked ? 'text-amber-800' : 'text-foreground-500'}`}>
                        {ach.name}
                      </p>
                      <p className="text-[10px] text-foreground-500 mt-0.5 leading-tight">{ach.desc}</p>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* 진행 현황 탭 */}
          {tab === 'progress' && (
            <>
              {/* Overall progress — 원형 프로그레스 링 */}
              <div className="bg-background-100 border border-background-200 rounded-[20px] p-6 mb-6 text-center">
                <p className="text-xs text-foreground-600 mb-4">전체 완독률 (교사 확인 기준 · 장 단위 집계)</p>
                <div className="relative w-36 h-36 mx-auto mb-3">
                  <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="12" className="text-background-200" />
                    <motion.circle
                      cx="60" cy="60" r="52" fill="none" strokeWidth="12" strokeLinecap="round"
                      stroke="url(#marathon-ring-gradient)"
                      strokeDasharray={2 * Math.PI * 52}
                      initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - percentage / 100) }}
                      transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                    />
                    <defs>
                      <linearGradient id="marathon-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#fbbf24" />
                        <stop offset="100%" stopColor="#f59e0b" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <motion.div
                    className="absolute inset-0 flex flex-col items-center justify-center"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  >
                    <span className="text-3xl font-black text-amber-600">{percentage}%</span>
                    <span className="text-[10px] text-foreground-400 mt-0.5">완독</span>
                  </motion.div>
                </div>
                <div className="flex items-center justify-center gap-4 text-xs text-foreground-600">
                  <span>{totalConfirmed}/{TOTAL_CHAPTERS}장 확정</span>
                  <span className="text-amber-600 font-semibold">{daysLeft}일 남음</span>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-accent-100 border border-accent-200 rounded-[20px] p-4 mb-6">
                  <p className="text-sm text-accent-700 flex items-center gap-2"><i className="ri-error-warning-line"></i>{error}</p>
                  <button onClick={() => { setError(null); loadEntries(); }} className="mt-2 text-xs text-accent-600 underline cursor-pointer">다시 시도</button>
                </div>
              )}

              {/* Registration form */}
              {user && (
                <div className="bg-background-100 border border-background-200 rounded-[20px] p-5 mb-6">
                  <h3 className="text-sm font-bold text-foreground-950 mb-3 flex items-center gap-2">
                    <i className="ri-bookmark-line text-amber-600"></i>
                    묵상 완료 등록 {isTeacherOrChief && <span className="text-xs font-normal text-emerald-600">(자동 확정)</span>}
                  </h3>
                  <div className="space-y-3">
                    <select value={selectedBook} onChange={e => handleBookChange(e.target.value)} className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:border-amber-400 cursor-pointer bg-background-100">
                      <option value="">읽은 성경 책 선택</option>
                      {ALL_BOOKS.map(b => (<option key={b.name} value={b.name}>{b.name} ({b.total}장)</option>))}
                    </select>
                    {selectedBook && (
                      <div className="bg-amber-50 rounded-xl p-4 space-y-3">
                        <p className="text-xs text-foreground-600"><strong>{selectedBook}</strong>은(는) 총 <strong>{selectedBookTotal}장</strong>입니다.</p>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <label className="text-[10px] text-foreground-500 mb-1 block">시작 장</label>
                            <select value={chapterStart} onChange={e => { const v = Number(e.target.value); setChapterStart(v); if (v > chapterEnd) setChapterEnd(v); }} className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 outline-none focus:border-amber-400 cursor-pointer bg-background-100">
                              {Array.from({ length: selectedBookTotal }, (_, i) => i + 1).map(n => (<option key={n} value={n}>{n}장</option>))}
                            </select>
                          </div>
                          <span className="text-foreground-400 pt-5">~</span>
                          <div className="flex-1">
                            <label className="text-[10px] text-foreground-500 mb-1 block">끝 장</label>
                            <select value={chapterEnd} onChange={e => setChapterEnd(Number(e.target.value))} className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 outline-none focus:border-amber-400 cursor-pointer bg-background-100">
                              {Array.from({ length: selectedBookTotal }, (_, i) => i + 1).filter(n => n >= chapterStart).map(n => (<option key={n} value={n}>{n}장</option>))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                    <button onClick={handleSubmitReading} disabled={!selectedBook || submitting} className="w-full py-2.5 rounded-full bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-40 cursor-pointer whitespace-nowrap">
                      {submitting ? '등록 중...' : '묵상 완료 등록하기'}
                    </button>
                  </div>
                  {submitMsg && (<div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">{submitMsg}</div>)}
                </div>
              )}

              {/* My entries */}
              {user && (
                <div className="bg-background-100 border border-background-200 rounded-[20px] p-5 mb-6">
                  <h3 className="text-sm font-bold text-foreground-950 mb-3 flex items-center gap-2"><i className="ri-file-list-3-line text-amber-600"></i>내 등록 내역</h3>
                  {myEntries.length === 0 ? (
                    <p className="text-sm text-foreground-600 text-center py-4">아직 등록한 묵상이 없습니다.</p>
                  ) : (
                    <div className="space-y-2">
                      {myEntries.slice(0, 20).map(entry => (
                        <div key={entry.id} className="flex items-center justify-between bg-background-100 rounded-xl p-3 border border-gray-100">
                          <div>
                            <p className="text-sm font-medium text-foreground-800">{entry.book} {entry.chapter}</p>
                            <p className="text-[10px] text-foreground-500">{new Date(entry.created_at).toLocaleString('ko-KR')}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                              entry.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : entry.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {entry.status === 'confirmed' ? '확인됨' : entry.status === 'rejected' ? '반려됨' : '대기 중'}
                            </span>
                            <button onClick={() => handleDeleteEntry(entry.id)} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-rose-50 text-gray-400 hover:text-rose-500 transition-colors cursor-pointer" title="삭제">
                              <i className="ri-delete-bin-line text-xs"></i>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Teacher confirmations */}
              {isTeacherOrChief && (
                <div className="bg-background-100 border border-amber-200 rounded-[20px] p-5 mb-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                    <h3 className="text-sm font-bold text-foreground-950 flex items-center gap-2"><i className="ri-check-double-line text-amber-600"></i>확인 대기 중인 묵상 ({filteredPending.length}건)</h3>
                    {(assignedClub || isChief) && allClubs.length > 0 && (
                      <div className="flex items-center gap-1 bg-background-200/70 rounded-full p-1 flex-shrink-0">
                        <button onClick={() => setClubFilter('all')} className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${clubFilter === 'all' ? 'bg-background-100 text-foreground-950 shadow-sm' : 'text-foreground-600 hover:text-foreground-950'}`}>전체</button>
                        {allClubs.map(c => (
                          <button key={c} onClick={() => setClubFilter(c)} className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${clubFilter === c ? 'bg-background-100 text-foreground-950 shadow-sm' : 'text-foreground-600 hover:text-foreground-950'}`}>
                            {CLUB_LABELS[c].split(' ')[0]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {filteredPending.length === 0 ? (
                    <p className="text-sm text-foreground-600 text-center py-4">확인 대기 중인 묵상이 없습니다.</p>
                  ) : (
                    <div className="space-y-2">
                      {filteredPending.map(entry => (
                        <div key={entry.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-amber-50 rounded-xl p-3 gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap"><p className="text-sm font-semibold text-foreground-950">{entry.student_name}</p>{entry.student_club && <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-700 font-medium">{CLUB_LABELS[entry.student_club as ClubType]?.split(' ')[0]}</span>}</div>
                            <p className="text-xs text-foreground-600">{entry.book} — {entry.chapter}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => handleTeacherConfirm(entry)} className="px-3 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 cursor-pointer whitespace-nowrap">확인</button>
                            <button onClick={() => handleTeacherReject(entry)} className="px-3 py-1.5 rounded-full bg-rose-100 text-rose-600 text-xs font-medium hover:bg-rose-200 cursor-pointer whitespace-nowrap">반려</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Club competition */}
              <div className="bg-background-100 border border-background-200 rounded-[20px] p-5 mb-6">
                <h3 className="text-sm font-bold text-foreground-950 mb-4 flex items-center gap-2"><i className="ri-trophy-line text-amber-500"></i>동아리별 완독 순위</h3>
                {(() => {
                  const clubStats = new Map<string, Set<string>>();
                  entries.filter(e => e.status === 'confirmed' && e.student_club).forEach(e => {
                    if (!clubStats.has(e.student_club!)) clubStats.set(e.student_club!, new Set());
                    const book = ALL_BOOKS.find(b => b.name === e.book);
                    if (!book) return;
                    const s = e.chapter_start ?? 1;
                    const e2 = e.chapter_end ?? s;
                    const set = clubStats.get(e.student_club!)!;
                    for (let c = s; c <= Math.min(e2, book.total); c++) set.add(`${book.name}:${c}`);
                  });
                  const ranked = Array.from(clubStats.entries()).map(([club, set]) => ({ club, chapters: set.size, label: CLUB_LABELS[club as ClubType] || club })).sort((a, b) => b.chapters - a.chapters);
                  if (ranked.length === 0) return <p className="text-sm text-foreground-600 text-center py-4">아직 확정된 묵상 데이터가 없습니다.</p>;
                  const maxChapters = ranked[0]?.chapters || 1;
                  return (
                    <div className="space-y-2">
                      {ranked.map((item, idx) => (
                        <div
                          key={item.club}
                          className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${
                            idx === 0 ? 'bg-gradient-to-r from-amber-100 to-amber-50 border border-amber-200' :
                            idx === 1 ? 'bg-background-50 border border-background-200' :
                            idx === 2 ? 'bg-amber-50/60 border border-amber-100' : ''
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${idx === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white' : idx === 1 ? 'bg-gray-300 text-gray-700' : idx === 2 ? 'bg-amber-200 text-amber-800' : 'bg-background-200 text-foreground-600'}`}>
                            {idx < 3 ? <i className={idx === 0 ? 'ri-medal-fill' : 'ri-medal-line'}></i> : idx + 1}
                          </div>
                          <span className="text-sm font-semibold text-foreground-800 w-20 flex-shrink-0">{item.label.split(' ')[0]}</span>
                          <div className="flex-1 h-3 rounded-full bg-background-200 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500" style={{ width: `${maxChapters > 0 ? (item.chapters / maxChapters) * 100 : 0}%` }}></div>
                          </div>
                          <span className="text-xs font-bold text-amber-700 w-16 text-right flex-shrink-0">{item.chapters}장</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Book progress — "잔디 그래프" 느낌의 타일 그리드 */}
              <div className="bg-background-100 border border-background-200 rounded-[20px] p-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-bold text-foreground-700">책별 진행 현황 ({ALL_BOOKS.length}권 · 장 단위)</h3>
                </div>
                <div className="flex items-center gap-3 mb-3 text-[10px] text-foreground-400">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-background-300 inline-block"></span>미시작</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-300 inline-block"></span>진행중</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-600 inline-block"></span>완료</span>
                </div>
                <div className="grid grid-cols-8 gap-1.5">
                  {bookProgress.map((book) => {
                    const bookPct = book.total > 0 ? book.confirmed / book.total : 0;
                    const done = book.confirmed === book.total;
                    const started = book.confirmed > 0;
                    const isSelected = selectedBookName === book.name;
                    return (
                      <motion.button
                        key={book.name}
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setSelectedBookName(prev => prev === book.name ? null : book.name)}
                        title={`${book.name} · ${book.confirmed}/${book.total}장 (${Math.round(bookPct * 100)}%)`}
                        className={`aspect-square rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                          done ? 'bg-amber-600' : started ? (bookPct > 0.5 ? 'bg-amber-400' : 'bg-amber-200') : 'bg-background-300'
                        } ${isSelected ? 'ring-2 ring-primary-400 ring-offset-1 ring-offset-background-100' : ''}`}
                      >
                        {done ? (
                          <i className="ri-check-line text-white text-[9px]"></i>
                        ) : (
                          <span className={`text-[9px] font-semibold leading-none ${started ? 'text-amber-900' : 'text-foreground-500'}`}>
                            {book.short}
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
                {selectedBookName && (() => {
                  const b = bookProgress.find(x => x.name === selectedBookName);
                  if (!b) return null;
                  const pct = b.total > 0 ? Math.round((b.confirmed / b.total) * 100) : 0;
                  return (
                    <div className="mt-3 flex items-center justify-between px-3 py-2 rounded-xl bg-background-50 border border-background-200 text-xs">
                      <span className="font-bold text-foreground-800">{b.name}</span>
                      <span className="text-foreground-600">{b.confirmed}/{b.total}장 · {pct}%</span>
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
