import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { UserProfile, UserRole } from '@/types/auth';
import { ROLE_HIERARCHY } from '@/types/auth';
import {
  hasSimplePin, setSimplePin, verifySimplePin, clearSimplePin, isValidPinFormat,
  markPinActivity, setPinExplicitLock,
} from '@/lib/simplePin';
import { authenticateRegisteredPasskey, isPasskeySupported, signInWithPasskey as signInWithPasskeyLib } from '@/lib/passkey';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  profileError: string | null;
  profileRetrying: boolean;
  retryProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null; user: User | null }>;
  signInWithPasskey: () => Promise<{ error: string | null }>;
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
  unlockWithPasskey: () => Promise<boolean>;
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
  // Tracks the newest auth action/event so a late initial getSession() response cannot overwrite it.
  const authEventVersionRef = useRef(0);
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
        event.preventDefault();
        console.warn('[Auth] Caught leaked auth rejection — forcing clean sign-out:', msg);
        handleSessionDead();
      }
    }

    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', onUnhandledRejection);
  }, [handleSessionDead]);

  useEffect(() => {
    let isMounted = true;

    const getSessionVersion = authEventVersionRef.current;

    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (!isMounted) return;
        if (authEventVersionRef.current !== getSessionVersion) {
          sessionRestoredRef.current = true;
          return;
        }
        sessionRestoredRef.current = true;

        if (error) {
          console.warn('[Auth] getSession error:', error.message);
          if (
            error.message.includes('Invalid Refresh Token') ||
            error.message.includes('Refresh Token Not Found')
          ) {
            handleSessionDead();
            return;
          }

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
        if (authEventVersionRef.current !== getSessionVersion) {
          sessionRestoredRef.current = true;
          return;
        }
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      authEventVersionRef.current += 1;

      if (event === 'TOKEN_REFRESHED') {
        const refreshedUser = session?.user ?? null;
        if (refreshedUser) {
          setUser(refreshedUser);
        } else {
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

      if (event === 'INITIAL_SESSION' && sessionRestoredRef.current) {
        return;
      }

      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setLoading(false);
      setProfileError(null);

      if (currentUser) {
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

  useEffect(() => {
    if (!user) {
      if (realtimeSubRef.current) {
        supabase.removeChannel(realtimeSubRef.current);
        realtimeSubRef.current = null;
      }
      return;
    }

    const userId = user.id;
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
      refreshFailureHandledRef.current = false;
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message, user: null };

      const signedInUser = data.user ?? null;
      if (signedInUser) {
        // Mark successful sign-in newer than the initial bootstrap read.
        authEventVersionRef.current += 1;
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

















  const signInWithPasskey = useCallback(async () => {
    if (!isPasskeySupported()) return { error: '이 기기에서 패스키 로그인을 사용할 수 없습니다.' };
    const result = await signInWithPasskeyLib();
    return { error: result.error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    authEventVersionRef.current += 1;
    fetchingForRef.current = null;
    setUser(null);
    setProfile(null);
    setProfileError(null);
    setPinLocked(false);
    setHasPin(false);
    setPinSetupNeeded(false);
    clearAllAuthStorage();
    await supabase.auth.signOut({ scope: 'local' }).catch(() => { /* already cleaned */ });

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
    const allRoles = profile.roles || [profile.role];
    return allRoles.some(r => ROLE_HIERARCHY[r] >= ROLE_HIERARCHY[minRole]);
  }, [profile]);

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
    Promise.resolve(
      supabase
        .from('club_teachers')
        .select('club')
        .eq('teacher_id', user.id)
    )
      .then(({ data }) => {
        if (data && data.length > 0) {
          setAssignedTeacherClub(data[0].club as string);
        } else {
          setAssignedTeacherClub(profile.assigned_teacher_id || null);
        }
      })
      .catch(() => {
        setAssignedTeacherClub(profile.assigned_teacher_id || null);
      });
  }, [profile, user]);

  useEffect(() => {
    if (!profile || !user) {
      setSecondaryClubs([]);
      return;
    }
    Promise.resolve(
      supabase
        .from('user_club_assignments')
        .select('club')
        .eq('user_id', user.id)
    )
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

  const updateEmail = useCallback(async (newEmail: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) return { error: error.message };
      return { error: null };
    } catch {
      return { error: '이메일 변경 중 오류가 발생했습니다.' };
    }
  }, []);

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

  const unlockWithPasskey = useCallback(async () => {
    if (!user || !isPasskeySupported()) return false;
    const result = await authenticateRegisteredPasskey();
    if (!result.error) {
      setPinLocked(false);
      setPinExplicitLock(user.id, false);
      markPinActivity(user.id);
      return true;
    }
    console.warn('[Auth] Passkey unlock failed:', result.error);
    return false;
  }, [user]);

  const lockApp = useCallback(() => {
    if (user && hasSimplePin(user.id)) {
      setPinLocked(true);
      setPinExplicitLock(user.id, true);
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileError, profileRetrying, retryProfile, signIn, signInWithPasskey, signUp, signOut, resetPassword, updatePassword, updateEmail, hasRole, assignedTeacherClub, secondaryClubs, pinLocked, hasPin, pinSetupNeeded, dismissPinSetupPrompt, setupPin, changePin, removePin, unlockWithPin, unlockWithPasskey, lockApp }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}