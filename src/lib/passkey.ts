/**
 * Passkey / biometric helpers.
 *
 * A passkey does not store the user's fingerprint/face data in the website.
 * The browser/device authenticator keeps the private key and asks the user
 * for biometric verification (fingerprint, Face ID, Windows Hello, etc.).
 */
import { supabase } from '@/lib/supabase';

export function isPasskeySupported(): boolean {
  return typeof window !== 'undefined'
    && window.isSecureContext
    && typeof window.PublicKeyCredential !== 'undefined'
    && typeof navigator.credentials !== 'undefined';
}

export async function registerPasskey(friendlyName?: string) {
  if (!isPasskeySupported()) {
    return { data: null, error: new Error('이 기기나 브라우저에서는 생체인증을 사용할 수 없습니다. HTTPS 환경인지 확인해주세요.') };
  }
  const auth = supabase.auth as typeof supabase.auth & {
    registerPasskey: (options?: { friendlyName?: string }) => Promise<{ data: { id: string; friendly_name?: string } | null; error: Error | null }>;
  };
  return auth.registerPasskey(friendlyName ? { friendlyName } : undefined);
}

export async function signInWithPasskey() {
  if (!isPasskeySupported()) {
    return { data: null, error: new Error('이 기기나 브라우저에서는 생체인증을 사용할 수 없습니다. HTTPS 환경인지 확인해주세요.') };
  }
  const auth = supabase.auth as typeof supabase.auth & {
    signInWithPasskey: () => Promise<{ data: { session: unknown; user: unknown } | null; error: Error | null }>;
  };
  return auth.signInWithPasskey();
}

export async function listPasskeys() {
  const auth = supabase.auth as typeof supabase.auth & {
    passkey: { list: () => Promise<{ data: Array<{ id: string; friendly_name?: string; created_at: string; last_used_at?: string }> | null; error: Error | null }> };
  };
  return auth.passkey.list();
}

export async function deletePasskey(passkeyId: string) {
  const auth = supabase.auth as typeof supabase.auth & {
    passkey: { delete: (options: { passkeyId: string }) => Promise<{ error: Error | null }> };
  };
  return auth.passkey.delete({ passkeyId });
}
