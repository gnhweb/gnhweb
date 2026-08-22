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
    { path: '/bible-pick/history', label: '말씀 히스토리', icon: 'ri-history-line' },
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
    { path: '/prayer-partner', label: '신앙 짝꿍', icon: 'ri-heart-pulse-line' },
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
    { path: '/dashboard/attendance/analytics', label: '출석 통계 분석', icon: 'ri-bar-chart-line' },
    { path: '/attendance-board', label: '실시간 출석 현황판', icon: 'ri-user-heart-line' },
  ]},
  { label: '회의록', items: [
    { path: '/meetings', label: '회의록', icon: 'ri-chat-check-line' },
    { path: '/meeting-copilot', label: '회의 코파일럿 AI', icon: 'ri-lightbulb-flash-line' },
  ]},
  { label: '사명 도구', items: [
    { path: '/pds-planner', label: '행사 기획 마법사', icon: 'ri-todo-line' },
    { path: '/event-ideas', label: '행사 기획 아이디어', icon: 'ri-lightbulb-flash-line' },
    { path: '/leadership-diary', label: '리더십 코칭', icon: 'ri-book-read-line' },
  ]},
  { label: '보고서', items: [
    { path: '/reports/weekly', label: '주간 보고서', icon: 'ri-file-list-3-line' },
    { path: '/reports/growth', label: '성장 기록', icon: 'ri-plant-line' },
    { path: '/reports/events', label: '행사 보고서', icon: 'ri-calendar-event-line' },
    { path: '/visitations', label: '심방 스케줄', icon: 'ri-heart-pulse-line' },
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
  { path: '/faith-storybook', label: '신앙 스토리북', icon: 'ri-bookmark-line' },
  { path: '/faith-journal', label: '신앙 일지', icon: 'ri-edit-line' },
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
          <div className="flex items-center justify-between h-11 md:h-12">
            <div className="hidden md:flex items-center gap-1">
              {TOP_ITEMS.map(item => <Link key={item.path} to={item.path} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap cursor-pointer hover:scale-[1.02] ${isActive(item.path) ? 'bg-primary-100 text-primary-700' : 'text-foreground-600 hover:text-foreground-950 hover:bg-background-100'}`}><i className={`${item.icon} text-xs`}></i>{item.label}</Link>)}
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
              {showMissionTab && <div className="relative" ref={missionRef}>
                <button onClick={() => { setMissionOpen(!missionOpen); setBibleOpen(false); setFaithOpen(false); setCommOpen(false); setAdminOpen(false); setProfileOpen(false); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 whitespace-nowrap cursor-pointer hover:scale-[1.02] ${missionOpen ? catBgActive('rose') : `text-accent-600 ${catBgHover('rose')}`} `}><i className="ri-shield-star-line text-xs"></i>사명자<i className={`ri-arrow-down-s-line text-xs transition-transform duration-200 ${missionOpen ? 'rotate-180' : ''}`}></i></button>
                <AnimatePresence>{missionOpen && <motion.div initial={{ opacity: 0, y: -4, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.96 }} transition={{ duration: 0.15 }} className="absolute left-0 top-full mt-2 w-60 bg-background-100 rounded-xl shadow-lg border border-background-200 overflow-hidden"><div className="p-1.5 max-h-[440px] overflow-y-auto">{showTeacherTab && <><Link to="/teacher-dashboard" onClick={() => setMissionOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer text-accent-700 hover:bg-accent-50"><i className="ri-dashboard-line text-accent-400"></i>교사 대시보드</Link><div className="border-t border-background-200 my-1"></div></>}{MISSION_SUBSECTIONS.map(section => <div key={section.label} className="mb-1"><p className="px-3 py-1.5 text-[11px] font-semibold text-foreground-400 uppercase tracking-wider">{section.label}</p>{section.items.map(item => <button key={item.label} onClick={() => handleMissionAction(item)} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-foreground-700 hover:bg-accent-50 hover:text-accent-700 transition-colors cursor-pointer text-left"><i className={`${item.icon} text-accent-300`}></i>{item.label}</button>)}</div>)}</div></motion.div>}</AnimatePresence>
              </div>}
              {(showAdminTab || showTeacherTab) && visibleAdminItems.length > 0 && <div className="relative" ref={adminRef}>
                <button onClick={() => { setAdminOpen(!adminOpen); setBibleOpen(false); setFaithOpen(false); setCommOpen(false); setMissionOpen(false); setProfileOpen(false); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 whitespace-nowrap cursor-pointer hover:scale-[1.02] ${adminOpen ? catBgActive('slate') : `text-secondary-600 ${catBgHover('slate')}`} `}><i className="ri-settings-3-line text-xs"></i>관리<i className={`ri-arrow-down-s-line text-xs transition-transform duration-200 ${adminOpen ? 'rotate-180' : ''}`}></i></button>
                <AnimatePresence>{adminOpen && <motion.div initial={{ opacity: 0, y: -4, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.96 }} transition={{ duration: 0.15 }} className="absolute left-0 top-full mt-2 w-52 bg-background-100 rounded-xl shadow-lg border border-background-200 overflow-hidden"><div className="p-1.5">{visibleAdminItems.map(item => <Link key={item.label} to={item.path} onClick={() => setAdminOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-foreground-700 hover:bg-secondary-50 hover:text-secondary-700 transition-colors cursor-pointer"><i className={`${item.icon} text-secondary-400`}></i>{item.label}</Link>)}</div></motion.div>}</AnimatePresence>
              </div>}
            </div>
            <div className="hidden md:flex items-center gap-3">
              {user && <button onClick={() => setNotificationsOpen(!notificationsOpen)} className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-background-100 transition-colors cursor-pointer relative"><i className="ri-notification-3-line text-lg text-foreground-600"></i>{notificationCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">{notificationCount > 99 ? '99+' : notificationCount}</span>}</button>}
              {user ? <div className="relative" ref={profileRef}><button onClick={() => { setBibleOpen(false); setFaithOpen(false); setCommOpen(false); setMissionOpen(false); setAdminOpen(false); setProfileOpen(!profileOpen); }} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-50 hover:bg-primary-100 transition-all duration-200 cursor-pointer hover:scale-[1.02]">{profile ? <><div className="w-7 h-7 rounded-full bg-amber-200 flex items-center justify-center"><span className="text-xs font-bold text-amber-700">{profile.name.charAt(0)}</span></div><span className="text-sm font-medium text-foreground-800 max-w-[80px] truncate">{profile.name}</span></> : <><div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center"><span className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></span></div><span className="text-sm text-foreground-400">불러오는 중...</span></>}<i className={`ri-arrow-down-s-line text-foreground-400 text-xs transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`}></i></button>
                <AnimatePresence>{profileOpen && <motion.div initial={{ opacity: 0, y: -4, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.96 }} transition={{ duration: 0.15 }} className="absolute right-0 top-full mt-2 w-60 bg-background-100 rounded-xl shadow-lg border border-background-200 overflow-hidden z-50">{!profile ? <div className="p-5 flex items-center gap-3 text-sm text-foreground-500"><span className="w-4 h-4 border-2 border-primary-300 border-t-transparent rounded-full animate-spin flex-shrink-0"></span>프로필 불러오는 중...</div> : <><div className="p-3 border-b border-background-200"><p className="text-sm font-semibold text-foreground-900">{profile.name}</p><p className="text-xs text-foreground-500">{profile.roles && profile.roles.length > 1 ? profile.roles.map(r => ROLE_LABELS[r]).join(' · ') : ROLE_LABELS[profile.role]}</p>{profile.club && <p className="text-xs text-primary-600 mt-0.5">{CLUB_LABELS[profile.club]}</p>}</div>{profile.club && <Link to={`/clubs/${profile.club}/community`} onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-primary-600 hover:bg-primary-50 transition-colors cursor-pointer border-b border-background-100"><i className="ri-chat-smile-2-line"></i>내 동아리 소통방</Link>}<ProfileDropdownTabs faithItems={PROFILE_FAITH_ITEMS} activityItems={PROFILE_ACTIVITY_ITEMS} onClose={() => setProfileOpen(false)} onSignOut={handleSignOut} onSuggestions={handleSuggestions} /></>}</motion.div>}</AnimatePresence>
              </div> : <Link to="/login" className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors cursor-pointer whitespace-nowrap"><i className="ri-login-box-line text-sm"></i>로그인</Link>}
            </div>
            <div className="flex md:hidden items-center gap-2">
              {user && <button onClick={() => setNotificationsOpen(!notificationsOpen)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-background-200 transition-colors cursor-pointer relative"><i className="ri-notification-3-line text-lg text-foreground-600"></i><AnimatePresence>{notificationCount > 0 && <motion.span key={notificationCount} initial={{ scale: 0.6 }} animate={{ scale: [1.25, 1] }} transition={{ duration: 0.25, ease: 'easeOut' }} className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-gradient-to-br from-accent-500 to-primary-500 text-white text-[9px] font-bold flex items-center justify-center shadow-card">{notificationCount > 99 ? '99+' : notificationCount}</motion.span>}</AnimatePresence></button>}
              <button onClick={() => setMobileOpen(!mobileOpen)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-background-200 transition-colors cursor-pointer"><i className={`text-xl text-foreground-700 ${mobileOpen ? 'ri-close-line' : 'ri-menu-line'}`}></i></button>
            </div>
          </div>
        </div>
        <AnimatePresence>
          {mobileOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="md:hidden fixed inset-0 z-[60] bg-background-50 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-background-200 flex-shrink-0"><Link to="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 cursor-pointer"><div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center"><i className="ri-cross-line text-primary-600 text-sm"></i></div><span className="text-sm font-bold text-foreground-950">강릉 학생회</span></Link><button onClick={() => setMobileOpen(false)} className="w-10 h-10 rounded-full bg-background-200 flex items-center justify-center cursor-pointer"><i className="ri-close-line text-xl text-foreground-700"></i></button></div>
            <div className="flex-1 overflow-y-auto px-4 py-4 pb-safe">
              {user ? <MotionLink to="/profile" onClick={() => setMobileOpen(false)} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 500, damping: 25 }} className="flex items-center gap-3 p-4 mb-4 rounded-[20px] bg-gradient-to-br from-primary-500 to-accent-500 text-white shadow-card cursor-pointer"><div className="w-14 h-14 rounded-full overflow-hidden bg-background-100/20 border-2 border-white/40 flex items-center justify-center flex-shrink-0">{profile?.profile_image ? <img src={profile.profile_image} alt="프로필" className="w-full h-full object-cover" /> : <span className="text-lg font-bold">{profile?.name?.charAt(0) || '?'}</span>}</div><div className="min-w-0 flex-1">{profile ? <><p className="text-sm font-bold truncate">{profile.name}</p><p className="text-[11px] text-white/80 truncate">{profile.club ? CLUB_LABELS[profile.club] : '동아리 미배정'}</p><span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-background-100/25 text-[10px] font-semibold whitespace-nowrap max-w-full truncate">{roleEmoji(profile.role)} {profile.roles && profile.roles.length > 1 ? profile.roles.map(r => ROLE_LABELS[r]).join(' · ') : ROLE_LABELS[profile.role]}</span></> : <p className="text-sm">불러오는 중...</p>}</div><i className="ri-arrow-right-s-line text-xl text-white/70 flex-shrink-0"></i></MotionLink> : <MotionLink to="/login" onClick={() => setMobileOpen(false)} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 500, damping: 25 }} className="flex items-center justify-center gap-2 p-4 mb-4 rounded-[20px] bg-gradient-to-br from-primary-500 to-accent-500 text-white text-sm font-semibold shadow-card cursor-pointer"><i className="ri-login-box-line"></i> 로그인하기</MotionLink>}
              <div className="grid grid-cols-3 gap-2 mb-4">{TOP_ITEMS.map(item => <MotionLink key={`mobile-top-${item.path}`} to={item.path} onClick={() => setMobileOpen(false)} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 500, damping: 25 }} className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-colors cursor-pointer ${isActive(item.path) ? 'bg-background-100 shadow-card text-primary-700' : 'text-foreground-600 hover:bg-background-100/60'}`}><div className={`w-10 h-10 rounded-full flex items-center justify-center ${isActive(item.path) ? 'bg-gradient-to-br from-primary-500 to-accent-500' : 'bg-background-100'}`}><i className={`${item.icon} text-lg ${isActive(item.path) ? 'text-white' : 'text-foreground-500'}`}></i></div><span className="text-[11px] font-medium whitespace-nowrap">{item.label}</span></MotionLink>)}</div>
              <AccordionBlock icon="ri-book-open-line" label="말씀 도구" color="amber" open={!!mobileAccordion['bible']} onToggle={() => toggleMobileAccordion('bible')}><div className="grid grid-cols-3 gap-1">{BIBLE_CATEGORY.items.map(item => <MenuGridCard key={`m-bible-${item.path}`} icon={item.icon} label={item.label} colorClass="bg-amber-100 text-amber-600" active={isActive(item.path)} onClick={() => { navigate(item.path); setMobileOpen(false); }} />)}</div></AccordionBlock>
              <AccordionBlock icon="ri-group-line" label="소통·공동체" color="emerald" open={!!mobileAccordion['comm']} onToggle={() => toggleMobileAccordion('comm')}><div className="grid grid-cols-3 gap-1">{COMMUNITY_CATEGORY.items.map(item => <MenuGridCard key={`m-comm-${item.path}`} icon={item.icon} label={item.label} colorClass="bg-emerald-100 text-emerald-600" active={isActive(item.path)} onClick={() => { navigate(item.path); setMobileOpen(false); }} />)}</div></AccordionBlock>
              <AccordionBlock icon="ri-gamepad-line" label="갓겜" color="indigo" open={!!mobileAccordion['game']} onToggle={() => toggleMobileAccordion('game')}><div className="grid grid-cols-3 gap-1">{GAME_CATEGORY.items.map(item => <MenuGridCard key={`m-game-${item.path}`} icon={item.icon} label={item.label} colorClass="bg-indigo-100 text-indigo-600" active={isActive(item.path)} onClick={() => { navigate(item.path); setMobileOpen(false); }} />)}</div></AccordionBlock>
              <div className="flex items-center gap-2 px-2 py-2 mt-1 mb-2"><div className="h-px flex-1 bg-background-200"></div><span className="text-[10px] font-bold text-foreground-400 uppercase tracking-widest">나의 기록</span><div className="h-px flex-1 bg-background-200"></div></div>
              <AccordionBlock icon="ri-lock-line" label="신앙(비공개)" color="primary" open={!!mobileAccordion['faith']} onToggle={() => toggleMobileAccordion('faith')}><div className="grid grid-cols-3 gap-1">{FAITH_CATEGORY.items.map(item => <MenuGridCard key={`m-faith-${item.path}`} icon={item.icon} label={item.label} colorClass="bg-primary-100 text-primary-600" active={isActive(item.path)} onClick={() => { navigate(item.path); setMobileOpen(false); }} />)}</div></AccordionBlock>
              {showMissionTab && <AccordionBlock icon="ri-shield-star-line" label="사명자 전용" color="rose" open={!!mobileAccordion['mission']} onToggle={() => toggleMobileAccordion('mission')}><div className="space-y-3">
                {showTeacherTab && <div className="grid grid-cols-2 gap-1"><MenuGridCard icon="ri-dashboard-line" label="교사 대시보드" colorClass="bg-accent-100 text-accent-600" active={isActive('/teacher-dashboard')} onClick={() => { navigate('/teacher-dashboard'); setMobileOpen(false); }} /></div>}
                {MISSION_SUBSECTIONS.map(section => <div key={`m-ms-${section.label}`}><p className="px-2 py-1 text-[11px] font-semibold text-foreground-400 uppercase tracking-wider">{section.label}</p><div className="grid grid-cols-3 gap-1">{section.items.map(item => <MenuGridCard key={`m-msi-${item.label}`} icon={item.icon} label={item.label} colorClass="bg-accent-100 text-accent-600" active={!!item.path && isActive(item.path)} onClick={() => handleMissionAction(item)} />)}</div></div>)}
              </div></AccordionBlock>}
              {(showAdminTab || showTeacherTab) && visibleAdminItems.length > 0 && <AccordionBlock icon="ri-settings-3-line" label="관리" color="slate" open={!!mobileAccordion['admin']} onToggle={() => toggleMobileAccordion('admin')}><div className="grid grid-cols-3 gap-1">{visibleAdminItems.map(item => <MenuGridCard key={`m-admin-${item.label}`} icon={item.icon} label={item.label} colorClass="bg-secondary-100 text-secondary-600" active={isActive(item.path)} onClick={() => { navigate(item.path); setMobileOpen(false); }} />)}</div></AccordionBlock>}
              {user && <div className="mt-2 pt-3 border-t border-background-200 pb-8 space-y-1">{profile?.club && <Link to={`/clubs/${profile.club}/community`} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-primary-600 hover:bg-primary-50 transition-colors cursor-pointer"><i className="ri-chat-smile-2-line"></i>내 동아리 소통방</Link>}<Link to="/dashboard/attendance" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground-700 hover:bg-background-100 transition-colors cursor-pointer"><i className="ri-user-heart-line"></i>스마트 출석</Link><Link to="/missions/board" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground-700 hover:bg-background-100 transition-colors cursor-pointer"><i className="ri-medal-line"></i>작은 사명</Link><Link to="/profile" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-primary-600 hover:bg-primary-50 transition-colors cursor-pointer font-medium"><i className="ri-user-settings-line"></i>프로필 설정</Link><button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground-700 hover:bg-background-100 transition-colors cursor-pointer"><i className="ri-logout-box-line"></i>로그아웃</button></div>}
            </div>
          </motion.div>}
        </AnimatePresence>
      </nav>
      <MeetingIdeasModal open={meetingIdeasOpen} onClose={() => setMeetingIdeasOpen(false)} />
      <NotificationsModal open={notificationsOpen} onClose={() => setNotificationsOpen(false)} user={user} />
      <NotificationToast user={user} onOpenList={() => setNotificationsOpen(true)} />
    </>
  );
}

function AccordionBlock({ icon, label, color, open, onToggle, children }: { icon: string; label: string; color: string; open: boolean; onToggle: () => void; children: React.ReactNode; }) {
  const bg = color === 'amber' ? 'bg-amber-50 text-amber-700' : color === 'emerald' ? 'bg-emerald-50 text-emerald-700' : color === 'rose' ? 'bg-accent-50 text-accent-700' : color === 'primary' ? 'bg-primary-50 text-primary-700' : color === 'indigo' ? 'bg-indigo-50 text-indigo-700' : 'bg-secondary-50 text-secondary-700';
  const badgeBg = color === 'amber' ? 'bg-amber-100 text-amber-600' : color === 'emerald' ? 'bg-emerald-100 text-emerald-600' : color === 'rose' ? 'bg-accent-100 text-accent-600' : color === 'primary' ? 'bg-primary-100 text-primary-600' : color === 'indigo' ? 'bg-indigo-100 text-indigo-600' : 'bg-secondary-100 text-secondary-600';
  return <div className="mb-2"><button onClick={onToggle} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-sm font-semibold transition-colors cursor-pointer ${open ? bg : 'text-foreground-700 hover:bg-background-100'}`}><span className="flex items-center gap-2.5"><span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${badgeBg}`}><i className={`${icon} text-sm`}></i></span>{label}</span><motion.i animate={{ rotate: open ? 180 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }} className={`ri-arrow-down-s-line text-base ${open ? '' : 'text-foreground-400'}`}></motion.i></button><AnimatePresence>{open && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: 'easeInOut' }} className="overflow-hidden"><div className="px-2 pt-2 pb-1">{children}</div></motion.div>}</AnimatePresence></div>;
}

function MenuGridCard({ icon, label, colorClass, active, onClick }: { icon: string; label: string; colorClass: string; active?: boolean; onClick: () => void; }) {
  return <motion.button onClick={onClick} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 500, damping: 25 }} className={`flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-2xl text-center cursor-pointer transition-colors ${active ? 'bg-background-100 shadow-card' : 'hover:bg-background-100/70'}`}><span className={`w-9 h-9 rounded-full flex items-center justify-center ${colorClass}`}><i className={`${icon} text-sm`}></i></span><span className="text-[11px] font-medium text-foreground-700 leading-tight line-clamp-2">{label}</span></motion.button>;
}

function ProfileDropdownTabs({ faithItems, activityItems, onClose, onSignOut, onSuggestions }: { faithItems: CategoryItem[]; activityItems: CategoryItem[]; onClose: () => void; onSignOut: () => void; onSuggestions: (e: React.MouseEvent) => void; }) {
  const [activeTab, setActiveTab] = useState<'faith' | 'account'>('faith');
  return <div>
    <div className="flex border-b border-background-100">
      <button onClick={() => setActiveTab('faith')} className={`flex-1 py-2.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${activeTab === 'faith' ? 'text-primary-700 border-b-2 border-primary-500' : 'text-foreground-500 hover:text-foreground-700'}`}><i className="ri-book-open-line mr-1"></i>나의 신앙 기록</button>
      <button onClick={() => setActiveTab('account')} className={`flex-1 py-2.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${activeTab === 'account' ? 'text-primary-700 border-b-2 border-primary-500' : 'text-foreground-500 hover:text-foreground-700'}`}><i className="ri-user-settings-line mr-1"></i>계정</button>
    </div>
    {activeTab === 'faith' ? <div className="py-1"><div className="pb-0.5">{faithItems.map(item => <Link key={item.path} to={item.path} onClick={onClose} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-foreground-700 hover:bg-background-100 transition-colors cursor-pointer"><i className={`${item.icon} text-foreground-400`}></i>{item.label}</Link>)}</div><div className="border-t border-background-100 pt-1 pb-0.5"><p className="px-3 py-1.5 text-[10px] font-bold text-foreground-400 uppercase tracking-widest">활동</p>{activityItems.map(item => <Link key={item.path} to={item.path} onClick={onClose} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-foreground-700 hover:bg-background-100 transition-colors cursor-pointer"><i className={`${item.icon} text-foreground-400`}></i>{item.label}</Link>)}<Link to="/dashboard" onClick={(e) => { onClose(); onSuggestions(e); }} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-foreground-700 hover:bg-background-100 transition-colors cursor-pointer"><i className="ri-lightbulb-line text-foreground-400"></i>건의사항</Link></div></div> : <div className="py-1"><div className="pb-1"><Link to="/profile" onClick={onClose} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-foreground-700 hover:bg-background-100 transition-colors cursor-pointer"><i className="ri-user-settings-line text-foreground-400"></i>프로필 설정</Link><button onClick={onSignOut} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-foreground-700 hover:bg-background-100 transition-colors cursor-pointer"><i className="ri-logout-box-line text-foreground-400"></i>로그아웃</button></div></div>}
  </div>;
}
