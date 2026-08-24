import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Navbar from '@/components/feature/Navbar';
import BottomTabBar from '@/components/feature/BottomTabBar';
import DynamicWatermark from '@/components/feature/DynamicWatermark';
import AppLockScreen from '@/components/feature/AppLockScreen';
import PinSetupPrompt from '@/components/feature/PinSetupPrompt';
import { useAutoLogout } from '@/hooks/useAutoLogout';
import { MobileMenuProvider } from '@/hooks/useMobileMenu';

const FULLSCREEN_GAME_PATHS = ['/wolves-and-sheep', '/pharisee', '/pilgrims-run', '/jonah-hide-seek', '/galilee-phone'];

function isNativeAndroidApp(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.userAgent.includes('GNHWebAndroid/');
}

export default function Layout() {
  const { user, profile, loading, profileError, retryProfile, profileRetrying, pinLocked, pinSetupNeeded } = useAuth();
  const location = useLocation();
  const nativeAndroid = isNativeAndroidApp();
  useAutoLogout();

  // Native Android wrapper performs the real OS-level biometric prompt before
  // the WebView is shown, so the web PIN/passkey screen must not appear there.
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
    return <Outlet />;
  }

  return (
    <MobileMenuProvider>
      <div className="min-h-screen bg-background-50">
        {showNavbar && <Navbar />}
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

        <main className={showNavbar ? 'max-md:pb-24' : ''}>
          <Outlet />
        </main>

        {showNavbar && <BottomTabBar />}
      </div>
    </MobileMenuProvider>
  );
}
