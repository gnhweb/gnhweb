import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { UserProfile, UserRole } from '@/types/auth';
import { ROLE_HIERARCHY } from '@/types/auth';
import {
  hasSimplePin, setSimplePin, verifySimplePin, clearSimplePin, isValidPinFormat,
  markPinActivity, setPinExplicitLock,
} from '@/lib/simplePin';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  profileError: string | null;
  profileRetrying: boolean;
  retryProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null; user: User | null }>;
  signUp: (email: string, password: string, name: string, role: UserRole, club?: string, birthYear?: number, gender?: string, birthMonth?: number, birthDay?: number, interests?: string, grade?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  updateEmail: (newEmail: string) => Promise<{ error: string | null }>;
  hasRole: (minRole: UserRole) => boolean;
  assignedTeacherClub: string | null;
  secondaryClubs: string[];
  // ──── 간편 비밀번호(PIN) 잠금 ────
  // pinLocked: 이 기기에 저장된 세션이 있고 PIN도 설정되어 있는데, 아직 PIN을
  //            입력해서 잠금을 풀지 않은 상태. true면 앱 콘텐츠 대신 PIN 입력 화면을 보여준다.
  pinLocked: boolean;
  // hasPin: 현재 로그인한 사용자가 "이 기기"에 간편 비밀번호를 설정해 두었는지 여부.
  hasPin: boolean;
  // pinSetupNeeded: 로그인된 세션은 있지만 이 기기에 간편 비밀번호가 아직 없는 경우,
  // 앱을 새로 열 때(콜드 스타트) 설정을 안내하는 화면을 띄우기 위한 플래그.
  // "나중에 하기"를 누르면 이번 방문 동안만 꺼지고, 다음에 새로 열면 다시 안내한다.
  pinSetupNeeded: boolean;
  dismissPinSetupPrompt: () => void;
  setupPin: (pin: string) => Promise<{ error: string | null }>;
  changePin: (currentPin: string, newPin: string) => Promise<{ error: string | null }>;
  removePin: () => void;
  unlockWithPin: (pin: string) => Promise<boolean>;
  lockApp: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Thoroughly remove all Supabase auth data from localStorage.
 * Stale refresh tokens are the #1 cause of "Invalid Refresh Token" errors,
 * so we nuke everything sb-* related to guarantee a clean slate.
 * We iterate backwards because removal can shift remaining indices.
 */
function clearAllAuthStorage() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('sb-')) localStorage.removeItem(k);
    }
  } catch {
    /* localStorage cleanup is always best-effort */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileRetrying, setProfileRetrying] = useState(false);
  const [assignedTeacherClub, setAssignedTeacherClub] = useState<string | null>(null);
  const [secondaryClubs, setSecondaryClubs] = useState<string[]>([]);
  const [pinLocked, setPinLocked] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [pinSetupNeeded, setPinSetupNeeded] = useState(false);
  const sessionRestoredRef = useRef(false);
  const fetchingForRef = useRef<string | null>(null);
  const refreshFailureHandledRef = useRef(false);
  // Profile auto-retry state
  const profileRetryCountRef = useRef(0);
  const profileRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MAX_PROFILE_RETRIES = 5;

  // ──── Supabase Realtime: 권한 변경 실시간 감지 ────
  // 부장이 admin/roles 페이지에서 역할·겸직·동아리를 변경하면
  // 해당 사용자의 profile이 자동으로 갱신되어 UI에 즉시 반영됩니다.
  const realtimeSubRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  /**
   * Centralised "the session is dead" handler.
   * Called whenever we detect an irrecoverable auth error (stale refresh token,
   * server-side session revocation, etc.). Clears all auth state and storage so
   * the next page load starts from a clean slate.
   */
  const handleSessionDead = useCallback(() => {
    if (refreshFailureHandledRef.current) return;
    refreshFailureHandledRef.current = true;

    console.warn('[Auth] Session is dead — clearing all auth state');
    fetchingForRef.current = null;
    clearAllAuthStorage();

    // Also tell Supabase to clear its internal session state.
    // scope: 'local' avoids a server round-trip (which would fail anyway
    // with the expired refresh token), but still resets the in-memory
    // session and stops the auto-refresh timer.
    supabase.auth.signOut({ scope: 'local' }).catch(() => { /* ignore — we are already dead */ });

    setUser(null);
    setProfile(null);
    setProfileError(null);
    setLoading(false);
    setPinLocked(false);
    setHasPin(false);
    setPinSetupNeeded(false);

    // Force-redirect to /login immediately, without waiting for AuthGuard's
    // reactive re-render. This guarantees the user never sees a broken state
    // even if React batching delays the state update.
    // window.REACT_APP_NAVIGATE is set synchronously in src/router/index.ts
    // and available by the time any auth error can fire.
    try {
      if (window.REACT_APP_NAVIGATE) {
        window.REACT_APP_NAVIGATE('/login', { replace: true });
      }
    } catch {
      /* navigate may not be ready yet — AuthGuard's <Navigate> is the fallback */
    }
  }, []);

  const fetchProfile = useCallback(async (authUser: User) => {
    const userId = authUser.id;
    fetchingForRef.current = userId;
    setProfileError(null);

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchingForRef.current !== userId) return;

      if (!error && data) {
        // Profile loaded successfully -- reset retry state
        profileRetryCountRef.current = 0;
        if (profileRetryTimerRef.current) {
          clearTimeout(profileRetryTimerRef.current);
          profileRetryTimerRef.current = null;
        }
        const profileData = data as UserProfile;
        if (profileData.is_expelled) {
          setProfile(null);
          setProfileError('퇴출된 계정입니다. 관리자에게 문의하세요.');
          await supabase.auth.signOut();
          return;
        }
        // Fetch additional roles from user_role_assignments
        const { data: extraRoles } = await supabase
          .from('user_role_assignments')
          .select('role')
          .eq('user_id', userId);
        if (extraRoles && extraRoles.length > 0) {
          profileData.roles = [profileData.role, ...extraRoles.map((r: any) => r.role as UserRole)];
        }
        setProfile(profileData);
        return;
      }

      const meta = authUser.user_metadata;
      if (meta?.name) {
        const safeRole = (meta.role === 'chief' || meta.role === 'teacher') ? 'member' : (meta.role || 'member');
        const { data: newProfile, error: insertError } = await supabase
          .from('user_roles')
          .insert({
            user_id: userId,
            role: safeRole,
            name: meta.name,
            club: meta.club || null,
            birth_year: meta.birth_year || null,
            is_active: true,
          })
          .select('*')
          .maybeSingle();

        if (fetchingForRef.current !== userId) return;

        if (!insertError && newProfile) {
          setProfile(newProfile as UserProfile);
          return;
        }

        const { data: retryData } = await supabase
          .from('user_roles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        if (fetchingForRef.current !== userId) return;
        if (retryData) {
          setProfile(retryData as UserProfile);
          return;
        }
      }

      setProfileError('프로필 정보를 불러올 수 없습니다. 관리자에게 문의하거나 다시 시도해주세요.');
    } catch (e) {
      if (fetchingForRef.current !== userId) return;
      console.error('[Auth] fetchProfile exception:', e);
      setProfileError('프로필 로딩 중 네트워크 오류가 발생했습니다. 다시 시도해주세요.');

      // Auto-retry with exponential backoff
      if (profileRetryCountRef.current < MAX_PROFILE_RETRIES) {
        const delay = Math.min(1000 * Math.pow(2, profileRetryCountRef.current), 30000);
        profileRetryCountRef.current += 1;
        console.warn(`[Auth] Retrying profile fetch in ${delay}ms (attempt ${profileRetryCountRef.current}/${MAX_PROFILE_RETRIES})`);
        profileRetryTimerRef.current = setTimeout(() => {
          if (fetchingForRef.current === userId) {
            fetchProfile(authUser);
          }
        }, delay);
      } else {
        console.error('[Auth] Profile fetch failed after max retries');
        setProfileError('프로필을 불러올 수 없습니다. 페이지를 새로고침하거나 다시 로그인해주세요.');
      }
    }
  }, []);

  /**
   * Global safety net: catch any unhandled promise rejection that leaks from
   * Supabase's internal auto-refresh timer. When the refresh token is stale,
   * the library *should* emit SIGNED_OUT, but on some browser/version combos
   * the rejection leaks before the event fires. We catch it here and force a
   * clean sign-out so the user never sees a broken / half-logged-in state.
   */
  useEffect(() => {
    function onUnhandledRejection(event: PromiseRejectionEvent) {
      const reason = event?.reason;
      const msg = typeof reason?.message === 'string' ? reason.message : String(reason ?? '');

      if (
        msg.includes('Invalid Refresh Token') ||
        msg.includes('Refresh Token Not Found') ||
        msg.includes('AuthSessionMissingError') ||
        (reason?.name === 'AuthApiError')
      ) {
        event.preventDefault(); // stop the default "Unhandled Rejection" console noise
        console.warn('[Auth] Caught leaked auth rejection — forcing clean sign-out:', msg);
        handleSessionDead();
      }
    }

    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', onUnhandledRejection);
  }, [handleSessionDead]);

  useEffect(() => {
    let isMounted = true;

    // 1) Restore persisted session on first load.
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (!isMounted) return;
        sessionRestoredRef.current = true;

        if (error) {
          console.warn('[Auth] getSession error:', error.message);

          // If the error is specifically about an invalid refresh token,
          // the session stored in localStorage is useless — wipe it clean.
          if (
            error.message.includes('Invalid Refresh Token') ||
            error.message.includes('Refresh Token Not Found')
          ) {
            handleSessionDead();
            return;
          }

          // For other errors, still clean up just in case
          clearAllAuthStorage();
          setUser(null);
          setProfile(null);
          setLoading(false);
          setPinLocked(false);
          setHasPin(false);
          setPinSetupNeeded(false);
          return;
        }

        const currentUser = session?.user ?? null;
        setUser(currentUser);
        setLoading(false);

        if (currentUser) {
          // 앱을 새로 열 때마다(브라우저를 새로 열거나 새로고침) 항상 본인 확인을
          // 거치도록 한다: 이 기기에 간편 비밀번호가 설정되어 있으면 무조건 PIN
          // 입력 화면부터 보여주고, 아직 설정하지 않았다면 설정하도록 안내한다.
          // (예전에는 자동 로그아웃 타임아웃 전이면 그냥 통과시켰지만, 보안을 위해
          // "처음 들어올 때는 항상 확인"으로 변경)
          const deviceHasPin = hasSimplePin(currentUser.id);
          setHasPin(deviceHasPin);

          if (deviceHasPin) {
            setPinLocked(true);
            setPinExplicitLock(currentUser.id, true);
            setPinSetupNeeded(false);
          } else {
            setPinLocked(false);
            setPinSetupNeeded(true);
          }
          fetchProfile(currentUser);
        } else {
          setProfile(null);
          setHasPin(false);
          setPinLocked(false);
          setPinSetupNeeded(false);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('[Auth] getSession exception:', err);
        clearAllAuthStorage();
        sessionRestoredRef.current = true;
        setUser(null);
        setProfile(null);
        setLoading(false);
        setPinLocked(false);
        setHasPin(false);
        setPinSetupNeeded(false);
      });

    // 2) React to auth changes (login, logout, token refresh).
    // The callback MUST stay synchronous — no await inside — or the auth lock deadlocks.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      // Token refresh keeps the same user; nothing to re-fetch.
      if (event === 'TOKEN_REFRESHED') {
        const refreshedUser = session?.user ?? null;
        if (refreshedUser) {
          setUser(refreshedUser);
        } else {
          // Token refresh event came in but there's no user — the session is dead.
          console.warn('[Auth] TOKEN_REFRESHED with null user — forcing sign out');
          handleSessionDead();
        }
        return;
      }

      if (event === 'SIGNED_OUT') {
        fetchingForRef.current = null;
        clearAllAuthStorage();
        setUser(null);
        setProfile(null);
        setProfileError(null);
        setLoading(false);
        setPinLocked(false);
        setHasPin(false);
        setPinSetupNeeded(false);
        return;
      }

      // Avoid double-handling the initial session (already done via getSession above).
      if (event === 'INITIAL_SESSION' && sessionRestoredRef.current) {
        return;
      }

      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setLoading(false);
      setProfileError(null);

      if (currentUser) {
        // 여기 도달하는 이벤트(SIGNED_IN 등)는 방금 signIn()으로 직접 인증을
        // 마친 경우이므로 다시 PIN 잠금을 걸지 않는다 — pinLocked는 건드리지 않고
        // hasPin 표시만 최신 상태로 갱신한다. 방금 정상적으로 들어왔으므로 잠금
        // 플래그도 풀어주고 활동 시각을 기록해, 곧바로 새로고침해도 PIN을 다시
        // 묻지 않도록 한다. (로그인 화면이 자체적으로 PIN 설정 안내를 이미
        // 보여주므로, 여기서는 Layout의 안내 화면을 따로 띄우지 않는다.)
        setHasPin(hasSimplePin(currentUser.id));
        setPinExplicitLock(currentUser.id, false);
        setPinSetupNeeded(false);
        markPinActivity(currentUser.id);
        fetchProfile(currentUser);
      } else {
        fetchingForRef.current = null;
        setProfile(null);
        setHasPin(false);
        setPinLocked(false);
        setPinSetupNeeded(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, handleSessionDead]);

  // ──── Supabase Realtime: 권한 변경 실시간 감지 ────
  useEffect(() => {
    if (!user) {
      if (realtimeSubRef.current) {
        supabase.removeChannel(realtimeSubRef.current);
        realtimeSubRef.current = null;
      }
      return;
    }

    const userId = user.id;

    // user_roles 변경 감지 (역할, 동아리, 활성상태 등)
    const channel = supabase
      .channel(`profile-realtime-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_roles',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          console.log('[Auth] user_roles 변경 감지 → 프로필 갱신');
          fetchProfile(user);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_role_assignments',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          console.log('[Auth] user_role_assignments 변경 감지 → 프로필 갱신');
          fetchProfile(user);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_club_assignments',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          console.log('[Auth] user_club_assignments 변경 감지 → 프로필 갱신');
          fetchProfile(user);
        }
      )
      .subscribe();

    realtimeSubRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      // Reset the refresh-failure flag so a fresh login isn't blocked by a
      // previous stale-session detection on the same page load.
      refreshFailureHandledRef.current = false;

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message, user: null };

      const signedInUser = data.user ?? null;
      if (signedInUser) {
        setUser(signedInUser);
        setLoading(false);
        setProfileError(null);
        fetchProfile(signedInUser);
      }
      return { error: null, user: signedInUser };
    } catch (e: any) {
      const errMsg = e?.message === 'Failed to fetch'
        ? '서버 연결이 원활하지 않습니다. 네트워크를 확인하고 다시 시도해주세요.'
        : '로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      console.error('[Auth] signIn exception:', e);
      return { error: errMsg, user: null };
    }
  }, [fetchProfile]);

  const signUp = useCallback(async (email: string, password: string, name: string, role: UserRole, club?: string, birthYear?: number, gender?: string, birthMonth?: number, birthDay?: number, interests?: string, grade?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role, club: club || null, birth_year: birthYear || null, gender: gender || null, birth_month: birthMonth || null, birth_day: birthDay || null, interests: interests || null, grade: grade || null },
      },
    });
    if (error) return { error: error.message };

    if (data.session && data.user) {
      const { error: roleError } = await supabase.from('user_roles').insert({
        user_id: data.user.id,
        role,
        name,
        club: club || null,
        birth_year: birthYear || null,
        gender: gender || null,
        birth_month: birthMonth || null,
        birth_day: birthDay || null,
        interests: interests || null,
        grade: grade || null,
        is_active: true,
        approval_status: 'pending',
      });
      if (roleError) return { error: roleError.message };
    }

    return { error: null };
  }, []);

  const retryProfile = useCallback(async () => {
    if (!user) return;
    setProfileRetrying(true);
    setProfileError(null);
    try {
      await fetchProfile(user);
    } finally {
      setProfileRetrying(false);
    }
  }, [user, fetchProfile]);

  const signOut = useCallback(async () => {
    fetchingForRef.current = null;
    setUser(null);
    setProfile(null);
    setProfileError(null);
    setPinLocked(false);
    setHasPin(false);
    setPinSetupNeeded(false);
    clearAllAuthStorage();
    // scope:'local' ensures we never hit the server (which would fail if
    // the refresh token is already dead). All local state is already wiped above.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => { /* already cleaned */ });

    // 버그 수정: 예전에는 여기서 화면 전환을 전혀 하지 않고 AuthGuard의 재렌더링(user===null → <Navigate>)에만
    // 의존했다. 그런데 라우터에는 AuthGuard로 감싸지 않은 화면(예: /wolves-and-sheep, /tools, /bible-pick 등)이
    // 여러 개 있어서, 자동 로그아웃(useAutoLogout)이든 수동 로그아웃이든 그런 화면에 있을 때 signOut()이
    // 호출되면 아무도 리다이렉트를 시켜주지 않아 "로그아웃됐는데 화면은 그대로" 상태가 됐다.
    // handleSessionDead와 동일하게 window.REACT_APP_NAVIGATE로 화면을 직접, 무조건 /login으로 전환해서
    // 어떤 화면에서 로그아웃되더라도(가드가 없는 화면 포함) 항상 로그인/회원가입 창으로 자동 전환되게 한다.
    try {
      if (window.REACT_APP_NAVIGATE) {
        window.REACT_APP_NAVIGATE('/login', { replace: true });
      }
    } catch {
      /* navigate may not be ready yet — AuthGuard's <Navigate> is the fallback for guarded routes */
    }
  }, []);

  const hasRole = useCallback((minRole: UserRole): boolean => {
    if (!profile) return false;
    // Check all roles: primary role + extra assigned roles
    const allRoles = profile.roles || [profile.role];
    return allRoles.some(r => ROLE_HIERARCHY[r] >= ROLE_HIERARCHY[minRole]);
  }, [profile]);

  // Fetch assigned teacher clubs from club_teachers table (N:M)
  useEffect(() => {
    if (!profile || !user) {
      setAssignedTeacherClub(null);
      return;
    }
    const isTeacherOrChief = profile.role === 'teacher' || profile.role === 'chief';
    if (!isTeacherOrChief) {
      setAssignedTeacherClub(null);
      return;
    }
    // For chief, fetch all assigned clubs; for teacher, fetch their assigned clubs
    supabase
      .from('club_teachers')
      .select('club')
      .eq('teacher_id', user.id)
      .then(({ data }) => {
        if (data && data.length > 0) {
          // Return the first assigned club as the primary one
          // (teacher dashboard uses this for filtering)
          setAssignedTeacherClub(data[0].club as string);
        } else {
          // Fallback to legacy assigned_teacher_id if no club_teachers entries
          setAssignedTeacherClub(profile.assigned_teacher_id || null);
        }
      })
      .catch(() => {
        setAssignedTeacherClub(profile.assigned_teacher_id || null);
      });
  }, [profile, user]);

  // Fetch secondary clubs from user_club_assignments (겸직)
  useEffect(() => {
    if (!profile || !user) {
      setSecondaryClubs([]);
      return;
    }
    supabase
      .from('user_club_assignments')
      .select('club')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setSecondaryClubs(data.map((r: any) => r.club as string));
        } else {
          setSecondaryClubs([]);
        }
      })
      .catch(() => setSecondaryClubs([]));
  }, [profile, user]);

  const assignedTeacherClubValue = (hasRole('teacher') || hasRole('chief')) ? (profile?.assigned_teacher_id || null) : null;

  const resetPassword = useCallback(async (email: string) => {
    try {
      const basePath = __BASE_PATH__.split('/').filter(Boolean).join('/');
      const pathPrefix = basePath ? `/${basePath}` : '';
      const redirectTo = `${window.location.origin}${pathPrefix}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) return { error: error.message };
      return { error: null };
    } catch {
      return { error: '비밀번호 재설정 메일 발송 중 오류가 발생했습니다.' };
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { error: error.message };
      return { error: null };
    } catch {
      return { error: '비밀번호 변경 중 오류가 발생했습니다.' };
    }
  }, []);

  // 이메일 변경: Supabase가 새 이메일로 인증 링크를 보내고, 사용자가 그 링크를
  // 클릭해야 실제로 이메일이 바뀐다(보안을 위해 즉시 반영되지 않음).
  const updateEmail = useCallback(async (newEmail: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) return { error: error.message };
      return { error: null };
    } catch {
      return { error: '이메일 변경 중 오류가 발생했습니다.' };
    }
  }, []);

  // ──── 간편 비밀번호(PIN) ────
  const setupPin = useCallback(async (pin: string) => {
    if (!user) return { error: '로그인이 필요합니다.' };
    if (!isValidPinFormat(pin)) return { error: '숫자 4~6자리로 설정해주세요.' };
    await setSimplePin(user.id, pin);
    setHasPin(true);
    setPinExplicitLock(user.id, false);
    setPinSetupNeeded(false);
    markPinActivity(user.id);
    return { error: null };
  }, [user]);

  // "나중에 하기" — 이번 방문(현재 페이지가 열려있는 동안)에만 안내를 닫는다.
  // 다음에 앱을 새로 열면(콜드 스타트) 여전히 PIN이 없으므로 다시 안내한다.
  const dismissPinSetupPrompt = useCallback(() => {
    setPinSetupNeeded(false);
  }, []);

  const changePin = useCallback(async (currentPin: string, newPin: string) => {
    if (!user) return { error: '로그인이 필요합니다.' };
    const ok = await verifySimplePin(user.id, currentPin);
    if (!ok) return { error: '현재 간편 비밀번호가 일치하지 않습니다.' };
    if (!isValidPinFormat(newPin)) return { error: '숫자 4~6자리로 설정해주세요.' };
    await setSimplePin(user.id, newPin);
    return { error: null };
  }, [user]);

  const removePin = useCallback(() => {
    if (!user) return;
    clearSimplePin(user.id);
    setHasPin(false);
  }, [user]);

  const unlockWithPin = useCallback(async (pin: string) => {
    if (!user) return false;
    const ok = await verifySimplePin(user.id, pin);
    if (ok) {
      setPinLocked(false);
      setPinExplicitLock(user.id, false);
      markPinActivity(user.id);
    }
    return ok;
  }, [user]);

  // 일정 시간 활동이 없을 때(useAutoLogout) 완전 로그아웃 대신 PIN 잠금만 다시 건다.
  // 이 잠금 상태는 명시적 플래그로 저장되므로, 잠긴 채로 새로고침해도 계속 PIN을 요구한다.
  const lockApp = useCallback(() => {
    if (user && hasSimplePin(user.id)) {
      setPinLocked(true);
      setPinExplicitLock(user.id, true);
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileError, profileRetrying, retryProfile, signIn, signUp, signOut, resetPassword, updatePassword, updateEmail, hasRole, assignedTeacherClub, secondaryClubs, pinLocked, hasPin, pinSetupNeeded, dismissPinSetupPrompt, setupPin, changePin, removePin, unlockWithPin, lockApp }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}