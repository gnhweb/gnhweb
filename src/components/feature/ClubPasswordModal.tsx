import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface ClubPasswordModalProps {
  clubId: string;
  clubName: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ClubPasswordModal({ clubId, clubName, onSuccess, onCancel }: ClubPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('비밀번호를 입력해주세요');
      return;
    }

    setChecking(true);
    setError('');

    try {
      // 먼저 공통 비밀번호 확인
      const { data, error: fetchError } = await supabase
        .from('club_passwords')
        .select('password_hash')
        .eq('club', 'common')
        .maybeSingle();

      if (fetchError || !data) {
        // 공통 비밀번호가 없으면 clubId로 fallback
        const { data: clubData, error: clubFetchError } = await supabase
          .from('club_passwords')
          .select('password_hash')
          .eq('club', clubId)
          .maybeSingle();

        if (clubFetchError || !clubData) {
          setError('아직 비밀번호가 설정되지 않았습니다. 담당 교사에게 문의하세요.');
          setChecking(false);
          return;
        }

        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password.trim()));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        if (hashHex === clubData.password_hash) {
          sessionStorage.setItem(`club_pwd_${clubId}`, 'granted');
          onSuccess();
        } else {
          setError('비밀번호가 일치하지 않습니다');
        }
        setChecking(false);
        return;
      }

      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password.trim()));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      if (hashHex === data.password_hash) {
        sessionStorage.setItem(`club_pwd_${clubId}`, 'granted');
        onSuccess();
      } else {
        setError('비밀번호가 일치하지 않습니다');
      }
    } catch {
      setError('확인 중 오류가 발생했습니다');
    }

    setChecking(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-background-100 rounded-2xl shadow-xl border border-gray-100 w-full max-w-sm mx-4 p-6">
        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
            <i className="ri-lock-line text-xl text-amber-600"></i>
          </div>
          <h2 className="text-lg font-bold text-foreground-950">{clubName}</h2>
          <p className="text-sm text-foreground-600 mt-1">접근하려면 동아리 비밀번호를 입력하세요</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="비밀번호 입력"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all text-center tracking-widest"
              autoFocus={!(typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)")?.matches)}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-50 text-rose-600 text-xs">
              <i className="ri-error-warning-line flex-shrink-0"></i>
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-foreground-600 hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={checking || !password.trim()}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
            >
              {checking ? (
                <span className="flex items-center justify-center gap-1.5">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  확인 중
                </span>
              ) : '확인'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}