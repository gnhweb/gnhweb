import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { getSimplePinLength } from '@/lib/simplePin';
import { isPasskeySupported, listPasskeys } from '@/lib/passkey';

const PASSKEY_TIMEOUT_MS = 12000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('PASSKEY_TIMEOUT')), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export default function AppLockScreen() {
  const { user, profile, unlockWithPin, unlockWithPasskey, signOut } = useAuth();
  const [pinLength] = useState(() => (user ? getSimplePinLength(user.id) : 4));
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [shake, setShake] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [passkeyChecking, setPasskeyChecking] = useState(false);
  const [hasRegisteredBiometric, setHasRegisteredBiometric] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const biometricAttemptedRef = useRef(false);

  useEffect(() => {
    // 모바일에서는 숨은 input에 자동 포커스를 주지 않는다.
    // iOS/Android가 키보드를 강제로 열면서 viewport를 축소하거나 잠금 화면이
    // 로딩 상태처럼 보이는 문제를 피하고, 화면의 PIN 버튼을 바로 사용할 수 있게 한다.
    const isTouchDevice = typeof window !== 'undefined'
      && window.matchMedia?.('(pointer: coarse)').matches;
    if (!isTouchDevice) inputRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    let mounted = true;

    const detectBiometric = async () => {
      if (!user || !isPasskeySupported() || biometricAttemptedRef.current) return;
      biometricAttemptedRef.current = true;

      try {
        // 등록된 생체 인증 여부만 확인한다.
        // 실제 인증 호출은 사용자 명시적 클릭으로만 실행한다.
        const { data } = await withTimeout(listPasskeys(), PASSKEY_TIMEOUT_MS);
        if (!mounted) return;
        setHasRegisteredBiometric(Array.isArray(data) && data.length > 0);
      } catch {
        if (!mounted) return;
        setHasRegisteredBiometric(false);
      }
    };

    void detectBiometric();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const handleDigit = (d: string) => {
    if (checking || passkeyChecking) return;
    setError('');
    setPin(prev => (prev.length < pinLength ? prev + d : prev));
  };

  const handleBackspace = () => {
    if (checking || passkeyChecking) return;
    setError('');
    setPin(prev => prev.slice(0, -1));
  };

  const handleSubmit = async () => {
    if (pin.length < 4 || checking || passkeyChecking) return;
    setChecking(true);
    setError('');
    try {
      const ok = await withTimeout(unlockWithPin(pin), 10000);
      if (!ok) {
        setError('비밀번호가 일치하지 않습니다');
        setShake(true);
        setPin('');
        setTimeout(() => setShake(false), 400);
      }
    } catch {
      setError('잠금 해제 확인이 지연되고 있습니다. 다시 시도해주세요.');
    } finally {
      setChecking(false);
    }
  };

  const onHiddenInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, pinLength);
    setPin(digitsOnly);
    setError('');
  };

  useEffect(() => {
    if (pin.length >= 4 && pin.length === pinLength) {
      void handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, pinLength]);

  const handleBiometricUnlock = async () => {
    if (passkeyChecking || checking || !hasRegisteredBiometric) return;
    setPasskeyChecking(true);
    setError('');
    try {
      const ok = await withTimeout(unlockWithPasskey(), PASSKEY_TIMEOUT_MS);
      if (!ok) {
        setError('지문/Face ID 인증에 실패했습니다. PIN을 입력해주세요.');
        setShake(true);
        setTimeout(() => setShake(false), 400);
      }
    } catch {
      setError('생체인증 응답이 없습니다. PIN으로 잠금을 해제해주세요.');
    } finally {
      setPasskeyChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background-50 flex items-center justify-center px-4 min-h-dvh">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xs text-center"
      >
        <div className="w-16 h-16 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center mx-auto mb-5">
          {profile?.profile_image ? (
            <img src={profile.profile_image} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            <i className="ri-lock-2-line text-2xl text-amber-600"></i>
          )}
        </div>

        <h1 className="text-lg font-bold text-foreground-950 mb-1">
          {profile?.name ? `${profile.name}님, 잠금 해제` : '잠금 해제'}
        </h1>
        <p className="text-sm text-foreground-500 mb-6">{user?.email}</p>

        <motion.div
          animate={shake ? { x: [0, -8, 8, -8, 8, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-center gap-2.5 mb-3"
        >
          {Array.from({ length: pinLength }).map((_, i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-full border-2 transition-colors ${
                i < pin.length ? 'bg-amber-500 border-amber-500' : 'border-background-300'
              }`}
            />
          ))}
        </motion.div>

        <input
          ref={inputRef}
          type="password"
          inputMode="none"
          autoComplete="off"
          aria-label="PIN 입력"
          data-gnh-pin-input="true"
          value={pin}
          onChange={onHiddenInputChange}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit(); }}
          className="absolute opacity-0 pointer-events-none w-px h-px"
          maxLength={pinLength}
        />

        <div className="min-h-5 mb-4">
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs text-rose-600"
              >
                {error}
              </motion.p>
            )}
            {passkeyChecking && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-foreground-400"
              >
                지문 / Face ID 확인 중...
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
            <button
              key={d}
              type="button"
              onClick={() => handleDigit(d)}
              disabled={passkeyChecking || checking}
              className="h-14 rounded-2xl bg-background-100 hover:bg-background-200 text-lg font-semibold text-foreground-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              {d}
            </button>
          ))}
          <div />
          <button
            type="button"
            onClick={() => handleDigit('0')}
            disabled={passkeyChecking || checking}
            className="h-14 rounded-2xl bg-background-100 hover:bg-background-200 text-lg font-semibold text-foreground-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            disabled={passkeyChecking || checking}
            className="h-14 rounded-2xl flex items-center justify-center text-foreground-500 hover:text-foreground-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            <i className="ri-arrow-left-line text-xl"></i>
          </button>
        </div>

        {checking && <p className="text-xs text-foreground-400 mb-3">확인 중...</p>}

        {hasRegisteredBiometric && !passkeyChecking && (
          <button
            type="button"
            onClick={() => void handleBiometricUnlock()}
            disabled={checking}
            aria-label="등록된 지문 / Face ID로 잠금 해제"
            title="등록된 지문 / Face ID로 잠금 해제"
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border-2 border-amber-500 bg-amber-900/90 text-amber-50 shadow-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer dark:bg-amber-950"
          >
            <i className="ri-fingerprint-line text-2xl"></i>
          </button>
        )}

        {!confirmingLogout ? (
          <button
            onClick={() => setConfirmingLogout(true)}
            className="text-sm text-foreground-500 hover:text-amber-600 transition-colors cursor-pointer"
          >
            비밀번호를 잊으셨나요?
          </button>
        ) : (
          <div className="bg-background-100 border border-background-200 rounded-xl p-3">
            <p className="text-xs text-foreground-600 mb-2">이메일과 비밀번호로 다시 로그인해주세요.</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setConfirmingLogout(false)}
                className="px-3 py-1.5 rounded-full text-xs text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
              >
                취소
              </button>
              <button
                onClick={() => void signOut()}
                className="px-3 py-1.5 rounded-full bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 cursor-pointer"
              >
                이메일로 로그인하기
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
