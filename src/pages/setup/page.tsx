import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

export default function Setup() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasChief, setHasChief] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        const { data } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'chief')
          .eq('is_active', true)
          .maybeSingle();

        if (data) {
          setHasChief(true);
        }
      } catch {
        // If check fails, allow access (might be network issue)
      } finally {
        setCheckingAccess(false);
      }
    }
    check();
  }, []);

  useEffect(() => {
    if (profile && profile.role === 'chief') {
      navigate('/admin/roles', { replace: true });
    }
  }, [profile, navigate]);

  useEffect(() => {
    if (!checkingAccess && hasChief && (!user || (profile && profile.role !== 'chief'))) {
      setAccessDenied(true);
    }
  }, [checkingAccess, hasChief, user, profile]);

  if (checkingAccess) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-accent-100 border border-accent-200 mb-5">
            <i className="ri-lock-line text-3xl text-accent-600"></i>
          </div>
          <h1 className="text-xl font-bold text-foreground-950 mb-3">접근할 수 없습니다</h1>
          <p className="text-sm text-foreground-600 mb-6">
            부장 계정이 이미 생성되어 있어 설정 페이지에 접근할 수 없습니다.
            <br />
            부장 계정이 필요하시면 기존 부장님께 문의해주세요.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2.5 rounded-[20px] bg-primary-500 text-background-50 text-sm font-medium hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            로그인 페이지로 이동
          </button>
        </motion.div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!email.trim() || !password.trim() || !name.trim()) {
      setError('모든 항목을 입력해주세요');
      return;
    }
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다');
      return;
    }
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다');
      return;
    }

    setSubmitting(true);

    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('setup-chief', {
        body: { email, password, name, gender: gender || null },
      });

      if (fnError) {
        setError(fnError.message || '계정 생성 중 오류가 발생했습니다');
        setSubmitting(false);
        return;
      }

      if (fnData?.error) {
        setError(fnData.error);
        setSubmitting(false);
        return;
      }

      setSuccessMsg(`${name} 부장님 계정이 성공적으로 생성되었습니다! 로그인 페이지에서 로그인해주세요.`);
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setName('');
      setGender('');

      setTimeout(() => {
        navigate('/login');
      }, 2500);
    } catch {
      setError('서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background-50 flex items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-primary-100 border border-primary-200 mb-5">
            <i className="ri-shield-user-line text-3xl text-primary-600"></i>
          </div>
          <h1 className="text-2xl font-bold text-foreground-950 mb-1">
            부장님 계정 생성
          </h1>
          <p className="text-sm text-foreground-600">
            강릉 학생회 운영 플랫폼 최초 설정
          </p>
        </div>

        <div className="bg-background-100 border border-background-200 rounded-[20px] p-6 md:p-8">
          {!hasChief && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-primary-100 border border-primary-200 mb-5">
              <i className="ri-information-line text-primary-600 mt-0.5 flex-shrink-0"></i>
              <p className="text-sm text-primary-700">
                부장 계정이 아직 생성되지 않았습니다. 부장님의 정보를 입력하여 최고 관리자 계정을 만들어주세요. 이 페이지는 부장 계정 생성 후 자동으로 비활성화됩니다.
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-accent-100 text-accent-700 text-sm mb-5">
              <i className="ri-error-warning-line flex-shrink-0"></i>
              {error}
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary-100 text-secondary-700 text-sm mb-5">
              <i className="ri-checkbox-circle-line flex-shrink-0 mt-0.5"></i>
              <div>
                <p>{successMsg}</p>
                <p className="mt-1 text-secondary-600">잠시 후 로그인 페이지로 이동합니다...</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground-950 mb-1.5">
                이메일
              </label>
              <input
                type="email"
                name="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="부장님 이메일을 입력해주세요"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground-950 mb-1.5">
                이름
              </label>
              <input
                type="text"
                name="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="부장님 실명을 입력해주세요"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground-950 mb-1.5">성별</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setGender('남')}
                  className={`flex-1 py-2.5 rounded-[13px] text-sm font-medium cursor-pointer whitespace-nowrap transition-colors ${gender === '남' ? 'bg-sky-100 text-sky-700 border border-sky-300' : 'bg-background-200 text-foreground-600 border border-background-200'}`}
                >
                  남
                </button>
                <button
                  type="button"
                  onClick={() => setGender('여')}
                  className={`flex-1 py-2.5 rounded-[13px] text-sm font-medium cursor-pointer whitespace-nowrap transition-colors ${gender === '여' ? 'bg-rose-100 text-rose-700 border border-rose-300' : 'bg-background-200 text-foreground-600 border border-background-200'}`}
                >
                  여
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                비밀번호
              </label>
              <input
                type="password"
                name="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="8자 이상 입력"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground-950 mb-1.5">
                비밀번호 확인
              </label>
              <input
                type="password"
                name="confirm-password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="비밀번호를 다시 입력해주세요"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !!successMsg}
              className="w-full py-3 rounded-[20px] bg-primary-500 text-background-50 font-medium text-sm hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap mt-2"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  계정 생성 중...
                </span>
              ) : (
                '부장 계정 생성하기'
              )}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-foreground-600">
            이 페이지는 최초 1회만 사용됩니다. 부장 계정 생성 후에는 접근이 제한됩니다.
          </p>
        </div>
      </motion.div>
    </div>
  );
}