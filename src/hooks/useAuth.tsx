import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createContext, useContext } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import type { UserRole, UserProfile } from '@/types/auth';
import { hasRole as hasRoleUtil, ROLE_HIERARCHY } from '@/types/auth';
import { useNavigate } from 'react-router-dom';
import {
  hasSimplePin, setSimplePin, verifySimplePin, clearSimplePin, isValidPinFormat,
  markPinActivity, setPinExplicitLock, isPinUnlockValid, setPinUnlockExpiration, clearPinUnlockSession, getAutoLogoutMinutes,
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
  // hasPin: 현재 로그인한 사용자가 "이 기기"에 간편 비밀번호를 설정해 두었는지 여부.
  // pinSetupNeeded: 로그인된 세션은 있지만 이 기기에 간편 비밀번호가 아직 없는 경우,
  // 앱을 새로 열 때(콜드 스타트) 설정을 안내하는 화면을 띄우기 위한 플래그.
  pinLocked: boolean;
  hasPin: boolean;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileRetrying, setProfileRetrying] = useState(false);
  const [pinLocked, setPinLocked] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [pinSetupNeeded, setPinSetupNeeded] = useState(false);
  const fetchingForRef = useRef<string | null>(null);
  const realtimeSubRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const refreshFailureHandledRef = useRef(false);
  const authEventVersionRef = useRef(0);
  const pinPromptDismissedRef = useRef(false);
  const navigate = useNavigate();

  const fetchProfile = useCallback(async (currentUser: User) => {
    if (fetchingForRef.current === currentUser.id) return;
    fetchingForRef.current = currentUser.id;
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setProfile(data as UserProfile);
        setProfileError(null);
      } else {
        setProfile(null);
        setProfileError(null);
      }
    } catch (e: any) {
      console.error('[Auth] fetchProfile:', e);
      setProfileError(e?.message ?? '프로필을 불러오지 못했습니다.');
    } finally {
      fetchingForRef.current = null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;
        if (error) throw error;
        const currentUser = data.session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          await fetchProfile(currentUser);
        }
      } catch (e) {
        console.error('[Auth] bootstrap:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void bootstrap();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      authEventVersionRef.current += 1;
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        void fetchProfile(currentUser);
      } else {
        setProfile(null);
        setProfileError(null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  useEffect(() => {
    if (!user) {
      setHasPin(false);
      setPinLocked(false);
      setPinSetupNeeded(false);
      return;
    }
    const has = hasSimplePin(user.id);
    setHasPin(has);
    setPinLocked(has && !isPinUnlockValid(user.id));
    setPinSetupNeeded(!has && !pinPromptDismissedRef.current);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`auth-profile-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_roles',
          filter: `user_id=eq.${user.id}`,
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
          table: 'user_club_assignments',
          filter: `user_id=eq.${user.id}`,
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
        // Neon Auth/Better Auth reserves the `role` field. Keep the app's
        // business role in public.user_roles instead of sending it to Auth.
        data: { name, club: club || null, birth_year: birthYear || null, gender: gender || null, birth_month: birthMonth || null, birth_day: birthDay || null, interests: interests || null, grade: grade || null },
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
    if (user) clearPinUnlockSession(user.id);
    clearAllAuthStorage();
    await supabase.auth.signOut({ scope: 'local' }).catch(() => { /* already cleaned */ });

    try {
      navigate('/login');
    } catch {
      // navigation is best-effort during teardown
    }
  }, [navigate, user]);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error?.message ?? null };
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message ?? null };
  }, []);

  const updateEmail = useCallback(async (newEmail: string) => {
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    return { error: error?.message ?? null };
  }, []);

  const hasRole = useCallback((minRole: UserRole) => {
    return profile ? hasRoleUtil(profile.role, minRole, ROLE_HIERARCHY) : false;
  }, [profile]);

  const assignedTeacherClub = useMemo(() => {
    if (!profile) return null;
    return profile.role === 'teacher' ? profile.club ?? null : null;
  }, [profile]);

  const secondaryClubs = useMemo(() => {
    if (!profile) return [];
    return profile.secondary_clubs ?? [];
  }, [profile]);

  const dismissPinSetupPrompt = useCallback(() => {
    pinPromptDismissedRef.current = true;
    setPinSetupNeeded(false);
  }, []);

  const setupPin = useCallback(async (pin: string) => {
    if (!user) return { error: '로그인이 필요합니다.' };
    if (!isValidPinFormat(pin)) return { error: '간편 비밀번호는 숫자 4~6자리로 입력해주세요.' };
    setSimplePin(user.id, pin);
    setHasPin(true);
    setPinLocked(false);
    setPinSetupNeeded(false);
    setPinUnlockExpiration(user.id, getAutoLogoutMinutes());
    return { error: null };
  }, [user]);

  const changePin = useCallback(async (currentPin: string, newPin: string) => {
    if (!user) return { error: '로그인이 필요합니다.' };
    if (!verifySimplePin(user.id, currentPin)) return { error: '현재 간편 비밀번호가 올바르지 않습니다.' };
    if (!isValidPinFormat(newPin)) return { error: '간편 비밀번호는 숫자 4~6자리로 입력해주세요.' };
    setSimplePin(user.id, newPin);
    setHasPin(true);
    setPinLocked(false);
    setPinUnlockExpiration(user.id, getAutoLogoutMinutes());
    return { error: null };
  }, [user]);

  const removePin = useCallback(() => {
    if (!user) return;
    clearSimplePin(user.id);
    clearPinUnlockSession(user.id);
    setHasPin(false);
    setPinLocked(false);
  }, [user]);

  const unlockWithPin = useCallback(async (pin: string) => {
    if (!user || !verifySimplePin(user.id, pin)) return false;
    setPinLocked(false);
    markPinActivity(user.id);
    setPinUnlockExpiration(user.id, getAutoLogoutMinutes());
    return true;
  }, [user]);

  const unlockWithPasskey = useCallback(async () => {
    if (!user) return false;
    const result = await authenticateRegisteredPasskey();
    if (result.error) return false;
    setPinLocked(false);
    markPinActivity(user.id);
    setPinUnlockExpiration(user.id, getAutoLogoutMinutes());
    return true;
  }, [user]);

  const lockApp = useCallback(() => {
    if (!user || !hasSimplePin(user.id)) return;
    setPinLocked(true);
    setPinExplicitLock(user.id);
  }, [user]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    profile,
    loading,
    profileError,
    profileRetrying,
    retryProfile,
    signIn,
    signInWithPasskey,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    updateEmail,
    hasRole,
    assignedTeacherClub,
    secondaryClubs,
    pinLocked,
    hasPin,
    pinSetupNeeded,
    dismissPinSetupPrompt,
    setupPin,
    changePin,
    removePin,
    unlockWithPin,
    unlockWithPasskey,
    lockApp,
  }), [
    user,
    profile,
    loading,
    profileError,
    profileRetrying,
    retryProfile,
    signIn,
    signInWithPasskey,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    updateEmail,
    hasRole,
    assignedTeacherClub,
    secondaryClubs,
    pinLocked,
    hasPin,
    pinSetupNeeded,
    dismissPinSetupPrompt,
    setupPin,
    changePin,
    removePin,
    unlockWithPin,
    unlockWithPasskey,
    lockApp,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
