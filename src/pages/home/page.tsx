import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clubs } from '@/mocks/clubs';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { getCachedQuoteOfTheDay, fetchAndCacheQuoteOfTheDay } from '@/lib/dailyQuote';
import { todayKey, formatKoreanDate } from '@/lib/date';
import { CLUB_LABELS } from '@/types/auth';
import type { ClubType } from '@/types/auth';

// ──────────────────────────────────────────────
// 타입
// ──────────────────────────────────────────────
interface Notice {
  id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  author_name: string | null;
  category: string | null;
}

interface AttendanceSummary {
  attended: number;
  absent: number;
  total: number;
}

interface Schedule {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  location: string | null;
  target_club: string | null;
}

interface MonthlyChampion {
  topClub: { club_name: string; total_score: number };
  topPlayer: { nickname: string; club_name: string; total_score: number };
}

interface MarathonClubChampion {
  club: string;
  label: string;
  chapters: number;
}

interface NewsItem {
  id: string;
  title: string;
  content: string;
  author_name: string;
  category: string;
  created_at: string;
}

const CLUB_ICON_MAP: Record<string, string> = {
  saeullim: 'ri-music-line',
  cheonjipoong: 'ri-flag-line',
  cheonjihu: 'ri-heart-pulse-line',
  munhwabu: 'ri-camera-lens-line',
  cheonhwarae_cheongmyeong: 'ri-mic-line',
};

const NOTICE_READS_KEY = 'notice_reads';
const QUIZ_LEADERBOARD_CACHE_KEY = 'home_quiz_leaderboard_v1';
const QUIZ_LEADERBOARD_CACHE_TTL_MS = 10 * 60 * 1000;

interface QuizLeaderboardCache {
  expiresAt: number;
  data: MonthlyChampion;
}

function readQuizLeaderboardCache(): MonthlyChampion | null {
  try {
    const raw = localStorage.getItem(QUIZ_LEADERBOARD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuizLeaderboardCache;
    if (parsed?.expiresAt > Date.now() && parsed.data?.topClub && parsed.data?.topPlayer) {
      return parsed.data;
    }
  } catch {
    // ignore cache errors
  }
  return null;
}

function writeQuizLeaderboardCache(data: MonthlyChampion) {
  try {
    localStorage.setItem(
      QUIZ_LEADERBOARD_CACHE_KEY,
      JSON.stringify({ expiresAt: Date.now() + QUIZ_LEADERBOARD_CACHE_TTL_MS, data }),
    );
  } catch {
    // ignore cache errors
  }
}

const MARATHON_CHAMPION_CACHE_KEY = 'home_marathon_champion_v1';
const MARATHON_CHAMPION_CACHE_TTL_MS = 10 * 60 * 1000;

interface MarathonChampionCache {
  expiresAt: number;
  data: MarathonClubChampion;
}

function readMarathonChampionCache(): MarathonClubChampion | null {
  try {
    const raw = localStorage.getItem(MARATHON_CHAMPION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MarathonChampionCache;
    if (parsed?.expiresAt > Date.now() && parsed.data?.club) {
      return parsed.data;
    }
  } catch {
    // ignore cache errors
  }
  return null;
}

function writeMarathonChampionCache(data: MarathonClubChampion) {
  try {
    localStorage.setItem(
      MARATHON_CHAMPION_CACHE_KEY,
      JSON.stringify({ expiresAt: Date.now() + MARATHON_CHAMPION_CACHE_TTL_MS, data }),
    );
  } catch {
    // ignore cache errors
  }
}

function noticeReadsKey(userId?: string | null): string {
  return userId ? `${NOTICE_READS_KEY}:${userId}` : NOTICE_READS_KEY;
}

function getReadNoticeIds(userId?: string | null): Set<string> {
  try {
    const raw = localStorage.getItem(noticeReadsKey(userId));
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch { /* ignore */ }
  return new Set();
}

function markNoticeAsRead(noticeId: string, userId?: string | null) {
  try {
    const current = getReadNoticeIds(userId);
    current.add(noticeId);
    localStorage.setItem(noticeReadsKey(userId), JSON.stringify([...current]));
  } catch { /* ignore */ }
}

// ──────────────────────────────────────────────
// 날짜 포맷 헬퍼
// ──────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}일 전`;
  return `${Math.floor(day / 7)}주 전`;
}

const CATEGORY_COLOR_MAP: Record<string, { bg: string; text: string; icon: string; chip: string }> = {
  '긴급': { bg: 'bg-rose-100', text: 'text-rose-600', icon: 'ri-alarm-warning-line', chip: 'bg-rose-100 text-rose-700' },
  '행사': { bg: 'bg-emerald-100', text: 'text-emerald-600', icon: 'ri-calendar-event-line', chip: 'bg-emerald-100 text-emerald-700' },
  '모집': { bg: 'bg-amber-100', text: 'text-amber-600', icon: 'ri-user-add-line', chip: 'bg-amber-100 text-amber-700' },
  '교육': { bg: 'bg-sky-100', text: 'text-sky-600', icon: 'ri-book-open-line', chip: 'bg-sky-100 text-sky-700' },
  '기도제목': { bg: 'bg-violet-100', text: 'text-violet-600', icon: 'ri-hand-heart-line', chip: 'bg-violet-100 text-violet-700' },
  '일반': { bg: 'bg-background-200', text: 'text-foreground-500', icon: 'ri-megaphone-line', chip: 'bg-background-200 text-foreground-600' },
};

function getCategoryColor(category: string | null) {
  if (!category) return CATEGORY_COLOR_MAP['일반'];
  return CATEGORY_COLOR_MAP[category] || CATEGORY_COLOR_MAP['일반'];
}

function formatDateShort(dateStr: string) {
  return formatKoreanDate(dateStr, { month: 'numeric', day: 'numeric' }).replace(/\s/g, '');
}

// ──────────────────────────────────────────────
// 달력 헬퍼
// ──────────────────────────────────────────────
interface CalendarDay {
  day: number;
  dateStr: string;
  isToday: boolean;
  isCurrentMonth: boolean;
  events: Schedule[];
}

function getCalendarDays(year: number, month: number, schedules: Schedule[]): CalendarDay[] {
  const days: CalendarDay[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const prevLastDay = new Date(year, month, 0);

  const today = new Date();
  const todayStr = todayKey();

  // Prev month fill
  const startDayOfWeek = firstDay.getDay();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = prevLastDay.getDate() - i;
    const dateStr = `${year}-${String(month === 0 ? 12 : month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({
      day: d,
      dateStr,
      isToday: false,
      isCurrentMonth: false,
      events: schedules.filter(s => s.event_date === dateStr),
    });
  }

  // Current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({
      day: d,
      dateStr,
      isToday: dateStr === todayStr,
      isCurrentMonth: true,
      events: schedules.filter(s => s.event_date === dateStr),
    });
  }

  // Next month fill
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      days.push({
        day: d,
        dateStr: '',
        isToday: false,
        isCurrentMonth: false,
        events: [],
      });
    }
  }

  return days;
}

// ──────────────────────────────────────────────
// 히어로 캐러셀 슬라이드
// ──────────────────────────────────────────────
interface HeroSlide {
  id: string;
  type: 'main' | 'notice' | 'champion' | 'quiz' | 'feature';
  image: string;
  badge?: string;
  badgeColor?: string;
  title: string;
  subtitle: string;
  cta?: { label: string; path: string };
}

// ──────────────────────────────────────────────
// 메인 컴포넌트
// ──────────────────────────────────────────────
export default function Home() {
  const { user, profile, hasRole } = useAuth();
  const navigate = useNavigate();

  const [notices, setNotices] = useState<Notice[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [monthlyChampion, setMonthlyChampion] = useState<MonthlyChampion | null>(null);
  const [marathonChampion, setMarathonChampion] = useState<MarathonClubChampion | null>(null);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [noticesLoading, setNoticesLoading] = useState(true);
  const [noticesError, setNoticesError] = useState(false);
  const [schedulesLoading, setSchedulesLoading] = useState(true);
  const [schedulesError, setSchedulesError] = useState(false);
  const [clubBannerMap, setClubBannerMap] = useState<Record<string, { card_image_url: string | null }>>({}); 
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [attendanceError, setAttendanceError] = useState(false);
  const [allMembersTotal, setAllMembersTotal] = useState(0);
  const attendanceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);;

  // 모바일: 공지·일정·강학뉴스를 세로로 다 펼치지 않고 탭으로 전환해서 봄
  const [homeTab, setHomeTab] = useState<'notice' | 'schedule' | 'news'>('notice');

  // 달력
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(todayKey());
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  // 캐러셀
  const [slideIndex, setSlideIndex] = useState(0);
  // 우선 캐시(또는 정적 데이터) 기준으로 즉시 표시한 뒤, DB에서 최신 활성 어록 목록을
  // (하루 1회만) 불러와 갱신합니다. 실패 시에는 정적 QUOTES 배열 기준 값을 그대로 유지합니다.
  const [dailyQuote, setDailyQuote] = useState(() => getCachedQuoteOfTheDay());
  const [direction, setDirection] = useState(0);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);

  // 오늘의 어록 - DB에서 최신 활성 어록 목록을 가져와 갱신 (하루 1회만 실제 조회, 실패 시 폴백 유지)
  useEffect(() => {
    fetchAndCacheQuoteOfTheDay().then(setDailyQuote);
  }, []);

  // ── 이달의 동아리 챔피언(성경퀴즈 · 성경완독) 실시간 로드 ──
  // 캐시는 초기 페인트를 빠르게 하기 위한 용도일 뿐, 마운트 시 항상 최신 데이터를 다시 가져오고
  // 이후에는 Supabase Realtime 구독으로 데이터가 바뀔 때마다 즉시 갱신한다.
  const loadQuizChampion = useCallback(() => {
    supabase.functions.invoke('quiz-leaderboard', {
      method: 'GET',
      body: { monthly: 'true' },
    }).then(({ data }) => {
      if (data?.topClub && data?.topPlayer) {
        const result = { topClub: data.topClub, topPlayer: data.topPlayer } as MonthlyChampion;
        setMonthlyChampion(result);
        writeQuizLeaderboardCache(result);
      } else {
        // 이번 달 데이터가 아직 없으면(=달이 막 바뀐 직후) 지난 달 챔피언을 계속 보여주지 않도록 비움
        setMonthlyChampion(null);
      }
    }).catch(() => {});
  }, []);

  const loadMarathonChampion = useCallback(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
    supabase
      .from('bible_marathon_entries')
      .select('student_club, book, chapter_start, chapter_end, status, confirmed_at')
      .eq('status', 'confirmed')
      .gte('confirmed_at', monthStart)
      .lt('confirmed_at', monthEnd)
      .then(({ data }) => {
        if (!data || data.length === 0) {
          setMarathonChampion(null);
          return;
        }
        const clubChapterSets = new Map<string, Set<string>>();
        (data as { student_club: string | null; book: string; chapter_start: number | null; chapter_end: number | null }[]).forEach((e) => {
          if (!e.student_club) return;
          const start = e.chapter_start ?? 1;
          const end = e.chapter_end ?? start;
          if (!clubChapterSets.has(e.student_club)) clubChapterSets.set(e.student_club, new Set());
          const set = clubChapterSets.get(e.student_club)!;
          for (let c = start; c <= end; c++) set.add(`${e.book}:${c}`);
        });
        const ranked = Array.from(clubChapterSets.entries())
          .map(([club, set]) => ({ club, chapters: set.size, label: CLUB_LABELS[club as ClubType] || club }))
          .sort((a, b) => b.chapters - a.chapters);
        if (ranked.length > 0) {
          setMarathonChampion(ranked[0]);
          writeMarathonChampionCache(ranked[0]);
        } else {
          setMarathonChampion(null);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // 캐시가 있으면 즉시 화면에 먼저 보여주고, 뒤이어 최신 데이터로 덮어쓴다
    const cachedLeaderboard = readQuizLeaderboardCache();
    if (cachedLeaderboard) setMonthlyChampion(cachedLeaderboard);
    const cachedMarathon = readMarathonChampionCache();
    if (cachedMarathon) setMarathonChampion(cachedMarathon);

    loadQuizChampion();
    loadMarathonChampion();

    // 실시간 반영: 퀴즈 점수나 완독 등록/확정이 생기면 곧바로 동아리 랭킹을 다시 계산
    const quizChannel = supabase
      .channel('home-quiz-champion-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_scores' }, () => loadQuizChampion())
      .subscribe();
    const marathonChannel = supabase
      .channel('home-marathon-champion-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bible_marathon_entries' }, () => loadMarathonChampion())
      .subscribe();

    // 매달 자정에 정확히 새 달로 결산되도록, 다음 자정에 맞춰 강제로 다시 계산 (그 이후엔 24시간마다 반복)
    let midnightInterval: ReturnType<typeof setInterval> | null = null;
    const msUntilNextMidnight = (() => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
      return nextMidnight.getTime() - now.getTime();
    })();
    const midnightTimeout = setTimeout(() => {
      loadQuizChampion();
      loadMarathonChampion();
      midnightInterval = setInterval(() => {
        loadQuizChampion();
        loadMarathonChampion();
      }, 24 * 60 * 60 * 1000);
    }, msUntilNextMidnight);

    return () => {
      supabase.removeChannel(quizChannel);
      supabase.removeChannel(marathonChannel);
      clearTimeout(midnightTimeout);
      if (midnightInterval) clearInterval(midnightInterval);
    };
  }, [loadQuizChampion, loadMarathonChampion]);

  // ── 데이터 패치 ──
  useEffect(() => {
    // 공지사항
    Promise.resolve(
      supabase
        .from('notices')
        .select('id, title, content, is_pinned, created_at, author_name, category')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(4)
    )
      .then(({ data }) => {
        if (data) setNotices(data);
      })
      .catch(() => setNoticesError(true))
      .finally(() => setNoticesLoading(false));

    // 일정
    const todayStr = todayKey();
    Promise.resolve(
      supabase
        .from('schedules')
        .select('id, title, description, event_date, event_time, location, target_club')
        .gte('event_date', todayStr)
        .order('event_date', { ascending: true })
        .limit(30)
    )
      .then(({ data }) => {
        if (data) setSchedules(data);
      })
      .catch(() => setSchedulesError(true))
      .finally(() => setSchedulesLoading(false));

    // 강학뉴스
    Promise.resolve(
      supabase
        .from('ganghak_news')
        .select('id, title, content, author_name, category, created_at')
        .order('created_at', { ascending: false })
        .limit(4)
    )
      .then(({ data }) => {
        if (data) setNewsItems(data);
      })
      .catch(() => {});

    // 동아리 배너 이미지 (card)
    Promise.resolve(
      supabase
        .from('club_banners')
        .select('club, card_image_url')
    )
      .then(({ data }) => {
        if (data) {
          const map: Record<string, { card_image_url: string | null }> = {};
          data.forEach((b: { club: string; card_image_url: string | null }) => {
            map[b.club] = { card_image_url: b.card_image_url };
          });
          setClubBannerMap(map);
        }
      })
      .catch(() => {});
  }, []);

  // ── 히어로 슬라이드 구성 ──
  // 산만하지 않도록 핵심 슬라이드만 남김: 인트로, 이달의 챔피언(있을 때), 말씀뽑기, 성경퀴즈, 동아리 소개.
  // 공지·일정·게시판·신앙일지·출결 등은 바로 아래 섹션과 하단 메뉴에서 이미 확인할 수 있어 배너에서는 제외.
  const heroSlides: HeroSlide[] = [
    {
      id: 'main', type: 'main',
      image: '/hero/main.svg',
      badge: '강릉 학생회', badgeColor: 'bg-primary-500',
      title: '스스로 신앙하는\n거침없는 강릉 학생회',
      subtitle: '말씀과 찬양, 동아리 활동을 통해\n전국 1등 학생회로 함께 성장합니다',
      cta: { label: '동아리 둘러보기', path: '/clubs' },
    },
    ...(monthlyChampion
      ? [{
          id: 'champion-quiz', type: 'champion' as const,
          image: '/hero/champion.svg',
          badge: `${new Date().getMonth() + 1}월 성경퀴즈 1위`, badgeColor: 'bg-amber-500',
          title: `이달의 성경퀴즈 1위 동아리\n${monthlyChampion.topClub.club_name}`,
          subtitle: monthlyChampion.topPlayer ? `개인 MVP: ${monthlyChampion.topPlayer.nickname} (${monthlyChampion.topPlayer.club_name}) · ${monthlyChampion.topClub.total_score.toLocaleString()}점` : `누적 ${monthlyChampion.topClub.total_score.toLocaleString()}점 · 실시간 랭킹 진행 중`,
          cta: { label: '성경퀴즈 도전하기', path: '/bible-quiz' },
        }]
      : []),
    ...(marathonChampion
      ? [{
          id: 'champion-marathon', type: 'champion' as const,
          image: '/hero/champion.svg',
          badge: `${new Date().getMonth() + 1}월 성경완독 1위`, badgeColor: 'bg-emerald-500',
          title: `이달의 성경완독 1위 동아리\n${marathonChampion.label}`,
          subtitle: `${marathonChampion.chapters.toLocaleString()}장 완독 · 실시간 랭킹 진행 중`,
          cta: { label: '성경완독 도전하기', path: '/bible-marathon' },
        }]
      : []),
    {
      id: 'bible-pick', type: 'quiz',
      image: '/hero/bible-pick.svg',
      badge: '오늘의 말씀', badgeColor: 'bg-amber-500',
      title: '말씀뽑기로\n오늘의 말씀을 받으세요',
      subtitle: 'AI가 감정과 상황에 맞는\n성경 구절을 선물해드립니다',
      cta: { label: '말씀 받기', path: '/bible-pick' },
    },
    {
      id: 'quiz', type: 'quiz',
      image: '/hero/quiz.svg',
      badge: '성경 퀴즈', badgeColor: 'bg-rose-500',
      title: '성경 퀴즈에 도전해서\n믿음을 더 깊게!',
      subtitle: '600개 문제 데이터베이스에서\n동아리별 랭킹을 겨뤄보세요',
      cta: { label: '퀴즈 시작하기', path: '/bible-quiz' },
    },
    {
      id: 'clubs', type: 'feature',
      image: '/hero/clubs.svg',
      badge: '동아리', badgeColor: 'bg-emerald-500',
      title: '다섯 동아리,\n각자의 사명으로 함께 성장해요',
      subtitle: '동아리 소개와 명단, 활동 사진까지\n우리 동아리의 이야기를 만나보세요',
      cta: { label: '동아리 둘러보기', path: '/clubs' },
    },
  ];

  const heroImages: Record<string, string> = {
    notice: '/hero/notice.svg',
    schedule: '/hero/schedule.svg',
    clubs: '/hero/clubs.svg',
    qna: '/hero/qna.svg',
    'faith-journal': '/hero/faith-journal.svg',
    attendance: '/hero/attendance.svg',
    'bible-pick': '/hero/bible-pick.svg',
    champion: '/hero/champion.svg',
    quiz: '/hero/quiz.svg',
  };

  const heroGradients: Record<string, string> = {
    main: 'from-amber-700 via-amber-600 to-orange-800',
    'bible-pick': 'from-emerald-700 via-teal-600 to-emerald-900',
    champion: 'from-amber-600 via-yellow-500 to-amber-800',
    'champion-quiz': 'from-amber-600 via-yellow-500 to-amber-800',
    'champion-marathon': 'from-emerald-600 via-teal-500 to-emerald-800',
    quiz: 'from-rose-600 via-pink-500 to-rose-800',
    notice: 'from-rose-700 via-fuchsia-600 to-violet-800',
    schedule: 'from-sky-700 via-indigo-600 to-violet-800',
    clubs: 'from-emerald-700 via-teal-600 to-cyan-800',
    qna: 'from-sky-700 via-blue-600 to-indigo-800',
    'faith-journal': 'from-violet-700 via-fuchsia-600 to-pink-800',
    attendance: 'from-pink-700 via-rose-600 to-orange-700',
  };

  // ── 캐러셀 ──
  const startAuto = useCallback(() => {
    if (autoRef.current) clearInterval(autoRef.current);
    autoRef.current = setInterval(() => {
      setDirection(1);
      setSlideIndex(prev => (prev + 1) % heroSlides.length);
    }, 5000);
  }, [heroSlides.length]);

  useEffect(() => {
    startAuto();
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, [startAuto]);

  const goToSlide = (idx: number) => { setDirection(idx > slideIndex ? 1 : -1); setSlideIndex(idx); startAuto(); };
  const prevSlide = () => { setDirection(-1); setSlideIndex(prev => (prev - 1 + heroSlides.length) % heroSlides.length); startAuto(); };
  const nextSlide = () => { setDirection(1); setSlideIndex(prev => (prev + 1) % heroSlides.length); startAuto(); };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchEndX.current = touchStartX.current;
    touchEndY.current = touchStartY.current;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    touchEndY.current = e.changedTouches[0].clientY;
    const diffX = touchStartX.current - touchEndX.current;
    const diffY = touchStartY.current - touchEndY.current;
    // 세로 스크롤은 캐러셀 전환으로 오인하지 않도록 수평 이동이 더 큰 경우에만 처리
    if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY) * 1.25) {
      if (diffX > 0) nextSlide(); else prevSlide();
    }
  };

  // ── 출석 현황 로드 ──
  const loadAttendanceSummary = useCallback(async () => {
    const todayStr = todayKey();
    try {
      const [{ data: attData }, { count: totalMembers }] = await Promise.all([
        supabase.from('attendance').select('status').eq('attendance_date', todayStr),
        supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('is_active', true).eq('approval_status', 'approved').not('role', 'in', '("teacher","chief")'),
      ]);
      const attended = (attData || []).filter((r: { status: string }) => r.status === 'attended').length;
      const absent = (attData || []).filter((r: { status: string }) => r.status === 'absent').length;
      const total = totalMembers || 0;
      setAllMembersTotal(total);
      setAttendanceSummary({ attended, absent, total });
    } catch {
      setAttendanceError(true);
    }
  }, []);

  useEffect(() => {
    loadAttendanceSummary();
    const todayStr = todayKey();
    const channel = supabase
      .channel('home-attendance-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance', filter: `attendance_date=eq.${todayStr}` }, () => loadAttendanceSummary())
      .subscribe();
    attendanceChannelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [loadAttendanceSummary]);

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? '-100%' : '100%', opacity: 0 }),
  };

  // 달력 데이터
  const calendarDays = getCalendarDays(calYear, calMonth, schedules);
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const selectedDateEvents = selectedDate ? schedules.filter(s => s.event_date === selectedDate) : [];

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(calYear - 1); setCalMonth(11); }
    else setCalMonth(calMonth - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(calYear + 1); setCalMonth(0); }
    else setCalMonth(calMonth + 1);
  };

  // ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background-50 pb-24 md:pb-0">

      {/* ═══ 1. 히어로 캐러셀 ═══ */}
      <section
        className="relative h-[clamp(240px,38vh,360px)] md:h-[560px] overflow-hidden bg-foreground-950 touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <AnimatePresence custom={direction} initial={false}>
          <motion.div
            key={heroSlides[slideIndex].id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'tween', duration: 0.45, ease: 'easeInOut' }}
            className={`absolute inset-0 ${(heroSlides[slideIndex].image || heroImages[heroSlides[slideIndex].id]) ? '' : 'bg-gradient-to-br ' + (heroGradients[heroSlides[slideIndex].id] || heroGradients.main)}`}
          >
            {(heroSlides[slideIndex].image || heroImages[heroSlides[slideIndex].id]) && (
              <img
                src={heroSlides[slideIndex].image || heroImages[heroSlides[slideIndex].id]}
                alt={heroSlides[slideIndex].title}
                className="absolute inset-0 w-full h-full object-cover object-center bg-foreground-950"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/60"></div>
            <div className="absolute inset-0 flex items-end justify-center px-3 pb-14 sm:px-4 sm:pb-16 md:pb-16">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }} className="text-center max-w-xl w-full">
                {heroSlides[slideIndex].badge && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-bold text-white mb-2 sm:mb-3 ${heroSlides[slideIndex].badgeColor}`}>
                    <i className={{
                      main: 'ri-map-pin-line',
                      notice: 'ri-megaphone-line',
                      schedule: 'ri-calendar-event-line',
                      clubs: 'ri-group-line',
                      'bible-pick': 'ri-book-open-line',
                      champion: 'ri-trophy-line',
                      'champion-quiz': 'ri-trophy-line',
                      'champion-marathon': 'ri-book-open-line',
                      quiz: 'ri-question-answer-line',
                      qna: 'ri-question-answer-line',
                      'faith-journal': 'ri-edit-line',
                      attendance: 'ri-checkbox-circle-line',
                    }[heroSlides[slideIndex].id] || 'ri-sparkling-line'}></i>
                    {heroSlides[slideIndex].badge}
                  </span>
                )}
                <h1 className="text-[1.2rem] min-[360px]:text-[1.3rem] sm:text-2xl md:text-4xl font-black text-white leading-[1.25] mb-1.5 md:mb-2 whitespace-pre-line drop-shadow-lg">{heroSlides[slideIndex].title}</h1>
                <p className="text-[11px] min-[360px]:text-xs sm:text-sm md:text-base text-white/85 mb-3.5 sm:mb-4 md:mb-5 whitespace-pre-line leading-[1.45]">{heroSlides[slideIndex].subtitle}</p>
                {heroSlides[slideIndex].cta && (
                  <Link to={heroSlides[slideIndex].cta!.path} className="inline-flex items-center gap-1.5 px-4 py-2 sm:px-5 sm:py-2.5 rounded-full bg-background-100 text-foreground-950 text-[12px] sm:text-sm font-bold hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap shadow-lg">
                    {heroSlides[slideIndex].cta!.label} <i className="ri-arrow-right-line"></i>
                  </Link>
                )}
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>
        <button onClick={prevSlide} className="absolute left-3 md:left-5 top-1/2 -translate-y-1/2 w-9 h-9 md:w-11 md:h-11 rounded-full bg-background-100/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-background-100/35 transition-colors cursor-pointer z-10"><i className="ri-arrow-left-s-line text-xl"></i></button>
        <button onClick={nextSlide} className="absolute right-3 md:right-5 top-1/2 -translate-y-1/2 w-9 h-9 md:w-11 md:h-11 rounded-full bg-background-100/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-background-100/35 transition-colors cursor-pointer z-10"><i className="ri-arrow-right-s-line text-xl"></i></button>
        <div className="absolute bottom-2.5 sm:bottom-3 md:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10 bg-black/30 backdrop-blur-sm rounded-full px-2.5 py-1.5 max-w-[calc(100%-24px)]">
          <span className="text-[10px] md:text-xs font-semibold text-white/90 tabular-nums">{slideIndex + 1} / {heroSlides.length}</span>
          <div className="flex items-center gap-1.5">
            {heroSlides.map((_, i) => (
              <button key={i} aria-label={`${i + 1}번 슬라이드로 이동`} onClick={() => goToSlide(i)} className={`rounded-full transition-all duration-300 cursor-pointer ${i === slideIndex ? 'w-5 h-2 bg-background-100' : 'w-1.5 h-1.5 bg-background-100/45 hover:bg-background-100/70'}`} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 1.5 오늘의 어록 ═══ */}
      <section className="w-full max-w-6xl mx-auto px-2.5 min-[360px]:px-3 sm:px-4 md:px-6 mt-5 md:mt-6">
        <div className="relative overflow-hidden rounded-[1.25rem] bg-gradient-to-br from-primary-500 via-primary-600 to-primary-800 px-4 py-5 min-[360px]:px-5 sm:px-6 md:px-8 md:py-8 shadow-sm">
          <i className="ri-double-quotes-l absolute -top-3 right-1 min-[360px]:right-2 sm:right-4 md:right-6 text-white/15 text-[5.5rem] min-[360px]:text-[6.5rem] md:text-[7rem] pointer-events-none"></i>

          {/* 헤더는 한 줄로 묶고, 본문은 카드 전체 폭을 사용해 모바일 좌측 여백을 최소화 */}
          <div className="relative flex items-center gap-2.5 min-[360px]:gap-3 md:gap-3.5 mb-3 min-[360px]:mb-3.5 md:mb-5">
            <span className="flex w-10 h-10 min-[360px]:w-11 min-[360px]:h-11 md:w-12 md:h-12 flex-shrink-0 items-center justify-center rounded-xl bg-white/15 border border-white/20 shadow-inner">
              <i className="ri-book-open-line text-white text-base min-[360px]:text-lg md:text-xl"></i>
            </span>
            <p className="text-[clamp(0.7rem,2.8vw,0.8rem)] font-black tracking-[0.16em] text-white/90">오늘의 어록</p>
          </div>

          <div className="relative min-w-0">
            <span aria-hidden="true" className="absolute -left-0.5 -top-2 min-[360px]:-left-1 min-[360px]:-top-3 md:-left-1.5 md:-top-4 font-serif text-2xl min-[360px]:text-3xl md:text-4xl font-black text-white/35 leading-none">“</span>
            <p
              className="font-quote text-[clamp(1.04rem,4.6vw,1.44rem)] font-extrabold text-white leading-[1.72] min-[360px]:leading-[1.78] md:leading-[1.88] whitespace-pre-line break-keep tracking-[0.01em] drop-shadow-[0_1px_1px_rgba(0,0,0,0.22)] pl-3 min-[360px]:pl-4 md:pl-5"
              style={{
                fontFamily: '"Noto Serif KR", "Nanum Myeongjo", "AppleMyungjo", "Batang", ui-serif, Georgia, "Times New Roman", serif',
                fontWeight: 800,
                fontStyle: 'normal',
                fontSynthesis: 'weight',
                letterSpacing: '0.01em',
                textShadow: '0 1px 1px rgba(0,0,0,0.16)',
                WebkitTextStroke: '0.15px rgba(255,255,255,0.22)'
              }}
            >
              {dailyQuote}
            </p>
            <div className="mt-3 min-[360px]:mt-3.5 md:mt-4 h-px w-full bg-white/55 rounded-full" />
          </div>
        </div>
      </section>

      {/* ═══ 2. 공지사항 + 달력 그리드 ═══ */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 mt-8 mb-8">
        {/* 모바일 전용: 공지 · 일정 · 강학뉴스 탭 — 세로로 다 펼치지 않고 하나씩 전환 */}
        <div className="lg:hidden flex items-center gap-1 mb-4 bg-background-100 border border-background-200 rounded-full p-1">
          {[
            { key: 'notice' as const, label: '공지', icon: 'ri-megaphone-line' },
            { key: 'schedule' as const, label: '일정', icon: 'ri-calendar-event-line' },
            { key: 'news' as const, label: '강학뉴스', icon: 'ri-newspaper-line' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setHomeTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                homeTab === t.key ? 'bg-background-50 text-primary-700 shadow-sm' : 'text-foreground-500'
              }`}
            >
              <i className={t.icon}></i>{t.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* ── 공지사항 ── */}
          <div className={`lg:col-span-3 ${homeTab === 'notice' ? 'block' : 'hidden'} lg:block`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground-950 flex items-center gap-2">
                <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-primary-100"><i className="ri-megaphone-line text-primary-600 text-sm"></i></span>
                최신 공지사항
              </h2>
              <Link to="/notices" className="text-xs text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-0.5 whitespace-nowrap cursor-pointer">전체보기 <i className="ri-arrow-right-s-line text-sm"></i></Link>
            </div>
            <div className="space-y-2">
              {noticesLoading ? (
                <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-primary-300 border-t-transparent rounded-full animate-spin mx-auto"></div></div>
              ) : noticesError ? (
                <div className="p-6 text-center bg-background-100 rounded-2xl border border-background-200">
                  <p className="text-sm text-accent-600">공지사항을 불러오는 중 문제가 발생했어요</p>
                  <button onClick={() => { setNoticesError(false); setNoticesLoading(true); }} className="mt-2 text-xs text-accent-500 underline cursor-pointer">다시 시도</button>
                </div>
              ) : notices.length === 0 ? (
                <div className="p-6 text-center bg-background-100 rounded-2xl border border-background-200 text-foreground-400 text-sm">등록된 공지사항이 없습니다</div>
              ) : (
                <>
                {/* 모바일 전용: 인스타 스토리처럼 원형으로 훑어보는 최근 공지 링 */}
                <div className="lg:hidden flex gap-3 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1 mb-1 snap-x">
                  {notices.slice(0, 6).map((notice) => {
                    const readIds = getReadNoticeIds(user?.id);
                    const isRead = readIds.has(notice.id);
                    const catColor = getCategoryColor(notice.category);
                    return (
                      <button
                        key={`story-${notice.id}`}
                        onClick={() => navigate(`/notices/${notice.id}`)}
                        className="flex-shrink-0 snap-start flex flex-col items-center gap-1 w-16 cursor-pointer active:scale-95 transition-transform"
                      >
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center p-[2px] ${isRead ? 'bg-background-200' : 'bg-gradient-to-br from-primary-500 to-accent-500'}`}>
                          <div className={`w-full h-full rounded-full flex items-center justify-center border-2 border-white ${catColor.bg}`}>
                            <i className={`${catColor.icon} text-lg ${catColor.text}`}></i>
                          </div>
                        </div>
                        <span className="text-[10px] text-foreground-600 truncate w-full text-center">{notice.category || '공지'}</span>
                      </button>
                    );
                  })}
                </div>
                {notices.map((notice) => {
                  const readIds = getReadNoticeIds(user?.id);
                  const isNew = !readIds.has(notice.id) && (Date.now() - new Date(notice.created_at).getTime()) < 7 * 24 * 60 * 60 * 1000;
                  const catColor = getCategoryColor(notice.category);
                  return (
                    <Link
                      key={notice.id}
                      to={`/notices/${notice.id}`}
                      className={`group flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer hover:scale-[1.01] hover:shadow-sm ${
                        notice.is_pinned
                          ? 'bg-primary-50 border-primary-200 hover:border-primary-300'
                          : 'bg-background-100 border-background-200 hover:border-primary-200'
                      }`}
                    >
                      <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mt-0.5 ${catColor.bg}`}>
                        <i className={`${catColor.icon} text-sm ${catColor.text}`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          {notice.is_pinned && (
                            <span className="text-[9px] font-bold text-primary-700 bg-primary-100 px-1.5 py-0.5 rounded-full">공지</span>
                          )}
                          {notice.category && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${catColor.chip}`}>{notice.category}</span>
                          )}
                          {isNew && (
                            <span className="text-[9px] font-bold text-white bg-rose-500 px-1.5 py-0.5 rounded-full">NEW</span>
                          )}
                        </div>
                        <p className={`text-sm font-semibold truncate group-hover:text-primary-700 transition-colors ${
                          notice.is_pinned ? 'text-primary-800' : 'text-foreground-900'
                        }`}>{notice.title}</p>
                        <p className="text-[11px] text-foreground-400 mt-0.5">
                          {notice.author_name && <span>{notice.author_name} · </span>}{timeAgo(notice.created_at)}
                        </p>
                      </div>
                      <i className="ri-arrow-right-s-line text-foreground-300 group-hover:text-primary-400 flex-shrink-0 mt-2 transition-colors"></i>
                    </Link>
                  );
                })}
                </>
              )}
            </div>
          </div>

          {/* ── 달력 ── */}
          <div className={`lg:col-span-2 ${homeTab === 'schedule' ? 'block' : 'hidden'} lg:block`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground-950 flex items-center gap-2">
                <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-secondary-100"><i className="ri-calendar-event-line text-secondary-600 text-sm"></i></span>
                일정 달력
              </h2>
              <Link to="/schedule" className="text-xs text-secondary-600 hover:text-secondary-700 font-semibold flex items-center gap-0.5 whitespace-nowrap cursor-pointer">전체보기 <i className="ri-arrow-right-s-line text-sm"></i></Link>
            </div>
            <div className="bg-background-100 rounded-2xl border border-background-200 p-4">
              {/* 월 네비게이션 */}
              <div className="flex items-center justify-between mb-3">
                <button onClick={prevMonth} className="w-7 h-7 rounded-lg hover:bg-background-100 flex items-center justify-center cursor-pointer"><i className="ri-arrow-left-s-line text-foreground-600"></i></button>
                <span className="text-sm font-bold text-foreground-950">{calYear}년 {calMonth + 1}월</span>
                <button onClick={nextMonth} className="w-7 h-7 rounded-lg hover:bg-background-100 flex items-center justify-center cursor-pointer"><i className="ri-arrow-right-s-line text-foreground-600"></i></button>
              </div>
              {/* 요일 헤더 */}
              <div className="grid grid-cols-7 mb-1">
                {dayNames.map((d, i) => (
                  <div key={d} className={`text-center text-[10px] font-semibold py-1 ${i === 0 ? 'text-rose-500' : i === 6 ? 'text-sky-500' : 'text-foreground-500'}`}>{d}</div>
                ))}
              </div>
              {/* 날짜 그리드 */}
              <div className="grid grid-cols-7">
                {calendarDays.map((d, i) => {
                  const hasEvent = d.events.length > 0;
                  const isSelected = selectedDate === d.dateStr;
                  const isHovered = hoveredDate === d.dateStr;
                  return (
                    <div key={i} className="relative">
                      <button
                        onClick={() => { if (d.isCurrentMonth && d.dateStr) setSelectedDate(isSelected ? null : d.dateStr); }}
                        onMouseEnter={() => { if (hasEvent && d.isCurrentMonth) setHoveredDate(d.dateStr); }}
                        onMouseLeave={() => setHoveredDate(null)}
                        className={`relative w-full text-center py-1.5 text-xs rounded-lg transition-colors ${!d.isCurrentMonth ? 'text-foreground-300 cursor-default' : d.isToday ? 'bg-primary-500 text-white font-bold rounded-full' : hasEvent ? 'cursor-pointer hover:bg-secondary-50' : 'cursor-pointer hover:bg-background-100'} ${isSelected && !d.isToday ? 'bg-secondary-100 text-secondary-700 font-bold rounded-full' : ''} ${d.isCurrentMonth ? '' : ''}`}
                      >
                        {d.day}
                        {hasEvent && !d.isToday && !isSelected && (
                          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-secondary-400"></span>
                        )}
                      </button>
                      {/* Hover tooltip */}
                      {isHovered && hasEvent && !isSelected && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-20 bg-foreground-950 text-background-50 text-[10px] rounded-lg px-2 py-1.5 shadow-lg whitespace-nowrap max-w-[160px] truncate pointer-events-none">
                          {d.events[0].title}
                          {d.events.length > 1 && <span className="text-foreground-400 ml-1">+{d.events.length - 1}</span>}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-foreground-950"></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* 선택된 날짜의 일정 */}
              {selectedDate && selectedDateEvents.length > 0 && (
                <div className="mt-3 pt-3 border-t border-background-200">
                  <p className="text-xs font-semibold text-foreground-600 mb-2">{selectedDate}</p>
                  <div className="space-y-1.5">
                    {selectedDateEvents.map(ev => (
                      <div key={ev.id} className="text-xs text-foreground-700 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-secondary-400 flex-shrink-0"></span>
                        {ev.event_time && <span className="text-foreground-400">{ev.event_time}</span>}
                        <span className="truncate">{ev.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedDate && selectedDateEvents.length === 0 && (
                <div className="mt-3 pt-3 border-t border-background-200">
                  <p className="text-xs text-foreground-400">{selectedDate}에 등록된 일정이 없습니다</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 2.5 강학뉴스 — 모바일에서는 위 탭의 '강학뉴스'가 선택됐을 때만, 데스크톱에서는 항상 노출 ═══ */}
      <section className={`max-w-6xl mx-auto px-4 md:px-6 mb-8 ${homeTab === 'news' ? 'block' : 'hidden'} lg:block`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground-950 flex items-center gap-2">
            <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-sky-100"><i className="ri-newspaper-line text-sky-600 text-sm"></i></span>
            강학뉴스
          </h2>
          <Link to="/ganghak-news" className="text-xs text-sky-600 hover:text-sky-700 font-semibold flex items-center gap-0.5 whitespace-nowrap cursor-pointer">전체보기 <i className="ri-arrow-right-s-line text-sm"></i></Link>
        </div>

        <div className="bg-background-100 border border-background-200 rounded-2xl">
          {newsItems.length === 0 ? (
            <div className="p-8 text-center text-foreground-400 text-sm">
              <i className="ri-newspaper-line text-3xl text-foreground-300 block mb-3"></i>
              아직 등록된 뉴스가 없어요
            </div>
          ) : (
            newsItems.map((item, i) => (
              <Link key={item.id} to={`/ganghak-news/${item.id}`} className={`flex items-start gap-3 px-4 py-3.5 hover:bg-background-50 transition-colors cursor-pointer group ${i < newsItems.length - 1 ? 'border-b border-background-100' : ''}`}>
                <div className="flex-shrink-0 mt-0.5">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-sky-100 text-sky-600 text-[9px] font-bold">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-semibold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">{item.category}</span>
                    <p className="text-sm font-medium text-foreground-800 truncate group-hover:text-sky-700 transition-colors">{item.title}</p>
                  </div>
                  <p className="text-xs text-foreground-400">{item.author_name} · {timeAgo(item.created_at)}</p>
                </div>
                <i className="ri-arrow-right-s-line text-foreground-300 group-hover:text-sky-400 flex-shrink-0 mt-0.5 transition-colors"></i>
              </Link>
            ))
          )}
        </div>
      </section>

      {/* ═══ 3. 동아리 소개 ═══ */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground-950 flex items-center gap-2">
            <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-100"><i className="ri-group-line text-emerald-600 text-sm"></i></span>
            동아리 소개
          </h2>
          <Link to="/clubs" className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-0.5 whitespace-nowrap cursor-pointer">전체보기 <i className="ri-arrow-right-s-line text-sm"></i></Link>
        </div>

        {/* 모바일: 한눈에 스와이프해서 훑어볼 수 있는 가로 캐러셀.
            (기존 2열 그리드는 5개 항목이 2+2+1로 어중간하게 끊기고,
            좁은 카드 폭 때문에 동아리 이름이 중간에 줄바꿈되는 문제가 있었음) */}
        <div className="md:hidden -mx-4 px-4 flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-1">
          {clubs.map((club) => {
            const cb = clubBannerMap[club.id];
            return (
              <Link
                key={club.id}
                to={`/clubs/${club.id}`}
                className="group relative flex-shrink-0 w-[148px] h-[200px] snap-start rounded-[20px] overflow-hidden shadow-card active:scale-[0.97] transition-transform duration-150"
              >
                {cb?.card_image_url ? (
                  <img src={cb.card_image_url} alt={club.name} className="absolute inset-0 w-full h-full object-cover object-top" />
                ) : (
                  <div className={`absolute inset-0 bg-gradient-to-br ${club.color}`}></div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/5"></div>
                <div className={`absolute top-2.5 left-2.5 w-7 h-7 rounded-full ${club.iconBg} flex items-center justify-center shadow-card`}>
                  <i className={`${CLUB_ICON_MAP[club.id]} text-xs ${club.iconText}`}></i>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-white font-bold text-[15px] leading-tight drop-shadow whitespace-nowrap overflow-hidden text-ellipsis">
                    {club.name}
                  </p>
                  <p className="text-white/75 text-[11px] mt-0.5 truncate">{club.subtitle}</p>
                </div>
              </Link>
            );
          })}
          {/* 어중간한 빈 슬롯 대신 명확한 CTA 카드로 마무리 */}
          <Link
            to="/clubs"
            className="flex-shrink-0 w-[110px] h-[200px] snap-start rounded-[20px] border-2 border-dashed border-emerald-200 bg-emerald-50/60 flex flex-col items-center justify-center gap-2 active:scale-[0.97] transition-transform duration-150"
          >
            <div className="w-9 h-9 rounded-full bg-background-100 flex items-center justify-center shadow-card">
              <i className="ri-arrow-right-line text-emerald-600"></i>
            </div>
            <span className="text-[11px] font-semibold text-emerald-700 text-center leading-tight">전체 동아리<br />보기</span>
          </Link>
        </div>

        {/* 데스크톱: 기존 5열 그리드 유지 */}
        <div className="hidden md:grid md:grid-cols-5 gap-4">
          {clubs.map((club) => {
            const cb = clubBannerMap[club.id];
            return (
            <Link key={club.id} to={`/clubs/${club.id}`} className="group relative bg-background-100 rounded-2xl border border-background-200 overflow-hidden hover:border-emerald-200 hover:shadow-md transition-all duration-300 cursor-pointer">
              <div className="relative h-32 overflow-hidden">
                {cb?.card_image_url ? (
                  <img src={cb.card_image_url} alt={club.name} className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${club.color}`}></div>
                )}
                <div className={`absolute inset-0 bg-gradient-to-b ${club.color} opacity-50 group-hover:opacity-40 transition-opacity`}></div>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60"></div>
                <div className={`absolute top-2.5 left-2.5 w-7 h-7 rounded-lg ${club.iconBg} flex items-center justify-center`}>
                  <i className={`${CLUB_ICON_MAP[club.id]} text-sm ${club.iconText}`}></i>
                </div>
              </div>
              <div className="p-3">
                <p className="font-bold text-foreground-950 text-sm whitespace-nowrap overflow-hidden text-ellipsis">{club.name}</p>
                <p className="text-[11px] text-foreground-500 mt-0.5 truncate">{club.subtitle}</p>
              </div>
            </Link>
            );
          })}
        </div>
      </section>


      {/* ═══ 5. 이달의 동아리 챔피언 (성경퀴즈 · 성경완독) ═══ */}
      {(monthlyChampion || marathonChampion) && (
        <section className="max-w-6xl mx-auto px-4 md:px-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground-950 flex items-center gap-2">
              <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-100"><i className="ri-trophy-line text-amber-600 text-sm"></i></span>
              {new Date().getMonth() + 1}월 동아리 챔피언
            </h2>
          </div>

          {/* 성경퀴즈 1위 동아리 · 성경완독 1위 동아리 — 나란히 표시 */}
          <div className="grid grid-cols-2 gap-2.5 md:gap-3">
            {monthlyChampion && (
              <Link to="/bible-quiz" className="relative rounded-2xl md:rounded-[20px] overflow-hidden bg-gradient-to-br from-amber-400 via-amber-500 to-accent-500 p-3.5 md:p-4 shadow-card-lg cursor-pointer">
                <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-background-100/10"></div>
                <div className="relative flex items-center gap-2 mb-2.5">
                  <div className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-background-100/25 backdrop-blur flex items-center justify-center flex-shrink-0">
                    <i className="ri-trophy-fill text-lg md:text-2xl text-white"></i>
                  </div>
                  <p className="text-white/90 text-[10px] md:text-[11px] font-semibold leading-tight">{new Date().getMonth() + 1}월<br className="md:hidden" /> 성경퀴즈 1위</p>
                </div>
                <p className="relative text-white font-black text-base md:text-lg truncate">{monthlyChampion.topClub.club_name}</p>
                <p className="relative text-white/80 text-[11px] md:text-xs font-semibold mt-0.5">{monthlyChampion.topClub.total_score.toLocaleString()}점</p>
              </Link>
            )}
            {marathonChampion && (
              <Link to="/bible-marathon" className="relative rounded-2xl md:rounded-[20px] overflow-hidden bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-500 p-3.5 md:p-4 shadow-card-lg cursor-pointer">
                <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-background-100/10"></div>
                <div className="relative flex items-center gap-2 mb-2.5">
                  <div className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-background-100/25 backdrop-blur flex items-center justify-center flex-shrink-0">
                    <i className="ri-book-open-fill text-lg md:text-2xl text-white"></i>
                  </div>
                  <p className="text-white/90 text-[10px] md:text-[11px] font-semibold leading-tight">{new Date().getMonth() + 1}월<br className="md:hidden" /> 성경완독 1위</p>
                </div>
                <p className="relative text-white font-black text-base md:text-lg truncate">{marathonChampion.label}</p>
                <p className="relative text-white/80 text-[11px] md:text-xs font-semibold mt-0.5">{marathonChampion.chapters.toLocaleString()}장 완독</p>
              </Link>
            )}
          </div>

          {monthlyChampion?.topPlayer && (
            <div className="mt-2.5 md:mt-3 flex items-center gap-4 p-3.5 md:p-4 bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-200 rounded-2xl">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0"><i className="ri-vip-crown-line text-xl md:text-2xl text-rose-500"></i></div>
              <div className="min-w-0"><p className="text-xs font-semibold text-rose-700 mb-0.5">이달의 퀴즈 MVP</p><p className="text-base md:text-lg font-black text-foreground-950 truncate">{monthlyChampion.topPlayer.nickname}</p><p className="text-xs text-foreground-500 truncate">{monthlyChampion.topPlayer.club_name} · {monthlyChampion.topPlayer.total_score.toLocaleString()}점</p></div>
            </div>
          )}
        </section>
      )}


      {/* ═══ 7. 오늘의 출석 현황 요약 ═══ */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground-950 flex items-center gap-2">
            <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-rose-100"><i className="ri-user-heart-line text-rose-600 text-sm"></i></span>
            오늘의 출석 현황
          </h2>
          {hasRole && hasRole('assistant_zone_leader') && (
            <Link to="/attendance-board" className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-0.5 whitespace-nowrap cursor-pointer">실시간 출석 현황판 <i className="ri-arrow-right-s-line text-sm"></i></Link>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 md:gap-4">
          {attendanceError ? (
            <div className="col-span-3 bg-accent-100 border border-accent-200 rounded-2xl p-4 text-center">
              <p className="text-sm text-accent-700">출석 현황을 불러오는 중 문제가 발생했어요</p>
              <button onClick={() => { setAttendanceError(false); loadAttendanceSummary(); }} className="mt-2 text-xs text-accent-500 underline cursor-pointer">다시 시도</button>
            </div>
          ) : (
            <>
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                <p className="text-3xl font-black text-emerald-600">{attendanceSummary?.attended ?? '\u2013'}</p>
                <p className="text-xs font-semibold text-emerald-700 mt-1">출석</p>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-center">
                <p className="text-3xl font-black text-orange-500">{attendanceSummary?.absent ?? '\u2013'}</p>
                <p className="text-xs font-semibold text-orange-600 mt-1">불참</p>
              </div>
              <div className="bg-background-100 border border-background-200 rounded-2xl p-4 text-center">
                <p className="text-3xl font-black text-foreground-500">
                  {attendanceSummary && allMembersTotal > 0
                    ? allMembersTotal - attendanceSummary.attended - attendanceSummary.absent
                    : '\u2013'}
                </p>
                <p className="text-xs font-semibold text-foreground-500 mt-1">미응답</p>
              </div>
            </>
          )}
        </div>
        {attendanceSummary && allMembersTotal > 0 && (
          <div className="mt-3 bg-background-100 border border-background-200 rounded-xl px-4 py-2.5 flex items-center gap-3">
            <div className="flex-1 h-2 bg-background-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                style={{ width: `${Math.round((attendanceSummary.attended / allMembersTotal) * 100)}%` }}
              />
            </div>
            <span className="text-xs font-bold text-emerald-700 whitespace-nowrap">
              {Math.round((attendanceSummary.attended / allMembersTotal) * 100)}% 출석
            </span>
          </div>
        )}
      </section>

      {/* ═══ Footer ═══ */}
      <footer className="border-t border-primary-100/50 py-8 mt-4">
        <div className="max-w-6xl mx-auto px-4 md:px-6 text-center">
          <p className="text-sm text-foreground-500 mb-2">강릉 학생회</p>
          <p className="text-xs text-foreground-400">&ldquo;여호와로 말미암아 기뻐하는 것이 너희의 힘이니라&rdquo; — 느헤미야 8:10</p>
        </div>
      </footer>
    </div>
  );
}
