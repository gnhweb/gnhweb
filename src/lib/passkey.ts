/**
 * Device biometric authentication through WebAuthn passkeys.
 *
 * The site never receives or stores fingerprint/Face ID data. The browser/device
 * platform authenticator performs biometric verification and only returns a
 * signed WebAuthn credential to Supabase Auth.
 */
import { supabase } from '@/lib/supabase';

type PasskeyMeta = {
  id: string;
  friendly_name?: string;
  created_at: string;
  last_used_at?: string;
};

type PasskeyResult<T> = { data: T | null; error: Error | null };

export function isPasskeySupported(): boolean {
  return typeof window !== 'undefined'
    && window.isSecureContext
    && typeof window.PublicKeyCredential !== 'undefined'
    && typeof navigator.credentials !== 'undefined'
    && typeof navigator.credentials.create === 'function'
    && typeof navigator.credentials.get === 'function';
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function toArrayBuffer(value: string | ArrayBuffer | Uint8Array): ArrayBuffer {
  if (typeof value === 'string') return base64UrlToBytes(value).buffer.slice(0);
  if (value instanceof ArrayBuffer) return value.slice(0);
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
}

function deserializeCreationOptions(raw: any): PublicKeyCredentialCreationOptions {
  const publicKey = raw?.publicKey ?? raw;
  const options: PublicKeyCredentialCreationOptions = {
    ...publicKey,
    challenge: toArrayBuffer(publicKey.challenge),
    user: {
      ...publicKey.user,
      id: toArrayBuffer(publicKey.user.id),
    },
    excludeCredentials: Array.isArray(publicKey.excludeCredentials)
      ? publicKey.excludeCredentials.map((item: any) => ({
          ...item,
          id: toArrayBuffer(item.id),
        }))
      : undefined,
  };
  return options;
}

function deserializeRequestOptions(raw: any): PublicKeyCredentialRequestOptions {
  const publicKey = raw?.publicKey ?? raw;
  return {
    ...publicKey,
    challenge: toArrayBuffer(publicKey.challenge),
    allowCredentials: Array.isArray(publicKey.allowCredentials)
      ? publicKey.allowCredentials.map((item: any) => ({
          ...item,
          id: toArrayBuffer(item.id),
        }))
      : undefined,
  };
}

function arrayBufferToBase64Url(buffer: ArrayBuffer | ArrayBufferView | null | undefined): string | null {
  if (buffer == null) return null;
  const bytes = buffer instanceof ArrayBuffer
    ? new Uint8Array(buffer)
    : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function serializeRegistrationCredential(credential: PublicKeyCredential): Record<string, unknown> {
  const withJson = credential as PublicKeyCredential & { toJSON?: () => unknown };
  if (typeof withJson.toJSON === 'function') {
    return withJson.toJSON() as Record<string, unknown>;
  }
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: arrayBufferToBase64Url(credential.rawId),
    response: {
      attestationObject: arrayBufferToBase64Url(response.attestationObject),
      clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
    },
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
  };
}

function serializeAuthenticationCredential(credential: PublicKeyCredential): Record<string, unknown> {
  const withJson = credential as PublicKeyCredential & { toJSON?: () => unknown };
  if (typeof withJson.toJSON === 'function') {
    return withJson.toJSON() as Record<string, unknown>;
  }
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: arrayBufferToBase64Url(credential.rawId),
    response: {
      authenticatorData: arrayBufferToBase64Url(response.authenticatorData),
      clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
      signature: arrayBufferToBase64Url(response.signature),
      userHandle: arrayBufferToBase64Url(response.userHandle),
    },
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
  };
}

function biometricUnavailableError(): Error {
  return new Error('이 기기에서 지문/Face ID를 사용할 수 없습니다. 기기 생체인증과 HTTPS를 확인해주세요.');
}

/**
 * Register a device-bound platform passkey. This explicitly asks the browser
 * for the device authenticator (fingerprint / Face ID / Windows Hello) rather
 * than a cross-device security key or another-device flow.
 */
export async function registerPasskey(friendlyName?: string): Promise<PasskeyResult<PasskeyMeta>> {
  if (!isPasskeySupported()) return { data: null, error: biometricUnavailableError() };

  const auth = supabase.auth as typeof supabase.auth & {
    passkey: {
      startRegistration: () => Promise<{ data: { challenge_id: string; options: any } | null; error: Error | null }>;
      verifyRegistration: (params: { challengeId: string; credential: Record<string, unknown> }) => Promise<{ data: PasskeyMeta | null; error: Error | null }>;
    };
  };

  const { data: registration, error: startError } = await auth.passkey.startRegistration();
  if (startError || !registration) return { data: null, error: startError ?? new Error('생체인증 등록 준비에 실패했습니다.') };

  try {
    const publicKey = deserializeCreationOptions(registration.options);
    (publicKey as PublicKeyCredentialCreationOptions & { hints?: string[] }).hints = ['client-device'];
    publicKey.authenticatorSelection = {
      ...(publicKey.authenticatorSelection ?? {}),
      authenticatorAttachment: 'platform',
      residentKey: 'required',
      requireResidentKey: true,
      userVerification: 'required',
    };

    const credential = await navigator.credentials.create({ publicKey });
    if (!(credential instanceof PublicKeyCredential)) {
      return { data: null, error: new Error('기기 생체인증 등록이 취소되었거나 지원되지 않습니다.') };
    }

    const { data, error } = await auth.passkey.verifyRegistration({
      challengeId: registration.challenge_id,
      credential: serializeRegistrationCredential(credential),
    });

    return { data, error };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error('지문/Face ID 등록 중 오류가 발생했습니다.'),
    };
  }
}

/**
 * Authenticate with a previously registered platform passkey. The platform
 * must perform user verification (normally fingerprint / Face ID; a device
 * PIN/passcode may be used as the OS fallback when the device requires it).
 */
export async function signInWithPasskey(): Promise<PasskeyResult<{ session: unknown; user: unknown }>> {
  if (!isPasskeySupported()) return { data: null, error: biometricUnavailableError() };

  const auth = supabase.auth as typeof supabase.auth & {
    passkey: {
      startAuthentication: () => Promise<{ data: { challenge_id: string; options: any } | null; error: Error | null }>;
      verifyAuthentication: (params: { challengeId: string; credential: Record<string, unknown> }) => Promise<{ data: { session: unknown; user: unknown } | null; error: Error | null }>;
    };
  };

  const { data: authentication, error: startError } = await auth.passkey.startAuthentication();
  if (startError || !authentication) return { data: null, error: startError ?? new Error('생체인증 준비에 실패했습니다.') };

  try {
    const publicKey = deserializeRequestOptions(authentication.options) as PublicKeyCredentialRequestOptions & { hints?: string[] };
    publicKey.hints = ['client-device'];
    publicKey.userVerification = 'required';

    const credential = await navigator.credentials.get({ publicKey });
    if (!(credential instanceof PublicKeyCredential)) {
      return { data: null, error: new Error('지문/Face ID 인증이 취소되었거나 지원되지 않습니다.') };
    }

    return await auth.passkey.verifyAuthentication({
      challengeId: authentication.challenge_id,
      credential: serializeAuthenticationCredential(credential),
    });
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error('지문/Face ID 인증 중 오류가 발생했습니다.'),
    };
  }
}

export async function listPasskeys(): Promise<PasskeyResult<PasskeyMeta[]>> {
  const auth = supabase.auth as typeof supabase.auth & {
    passkey: { list: () => Promise<{ data: PasskeyMeta[] | null; error: Error | null }> };
  };
  return auth.passkey.list();
}

export async function deletePasskey(passkeyId: string) {
  const auth = supabase.auth as typeof supabase.auth & {
    passkey: { delete: (options: { passkeyId: string }) => Promise<{ error: Error | null }> };
  };
  return auth.passkey.delete({ passkeyId });
}
