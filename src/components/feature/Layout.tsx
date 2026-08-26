import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Navbar from '@/components/feature/Navbar';
import BottomTabBar from '@/components/feature/BottomTabBar';
import DynamicWatermark from '@/components/feature/DynamicWatermark';
import AppLockScreen from '@/components/feature/AppLockScreen';
import PinSetupPrompt from '@/components/feature/PinSetupPrompt';
import { useAutoLogout } from '@/hooks/useAutoLogout';
import { MobileMenuProvider, useMobileMenu } from '@/hooks/useMobileMenu';

const FULLSCREEN_GAME_PATHS = ['/wolves-and-sheep', '/pharisee', '/pilgrims-run', '/jonah-hide-seek', '/galilee-phone'];

function isNativeAndroidApp(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.userAgent.includes('GNHWebAndroid/');
}

function isIosPwa(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const displayModeStandalone = window.matchMedia?.('(display-mode: standalone)').matches === true;
  const iosDevice = /iPhone|iPad|iPod/.test(navigator.userAgent);
  return iosDevice && (standalone || displayModeStandalone);
}

function IosPwaBackButton() {
  const { mobileOpen } = useMobileMenu();
  const location = useLocation();
  const navigate = useNavigate();
  const [iosPwa, setIosPwa] = useState(false);

  useEffect(() => {
    const update = () => setIosPwa(isIosPwa());
    update();
    const media = window.matchMedia?.('(display-mode: standalone)');
    media?.addEventListener?.('change', update);
    return () => media?.removeEventListener?.('change', update);
  }, []);

  if (!iosPwa || location.pathname === "/") return null;

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    if (location.pathname !== '/') navigate('/');
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label="뒤로 가기"
      title="뒤로 가기"
      className="fixed right-[4.5rem] top-[calc(env(safe-area-inset-top)+0.5rem)] z-[100] flex h-10 w-10 items-center justify-center rounded-full bg-background-200 text-foreground-700 shadow-sm active:scale-95"
    >
      <i className="ri-arrow-left-line text-xl" aria-hidden="true" />
    </button>
  );
}

export default function Layout() {
  const { user, profile, loading, profileError, retryProfile, profileRetrying, pinLocked, pinSetupNeeded } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const nativeAndroid = isNativeAndroidApp();
  useAutoLogout();

  if (!nativeAndroid && pinLocked) {
    return <AppLockScreen />;
  }

  if (!nativeAndroid && pinSetupNeeded) {
    return <PinSetupPrompt />;
  }

  const isFullscreenGameRoute = FULLSCREEN_GAME_PATHS.some((p) => location.pathname.startsWith(p));

  const showNavbar =
    !isFullscreenGameRoute && user && (!profile || (profile.approval_status === 'approved' && !profile.is_expelled));

  if (isFullscreenGameRoute) {
    return (
      <>
        <IosPwaBackButton />
        <Outlet />
      </>
    );
  }

  return (
    <MobileMenuProvider>
      <div className="min-h-screen bg-background-50">
        {showNavbar && <Navbar />}
        <IosPwaBackButton />
        {user && <DynamicWatermark />}
        {user && !profile && !loading && profileError && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-center gap-3">
            <div className="flex items-center gap-2 text-sm text-amber-700">
              <i className="ri-error-warning-line"></i>
              {profileError}
            </div>
            <button
              onClick={retryProfile}
              disabled={profileRetrying}
              className="px-3 py-1 rounded-full bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              {profileRetrying ? (
                <span className="flex items-center gap-1">
                  <i className="ri-loader-4-line animate-spin"></i>
                  재시도 중...
                </span>
              ) : (
                '다시 시도'
              )}
            </button>
          </div>
        )}

        <main className={showNavbar ? 'max-md:pb-[calc(6rem+env(safe-area-inset-bottom))]' : ''}>
          <Outlet />
        </main>

        {showNavbar && <BottomTabBar />}
      </div>
    </MobileMenuProvider>
  );
}
