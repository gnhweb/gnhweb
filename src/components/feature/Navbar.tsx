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

const MotionLink = motion(Link);

const TOP_ITEMS: { path: string; label: string; icon: string }[] = [
  { path: '/', label: '홈', icon: 'ri-home-line' },
  { path: '/clubs', label: '동아리', icon: 'ri-group-line' },
  { path: '/notices', label: '공지사항', icon: 'ri-megaphone-line' },
  { path: '/schedule', label: '일정', icon: 'ri-calendar-event-line' },
  { path: '/suggestions', label: '건의사항', icon: 'ri-lightbulb-line' },
  { path: '/qna-board', label: '질문 있어요', icon: 'ri-question-answer-line' },
];

interface CategoryItem { path: string; label: string; icon: string; }
interface CategoryGroup { name: string; icon: string; colorClass: string; items: CategoryItem[]; }

const BIBLE_CATEGORY: CategoryGroup = {
  name: '말씀 도구', icon: 'ri-book-open-line', colorClass: 'amber',
  items: [
    { path: '/bible-pick', label: '말씀뽑기', icon: 'ri-book-open-line' },
    { path: '/bible-quiz', label: '성경 퀴즈', icon: 'ri-question-answer-line' },
    { path: '/bible-mbti', label: '말씀 MBTI', icon: 'ri-user-heart-line' },
    { path: '/bible-by-age', label: '연령별 말씀', icon: 'ri-book-read-line' },
    { path: '/bible-marathon', label: '성경 완독', icon: 'ri-book-open-line' },
  ],
};

const COMMUNITY_CATEGORY: CategoryGroup = {
  name: '소통·공동체', icon: 'ri-group-line', colorClass: 'emerald',
  items: [
    { path: '/memory-board', label: '추억창', icon: 'ri-image-line' },
    { path: '/song-vote', label: '찬양투표', icon: 'ri-music-line' },
    { path: '/prayer-relay', label: '기도 릴레이', icon: 'ri-hand-heart-line' },
    { path: '/missions/wall', label: '사명 인증 게시판', icon: 'ri-gallery-line' },
  ],
};

const GAME_CATEGORY: CategoryGroup = {
  name: '갓겜', icon: 'ri-gamepad-line', colorClass: 'indigo',
  items: [
    { path: '/games', label: '전체 게임 보기', icon: 'ri-apps-2-line' },
    { path: '/pharisee', label: '바리새인을 찾아라', icon: 'ri-book-open-line' },
    { path: '/wolves-and-sheep', label: '양과 늑대', icon: 'ri-user-3-line' },
    { path: '/galilee-phone', label: '갈릴리폰', icon: 'ri-chat-smile-3-line' },
  ],
};

interface MissionSubSection { label: string; items: { path?: string; label: string; icon: string; action?: string }[]; }
const MISSION_SUBSECTIONS: MissionSubSection[] = [
  { label: '출석 관리', items: [
    { path: '/attendance-board', label: '실시간 출석 현황판', icon: 'ri-user-heart-line' },
  ]},
  { label: '회의록', items: [
    { path: '/meetings', label: '회의록', icon: 'ri-chat-check-line' },
    { path: '/notebook', label: '학생회 노트북', icon: 'ri-book-open-line' },
  ]},
  { label: '보고서', items: [
    { path: '/reports/weekly', label: '주간 보고서', icon: 'ri-file-list-3-line' },
    { path: '/reports/growth', label: '성장 기록', icon: 'ri-plant-line' },
    { path: '/reports/events', label: '행사 보고서', icon: 'ri-calendar-event-line' },
    { path: '/visitations', label: '심방 스케줄', icon: 'ri-heart-pulse-line' },
  ]},
  { label: '사명 도구', items: [
    { path: '/pds-planner', label: '행사 기획 마법사', icon: 'ri-todo-line' },
    { path: '/event-ideas', label: '행사 기획 아이디어', icon: 'ri-lightbulb-flash-line' },
    { path: '/leadership-diary', label: '리더십 코칭', icon: 'ri-book-read-line' },
  ]},
  { label: '미션', items: [
    { path: '/missions', label: '작은 사명 관리', icon: 'ri-medal-line' },
    { path: '/missions/leaderboard', label: '이달의 사명왕', icon: 'ri-trophy-line' },
  ]},
];

interface AdminItem { label: string; icon: string; path: string; minRole: UserRole; }
const ADMIN_CATEGORY_ITEMS: AdminItem[] = [
  { label: '가입 승인', icon: 'ri-user-star-line', path: '/admin/approvals', minRole: 'teacher' },
  { label: '보고서 검토', icon: 'ri-file-search-line', path: '/reports/review', minRole: 'president' },
  { label: '권한 관리', icon: 'ri-shield-keyhole-line', path: '/admin/roles', minRole: 'chief' },
  { label: '전략 대시보드', icon: 'ri-bar-chart-line', path: '/admin/strategy', minRole: 'chief' },
  { label: '불참 사유 설정', icon: 'ri-settings-3-line', path: '/settings/absence-reasons', minRole: 'chief' },
  { label: '출석 위치 설정', icon: 'ri-map-pin-line', path: '/settings/attendance-location', minRole: 'teacher' },
];

const PROFILE_FAITH_ITEMS: CategoryItem[] = [
  { path: '/bible-pick/history', label: '말씀 히스토리', icon: 'ri-history-line' },
  { path: '/bible-streak', label: '말씀 스트릭', icon: 'ri-fire-line' },
  { path: '/faith-journal', label: '신앙일기', icon: 'ri-edit-line' },
  { path: '/bucket-list', label: '버킷리스트', icon: 'ri-todo-line' },
  { path: '/year-end-summary', label: '월별 결산', icon: 'ri-calendar-check-line' },
];
const FAITH_CATEGORY: CategoryGroup = { name: '신앙', icon: 'ri-heart-2-line', colorClass: 'primary', items: PROFILE_FAITH_ITEMS };
const PROFILE_ACTIVITY_ITEMS: CategoryItem[] = [
  { path: '/personal-schedule', label: '개인 일정', icon: 'ri-calendar-check-line' },
  { path: '/dashboard/attendance', label: '스마트 출석', icon: 'ri-user-heart-line' },
  { path: '/missions/board', label: '작은 사명', icon: 'ri-medal-line' },
];

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
function roleEmoji(role: UserRole) {
  switch (role) {
    case 'chief': return '👑';
    case 'teacher': return '🍎';
    case 'president': return '🎖️';
    default: return '🌱';
  }
}

function ThemeToggleButton({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button type="button" onClick={toggleTheme} aria-label={isDark ? '화이트 모드로 전환' : '다크 모드로 전환'} title={isDark ? '화이트 모드로 전환' : '다크 모드로 전환'} className={`flex items-center justify-center w-9 h-9 rounded-full bg-background-100 hover:bg-background-200 border border-background-200 text-foreground-600 hover:text-foreground-900 transition-all duration-200 cursor-pointer hover:scale-[1.05] ${className}`}>
      <i className={`text-base ${isDark ? 'ri-sun-line' : 'ri-moon-line'}`}></i>
    </button>
  );
}

export default function Navbar() {
  const { user, profile, signOut, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [bibleOpen, setBibleOpen] = useState(false);
  const [faithOpen, setFaithOpen] = useState(false);
  const [commOpen, setCommOpen] = useState(false);
  const [missionOpen, setMissionOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [gameOpen, setGameOpen] = useState(false);
  const { mobileOpen, setMobileOpen } = useMobileMenu();
  const [mobileAccordion, setMobileAccordion] = useState<Record<string, boolean>>({});
  const [meetingIdeasOpen, setMeetingIdeasOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const notificationCount = useNotificationCount(user);
  const profileRef = useRef<HTMLDivElement>(null);
  const bibleRef = useRef<HTMLDivElement>(null);
  const faithRef = useRef<HTMLDivElement>(null);
  const commRef = useRef<HTMLDivElement>(null);
  const missionRef = useRef<HTMLDivElement>(null);
  const adminRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const refs = [profileRef, bibleRef, faithRef, commRef, missionRef, adminRef, gameRef];
    const onClickOutside = (e: MouseEvent) => {
      if (refs.every(r => !r.current?.contains(e.target as Node))) {
        setProfileOpen(false); setBibleOpen(false); setFaithOpen(false); setCommOpen(false); setMissionOpen(false); setAdminOpen(false); setGameOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    setMobileOpen(false); setBibleOpen(false); setFaithOpen(false); setCommOpen(false); setMissionOpen(false); setAdminOpen(false); setGameOpen(false); setProfileOpen(false); setMobileAccordion({});
    setGlobalSearch('');
  }, [location.pathname]);

  const closeAllDesktop = () => { setBibleOpen(false); setFaithOpen(false); setCommOpen(false); setMissionOpen(false); setAdminOpen(false); };
  const isActive = (path: string) => location.pathname === path;
  const handleMissionAction = (item: { path?: string; action?: string }) => {
    closeAllDesktop(); setMobileOpen(false);
    if (item.path) navigate(item.path);
    else if (item.action === 'meeting-ideas') setMeetingIdeasOpen(true);
  };
  const handleSuggestions = (e: React.MouseEvent) => { e.preventDefault(); navigate('/suggestions'); };
  const handleSignOut = async () => { await signOut(); setProfileOpen(false); setMobileOpen(false); };
  const toggleMobileAccordion = (key: string) => setMobileAccordion(prev => ({ ...prev, [key]: !prev[key] }));

  const handleMobileBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else if (location.pathname !== '/') {
      navigate('/');
    }
  };

  const isIosPwa = () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const displayModeStandalone = window.matchMedia?.('(display-mode: standalone)').matches === true;
    return /iPhone|iPad|iPod/.test(navigator.userAgent) && (standalone || displayModeStandalone);
  };

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (!mobileOpen) return;
    const scrollY = window.scrollY;
    const body = document.body;
    body.dataset.scrollLockY = String(scrollY);
    body.style.top = `-${scrollY}px`;
    body.classList.add('scroll-lock');
    return () => {
      const savedY = Number(body.dataset.scrollLockY || scrollY);
      body.classList.remove('scroll-lock'); body.style.top = ''; delete body.dataset.scrollLockY;
      window.requestAnimationFrame(() => window.scrollTo(0, Number.isFinite(savedY) ? savedY : 0));
    };
  }, [mobileOpen]);

  const showMissionTab = user && hasRole('assistant_zone_leader');
  const showAdminTab = user && hasRole('president');
  const showTeacherTab = user && (hasRole('teacher') || hasRole('chief'));
  const fullMissionItems = (() => {
    const items: { path?: string; label: string; icon: string; action?: string }[] = [];
    for (const section of MISSION_SUBSECTIONS) items.push(...section.items);
    return items;
  })();
  const desktopCategories = [BIBLE_CATEGORY, COMMUNITY_CATEGORY, FAITH_CATEGORY, GAME_CATEGORY];
  const profileLabel = profile?.name || profile?.full_name || '내 프로필';

  return (
    <>
      <header className={`sticky top-0 z-40 border-b border-background-200 bg-background-50/95 backdrop-blur ${scrolled ? 'shadow-sm' : ''}`}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-1 md:gap-2">
            <Link to="/" className="mr-1 flex shrink-0 items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100 text-primary-700"><i className="ri-cross-line text-lg" /></span>
              <span className="hidden text-sm font-black text-foreground-950 sm:block">GNH</span>
            </Link>
            <nav className="hidden items-center gap-1 lg:flex">
              {TOP_ITEMS.map(item => <Link key={item.path} to={item.path} className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${isActive(item.path) ? 'bg-background-100 text-foreground-950' : 'text-foreground-600 hover:bg-background-100 hover:text-foreground-950'}`}><i className={`${item.icon} mr-1.5`} />{item.label}</Link>)}
            </nav>
          </div>

          <div className="hidden items-center gap-1 md:flex">
            {desktopCategories.map(category => (
              <div key={category.name} ref={category.name === '말씀 도구' ? bibleRef : category.name === '신앙' ? faithRef : category.name === '소통·공동체' ? commRef : gameRef} className="relative">
                <button onClick={() => {
                  const setter = category.name === '말씀 도구' ? setBibleOpen : category.name === '신앙' ? setFaithOpen : category.name === '소통·공동체' ? setCommOpen : setGameOpen;
                  const getter = category.name === '말씀 도구' ? bibleOpen : category.name === '신앙' ? faithOpen : category.name === '소통·공동체' ? commOpen : gameOpen;
                  closeAllDesktop(); setter(!getter);
                }} className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${category.items.some(item => isActive(item.path)) ? catBgActive(category.colorClass) : `text-foreground-600 ${catBgHover(category.colorClass)}`}`}>
                  <i className={`${category.icon} mr-1.5`} />{category.name}<i className="ri-arrow-down-s-line ml-1 text-xs" />
                </button>
                {(category.name === '말씀 도구' ? bibleOpen : category.name === '신앙' ? faithOpen : category.name === '소통·공동체' ? commOpen : gameOpen) && (
                  <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-background-200 bg-background-50 p-2 shadow-card-lg">
                    {category.items.map(item => <Link key={item.path} to={item.path} className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition ${isActive(item.path) ? catBgActive(category.colorClass) : `text-foreground-700 ${catBgHover(category.colorClass)}`}`}><i className={`${item.icon} text-foreground-400`} />{item.label}</Link>)}
                  </div>
                )}
              </div>
            ))}

            {showMissionTab && <div ref={missionRef} className="relative">
              <button onClick={() => { closeAllDesktop(); setMissionOpen(!missionOpen); }} className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${fullMissionItems.some(item => item.path && isActive(item.path)) ? 'bg-secondary-100 text-secondary-700' : 'text-foreground-600 hover:bg-background-100'}`}><i className="ri-flag-line mr-1.5" />사명<i className="ri-arrow-down-s-line ml-1 text-xs" /></button>
              {missionOpen && <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-background-200 bg-background-50 p-3 shadow-card-lg">{MISSION_SUBSECTIONS.map(section => <div key={section.label} className="mb-3 last:mb-0"><p className="px-2 py-1 text-[10px] font-bold tracking-widest text-foreground-400">{section.label}</p>{section.items.map(item => <button key={item.label} onClick={() => handleMissionAction(item)} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-foreground-700 hover:bg-background-100"><i className={`${item.icon} text-foreground-400`} />{item.label}</button>)}</div>)}</div>}
            </div>}

            {showAdminTab && <div ref={adminRef} className="relative">
              <button onClick={() => { closeAllDesktop(); setAdminOpen(!adminOpen); }} className="rounded-xl px-3 py-2 text-sm font-semibold text-foreground-600 hover:bg-background-100"><i className="ri-shield-user-line mr-1.5" />관리</button>
              {adminOpen && <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-background-200 bg-background-50 p-2 shadow-card-lg">{ADMIN_CATEGORY_ITEMS.filter(item => hasRole(item.minRole)).map(item => <Link key={item.path} to={item.path} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-foreground-700 hover:bg-background-100"><i className={`${item.icon} text-foreground-400`} />{item.label}</Link>)}</div>}
            </div>}
          </div>

          <div ref={profileRef} className="relative flex shrink-0 items-center gap-1">
            <button onClick={() => setNotificationsOpen(true)} className="relative flex h-9 w-9 items-center justify-center rounded-full text-foreground-600 hover:bg-background-100"><i className="ri-notification-3-line text-lg" />{notificationCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent-500" />}</button>
            <ThemeToggleButton className="hidden sm:flex" />
            <button onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-2 rounded-full p-1 hover:bg-background-100">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-primary-700"><i className="ri-user-line" /></span>
              <span className="hidden max-w-28 truncate text-sm font-semibold text-foreground-700 xl:block">{profileLabel}</span>
              <i className="hidden ri-arrow-down-s-line text-xs text-foreground-400 xl:block" />
            </button>
            {profileOpen && <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-background-200 bg-background-50 p-2 shadow-card-lg">
              <Link to="/profile" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-foreground-700 hover:bg-background-100"><i className="ri-user-settings-line text-foreground-400" />프로필 설정</Link>
              {user && <button onClick={handleSignOut} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-foreground-700 hover:bg-background-100"><i className="ri-logout-box-line text-foreground-400" />로그아웃</button>}
            </div>}
          </div>
        </div>
      </header>
      <MeetingIdeasModal open={meetingIdeasOpen} onClose={() => setMeetingIdeasOpen(false)} />
      <NotificationsModal open={notificationsOpen} onClose={() => setNotificationsOpen(false)} user={user} />
      <NotificationToast user={user} />
    </>
  );
}
