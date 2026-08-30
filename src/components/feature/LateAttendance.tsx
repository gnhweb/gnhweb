import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { todayKey } from '@/lib/date';

// Late attendance is intentionally recorded separately from on-time attendance.
interface AttendanceLocationData {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
}

interface AttendanceProfile {
  user_id: string;
  name: string;
  club?: string | null;
}

function getDistanceM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function LateAttendance({ profile }: { profile: AttendanceProfile }) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [alreadyMarked, setAlreadyMarked] = useState(false);
  const [locations, setLocations] = useState<AttendanceLocationData[]>([]);
  const [reason, setReason] = useState('');
  const [showReason, setShowReason] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [{ data: attendance }, { data: activeLocations }] = await Promise.all([
        supabase.from('attendance').select('status').eq('user_id', profile.user_id).eq('attendance_date', todayKey()).maybeSingle(),
        supabase.from('attendance_locations').select('id,label,latitude,longitude,radius_meters,is_active').eq('is_active', true),
      ]);
      if (!active) return;
      setAlreadyMarked(Boolean(attendance));
      setLocations((activeLocations || []) as AttendanceLocationData[]);
    })();
    return () => { active = false; };
  }, [profile.user_id]);

  const markLate = useCallback(async () => {
    if (alreadyMarked || status === 'checking') return;
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setShowReason(true);
      setStatus('error');
      setMessage('늦참 사유를 입력해주세요.');
      return;
    }

    setStatus('checking');
    setMessage('');

    if (!navigator.geolocation) {
      setStatus('error');
      setMessage('이 브라우저에서는 위치 확인을 사용할 수 없습니다.');
      return;
    }

    const save = async () => {
      const today = todayKey();
      const { error } = await supabase.from('attendance').insert({
        user_id: profile.user_id,
        user_name: profile.name,
        club: profile.club || 'saeullim',
        attendance_date: today,
        status: 'late',
        absence_reason: trimmedReason,
        checked_in_at: new Date().toISOString(),
      });
      if (error) {
        if (error.code === '23505') throw new Error('오늘 출석 기록이 이미 있습니다. 화면을 새로고침해주세요.');
        throw error;
      }
    };

    const finish = async () => {
      try {
        await save();
        setAlreadyMarked(true);
        setStatus('done');
        setMessage('늦참 출석과 사유가 기록되었습니다.');
        setShowReason(false);
      } catch (e) {
        setStatus('error');
        setMessage(e instanceof Error ? e.message : '늦참 처리에 실패했습니다.');
      }
    };

    if (locations.length === 0) {
      await finish();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const within = locations.some((loc) => getDistanceM(position.coords.latitude, position.coords.longitude, loc.latitude, loc.longitude) <= loc.radius_meters);
        if (!within) {
          setStatus('error');
          setMessage('등록된 출석 위치 반경 안에서 늦참을 눌러주세요.');
          return;
        }
        await finish();
      },
      () => {
        setStatus('error');
        setMessage('위치를 확인할 수 없습니다. 위치 권한을 허용한 뒤 다시 시도해주세요.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, [alreadyMarked, locations, profile, reason, status]);

  if (alreadyMarked && status !== 'error') {
    return <div className="mt-4 rounded-2xl border border-background-200 bg-background-100 p-4"><p className="text-sm font-bold text-foreground-900">오늘 출석 기록이 있습니다.</p></div>;
  }

  return (
    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-black text-amber-900">늦게 도착했나요?</p>
          <p className="text-xs text-amber-800 mt-1">정시 출석과 구분하여 ‘늦참’으로 기록합니다. 늦참 사유도 함께 남겨주세요.</p>
        </div>
        {showReason && (
          <div>
            <label htmlFor="late-attendance-reason" className="block text-xs font-bold text-amber-950 mb-1.5">늦참 사유 <span aria-hidden="true">*</span></label>
            <textarea
              id="late-attendance-reason"
              value={reason}
              onChange={(e) => { setReason(e.target.value); if (e.target.value.trim()) { setStatus('idle'); setMessage(''); } }}
              maxLength={200}
              rows={3}
              placeholder="예: 교통 체증으로 10분 늦었습니다."
              className="w-full rounded-xl border border-amber-300 bg-white px-3 py-3 text-[15px] leading-6 text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
            />
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
          {!showReason && <button type="button" onClick={() => { setShowReason(true); setStatus('idle'); setMessage(''); }} className="min-h-11 px-4 rounded-xl border border-amber-300 bg-white text-amber-800 text-sm font-bold">늦참 사유 입력</button>}
          <button type="button" onClick={markLate} disabled={status === 'checking'} className="min-h-11 px-5 rounded-xl bg-amber-500 text-white text-sm font-bold disabled:opacity-50">{status === 'checking' ? '위치 확인 중…' : '늦참으로 출석'}</button>
        </div>
      </div>
      {message && <p className={`mt-3 text-xs font-semibold ${status === 'error' ? 'text-rose-700' : 'text-amber-900'}`}>{message}</p>}
    </div>
  );
}
