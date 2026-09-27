import {
  browserSupportsWebAuthn,
  WebAuthnError,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import { getNeonJwtToken } from '@/lib/supabase';

const CLOUDFLARE_API = import.meta.env.VITE_CLOUDFLARE_API_URL || 'https://gnhweb-api.gemini19840314.workers.dev';

const PASSKEY_ENABLED_STORAGE_KEY = 'gnhweb.passkey.enabled';

const unavailableError = () => new Error('현재 생체인식 기능을 사용할 수 없습니다. 이메일과 비밀번호로 로그인한 뒤 프로필에서 생체인식을 등록해주세요.');

export function isPasskeyEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(PASSKEY_ENABLED_STORAGE_KEY) !== 'false';
}

export function setPasskeyEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PASSKEY_ENABLED_STORAGE_KEY, String(enabled));
}

export function isPasskeySupported(): boolean {
  return typeof window !== 'undefined'
    && window.isSecureContext
    && browserSupportsWebAuthn();
}

type PasskeyMeta = {
  id: string;
  friendly_name?: string;
  created_at: string;
  last_used_at?: string;
};

type PasskeyResult<T> = { data: T | null; error: Error | null };

async function invoke(action: string, method: 'GET' | 'POST' | 'DELETE', body?: unknown) {
  try {
    const jwt = await getNeonJwtToken();
    if (!jwt) return { data: null, error: new Error('로그인 세션이 없습니다. 다시 로그인해주세요.') };

    const url = new URL('/passkey', CLOUDFLARE_API);
    url.searchParams.set('action', action);

    const response = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
    });

    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      return {
        data: null,
        error: new Error(
          typeof (data as { error?: unknown })?.error === 'string'
            ? (data as { error: string }).error
            : `생체인증 서버 요청에 실패했습니다. (${response.status})`,
        ),
      };
    }

    return { data, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error('생체인증 서버 연결에 실패했습니다.'),
    };
  }
}

export async function registerPasskey(friendlyName?: string): Promise<PasskeyResult<PasskeyMeta>> {
  if (!isPasskeyEnabled()) return { data: null, error: unavailableError() };
  try {
    const optionsResponse = await invoke('register-options', 'POST');
    if (optionsResponse.error || !optionsResponse.data) {
      return { data: null, error: optionsResponse.error ?? new Error('생체인증 등록 준비에 실패했습니다.') };
    }

    const optionsJSON = optionsResponse.data as Partial<Parameters<typeof startRegistration>[0]['optionsJSON']>;
    if (
      typeof optionsJSON.challenge !== 'string' ||
      typeof optionsJSON.rp?.id !== 'string' ||
      typeof optionsJSON.user?.id !== 'string'
    ) {
      return {
        data: null,
        error: new Error('생체인증 등록 옵션이 올바르지 않습니다. 서버의 WebAuthn 설정을 확인해주세요.'),
      };
    }

    const credential = await startRegistration({
      optionsJSON: optionsJSON as Parameters<typeof startRegistration>[0]['optionsJSON'],
    });

    const verificationResponse = await invoke('register-verify', 'POST', {
      credential,
      friendlyName,
    });
    if (verificationResponse.error || !verificationResponse.data) {
      return { data: null, error: verificationResponse.error ?? new Error('생체인증 등록 확인에 실패했습니다.') };
    }

    const data = verificationResponse.data as { passkey?: PasskeyMeta };
    return { data: data.passkey ?? null, error: data.passkey ? null : new Error('생체인증 등록 결과가 올바르지 않습니다.') };
  } catch (error) {
    if (error instanceof WebAuthnError) {
      const causeMessage = error.cause instanceof Error ? error.cause.message : '';
      const detail = causeMessage ? ` (${causeMessage})` : '';
      return { data: null, error: new Error(`${error.message}${detail}`) };
    }
    return { data: null, error: error instanceof Error ? error : new Error('생체인증 등록 중 오류가 발생했습니다.') };
  }
}

export async function authenticateRegisteredPasskey(): Promise<PasskeyResult<{ verified: boolean }>> {
  if (!isPasskeyEnabled()) return { data: null, error: unavailableError() };
  if (!isPasskeySupported()) return { data: null, error: new Error('이 기기에서 생체인증을 사용할 수 없습니다.') };

  try {
    const optionsResponse = await invoke('auth-options', 'POST');
    if (optionsResponse.error || !optionsResponse.data) {
      return { data: null, error: optionsResponse.error ?? new Error('생체인증 준비에 실패했습니다.') };
    }

    const credential = await startAuthentication({
      optionsJSON: optionsResponse.data as Parameters<typeof startAuthentication>[0]['optionsJSON'],
    });

    const verificationResponse = await invoke('auth-verify', 'POST', { credential });
    if (verificationResponse.error || !verificationResponse.data) {
      return { data: null, error: verificationResponse.error ?? new Error('생체인증 확인에 실패했습니다.') };
    }

    const data = verificationResponse.data as { verified?: boolean };
    return { data: { verified: data.verified === true }, error: data.verified === true ? null : new Error('생체인증에 실패했습니다.') };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error('생체인증 중 오류가 발생했습니다.') };
  }
}

export async function signInWithPasskey(): Promise<PasskeyResult<null>> {
  return {
    data: null,
    error: new Error('생체인식 로그인은 현재 지원하지 않습니다. 로그인 후 앱 잠금 해제에 생체인식을 사용할 수 있습니다.'),
  };
}

export async function listPasskeys(): Promise<PasskeyResult<PasskeyMeta[]>> {
  try {
    const response = await invoke('list', 'GET');
    if (response.error || !response.data) {
      return { data: null, error: response.error ?? new Error('등록된 생체인식을 불러오지 못했습니다.') };
    }
    const data = response.data as { passkeys?: PasskeyMeta[] };
    return { data: data.passkeys ?? [], error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error('등록된 생체인식을 불러오지 못했습니다.') };
  }
}

export async function deletePasskey(passkeyId: string): Promise<{ error: Error | null }> {
  try {
    const response = await invoke('delete', 'DELETE', { id: passkeyId });
    return { error: response.error };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error('생체인식 삭제 중 오류가 발생했습니다.') };
  }
}
