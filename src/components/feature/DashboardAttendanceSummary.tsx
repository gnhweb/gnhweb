import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { todayKey, formatKoreanDate } from '@/lib/date';

interface AttendanceRow {
  id: string;
  attendance_date: string;
  status: string;
  checked_in_at: string | null;
  absence_reason: string | null;
}

const STATUS_META: Record<string, { label: string; className: string; icon: string }> = {
  attended: { label: '정시 출석', className: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'ri-checkbox-circle-line' },
  present: { label: '정시 출석', className: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'ri-checkbox-circle-line' },
  late: { label: '늦참', className: 'bg-amber-50 text-amber-800 border-amber-100', icon: 'ri-time-line' },
  absent: { label: '불참', className: 'bg-rose-50 text-rose-700 border-rose-100', icon: 'ri-close-circle-line' },
};

function getStatusMeta(status?: string) {
  return STATUS_META[status || ''] || { label: '미응답', className: 'bg-background-100 text-foreground-600 border-background-200', icon: 'ri-question-line' };
}

function formatCheckInTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export default function DashboardAttendanceSummary() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAttendance = useCallback(async () => {
    if (!profile?.user_id || profile.role !== 'member') return;
    setLoading(true);
    setError('');
    try {
      const { data, error: queryError } = await supabase
        .from('attendance')
        .select('id,attendance_date,status,checked_in_at,absence_reason')
        .eq('user_id', profile.user_id)
        .order('attendance_date', { ascending: false })
        .limit(7);

      if (queryError) throw queryError;
      setRows((data || []) as AttendanceRow[]);
    } catch (err) {
      console.error('사명자 출석 요약 조회 실패:', err);
      setRows([]);
      setError('출석 기록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [profile?.user_id, profile?.role]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const today = todayKey();
  const todayRecord = rows.find((row) => row.attendance_date === today);
  const todayMeta = getStatusMeta(todayRecord?.status);
  const recentLateCount = useMemo(() => rows.filter((row) => row.status === 'late').length, [rows]);
  const recentAbsentCount = useMemo(() => rows.filter((row) => row.status === 'absent').length, [rows]);

  if (!profile || profile.role !== 'member') return null;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 pt-6 md:pt-12">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.28 }}
        className="bg-background-100 rounded-2xl p-5 md:p-6 shadow-card mb-6"
        aria-labelledby="dashboard-attendance-title"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 id="dashboard-attendance-title" className="text-lg font-bold text-foreground-950 flex items-center gap-2">
              <i className="ri-calendar-check-line text-accent-600" aria-hidden="true"></i>
              오늘의 출석
            </h2>
            <p className="text-xs text-foreground-500 mt-1">{formatKoreanDate(new Date(), { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>
          </div>
          <Link to="/dashboard/attendance" className="text-sm font-semibold text-primary-600 whitespace-nowrap">
            출석하러 가기
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[0, 1, 2].map((item) => <div key={item} className="h-20 rounded-xl bg-background-50 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className={`rounded-xl border p-3 ${todayMeta.className}`}>
              <i className={`${todayMeta.icon} text-lg`} aria-hidden="true"></i>
              <p className="text-sm font-bold mt-1">{todayMeta.label}</p>
              {todayRecord?.checked_in_at && <p className="text-[11px] mt-0.5 opacity-80">{formatCheckInTime(todayRecord.checked_in_at)}</p>}
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-amber-800">
              <i className="ri-time-line text-lg" aria-hidden="true"></i>
              <p className="text-sm font-bold mt-1">최근 늦참</p>
              <p className="text-[11px] mt-0.5">최근 7회 기준 {recentLateCount}회</p>
            </div>
            <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-rose-700">
              <i className="ri-close-circle-line text-lg" aria-hidden="true"></i>
              <p className="text-sm font-bold mt-1">최근 불참</p>
              <p className="text-[11px] mt-0.5">최근 7회 기준 {recentAbsentCount}회</p>
            </div>
          </div>
        )}

        {todayRecord?.status === 'late' && todayRecord.absence_reason && (
          <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-3">
            <p className="text-xs font-bold text-amber-900 mb-1">오늘 늦참 사유</p>
            <p className="text-sm leading-5 text-amber-900 break-words">{todayRecord.absence_reason}</p>
          </div>
        )}

        {error && <p className="text-xs text-rose-600 mb-3">{error}</p>}

        <div className="pt-4 border-t border-background-200">
          <p className="text-xs font-semibold text-foreground-700 mb-2">최근 출석 기록</p>
          {rows.length === 0 ? (
            <p className="text-sm text-foreground-500 py-2">아직 출석 기록이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {rows.slice(0, 5).map((row) => {
                const meta = getStatusMeta(row.status);
                const date = new Date(`${row.attendance_date}T00:00:00`);
                return (
                  <div key={row.id} className="flex items-center gap-3 rounded-xl bg-background-50 px-3 py-2.5">
                    <i className={`${meta.icon} ${meta.className.split(' ')[1]} text-lg`} aria-hidden="true"></i>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground-900 truncate">
                        {date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                      </p>
                      {row.status === 'late' && row.absence_reason && <p className="text-[11px] text-foreground-500 truncate">{row.absence_reason}</p>}
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-bold ${meta.className}`}>{meta.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.section>
    </div>
  );
}
