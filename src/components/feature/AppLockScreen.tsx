import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { getSimplePinLength } from '@/lib/simplePin';
import { isPasskeySupported, listPasskeys } from '@/lib/passkey';

export default function AppLockScreen() {
  const { user, profile, unlockWithPin, unlockWithPasskey, signOut } = useAuth();
  // 이 기기에 실제로 저장된 PIN 자릿수(4~6)에 맞춰 원(dot) 개수를 표시한다.
  // 4자리로 설정한 사용자에게 항상 6개의 원을 보여주던 문제를 해결.
  const [pinLength] = useState(() => (user ? getSimplePinLength(user.id) : 4));
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [shake, setShake] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [passkeyChecking, setPasskeyChecking] = useState(false);
  const [passkeysLoaded, setPasskeysLoaded] = useState(false);
  const [hasRegisteredPasskey, setHasRegisteredPasskey] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const isTouchDevice = typeof window !== 'undefined'
      && window.matchMedia?.('(pointer: coarse)').matches;
    if (!isTouchDevice) inputRef.current?.focus({ preventScroll: true });
  }, []);

  // 잠금 화면에서는 이미 등록된 패스키가 있을 때만 '생체인증으로 잠금 해제'를 보여준다.
  // 아직 등록하지 않은 사용자가 인증을 시도해 '생체인증 확인 실패'가 뜨는 혼란을 막는다.
  useEffect(() => {
    let cancelled = false;
    const loadRegisteredPasskey = async () => {
      if (!isPasskeySupported() || !user) {
        if (!cancelled) setPasskeysLoaded(true);
        return;
      }
      const { data } = await listPasskeys();
      if (!cancelled) {
        setHasRegisteredPasskey(Boolean(data?.length));
        setPasskeysLoaded(true);
      }
    };
    loadRegisteredPasskey();
    return () => { cancelled = true; };
  }, [user]);

  const handleDigit = (d: string) => {
    if (checking) return;
    setError('');
    setPin(prev => (prev.length < pinLength ? prev + d : prev));
  };

  const handleBackspace = () => {
    if (checking) return;
    setError('');
    setPin(prev => prev.slice(0, -1));
  };

  const handleSubmit = async () => {
    if (pin.length < 4 || checking) return;
    setChecking(true);
    setError('');
    const ok = await unlockWithPin(pin);
    if (!ok) {
      setError('비밀번호가 일치하지 않습니다');
      setShake(true);
      setPin('');
      setTimeout(() => setShake(false), 400);
    }
    setChecking(false);
  };

  // 물리 키보드 입력(엔터 제출 포함)을 위한 핸들러. 모바일에서는 화면 키패드
  // 버튼만 쓰도록 하고, 이 input에는 시스템 가상 키보드가 뜨지 않게 한다
  // (아래 inputMode="none" 참고) — 화면 키패드와 시스템 키패드가 동시에
  // 뜨던 문제를 해결.
  const onHiddenInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, pinLength);
    setPin(digitsOnly);
    setError('');
  };

  useEffect(() => {
    if (pin.length >= 4 && pin.length === pinLength) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, pinLength]);

  return (
    <div className="fixed inset-0 z-[100] bg-background-50 flex items-center justify-center px-4">
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
        <p className="text-sm text-foreground-500 mb-6">
          {user?.email}
        </p>

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
            ></div>
          ))}
        </motion.div>

        {/*
          물리 키보드로 입력하는 경우를 위해 숨겨진 input을 하나 유지하되,
          inputMode="none"으로 모바일 시스템 숫자 키패드는 절대 뜨지 않게 한다.
          화면에 이미 전용 숫자 키패드가 있으므로, 시스템 키패드까지 함께 뜨면
          입력창이 두 개(숫자 버튼 + 시스템 키패드)로 보이는 문제가 생긴다.
        */}
        <input
          ref={inputRef}
          type="password"
          inputMode="none"
          autoComplete="off"
          aria-label="PIN 입력"
          data-gnh-pin-input="true"
          value={pin}
          onChange={onHiddenInputChange}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          className="absolute opacity-0 pointer-events-none w-px h-px"
          maxLength={pinLength}
        />

        <div className="h-5 mb-4">
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
          </AnimatePresence>
        </div>

        {/* 숫자 키패드 — 화면 버튼으로만 입력받는다(시스템 키패드는 뜨지 않음) */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
            <button
              key={d}
              type="button"
              onClick={() => handleDigit(d)}
              className="h-14 rounded-2xl bg-background-100 hover:bg-background-200 text-lg font-semibold text-foreground-800 transition-colors cursor-pointer"
            >
              {d}
            </button>
          ))}
          <div />
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-14 rounded-2xl bg-background-100 hover:bg-background-200 text-lg font-semibold text-foreground-800 transition-colors cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-14 rounded-2xl flex items-center justify-center text-foreground-500 hover:text-foreground-800 transition-colors cursor-pointer"
          >
            <i className="ri-arrow-left-line text-xl"></i>
          </button>
        </div>

        {checking && (
          <p className="text-xs text-foreground-400 mb-3">확인 중...</p>
        )}

        {isPasskeySupported() && passkeysLoaded && hasRegisteredPasskey && (
          <button
            type="button"
            onClick={async () => {
              if (passkeyChecking) return;
              setPasskeyChecking(true);
              setError('');
              const ok = await unlockWithPasskey();
              if (!ok) {
                setError('생체인증을 확인하지 못했습니다. 다시 시도하거나 PIN을 입력해주세요.');
              }
              setPasskeyChecking(false);
            }}
            disabled={passkeyChecking || checking}
            className="w-full mb-4 py-3 rounded-xl bg-foreground-900 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            <span className="flex items-center justify-center gap-2">
              <i className="ri-fingerprint-line text-lg"></i>
              {passkeyChecking ? '생체인증 확인 중...' : '이 기기 지문 / Face ID로 잠금 해제'}
            </span>
          </button>
        )}

        {isPasskeySupported() && passkeysLoaded && !hasRegisteredPasskey && (
          <div className="mb-4 rounded-xl border border-background-200 bg-background-100 px-4 py-3 text-center">
            <p className="text-xs text-foreground-600 leading-5">
              아직 이 기기에 지문/Face ID가 등록되지 않았습니다.
              <br />
              <span className="text-foreground-500">PIN으로 잠금 해제한 뒤 프로필에서 등록해주세요.</span>
            </p>
          </div>
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
            <p className="text-xs text-foreground-600 mb-2">
              이메일과 비밀번호로 다시 로그인해주세요.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setConfirmingLogout(false)}
                className="px-3 py-1.5 rounded-full text-xs text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
              >
                취소
              </button>
              <button
                onClick={() => signOut()}
                className="px-3 py-1.5 rounded-full bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 cursor-pointer whitespace-nowrap"
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
