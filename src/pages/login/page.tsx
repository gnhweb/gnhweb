import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { CLUB_LABELS } from '@/types/auth';
import type { UserRole, ClubType } from '@/types/auth';
import { hasSimplePin, setSimplePin, isValidPinFormat } from '@/lib/simplePin';
import { isPasskeySupported } from '@/lib/passkey';

type Mode = 'login' | 'signup';

const INTERESTS_LIST = ['악기', '운동', '독서', '그림', '코딩', '사진', '춤', '노래', '영화', '게임', '요리', '여행', '봉사', '글쓰기'];

const CLUB_OPTIONS: (ClubType | '')[] = ['', 'saeullim', 'cheonjipoong', 'cheonjihu', 'munhwabu'];

export default function Login() {
  const { user, signIn, signInWithPasskey, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<Mode>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState<number>(new Date().getFullYear() - 18);
  const [birthMonth, setBirthMonth] = useState<number>(0);
  const [birthDay, setBirthDay] = useState<number>(0);
  const [gender, setGender] = useState<string>('');
  const [club, setClub] = useState<ClubType | ''>('');
  const [grade, setGrade] = useState<string>('');
  const [signupInterests, setSignupInterests] = useState<string[]>([]);

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [passkeySubmitting, setPasskeySubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');

  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');

  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const from = (location.state as { from?: string })?.from || '/';

  // 로그인 직후 이 기기에 간편 비밀번호(PIN)가 아직 없으면, 다음부터 이메일 없이
  // PIN만으로 들어올 수 있도록 설정을 유도한다.
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinSetupUserId, setPinSetupUserId] = useState<string | null>(null);
  const [pinValue, setPinValue] = useState('');
  const [pinConfirmValue, setPinConfirmValue] = useState('');
  const [pinSetupError, setPinSetupError] = useState('');
  const [pinSetupSaving, setPinSetupSaving] = useState(false);

  useEffect(() => {
    if (user && !showPinSetup) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from, showPinSetup]);

  const finishPinSetup = () => {
    setShowPinSetup(false);
    setPinValue('');
    setPinConfirmValue('');
    setPinSetupError('');
    window.location.replace(new URL(from, window.location.origin).toString());
  };

  const handleSavePin = async () => {
    if (!pinSetupUserId) return;
    if (!isValidPinFormat(pinValue)) {
      setPinSetupError('숫자 4~6자리로 입력해주세요');
      return;
    }
    if (pinValue !== pinConfirmValue) {
      setPinSetupError('입력한 비밀번호가 서로 달라요');
      return;
    }
    setPinSetupSaving(true);
    await setSimplePin(pinSetupUserId, pinValue);
    setPinSetupSaving(false);
    finishPinSetup();
  };

  useEffect(() => {
    async function checkConnection() {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
          signal: controller.signal,
          headers: { apikey: import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY },
        });
        clearTimeout(t);
        if (res.ok || res.status === 401 || res.status === 403) {
          setConnectionStatus('ok');
        } else {
          setConnectionStatus('error');
        }
      } catch {
        setConnectionStatus('error');
      }
    }
    checkConnection();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!email.trim() || !password.trim()) {
      setError('이메일과 비밀번호를 모두 입력해주세요');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setError('이름을 입력해주세요');
      return;
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다');
      return;
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        const { error: err, user: signedInUser } = await signIn(email, password);
        if (signedInUser) {
          if (!hasSimplePin(signedInUser.id)) {
            setPinSetupUserId(signedInUser.id);
            setShowPinSetup(true);
          } else {
            // Supabase persists the new session asynchronously. A client-side
            // react-router navigation can race with the initial getSession()
            // bootstrap and briefly write the old (null) session back to AuthProvider.
            // A full document navigation gives the fresh session one authoritative
            // bootstrap path and removes that intermittent mobile redirect to /login.
            const target = new URL(from, window.location.origin);
            window.location.replace(target.toString());
          }
        } else {
          setError(err || '로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.');
        }
      } else {
        const defaultRole: UserRole = 'member';
        const { error: err } = await signUp(email, password, name, defaultRole, club || undefined, birthYear, gender || undefined, birthMonth || undefined, birthDay || undefined, signupInterests.length > 0 ? signupInterests.join(',') : undefined, grade || undefined);
        if (err) {
          setError(err);
        } else {
          setSuccessMsg('회원가입이 완료되었습니다! 이메일을 확인하여 계정을 인증한 후 로그인해주세요. 가입 후 부장님이 권한을 부여합니다.');
          setMode('login');
        }
      }
    } catch (e) {
      console.error('[Login] handleSubmit exception:', e);
      setError('예상치 못한 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
    setSuccessMsg('');
    setConfirmPassword('');
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!forgotEmail.trim()) {
      setError('이메일을 입력해주세요');
      return;
    }

    setSubmitting(true);
    try {
      const { error: err } = await resetPassword(forgotEmail);
      if (err) {
        setError(err);
      } else {
        setSuccessMsg('비밀번호 재설정 링크를 이메일로 발송했습니다. 이메일을 확인해주세요.');
        setForgotMode(false);
        setForgotEmail('');
      }
    } catch {
      setError('예상치 못한 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background-50 flex items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground-950 mb-1">
            {forgotMode ? '비밀번호 찾기' : mode === 'login' ? '로그인' : '회원가입'}
          </h1>
          <p className="text-sm text-foreground-500">
            강릉 학생회 운영 플랫폼
          </p>
        </div>

        <div className="bg-background-100 rounded-2xl border border-background-200 p-6 md:p-8">
          <div className="flex mb-6 bg-background-100 rounded-full p-1">
            <button
              onClick={() => { setMode('login'); setForgotMode(false); }}
              className={`flex-1 py-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap cursor-pointer ${
                mode === 'login' && !forgotMode
                  ? 'bg-background-100 text-foreground-950 shadow-sm'
                  : 'text-foreground-500 hover:text-foreground-800'
              }`}
            >
              로그인
            </button>
            <button
              onClick={() => { setMode('signup'); setForgotMode(false); }}
              className={`flex-1 py-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap cursor-pointer ${
                mode === 'signup' && !forgotMode
                  ? 'bg-background-100 text-foreground-950 shadow-sm'
                  : 'text-foreground-500 hover:text-foreground-800'
              }`}
            >
              회원가입
            </button>
          </div>

          {connectionStatus === 'error' && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm mb-5">
              <i className="ri-wifi-off-line flex-shrink-0 mt-0.5"></i>
              <div>
                <p className="font-medium">서버 연결이 원활하지 않습니다</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  모바일 브라우저 보안 설정이나 네트워크 환경에 따라 일부 기능이 제한될 수 있습니다.
                  Wi-Fi나 데이터 연결을 확인하고 다시 시도해주세요.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 text-rose-600 text-sm mb-5">
              <i className="ri-error-warning-line flex-shrink-0"></i>
              {error}
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm mb-5">
              <i className="ri-checkbox-circle-line flex-shrink-0"></i>
              {successMsg}
            </div>
          )}

          {forgotMode ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <p className="text-sm text-foreground-500 mb-3">
                가입하신 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다.
              </p>
              <div>
                <label className="block text-sm font-medium text-foreground-700 mb-1.5">이메일</label>
                <input
                  type="email"
                  name="email"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-background-200 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-primary-500 text-background-50 font-medium text-sm hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap mt-2"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    처리 중...
                  </span>
                ) : (
                  '재설정 링크 보내기'
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => { setForgotMode(false); setError(''); }}
                  className="text-sm text-foreground-500 hover:text-foreground-700 transition-colors cursor-pointer"
                >
                  <i className="ri-arrow-left-line mr-1"></i>
                  로그인으로 돌아가기
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground-700 mb-1.5">이메일</label>
              <input
                type="email"
                name="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full px-4 py-2.5 rounded-xl border border-background-200 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground-700 mb-1.5">비밀번호</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="6자 이상 입력"
                  className="w-full px-4 py-2.5 pr-10 rounded-xl border border-background-200 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400 hover:text-foreground-600 transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  <i className={`${showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-lg`}></i>
                </button>
              </div>
            </div>

            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground-700 mb-1.5">비밀번호 확인</label>
                  <input
                    type="password"
                    name="confirm_password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="비밀번호를 다시 입력하세요"
                    className="w-full px-4 py-2.5 rounded-xl border border-background-200 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground-700 mb-1.5">이름</label>
                  <input
                    type="text"
                    name="name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="실명을 입력해주세요"
                    className="w-full px-4 py-2.5 rounded-xl border border-background-200 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
                  />
                </div>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-sm text-amber-700">
                    <i className="ri-information-line mr-1"></i>
                    회원가입 시 <strong>일반 학생회원</strong>으로 가입됩니다. 부장님이 추후 권한을 부여합니다.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground-700 mb-1.5">성별</label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-sm text-foreground-700 cursor-pointer">
                      <input type="radio" name="gender" value="남" checked={gender === '남'} onChange={() => setGender('남')} />
                      남
                    </label>
                    <label className="flex items-center gap-1.5 text-sm text-foreground-700 cursor-pointer">
                      <input type="radio" name="gender" value="여" checked={gender === '여'} onChange={() => setGender('여')} />
                      여
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground-700 mb-1.5">생년월일 <span className="text-rose-500">*</span></label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      name="birth_year"
                      value={birthYear}
                      onChange={e => setBirthYear(parseInt(e.target.value) || new Date().getFullYear() - 18)}
                      min={1950}
                      max={new Date().getFullYear()}
                      placeholder="년도"
                      className="flex-1 px-3 py-2.5 rounded-xl border border-background-200 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
                    />
                    <select
                      name="birth_month"
                      value={birthMonth}
                      onChange={e => setBirthMonth(parseInt(e.target.value))}
                      className="flex-1 px-3 py-2.5 rounded-xl border border-background-200 text-sm bg-background-100 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all appearance-none cursor-pointer"
                    >
                      <option value={0}>월</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <option key={m} value={m}>{m}월</option>
                      ))}
                    </select>
                    <select
                      name="birth_day"
                      value={birthDay}
                      onChange={e => setBirthDay(parseInt(e.target.value))}
                      className="flex-1 px-3 py-2.5 rounded-xl border border-background-200 text-sm bg-background-100 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all appearance-none cursor-pointer"
                    >
                      <option value={0}>일</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d}>{d}일</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-foreground-500 mt-1">입력한 생년월일로 만 나이가 자동 계산됩니다</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground-700 mb-1.5">학년</label>
                  <select
                    name="grade"
                    value={grade}
                    onChange={e => setGrade(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-background-200 text-sm bg-background-100 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">선택하세요</option>
                    <option value="중1">중1</option>
                    <option value="중2">중2</option>
                    <option value="중3">중3</option>
                    <option value="고1">고1</option>
                    <option value="고2">고2</option>
                    <option value="고3">고3</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground-700 mb-1.5">소속 동아리</label>
                  <select
                    name="club"
                    value={club}
                    onChange={e => setClub(e.target.value as ClubType | '')}
                    className="w-full px-4 py-2.5 rounded-xl border border-background-200 text-sm bg-background-100 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">선택하세요</option>
                    {CLUB_OPTIONS.filter(Boolean).map((c) => (
                      <option key={c} value={c}>{CLUB_LABELS[c as ClubType]}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground-700 mb-1.5">관심사 (중복 선택 가능)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {INTERESTS_LIST.map(i => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSignupInterests(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${signupInterests.includes(i) ? 'bg-amber-500 text-white' : 'bg-background-200 text-foreground-600 hover:bg-amber-50'}`}
                      >
                        {i}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-foreground-500 mt-1">선택한 관심사로 같은 취미를 가진 친구들을 찾을 수 있어요</p>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-amber-500 text-white font-medium text-sm hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap mt-2"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  처리 중...
                </span>
              ) : mode === 'login' ? (
                '로그인'
              ) : (
                '회원가입'
              )}
            </button>
          </form>
          )}

          {mode === 'login' && !forgotMode && isPasskeySupported() && (
            <button
              type="button"
              onClick={async () => {
                setError('');
                setPasskeySubmitting(true);
                const { error: passkeyError } = await signInWithPasskey();
                setPasskeySubmitting(false);
                if (passkeyError) setError(passkeyError);
              }}
              disabled={submitting || passkeySubmitting}
              className="w-full mt-3 py-3 rounded-xl border border-background-300 bg-background-50 text-foreground-900 font-medium text-sm hover:bg-background-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <span className="flex items-center justify-center gap-2">
                <i className="ri-fingerprint-line text-lg text-amber-500"></i>
                {passkeySubmitting ? '생체인증 확인 중...' : '이 기기 지문 / Face ID로 로그인'}
              </span>
            </button>
          )}

          <div className="mt-6 pt-5 border-t border-background-200 text-center">
            {forgotMode ? (
              <p className="text-sm text-foreground-500">
                이메일을 받지 못하셨나요? 스팸함을 확인하거나 다시 시도해주세요.
              </p>
            ) : (
              <>
                {mode === 'login' && (
                  <p className="text-sm mb-2">
                    <button
                      onClick={() => { setForgotMode(true); setError(''); }}
                      className="text-foreground-500 hover:text-amber-600 transition-colors cursor-pointer"
                    >
                      비밀번호를 잊으셨나요?
                    </button>
                  </p>
                )}
                <p className="text-sm text-foreground-500">
                  {mode === 'login' ? '아직 계정이 없으신가요?' : '이미 계정이 있으신가요?'}
                  {' '}
                  <button
                    onClick={switchMode}
                    className="text-amber-600 hover:text-amber-700 font-medium cursor-pointer"
                  >
                    {mode === 'login' ? '회원가입' : '로그인'}
                  </button>
                </p>
              </>
            )}
          </div>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 text-sm text-foreground-500 hover:text-foreground-800 transition-colors cursor-pointer"
          >
            <i className="ri-arrow-left-line"></i>
            홈으로 돌아가기
          </button>
        </div>
      </motion.div>

      {showPinSetup && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-background-100 rounded-2xl p-6 max-w-sm w-full"
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <i className="ri-shield-keyhole-line text-2xl text-amber-600"></i>
            </div>
            <h3 className="text-lg font-bold text-center text-foreground-950 mb-1">간편 비밀번호 설정</h3>
            <p className="text-sm text-foreground-600 text-center mb-5">
              이 기기에서 다음부턴 이메일 없이<br />숫자 비밀번호만으로 빠르게 들어올 수 있어요
            </p>

            <div className="space-y-3 mb-2">
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinValue}
                onChange={e => { setPinValue(e.target.value.replace(/\D/g, '')); setPinSetupError(''); }}
                placeholder="숫자 4~6자리"
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none text-center tracking-[0.3em] focus:border-amber-400"
              />
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinConfirmValue}
                onChange={e => { setPinConfirmValue(e.target.value.replace(/\D/g, '')); setPinSetupError(''); }}
                placeholder="비밀번호 확인"
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none text-center tracking-[0.3em] focus:border-amber-400"
              />
            </div>

            {pinSetupError && (
              <p className="text-xs text-rose-600 text-center mb-3">{pinSetupError}</p>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={finishPinSetup}
                className="flex-1 py-2.5 rounded-full border border-gray-200 text-sm text-foreground-600 cursor-pointer whitespace-nowrap"
              >
                나중에 하기
              </button>
              <button
                onClick={handleSavePin}
                disabled={pinSetupSaving || !pinValue || !pinConfirmValue}
                className="flex-1 py-2.5 rounded-full bg-amber-500 text-white text-sm font-semibold disabled:opacity-40 cursor-pointer whitespace-nowrap"
              >
                {pinSetupSaving ? '저장 중...' : '설정하기'}
              </button>
            </div>

            <p className="text-xs text-foreground-400 text-center mt-4">
              프로필 설정에서 언제든 바꾸거나 해제할 수 있어요
            </p>
          </motion.div>
        </div>
      )}
    </div>
  );
}
