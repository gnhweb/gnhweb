import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Navbar from '@/components/feature/Navbar';
import BottomTabBar from '@/components/feature/BottomTabBar';
import DynamicWatermark from '@/components/feature/DynamicWatermark';
import AppLockScreen from '@/components/feature/AppLockScreen';
import PinSetupPrompt from '@/components/feature/PinSetupPrompt';
import { useAutoLogout } from '@/hooks/useAutoLogout';
import { MobileMenuProvider } from '@/hooks/useMobileMenu';

// 전체 화면으로 몰입해서 플레이하는 게임 라우트 — 사이트 공통 Navbar/워터마크 위젯을
// 항상 숨긴다. (게임 시작 전 로비 화면부터 끝까지, Navbar가 위에 겹쳐 보이던 문제 수정)
const FULLSCREEN_GAME_PATHS = ['/wolves-and-sheep', '/pharisee', '/pilgrims-run', '/jonah-hide-seek', '/galilee-phone'];

export default function Layout() {
  const { user, profile, loading, profileError, retryProfile, profileRetrying, pinLocked, pinSetupNeeded } = useAuth();
  const location = useLocation();
  useAutoLogout();

  // 간편 비밀번호(PIN) 잠금 상태면 어떤 페이지 경로든 PIN 입력 화면만 보여준다.
  if (pinLocked) {
    return <AppLockScreen />;
  }

  // 로그인은 되어 있는데 이 기기에 PIN이 아직 없으면, 앱을 새로 열 때마다
  // 설정하도록 안내한다. ("나중에 하기"를 누르면 이번 방문 동안은 넘어간다)
  if (pinSetupNeeded) {
    return <PinSetupPrompt />;
  }

  const isFullscreenGameRoute = FULLSCREEN_GAME_PATHS.some((p) => location.pathname.startsWith(p));

  // Show Navbar when:
  // 1. User is logged in + profile loaded and approved
  // 2. User is logged in + profile still loading (show Navbar with loading state)
  // Only hide Navbar when profile is explicitly rejected/expelled
  const showNavbar =
    !isFullscreenGameRoute && user && (!profile || (profile.approval_status === 'approved' && !profile.is_expelled));

  if (isFullscreenGameRoute) {
    // 게임 페이지는 자체적으로 전체 화면 레이아웃을 관리하므로, 여기서는 사이트 공통 UI
    // (Navbar/워터마크/배너)를 전혀 렌더링하지 않고 순수하게 게임 화면만 내보낸다.
    return <Outlet />;
  }

  return (
    <MobileMenuProvider>
      <div className="min-h-screen bg-background-50">
        {showNavbar && <Navbar />}

        {/* Dynamic Watermark for logged-in users */}
        {user && <DynamicWatermark />}

        {/* Profile loading/error overlay banner */}
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

        {/* 하단 탭바가 콘텐츠를 가리지 않도록 모바일에서만 여백 확보 */}
        <main className={showNavbar ? 'max-md:pb-24' : ''}>
          <Outlet />
        </main>

        {showNavbar && <BottomTabBar />}
      </div>
    </MobileMenuProvider>
  );
}