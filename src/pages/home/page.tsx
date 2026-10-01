import { Link } from 'react-router-dom';
import { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clubs } from '@/mocks/clubs';
import { useAuth, getSupabaseClient } from '@/hooks/useAuth';
const LeaderboardModal = lazy(() => import('@/pages/bibleQuiz/components/LeaderboardModal'));
const HomeClubsSection = lazy(() => import('@/pages/home/components/HomeClubsSection'));
const HomeAwardsModal = lazy(() => import('@/pages/home/components/HomeAwardsModal'));
const HomeDailyQuote = lazy(() => import('@/pages/home/components/HomeDailyQuote'));
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

// 확정(스냅샷)된 지난달 수상 동아리 — club_monthly_champions 테이블 1행
interface ConfirmedChampion {
  year: number;
  month: number;
  category: 'quiz' | 'marathon';
  club_key: string;
  club_label: string;
  value: number;
  extra: { topPlayerNickname?: string; topPlayerClub?: string; topPlayerScore?: number } | null;
}

interface NewsItem {
  id: string;
  title: string;
  content: string;
  author_name: string;
  category: string;
  created_at: string;
}

interface MemoryPhoto {
  id: string;
  title: string;
  thumb_url: string | null;
  photo_url: string;
  created_at: string;
}

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

const CLUB_CALENDAR_DOT_CLASSES: Record<string, string> = {
  saeullim: 'bg-primary-500',
  cheonjipoong: 'bg-secondary-500',
  cheonjihu: 'bg-accent-500',
  munhwabu: 'bg-primary-700',
  cheonhwarae_cheongmyeong: 'bg-secondary-700',
};

function getClubCalendarDotClass(clubId: string | null) {
  return clubId ? CLUB_CALENDAR_DOT_CLASSES[clubId] || 'bg-foreground-500' : 'bg-foreground-500';
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

  const [notices, setNotices] = useState<Notice[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [monthlyChampion, setMonthlyChampion] = useState<MonthlyChampion | null>(null);
  const [marathonChampion, setMarathonChampion] = useState<MarathonClubChampion | null>(null);
  // 확정(스냅샷)된 "지난달" 수상 동아리 — 달이 끝나면 한 번 박제되어 이후 절대 바뀌지 않음
  const [confirmedQuiz, setConfirmedQuiz] = useState<ConfirmedChampion | null>(null);
  const [confirmedMarathon, setConfirmedMarathon] = useState<ConfirmedChampion | null>(null);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [memoryPhotos, setMemoryPhotos] = useState<MemoryPhoto[]>([]);
  const [selectedMemoryPhoto, setSelectedMemoryPhoto] = useState<MemoryPhoto | null>(null);
  const [clubBannerMap, setClubBannerMap] = useState<Record<string, { card_image_url: string | null }>>({});
  const [noticesLoading, setNoticesLoading] = useState(true);
  const [noticesError, setNoticesError] = useState(false);
  const [schedulesLoading, setSchedulesLoading] = useState(true);
  const [schedulesError, setSchedulesError] = useState(false);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [attendanceError, setAttendanceError] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showAwards, setShowAwards] = useState(false);
  const [showDeferredHomeSections, setShowDeferredHomeSections] = useState(false);
  const [allMembersTotal, setAllMembersTotal] = useState(0);
  const attendanceChannelRef = useRef<ReturnType<Awaited<ReturnType<typeof getSupabaseClient>>['channel']> | null>(null);

  useEffect(() => {
    const run = async () => {
      const supabase = await getSupabaseClient();
      Promise.resolve(
        supabase
          .from('club_banners')
          .select('club, card_image_url')
      )
        .then(({ data }) => {
          if (data) {
            const map: Record<string, { card_image_url: string | null }> = {};
            data.forEach((banner: { club: string; card_image_url: string | null }) => {
              map[banner.club] = { card_image_url: banner.card_image_url };
            });
            setClubBannerMap(map);
          }
        })
        .catch(() => {});
    };
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = globalThis.setTimeout(run, 500);
    return () => globalThis.clearTimeout(id);
  }, []);

  useEffect(() => {
    const handleOpenAwards = () => setShowAwards(true);
    window.addEventListener('home-awards-open', handleOpenAwards);
    return () => window.removeEventListener('home-awards-open', handleOpenAwards);
  }, []);

  // 모바일: 공지·일정·강학뉴스를 세로로 다 펼치지 않고 탭으로 전환해서 봄
  const [homeTab, setHomeTab] = useState<'notice' | 'schedule' | 'news'>('notice');
  const [noticeCategory, setNoticeCategory] = useState('전체');

  // 달력
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(todayKey());
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const calendarDays = getCalendarDays(calYear, calMonth, schedules);
  const selectedDateEvents = selectedDate
    ? schedules.filter((event) => event.event_date === selectedDate)
    : [];
  const prevMonth = useCallback(() => {
    setCalMonth((month) => {
      if (month === 0) {
        setCalYear((year) => year - 1);
        return 11;
      }
      return month - 1;
    });
  }, []);
  const nextMonth = useCallback(() => {
    setCalMonth((month) => {
      if (month === 11) {
        setCalYear((year) => year + 1);
        return 0;
      }
      return month + 1;
    });
  }, []);

  const slideVariants = {
    enter: (slideDirection: number) => ({ x: slideDirection > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (slideDirection: number) => ({ x: slideDirection > 0 ? '-100%' : '100%', opacity: 0 }),
  };

  // 캐러셀
  const [slideIndex, setSlideIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);

  // 추억창 사진은 첫 화면 핵심 데이터가 아니므로 초기 렌더 이후 가져온다.
  useEffect(() => {
    let cancelled = false;

    const loadMemoryPhotos = async () => {
      const supabase = await getSupabaseClient();
      void Promise.resolve(
        supabase
          .from('memory_photos')
          .select('id, title, thumb_url, photo_url, created_at')
          .order('created_at', { ascending: false })
          .limit(30)
      )
        .then(({ data }) => {
          if (cancelled || !data?.length) return;
          setMemoryPhotos(data as MemoryPhoto[]);
        })
        .catch(() => {});
    };

    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(loadMemoryPhotos, { timeout: 2500 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }

    const id = globalThis.setTimeout(loadMemoryPhotos, 800);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(id);
    };
  }, []);

  useEffect(() => {
    const revealDeferredSections = () => setShowDeferredHomeSections(true);
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(revealDeferredSections, { timeout: 1000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = globalThis.setTimeout(revealDeferredSections, 600);
    return () => globalThis.clearTimeout(id);
  }, []);

  // ── 이달의 동아리 챔피언(성경퀴즈 · 성경완독) 실시간 로드 ──
  // 캐시는 초기 페인트를 빠르게 하기 위한 용도일 뿐, 마운트 시 항상 최신 데이터를 다시 가져오고
  // 이후에는 Supabase Realtime 구독으로 데이터가 바뀔 때마다 즉시 갱신한다.
  // force=false면 캐시가 아직 유효한 동안은 네트워크 호출을 건너뛴다.
  // (Realtime 구독이 실제 데이터 변경 시점에 loadQuizChampion(true)로 강제 갱신을 트리거하므로
  // 컴포넌트가 재마운트될 때마다 매번 quiz-leaderboard 함수를 다시 호출할 필요가 없다.)
  const loadQuizChampion = useCallback(async (force = false) => {
    if (!force && readQuizLeaderboardCache()) return;
    const supabase = await getSupabaseClient();
    supabase.functions.invoke('quiz-leaderboard?monthly=true', {
      method: 'GET',
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

  const loadMarathonChampion = useCallback(async () => {
    const supabase = await getSupabaseClient();
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
      .then(undefined, () => {});
  }, []);

  // 브라우저 로컬 시각(=한국 사용자 기준 KST) 기준으로 "지난달"의 [start, end) 자정 경계를 구한다.
  // 서버(엣지 함수)는 시간대를 추측하지 않고 이 값을 그대로 필터 기준으로 쓴다.
  const getPrevMonthRange = useCallback(() => {
    const now = new Date();
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = prevMonthDate.getFullYear();
    const month = prevMonthDate.getMonth() + 1; // 1-indexed
    const start = new Date(year, month - 1, 1).toISOString();
    const end = new Date(year, month, 1).toISOString();
    return { year, month, start, end };
  }, []);

  // 지난달 확정 수상 동아리를 서버에서 불러온다 (홈 배너용)
  const loadConfirmedChampions = useCallback(async () => {
    const supabase = await getSupabaseClient();
    supabase.functions.invoke('monthly-champion-snapshot?mode=latest', {
      method: 'GET',
    }).then(({ data }) => {
      setConfirmedQuiz((data?.quiz as ConfirmedChampion) || null);
      setConfirmedMarathon((data?.marathon as ConfirmedChampion) || null);
    }).catch(() => {});
  }, []);

  // Cached/Edge Function Egress 절감: finalize는 서버에서 무거운 집계(퀴즈+완독 전체 스캔)를
  // 수행하므로, 이미 이번 브라우저에서 "이번 달 기준 지난달"을 확정 완료했다면 재호출하지 않는다.
  // ignoreDuplicates 덕분에 어차피 값은 안 바뀌지만, 계산 자체(=DB read + 함수 실행)는 매번
  // 비용이 들기 때문에 홈 화면을 왔다갔다 할 때마다(=컴포넌트 재마운트마다) 불필요하게
  // 다시 호출되는 것을 막는다.
  const FINALIZED_MONTH_KEY = 'home_finalized_month_v1';

  // 지난달을 "확정"으로 박제한다. unique(year, month, category) + ignoreDuplicates 라서
  // 이미 확정된 달이면 몇 번을 호출해도 안전하게 아무 변화가 없다(=값이 절대 바뀌지 않음).
  // 달이 바뀐 뒤 홈에 처음 들어오는 사용자가 자연스럽게 이 확정을 트리거하게 된다.
  const finalizePreviousMonth = useCallback(async () => {
    const supabase = await getSupabaseClient();
    const { year, month, start, end } = getPrevMonthRange();
    const monthKey = `${year}-${month}`;

    // 이 브라우저에서 이미 같은 달을 확정 요청했다면 건너뛴다 (서버 재계산 방지)
    try {
      if (localStorage.getItem(FINALIZED_MONTH_KEY) === monthKey) return;
    } catch {
      // localStorage 접근 실패 시에는 안전하게 계속 진행
    }

    const qs = new URLSearchParams({
      mode: 'finalize',
      year: String(year),
      month: String(month),
      start,
      end,
    }).toString();
    supabase.functions.invoke(`monthly-champion-snapshot?${qs}`, {
      method: 'GET',
    }).then(() => {
      try {
        localStorage.setItem(FINALIZED_MONTH_KEY, monthKey);
      } catch {
        // ignore storage errors
      }
      loadConfirmedChampions();
    }).catch(() => {});
  }, [getPrevMonthRange, loadConfirmedChampions]);

  useEffect(() => {
    const runNonCriticalHomeData = async () => {
    const supabase = await getSupabaseClient();
    // 캐시가 있으면 즉시 화면에 먼저 보여주고, 뒤이어 최신 데이터로 덮어쓴다
    const cachedLeaderboard = readQuizLeaderboardCache();
    if (cachedLeaderboard) setMonthlyChampion(cachedLeaderboard);
    const cachedMarathon = readMarathonChampionCache();
    if (cachedMarathon) setMarathonChampion(cachedMarathon);

    loadQuizChampion();
    loadMarathonChampion();
    loadConfirmedChampions();
    // 혹시 지난달이 아직 확정 안 됐다면(=달이 바뀐 뒤 처음 방문) 지금 확정해둔다
    finalizePreviousMonth();

    // 실시간 반영: 퀴즈 점수나 완독 등록/확정이 생기면 곧바로 동아리 랭킹을 다시 계산
    const quizChannel = supabase
      .channel('home-quiz-champion-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_scores' }, () => loadQuizChampion(true))
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
      loadQuizChampion(true); // 달이 바뀌는 시점이므로 캐시 여부와 상관없이 강제 갱신
      loadMarathonChampion();
      finalizePreviousMonth(); // 자정을 넘겼으니 방금 끝난 달을 확정 스냅샷으로 박제
      midnightInterval = setInterval(() => {
        loadQuizChampion(true);
        loadMarathonChampion();
        finalizePreviousMonth();
      }, 24 * 60 * 60 * 1000);
    }, msUntilNextMidnight);

    return () => {
      supabase.removeChannel(quizChannel);
      supabase.removeChannel(marathonChannel);
      clearTimeout(midnightTimeout);
      if (midnightInterval) clearInterval(midnightInterval);
    };
    };
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(runNonCriticalHomeData, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = globalThis.setTimeout(runNonCriticalHomeData, 800);
    return () => globalThis.clearTimeout(id);
  }, [loadQuizChampion, loadMarathonChampion, loadConfirmedChampions, finalizePreviousMonth]);

  // ── 데이터 패치 ──
  useEffect(() => {
    let scheduleChannel: ReturnType<Awaited<ReturnType<typeof getSupabaseClient>>['channel']> | null = null;
    let cancelled = false;

    const loadHomeCoreData = async () => {
      const supabase = await getSupabaseClient();
      if (cancelled) return;

      Promise.resolve(
        supabase
          .from('notices')
          .select('id, title, content, is_pinned, created_at, author_name, category')
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(30)
      )
        .then(({ data }) => { if (!cancelled && data) setNotices(data); })
        .catch(() => { if (!cancelled) setNoticesError(true); })
        .finally(() => { if (!cancelled) setNoticesLoading(false); });

      const loadSchedules = async () => {
        try {
          const { data, error } = await supabase
            .from('schedules')
            .select('id, title, description, event_date, event_time, location, target_club')
            .order('event_date', { ascending: true });
          if (error) throw error;
          if (!cancelled) {
            setSchedules(data || []);
            setSchedulesError(false);
          }
        } catch {
          if (!cancelled) setSchedulesError(true);
        } finally {
          if (!cancelled) setSchedulesLoading(false);
        }
      };

      void loadSchedules();

      scheduleChannel = supabase
        .channel('home-schedules-rt')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, () => {
          void loadSchedules();
        })
        .subscribe();

      const loadNews = () => {
        void Promise.resolve(
          supabase
            .from('ganghak_news')
            .select('id, title, content, author_name, category, created_at')
            .order('created_at', { ascending: false })
            .limit(4)
        ).then(({ data }) => {
          if (!cancelled && data) setNewsItems(data);
        }).catch(() => {});
      };

      if ('requestIdleCallback' in window) {
        const newsIdleId = window.requestIdleCallback(loadNews, { timeout: 2500 });
        return () => window.cancelIdleCallback(newsIdleId);
      }
      const newsTimer = globalThis.setTimeout(loadNews, 800);
      return () => globalThis.clearTimeout(newsTimer);
    };

    void loadHomeCoreData();

    return () => {
      cancelled = true;
      if (scheduleChannel) {
        void getSupabaseClient().then((client) => client.removeChannel(scheduleChannel));
      }
    };
  }, []);

  // ── 히어로 슬라이드 구성 ──
  // 캐러셀은 항상 1개만 유지하고, 추억창 사진 중 하나를 무작위로 선택한다.
  useEffect(() => {
    if (memoryPhotos.length === 0) {
      setSelectedMemoryPhoto(null);
      return;
    }
    const randomIndex = Math.floor(Math.random() * memoryPhotos.length);
    setSelectedMemoryPhoto(memoryPhotos[randomIndex]);
  }, [memoryPhotos]);

  const heroSlides: HeroSlide[] = selectedMemoryPhoto
    ? [{
        id: `memory-${selectedMemoryPhoto.id}`,
        type: 'feature' as const,
        image: selectedMemoryPhoto.thumb_url || selectedMemoryPhoto.photo_url,
        badge: '추억창',
        badgeColor: 'bg-primary-500',
        title: '강학 추억 보러가기',
        subtitle: selectedMemoryPhoto.title || '강릉 학생회의 소중한 순간을 만나보세요',
        cta: { label: '추억창 보러가기', path: '/memory-board' },
      }]
    : [];

  // ── 캐러셀 ──
  const startAuto = useCallback(() => {
    if (autoRef.current) clearInterval(autoRef.current);
    if (heroSlides.length <= 1) return;
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
    const supabase = await getSupabaseClient();
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
    let channel: ReturnType<Awaited<ReturnType<typeof getSupabaseClient>>['channel']> | null = null;
    const run = async () => {
      const supabase = await getSupabaseClient();
      loadAttendanceSummary();
      const todayStr = todayKey();
      channel = supabase
        .channel('home-attendance-rt')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance', filter: `attendance_date=eq.${todayStr}` }, () => loadAttendanceSummary())
        .subscribe();
      attendanceChannelRef.current = channel;
    };
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout: 2500 });
      return () => {
        window.cancelIdleCallback(id);
        if (channel) void getSupabaseClient().then((client) => client.removeChannel(channel));
      };
    }
    const id = globalThis.setTimeout(run, 800);
    return () => {
      globalThis.clearTimeout(id);
      if (channel) void getSupabaseClient().then((client) => client.removeChannel(channel));
    };
  }, [loadAttendanceSummary]);

  // ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background-50 pb-24 md:pb-0">

      {/* ═══ 1. 히어로 캐러셀 ═══ */}
      {heroSlides.length > 0 && (
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
              className="absolute inset-0"
            >
              <img
                src={heroSlides[slideIndex].image}
                alt={heroSlides[slideIndex].title}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover object-center bg-foreground-950"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/60"></div>
              <div className="absolute inset-0 flex items-end justify-center px-3 pb-14 sm:px-4 sm:pb-16 md:pb-16">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }} className="text-center max-w-xl w-full">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-bold text-white mb-2 sm:mb-3 bg-primary-500">
                    <i className="ri-image-line"></i>
                    추억창
                  </span>
                  <h1 className="text-[1.2rem] min-[360px]:text-[1.3rem] sm:text-2xl md:text-4xl font-black text-white leading-[1.25] mb-1.5 md:mb-2 whitespace-pre-line drop-shadow-lg">{heroSlides[slideIndex].title}</h1>
                  <p className="text-[11px] min-[360px]:text-xs sm:text-sm md:text-base text-white/85 mb-3.5 sm:mb-4 md:mb-5 whitespace-pre-line leading-[1.45]">{heroSlides[slideIndex].subtitle}</p>
                  <Link to="/memory-board" className="inline-flex items-center gap-1.5 px-4 py-2 sm:px-5 sm:py-2.5 rounded-full bg-background-100 text-foreground-950 text-[12px] sm:text-sm font-bold hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap shadow-lg">
                    추억창 보러가기 <i className="ri-arrow-right-line"></i>
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          </AnimatePresence>
          {heroSlides.length > 1 && (
            <>
              <button onClick={prevSlide} aria-label="이전 슬라이드" className="absolute left-3 md:left-5 top-1/2 -translate-y-1/2 w-9 h-9 md:w-11 md:h-11 rounded-full bg-background-100/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-background-100/35 transition-colors cursor-pointer z-10"><i className="ri-arrow-left-s-line text-xl" aria-hidden="true"></i></button>
              <button onClick={nextSlide} aria-label="다음 슬라이드" className="absolute right-3 md:right-5 top-1/2 -translate-y-1/2 w-9 h-9 md:w-11 md:h-11 rounded-full bg-background-100/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-background-100/35 transition-colors cursor-pointer z-10"><i className="ri-arrow-right-s-line text-xl" aria-hidden="true"></i></button>
              <div className="absolute bottom-2.5 sm:bottom-3 md:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10 bg-black/30 backdrop-blur-sm rounded-full px-2.5 py-1.5 max-w-[calc(100%-24px)]">
                <span className="text-[10px] md:text-xs font-semibold text-white/90 tabular-nums">{slideIndex + 1} / {heroSlides.length}</span>
                <div className="flex items-center gap-1.5">
                  {heroSlides.map((_, i) => (
                    <button key={i} aria-label={`${i + 1}번 슬라이드로 이동`} onClick={() => goToSlide(i)} className={`rounded-full transition-all duration-300 cursor-pointer ${i === slideIndex ? 'w-5 h-2 bg-background-100' : 'w-1.5 h-1.5 bg-background-100/45 hover:bg-background-100/70'}`} />
                  ))}
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/* ═══ 1.5 오늘의 어록 ═══ */}
      {showDeferredHomeSections && (
        <Suspense fallback={null}>
          <HomeDailyQuote />
        </Suspense>
      )}

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
                  <div className="mb-3 rounded-card border border-background-200 bg-background-100 p-2.5">
                    <div className="mb-2 px-1 text-[10px] font-bold text-foreground-500">카테고리별 공지</div>
                    <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none" role="tablist" aria-label="홈 공지사항 카테고리">
                      {['전체', '일반', '긴급', '행사', '모집', '교육', '기도제목'].map((category) => {
                        const active = noticeCategory === category;
                        const catColor = getCategoryColor(category === '전체' ? null : category);
                        return (
                          <button
                            key={category}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => setNoticeCategory(category)}
                            className={`flex min-h-12 min-w-[58px] shrink-0 flex-col items-center justify-center gap-1 rounded-input px-2 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${active ? 'bg-primary-50 text-primary-700 shadow-card dark:bg-primary-900/30 dark:text-primary-200' : 'bg-background-50 text-foreground-500 hover:bg-background-200 dark:bg-background-200 dark:text-foreground-300'}`}
                          >
                            <span className={`flex h-7 w-7 items-center justify-center rounded-full ${active ? 'bg-primary-100 dark:bg-primary-800/50' : catColor.bg}`}>
                              <i className={`${category === '전체' ? 'ri-apps-2-line' : catColor.icon} text-sm ${active ? 'text-primary-600 dark:text-primary-300' : catColor.text}`} aria-hidden="true" />
                            </span>
                            <span className="whitespace-nowrap text-[10px] font-bold">{category}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {(() => {
                    const filteredNotices = noticeCategory === '전체' ? notices : notices.filter((notice) => (notice.category || '일반') === noticeCategory);
                    return filteredNotices.length === 0 ? (
                      <div className="p-6 text-center bg-background-100 rounded-card border border-background-200 text-foreground-500 text-sm">이 카테고리에 등록된 공지사항이 없습니다</div>
                    ) : (
                      filteredNotices.map((notice) => {
                        const readIds = getReadNoticeIds(user?.id);
                        const isNew = !readIds.has(notice.id) && (Date.now() - new Date(notice.created_at).getTime()) < 7 * 24 * 60 * 60 * 1000;
                        const catColor = getCategoryColor(notice.category);
                        return (
                          <Link
                            key={notice.id}
                            to={`/notices/${notice.id}`}
                            className={`group flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer hover:scale-[1.01] hover:shadow-sm ${notice.is_pinned ? 'bg-primary-50 border-primary-200 hover:border-primary-300' : 'bg-background-100 border-background-200 hover:border-primary-200'}`}
                          >
                            <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mt-0.5 ${catColor.bg}`}>
                              <i className={`${catColor.icon} text-sm ${catColor.text}`} aria-hidden="true"></i>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                {notice.is_pinned && <span className="text-[9px] font-bold text-primary-700 bg-primary-100 px-1.5 py-0.5 rounded-full">공지</span>}
                                {notice.category && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${catColor.chip}`}>{notice.category}</span>}
                                {isNew && <span className="text-[9px] font-bold text-white bg-rose-500 px-1.5 py-0.5 rounded-full">NEW</span>}
                              </div>
                              <p className={`text-sm font-semibold truncate group-hover:text-primary-700 transition-colors ${notice.is_pinned ? 'text-primary-800' : 'text-foreground-900'}`}>{notice.title}</p>
                              <p className="text-[11px] text-foreground-400 mt-0.5">{notice.author_name && <span>{notice.author_name} · </span>}{timeAgo(notice.created_at)}</p>
                            </div>
                            <i className="ri-arrow-right-s-line text-foreground-300 group-hover:text-primary-400 flex-shrink-0 mt-2 transition-colors" aria-hidden="true"></i>
                          </Link>
                        );
                      })
                    );
                  })()}
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
                <button onClick={prevMonth} aria-label="이전 달" className="w-7 h-7 rounded-lg hover:bg-background-100 flex items-center justify-center cursor-pointer"><i className="ri-arrow-left-s-line text-foreground-600" aria-hidden="true"></i></button>
                <span className="text-sm font-bold text-foreground-950" aria-live="polite">{calYear}년 {calMonth + 1}월</span>
                <button onClick={nextMonth} aria-label="다음 달" className="w-7 h-7 rounded-lg hover:bg-background-100 flex items-center justify-center cursor-pointer"><i className="ri-arrow-right-s-line text-foreground-600" aria-hidden="true"></i></button>
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
                  const clubIds = Array.from(
                    new Set(
                      d.events
                        .map(event => event.target_club)
                        .filter((clubId): clubId is string => Boolean(clubId)),
                    ),
                  );
                  const hasGeneralEvent = d.events.some(event => !event.target_club);
                  return (
                    <div key={i} className="relative">
                      <button
                        onClick={() => { if (d.isCurrentMonth && d.dateStr) setSelectedDate(isSelected ? null : d.dateStr); }}
                        onMouseEnter={() => { if (hasEvent && d.isCurrentMonth) setHoveredDate(d.dateStr); }}
                        onMouseLeave={() => setHoveredDate(null)}
                        className="relative flex min-h-11 w-full flex-col items-center justify-center py-1 cursor-pointer disabled:cursor-default"
                        disabled={!d.isCurrentMonth}
                      >
                        <span className={`relative z-0 w-7 h-7 flex items-center justify-center rounded-full text-xs font-medium transition-all ${
                          d.isToday
                            ? 'bg-primary-100 text-primary-700 font-bold ring-1 ring-primary-300 dark:bg-primary-900/40 dark:text-primary-200 dark:ring-primary-700'
                            : isSelected
                              ? 'bg-gradient-to-br from-primary-500 to-accent-500 text-white font-bold'
                              : d.isCurrentMonth
                                ? 'text-foreground-800'
                                : 'text-foreground-300'
                        }`}>
                          {d.day}
                        </span>
                        {hasEvent && d.isCurrentMonth && !isSelected && (
                          <div
                            className="absolute bottom-0.5 left-1/2 flex h-2.5 w-full -translate-x-1/2 items-center justify-center gap-1 overflow-hidden"
                            aria-label="이 날짜의 동아리 일정"
                          >
                            {clubIds.slice(0, 3).map(clubId => (
                              <span
                                key={clubId}
                                className={`h-2 w-2 shrink-0 rounded-full ${getClubCalendarDotClass(clubId)}`}
                                title={clubs.find(club => club.id === clubId)?.name || clubId}
                              />
                            ))}
                            {hasGeneralEvent && (
                              <span
                                className="h-2 w-2 shrink-0 rounded-full bg-foreground-500 dark:bg-foreground-300"
                                title="전체 행사"
                              />
                            )}
                            {clubIds.length > 3 && (
                              <span className="text-[8px] font-bold leading-none text-foreground-500 dark:text-foreground-300">+</span>
                            )}
                          </div>
                        )}                      </button>
                      {isHovered && hasEvent && !isSelected && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-20 bg-foreground-950 text-background-50 text-[10px] rounded-lg px-2 py-1.5 shadow-lg whitespace-nowrap max-w-[160px] truncate pointer-events-none">
                          {d.events[0].title}
                          {d.events.length > 1 && <span className="text-foreground-400 ml-1">+{d.events.length - 1}</span>}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-transparent border-t-4 border-t-foreground-950"></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-background-200 pt-3">
                {clubs.map(club => (
                  <span key={club.id} className="inline-flex items-center gap-1 text-[9px] font-semibold text-foreground-600 dark:text-foreground-300">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${getClubCalendarDotClass(club.id)}`} aria-hidden="true" />
                    {club.name}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-foreground-600 dark:text-foreground-300">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-foreground-500 dark:bg-foreground-300" aria-hidden="true" />
                  전체 행사
                </span>
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

      <Suspense fallback={<div className="max-w-6xl mx-auto px-4 md:px-6 mb-8 min-h-48" />}>{showDeferredHomeSections && <HomeClubsSection clubBannerMap={clubBannerMap} />}</Suspense>

      <Suspense fallback={null}><HomeAwardsModal showAwards={showAwards} setShowAwards={setShowAwards} confirmedQuiz={confirmedQuiz} confirmedMarathon={confirmedMarathon} monthlyChampion={monthlyChampion} marathonChampion={marathonChampion} setShowLeaderboard={setShowLeaderboard} /></Suspense>

      <Suspense fallback={null}><LeaderboardModal isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} /></Suspense>

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
