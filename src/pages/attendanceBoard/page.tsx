import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { CLUB_LABELS } from '@/types/auth';
import type { ClubType } from '@/types/auth';

interface AttendanceRecord {
  user_name: string;
  club: string;
  status: string;
  absence_reason: string | null;
  user_id: string;
  checked_in_at: string | null;
}

export default function AttendanceBoard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attendanceList, setAttendanceList] = useState<{
    attended: AttendanceRecord[];
    absent: AttendanceRecord[];
    unresponsive: { name: string; club: string; user_id: string }[];
  }>({ attended: [], absent: [], unresponsive: [] });
  const [totalStudents, setTotalStudents] = useState(0);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const todayLabel = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 ${['일','월','화','수','목','금','토'][today.getDay()]}요일`;

  useEffect(() => {
    loadAttendance();
    const channel = supabase
      .channel('attendance-board-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance', filter: `attendance_date=eq.${todayStr}` }, () => {
        loadAttendance();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadAttendance = async () => {
    setLoading(true);
    setError(null);
    try {
      const [attRes, studentRes] = await Promise.all([
        supabase.from('attendance').select('*').eq('attendance_date', todayStr),
        supabase.from('user_roles').select('user_id, name, club, is_expelled').not('role', 'in', '("chief","teacher")'),
      ]);

      if (attRes.error) throw attRes.error;
      if (studentRes.error) throw studentRes.error;

      const attData = (attRes.data || []) as AttendanceRecord[];
      const allStudents = ((studentRes.data || []) as { user_id: string; name: string; club: string; is_expelled?: boolean }[])
        .filter(s => !s.is_expelled);
      const validUserIds = new Set(allStudents.map(s => s.user_id));

      setTotalStudents(allStudents.length);

      const attendedUserIds = new Set(attData.filter(a => a.status === 'attended').map(a => a.user_id));
      const absentUserIds = new Set(attData.filter(a => a.status === 'absent').map(a => a.user_id));

      const attended = attData.filter(a => a.status === 'attended' && validUserIds.has(a.user_id));
      const absent = attData.filter(a => a.status === 'absent' && validUserIds.has(a.user_id));
      const unresponsive = allStudents.filter(s => !attendedUserIds.has(s.user_id) && !absentUserIds.has(s.user_id)).map(s => ({
        name: s.name,
        club: s.club,
        user_id: s.user_id,
      }));

      setAttendanceList({ attended, absent, unresponsive });
    } catch (e) {
      console.error('Attendance board load error:', e);
      setError('출석 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const presentCount = attendanceList.attended.length;
  const absentCount = attendanceList.absent.length;
  const unresponsiveCount = attendanceList.unresponsive.length;
  const attendanceRate = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-14">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-[18px] bg-gradient-to-br from-emerald-100 to-teal-100 border border-emerald-200 mb-4">
              <i className="ri-user-heart-line text-2xl text-emerald-600"></i>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground-950 mb-1">실시간 출석 현황판</h1>
            <p className="text-sm text-foreground-600">{todayLabel}</p>
          </div>

          {error && (
            <div className="bg-accent-100 border border-accent-200 rounded-2xl p-4 mb-6 flex items-center justify-between">
              <p className="text-sm text-accent-700 flex items-center gap-2"><i className="ri-error-warning-line"></i>{error}</p>
              <button onClick={loadAttendance} className="text-xs text-accent-600 underline cursor-pointer">다시 시도</button>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-3 mb-8">
            {[
              { label: '전체 학생', value: totalStudents, color: 'bg-sky-100 text-sky-700 border-sky-200', icon: 'ri-group-line', iconColor: 'text-sky-600' },
              { label: '출석 완료', value: presentCount, color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: 'ri-check-double-line', iconColor: 'text-emerald-600' },
              { label: '불참', value: absentCount, color: 'bg-orange-100 text-orange-700 border-orange-200', icon: 'ri-close-circle-line', iconColor: 'text-orange-600' },
              { label: '미응답', value: unresponsiveCount, color: 'bg-gray-100 text-gray-600 border-gray-200', icon: 'ri-question-line', iconColor: 'text-gray-500' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className={`${stat.color} border rounded-2xl p-4 text-center`}
              >
                <i className={`${stat.icon} text-lg ${stat.iconColor} block mb-1`}></i>
                <p className="text-xl md:text-2xl font-bold">{stat.value}</p>
                <p className="text-[11px] md:text-xs mt-0.5 opacity-70">{stat.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="bg-background-100 border border-background-200 rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-foreground-800">출석률</span>
              <span className="text-sm font-bold text-emerald-600">{attendanceRate}%</span>
            </div>
            <div className="h-3 bg-background-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${attendanceRate}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full"
              />
            </div>
            <p className="text-xs text-foreground-500 mt-2 flex items-center gap-1">
              <i className="ri-flashlight-line text-emerald-500"></i> 실시간 연동 중 — 출석 체크 시 즉시 반영됩니다
            </p>
          </div>

          {/* Attended list */}
          {attendanceList.attended.length > 0 && (
            <div className="bg-background-100 border border-background-200 rounded-2xl p-5 mb-4">
              <h3 className="text-sm font-bold text-foreground-950 mb-3 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                출석 완료 ({attendanceList.attended.length}명)
              </h3>
              <div className="flex flex-wrap gap-2">
                {attendanceList.attended.map((m, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-sm font-medium text-emerald-800">
                    {m.user_name}
                    <span className="text-[10px] text-emerald-500">· {CLUB_LABELS[m.club as ClubType]?.split(' ')[0] || m.club}</span>
                    {m.checked_in_at && (
                      <span className="text-[10px] text-emerald-400">{new Date(m.checked_in_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Unresponsive list */}
          {attendanceList.unresponsive.length > 0 && (
            <div className="bg-background-100 border border-background-200 rounded-2xl p-5 mb-4">
              <h3 className="text-sm font-bold text-foreground-950 mb-3 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span>
                미응답 ({attendanceList.unresponsive.length}명)
              </h3>
              <div className="flex flex-wrap gap-2">
                {attendanceList.unresponsive.map((m, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-sm font-medium text-gray-700">
                    {m.name}
                    <span className="text-[10px] text-gray-400">· {CLUB_LABELS[m.club as ClubType]?.split(' ')[0] || m.club}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Absent list */}
          {attendanceList.absent.length > 0 && (
            <div className="bg-background-100 border border-background-200 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-foreground-950 mb-3 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-400"></span>
                불참 신고 ({attendanceList.absent.length}명)
              </h3>
              <div className="space-y-2">
                {attendanceList.absent.map((m, i) => (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 px-4 py-2.5 rounded-xl bg-orange-50 border border-orange-100">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground-800">{m.user_name}</span>
                      <span className="text-[10px] text-orange-500">· {CLUB_LABELS[m.club as ClubType]?.split(' ')[0] || m.club}</span>
                    </div>
                    {m.absence_reason && (
                      <span className="text-xs text-orange-600 sm:ml-auto">{m.absence_reason}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
