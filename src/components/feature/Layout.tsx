import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState, lazy, Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import AuthGuard from '@/components/base/AuthGuard';
import Navbar from '@/components/feature/Navbar';
import BottomTabBar from '@/components/feature/BottomTabBar';
import DynamicWatermark from '@/components/feature/DynamicWatermark';
import AppLockScreen from '@/components/feature/AppLockScreen';
import PinSetupPrompt from '@/components/feature/PinSetupPrompt';
import DashboardAttendanceSummary from '@/components/feature/DashboardAttendanceSummary';
import HomeMemoryEnhancer from '@/components/feature/HomeMemoryEnhancer';
import AttendanceTelegramEnhancer from '@/components/feature/AttendanceTelegramEnhancer';
import FaithHubPage from '@/pages/faithHub/page';
import TelegramSettingsPage from '@/pages/telegramSettings/page';
import BiblePickEnhanced from '@/pages/biblePickEnhanced/page';
import BibleMbtiEnhanced from '@/pages/bibleMbtiEnhanced/page';
import EventIdeasEnhanced from '@/pages/eventIdeasEnhanced/page';
import { useAutoLogout } from '@/hooks/useAutoLogout';
import { MobileMenuProvider } from '@/hooks/useMobileMenu';

const LeadershipDiary = lazy(() => import('@/pages/leadershipDiary/page'));
const FULLSCREEN_GAME_PATHS=['/wolves-and-sheep','/pharisee','/pilgrims-run','/jonah-hide-seek','/galilee-phone'];
function isIosPwa(){if(typeof window==='undefined'||typeof navigator==='undefined')return false;const standalone=(navigator as Navigator & {standalone?:boolean}).standalone===true;const mode=window.matchMedia?.('(display-mode: standalone)').matches===true;return /iPhone|iPad|iPod/.test(navigator.userAgent)&&(standalone||mode)}
function IosPwaBackButton(){const location=useLocation();const navigate=useNavigate();const [iosPwa,setIosPwa]=useState(false);useEffect(()=>{const update=()=>setIosPwa(isIosPwa());update();const m=window.matchMedia?.('(display-mode: standalone)');m?.addEventListener?.('change',update);return()=>m?.removeEventListener?.('change',update)},[]);if(!iosPwa||location.pathname==='/')return null;return <button type="button" onClick={()=>window.history.length>1?window.history.back():navigate('/')} aria-label="뒤로 가기" className="fixed right-[4.5rem] top-[calc(env(safe-area-inset-top)+0.5rem)] z-[100] flex h-10 w-10 items-center justify-center rounded-full bg-background-200 text-foreground-700 shadow-sm active:scale-95"><i className="ri-arrow-left-line text-xl"/></button>}

export default function Layout(){
 const {user,profile,loading,profileError,retryProfile,profileRetrying,pinLocked,pinSetupNeeded}=useAuth(); const location=useLocation(); useAutoLogout();
 if(pinLocked)return <AppLockScreen/>; if(pinSetupNeeded)return <PinSetupPrompt/>;
 const isSpecial=['/faith','/telegram-settings','/bible-pick','/bible-mbti','/event-ideas','/leadership-diary'].includes(location.pathname);
 const isFullscreen=FULLSCREEN_GAME_PATHS.some(p=>location.pathname.startsWith(p));
 const showNavbar=!isFullscreen&&!!user&&(!profile||(profile.approval_status==='approved'&&!profile.is_expelled));
 const special=location.pathname==='/faith'?<FaithHubPage/>:location.pathname==='/telegram-settings'?<TelegramSettingsPage/>:location.pathname==='/bible-pick'?<BiblePickEnhanced/>:location.pathname==='/bible-mbti'?<BibleMbtiEnhanced/>:location.pathname==='/event-ideas'?<EventIdeasEnhanced/>:location.pathname==='/leadership-diary'?<AuthGuard minRole="assistant_zone_leader"><Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center p-6 text-sm text-muted-foreground">로딩 중…</div>}><LeadershipDiary/></Suspense></AuthGuard>:null;
 if(isFullscreen)return <><IosPwaBackButton/><Outlet/></>;
 const showMissionaryAttendanceSummary=location.pathname==='/dashboard'&&profile?.role==='member';
 return <MobileMenuProvider><div className="min-h-screen bg-background-50">{showNavbar&&<Navbar/>}<IosPwaBackButton/>{user&&<DynamicWatermark/>}{user&&!profile&&!loading&&profileError&&<div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-center gap-3"><div className="flex items-center gap-2 text-sm text-amber-700"><i className="ri-error-warning-line"/>{profileError}</div><button onClick={retryProfile} disabled={profileRetrying} className="min-h-10 px-3 py-1 rounded-full bg-amber-500 text-white text-xs font-semibold disabled:opacity-50">{profileRetrying?'재시도 중...':'다시 시도'}</button></div>}<main className={showNavbar?'max-md:pb-[calc(6rem+env(safe-area-inset-bottom))]':''}>{showMissionaryAttendanceSummary&&<DashboardAttendanceSummary/>}{location.pathname==='/'&&<HomeMemoryEnhancer/>}{location.pathname==='/attendance-board'&&<AttendanceTelegramEnhancer/>}{isSpecial?special:<Outlet/>}</main>{showNavbar&&<BottomTabBar/>}</div></MobileMenuProvider>;
}