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
  { path: '/faith-storybook', label: '신앙 스토리북', icon: 'ri-bookmark-line' },
  { path: '/faith-journal', label: '신앙일기', icon: 'ri-edit-line' },
  { path: '/repentance-journal', label: '회개 저널', icon: 'ri-hand-heart-line' },
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

  const showTeacherTab = user && (hasRole('teacher') || hasRole('chief'));
  const fullMissionItems = (() => {
    const items: { path?: string; label: string; icon: string; action?: string }[] = [];
    if (showTeacherTab) items.push({ path: '/teacher-dashboard', label: '교사 대시보드', icon: 'ri-dashboard-line' });
    MISSION_SUBSECTIONS.forEach(sec => items.push(...sec.items));
    return items;
  })();
  const visibleAdminItems = ADMIN_CATEGORY_ITEMS.filter(i => hasRole(i.minRole));

  return (
    <>
      <nav className={`sticky top-0 z-40 pt-safe transition-all duration-300 ${scrolled ? 'bg-background-100/95 backdrop-blur-md shadow-sm border-b border-background-200/60 max-md:rounded-b-2xl max-md:shadow-card max-md:bg-background-100/75 max-md:backdrop-blur-lg max-md:border-b-0' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className={`relative flex justify-center items-center py-2 md:py-3 transition-all duration-300 ${scrolled ? 'max-md:py-1.5' : ''}`}>
            <Link to="/" className="flex items-center gap-2 group cursor-pointer max-w-[calc(100%-64px)] md:max-w-none">
              <div className="w-8 h-8 rounded-lg bg-primary-100 max-md:bg-gradient-to-br max-md:from-primary-400 max-md:to-accent-400 flex items-center justify-center group-hover:bg-primary-200 transition-colors flex-shrink-0"><i className="ri-cross-line text-primary-600 max-md:text-white text-lg"></i></div>
              <span className="font-bold text-foreground-950 text-sm md:text-base leading-tight truncate max-md:whitespace-normal max-md:line-clamp-2 md:whitespace-nowrap">스스로 신앙하는 거침없는 강릉 학생회</span>
            </Link>
            <ThemeToggleButton className="absolute right-0 top-1/2 -translate-y-1/2" />
          </div>
          <div className="border-t border-primary-100/60"></div>
          <div className="relative flex items-center justify-between h-11 md:h-12">
            <div className="hidden md:flex items-center gap-1">
              {TOP_ITEMS.map(item => <Link key={item.path} to={item.path} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap cursor-pointer hover:scale-[1.02] ${isActive(item.path) ? 'bg-primary-100 text-primary-700' : 'text-foreground-600 hover:text-foreground-950 hover:bg-background-100'}`}><i className={`${item.icon} text-xs`}></i>{item.label}</Link>)}
              <form onSubmit={(e) => { e.preventDefault(); const q = globalSearch.trim(); if (q) navigate(`/search?q=${encodeURIComponent(q)}`); else navigate('/search'); }} className="relative ml-1 hidden xl:block">
                <i className="ri-search-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground-400"></i>
                <input value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} placeholder="검색" aria-label="검색" className="w-32 rounded-full border border-background-200 bg-background-50 py-1.5 pl-8 pr-3 text-sm outline-none transition focus:w-44 focus:border-primary-300 focus:ring-4 focus:ring-primary-50" />
              </form>
              <div className="w-px h-5 bg-background-200 mx-1"></div>
              <div className="relative" ref={bibleRef}>
                <button onClick={() => { setBibleOpen(!bibleOpen); setFaithOpen(false); setCommOpen(false); setMissionOpen(false); setAdminOpen(false); setProfileOpen(false); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap cursor-pointer hover:scale-[1.02] ${bibleOpen ? catBgActive('amber') : `text-foreground-600 ${catBgHover('amber')}`}`}><i className="ri-book-open-line text-xs"></i>말씀 도구<i className={`ri-arrow-down-s-line text-xs transition-transform duration-200 ${bibleOpen ? 'rotate-180' : ''}`}></i></button>
                <AnimatePresence>{bibleOpen && <motion.div initial={{ opacity: 0, y: -4, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.96 }} transition={{ duration: 0.15 }} className="absolute left-0 top-full mt-2 w-56 bg-background-100 rounded-xl shadow-lg border border-background-200 overflow-hidden"><div className="p-1.5 max-h-[380px] overflow-y-auto">{BIBLE_CATEGORY.items.map(item => <Link key={item.path} to={item.path} onClick={() => setBibleOpen(false)} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${isActive(item.path) ? 'bg-amber-50 text-amber-700' : 'text-foreground-700 hover:bg-amber-50/70'}`}><i className={`${item.icon} text-amber-400`}></i>{item.label}</Link>)}</div></motion.div>}</AnimatePresence>
              </div>
              <div className="relative" ref={commRef}>
                <button onClick={() => { setCommOpen(!commOpen); setBibleOpen(false); setFaithOpen(false); setMissionOpen(false); setAdminOpen(false); setProfileOpen(false); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap cursor-pointer hover:scale-[1.02] ${commOpen ? catBgActive('emerald') : `text-foreground-600 ${catBgHover('emerald')}`} `}><i className="ri-group-line text-xs"></i>소통·공동체<i className={`ri-arrow-down-s-line text-xs transition-transform duration-200 ${commOpen ? 'rotate-180' : ''}`}></i></button>
                <AnimatePresence>{commOpen && <motion.div initial={{ opacity: 0, y: -4, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.96 }} transition={{ duration: 0.15 }} className="absolute left-0 top-full mt-2 w-52 bg-background-100 rounded-xl shadow-lg border border-background-200 overflow-hidden"><div className="p-1.5 max-h-[380px] overflow-y-auto">{COMMUNITY_CATEGORY.items.map(item => <Link key={item.path} to={item.path} onClick={() => setCommOpen(false)} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${isActive(item.path) ? 'bg-emerald-50 text-emerald-700' : 'text-foreground-700 hover:bg-emerald-50/70'}`}><i className={`${item.icon} text-emerald-400`}></i>{item.label}</Link>)}</div></motion.div>}</AnimatePresence>
              </div>
              <div className="relative" ref={gameRef}>
                <button onClick={() => { setGameOpen(!gameOpen); setBibleOpen(false); setFaithOpen(false); setCommOpen(false); setMissionOpen(false); setAdminOpen(false); setProfileOpen(false); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap cursor-pointer hover:scale-[1.02] ${gameOpen ? catBgActive('indigo') : `text-foreground-600 ${catBgHover('indigo')}`}`}><i className="ri-gamepad-line text-xs"></i>갓겜<i className={`ri-arrow-down-s-line text-xs transition-transform duration-200 ${gameOpen ? 'rotate-180' : ''}`}></i></button>
                <AnimatePresence>{gameOpen && <motion.div initial={{ opacity: 0, y: -4, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.96 }} transition={{ duration: 0.15 }} className="absolute left-0 top-full mt-2 w-52 bg-background-100 rounded-xl shadow-lg border border-background-200 overflow-hidden"><div className="p-1.5 max-h-[380px] overflow-y-auto">{GAME_CATEGORY.items.map(item => <Link key={item.path} to={item.path} onClick={() => setGameOpen(false)} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${isActive(item.path) ? 'bg-indigo-50 text-indigo-700' : 'text-foreground-700 hover:bg-indigo-50/70'}`}><i className={`${item.icon} text-indigo-400`}></i>{item.label}</Link>)}</div></motion.div>}</AnimatePresence>
              </div>
              <div className="w-px h-5 bg-background-200 mx-1"></div>
              <div className="relative" ref={faithRef}>
                <button onClick={() => { setFaithOpen(!faithOpen); setBibleOpen(false); setCommOpen(false); setGameOpen(false); setMissionOpen(false); setAdminOpen(false); setProfileOpen(false); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap cursor-pointer hover:scale-[1.02] ${faithOpen ? catBgActive('primary') : `text-foreground-600 ${catBgHover('primary')}`} `}><i className="ri-lock-line text-xs"></i>신앙(비공개)<i className={`ri-arrow-down-s-line text-xs transition-transform duration-200 ${faithOpen ? 'rotate-180' : ''}`}></i></button>
                <AnimatePresence>{faithOpen && <motion.div initial={{ opacity: 0, y: -4, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.96 }} transition={{ duration: 0.15 }} className="absolute left-0 top-full mt-2 w-52 bg-background-100 rounded-xl shadow-lg border border-background-200 overflow-hidden"><div className="p-1.5 max-h-[380px] overflow-y-auto">{FAITH_CATEGORY.items.map(item => <Link key={item.path} to={item.path} onClick={() => setFaithOpen(false)} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${isActive(item.path) ? 'bg-primary-50 text-primary-700' : 'text-foreground-700 hover:bg-primary-50/70'}`}><i className={`${item.icon} text-primary-400`}></i>{item.label}</Link>)}</div></motion.div>}</AnimatePresence>
              </div>
              <div className="relative" ref={missionRef}>
                <button onClick={() => { setMissionOpen(!missionOpen); setBibleOpen(false); setFaithOpen(false); setCommOpen(false); setGameOpen(false); setAdminOpen(false); setProfileOpen(false); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap cursor-pointer hover:scale-[1.02] ${missionOpen ? catBgActive('rose') : `text-foreground-600 ${catBgHover('rose')}`} `}><i className="ri-shield-star-line text-xs"></i>사명(운영)<i className={`ri-arrow-down-s-line text-xs transition-transform duration-200 ${missionOpen ? 'rotate-180' : ''}`}></i></button>
                <AnimatePresence>{missionOpen && <motion.div initial={{ opacity: 0, y: -4, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.96 }} transition={{ duration: 0.15 }} className="absolute left-0 top-full mt-2 w-60 bg-background-100 rounded-xl shadow-lg border border-background-200 overflow-hidden"><div className="p-1.5 max-h-[480px] overflow-y-auto">{MISSION_SUBSECTIONS.map(sec => <div key={sec.label} className="mb-1 last:mb-0"><div className="px-3 pt-2 pb-1 text-[11px] font-semibold text-foreground-400">{sec.label}</div>{sec.items.map(item => <button key={item.path || item.action} type="button" onClick={() => handleMissionAction(item)} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-foreground-700 hover:bg-accent-50 hover:text-accent-700 transition-colors text-left cursor-pointer"><i className={`${item.icon} text-accent-400`}></i>{item.label}</button>)}</div>)}</div></motion.div>}</AnimatePresence>
              </div>
              {visibleAdminItems.length > 0 && <div className="relative" ref={adminRef}>
                <button onClick={() => { setAdminOpen(!adminOpen); setBibleOpen(false); setFaithOpen(false); setCommOpen(false); setGameOpen(false); setMissionOpen(false); setProfileOpen(false); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap cursor-pointer hover:scale-[1.02] ${adminOpen ? catBgActive('slate') : `text-foreground-600 ${catBgHover('slate')}`} `}><i className="ri-settings-3-line text-xs"></i>관리<i className={`ri-arrow-down-s-line text-xs transition-transform duration-200 ${adminOpen ? 'rotate-180' : ''}`}></i></button>
                <AnimatePresence>{adminOpen && <motion.div initial={{ opacity: 0, y: -4, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.96 }} transition={{ duration: 0.15 }} className="absolute left-0 top-full mt-2 w-56 bg-background-100 rounded-xl shadow-lg border border-background-200 overflow-hidden"><div className="p-1.5">{visibleAdminItems.map(item => <Link key={item.path} to={item.path} onClick={() => setAdminOpen(false)} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${isActive(item.path) ? 'bg-secondary-50 text-secondary-700' : 'text-foreground-700 hover:bg-secondary-50/70'}`}><i className={`${item.icon} text-secondary-400`}></i>{item.label}</Link>)}</div></motion.div>}</AnimatePresence>
              </div>}
            </div>
            <div className="flex items-center gap-2 ml-auto md:ml-2">
              {user && <div className="relative" ref={profileRef}>
                <button onClick={() => { setProfileOpen(!profileOpen); closeAllDesktop(); }} className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-background-100 transition-colors cursor-pointer">
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden text-primary-600 text-sm font-bold">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : <i className="ri-user-line" />}</div>
                  <div className="hidden lg:block text-left"><div className="text-xs font-semibold text-foreground-900">{profile?.name || '회원'}</div><div className="text-[10px] text-foreground-500">{profile?.role ? ROLE_LABELS[profile.role] : ''}</div></div>
                  <i className={`ri-arrow-down-s-line text-xs text-foreground-400 hidden lg:block transition-transform ${profileOpen ? 'rotate-180' : ''}`}></i>
                </button>
                <AnimatePresence>{profileOpen && <motion.div initial={{ opacity: 0, y: -4, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.96 }} transition={{ duration: 0.15 }} className="absolute right-0 top-full mt-2 w-64 bg-background-100 rounded-xl shadow-lg border border-background-200 overflow-hidden z-50"><div className="p-3 border-b border-background-200"><div className="flex items-center gap-2.5"><div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden text-primary-600">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : <i className="ri-user-line" />}</div><div className="min-w-0"><div className="text-sm font-bold text-foreground-950 truncate">{profile?.name || '회원'}</div><div className="text-xs text-foreground-500">{profile?.role ? `${roleEmoji(profile.role)} ${ROLE_LABELS[profile.role]}` : ''}{profile?.club ? ` · ${CLUB_LABELS[profile.club] || profile.club}` : ''}</div></div></div></div><div className="p-1.5 max-h-[70vh] overflow-y-auto"><div className="px-3 pt-2 pb-1 text-[11px] font-semibold text-foreground-400">내 활동</div>{PROFILE_ACTIVITY_ITEMS.map(item => <Link key={item.path} to={item.path} onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-foreground-700 hover:bg-primary-50 hover:text-primary-700 transition-colors cursor-pointer"><i className={`${item.icon} text-primary-400`}></i>{item.label}</Link>)}<div className="px-3 pt-3 pb-1 text-[11px] font-semibold text-foreground-400">신앙(비공개)</div>{PROFILE_FAITH_ITEMS.map(item => <Link key={item.path} to={item.path} onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-foreground-700 hover:bg-primary-50 hover:text-primary-700 transition-colors cursor-pointer"><i className={`${item.icon} text-primary-400`}></i>{item.label}</Link>)}<div className="my-2 border-t border-background-200"></div><button type="button" onClick={handleSignOut} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-accent-600 hover:bg-accent-50 transition-colors text-left cursor-pointer"><i className="ri-logout-box-r-line text-accent-400"></i>로그아웃</button></div></motion.div>}</AnimatePresence>
              </div>}
              <button type="button" onClick={() => { setMobileOpen(!mobileOpen); closeAllDesktop(); setProfileOpen(false); }} className="md:hidden w-9 h-9 rounded-full bg-background-100 flex items-center justify-center text-foreground-700 cursor-pointer" aria-label="메뉴"><i className={mobileOpen ? 'ri-close-line' : 'ri-menu-line'}></i></button>
            </div>
          </div>
        </div>
        <AnimatePresence>{mobileOpen && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="md:hidden border-t border-background-200 bg-background-100 overflow-hidden"><div className="max-w-6xl mx-auto px-4 py-3 max-h-[calc(100vh-80px)] overflow-y-auto"><div className="grid grid-cols-2 gap-2 mb-3">{TOP_ITEMS.map(item => <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium ${isActive(item.path) ? 'bg-primary-100 text-primary-700' : 'text-foreground-700 hover:bg-background-100'}`}><i className={item.icon}></i>{item.label}</Link>)}</div><div className="space-y-1"><button type="button" onClick={() => toggleMobileAccordion('bible')} className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold text-foreground-800 hover:bg-background-100 cursor-pointer"><span><i className="ri-book-open-line mr-2 text-amber-500"></i>말씀 도구</span><i className={`ri-arrow-down-s-line transition-transform ${mobileAccordion.bible ? 'rotate-180' : ''}`}></i></button>{mobileAccordion.bible && <div className="pl-2">{BIBLE_CATEGORY.items.map(item => <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-foreground-700 hover:bg-background-100"><i className={`${item.icon} text-amber-400`}></i>{item.label}</Link>)}</div>}<button type="button" onClick={() => toggleMobileAccordion('community')} className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold text-foreground-800 hover:bg-background-100 cursor-pointer"><span><i className="ri-group-line mr-2 text-emerald-500"></i>소통·공동체</span><i className={`ri-arrow-down-s-line transition-transform ${mobileAccordion.community ? 'rotate-180' : ''}`}></i></button>{mobileAccordion.community && <div className="pl-2">{COMMUNITY_CATEGORY.items.map(item => <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-foreground-700 hover:bg-background-100"><i className={`${item.icon} text-emerald-400`}></i>{item.label}</Link>)}</div>}<button type="button" onClick={() => toggleMobileAccordion('faith')} className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold text-foreground-800 hover:bg-background-100 cursor-pointer"><span><i className="ri-lock-line mr-2 text-primary-500"></i>신앙(비공개)</span><i className={`ri-arrow-down-s-line transition-transform ${mobileAccordion.faith ? 'rotate-180' : ''}`}></i></button>{mobileAccordion.faith && <div className="pl-2">{PROFILE_FAITH_ITEMS.map(item => <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-foreground-700 hover:bg-background-100"><i className={`${item.icon} text-primary-400`}></i>{item.label}</Link>)}</div>}<button type="button" onClick={() => toggleMobileAccordion('mission')} className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold text-foreground-800 hover:bg-background-100 cursor-pointer"><span><i className="ri-shield-star-line mr-2 text-accent-500"></i>사명(운영)</span><i className={`ri-arrow-down-s-line transition-transform ${mobileAccordion.mission ? 'rotate-180' : ''}`}></i></button>{mobileAccordion.mission && <div className="pl-2">{fullMissionItems.map(item => <button key={item.path || item.action} type="button" onClick={() => handleMissionAction(item)} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-foreground-700 hover:bg-background-100 text-left cursor-pointer"><i className={`${item.icon} text-accent-400`}></i>{item.label}</button>)}</div>}{visibleAdminItems.length > 0 && <><button type="button" onClick={() => toggleMobileAccordion('admin')} className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold text-foreground-800 hover:bg-background-100 cursor-pointer"><span><i className="ri-settings-3-line mr-2 text-secondary-500"></i>관리</span><i className={`ri-arrow-down-s-line transition-transform ${mobileAccordion.admin ? 'rotate-180' : ''}`}></i></button>{mobileAccordion.admin && <div className="pl-2">{visibleAdminItems.map(item => <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-foreground-700 hover:bg-background-100"><i className={`${item.icon} text-secondary-400`}></i>{item.label}</Link>)}</div>}</>}</div><div className="mt-3 pt-3 border-t border-background-200 flex items-center justify-between"><div className="text-xs text-foreground-500">{user ? `${profile?.name || '회원'} · ${profile?.role ? ROLE_LABELS[profile.role] : ''}` : '로그인이 필요합니다'}</div>{user && <button type="button" onClick={handleSignOut} className="text-xs text-accent-600 font-medium cursor-pointer">로그아웃</button>}</div></div></motion.div>}</AnimatePresence>
      </nav>
      <MeetingIdeasModal open={meetingIdeasOpen} onClose={() => setMeetingIdeasOpen(false)} />
      <NotificationsModal open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
      <NotificationToast user={user} count={notificationCount} onOpen={() => setNotificationsOpen(true)} />
    </>
  );
}
