import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { isValidPinFormat } from '@/lib/simplePin';

// 앱을 새로 열었는데(콜드 스타트) 이 기기에 간편 비밀번호(PIN)가 아직 설정되어
// 있지 않은 경우 보여주는 안내 화면. 로그인 화면에서 로그인 직후 한 번만 뜨던
// 안내를 재사용 가능하게 분리해서, 그때 "나중에 하기"를 눌렀거나 다른 기기로
// 처음 들어온 경우에도 다음에 앱을 새로 열 때마다 다시 안내한다.
export default function PinSetupPrompt() {
  const { user, profile, setupPin, dismissPinSetupPrompt, signOut } = useAuth();
  const [pinValue, setPinValue] = useState('');
  const [pinConfirmValue, setPinConfirmValue] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!isValidPinFormat(pinValue)) {
      setError('숫자 4~6자리로 입력해주세요');
      return;
    }
    if (pinValue !== pinConfirmValue) {
      setError('입력한 비밀번호가 서로 달라요');
      return;
    }
    setSaving(true);
    const { error: err } = await setupPin(pinValue);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    // setupPin이 성공하면 hasPin이 true가 되고 pinSetupNeeded도 자동으로
    // false가 되므로 이 화면은 사라진다.
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background-50 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center mx-auto mb-5">
          <i className="ri-shield-keyhole-line text-2xl text-amber-600"></i>
        </div>

        <h1 className="text-lg font-bold text-foreground-950 mb-1">
          {profile?.name ? `${profile.name}님, 간편 비밀번호를 설정해주세요` : '간편 비밀번호를 설정해주세요'}
        </h1>
        <p className="text-sm text-foreground-500 mb-1">{user?.email}</p>
        <p className="text-sm text-foreground-600 mb-6">
          이 기기에서 다음부턴 이메일 없이<br />숫자 비밀번호만으로 빠르게 들어올 수 있어요
        </p>

        <div className="bg-background-100 rounded-2xl border border-background-200 p-6 text-left">
          <div className="space-y-3">
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pinValue}
              onChange={(e) => { setPinValue(e.target.value.replace(/\D/g, '')); setError(''); }}
              placeholder="숫자 4~6자리"
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none text-center tracking-[0.3em] focus:border-amber-400"
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pinConfirmValue}
              onChange={(e) => { setPinConfirmValue(e.target.value.replace(/\D/g, '')); setError(''); }}
              placeholder="비밀번호 확인"
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none text-center tracking-[0.3em] focus:border-amber-400"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            />
          </div>

          {error && (
            <p className="text-xs text-rose-600 text-center mt-3">{error}</p>
          )}

          <div className="flex gap-2 mt-5">
            <button
              type="button"
              onClick={dismissPinSetupPrompt}
              className="flex-1 py-2.5 rounded-full border border-gray-200 text-sm text-foreground-600 cursor-pointer whitespace-nowrap"
            >
              나중에 하기
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !pinValue || !pinConfirmValue}
              className="flex-1 py-2.5 rounded-full bg-amber-500 text-white text-sm font-semibold disabled:opacity-40 cursor-pointer whitespace-nowrap"
            >
              {saving ? '저장 중...' : '설정하기'}
            </button>
          </div>

          <p className="text-xs text-foreground-400 text-center mt-4">
            프로필 설정에서 언제든 바꾸거나 해제할 수 있어요
          </p>
        </div>

        <button
          type="button"
          onClick={() => signOut()}
          className="text-sm text-foreground-500 hover:text-amber-600 transition-colors cursor-pointer mt-5"
        >
          다른 계정으로 로그인
        </button>
      </motion.div>
    </div>
  );
}