import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState, lazy, Suspense, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import AuthGuard from '@/components/base/AuthGuard';
const navbarModulePromise = import('@/components/feature/Navbar');
const bottomTabBarModulePromise = import('@/components/feature/BottomTabBar');
const Navbar = lazy(() => navbarModulePromise);
const BottomTabBar = lazy(() => bottomTabBarModulePromise);
const DynamicWatermark = lazy(() => import('@/components/feature/DynamicWatermark'));
const PrayerRelayAuthorDeleteBridge = lazy(() => import('@/components/base/PrayerRelayAuthorDeleteBridge'));
const AppLockScreen = lazy(() => import('@/components/feature/AppLockScreen'));
const PinSetupPrompt = lazy(() => import('@/components/feature/PinSetupPrompt'));
const DashboardAttendanceSummary = lazy(() => import('@/components/feature/DashboardAttendanceSummary'));
const AttendanceTelegramEnhancer = lazy(() => import('@/components/feature/AttendanceTelegramEnhancer'));
const FaithHubPage = lazy(() => import('@/pages/faithHub/page'));
const TelegramSettingsPage = lazy(() => import('@/pages/telegramSettings/page'));
const BiblePick = lazy(() => import('@/pages/biblePick/page'));
const BibleMbtiEnhanced = lazy(() => import('@/pages/bibleMbtiEnhanced/page'));
import { useAutoLogout } from '@/hooks/useAutoLogout';
import { MobileMenuProvider } from '@/hooks/useMobileMenu';
import { isPinUnlockValid } from '@/lib/simplePin';

const LeadershipDiary = lazy(() => import('@/pages/leadershipDiary/page'));
const FULLSCREEN_GAME_PATHS=['/wolves-and-sheep','/pharisee','/pilgrims-run','/jonah-hide-seek','/galilee-phone'];
function isIosPwa(){if(typeof window==='undefined'||typeof navigator==='undefined')return false;const standalone=(navigator as Navigator & {standalone?:boolean}).standalone===true;const mode=window.matchMedia?.('(display-mode: standalone)').matches===true;return /iPhone|iPad|iPod/.test(navigator.userAgent)&&(standalone||mode)}
function IosPwaBackButton(){const location=useLocation();const navigate=useNavigate();const [iosPwa,setIosPwa]=useState(false);useEffect(()=>{const update=()=>setIosPwa(isIosPwa());update();const m=window.matchMedia?.('(display-mode: standalone)');m?.addEventListener?.('change',update);return()=>m?.removeEventListener?.('change',update)},[]);if(!iosPwa||location.pathname==='/')return null;const handleBack=()=>{const historyIndex=window.history.state?.idx;if(typeof historyIndex==='number'&&historyIndex>0){navigate(-1);return}navigate('/')};return <button type="button" onClick={handleBack} aria-label="뒤로 가기" className="fixed right-[4.5rem] top-[calc(env(safe-area-inset-top)+0.5rem)] z-[100] flex h-10 w-10 items-center justify-center rounded-full bg-background-200 text-foreground-700 shadow-sm active:scale-95"><i className="ri-arrow-left-line text-xl"/></button>}

export default function Layout(){
 const {user,profile,loading,profileError,retryProfile,profileRetrying,pinLocked,pinSetupNeeded,hasPin,lockApp,unlockWithPasskey}=useAuth(); const location=useLocation(); useAutoLogout();
 const passkeyAttemptedRef=useRef<string|null>(null);
 const pinBootCheckedRef=useRef<string|null>(null);

 useEffect(()=>{
   if(loading||!user||!hasPin||pinLocked)return;
   const key=`gnh_pin_session_unlocked:${user.id}`;
   const alreadyUnlocked=(()=>{try{return sessionStorage.getItem(key)==='1';}catch{return false;}})();
   if(pinBootCheckedRef.current!==user.id){
     pinBootCheckedRef.current=user.id;
     if(!alreadyUnlocked){
       lockApp();
       return;
     }
   }
   try{sessionStorage.setItem(key,'1');}catch{}
 },[loading,user?.id,hasPin,pinLocked,lockApp]);

 useEffect(()=>{
   if(loading||!user||!hasPin||(!pinLocked && isPinUnlockValid(user.id))||passkeyAttemptedRef.current===user.id)return;
   passkeyAttemptedRef.current=user.id;
   let cancelled=false;
   const timer=window.setTimeout(async()=>{
     try{
       const passkey = await import('@/lib/passkey');
       const {data}=await passkey.listPasskeys();
       if(cancelled||!data?.length||!passkey.isPasskeyEnabled())return;
       await unlockWithPasskey();
     }catch{}
   },120);
   return()=>{cancelled=true;window.clearTimeout(timer);};
 },[loading,user?.id,hasPin,pinLocked,unlockWithPasskey]);

 const persistedPinUnlocked = !!user && hasPin && isPinUnlockValid(user.id);
 if(pinLocked && !persistedPinUnlocked)return <Suspense fallback={<div className="min-h-screen bg-background-50" />}><AppLockScreen/></Suspense>; if(pinSetupNeeded)return <Suspense fallback={<div className="min-h-screen bg-background-50" />}><PinSetupPrompt/></Suspense>;
 const isSpecial=['/faith','/telegram-settings','/bible-pick','/bible-mbti','/leadership-diary'].includes(location.pathname);
 const isFullscreen=FULLSCREEN_GAME_PATHS.some(p=>location.pathname.startsWith(p));
 const showNavbar=!isFullscreen&&!!user&&(!profile||(profile.approval_status==='approved'&&!profile.is_expelled));
 const special=location.pathname==='/faith'?<Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center p-6 text-sm text-muted-foreground">로딩 중…</div>}><FaithHubPage/></Suspense>:location.pathname==='/telegram-settings'?<Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center p-6 text-sm text-muted-foreground">로딩 중…</div>}><TelegramSettingsPage/></Suspense>:location.pathname==='/bible-pick'?<Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center p-6 text-sm text-muted-foreground">로딩 중…</div>}><BiblePick/></Suspense>:location.pathname==='/bible-mbti'?<Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center p-6 text-sm text-muted-foreground">로딩 중…</div>}><BibleMbtiEnhanced/></Suspense>:location.pathname==='/leadership-diary'?<AuthGuard minRole="assistant_zone_leader"><Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center p-6 text-sm text-muted-foreground">로딩 중…</div>}><LeadershipDiary/></Suspense></AuthGuard>:null;
 if(isFullscreen)return <><IosPwaBackButton/><Outlet/></>;
 const showMissionaryAttendanceSummary=location.pathname==='/dashboard'&&profile?.role==='member';
 const showTelegramEnhancer=location.pathname==='/attendance-board'||location.pathname==='/dashboard/attendance';
 return <MobileMenuProvider><div className="min-h-screen bg-background-50"><a href="#main-content" className="skip-link">본문 바로가기</a>{showNavbar&&<Suspense fallback={null}><Navbar/></Suspense>}<IosPwaBackButton/>{user&&<Suspense fallback={null}><DynamicWatermark/></Suspense>}{user&&!profile&&!loading&&profileError&&<div role="alert" className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-center gap-3"><div className="flex items-center gap-2 text-sm text-amber-700"><i className="ri-error-warning-line" aria-hidden="true"/>{profileError}</div><button onClick={retryProfile} disabled={profileRetrying} className="min-h-10 px-3 py-1 rounded-full bg-amber-500 text-white text-xs font-semibold disabled:opacity-50">{profileRetrying?'재시도 중...':'다시 시도'}</button></div>}<main id="main-content" tabIndex={-1} className={showNavbar?'max-md:pb-[calc(6rem+env(safe-area-inset-bottom))]':''}>{showMissionaryAttendanceSummary&&<Suspense fallback={null}><DashboardAttendanceSummary/></Suspense>}{showTelegramEnhancer&&<Suspense fallback={null}><AttendanceTelegramEnhancer/></Suspense>}{isSpecial?special:<Outlet/>}</main>{showNavbar&&<Suspense fallback={null}><BottomTabBar/></Suspense>}{location.pathname==='/prayer-relay'&&<Suspense fallback={null}><PrayerRelayAuthorDeleteBridge/></Suspense>}</div></MobileMenuProvider>;
}