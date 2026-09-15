import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { verifyLegacySupabasePassword } from '@/lib/legacySupabaseAuth';

export default function ResetPassword() {
  const { updatePassword, signOut, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMigration = new URLSearchParams(location.search).get('migrate') === '1';

  const [email, setEmail] = useState('');
  const [legacyPassword, setLegacyPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showLegacyPassword, setShowLegacyPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleMigration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!email.trim() || !legacyPassword.trim()) {
      setError('기존에 사용하시던 이메일과 비밀번호를 입력해주세요');
      return;
    }

    setSubmitting(true);
    try {
      const verified = await verifyLegacySupabasePassword(email.trim(), legacyPassword);
      if (!verified.ok) {
        setError(verified.error || '기존 비밀번호를 확인하지 못했습니다.');
        return;
      }

      const { error: resetError } = await resetPassword(email.trim());
      if (resetError) {
        setError(resetError);
        return;
      }

      setSuccessMsg('기존 비밀번호 확인이 완료되었습니다. 이메일의 재설정 링크를 열고, 방금 확인한 기존 비밀번호를 그대로 입력하면 계정 복구가 완료됩니다.');
      setLegacyPassword('');
    } catch (err) {
      console.error('[AccountMigration] migration exception:', err);
      setError('계정 복구 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!newPassword.trim() || !confirmPassword.trim()) {
      setError('모든 필드를 입력해주세요');
      return;
    }

    if (newPassword.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다');
      return;
    }

    setSubmitting(true);
    try {
      const { error: err } = await updatePassword(newPassword);
      if (err) {
        setError(err);
      } else {
        setSuccessMsg('비밀번호가 성공적으로 변경되었습니다. 다시 로그인해주세요.');
        await signOut();
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 2000);
      }
    } catch {
      setError('비밀번호 변경 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
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
            <i className="ri-lock-password-line text-3xl text-primary-600"></i>
          </div>
          <h1 className="text-2xl font-bold text-foreground-950 mb-1">
            {isMigration ? '기존 계정 복구' : '비밀번호 재설정'}
          </h1>
          <p className="text-sm text-foreground-600">
            {isMigration ? '기존에 사용하시던 비밀번호를 그대로 사용할 수 있습니다' : '새로운 비밀번호를 입력해주세요'}
          </p>
        </div>

        <div className="bg-background-100 border border-background-200 rounded-[20px] p-6 md:p-8">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-accent-100 text-accent-700 text-sm mb-5">
              <i className="ri-error-warning-line flex-shrink-0"></i>
              {error}
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary-100 text-secondary-700 text-sm mb-5">
              <i className="ri-checkbox-circle-line flex-shrink-0 mt-0.5"></i>
              <span>{successMsg}</span>
            </div>
          )}

          {isMigration ? (
            <form onSubmit={handleMigration} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground-950 mb-1.5">이메일</label>
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="가입하신 이메일"
                  autoComplete="email"
                  className="w-full px-4 py-2.5 rounded-xl border border-background-200 text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground-950 mb-1.5">기존 비밀번호</label>
                <div className="relative">
                  <input
                    type={showLegacyPassword ? 'text' : 'password'}
                    name="legacyPassword"
                    value={legacyPassword}
                    onChange={e => setLegacyPassword(e.target.value)}
                    placeholder="예전에 사용하시던 비밀번호"
                    autoComplete="current-password"
                    className="w-full px-4 py-2.5 pr-10 rounded-xl border border-background-200 text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLegacyPassword(!showLegacyPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400 hover:text-foreground-600 transition-colors cursor-pointer"
                    tabIndex={-1}
                  >
                    <i className={`${showLegacyPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-lg`}></i>
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-background-50 border border-background-200 text-xs leading-5 text-foreground-600">
                기존 비밀번호 자체는 저장하지 않습니다. 기존 계정에서 비밀번호가 맞는지만 확인한 뒤 Neon 계정의 재설정 링크를 이메일로 보냅니다. 링크를 열어 <strong className="text-foreground-800">같은 비밀번호를 다시 입력</strong>하면 기존 비밀번호를 그대로 유지할 수 있습니다.
              </div>

              <button
                type="submit"
                disabled={submitting || !!successMsg}
                className="w-full py-3 rounded-[20px] bg-primary-500 text-background-50 font-medium text-sm hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap mt-2"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    확인 중...
                  </span>
                ) : (
                  '기존 비밀번호로 확인하기'
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground-950 mb-1.5">새 비밀번호</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    name="newPassword"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="6자 이상 입력"
                    autoComplete="new-password"
                    className="w-full px-4 py-2.5 pr-10 rounded-xl border border-background-200 text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400 hover:text-foreground-600 transition-colors cursor-pointer"
                    tabIndex={-1}
                  >
                    <i className={`${showNewPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-lg`}></i>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground-950 mb-1.5">비밀번호 확인</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="비밀번호를 다시 입력"
                    autoComplete="new-password"
                    className="w-full px-4 py-2.5 pr-10 rounded-xl border border-background-200 text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400 hover:text-foreground-600 transition-colors cursor-pointer"
                    tabIndex={-1}
                  >
                    <i className={`${showConfirmPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-lg`}></i>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !!successMsg}
                className="w-full py-3 rounded-[20px] bg-primary-500 text-background-50 font-medium text-sm hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap mt-2"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    처리 중...
                  </span>
                ) : (
                  '비밀번호 변경하기'
                )}
              </button>
            </form>
          )}
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-1.5 text-sm text-foreground-600 hover:text-foreground-950 transition-colors cursor-pointer"
          >
            <i className="ri-arrow-left-line"></i>
            로그인으로 돌아가기
          </button>
        </div>
      </motion.div>
    </div>
  );
}
