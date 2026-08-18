import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import type { UserRole } from '@/types/auth';
import type { ReactNode } from 'react';

interface AuthGuardProps {
  children: ReactNode;
  minRole?: UserRole;
}

export default function AuthGuard({ children, minRole }: AuthGuardProps) {
  const { user, profile, loading, profileError, profileRetrying, retryProfile, hasRole, signOut } = useAuth();
  const location = useLocation();
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  // Loading timeout: if profile doesn't load within 8 seconds, show error state
  useEffect(() => {
    if (!user || profile || profileError) {
      setLoadingTimedOut(false);
      return;
    }
    const timer = setTimeout(() => {
      setLoadingTimedOut(true);
    }, 8000);
    return () => clearTimeout(timer);
  }, [user, profile, profileError]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-foreground-600">불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // profile이 null이면: 에러가 있으면 에러 UI, 없으면 로딩 표시
  if (!profile) {
    const hasError = !!profileError || loadingTimedOut;
    const errorMessage = profileError || '프로필을 불러오는 데 시간이 너무 오래 걸립니다.';

    if (hasError) {
      return (
        <div className="min-h-screen bg-background-50 flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-accent-100 flex items-center justify-center mx-auto mb-4">
              <i className="ri-error-warning-line text-2xl text-accent-500"></i>
            </div>
            <h2 className="text-lg font-bold text-foreground-950 mb-2">프로필을 불러올 수 없습니다</h2>
            <p className="text-sm text-foreground-600 mb-5">{errorMessage}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => retryProfile()}
                disabled={profileRetrying}
                className="px-5 py-2.5 rounded-xl bg-primary-500 text-background-50 text-sm font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                {profileRetrying ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    재시도 중...
                  </span>
                ) : (
                  '다시 시도하기'
                )}
              </button>
              <button
                onClick={() => { window.location.reload(); }}
                className="px-5 py-2.5 rounded-xl border border-background-300 text-foreground-800 text-sm font-medium hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                페이지 새로고침
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Still waiting for profile (no error yet, within timeout)
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-foreground-600">프로필 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (profile?.is_expelled) {
    return <Navigate to="/login" replace />;
  }

  // Block unapproved users from accessing any page
  if (profile?.approval_status === 'pending') {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-[24px] bg-amber-100 border border-amber-200 flex items-center justify-center mx-auto mb-6">
            <i className="ri-time-line text-4xl text-amber-500"></i>
          </div>
          <h2 className="text-xl font-bold text-foreground-950 mb-3">교사 승인 대기 중입니다</h2>
          <p className="text-sm text-foreground-600 mb-2">
            <strong>{profile.name}</strong>님의 회원가입이 완료되었습니다.
          </p>
          <p className="text-sm text-foreground-600 mb-6">
            현재 부장님/교사님의 승인을 기다리고 있어요.<br />
            승인이 완료되면 모든 기능을 이용하실 수 있습니다.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-[16px] p-4 mb-6">
            <p className="text-xs text-amber-700 flex items-center gap-2 justify-center">
              <i className="ri-information-line"></i>
              승인까지 보통 1~2일 소요됩니다. 급한 문의는 담당 교사님께 연락해주세요.
            </p>
          </div>
          <button
            onClick={() => signOut()}
            className="px-6 py-2.5 rounded-full bg-background-200 text-foreground-700 text-sm font-medium hover:bg-background-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            로그아웃
          </button>
        </div>
      </div>
    );
  }

  if (profile?.approval_status === 'rejected') {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-[24px] bg-rose-100 border border-rose-200 flex items-center justify-center mx-auto mb-6">
            <i className="ri-close-circle-line text-4xl text-rose-500"></i>
          </div>
          <h2 className="text-xl font-bold text-foreground-950 mb-3">가입이 거절되었습니다</h2>
          <p className="text-sm text-foreground-600 mb-6">
            회원가입 신청이 승인되지 않았습니다.<br />
            자세한 사항은 담당 교사님께 문의해주세요.
          </p>
          <button
            onClick={() => signOut()}
            className="px-6 py-2.5 rounded-full bg-background-200 text-foreground-700 text-sm font-medium hover:bg-background-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            로그아웃
          </button>
        </div>
      </div>
    );
  }

  if (minRole && !hasRole(minRole)) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="text-center max-w-sm px-4">
          <div className="w-16 h-16 rounded-2xl bg-accent-100 flex items-center justify-center mx-auto mb-4">
            <i className="ri-shield-user-line text-2xl text-accent-500"></i>
          </div>
          <h2 className="text-lg font-bold text-foreground-950 mb-2">접근 권한이 없습니다</h2>
          <p className="text-sm text-foreground-600 mb-4">
            이 페이지에 접근하려면 더 높은 권한이 필요합니다
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}