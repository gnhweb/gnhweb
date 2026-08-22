import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { CLUB_LABELS } from '@/types/auth';
import type { ClubType } from '@/types/auth';
import { todayKey, formatKoreanDate } from '@/lib/date';

const ALL_CLUBS: ClubType[] = ['saeullim', 'cheonjipoong', 'cheonjihu', 'munhwabu', 'cheonhwarae_cheongmyeong'];

interface ReportItem {
  id: string;
  author_name: string;
  club: string;
  status: string;
  created_at: string;
  week_start?: string;
  progress_summary?: string;
  record_date?: string;
  spiritual_growth?: string;
  student_name?: string;
}

interface QnAItem {
  id: string;
  question: string;
  answer?: string;
  created_at: string;
  author_id: string;
}

interface MarathonItem {
  id: string;
  student_name: string;
  student_club: string;
  book: string;
  chapter: string;
  status: string;
  created_at: string;
}

export default function TeacherDashboard() {
  const { profile, hasRole, assignedTeacherClub } = useAuth();
  const isChief = hasRole('chief');
  const isTeacher = hasRole('teacher');

  const [weeklyReports, setWeeklyReports] = useState<ReportItem[]>([]);
  const [growthRecords, setGrowthRecords] = useState<ReportItem[]>([]);
  const [unansweredQnA, setUnansweredQnA] = useState<QnAItem[]>([]);
  const [pendingMarathon, setPendingMarathon] = useState<MarathonItem[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<{ total: number; present: number }>({ total: 0, present: 0 });

  // Real attendance list
  const [attendanceList, setAttendanceList] = useState<{
    attended: { name: string; club: string; clubName: string; user_id: string }[];
    absent: { name: string; club: string; clubName: string; reason: string; user_id: string }[];
    unresponsive: { name: string; club: string; clubName: string; user_id: string }[];
  }>({ attended: [], absent: [], unresponsive: [] });

  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'absent'>('all');
  const [attendanceGradeFilter, setAttendanceGradeFilter] = useState('전체');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clubFilter, setClubFilter] = useState<ClubType | 'all'>('all');

  const targetClub = (): ClubType | 'all' => {
    if (isChief) return clubFilter;
    if (isTeacher && assignedTeacherClub) return assignedTeacherClub as ClubType;
    return 'all';
  };

  const effectiveClub = targetClub();

  useEffect(() => {
    loadDashboardData();

    // Realtime subscription for attendance updates
    const todayStr = todayKey();
    const channel = supabase
      .channel('teacher-dashboard-attendance')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance', filter: `attendance_date=eq.${todayStr}` },
        () => { loadDashboardData(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [assignedTeacherClub, clubFilter]);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get club member IDs if a specific club is targeted
      let clubMemberIds: string[] = [];
      if (effectiveClub !== 'all') {
        const { data: clubMembers } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('club', effectiveClub);
        clubMemberIds = clubMembers ? clubMembers.map((m: { user_id: string }) => m.user_id) : [];
      }

      // Fetch weekly reports
      let weeklyQuery = supabase
        .from('weekly_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (effectiveClub !== 'all') {
        weeklyQuery = weeklyQuery.eq('club', effectiveClub);
      }
      const { data: weeklyData } = await weeklyQuery;
      setWeeklyReports(weeklyData || []);

      // Fetch growth records
      let growthQuery = supabase
        .from('growth_records')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (effectiveClub !== 'all') {
        growthQuery = growthQuery.eq('club', effectiveClub);
      }
      const { data: growthData } = await growthQuery;
      setGrowthRecords(growthData || []);

      // Fetch unanswered QnA
      let qnaQuery = supabase
        .from('qna_questions')
        .select('*')
        .is('answer_author_id', null)
        .order('created_at', { ascending: false })
        .limit(10);
      if (effectiveClub !== 'all' && clubMemberIds.length > 0) {
        qnaQuery = qnaQuery.in('author_id', clubMemberIds);
      }
      const { data: qnaData } = await qnaQuery;
      setUnansweredQnA(qnaData || []);

      // Fetch pending marathon entries
      let marathonQuery = supabase
        .from('bible_marathon_entries')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(10);
      if (effectiveClub !== 'all') {
        marathonQuery = marathonQuery.eq('student_club', effectiveClub);
      }
      const { data: marathonData } = await marathonQuery;
      setPendingMarathon(marathonData || []);

      // Fetch attendance summary (today's) + detailed list
      const today = todayKey();
      let attQuery = supabase.from('attendance').select('*').eq('attendance_date', today);
      if (effectiveClub !== 'all') {
        attQuery = attQuery.eq('club', effectiveClub);
      }
      const { data: attData } = await attQuery;

      // Get all students (excluding teachers and chiefs, and excluding expelled members)
      let studentsQuery = supabase
        .from('user_roles')
        .select('user_id, name, club, is_expelled')
        .not('role', 'in', '("chief","teacher")');
      if (effectiveClub !== 'all') {
        studentsQuery = studentsQuery.eq('club', effectiveClub);
      }
      const { data: allStudentsRaw } = await studentsQuery;
      const allStudents = (allStudentsRaw || []).filter(
        (s: { is_expelled?: boolean }) => !s.is_expelled
      );

      if (attData && allStudents) {
        // Only count attendance records for members who are not expelled
        const validUserIds = new Set(allStudents.map((s: { user_id: string }) => s.user_id));
        const validAttData = (attData as { user_id: string }[]).filter((a) => validUserIds.has(a.user_id));

        const present = validAttData.filter((a: { status: string }) => a.status === 'attended').length;
        setAttendanceSummary({
          total: allStudents.length,
          present,
        });

        const attendedUserIds = new Set(validAttData.filter((a: { status: string }) => a.status === 'attended').map((a: { user_id: string }) => a.user_id));
        const absentUserIds = new Set(validAttData.filter((a: { status: string }) => a.status === 'absent').map((a: { user_id: string }) => a.user_id));

        const attendedList: { name: string; club: string; clubName: string; user_id: string }[] = [];
        const absentList: { name: string; club: string; clubName: string; reason: string; user_id: string }[] = [];
        const unresponsiveList: { name: string; club: string; clubName: string; user_id: string }[] = [];

        for (const a of validAttData as { user_name: string; club: string; status: string; absence_reason: string | null; user_id: string }[]) {
          const clubName = CLUB_LABELS[a.club as ClubType]?.split(' ')[0] || a.club;
          if (a.status === 'attended') {
            attendedList.push({ name: a.user_name, club: a.club, clubName, user_id: a.user_id });
          } else if (a.status === 'absent') {
            absentList.push({ name: a.user_name, club: a.club, clubName, reason: a.absence_reason || '', user_id: a.user_id });
          }
        }

        // Find unresponsive students (in user_roles but not in attendance)
        for (const s of allStudents as { user_id: string; name: string; club: string }[]) {
          if (!attendedUserIds.has(s.user_id) && !absentUserIds.has(s.user_id)) {
            const clubName = CLUB_LABELS[s.club as ClubType]?.split(' ')[0] || s.club;
            unresponsiveList.push({ name: s.name, club: s.club, clubName, user_id: s.user_id });
          }
        }

        setAttendanceList({ attended: attendedList, absent: absentList, unresponsive: unresponsiveList });
      }
    } catch (e) {
      console.error('Teacher dashboard load error:', e);
      setError('대시보드 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return formatKoreanDate(dateStr, { month: 'numeric', day: 'numeric' }).replace(/\s/g, '');
  };

  if (!isTeacher && !isChief) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-[20px] bg-primary-100 flex items-center justify-center mx-auto mb-4">
            <i className="ri-shield-keyhole-line text-3xl text-primary-600"></i>
          </div>
          <p className="text-lg font-bold text-foreground-950 mb-2">접근 권한이 없습니다</p>
          <p className="text-sm text-foreground-600">교사 또는 부장님 계정으로 로그인해주세요</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary-400 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">담당 교사 대시보드</h1>
                <p className="text-sm text-foreground-600">
                  {effectiveClub !== 'all' ? `${CLUB_LABELS[effectiveClub]} 담당` : '전체 동아리'} · {profile?.name} 선생님
                </p>
              </div>

              {/* Club filter for chief */}
              {isChief && (
                <div className="flex items-center gap-1 bg-background-100 border border-background-200 rounded-full p-1">
                  <button
                    onClick={() => setClubFilter('all')}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${clubFilter === 'all' ? 'bg-background-100 text-foreground-950 shadow-sm' : 'text-foreground-600 hover:text-foreground-950'}`}
                  >
                    전체
                  </button>
                  {ALL_CLUBS.map(c => (
                    <button
                      key={c}
                      onClick={() => setClubFilter(c)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${clubFilter === c ? 'bg-background-100 text-foreground-950 shadow-sm' : 'text-foreground-600 hover:text-foreground-950'}`}
                    >
                      {CLUB_LABELS[c].split(' ')[0]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-accent-100 border border-accent-200 rounded-[20px] p-4 mb-6">
              <p className="text-sm text-accent-700 flex items-center gap-2"><i className="ri-error-warning-line"></i>{error}</p>
              <button onClick={loadDashboardData} className="mt-2 text-xs text-accent-600 underline cursor-pointer">다시 시도</button>
            </div>
          )}

          {/* Attendance summary card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-background-100 border border-emerald-200 rounded-[20px] p-5 text-center">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mx-auto mb-2">
                <i className="ri-check-double-line text-emerald-600"></i>
              </div>
              <p className="text-2xl font-black text-emerald-700">{attendanceSummary.present}</p>
              <p className="text-xs text-foreground-600">오늘 출석</p>
            </div>
            <div className="bg-background-100 border border-amber-200 rounded-[20px] p-5 text-center">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mx-auto mb-2">
                <i className="ri-question-answer-line text-amber-600"></i>
              </div>
              <p className="text-2xl font-black text-amber-700">{unansweredQnA.length}</p>
              <p className="text-xs text-foreground-600">미답변 질문</p>
            </div>
            <div className="bg-background-100 border border-rose-200 rounded-[20px] p-5 text-center">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center mx-auto mb-2">
                <i className="ri-book-open-line text-rose-600"></i>
              </div>
              <p className="text-2xl font-black text-rose-700">{pendingMarathon.length}</p>
              <p className="text-xs text-foreground-600">묵상 확인 대기</p>
            </div>
          </div>

          {/* ── 실시간 출석 명단 ── */}
          <div className="bg-background-100 border border-background-200 rounded-[20px] p-5 mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-bold text-foreground-950 flex items-center gap-2">
                <i className="ri-user-heart-line text-rose-600"></i>
                오늘 출석 현황
                <span className="text-xs text-foreground-500 font-normal">
                  (출석 {attendanceList.attended.length}명 · 불참 {attendanceList.absent.length}명 · 미응답 {attendanceList.unresponsive.length}명)
                </span>
              </h3>
              <div className="flex items-center gap-1 bg-background-200 rounded-full p-0.5">
                <button
                  onClick={() => setAttendanceFilter('all')}
                  className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${attendanceFilter === 'all' ? 'bg-background-100 text-foreground-950 shadow-sm' : 'text-foreground-600'}`}
                >
                  전체
                </button>
                <button
                  onClick={() => setAttendanceFilter('absent')}
                  className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${attendanceFilter === 'absent' ? 'bg-background-100 text-foreground-950 shadow-sm' : 'text-foreground-600'}`}
                >
                  미출석자만
                </button>
              </div>
            </div>

            {/* Attended list */}
            {(attendanceFilter === 'all') && attendanceList.attended.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  출석 완료 ({attendanceList.attended.length}명)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {attendanceList.attended.map((m, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-xs font-medium text-emerald-800">
                      {m.name}
                      <span className="text-[9px] text-emerald-500">· {m.clubName}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Unresponsive list */}
            {(attendanceFilter === 'all') && attendanceList.unresponsive.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                  미응답 ({attendanceList.unresponsive.length}명)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {attendanceList.unresponsive.map((m, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200 text-xs font-medium text-gray-700">
                      {m.name}
                      <span className="text-[9px] text-gray-400">· {m.clubName}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Absent list */}
            {attendanceList.absent.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-orange-700 mb-2 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                  불참 신고 ({attendanceList.absent.length}명)
                </p>
                <div className="space-y-1.5">
                  {attendanceList.absent.map((m, i) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 px-3 py-2 rounded-xl bg-orange-50 border border-orange-100">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground-800">{m.name}</span>
                        <span className="text-[10px] text-orange-500">· {m.clubName}</span>
                      </div>
                      {m.reason && (
                        <span className="text-xs text-orange-600 sm:ml-auto">{m.reason}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {attendanceList.attended.length === 0 && attendanceList.absent.length === 0 && attendanceList.unresponsive.length === 0 && (
              <p className="text-sm text-foreground-400 text-center py-4">아직 오늘 출석 데이터가 없어요</p>
            )}
            {attendanceFilter === 'absent' && attendanceList.absent.length === 0 && attendanceList.unresponsive.length === 0 && (
              <p className="text-sm text-emerald-600 text-center py-4">
                <i className="ri-check-double-line mr-1"></i> 전원 출석 완료!
              </p>
            )}

            <div className="mt-3 pt-3 border-t border-background-200">
              <Link to="/dashboard/attendance" className="text-xs text-primary-600 hover:text-primary-700 font-medium cursor-pointer flex items-center gap-1">
                실시간 출석 현황판 보기 <i className="ri-arrow-right-line"></i>
              </Link>
            </div>
          </div>

          {/* 2-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left column: Reports */}
            <div className="space-y-6">
              {/* Weekly Reports */}
              <div className="bg-background-100 border border-background-200 rounded-[20px] p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-foreground-950 flex items-center gap-2">
                    <i className="ri-file-list-3-line text-primary-600"></i>
                    주간 보고서
                  </h3>
                  <Link to="/reports/weekly" className="text-xs text-primary-600 hover:text-primary-700 cursor-pointer">전체보기 →</Link>
                </div>
                {weeklyReports.length === 0 ? (
                  <p className="text-sm text-foreground-600 text-center py-6">아직 보고서가 없어요</p>
                ) : (
                  <div className="space-y-2">
                    {weeklyReports.slice(0, 5).map((r: any) => (
                      <Link key={r.id} to={`/reports/weekly/${r.id}`} className="block bg-background-50 hover:bg-background-200/60 rounded-xl p-3 transition-colors cursor-pointer">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground-800 truncate">{r.author_name}</p>
                            <p className="text-xs text-foreground-600 truncate">{r.progress_summary}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            {r.club && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700">{CLUB_LABELS[r.club as ClubType]?.split(' ')[0]}</span>}
                            <span className="text-[10px] text-foreground-500">{formatDate(r.created_at)}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Growth Records */}
              <div className="bg-background-100 border border-background-200 rounded-[20px] p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-foreground-950 flex items-center gap-2">
                    <i className="ri-plant-line text-emerald-600"></i>
                    성장 기록
                  </h3>
                  <Link to="/reports/growth" className="text-xs text-primary-600 hover:text-primary-700 cursor-pointer">전체보기 →</Link>
                </div>
                {growthRecords.length === 0 ? (
                  <p className="text-sm text-foreground-600 text-center py-6">아직 성장 기록이 없어요</p>
                ) : (
                  <div className="space-y-2">
                    {growthRecords.slice(0, 5).map((r: any) => (
                      <Link key={r.id} to={`/reports/growth/${r.id}`} className="block bg-background-50 hover:bg-background-200/60 rounded-xl p-3 transition-colors cursor-pointer">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground-800 truncate">{r.student_name}</p>
                            <p className="text-xs text-foreground-600 truncate">{r.spiritual_growth}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            {r.club && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{CLUB_LABELS[r.club as ClubType]?.split(' ')[0]}</span>}
                            <span className="text-[10px] text-foreground-500">{formatDate(r.created_at)}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right column: QnA + Marathon */}
            <div className="space-y-6">
              {/* Unanswered QnA */}
              <div className="bg-background-100 border border-background-200 rounded-[20px] p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-foreground-950 flex items-center gap-2">
                    <i className="ri-question-answer-line text-amber-600"></i>
                    미답변 질문
                  </h3>
                  <Link to="/qna-board" className="text-xs text-primary-600 hover:text-primary-700 cursor-pointer">전체보기 →</Link>
                </div>
                {unansweredQnA.length === 0 ? (
                  <p className="text-sm text-foreground-600 text-center py-6">미답변 질문이 없어요</p>
                ) : (
                  <div className="space-y-2">
                    {unansweredQnA.slice(0, 5).map((q: any) => (
                      <Link key={q.id} to="/qna-board" className="block bg-amber-50 hover:bg-amber-100 rounded-xl p-3 transition-colors cursor-pointer">
                        <p className="text-sm text-foreground-800 line-clamp-2 mb-1">{q.question}</p>
                        <p className="text-[10px] text-foreground-500">{formatDate(q.created_at)}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Pending Marathon */}
              <div className="bg-background-100 border border-background-200 rounded-[20px] p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-foreground-950 flex items-center gap-2">
                    <i className="ri-book-open-line text-rose-600"></i>
                    묵상 확인 대기
                  </h3>
                  <Link to="/bible-marathon" className="text-xs text-primary-600 hover:text-primary-700 cursor-pointer">전체보기 →</Link>
                </div>
                {pendingMarathon.length === 0 ? (
                  <p className="text-sm text-foreground-600 text-center py-6">확인 대기 중인 묵상이 없어요</p>
                ) : (
                  <div className="space-y-2">
                    {pendingMarathon.slice(0, 5).map((m) => (
                      <div key={m.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-rose-50 hover:bg-rose-100 rounded-xl p-3 transition-colors gap-2">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-semibold text-foreground-800">{m.student_name}</p>
                            {m.student_club && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-200 text-rose-700">{CLUB_LABELS[m.student_club as ClubType]?.split(' ')[0]}</span>
                            )}
                          </div>
                          <p className="text-xs text-foreground-600">{m.book} — {m.chapter}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={async () => {
                              if (!profile) return;
                              const { error: updateErr } = await supabase
                                .from('bible_marathon_entries')
                                .update({ status: 'confirmed', confirmed_by: profile.name, confirmed_at: new Date().toISOString() })
                                .eq('id', m.id);
                              if (!updateErr) {
                                setPendingMarathon(prev => prev.filter(e => e.id !== m.id));
                                supabase.from('notifications').insert({ user_id: (m as any).user_id, type: 'bible_confirm', title: '묵상 확인 완료', message: `${profile.name} 선생님이 ${m.book}의 묵상을 확인했습니다.` });
                              }
                            }}
                            className="px-3 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 cursor-pointer whitespace-nowrap"
                          >
                            확인
                          </button>
                          <button
                            onClick={async () => {
                              if (!profile) return;
                              const { error: updateErr } = await supabase
                                .from('bible_marathon_entries')
                                .update({ status: 'rejected', confirmed_by: profile.name, confirmed_at: new Date().toISOString() })
                                .eq('id', m.id);
                              if (!updateErr) {
                                setPendingMarathon(prev => prev.filter(e => e.id !== m.id));
                                supabase.from('notifications').insert({ user_id: (m as any).user_id, type: 'bible_reject', title: '묵상 반려', message: `${profile.name} 선생님이 ${m.book}의 묵상을 반려했습니다.` });
                              }
                            }}
                            className="px-3 py-1.5 rounded-full bg-rose-100 text-rose-600 text-xs font-medium hover:bg-rose-200 cursor-pointer whitespace-nowrap"
                          >
                            반려
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick links */}
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-6 gap-3">
            <Link to="/teacher-dashboard/quiz-manage" className="bg-background-100 border border-background-200 rounded-[20px] p-4 text-center hover:border-amber-300 transition-colors cursor-pointer">
              <i className="ri-question-answer-line text-2xl text-amber-500 mb-2 block"></i>
              <span className="text-xs font-semibold text-foreground-700">성경퀴즈 출제</span>
            </Link>
            <Link to="/teacher-dashboard/quote-manage" className="bg-background-100 border border-background-200 rounded-[20px] p-4 text-center hover:border-primary-300 transition-colors cursor-pointer">
              <i className="ri-chat-quote-line text-2xl text-primary-500 mb-2 block"></i>
              <span className="text-xs font-semibold text-foreground-700">어록 관리</span>
            </Link>
            <Link to="/reports/weekly" className="bg-background-100 border border-background-200 rounded-[20px] p-4 text-center hover:border-primary-300 transition-colors cursor-pointer">
              <i className="ri-file-list-3-line text-2xl text-primary-500 mb-2 block"></i>
              <span className="text-xs font-semibold text-foreground-700">주간 보고서</span>
            </Link>
            <Link to="/reports/growth" className="bg-background-100 border border-background-200 rounded-[20px] p-4 text-center hover:border-emerald-300 transition-colors cursor-pointer">
              <i className="ri-plant-line text-2xl text-emerald-500 mb-2 block"></i>
              <span className="text-xs font-semibold text-foreground-700">성장 기록</span>
            </Link>
            <Link to="/qna-board" className="bg-background-100 border border-background-200 rounded-[20px] p-4 text-center hover:border-amber-300 transition-colors cursor-pointer">
              <i className="ri-question-answer-line text-2xl text-amber-500 mb-2 block"></i>
              <span className="text-xs font-semibold text-foreground-700">질문 답변하기</span>
            </Link>
            <Link to="/bible-marathon" className="bg-background-100 border border-background-200 rounded-[20px] p-4 text-center hover:border-rose-300 transition-colors cursor-pointer">
              <i className="ri-book-open-line text-2xl text-rose-500 mb-2 block"></i>
              <span className="text-xs font-semibold text-foreground-700">묵상 확인</span>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
