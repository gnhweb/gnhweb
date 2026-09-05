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

  const search = (query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return;
    const candidates = [...TOP_ITEMS, ...BIBLE_CATEGORY.items, ...COMMUNITY_CATEGORY.items, ...GAME_CATEGORY.items, ...PROFILE_FAITH_ITEMS, ...PROFILE_ACTIVITY_ITEMS, ...fullMissionItems, ...ADMIN_CATEGORY_ITEMS];
    const hit = candidates.find(item => item.label.toLowerCase().includes(q));
    if (hit?.path) { navigate(hit.path); setGlobalSearch(''); }
  };

  const categoryItems = (category: CategoryGroup) => category.items;
  const renderCategoryDropdown = (category: CategoryGroup, open: boolean, setOpen: (v: boolean) => void, ref: React.RefObject<HTMLDivElement | null>) => (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => { closeAllDesktop(); setOpen(!open); }} className={`flex items-center gap-1.5 px-3 py-2 rounded-input text-sm font-label font-medium transition-colors ${open || category.items.some(item => isActive(item.path)) ? catBgActive(category.colorClass) : 'text-foreground-600 hover:text-foreground-900 hover:bg-background-100'}`}>
        <i className={category.icon}></i><span>{category.name}</span><i className={`ri-arrow-down-s-line text-xs transition-transform ${open ? 'rotate-180' : ''}`}></i>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }} className="absolute left-0 top-full mt-2 min-w-[190px] rounded-card border border-background-200 bg-background-50 p-2 shadow-card-lg z-50">
            {categoryItems(category).map(item => (
              <Link key={item.path} to={item.path} onClick={() => setOpen(false)} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-input text-sm font-label transition-colors ${isActive(item.path) ? catBgActive(category.colorClass) : `text-foreground-700 ${catBgHover(category.colorClass)}`}`}>
                <i className={item.icon}></i><span>{item.label}</span>
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const renderMissionDropdown = () => (
    <div ref={missionRef} className="relative">
      <button type="button" onClick={() => { closeAllDesktop(); setMissionOpen(!missionOpen); }} className={`flex items-center gap-1.5 px-3 py-2 rounded-input text-sm font-label font-medium transition-colors ${missionOpen || fullMissionItems.some(item => item.path && isActive(item.path)) ? 'bg-primary-100 text-primary-700' : 'text-foreground-600 hover:text-foreground-900 hover:bg-background-100'}`}>
        <i className="ri-task-line"></i><span>사명자 전용</span><i className={`ri-arrow-down-s-line text-xs transition-transform ${missionOpen ? 'rotate-180' : ''}`}></i>
      </button>
      <AnimatePresence>
        {missionOpen && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }} className="absolute right-0 top-full mt-2 w-[280px] rounded-card border border-background-200 bg-background-50 p-2 shadow-card-lg z-50">
            {MISSION_SUBSECTIONS.map(section => (
              <div key={section.label} className="px-1 py-1.5">
                <p className="px-2 py-1 text-[11px] font-label font-semibold text-foreground-400">{section.label}</p>
                {section.items.map(item => (
                  <button key={item.path ?? item.action} type="button" onClick={() => handleMissionAction(item)} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-input text-sm font-label text-left transition-colors ${item.path && isActive(item.path) ? 'bg-primary-100 text-primary-700' : 'text-foreground-700 hover:bg-background-100 hover:text-foreground-900'}`}>
                    <i className={item.icon}></i><span>{item.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const renderMobileCategory = (category: CategoryGroup, key: string) => (
    <div key={key} className="border-b border-background-200/70">
      <button type="button" onClick={() => toggleMobileAccordion(key)} className="w-full flex items-center justify-between px-4 py-3 text-sm font-label font-medium text-foreground-700">
        <span className="flex items-center gap-2"><i className={category.icon}></i>{category.name}</span>
        <i className={`ri-arrow-down-s-line transition-transform ${mobileAccordion[key] ? 'rotate-180' : ''}`}></i>
      </button>
      <AnimatePresence>
        {mobileAccordion[key] && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-3 pb-2">
            {category.items.map(item => (
              <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-input text-sm font-label ${isActive(item.path) ? `${catBgActive(category.colorClass)}` : 'text-foreground-700 hover:bg-background-100'}`}>
                <i className={item.icon}></i>{item.label}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <>
      <header className={`sticky top-0 z-40 w-full border-b border-background-200/70 bg-background-50/95 backdrop-blur transition-shadow ${scrolled ? 'shadow-card' : ''}`}>
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-2 px-4 lg:px-6">
          <button type="button" onClick={() => navigate('/')} className="shrink-0 flex items-center gap-2 mr-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-input bg-primary-600 text-white shadow-card"><i className="ri-cross-fill text-lg"></i></div>
            <span className="hidden sm:inline font-heading text-lg font-bold text-foreground-950">GNH</span>
          </button>

          <nav className="hidden lg:flex items-center gap-0.5 flex-1">
            {TOP_ITEMS.map(item => (
              <Link key={item.path} to={item.path} onClick={item.path === '/suggestions' ? handleSuggestions : undefined} className={`flex items-center gap-1.5 px-3 py-2 rounded-input text-sm font-label font-medium transition-colors ${isActive(item.path) ? 'bg-primary-100 text-primary-700' : 'text-foreground-600 hover:text-foreground-900 hover:bg-background-100'}`}>
                <i className={item.icon}></i><span>{item.label}</span>
              </Link>
            ))}
            {renderCategoryDropdown(BIBLE_CATEGORY, bibleOpen, setBibleOpen, bibleRef)}
            {renderCategoryDropdown(FAITH_CATEGORY, faithOpen, setFaithOpen, faithRef)}
            {renderCategoryDropdown(COMMUNITY_CATEGORY, commOpen, setCommOpen, commRef)}
            {showMissionTab && renderMissionDropdown()}
            {showAdminTab && renderCategoryDropdown({ name: '관리', icon: 'ri-settings-3-line', colorClass: 'slate', items: ADMIN_CATEGORY_ITEMS.map(({ path, label, icon }) => ({ path, label, icon })) }, adminOpen, setAdminOpen, adminRef)}
            {renderCategoryDropdown(GAME_CATEGORY, gameOpen, setGameOpen, gameRef)}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <form onSubmit={e => { e.preventDefault(); search(globalSearch); }} className="hidden xl:flex items-center rounded-input border border-background-200 bg-background-50 px-2">
              <i className="ri-search-line text-foreground-400"></i>
              <input value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} placeholder="검색" className="w-32 bg-transparent px-2 py-2 text-sm font-label outline-none placeholder:text-foreground-400" />
            </form>
            <ThemeToggleButton className="hidden sm:flex" />
            <button type="button" onClick={() => setNotificationsOpen(true)} className="relative flex h-9 w-9 items-center justify-center rounded-full bg-background-100 text-foreground-600 hover:bg-background-200 transition-colors" aria-label="알림">
              <i className="ri-notification-3-line"></i>
              {notificationCount > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 h-4 px-1 rounded-chip bg-accent-600 text-white text-[10px] font-bold flex items-center justify-center">{notificationCount > 99 ? '99+' : notificationCount}</span>}
            </button>
            <div ref={profileRef} className="relative">
              <button type="button" onClick={() => { closeAllDesktop(); setProfileOpen(!profileOpen); }} className="flex items-center gap-2 rounded-input px-2 py-1.5 hover:bg-background-100 transition-colors">
                <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold overflow-hidden">
                  {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : (profile?.name?.charAt(0) ?? user?.email?.charAt(0) ?? 'G')}
                </div>
                <div className="hidden md:block text-left leading-tight">
                  <p className="text-xs font-label font-semibold text-foreground-800 truncate max-w-[110px]">{profile?.name ?? '사용자'}</p>
                  <p className="text-[10px] font-label text-foreground-400">{profile?.role ? `${roleEmoji(profile.role)} ${ROLE_LABELS[profile.role]}` : ''}</p>
                </div>
                <i className={`hidden md:block ri-arrow-down-s-line text-xs text-foreground-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`}></i>
              </button>
              <AnimatePresence>
                {profileOpen && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="absolute right-0 top-full mt-2 w-64 rounded-card border border-background-200 bg-background-50 p-2 shadow-card-lg z-50">
                    <div className="px-3 py-2 border-b border-background-200 mb-1">
                      <p className="text-sm font-label font-semibold text-foreground-900">{profile?.name ?? '사용자'}</p>
                      <p className="text-xs font-label text-foreground-400 mt-0.5">{profile?.email ?? user?.email ?? ''}</p>
                    </div>
                    {PROFILE_ACTIVITY_ITEMS.map(item => (
                      <Link key={item.path} to={item.path} onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-input text-sm font-label text-foreground-700 hover:bg-background-100">
                        <i className={item.icon}></i>{item.label}
                      </Link>
                    ))}
                    <button type="button" onClick={handleSignOut} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-input text-sm font-label text-accent-700 hover:bg-accent-50">
                      <i className="ri-logout-box-r-line"></i>로그아웃
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button type="button" onClick={() => setMobileOpen(true)} className="lg:hidden flex h-9 w-9 items-center justify-center rounded-full bg-background-100 text-foreground-700" aria-label="메뉴">
              <i className="ri-menu-line text-lg"></i>
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-foreground-950/40" onClick={() => setMobileOpen(false)}></div>
            <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ duration: 0.2 }} className="absolute right-0 top-0 h-full w-[min(88vw,380px)] overflow-y-auto bg-background-50 shadow-card-lg">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-background-200 bg-background-50 px-4 py-4">
                <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-input bg-primary-600 text-white"><i className="ri-cross-fill"></i></div><span className="font-heading font-bold text-foreground-950">GNH</span></div>
                <div className="flex items-center gap-2"><ThemeToggleButton /><button type="button" onClick={() => setMobileOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-background-100 text-foreground-700" aria-label="닫기"><i className="ri-close-line text-lg"></i></button></div>
              </div>
              <div className="px-3 py-3">
                {TOP_ITEMS.map(item => (
                  <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)} className={`flex items-center gap-2.5 px-3 py-3 rounded-input text-sm font-label ${isActive(item.path) ? 'bg-primary-100 text-primary-700' : 'text-foreground-700 hover:bg-background-100'}`}>
                    <i className={item.icon}></i>{item.label}
                  </Link>
                ))}
                {renderMobileCategory(BIBLE_CATEGORY, 'bible')}
                {renderMobileCategory(FAITH_CATEGORY, 'faith')}
                {renderMobileCategory(COMMUNITY_CATEGORY, 'community')}
                {showMissionTab && (
                  <div className="border-b border-background-200/70">
                    <button type="button" onClick={() => toggleMobileAccordion('mission')} className="w-full flex items-center justify-between px-4 py-3 text-sm font-label font-medium text-foreground-700">
                      <span className="flex items-center gap-2"><i className="ri-task-line"></i>사명자 전용</span><i className={`ri-arrow-down-s-line transition-transform ${mobileAccordion.mission ? 'rotate-180' : ''}`}></i>
                    </button>
                    {mobileAccordion.mission && <div className="px-3 pb-2">{MISSION_SUBSECTIONS.map(section => <div key={section.label} className="py-1"><p className="px-2 py-1 text-[11px] font-label font-semibold text-foreground-400">{section.label}</p>{section.items.map(item => item.path ? <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-input text-sm font-label ${isActive(item.path) ? 'bg-primary-100 text-primary-700' : 'text-foreground-700 hover:bg-background-100'}`}><i className={item.icon}></i>{item.label}</Link> : null)}</div>)}</div>}
                  </div>
                )}
                {showAdminTab && renderMobileCategory({ name: '관리', icon: 'ri-settings-3-line', colorClass: 'slate', items: ADMIN_CATEGORY_ITEMS.map(({ path, label, icon }) => ({ path, label, icon })) }, 'admin')}
                {renderMobileCategory(GAME_CATEGORY, 'game')}
              </div>
              <div className="border-t border-background-200 p-4">
                <button type="button" onClick={handleMobileBack} className="flex w-full items-center justify-center gap-2 rounded-input bg-background-100 px-4 py-3 text-sm font-label text-foreground-700 hover:bg-background-200"><i className="ri-arrow-left-line"></i>뒤로가기</button>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <NotificationsModal user={user} open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
      <MeetingIdeasModal open={meetingIdeasOpen} onClose={() => setMeetingIdeasOpen(false)} />
      <NotificationToast user={user} />
    </>
  );
}
