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
    { path: '/missions', label: '작은 사명 관리', icon: 'ri-medal-line' },
    { path: '/missions/leaderboard', label: '이달의 사명왕', icon: 'ri-trophy-line' },
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

  const categoryButton = (cat: CategoryGroup, open: boolean, setOpen: (v: boolean) => void, ref: React.RefObject<HTMLDivElement | null>) => (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => { closeAllDesktop(); setOpen(!open); }} className={`flex items-center gap-1.5 px-3 py-2 rounded-input text-sm font-label font-semibold transition-colors cursor-pointer ${open ? catBgActive(cat.colorClass) : 'text-foreground-700 hover:bg-background-100'}`}>
        <i className={cat.icon}></i><span>{cat.name}</span><i className={`ri-arrow-down-s-line text-xs transition-transform ${open ? 'rotate-180' : ''}`}></i>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }} className="absolute left-0 top-full mt-2 w-56 rounded-card border border-background-200 bg-background shadow-card-lg p-2 z-50">
            {cat.items.map(item => (
              <Link key={item.path} to={item.path} className={`flex items-center gap-3 px-3 py-2.5 rounded-input text-sm transition-colors ${isActive(item.path) ? catBgActive(cat.colorClass) : `text-foreground-700 ${catBgHover(cat.colorClass)}`}`}>
                <i className={item.icon}></i><span>{item.label}</span>
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return null;
}
