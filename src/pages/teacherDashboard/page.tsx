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
    late: { name: string; club: string; clubName: string; reason: string; user_id: string }[];
    absent: { name: string; club: string; clubName: string; reason: string; user_id: string }[];
    unresponsive: { name: string; club: string; clubName: string; user_id: string }[];
  }>({ attended: [], late: [], absent: [], unresponsive: [] });

  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'absent'>('all');
  const [attendanceGradeFilter, setAttendanceGradeFilter] = useState('전체');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clubFilter, setClubFilter] = useState<ClubType | 'all'>('all');

  const targetClub = (): ClubType | 'all' => {
    if (isChief) return clubFilter;
    // 교사는 담당 동아리가 아니라 전체 학생 출결을 확인합니다.
    if (isTeacher) return 'all';
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
        .select('user_id, name, club, is_expelled, is_active')
        .eq('role', 'member');
      if (effectiveClub !== 'all') {
        studentsQuery = studentsQuery.eq('club', effectiveClub);
      }
      const { data: allStudentsRaw } = await studentsQuery;
      // 전체 학생 수는 user_id 기준으로 중복을 제거합니다.
      // 동아리 미지정 학생도 '전체' 집계에는 포함합니다.
      const uniqueStudents = new Map<string, { user_id: string; name: string; club: string | null; is_expelled?: boolean; is_active?: boolean }>();
      for (const rawStudent of ((allStudentsRaw || []) as { user_id: string; name: string; club: string | null; is_expelled?: boolean; is_active?: boolean }[])) {
        if (rawStudent.is_expelled || rawStudent.is_active === false) continue;
        const existing = uniqueStudents.get(rawStudent.user_id);
        if (!existing || (!existing.club && rawStudent.club)) {
          uniqueStudents.set(rawStudent.user_id, rawStudent);
        }
      }
      const allStudents = Array.from(uniqueStudents.values());

      if (attData && allStudents) {
        // 학생 기준(user_id)으로 하루에 한 건만 집계하여 중복 출결 row로 숫자가 부풀지 않게 합니다.
        const validUserIds = new Set(allStudents.map((s: { user_id: string }) => s.user_id));
        const latestByUser = new Map<string, any>();
        for (const record of (attData as any[])) {
          if (!validUserIds.has(record.user_id)) continue;
          const prev = latestByUser.get(record.user_id);
          if (!prev || new Date(record.checked_in_at || 0).getTime() >= new Date(prev.checked_in_at || 0).getTime()) {
            latestByUser.set(record.user_id, record);
          }
        }
        const validAttData = Array.from(latestByUser.values());

        const present = validAttData.filter((a: { status: string }) => a.status === 'attended').length;
        const late = validAttData.filter((a: { status: string }) => a.status === 'late').length;
        setAttendanceSummary({
          total: allStudents.length,
          present,
          late,
        } as any);

        const attendedUserIds = new Set(validAttData.filter((a: { status: string }) => a.status === 'attended').map((a: { user_id: string }) => a.user_id));
        const lateUserIds = new Set(validAttData.filter((a: { status: string }) => a.status === 'late').map((a: { user_id: string }) => a.user_id));
        const absentUserIds = new Set(validAttData.filter((a: { status: string }) => a.status === 'absent').map((a: { user_id: string }) => a.user_id));

        const attendedList: { name: string; club: string; clubName: string; user_id: string }[] = [];
        const lateList: { name: string; club: string; clubName: string; reason: string; user_id: string }[] = [];
        const absentList: { name: string; club: string; clubName: string; reason: string; user_id: string }[] = [];
        const unresponsiveList: { name: string; club: string; clubName: string; user_id: string }[] = [];

        for (const a of validAttData as { user_name: string; club: string; status: string; absence_reason: string | null; late_reason: string | null; user_id: string }[]) {
          const clubName = CLUB_LABELS[a.club as ClubType]?.split(' ')[0] || a.club;
          if (a.status === 'attended') {
            attendedList.push({ name: a.user_name, club: a.club, clubName, user_id: a.user_id });
          } else if (a.status === 'late') {
            lateList.push({ name: a.user_name, club: a.club, clubName, reason: a.late_reason || '', user_id: a.user_id });
          } else if (a.status === 'absent') {
            absentList.push({ name: a.user_name, club: a.club, clubName, reason: a.absence_reason || '', user_id: a.user_id });
          }
        }

        // Find unresponsive students (in user_roles but not in attendance)
        for (const s of allStudents as { user_id: string; name: string; club: string }[]) {
          if (!attendedUserIds.has(s.user_id) && !lateUserIds.has(s.user_id) && !absentUserIds.has(s.user_id)) {
            const clubName = CLUB_LABELS[s.club as ClubType]?.split(' ')[0] || s.club;
            unresponsiveList.push({ name: s.name, club: s.club, clubName, user_id: s.user_id });
          }
        }

        setAttendanceList({ attended: attendedList, late: lateList, absent: absentList, unresponsive: unresponsiveList });
      }
    } catch (e) {
      console.error('Teacher dashboard load error:', e);
      setError('대시보드 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const clubAttendanceBars = ALL_CLUBS.map((club) => {
    const present = attendanceList.attended.filter((m) => m.club === club).length;
    const late = attendanceList.late.filter((m) => m.club === club).length;
    const absent = attendanceList.absent.filter((m) => m.club === club).length;
    const unresponsive = attendanceList.unresponsive.filter((m) => m.club === club).length;
    const total = present + late + absent + unresponsive;
    return { club, label: CLUB_LABELS[club].split(' (')[0], present, late, absent, unresponsive, total, rate: total ? Math.round(((present + late) / total) * 100) : 0 };
  });

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
                <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">교사 대시보드</h1>
                <p className="text-sm text-foreground-600">
                  {effectiveClub !== 'all' ? `${CLUB_LABELS[effectiveClub]} 담당` : '전체 동아리'} · {profile?.name} 선생님
                </p>
              </div>

              {/* Club filter for chief */}
              {isChief && (
                <div className="flex items-center gap-1 bg-background-100 border border-background-200 rounded-full p-1">
                  <button onClick={() => setClubFilter('all')} className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${clubFilter === 'all' ? 'bg-background-100 text-foreground-950 shadow-sm' : 'text-foreground-600 hover:text-foreground-950'}`}>전체</button>
                  {ALL_CLUBS.map(c => <button key={c} onClick={() => setClubFilter(c)} className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${clubFilter === c ? 'bg-background-100 text-foreground-950 shadow-sm' : 'text-foreground-600 hover:text-foreground-950'}`}>{CLUB_LABELS[c].split(' ')[0]}</button>)}
                </div>
              )}
            </div>
          </div>

          {error && <div className="bg-accent-100 border border-accent-200 rounded-[20px] p-4 mb-6"><p className="text-sm text-accent-700 flex items-center gap-2"><i className="ri-error-warning-line"></i>{error}</p><button onClick={loadDashboardData} className="mt-2 text-xs text-accent-600 underline cursor-pointer">다시 시도</button></div>}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-background-100 border border-emerald-200 rounded-[20px] p-5 text-center"><div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mx-auto mb-2"><i className="ri-check-double-line text-emerald-600"></i></div><p className="text-2xl font-black text-emerald-700">{attendanceSummary.present}</p><p className="text-xs text-foreground-500">출석</p></div>
            <div className="bg-background-100 border border-amber-200 rounded-[20px] p-5 text-center"><div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mx-auto mb-2"><i className="ri-time-line text-amber-600"></i></div><p className="text-2xl font-black text-amber-700">{(attendanceSummary as any).late || 0}</p><p className="text-xs text-foreground-500">늦참</p></div>
            <div className="bg-background-100 border border-sky-200 rounded-[20px] p-5 text-center"><div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center mx-auto mb-2"><i className="ri-group-line text-sky-600"></i></div><p className="text-2xl font-black text-sky-700">{attendanceSummary.total}</p><p className="text-xs text-foreground-500">전체 학생</p></div>
          </div>

          <div className="bg-background-100 border border-background-200 rounded-[20px] p-5 mb-6"><div className="flex items-center justify-between mb-4"><h3 className="text-sm font-bold text-foreground-950 flex items-center gap-2"><i className="ri-bar-chart-2-line text-primary-600"></i>전체 출결 현황</h3><span className="text-xs text-foreground-500">출석 + 늦참 포함</span></div><div className="space-y-4">{[{label:'출석',value:attendanceList.attended.length,className:'bg-emerald-500',textClass:'text-emerald-700'},{label:'늦참',value:attendanceList.late.length,className:'bg-amber-500',textClass:'text-amber-700'},{label:'불참',value:attendanceList.absent.length,className:'bg-orange-500',textClass:'text-orange-700'},{label:'미응답',value:attendanceList.unresponsive.length,className:'bg-gray-400',textClass:'text-foreground-600'}].map(bar=>{const total=attendanceList.attended.length+attendanceList.late.length+attendanceList.absent.length+attendanceList.unresponsive.length;const percent=total?(bar.value/total)*100:0;return <div key={bar.label}><div className="flex items-center justify-between text-sm mb-1.5"><span className={`font-bold ${bar.textClass}`}>{bar.label}</span><span className="text-foreground-600 font-semibold">{bar.value}명 · {Math.round(percent)}%</span></div><div className="h-4 rounded-full bg-background-200 overflow-hidden"><div className={`h-full rounded-full ${bar.className} transition-all duration-500`} style={{width:`${percent}%`}} /></div></div>})}</div></div>

          <div className="bg-background-100 border border-background-200 rounded-[20px] p-5 mb-8"><div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4"><h3 className="text-sm font-bold text-foreground-950 flex items-center gap-2"><i className="ri-user-heart-line text-rose-600"></i>오늘 출석 현황 <span className="text-xs text-foreground-500 font-normal">(출석 {attendanceList.attended.length}명 · 늦참 {attendanceList.late.length}명 · 불참 {attendanceList.absent.length}명 · 미응답 {attendanceList.unresponsive.length}명)</span></h3><div className="flex items-center gap-1 bg-background-200 rounded-full p-0.5"><button onClick={()=>setAttendanceFilter('all')} className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${attendanceFilter==='all'?'bg-background-100 text-foreground-950 shadow-sm':'text-foreground-600'}`}>전체</button><button onClick={()=>setAttendanceFilter('absent')} className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${attendanceFilter==='absent'?'bg-background-100 text-foreground-950 shadow-sm':'text-foreground-600'}`}>미출석자만</button></div></div>

          {attendanceFilter==='all'&&attendanceList.attended.length>0&&<div className="mb-4"><p className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400"></span>출석 완료 ({attendanceList.attended.length}명)</p><div className="flex flex-wrap gap-1.5">{attendanceList.attended.map((m,i)=><span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-xs font-medium text-emerald-800">{m.name}<span className="text-[9px] text-emerald-500">· {m.clubName}</span></span>)}</div></div>}
          {attendanceFilter==='all'&&attendanceList.late.length>0&&<div className="mb-4"><p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span>늦참 ({attendanceList.late.length}명)</p><div className="space-y-1.5">{attendanceList.late.map((m,i)=><div key={i} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100"><div className="flex items-center gap-2"><span className="text-sm font-medium text-foreground-800">{m.name}</span><span className="text-[10px] text-amber-500">· {m.clubName}</span></div>{m.reason&&<span className="text-xs text-amber-700 sm:ml-auto">사유: {m.reason}</span>}</div>)}</div></div>}
          {attendanceFilter==='all'&&attendanceList.unresponsive.length>0&&<div className="mb-4"><p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400"></span>미응답 ({attendanceList.unresponsive.length}명)</p><div className="flex flex-wrap gap-1.5">{attendanceList.unresponsive.map((m,i)=><span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200 text-xs font-medium text-gray-700">{m.name}<span className="text-[9px] text-gray-400">· {m.clubName}</span><a href="tg://" className="ml-1 text-sky-600" aria-label={`${m.name} 텔레그램 심방`}><i className="ri-telegram-line"></i></a></span>)}</div></div>}
          {attendanceList.absent.length>0&&<div><p className="text-xs font-semibold text-orange-700 mb-2 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400"></span>불참 신고 ({attendanceList.absent.length}명)</p><div className="space-y-1.5">{attendanceList.absent.map((m,i)=><div key={i} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 px-3 py-2 rounded-xl bg-orange-50 border border-orange-100"><div className="flex items-center gap-2"><span className="text-sm font-medium text-foreground-800">{m.name}</span><span className="text-[10px] text-orange-500">· {m.clubName}</span></div>{m.reason&&<span className="text-xs text-orange-600 sm:ml-auto">{m.reason}</span>}<a href="tg://" className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-full bg-sky-500 text-white text-[11px] font-semibold sm:ml-1 whitespace-nowrap"><i className="ri-telegram-line"></i>텔레그램으로 심방하기</a></div>)}</div></div>}
          {attendanceFilter==='absent'&&attendanceList.absent.length===0&&attendanceList.late.length===0&&attendanceList.unresponsive.length===0&&<p className="text-sm text-emerald-600 text-center py-4"><i className="ri-check-double-line mr-1"></i>전원 출석 또는 늦참 처리되었습니다.</p>}
          </div>

          <div className="bg-background-100 border border-background-200 rounded-[20px] p-5 mb-8"><h3 className="text-sm font-bold text-foreground-950 mb-4 flex items-center gap-2"><i className="ri-pie-chart-line text-primary-600"></i>동아리별 출결</h3><div className="space-y-4">{clubAttendanceBars.map((b)=>{const total=b.total;return <div key={b.club}><div className="flex items-center justify-between text-xs mb-1"><span className="font-semibold">{b.label}</span><span>{b.rate}%</span></div><div className="h-3 rounded-full bg-background-200 overflow-hidden"><div className="h-full rounded-full bg-emerald-500" style={{width:`${b.rate}%`}}/></div><p className="text-[10px] text-foreground-500 mt-1">출석 {b.present} · 늦참 {b.late} · 불참 {b.absent} · 미응답 {b.unresponsive}</p></div>})}</div></div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6"><div className="bg-background-100 border border-background-200 rounded-[20px] p-5"><div className="flex items-center justify-between mb-4"><h3 className="text-sm font-bold text-foreground-950 flex items-center gap-2"><i className="ri-file-list-3-line text-primary-600"></i>주간 보고서</h3><Link to="/reports/weekly" className="text-xs text-primary-600">전체보기 →</Link></div>{weeklyReports.length===0?<p className="text-sm text-foreground-600 text-center py-6">아직 보고서가 없어요</p>:<div className="space-y-2">{weeklyReports.slice(0,5).map(r=><Link key={r.id} to={`/reports/weekly/${r.id}`} className="block bg-background-50 rounded-xl p-3"><p className="text-xs font-semibold">{r.author_name}</p><p className="text-xs text-foreground-600 truncate">{r.progress_summary}</p></Link>)}</div>}</div><div className="bg-background-100 border border-background-200 rounded-[20px] p-5"><div className="flex items-center justify-between mb-4"><h3 className="text-sm font-bold text-foreground-950 flex items-center gap-2"><i className="ri-plant-line text-emerald-600"></i>성장 기록</h3><Link to="/reports/growth" className="text-xs text-primary-600">전체보기 →</Link></div>{growthRecords.length===0?<p className="text-sm text-foreground-600 text-center py-6">아직 성장 기록이 없어요</p>:<div className="space-y-2">{growthRecords.slice(0,5).map(r=><Link key={r.id} to={`/reports/growth/${r.id}`} className="block bg-background-50 rounded-xl p-3"><p className="text-xs font-semibold">{r.student_name}</p><p className="text-xs text-foreground-600 truncate">{r.spiritual_growth}</p></Link>)}</div>}</div></div>
            <div className="space-y-6"><div className="bg-background-100 border border-background-200 rounded-[20px] p-5"><div className="flex items-center justify-between mb-4"><h3 className="text-sm font-bold text-foreground-950 flex items-center gap-2"><i className="ri-question-answer-line text-amber-600"></i>미답변 질문</h3><Link to="/qna-board" className="text-xs text-primary-600">전체보기 →</Link></div>{unansweredQnA.length===0?<p className="text-sm text-foreground-600 text-center py-6">미답변 질문이 없어요</p>:<div className="space-y-2">{unansweredQnA.slice(0,5).map(q=><div key={q.id} className="bg-background-50 rounded-xl p-3"><p className="text-xs font-semibold truncate">{q.question}</p></div>)}</div>}</div><div className="bg-background-100 border border-background-200 rounded-[20px] p-5"><div className="flex items-center justify-between mb-4"><h3 className="text-sm font-bold text-foreground-950 flex items-center gap-2"><i className="ri-book-open-line text-violet-600"></i>성경 마라톤 검토</h3><Link to="/bible-marathon" className="text-xs text-primary-600">전체보기 →</Link></div>{pendingMarathon.length===0?<p className="text-sm text-foreground-600 text-center py-6">검토할 기록이 없어요</p>:<div className="space-y-2">{pendingMarathon.slice(0,5).map(m=><div key={m.id} className="bg-background-50 rounded-xl p-3"><p className="text-xs font-semibold">{m.student_name}</p><p className="text-xs text-foreground-600">{m.book} {m.chapter}</p></div>)}</div>}</div></div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
