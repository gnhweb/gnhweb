import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { getSimplePinLength } from '@/lib/simplePin';
import { isPasskeySupported, listPasskeys } from '@/lib/passkey';

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
  const [biometricAttempted, setBiometricAttempted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const biometricStartedRef = useRef(false);

  useEffect(() => {
    const isTouchDevice = typeof window !== 'undefined'
      && window.matchMedia?.('(pointer: coarse)').matches;
    if (!isTouchDevice) inputRef.current?.focus({ preventScroll: true });
  }, []);

  // 앱/PWA가 잠금 화면으로 열리면, 실제로 등록된 패스키가 있는 경우
  // 사용자가 지문 아이콘을 누르지 않아도 즉시 플랫폼 생체인증을 시작한다.
  // 등록된 패스키가 없거나 자동 인증에 실패한 경우에는 PIN을 사용할 수 있다.
  useEffect(() => {
    let mounted = true;

    const startBiometricOnEntry = async () => {
      if (!user || !isPasskeySupported() || biometricStartedRef.current) return;
      biometricStartedRef.current = true;

      const { data } = await listPasskeys();
      if (!mounted) return;

      const registered = Array.isArray(data) && data.length > 0;
      setHasRegisteredBiometric(registered);
      if (!registered) {
        setBiometricAttempted(true);
        return;
      }

      setPasskeyChecking(true);
      setError('');
      // 다음 렌더링 직후 호출하여 PWA 진입 직후 Android 플랫폼 인증기가
      // 생체인증 UI를 표시할 수 있도록 한다.
      await new Promise<void>(resolve => setTimeout(resolve, 80));
      if (!mounted) return;

      const ok = await unlockWithPasskey();
      if (!mounted) return;

      setPasskeyChecking(false);
      setBiometricAttempted(true);
      if (!ok) {
        setError('지문/Face ID 인증에 실패했습니다. PIN으로 잠금을 해제할 수 있습니다.');
        setShake(true);
        setTimeout(() => setShake(false), 400);
      }
    };

    startBiometricOnEntry().catch(() => {
      if (!mounted) return;
      setPasskeyChecking(false);
      setBiometricAttempted(true);
      setError('지문/Face ID 인증을 시작하지 못했습니다. PIN으로 잠금을 해제해주세요.');
    });

    return () => {
      mounted = false;
    };
  }, [user?.id, unlockWithPasskey]);

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
    const ok = await unlockWithPin(pin);
    if (!ok) {
      setError('비밀번호가 일치하지 않습니다');
      setShake(true);
      setPin('');
      setTimeout(() => setShake(false), 400);
    }
    setChecking(false);
  };

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

  const handleBiometricUnlock = async () => {
    if (passkeyChecking || checking || !hasRegisteredBiometric) return;
    setPasskeyChecking(true);
    setError('');
    const ok = await unlockWithPasskey();
    if (!ok) {
      setError('지문/Face ID 인증에 실패했습니다. 다시 시도하거나 PIN을 입력해주세요.');
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
    setPasskeyChecking(false);
  };

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
              disabled={passkeyChecking}
              className="h-14 rounded-2xl bg-background-100 hover:bg-background-200 text-lg font-semibold text-foreground-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              {d}
            </button>
          ))}
          <div />
          <button
            type="button"
            onClick={() => handleDigit('0')}
            disabled={passkeyChecking}
            className="h-14 rounded-2xl bg-background-100 hover:bg-background-200 text-lg font-semibold text-foreground-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            disabled={passkeyChecking}
            className="h-14 rounded-2xl flex items-center justify-center text-foreground-500 hover:text-foreground-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            <i className="ri-arrow-left-line text-xl"></i>
          </button>
        </div>

        {checking && (
          <p className="text-xs text-foreground-400 mb-3">확인 중...</p>
        )}

        {biometricAttempted && hasRegisteredBiometric && !passkeyChecking && error && (
          <button
            type="button"
            onClick={handleBiometricUnlock}
            disabled={checking || passkeyChecking}
            aria-label="등록된 지문 / Face ID로 다시 잠금 해제"
            title="등록된 지문 / Face ID로 다시 잠금 해제"
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
                onClick={() => signOut()}
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