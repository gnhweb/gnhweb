import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { CLUB_LABELS } from '@/types/auth';
import type { ClubType } from '@/types/auth';
import { todayKey } from '@/lib/date';

interface AttendanceRecord {
  user_name: string;
  club: string;
  status: string;
  absence_reason: string | null;
  user_id: string;
  checked_in_at: string | null;
}

interface StudentRecord {
  user_id: string;
  name: string;
  club: string;
  is_expelled?: boolean;
}

type AttendanceTab = 'all' | ClubType;

const CLUB_TABS: Array<{
  id: AttendanceTab;
  label: string;
  shortLabel: string;
  icon: string;
  activeClass: string;
  countClass: string;
}> = [
  {
    id: 'all',
    label: '전체',
    shortLabel: '전체',
    icon: 'ri-group-line',
    activeClass: 'bg-foreground-950 text-white border-foreground-950 dark:bg-background-950 dark:text-foreground-50 dark:border-background-950',
    countClass: 'bg-white/15 text-white',
  },
  {
    id: 'saeullim',
    label: '새울림',
    shortLabel: '새울림',
    icon: 'ri-music-line',
    activeClass: 'bg-amber-500 text-white border-amber-500',
    countClass: 'bg-white/20 text-white',
  },
  {
    id: 'cheonjipoong',
    label: '천지풍',
    shortLabel: '천지풍',
    icon: 'ri-flag-line',
    activeClass: 'bg-emerald-500 text-white border-emerald-500',
    countClass: 'bg-white/20 text-white',
  },
  {
    id: 'cheonjihu',
    label: '천지후',
    shortLabel: '천지후',
    icon: 'ri-heart-pulse-line',
    activeClass: 'bg-violet-500 text-white border-violet-500',
    countClass: 'bg-white/20 text-white',
  },
  {
    id: 'munhwabu',
    label: '문화부',
    shortLabel: '문화부',
    icon: 'ri-camera-lens-line',
    activeClass: 'bg-rose-500 text-white border-rose-500',
    countClass: 'bg-white/20 text-white',
  },
];

const CLUB_IDLE_CLASS = 'bg-background-100 text-foreground-700 border-background-200 hover:border-foreground-300 hover:bg-background-200 dark:bg-background-100 dark:text-foreground-800 dark:border-background-300 dark:hover:border-background-400 dark:hover:bg-background-200';

const getClubName = (club: string) => CLUB_LABELS[club as ClubType]?.split(' (')[0] || club;

export default function AttendanceBoard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<AttendanceTab>('all');
  const [attendanceList, setAttendanceList] = useState<{
    attended: AttendanceRecord[];
    absent: AttendanceRecord[];
    unresponsive: { name: string; club: string; user_id: string }[];
  }>({ attended: [], absent: [], unresponsive: [] });
  const [allStudents, setAllStudents] = useState<StudentRecord[]>([]);

  const today = new Date();
  const todayStr = todayKey();
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
  }, [todayStr]);

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

      const attData = ((attRes.data || []) as AttendanceRecord[]).filter(a => CLUB_TABS.some(tab => tab.id !== 'all' && tab.id === a.club));
      const students = ((studentRes.data || []) as StudentRecord[]).filter(s => !s.is_expelled && CLUB_TABS.some(tab => tab.id !== 'all' && tab.id === s.club));
      const validUserIds = new Set(students.map(s => s.user_id));
      const attendedUserIds = new Set(attData.filter(a => a.status === 'attended').map(a => a.user_id));
      const absentUserIds = new Set(attData.filter(a => a.status === 'absent').map(a => a.user_id));

      setAllStudents(students);
      setAttendanceList({
        attended: attData.filter(a => a.status === 'attended' && validUserIds.has(a.user_id)),
        absent: attData.filter(a => a.status === 'absent' && validUserIds.has(a.user_id)),
        unresponsive: students
          .filter(s => !attendedUserIds.has(s.user_id) && !absentUserIds.has(s.user_id))
          .map(s => ({ name: s.name, club: s.club, user_id: s.user_id })),
      });
    } catch (e) {
      console.error('Attendance board load error:', e);
      setError('출석 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const tabCounts = useMemo(() => {
    return CLUB_TABS.reduce<Record<string, number>>((counts, tab) => {
      counts[tab.id] = tab.id === 'all'
        ? allStudents.length
        : allStudents.filter(student => student.club === tab.id).length;
      return counts;
    }, {});
  }, [allStudents]);

  const visibleData = useMemo(() => {
    if (selectedTab === 'all') return attendanceList;
    return {
      attended: attendanceList.attended.filter(member => member.club === selectedTab),
      absent: attendanceList.absent.filter(member => member.club === selectedTab),
      unresponsive: attendanceList.unresponsive.filter(member => member.club === selectedTab),
    };
  }, [attendanceList, selectedTab]);

  const selectedTotal = selectedTab === 'all' ? allStudents.length : tabCounts[selectedTab] || 0;
  const presentCount = visibleData.attended.length;
  const absentCount = visibleData.absent.length;
  const unresponsiveCount = visibleData.unresponsive.length;
  const attendanceRate = selectedTotal > 0 ? Math.round((presentCount / selectedTotal) * 100) : 0;
  const selectedMeta = CLUB_TABS.find(tab => tab.id === selectedTab)!;
  const selectedLabel = selectedTab === 'all' ? '전체 학생' : CLUB_LABELS[selectedTab].split(' (')[0];

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
          <div className="text-center mb-7">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-[18px] bg-gradient-to-br from-emerald-100 to-teal-100 border border-emerald-200 dark:from-emerald-950/60 dark:to-teal-950/60 dark:border-emerald-800 mb-4">
              <i className="ri-user-heart-line text-2xl text-emerald-600 dark:text-emerald-300"></i>
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

          {/* Club tabs */}
          <div className="mb-6">
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" role="tablist" aria-label="동아리별 출석 현황">
              {CLUB_TABS.map((tab) => {
                const isActive = selectedTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setSelectedTab(tab.id)}
                    className={`w-full sm:w-auto inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${isActive ? tab.activeClass : CLUB_IDLE_CLASS}`}
                  >
                    <i className={`${tab.icon} text-base`}></i>
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.shortLabel}</span>
                    <span className={`min-w-5 h-5 px-1.5 rounded-full inline-flex items-center justify-center text-[10px] font-bold ${isActive ? tab.countClass : 'bg-background-200 text-foreground-500'}`}>
                      {tabCounts[tab.id] ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Current club header */}
          <div className="bg-background-100 border border-background-200 rounded-2xl p-4 mb-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedTab === 'all' ? 'bg-foreground-100 text-foreground-700 dark:bg-foreground-200 dark:text-foreground-800' : selectedMeta.id === 'saeullim' ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300' : selectedMeta.id === 'cheonjipoong' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300' : selectedMeta.id === 'cheonjihu' ? 'bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300' : 'bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300'}`}>
              <i className={`${selectedMeta.icon} text-lg`}></i>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground-950">{selectedLabel} 출석 현황</p>
              <p className="text-xs text-foreground-500">동아리 탭을 선택하면 해당 동아리만 따로 확인할 수 있습니다.</p>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: '동아리 인원', value: selectedTotal, color: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/45 dark:text-sky-200 dark:border-sky-800', icon: 'ri-group-line', iconColor: 'text-sky-600 dark:text-sky-300' },
              { label: '출석 완료', value: presentCount, color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/45 dark:text-emerald-200 dark:border-emerald-800', icon: 'ri-check-double-line', iconColor: 'text-emerald-600 dark:text-emerald-300' },
              { label: '불참', value: absentCount, color: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/45 dark:text-orange-200 dark:border-orange-800', icon: 'ri-close-circle-line', iconColor: 'text-orange-600 dark:text-orange-300' },
              { label: '미응답', value: unresponsiveCount, color: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-background-200 dark:text-foreground-800 dark:border-background-400', icon: 'ri-question-line', iconColor: 'text-gray-500 dark:text-foreground-600' },
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
              <span className="text-sm font-semibold text-foreground-800">{selectedLabel} 출석률</span>
              <span className="text-sm font-bold text-emerald-600">{attendanceRate}%</span>
            </div>
            <div className="h-3 bg-background-200 rounded-full overflow-hidden">
              <motion.div
                key={`${selectedTab}-${attendanceRate}`}
                initial={{ width: 0 }}
                animate={{ width: `${attendanceRate}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full"
              />
            </div>
            <p className="text-xs text-foreground-500 mt-2 flex items-center gap-1">
              <i className="ri-flashlight-line text-emerald-500"></i> 실시간 연동 중 — 출석 체크 시 즉시 반영됩니다
            </p>
          </div>

          {selectedTotal === 0 ? (
            <div className="bg-background-100 border border-background-200 rounded-2xl p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-background-200 mx-auto mb-3 flex items-center justify-center">
                <i className="ri-user-search-line text-xl text-foreground-400"></i>
              </div>
              <p className="text-sm font-semibold text-foreground-700">이 동아리에 등록된 학생이 없습니다.</p>
              <p className="text-xs text-foreground-500 mt-1">학생의 동아리 정보를 확인해주세요.</p>
            </div>
          ) : (
            <>
              {/* Attended list */}
              <div className="bg-background-100 border border-background-200 rounded-2xl p-5 mb-4">
                <h3 className="text-sm font-bold text-foreground-950 mb-3 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                  출석 완료 ({presentCount}명)
                </h3>
                {visibleData.attended.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {visibleData.attended.map((m) => (
                      <span key={m.user_id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-sm font-medium text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-100">
                        {m.user_name}
                        {selectedTab === 'all' && <span className="text-[10px] text-emerald-500 dark:text-emerald-300">· {getClubName(m.club)}</span>}
                        {m.checked_in_at && (
                          <span className="text-[10px] text-emerald-400 dark:text-emerald-300">{new Date(m.checked_in_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-foreground-500 py-2">아직 출석 완료한 학생이 없습니다.</p>
                )}
              </div>

              {/* Unresponsive list */}
              <div className="bg-background-100 border border-background-200 rounded-2xl p-5 mb-4">
                <h3 className="text-sm font-bold text-foreground-950 mb-3 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span>
                  미응답 ({unresponsiveCount}명)
                </h3>
                {visibleData.unresponsive.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {visibleData.unresponsive.map((m) => (
                      <span key={m.user_id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-sm font-medium text-gray-700 dark:bg-background-200 dark:border-background-400 dark:text-foreground-800">
                        {m.name}
                        {selectedTab === 'all' && <span className="text-[10px] text-gray-400 dark:text-foreground-600">· {getClubName(m.club)}</span>}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-foreground-500 py-2">미응답 학생이 없습니다.</p>
                )}
              </div>

              {/* Absent list */}
              <div className="bg-background-100 border border-background-200 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-foreground-950 mb-3 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-400"></span>
                  불참 신고 ({absentCount}명)
                </h3>
                {visibleData.absent.length > 0 ? (
                  <div className="space-y-2">
                    {visibleData.absent.map((m) => (
                      <div key={m.user_id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 px-4 py-2.5 rounded-xl bg-orange-50 border border-orange-100 dark:bg-orange-950/40 dark:border-orange-800">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground-800">{m.user_name}</span>
                          {selectedTab === 'all' && <span className="text-[10px] text-orange-300">· {getClubName(m.club)}</span>}
                        </div>
                        {m.absence_reason && (
                          <span className="text-xs text-orange-600 dark:text-orange-300 sm:ml-auto">{m.absence_reason}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-foreground-500 py-2">불참 신고한 학생이 없습니다.</p>
                )}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
