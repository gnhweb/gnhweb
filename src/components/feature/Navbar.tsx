import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useMobileMenu } from '@/hooks/useMobileMenu';
import { ROLE_LABELS, CLUB_LABELS } from '@/types/auth';
import type { UserRole } from '@/types/auth';
import MeetingIdeasModal from '@/components/feature/MeetingIdeasModal';
import NotificationsModal, { useNotificationCount, NotificationToast } from '@/components/feature/NotificationsModal';

// 탭 시 살짝 눌리는 느낌(whileTap)을 Link에도 쓸 수 있도록 감싼 컴포넌트 (모바일 메뉴 전용)
const MotionLink = motion(Link);

// ──────────────────────────────────────────────
// 1. 카테고리 데이터 정의
// ──────────────────────────────────────────────

/** 최상단 고정 노출 — 사용 빈도 가장 높은 핵심 5개 */
const TOP_ITEMS: { path: string; label: string; icon: string }[] = [
  { path: '/', label: '홈', icon: 'ri-home-line' },
  { path: '/clubs', label: '동아리', icon: 'ri-group-line' },
  { path: '/notices', label: '공지사항', icon: 'ri-megaphone-line' },
  { path: '/schedule', label: '일정', icon: 'ri-calendar-event-line' },
  { path: '/suggestions', label: '건의사항', icon: 'ri-lightbulb-line' },
  { path: '/qna-board', label: '질문 있어요', icon: 'ri-question-answer-line' },
];

interface CategoryItem {
  path: string;
  label: string;
  icon: string;
}

interface CategoryGroup {
  name: string;
  icon: string;
  colorClass: string;
  items: CategoryItem[];
}

/** 말씀·성경 도구 (8개) */
const BIBLE_CATEGORY: CategoryGroup = {
  name: '말씀 도구',
  icon: 'ri-book-open-line',
  colorClass: 'amber',
  items: [
    { path: '/bible-pick', label: '말씀뽑기', icon: 'ri-book-open-line' },
    { path: '/bible-pick/history', label: '말씀 히스토리', icon: 'ri-history-line' },
    { path: '/bible-quiz', label: '성경 퀴즈', icon: 'ri-question-answer-line' },
    { path: '/bible-mbti', label: '말씀 MBTI', icon: 'ri-user-heart-line' },
    { path: '/bible-by-age', label: '연령별 말씀', icon: 'ri-book-read-line' },
    { path: '/bible-marathon', label: '성경 완독', icon: 'ri-book-open-line' },
  ],
};

/** 소통·공동체 (6개 + 도구 2개) */
const COMMUNITY_CATEGORY: CategoryGroup = {
  name: '소통·공동체',
  icon: 'ri-group-line',
  colorClass: 'emerald',
  items: [
    { path: '/memory-board', label: '추억창', icon: 'ri-image-line' },
    { path: '/song-vote', label: '찬양투표', icon: 'ri-music-line' },
    { path: '/prayer-partner', label: '신앙 짝꿍', icon: 'ri-heart-pulse-line' },
    { path: '/prayer-relay', label: '기도 릴레이', icon: 'ri-hand-heart-line' },
    { path: '/missions/wall', label: '사명 인증 게시판', icon: 'ri-gallery-line' },
  ],
};

/** 갓겜 (게임) */
const GAME_CATEGORY: CategoryGroup = {
  name: '갓겜',
  icon: 'ri-gamepad-line',
  colorClass: 'indigo',
  items: [
    { path: '/games', label: '전체 게임 보기', icon: 'ri-apps-2-line' },
    { path: '/pharisee', label: '바리새인을 찾아라', icon: 'ri-book-open-line' },
    { path: '/wolves-and-sheep', label: '양과 늑대', icon: 'ri-user-3-line' },
    { path: '/galilee-phone', label: '갈릴리폰', icon: 'ri-chat-smile-3-line' },
  ],
};

interface MissionSubSection {
  label: string;
  items: { path?: string; label: string; icon: string; action?: string }[];
}

/** 사명자 전용 (12개 → 4개 소제목) */
const MISSION_SUBSECTIONS: MissionSubSection[] = [
  {
    label: '출석 관리',
    items: [
      { path: '/dashboard/attendance/analytics', label: '출석 통계 분석', icon: 'ri-bar-chart-line' },
      { path: '/attendance-board', label: '실시간 출석 현황판', icon: 'ri-user-heart-line' },
    ],
  },
  {
    label: '회의록',
    items: [
      { path: '/meetings', label: '회의록', icon: 'ri-chat-check-line' },
      { path: '/meeting-copilot', label: '회의 코파일럿 AI', icon: 'ri-lightbulb-flash-line' },
    ],
  },
  {
    label: '사명 도구',
    items: [
      { path: '/pds-planner', label: '행사 기획 마법사', icon: 'ri-todo-line' },
      { path: '/event-ideas', label: '행사 기획 아이디어', icon: 'ri-lightbulb-flash-line' },
      { path: '/leadership-diary', label: '리더십 코칭', icon: 'ri-book-read-line' },
    ],
  },
  {
    label: '보고서',
    items: [
      { path: '/reports/weekly', label: '주간 보고서', icon: 'ri-file-list-3-line' },
      { path: '/reports/growth', label: '성장 기록', icon: 'ri-plant-line' },
      { path: '/reports/events', label: '행사 보고서', icon: 'ri-calendar-event-line' },
      { path: '/visitations', label: '심방 스케줄', icon: 'ri-heart-pulse-line' },
    ],
  },
  {
    label: '미션',
    items: [
      { path: '/student-council-center', label: '학생회 발전센터', icon: 'ri-rocket-2-line' },
      { path: '/missions', label: '작은 사명 관리', icon: 'ri-medal-line' },
      { path: '/missions/leaderboard', label: '이달의 사명왕', icon: 'ri-trophy-line' },
    ],
  },
];

interface AdminItem {
  label: string;
  icon: string;
  path: string;
  minRole: UserRole;
}

/** 관리자 전용 (6개) */
const ADMIN_CATEGORY_ITEMS: AdminItem[] = [
  { label: '가입 승인', icon: 'ri-user-star-line', path: '/admin/approvals', minRole: 'teacher' },
  { label: '보고서 검토', icon: 'ri-file-search-line', path: '/reports/review', minRole: 'president' },
  { label: '권한 관리', icon: 'ri-shield-keyhole-line', path: '/admin/roles', minRole: 'chief' },
  { label: '전략 대시보드', icon: 'ri-bar-chart-line', path: '/admin/strategy', minRole: 'chief' },
  { label: '불참 사유 설정', icon: 'ri-settings-3-line', path: '/settings/absence-reasons', minRole: 'chief' },
  { label: '출석 위치 설정', icon: 'ri-map-pin-line', path: '/settings/attendance-location', minRole: 'teacher' },
];

/** 프로필 드롭다운 — "나의 신앙 기록" 그룹 */
const PROFILE_FAITH_ITEMS: CategoryItem[] = [
  { path: '/faith-storybook', label: '신앙 스토리북', icon: 'ri-bookmark-line' },
  { path: '/faith-journal', label: '신앙 일지', icon: 'ri-edit-line' },
  { path: '/repentance-journal', label: '회개 저널', icon: 'ri-hand-heart-line' },
  { path: '/bucket-list', label: '버킷리스트', icon: 'ri-todo-line' },
  { path: '/year-end-summary', label: '월별 결산', icon: 'ri-calendar-check-line' },
];

/** 신앙 (5개) — 상단 네비게이션 노출용. 항목은 PROFILE_FAITH_ITEMS와 동일. */
const FAITH_CATEGORY: CategoryGroup = {
  name: '신앙',
  icon: 'ri-heart-2-line',
  colorClass: 'primary',
  items: PROFILE_FAITH_ITEMS,
};

const PROFILE_ACTIVITY_ITEMS: CategoryItem[] = [
  { path: '/personal-schedule', label: '개인 일정', icon: 'ri-calendar-check-line' },
  { path: '/dashboard/attendance', label: '스마트 출석', icon: 'ri-user-heart-line' },
  { path: '/missions/board', label: '작은 사명', icon: 'ri-medal-line' },
];

// ──────────────────────────────────────────────
// 2. 헬퍼 — 색상 토큰
// ──────────────────────────────────────────────

function catBgActive(cat: string) {
  switch (cat) {
    case 'amber': return 'bg-amber-100 text-amber-700';
    case 'emerald': return 'bg-emerald-100 text-emerald-700';
    case 'rose': return 'bg-accent-100 text-accent-700';
    case 'slate': return 'bg-secondary-100 text-secondary-700';
    case 'primary': return 'bg-primary-100 text-primary-700';
    case 'indigo': return 'bg-indigo-100 text-indigo-700';
    default: return 'bg-primary-100 text-primary-700';
  }
}
function catBgHover(cat: string) {
  switch (cat) {
    case 'amber': return 'hover:bg-amber-50 hover:text-amber-700';
    case 'emerald': return 'hover:bg-emerald-50 hover:text-emerald-700';
    case 'rose': return 'hover:bg-accent-50 hover:text-accent-700';
    case 'slate': return 'hover:bg-secondary-50 hover:text-secondary-700';
    case 'primary': return 'hover:bg-primary-50 hover:text-primary-700';
    case 'indigo': return 'hover:bg-indigo-50 hover:text-indigo-700';
    default: return 'hover:bg-background-100 hover:text-foreground-950';
  }
}

/** 모바일 "내 권한 뱃지" — 프로필 미니카드에 눈에 띄는 이모지로 표시 */
function roleEmoji(role: UserRole) {
  switch (role) {
    case 'chief': return '👑';
    case 'teacher': return '🍎';
    case 'president': return '🎖️';
    default: return '🌱';
  }
}

// ──────────────────────────────────────────────
// 2-1. 다크모드 / 화이트모드 토글 버튼
// ──────────────────────────────────────────────

function ThemeToggleButton({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? '화이트 모드로 전환' : '다크 모드로 전환'}
      title={isDark ? '화이트 모드로 전환' : '다크 모드로 전환'}
      className={`flex items-center justify-center w-9 h-9 rounded-full bg-background-100 hover:bg-background-200 border border-background-200 text-foreground-600 hover:text-foreground-900 transition-all duration-200 cursor-pointer hover:scale-[1.05] ${className}`}
    >
      <i className={`text-base ${isDark ? 'ri-sun-line' : 'ri-moon-line'}`}></i>
    </button>
  );
}

// ──────────────────────────────────────────────
// 3. Navbar 컴포넌트
// ──────────────────────────────────────────────

export default function Navbar() {
  const { user, profile, signOut, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // 데스크톱 드롭다운 상태
  const [profileOpen, setProfileOpen] = useState(false);
  const [bibleOpen, setBibleOpen] = useState(false);
  const [faithOpen, setFaithOpen] = useState(false);
  const [commOpen, setCommOpen] = useState(false);
  const [missionOpen, setMissionOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [gameOpen, setGameOpen] = useState(false);

  // 모바일 — 메뉴 열림상태는 하단 탭바와 공유해야 해서 컨텍스트로 관리(로직은 동일)
  const { mobileOpen, setMobileOpen } = useMobileMenu();
  const [mobileAccordion, setMobileAccordion] = useState<Record<string, boolean>>({});

  // 모달
  const [meetingIdeasOpen, setMeetingIdeasOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // 스크롤
  const [scrolled, setScrolled] = useState(false);

  const notificationCount = useNotificationCount(user);

  // refs for outside-click
  const profileRef = useRef<HTMLDivElement>(null);
  const bibleRef = useRef<HTMLDivElement>(null);
  const faithRef = useRef<HTMLDivElement>(null);
  const commRef = useRef<HTMLDivElement>(null);
  const missionRef = useRef<HTMLDivElement>(null);
  const adminRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<HTMLDivElement>(null);

  // scroll 감지
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // outside click → 모든 드롭다운 닫기
  useEffect(() => {
    const refs = [profileRef, bibleRef, faithRef, commRef, missionRef, adminRef, gameRef];
    const handler = (e: MouseEvent) => {
      if (refs.every(ref => !ref.current || !ref.current.contains(e.target as Node))) {
        setProfileOpen(false);
        setBibleOpen(false);
        setFaithOpen(false);
        setCommOpen(false);
        setMissionOpen(false);
        setAdminOpen(false);
        setGameOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const toggleMobileAccordion = (key: string) => {
    setMobileAccordion(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const showMissionTab = hasRole('assistant_zone_leader') || hasRole('zone_leader') || hasRole('teacher') || hasRole('president') || hasRole('chief');
  const showTeacherTab = hasRole('teacher') || hasRole('president') || hasRole('chief');

  const handleMissionAction = (item: { path?: string; action?: string }) => {
    if (item.path) navigate(item.path);
    if (item.action === 'meeting-ideas') setMeetingIdeasOpen(true);
    setMobileOpen(false);
  };

  return (
    <>
      <header className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-background-50/95 backdrop-blur-md shadow-sm' : 'bg-background-50'}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link to="/" className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-500 text-white shadow-sm">
                <i className="ri-cross-line text-xl" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-foreground-950 sm:text-base">스스로 신앙하는 거침없는 강릉 학생회</p>
                <p className="hidden text-[10px] font-medium tracking-[0.18em] text-foreground-400 sm:block">GANGNEUNG STUDENT ASSOCIATION</p>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setNotificationsOpen(true)}
                className="relative flex h-10 w-10 items-center justify-center rounded-full text-foreground-600 hover:bg-background-100"
                aria-label="알림"
              >
                <i className="ri-notification-3-line text-xl" />
                {notificationCount > 0 && <span className="absolute right-1 top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[9px] font-bold text-white">{notificationCount > 99 ? '99+' : notificationCount}</span>}
              </button>
              <ThemeToggleButton />
              <button
                type="button"
                onClick={() => setMobileOpen(!mobileOpen)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-foreground-600 hover:bg-background-100 lg:hidden"
                aria-label={mobileOpen ? '메뉴 닫기' : '메뉴 열기'}
                aria-expanded={mobileOpen}
              >
                <i className={`text-2xl ${mobileOpen ? 'ri-close-line' : 'ri-menu-line'}`} />
              </button>
            </div>
          </div>

          <nav className="hidden items-center gap-1 overflow-x-auto py-2 lg:flex">
            {TOP_ITEMS.map(item => (
              <Link key={item.path} to={item.path} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${isActive(item.path) ? 'bg-primary-100 text-primary-700' : 'text-foreground-600 hover:bg-background-100 hover:text-foreground-950'}`}>
                <i className={item.icon} />
                {item.label}
              </Link>
            ))}
            <div ref={bibleRef} className="relative">
              <button type="button" onClick={() => setBibleOpen(v => !v)} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ${bibleOpen ? catBgActive(BIBLE_CATEGORY.colorClass) : `text-foreground-600 ${catBgHover(BIBLE_CATEGORY.colorClass)}`}`}>
                <i className={BIBLE_CATEGORY.icon} />{BIBLE_CATEGORY.name}<i className="ri-arrow-down-s-line text-xs" />
              </button>
              {bibleOpen && <div className="absolute left-0 top-full mt-1 w-64 rounded-2xl border border-background-200 bg-background-50 p-2 shadow-xl">
                <div className="grid grid-cols-2 gap-1">{BIBLE_CATEGORY.items.map(item => <Link key={item.path} to={item.path} onClick={() => setBibleOpen(false)} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold ${isActive(item.path) ? catBgActive(BIBLE_CATEGORY.colorClass) : `text-foreground-700 ${catBgHover(BIBLE_CATEGORY.colorClass)}`}`}><i className={item.icon} />{item.label}</Link>)}</div>
              </div>}
            </div>
            <div ref={commRef} className="relative">
              <button type="button" onClick={() => setCommOpen(v => !v)} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ${commOpen ? catBgActive(COMMUNITY_CATEGORY.colorClass) : `text-foreground-600 ${catBgHover(COMMUNITY_CATEGORY.colorClass)}`}`}>
                <i className={COMMUNITY_CATEGORY.icon} />{COMMUNITY_CATEGORY.name}<i className="ri-arrow-down-s-line text-xs" />
              </button>
              {commOpen && <div className="absolute left-0 top-full mt-1 w-64 rounded-2xl border border-background-200 bg-background-50 p-2 shadow-xl"><div className="grid grid-cols-2 gap-1">{COMMUNITY_CATEGORY.items.map(item => <Link key={item.path} to={item.path} onClick={() => setCommOpen(false)} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold ${isActive(item.path) ? catBgActive(COMMUNITY_CATEGORY.colorClass) : `text-foreground-700 ${catBgHover(COMMUNITY_CATEGORY.colorClass)}`}`}><i className={item.icon} />{item.label}</Link>)}</div></div>}
            </div>
            <div ref={gameRef} className="relative">
              <button type="button" onClick={() => setGameOpen(v => !v)} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ${gameOpen ? catBgActive(GAME_CATEGORY.colorClass) : `text-foreground-600 ${catBgHover(GAME_CATEGORY.colorClass)}`}`}>
                <i className={GAME_CATEGORY.icon} />{GAME_CATEGORY.name}<i className="ri-arrow-down-s-line text-xs" />
              </button>
              {gameOpen && <div className="absolute left-0 top-full mt-1 w-64 rounded-2xl border border-background-200 bg-background-50 p-2 shadow-xl"><div className="grid grid-cols-2 gap-1">{GAME_CATEGORY.items.map(item => <Link key={item.path} to={item.path} onClick={() => setGameOpen(false)} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold ${isActive(item.path) ? catBgActive(GAME_CATEGORY.colorClass) : `text-foreground-700 ${catBgHover(GAME_CATEGORY.colorClass)}`}`}><i className={item.icon} />{item.label}</Link>)}</div></div>}
            </div>
            <div ref={faithRef} className="relative">
              <button type="button" onClick={() => setFaithOpen(v => !v)} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ${faithOpen ? catBgActive(FAITH_CATEGORY.colorClass) : `text-foreground-600 ${catBgHover(FAITH_CATEGORY.colorClass)}`}`}>
                <i className={FAITH_CATEGORY.icon} />{FAITH_CATEGORY.name}<i className="ri-arrow-down-s-line text-xs" />
              </button>
              {faithOpen && <div className="absolute left-0 top-full mt-1 w-64 rounded-2xl border border-background-200 bg-background-50 p-2 shadow-xl"><div className="grid grid-cols-2 gap-1">{FAITH_CATEGORY.items.map(item => <Link key={item.path} to={item.path} onClick={() => setFaithOpen(false)} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold ${isActive(item.path) ? catBgActive(FAITH_CATEGORY.colorClass) : `text-foreground-700 ${catBgHover(FAITH_CATEGORY.colorClass)}`}`}><i className={item.icon} />{item.label}</Link>)}</div></div>}
            </div>
            {showMissionTab && <div ref={missionRef} className="relative">
              <button type="button" onClick={() => setMissionOpen(v => !v)} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ${missionOpen ? catBgActive('rose') : `text-foreground-600 ${catBgHover('rose')}`}`}>
                <i className="ri-shield-star-line" />사명자 전용<i className="ri-arrow-down-s-line text-xs" />
              </button>
              {missionOpen && <div className="absolute right-0 top-full mt-1 w-[30rem] max-w-[90vw] rounded-2xl border border-background-200 bg-background-50 p-3 shadow-xl">
                {showTeacherTab && <div className="mb-3 grid grid-cols-2 gap-2">
                  <Link to="/student-council-center" onClick={() => setMissionOpen(false)} className={`rounded-xl p-3 text-sm font-bold ${isActive('/student-council-center') ? 'bg-indigo-100 text-indigo-700' : 'bg-background-100 text-foreground-700 hover:bg-indigo-50'}`}><i className="ri-rocket-2-line mr-2" />학생회 발전센터</Link>
                  <Link to="/teacher-dashboard" onClick={() => setMissionOpen(false)} className={`rounded-xl p-3 text-sm font-bold ${isActive('/teacher-dashboard') ? 'bg-accent-100 text-accent-700' : 'bg-background-100 text-foreground-700 hover:bg-accent-50'}`}><i className="ri-dashboard-line mr-2" />교사 대시보드</Link>
                </div>}
                <div className="grid grid-cols-2 gap-2">{MISSION_SUBSECTIONS.flatMap(section => section.items).map(item => <Link key={item.path ?? item.label} to={item.path ?? '#'} onClick={(e) => { if (!item.path) e.preventDefault(); setMissionOpen(false); }} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold ${item.path && isActive(item.path) ? catBgActive('rose') : `text-foreground-700 ${catBgHover('rose')}`}`}><i className={item.icon} />{item.label}</Link>)}</div>
              </div>}
            </div>}
            {hasRole('teacher') || hasRole('president') || hasRole('chief') ? <div ref={adminRef} className="relative">
              <button type="button" onClick={() => setAdminOpen(v => !v)} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ${adminOpen ? catBgActive('slate') : `text-foreground-600 ${catBgHover('slate')}`}`}><i className="ri-settings-3-line" />관리자<i className="ri-arrow-down-s-line text-xs" /></button>
              {adminOpen && <div className="absolute right-0 top-full mt-1 w-72 rounded-2xl border border-background-200 bg-background-50 p-2 shadow-xl">{ADMIN_CATEGORY_ITEMS.filter(item => hasRole(item.minRole)).map(item => <Link key={item.path} to={item.path} onClick={() => setAdminOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${isActive(item.path) ? catBgActive('slate') : `text-foreground-700 ${catBgHover('slate')}`} `}><i className={item.icon} />{item.label}</Link>)}</div>}
            </div> : null}
          </nav>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="border-t border-background-200 bg-background-50 lg:hidden">
              <div className="mx-auto max-h-[calc(100vh-4rem)] max-w-7xl overflow-y-auto overscroll-contain px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <div className="grid grid-cols-3 gap-1.5">
                  {TOP_ITEMS.map(item => <Link key={`m-top-${item.path}`} to={item.path} onClick={() => setMobileOpen(false)} className={`flex min-h-12 flex-col items-center justify-center rounded-xl px-2 py-2 text-center text-[11px] font-semibold ${isActive(item.path) ? 'bg-primary-100 text-primary-700' : 'text-foreground-700 hover:bg-background-100'}`}><i className={`${item.icon} mb-0.5 text-lg`} />{item.label}</Link>)}
                </div>

                <AccordionBlock icon={BIBLE_CATEGORY.icon} label={BIBLE_CATEGORY.name} color="amber" open={!!mobileAccordion['bible']} onToggle={() => toggleMobileAccordion('bible')}>
                  <div className="grid grid-cols-3 gap-1">{BIBLE_CATEGORY.items.map(item => <MenuGridCard key={`m-bible-${item.path}`} icon={item.icon} label={item.label} colorClass="bg-amber-100 text-amber-700" active={isActive(item.path)} onClick={() => { navigate(item.path); setMobileOpen(false); }} />)}</div>
                </AccordionBlock>

                <AccordionBlock icon={COMMUNITY_CATEGORY.icon} label={COMMUNITY_CATEGORY.name} color="emerald" open={!!mobileAccordion['community']} onToggle={() => toggleMobileAccordion('community')}>
                  <div className="grid grid-cols-3 gap-1">{COMMUNITY_CATEGORY.items.map(item => <MenuGridCard key={`m-community-${item.path}`} icon={item.icon} label={item.label} colorClass="bg-emerald-100 text-emerald-700" active={isActive(item.path)} onClick={() => { navigate(item.path); setMobileOpen(false); }} />)}</div>
                </AccordionBlock>

                <AccordionBlock icon={GAME_CATEGORY.icon} label={GAME_CATEGORY.name} color="indigo" open={!!mobileAccordion['game']} onToggle={() => toggleMobileAccordion('game')}>
                  <div className="grid grid-cols-3 gap-1">{GAME_CATEGORY.items.map(item => <MenuGridCard key={`m-game-${item.path}`} icon={item.icon} label={item.label} colorClass="bg-indigo-100 text-indigo-700" active={isActive(item.path)} onClick={() => { navigate(item.path); setMobileOpen(false); }} />)}</div>
                </AccordionBlock>

                <AccordionBlock icon={FAITH_CATEGORY.icon} label="신앙(비공개)" color="primary" open={!!mobileAccordion['faith']} onToggle={() => toggleMobileAccordion('faith')}>
                  <div className="grid grid-cols-3 gap-1">{FAITH_CATEGORY.items.map(item => <MenuGridCard key={`m-faith-${item.path}`} icon={item.icon} label={item.label} colorClass="bg-primary-100 text-primary-600" active={isActive(item.path)} onClick={() => { navigate(item.path); setMobileOpen(false); }} />)}</div>
                </AccordionBlock>

                {showMissionTab && <AccordionBlock icon="ri-shield-star-line" label="사명자 전용" color="rose" open={!!mobileAccordion['mission']} onToggle={() => toggleMobileAccordion('mission')}>
                  <div className="space-y-3">
                    {showTeacherTab && (
                      <>
                        <MenuGridCard
                          icon="ri-rocket-2-line"
                          label="학생회 발전센터"
                          colorClass="bg-indigo-100 text-indigo-600"
                          active={isActive('/student-council-center')}
                          onClick={() => { navigate('/student-council-center'); setMobileOpen(false); }}
                        />
                        <MenuGridCard
                          icon="ri-dashboard-line"
                          label="교사 대시보드"
                          colorClass="bg-accent-100 text-accent-600"
                          active={isActive('/teacher-dashboard')}
                          onClick={() => { navigate('/teacher-dashboard'); setMobileOpen(false); }}
                        />
                      </>
                    )}
                    {MISSION_SUBSECTIONS.map((section) => (
                      <div key={`m-ms-${section.label}`}>
                        <p className="px-2 py-1 text-[11px] font-semibold text-foreground-400 uppercase tracking-wider">{section.label}</p>
                        <div className="grid grid-cols-3 gap-1">
                          {section.items.map((item) => <MenuGridCard key={`m-msi-${item.label}`} icon={item.icon} label={item.label} colorClass="bg-accent-100 text-accent-600" active={!!item.path && isActive(item.path)} onClick={() => handleMissionAction(item)} />)}
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionBlock>}

                {(hasRole('teacher') || hasRole('president') || hasRole('chief')) && <AccordionBlock icon="ri-settings-3-line" label="관리자" color="slate" open={!!mobileAccordion['admin']} onToggle={() => toggleMobileAccordion('admin')}>
                  <div className="grid grid-cols-3 gap-1">{ADMIN_CATEGORY_ITEMS.filter(item => hasRole(item.minRole)).map(item => <MenuGridCard key={`m-admin-${item.path}`} icon={item.icon} label={item.label} colorClass="bg-secondary-100 text-secondary-700" active={isActive(item.path)} onClick={() => { navigate(item.path); setMobileOpen(false); }} />)}</div>
                </AccordionBlock>}

                {profile && <div className="mt-4 flex items-center gap-3 rounded-2xl border border-background-200 bg-background-100 p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-lg">{roleEmoji(profile.role as UserRole)}</div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-foreground-950">{profile.name || user?.email}</p><p className="truncate text-xs text-foreground-500">{ROLE_LABELS[profile.role as UserRole] ?? profile.role}</p></div>
                  <button type="button" onClick={async () => { await signOut(); setMobileOpen(false); }} className="rounded-xl bg-background-50 px-3 py-2 text-xs font-bold text-foreground-700">로그아웃</button>
                </div>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <NotificationsModal open={notificationsOpen} onClose={() => setNotificationsOpen(false)} user={user} />
      <MeetingIdeasModal open={meetingIdeasOpen} onClose={() => setMeetingIdeasOpen(false)} />
      <NotificationToast user={user} />
    </>
  );
}

function AccordionBlock({ icon, label, color, open, onToggle, children }: { icon: string; label: string; color: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  const colorMap: Record<string, string> = {
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    primary: 'bg-primary-50 text-primary-700',
    rose: 'bg-accent-50 text-accent-700',
    slate: 'bg-secondary-50 text-secondary-700',
  };
  return <div className="mt-3 overflow-hidden rounded-2xl border border-background-200 bg-background-50"><button type="button" onClick={onToggle} className={`flex w-full items-center justify-between px-4 py-3 text-sm font-bold ${open ? colorMap[color] : 'text-foreground-800'}`} aria-expanded={open}><span className="flex items-center gap-2"><i className={icon} />{label}</span><i className={`ri-arrow-down-s-line transition-transform ${open ? 'rotate-180' : ''}`} /></button>{open && <div className="border-t border-background-200 p-3">{children}</div>}</div>;
}

function MenuGridCard({ icon, label, colorClass, active, onClick }: { icon: string; label: string; colorClass: string; active?: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex min-h-16 flex-col items-center justify-center rounded-xl border p-2 text-center transition ${active ? `${colorClass} border-current/20` : 'border-background-200 bg-background-50 text-foreground-700 hover:bg-background-100'}`}><i className={`${icon} mb-1 text-lg`} /><span className="text-[11px] font-semibold leading-tight">{label}</span></button>;
}
