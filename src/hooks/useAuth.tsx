import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { hasSimplePin, isPinUnlockValid, markPinActivity, setPinExplicitLock } from '@/lib/pin';
import { clearAllAuthStorage } from '@/lib/authStorage';
import { isPasskeySupported, signInWithPasskey as signInWithPasskeyLib } from '@/lib/passkey';
import type { UserProfile, UserRole } from '@/types/auth';

// ...

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      refreshFailureHandledRef.current = false;
      let { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        const apiUrl = String(import.meta.env.VITE_CLOUDFLARE_API_URL || 'https://gnhweb-api.gemini19840314.workers.dev').trim();
        const anonKey = String(import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || '').trim();

        if (apiUrl && anonKey) {
          try {
            const migrationResponse = await fetch(`${apiUrl}/account-password-migration`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password, anonKey }),
            });

            if (migrationResponse.ok) {
              const retry = await supabase.auth.signInWithPassword({ email, password });
              data = retry.data;
              error = retry.error;
            }
          } catch (migrationError) {
            console.warn('[Auth] Legacy password migration unavailable:', migrationError);
          }
        }
      }

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
    } catch (e: unknown) {
      const errMsg = e instanceof Error && e.message === 'Failed to fetch'
        ? '서버 연결이 원활하지 않습니다. 네트워크를 확인하고 다시 시도해주세요.'
        : '로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      console.error('[Auth] signIn exception:', e);
      return { error: errMsg, user: null };
    }
  }, [fetchProfile]);
