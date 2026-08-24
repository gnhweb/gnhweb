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
    && typeof navigator.credentials.get === 'function';
}

function toArrayBuffer(value: string | ArrayBuffer | Uint8Array): ArrayBuffer {
  if (typeof value === 'string') {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, char => char.charCodeAt(0)).buffer;
  }
  if (value instanceof ArrayBuffer) return value.slice(0);
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
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

function serializeAuthenticationCredential(credential: PublicKeyCredential): Record<string, unknown> {
  const withJson = credential as PublicKeyCredential & { toJSON?: () => unknown };
  if (typeof withJson.toJSON === 'function') return withJson.toJSON() as Record<string, unknown>;
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

function unsupportedError(): Error {
  return new Error('이 기기에서 지문/Face ID를 사용할 수 없습니다.');
}

/**
 * Uses the already-registered passkey credential IDs as allowCredentials.
 * This is the important part that skips the Google Password Manager / account
 * chooser and asks the platform authenticator directly for fingerprint/Face ID.
 */
export async function authenticateRegisteredPasskey(): Promise<PasskeyResult<unknown>> {
  if (!isPasskeySupported()) return { data: null, error: unsupportedError() };

  const auth = supabase.auth as typeof supabase.auth & {
    passkey: {
      startAuthentication: () => Promise<{ data: { challenge_id: string; options: any } | null; error: Error | null }>;
      verifyAuthentication: (params: { challengeId: string; credential: Record<string, unknown> }) => Promise<{ data: unknown | null; error: Error | null }>;
      list: () => Promise<{ data: PasskeyMeta[] | null; error: Error | null }>;
    };
  };

  const { data: passkeys, error: listError } = await auth.passkey.list();
  if (listError) return { data: null, error: listError };
  if (!passkeys || passkeys.length === 0) {
    return { data: null, error: new Error('이 기기에 등록된 지문/Face ID가 없습니다. 프로필에서 먼저 등록해주세요.') };
  }

  const { data: authentication, error: startError } = await auth.passkey.startAuthentication();
  if (startError || !authentication) {
    return { data: null, error: startError ?? new Error('생체인증 준비에 실패했습니다.') };
  }

  try {
    const publicKey = deserializeRequestOptions(authentication.options) as PublicKeyCredentialRequestOptions & { hints?: string[] };

    // Never leave allowCredentials empty here. An empty discoverable-credential
    // request is what produces the Google Password Manager account picker seen
    // before biometric authentication on Android.
    publicKey.allowCredentials = passkeys.map((passkey) => ({
      id: toArrayBuffer(passkey.id),
      type: 'public-key' as const,
      transports: ['internal'] as AuthenticatorTransport[],
    }));
    publicKey.hints = ['client-device'];
    publicKey.userVerification = 'required';

    const credential = await navigator.credentials.get({ publicKey });
    if (!(credential instanceof PublicKeyCredential)) {
      return { data: null, error: new Error('지문/Face ID 인증이 취소되었습니다.') };
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
