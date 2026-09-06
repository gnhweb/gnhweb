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
    { path: '/leadership-diary', label: '리더십 코칭 AI', icon: 'ri-book-read-line' },
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
    if (showTeacherTab) items.push({ path: '/teacher-dashboard', label: '교사 대시보드', icon: 'ri-dashboard-line' });
    MISSION_SUBSECTIONS.forEach(sec => items.push(...sec.items));
    return items;
  })();
  const visibleAdminItems = ADMIN_CATEGORY_ITEMS.filter(i => hasRole(i.minRole));

  return (
    <>
      <nav className={`sticky top-0 z-40 pt-safe transition-all duration-300 ${scrolled ? 'bg-background-50/95 backdrop-blur-md shadow-sm' : 'bg-background-50/80 backdrop-blur-sm'} border-b border-background-200/80`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="relative flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <Link to="/" className="flex items-center gap-2 cursor-pointer">
                <div className="w-8 h-8 rounded-xl bg-primary-100 flex items-center justify-center"><i className="ri-cross-line text-primary-600 text-base"></i></div>
                <span className="text-sm font-bold text-foreground-950 hidden sm:inline">강릉 학생회</span>
              </Link>
              <div className="hidden md:flex items-center gap-1 ml-4">
                {TOP_ITEMS.map(item => <Link key={item.path} to={item.path} className={`px-3 py-2 rounded-lg text-sm font-medium cursor-pointer ${isActive(item.path) ? 'bg-background-100 text-primary-700' : 'text-foreground-600 hover:bg-background-100 hover:text-foreground-900'}`}>{item.label}</Link>)}
              </div>
            </div>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <Link to="/dashboard/attendance" aria-label="스마트 출석" title="스마트 출석" className={`md:hidden flex h-10 items-center justify-center gap-1.5 rounded-chip px-2.5 text-sm font-semibold transition-colors active:scale-95 ${isActive('/dashboard/attendance') ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' : 'text-primary-700 hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-900/30'}`}><i className="ri-user-heart-line text-[20px]"></i><span>출석</span></Link>
              {location.pathname === '/' && <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('home-awards-open'))} aria-label="수상 및 실시간 리더보드" title="수상 및 실시간 리더보드" className="flex h-10 w-10 items-center justify-center rounded-full text-accent-600 transition-all hover:bg-accent-50 hover:text-accent-700 active:scale-95 dark:text-accent-300 dark:hover:bg-accent-900/30 cursor-pointer"><i className="ri-trophy-line text-[20px]"></i></button>}
              <Link to="/search" aria-label="검색" title="검색" className="flex w-10 h-10 items-center justify-center rounded-full text-foreground-700 hover:bg-background-200 active:bg-background-200 transition-colors cursor-pointer"><i className="ri-search-line text-[20px]"></i></Link>
              <button onClick={() => setMobileOpen(!mobileOpen)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-background-200 transition-colors cursor-pointer"><i className={`text-xl text-foreground-700 ${mobileOpen ? 'ri-close-line' : 'ri-menu-line'}`}></i></button>
            </div>
          </div>
        </div>
        <AnimatePresence>
          {mobileOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="md:hidden fixed inset-0 z-[60] bg-background-50 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-background-200 flex-shrink-0"><Link to="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 cursor-pointer"><div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center"><i className="ri-cross-line text-primary-600 text-sm"></i></div><span className="text-sm font-bold text-foreground-950">강릉 학생회</span></Link><div className="flex items-center gap-1.5">{isIosPwa() && <button onClick={handleMobileBack} aria-label="뒤로 가기" title="뒤로 가기" className="w-10 h-10 rounded-full bg-background-100 border border-background-200 flex items-center justify-center cursor-pointer active:scale-95"><i className="ri-arrow-left-line text-xl text-foreground-700"></i></button>}<button onClick={() => setMobileOpen(false)} aria-label="메뉴 닫기" className="w-10 h-10 rounded-full bg-background-200 flex items-center justify-center cursor-pointer"><i className="ri-close-line text-xl text-foreground-700"></i></button></div></div>
            <div className="flex-1 overflow-y-auto px-4 py-4 pb-safe">
              {user ? <MotionLink to="/profile" onClick={() => setMobileOpen(false)} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 500, damping: 25 }} className="flex items-center gap-3 p-4 mb-4 rounded-[20px] bg-gradient-to-br from-primary-500 to-accent-500 text-white shadow-card cursor-pointer"><div className="w-14 h-14 rounded-full overflow-hidden bg-background-100/20 border-2 border-white/40 flex items-center justify-center flex-shrink-0">{profile?.profile_image ? <img src={profile.profile_image} alt="프로필" className="w-full h-full object-cover" /> : <span className="text-lg font-bold">{profile?.name?.charAt(0) || '?'}</span>}</div><div className="min-w-0 flex-1">{profile ? <><p className="text-sm font-bold truncate">{profile.name}</p><p className="text-[11px] text-white/80 truncate">{profile.club ? CLUB_LABELS[profile.club] : '동아리 미배정'}</p><span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-background-100/25 text-[10px] font-semibold whitespace-nowrap max-w-full truncate">{roleEmoji(profile.role)} {profile.roles && profile.roles.length > 1 ? profile.roles.map(r => ROLE_LABELS[r]).join(' · ') : ROLE_LABELS[profile.role]}</span></> : <p className="text-sm">불러오는 중...</p>}</div><i className="ri-arrow-right-s-line text-xl text-white/70 flex-shrink-0"></i></MotionLink> : <MotionLink to="/login" onClick={() => setMobileOpen(false)} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 500, damping: 25 }} className="flex items-center justify-center gap-2 p-4 mb-4 rounded-[20px] bg-gradient-to-br from-primary-500 to-accent-500 text-white text-sm font-semibold shadow-card cursor-pointer"><i className="ri-login-box-line"></i> 로그인하기</MotionLink>}
              <div className="grid grid-cols-3 gap-2 mb-4">{TOP_ITEMS.map(item => <MotionLink key={`mobile-top-${item.path}`} to={item.path} onClick={() => setMobileOpen(false)} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 500, damping: 25 }} className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-colors cursor-pointer ${isActive(item.path) ? 'bg-background-100 shadow-card text-primary-700' : 'text-foreground-600 hover:bg-background-100/60'}`}><div className={`w-10 h-10 rounded-full flex items-center justify-center ${isActive(item.path) ? 'bg-gradient-to-br from-primary-500 to-accent-500' : 'bg-background-100'}`}><i className={`${item.icon} text-lg ${isActive(item.path) ? 'text-white' : 'text-foreground-500'}`}></i></div><span className="text-[11px] font-medium whitespace-nowrap">{item.label}</span></MotionLink>)}</div>
              <AccordionBlock icon="ri-book-open-line" label="말씀 도구" color="amber" open={!!mobileAccordion['bible']} onToggle={() => toggleMobileAccordion('bible')}><div className="grid grid-cols-3 gap-1">{BIBLE_CATEGORY.items.map(item => <MenuGridCard key={`m-bible-${item.path}`} icon={item.icon} label={item.label} colorClass="bg-amber-100 text-amber-600" active={isActive(item.path)} onClick={() => { navigate(item.path); setMobileOpen(false); }} />)}</div></AccordionBlock>
              <AccordionBlock icon="ri-group-line" label="소통·공동체" color="emerald" open={!!mobileAccordion['comm']} onToggle={() => toggleMobileAccordion('comm')}><div className="grid grid-cols-3 gap-1">{COMMUNITY_CATEGORY.items.map(item => <MenuGridCard key={`m-comm-${item.path}`} icon={item.icon} label={item.label} colorClass="bg-emerald-100 text-emerald-600" active={isActive(item.path)} onClick={() => { navigate(item.path); setMobileOpen(false); }} />)}</div></AccordionBlock>
              <AccordionBlock icon="ri-gamepad-line" label="갓겜" color="indigo" open={!!mobileAccordion['game']} onToggle={() => toggleMobileAccordion('game')}><div className="grid grid-cols-3 gap-1">{GAME_CATEGORY.items.map(item => <MenuGridCard key={`m-game-${item.path}`} icon={item.icon} label={item.label} colorClass="bg-indigo-100 text-indigo-600" active={isActive(item.path)} onClick={() => { navigate(item.path); setMobileOpen(false); }} />)}</div></AccordionBlock>
              <div className="flex items-center gap-2 px-2 py-2 mt-1 mb-2"><div className="h-px flex-1 bg-background-200"></div><span className="text-[10px] font-bold text-foreground-400 uppercase tracking-widest">나의 기록</span><div className="h-px flex-1 bg-background-200"></div></div>
              <AccordionBlock icon="ri-lock-line" label="신앙(비공개)" color="primary" open={!!mobileAccordion['faith']} onToggle={() => toggleMobileAccordion('faith')}><div className="grid grid-cols-3 gap-1">{FAITH_CATEGORY.items.map(item => <MenuGridCard key={`m-faith-${item.path}`} icon={item.icon} label={item.label} colorClass="bg-primary-100 text-primary-600" active={isActive(item.path)} onClick={() => { navigate(item.path); setMobileOpen(false); }} />)}</div></AccordionBlock>
              {showMissionTab && <AccordionBlock icon="ri-shield-star-line" label="사명 도구" color="rose" open={!!mobileAccordion['mission']} onToggle={() => toggleMobileAccordion('mission')}><div className="space-y-3">
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
      <button onClick={() => setActiveTab('faith')} className={`flex-1 py-2.5 text-xs font-bold ${activeTab === 'faith' ? 'text-primary-700 border-b-2 border-primary-500' : 'text-foreground-500'}`}>신앙</button>
      <button onClick={() => setActiveTab('account')} className={`flex-1 py-2.5 text-xs font-bold ${activeTab === 'account' ? 'text-primary-700 border-b-2 border-primary-500' : 'text-foreground-500'}`}>활동</button>
    </div>
    <div className="py-2">{(activeTab === 'faith' ? faithItems : activityItems).map(item => <Link key={item.path} to={item.path} onClick={onClose} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground-700 hover:bg-background-100 cursor-pointer"><i className={`${item.icon} text-base`}></i>{item.label}</Link>)}</div>
    <div className="border-t border-background-100 pt-2"><button onClick={onClose} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground-700 hover:bg-background-100 cursor-pointer"><i className="ri-lightbulb-line"></i>건의사항</button><button onClick={onSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-500 hover:bg-red-50 cursor-pointer"><i className="ri-logout-box-line"></i>로그아웃</button></div>
  </div>;
}
