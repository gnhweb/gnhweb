import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { todayKey } from '@/lib/date';

interface Props {
  onSubmitted?: () => void;
}

type CurrentStatus = 'loading' | 'none' | 'attended' | 'absent' | 'late';

export default function LateAttendanceNotice({ onSubmitted }: Props) {
  const { profile } = useAuth();
  const [status, setStatus] = useState<CurrentStatus>('loading');
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!profile?.user_id) return;
    const { data, error: queryError } = await supabase
      .from('attendance')
      .select('status,late_reason')
      .eq('user_id', profile.user_id)
      .eq('attendance_date', todayKey())
      .maybeSingle();

    if (queryError) {
      console.error('늦참 상태 확인 실패:', queryError);
      setStatus('none');
      return;
    }

    if (!data) {
      setStatus('none');
      return;
    }

    setStatus(data.status as CurrentStatus);
    if (data.status === 'late' && data.late_reason) setReason(data.late_reason);
  }, [profile?.user_id]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!profile?.user_id || !reason.trim() || submitting) return;
    setSubmitting(true);
    setError('');

    try {
      const { error: insertError } = await supabase.from('attendance').insert({
        user_id: profile.user_id,
        user_name: profile.name,
        club: profile.club || 'saeullim',
        attendance_date: todayKey(),
        status: 'late',
        late_reason: reason.trim(),
        checked_in_at: new Date().toISOString(),
      });

      if (insertError) {
        if (insertError.code === '23505') {
          await load();
          setOpen(false);
          return;
        }
        throw insertError;
      }

      setStatus('late');
      setOpen(false);
      onSubmitted?.();
    } catch (e) {
      console.error('늦참 등록 실패:', e);
      setError('늦참 신청을 보내지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading' || status === 'attended' || status === 'absent') return null;

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 pb-10">
      {status === 'late' ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <i className="ri-time-line text-amber-700 text-lg" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-amber-900">늦참 신청이 전송되었어요</p>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">사유: {reason}</p>
              <p className="text-[11px] text-amber-700/80 mt-2">사명자에게 늦참 사실과 사유가 전달됩니다.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-background-200 bg-background-100 p-4 md:p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
                <i className="ri-time-line text-sky-700 text-lg" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground-950">오늘 늦참해야 하나요?</p>
                <p className="text-xs text-foreground-600 mt-1 leading-relaxed">도착이 늦는다면 미리 사유를 보내 사명자가 상황을 확인할 수 있어요.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setError(''); setOpen(true); }}
              className="shrink-0 min-h-11 px-4 rounded-xl bg-sky-600 text-white text-sm font-bold active:scale-[0.98] transition-transform"
            >
              늦참 보내기
            </button>
          </div>

          {open && (
            <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50/60 p-4">
              <label className="block text-sm font-semibold text-sky-950 mb-2" htmlFor="late-reason">늦참 사유</label>
              <textarea
                id="late-reason"
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={300}
                rows={4}
                placeholder="예: 학교 수행평가가 6시 40분에 끝나서 7시 10분쯤 도착할 것 같아요."
                className="w-full rounded-xl border border-sky-200 bg-white px-3.5 py-3 text-[15px] text-foreground-950 outline-none focus:ring-2 focus:ring-sky-200 resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-foreground-500">{reason.length}/300</span>
                {error && <span className="text-xs text-rose-600">{error}</span>}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-xl border border-background-200 bg-white text-sm font-semibold text-foreground-700">취소</button>
                <button type="button" onClick={submit} disabled={!reason.trim() || submitting} className="min-h-11 rounded-xl bg-sky-600 text-white text-sm font-bold disabled:opacity-40">{submitting ? '전송 중…' : '사유 보내기'}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
