// 간편 비밀번호(PIN) 로컬 저장 유틸
//
// 실제 로그인 인증은 여전히 Supabase 세션(이메일/비밀번호로 발급된 refresh token)이
// 담당한다. 이 PIN은 "이미 로그인되어 있는 이 기기"에서 텔레그램/토스처럼 빠르게
// 잠금을 풀기 위한 용도로, 기기(브라우저)의 localStorage에 사용자별로 저장된다.
// 따라서 PIN은 기기마다 별도로 설정해야 하며, 다른 기기/브라우저에서는 처음엔
// 이메일+비밀번호로 로그인해야 한다.

const SALT = 'gangneung-sc-pin-v1';

async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function pinKey(userId: string): string {
  return `simple_pin_hash_${userId}`;
}

// 사용자가 실제로 설정한 PIN 자릿수(4~6). 잠금 화면의 원(dot) 개수를 여기에 맞춘다.
function pinLenKey(userId: string): string {
  return `simple_pin_len_${userId}`;
}

// 마지막으로 "잠금이 풀린 채 활동한" 시각. 새로고침 시 이 시각과 자동 로그아웃
// 설정 시간을 비교해, 아직 타임아웃 전이면 PIN을 다시 묻지 않는다.
function lastActiveKey(userId: string): string {
  return `simple_pin_last_active_${userId}`;
}

// 명시적으로 잠긴 상태(자동 로그아웃 타임아웃 발생 등)인지 여부.
// true인 동안은 언제 새로고침해도 반드시 PIN을 다시 입력해야 한다.
function lockedFlagKey(userId: string): string {
  return `simple_pin_locked_${userId}`;
}

async function hashPin(userId: string, pin: string): Promise<string> {
  return sha256Hex(`${SALT}:${userId}:${pin}`);
}

export function isValidPinFormat(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

export function hasSimplePin(userId: string): boolean {
  try {
    return !!localStorage.getItem(pinKey(userId));
  } catch {
    return false;
  }
}

// 이 기기에 저장된 PIN의 실제 자릿수(4~6). 저장된 값이 없으면 4자리로 간주.
export function getSimplePinLength(userId: string): number {
  try {
    const n = parseInt(localStorage.getItem(pinLenKey(userId)) || '', 10);
    return n >= 4 && n <= 6 ? n : 4;
  } catch {
    return 4;
  }
}

export async function setSimplePin(userId: string, pin: string): Promise<void> {
  const hash = await hashPin(userId, pin);
  try {
    localStorage.setItem(pinKey(userId), hash);
    localStorage.setItem(pinLenKey(userId), String(pin.length));
  } catch {
    /* localStorage 저장 실패는 무시 (다음 로그인 때 다시 이메일 로그인) */
  }
}

export async function verifySimplePin(userId: string, pin: string): Promise<boolean> {
  try {
    const stored = localStorage.getItem(pinKey(userId));
    if (!stored) return false;
    const hash = await hashPin(userId, pin);
    return stored === hash;
  } catch {
    return false;
  }
}

export function clearSimplePin(userId: string): void {
  try {
    localStorage.removeItem(pinKey(userId));
    localStorage.removeItem(pinLenKey(userId));
    localStorage.removeItem(lastActiveKey(userId));
    localStorage.removeItem(lockedFlagKey(userId));
  } catch {
    /* ignore */
  }
}

// ──── 잠금 상태 지속(새로고침 대응) ────
//
// 문제: 새로고침할 때마다 무조건 PIN 화면을 띄우면, 이미 들어와서 쓰고 있던
// 중에 새로고침만 해도 매번 PIN을 입력해야 하는 불편함이 생긴다.
// 원하는 동작: "자동 로그아웃 타임아웃이 지나서 실제로 잠긴 경우"에만 PIN을
// 다시 묻고, 세션이 아직 활성(타임아웃 전)인 동안의 새로고침은 그냥 통과시킨다.
//
// 이를 위해 (1) 마지막 활동 시각과 (2) "명시적으로 잠긴 상태" 플래그를
// localStorage에 남겨, 새로고침 직후에도 실제로 잠글지 말지 판단할 수 있게 한다.

export function markPinActivity(userId: string): void {
  try {
    localStorage.setItem(lastActiveKey(userId), String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function getPinLastActive(userId: string): number {
  try {
    const v = localStorage.getItem(lastActiveKey(userId));
    return v ? parseInt(v, 10) : 0;
  } catch {
    return 0;
  }
}

export function setPinExplicitLock(userId: string, locked: boolean): void {
  try {
    if (locked) {
      localStorage.setItem(lockedFlagKey(userId), 'true');
    } else {
      localStorage.removeItem(lockedFlagKey(userId));
    }
  } catch {
    /* ignore */
  }
}

export function isPinExplicitlyLocked(userId: string): boolean {
  try {
    return localStorage.getItem(lockedFlagKey(userId)) === 'true';
  } catch {
    return false;
  }
}

// 자동 로그아웃(잠금) 타임아웃 분(分) 설정 — useAutoLogout과 동일한 저장소 키를
// 공유한다. useAutoLogout은 훅(useAuth)에 의존하므로, 순환 참조 없이 양쪽에서
// 같은 값을 읽을 수 있도록 의존성 없는 이 파일에 둔다.
export const AUTO_LOGOUT_STORAGE_KEY = 'auto_logout_timeout_minutes';
export const DEFAULT_AUTO_LOGOUT_MINUTES = 30;

export function getAutoLogoutMinutes(userId: string): number {
  try {
    const saved = localStorage.getItem(`${AUTO_LOGOUT_STORAGE_KEY}_${userId}`);
    if (saved) {
      const n = parseInt(saved, 10);
      if (!isNaN(n)) return n;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_AUTO_LOGOUT_MINUTES;
}

// ──── 자동 로그아웃 시간 변경을 "지금 실행 중인" 타이머에 즉시 반영 ────
//
// 버그: 설정(프로필) 페이지에서 자동 로그아웃 시간을 바꾸면 localStorage/DB에는
// 바로 저장되지만, 실제로 카운트다운 중인 useAutoLogout의 타이머(다른 컴포넌트
// 트리에 떠 있는 별도의 훅 인스턴스)는 이 변경을 몰라서 예전 시간 기준으로
// 계속 돌아간다. 그 결과 "시간을 바꿨는데 그 시간이 지나도 안 잠긴다"는
// 문제가 생긴다. 이를 막기 위해 값을 저장하는 쪽에서 아래 이벤트를 쏘고,
// useAutoLogout이 이 이벤트를 구독해 실행 중인 타이머를 즉시 새 시간으로
// 다시 설정한다.
export const AUTO_LOGOUT_CHANGE_EVENT = 'auto-logout-minutes-changed';

export function notifyAutoLogoutMinutesChanged(userId: string, minutes: number): void {
  try {
    window.dispatchEvent(
      new CustomEvent(AUTO_LOGOUT_CHANGE_EVENT, { detail: { userId, minutes } })
    );
  } catch {
    /* ignore (예: 브라우저 환경이 아닌 경우) */
  }
}