import { formatLocalDate } from '@/lib/date';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_LABELS, CLUB_LABELS, ROLE_HIERARCHY } from '@/types/auth';
import type { ClubType, UserRole } from '@/types/auth';
import { clubs } from '@/mocks/clubs';
import { supabase } from '@/lib/supabase';

interface VisitationWidget {
  id: string;
  student_name: string;
  scheduled_at: string;
  topic: string | null;
}

interface DashboardCard {
  title: string;
  value: string;
  icon: string;
  color: string;
}

interface Suggestion {
  id: string;
  author_name: string;
  club: string;
  title: string;
  content: string;
  status: string;
  response: string | null;
  created_at: string;
}

interface MissionWallPreview {
  id: string;
  student_name: string;
  student_club: string;
  mission_title: string;
  mission_category: string;
  proof_image_url: string | null;
  proof_note: string | null;
  reviewed_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: '검토 중',
  reviewed: '검토 완료',
  responded: '답변 완료',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-primary-100 text-amber-700',
  reviewed: 'bg-emerald-100 text-accent-700',
  responded: 'bg-secondary-100 text-sky-700',
};

export default function Dashboard() {
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [greeting, setGreeting] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestionForm, setShowSuggestionForm] = useState(false);
  const [suggestionTitle, setSuggestionTitle] = useState('');
  const [suggestionContent, setSuggestionContent] = useState('');
  const [suggestionSubmitting, setSuggestionSubmitting] = useState(false);
  const [suggestionSuccess, setSuggestionSuccess] = useState(false);
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  const [weeklyVisitations, setWeeklyVisitations] = useState<VisitationWidget[]>([]);
  const suggestionSectionRef = useRef<HTMLDivElement>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState<Record<string, string>>({});
  const [recentProofs, setRecentProofs] = useState<MissionWallPreview[]>([]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('좋은 아침입니다');
    else if (hour < 18) setGreeting('좋은 오후입니다');
    else setGreeting('좋은 저녁입니다');
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data, error } = await supabase
          .from('suggestions')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setSuggestions((data as Suggestion[]) || []);
      } catch (err) {
        console.error('건의사항 불러오기 실패:', err);
        setSuggestions([]);
      }
    };
    fetchSuggestions();
  }, [location.key]);

  useEffect(() => {
    const fetchWeeklyVisitations = async () => {
      if (!profile || ROLE_HIERARCHY[profile.role as UserRole] < ROLE_HIERARCHY.assistant_zone_leader) {
        setWeeklyVisitations([]);
        return;
      }
      try {
        const now = new Date();
        const weekEnd = new Date(now);
        weekEnd.setDate(now.getDate() + 7);

        const { data, error } = await supabase
          .from('visitations')
          .select('id, student_name, scheduled_at, topic')
          .eq('visitor_id', profile.user_id)
          .eq('status', 'scheduled')
          .gte('scheduled_at', now.toISOString())
          .lte('scheduled_at', weekEnd.toISOString())
          .order('scheduled_at', { ascending: true });

        if (error) throw error;
        setWeeklyVisitations((data as VisitationWidget[]) || []);
      } catch {
        setWeeklyVisitations([]);
      }
    };
    fetchWeeklyVisitations();
  }, [profile]);

  useEffect(() => {
    const state = location.state as { openSuggestions?: boolean } | null;
    if (state?.openSuggestions) {
      setTimeout(() => {
        suggestionSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setShowSuggestionForm(true);
      }, 300);
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  useEffect(() => {
    if (!profile) return;
    const fetchStats = async () => {
      setStatsLoading(true);
      try {
        const { supabase: sb } = await import('@/lib/supabase');
        const role = profile.role as UserRole;
        const now = new Date();
        const stats: Record<string, string> = {};

        if (role === 'chief') {
          // 승인 대기: 3 tables, status = 'reviewed'
          const [wrR, grR, erR] = await Promise.all([
            sb.from('weekly_reports').select('*', { count: 'exact', head: true }).eq('status', 'reviewed'),
            sb.from('growth_records').select('*', { count: 'exact', head: true }).eq('status', 'reviewed'),
            sb.from('event_reports').select('*', { count: 'exact', head: true }).eq('status', 'reviewed'),
          ]);
          const pendingApproval = (wrR.count || 0) + (grR.count || 0) + (erR.count || 0);
          stats.pendingApproval = String(pendingApproval);

          // 출석률: 이번 달 attendance
          const monthStart = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
          const { count: attTotal } = await sb.from('attendance').select('*', { count: 'exact', head: true }).gte('attendance_date', monthStart);
          const { count: attPresent } = await sb.from('attendance').select('*', { count: 'exact', head: true }).gte('attendance_date', monthStart).eq('status', 'present');
          const attRate = attTotal && attTotal > 0 ? Math.round(((attPresent || 0) / attTotal) * 100) : 0;
          stats.attendanceRate = `${attRate}%`;

          // 전체 사명자 수
          const { count: totalMembers } = await sb.from('user_roles').select('*', { count: 'exact', head: true }).eq('role', 'member').eq('is_active', true);
          const memberCount = totalMembers || 0;

          // 보고서 제출률: 이번 달 보고서 수 / 전체 사명자 수 × 100%
          const monthIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          const [wrMonth, grMonth, erMonth] = await Promise.all([
            sb.from('weekly_reports').select('*', { count: 'exact', head: true }).gte('created_at', monthIso).neq('status', 'draft'),
            sb.from('growth_records').select('*', { count: 'exact', head: true }).gte('created_at', monthIso).neq('status', 'draft'),
            sb.from('event_reports').select('*', { count: 'exact', head: true }).gte('created_at', monthIso).neq('status', 'draft'),
          ]);
          const monthReports = (wrMonth.count || 0) + (grMonth.count || 0) + (erMonth.count || 0);
          const reportRate = memberCount > 0 ? Math.round((monthReports / memberCount) * 100) : 0;
          stats.reportSubmitRate = `${reportRate}%`;

          // 이번 달 보고서
          stats.monthReports = String(monthReports);
        } else if (role === 'teacher') {
          // 교사 검토 대기: 3 tables, status = 'president_reviewed'
          const [wrPR, grPR, erPR] = await Promise.all([
            sb.from('weekly_reports').select('*', { count: 'exact', head: true }).eq('status', 'president_reviewed'),
            sb.from('growth_records').select('*', { count: 'exact', head: true }).eq('status', 'president_reviewed'),
            sb.from('event_reports').select('*', { count: 'exact', head: true }).eq('status', 'president_reviewed'),
          ]);
          const teacherPending = (wrPR.count || 0) + (grPR.count || 0) + (erPR.count || 0);
          stats.teacherPending = String(teacherPending);

          // 검토 완료: 3 tables, status IN ('reviewed', 'approved')
          const [wrDone, grDone, erDone] = await Promise.all([
            sb.from('weekly_reports').select('*', { count: 'exact', head: true }).in('status', ['reviewed', 'approved']),
            sb.from('growth_records').select('*', { count: 'exact', head: true }).in('status', ['reviewed', 'approved']),
            sb.from('event_reports').select('*', { count: 'exact', head: true }).in('status', ['reviewed', 'approved']),
          ]);
          const teacherDone = (wrDone.count || 0) + (grDone.count || 0) + (erDone.count || 0);
          stats.teacherDone = String(teacherDone);

          // 전체 사명자: teacher가 담당하는 club의 member count
          const { data: teacherClubs } = await sb.from('club_teachers').select('club').eq('teacher_id', profile.user_id);
          let memberQuery = sb.from('user_roles').select('*', { count: 'exact', head: true }).eq('role', 'member').eq('is_active', true);
          if (teacherClubs && teacherClubs.length > 0) {
            const clubList = teacherClubs.map((c: { club: string }) => c.club);
            memberQuery = memberQuery.in('club', clubList);
          }
          const { count: tMembers } = await memberQuery;
          const totalTeacherMembers = tMembers || 0;
          stats.totalMissionaries = String(totalTeacherMembers);

          // 이번 주 제출률 (weekly_reports only)
          const monday = new Date(now);
          monday.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
          monday.setHours(0, 0, 0, 0);
          const { count: weekSubmitted } = await sb.from('weekly_reports').select('*', { count: 'exact', head: true }).gte('created_at', monday.toISOString()).neq('status', 'draft');
          const weekRate = totalTeacherMembers > 0 ? Math.round(((weekSubmitted || 0) / totalTeacherMembers) * 100) : 0;
          stats.weekSubmitRate = `${weekRate}%`;
        } else if (role === 'president') {
          // 회장 검토 대기: 3 tables, status = 'submitted'
          const [wrSub, grSub, erSub] = await Promise.all([
            sb.from('weekly_reports').select('*', { count: 'exact', head: true }).eq('status', 'submitted'),
            sb.from('growth_records').select('*', { count: 'exact', head: true }).eq('status', 'submitted'),
            sb.from('event_reports').select('*', { count: 'exact', head: true }).eq('status', 'submitted'),
          ]);
          const presPending = (wrSub.count || 0) + (grSub.count || 0) + (erSub.count || 0);
          stats.presidentPending = String(presPending);

          // 검토 완료: status != 'submitted' (president_reviewed, reviewed, approved)
          const [wrDoneP, grDoneP, erDoneP] = await Promise.all([
            sb.from('weekly_reports').select('*', { count: 'exact', head: true }).neq('status', 'submitted'),
            sb.from('growth_records').select('*', { count: 'exact', head: true }).neq('status', 'submitted'),
            sb.from('event_reports').select('*', { count: 'exact', head: true }).neq('status', 'submitted'),
          ]);
          const presDone = (wrDoneP.count || 0) + (grDoneP.count || 0) + (erDoneP.count || 0);
          stats.presidentDone = String(presDone);

          // 이번 주 제출: 3 tables, created_at >= monday
          const mon = new Date(now);
          mon.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
          mon.setHours(0, 0, 0, 0);
          const monIso = mon.toISOString();
          const [wrWeekP, grWeekP, erWeekP] = await Promise.all([
            sb.from('weekly_reports').select('*', { count: 'exact', head: true }).gte('created_at', monIso),
            sb.from('growth_records').select('*', { count: 'exact', head: true }).gte('created_at', monIso),
            sb.from('event_reports').select('*', { count: 'exact', head: true }).gte('created_at', monIso),
          ]);
          const presWeek = (wrWeekP.count || 0) + (grWeekP.count || 0) + (erWeekP.count || 0);
          stats.presidentWeek = String(presWeek);

          // 전체 보고서
          const [wrAllP, grAllP, erAllP] = await Promise.all([
            sb.from('weekly_reports').select('*', { count: 'exact', head: true }),
            sb.from('growth_records').select('*', { count: 'exact', head: true }),
            sb.from('event_reports').select('*', { count: 'exact', head: true }),
          ]);
          const presAll = (wrAllP.count || 0) + (grAllP.count || 0) + (erAllP.count || 0);
          stats.presidentAll = String(presAll);
        } else {
          // 사명자 (missionary)
          // 내 담당 학생
          const { count: myMembers } = await sb.from('user_roles').select('*', { count: 'exact', head: true }).eq('club', profile.club || '').eq('role', 'member').eq('is_active', true);
          stats.myMembers = String(myMembers || 0);

          // 작성한 보고서
          const [wrAuth, grAuth, erAuth] = await Promise.all([
            sb.from('weekly_reports').select('*', { count: 'exact', head: true }).eq('author_id', profile.user_id),
            sb.from('growth_records').select('*', { count: 'exact', head: true }).eq('author_id', profile.user_id),
            sb.from('event_reports').select('*', { count: 'exact', head: true }).eq('author_id', profile.user_id),
          ]);
          const written = (wrAuth.count || 0) + (grAuth.count || 0) + (erAuth.count || 0);
          stats.writtenReports = String(written);

          // 승인된 보고서
          const [wrApp, grApp, erApp] = await Promise.all([
            sb.from('weekly_reports').select('*', { count: 'exact', head: true }).eq('author_id', profile.user_id).eq('status', 'approved'),
            sb.from('growth_records').select('*', { count: 'exact', head: true }).eq('author_id', profile.user_id).eq('status', 'approved'),
            sb.from('event_reports').select('*', { count: 'exact', head: true }).eq('author_id', profile.user_id).eq('status', 'approved'),
          ]);
          const approved = (wrApp.count || 0) + (grApp.count || 0) + (erApp.count || 0);
          stats.approvedReports = String(approved);

          // 미처리 피드백 (rejected)
          const [wrRej, grRej, erRej] = await Promise.all([
            sb.from('weekly_reports').select('*', { count: 'exact', head: true }).eq('author_id', profile.user_id).eq('status', 'rejected'),
            sb.from('growth_records').select('*', { count: 'exact', head: true }).eq('author_id', profile.user_id).eq('status', 'rejected'),
            sb.from('event_reports').select('*', { count: 'exact', head: true }).eq('author_id', profile.user_id).eq('status', 'rejected'),
          ]);
          const rejected = (wrRej.count || 0) + (grRej.count || 0) + (erRej.count || 0);
          stats.unprocessedFeedback = String(rejected);
        }

        setDashboardStats(stats);
      } catch (err) {
        console.error('대시보드 통계 조회 실패:', err);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, [profile?.user_id, profile?.role, profile?.club]);

  useEffect(() => {
    const fetchRecentProofs = async () => {
      try {
        const { data: aData } = await supabase
          .from('mission_assignments')
          .select('id, student_id, mission_id, proof_image_url, proof_note, reviewed_at')
          .eq('status', 'completed')
          .order('reviewed_at', { ascending: false })
          .limit(4);

        if (!aData || aData.length === 0) { setRecentProofs([]); return; }

        const missionIds = [...new Set(aData.map((a: { mission_id: string }) => a.mission_id))];
        const studentIds = [...new Set(aData.map((a: { student_id: string }) => a.student_id))];

        const [{ data: mData }, { data: uData }] = await Promise.all([
          supabase.from('missions').select('id, title, category').in('id', missionIds),
          supabase.from('user_roles').select('user_id, name, club').in('user_id', studentIds).eq('is_active', true),
        ]);

        const missionMap = new Map((mData || []).map((m: { id: string; title: string; category: string }) => [m.id, m]));
        const userMap = new Map((uData || []).map((u: { user_id: string; name: string; club: string }) => [u.user_id, u]));

        setRecentProofs(aData.map((a: { id: string; student_id: string; mission_id: string; proof_image_url: string | null; proof_note: string | null; reviewed_at: string }) => {
          const m = missionMap.get(a.mission_id);
          const u = userMap.get(a.student_id);
          return {
            id: a.id,
            student_name: u?.name || '알 수 없음',
            student_club: u?.club || '',
            mission_title: m?.title || '삭제된 미션',
            mission_category: m?.category || 'general',
            proof_image_url: a.proof_image_url,
            proof_note: a.proof_note,
            reviewed_at: a.reviewed_at,
          };
        }));
      } catch {
        setRecentProofs([]);
      }
    };
    fetchRecentProofs();
  }, []);

  const handleSubmitSuggestion = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestionTitle.trim() || !suggestionContent.trim() || !profile) return;

    setSuggestionSubmitting(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) throw new Error('로그인 정보를 찾을 수 없습니다');

      const { error } = await supabase
        .from('suggestions')
        .insert({
          author_id: userId,
          author_name: profile.name,
          club: profile.club || null,
          title: suggestionTitle.trim(),
          content: suggestionContent.trim(),
          status: 'pending',
        });

      if (error) throw error;

      const { data, error: fetchError } = await supabase
        .from('suggestions')
        .select('*')
        .order('created_at', { ascending: false });

      if (!fetchError && data) {
        setSuggestions(data as Suggestion[]);
      }

      setSuggestionTitle('');
      setSuggestionContent('');
      setShowSuggestionForm(false);
      setSuggestionSuccess(true);
      setTimeout(() => setSuggestionSuccess(false), 3000);
    } catch (err) {
      console.error('건의사항 제출 실패:', err);
    } finally {
      setSuggestionSubmitting(false);
    }
  }, [suggestionTitle, suggestionContent, profile]);

  const role = profile?.role as UserRole;
  const myClub = profile?.club ? clubs.find((c) => c.id === profile.club) : null;

  if (!profile) return null;

  const missionaryCards: DashboardCard[] = [
    { title: '내 담당 학생', value: statsLoading ? '...' : (dashboardStats.myMembers || '--'), icon: 'ri-user-star-line', color: 'amber' },
    { title: '작성한 보고서', value: statsLoading ? '...' : (dashboardStats.writtenReports || '--'), icon: 'ri-file-text-line', color: 'emerald' },
    { title: '승인된 보고서', value: statsLoading ? '...' : (dashboardStats.approvedReports || '--'), icon: 'ri-check-double-line', color: 'sky' },
    { title: '미처리 피드백', value: statsLoading ? '...' : (dashboardStats.unprocessedFeedback || '--'), icon: 'ri-feedback-line', color: 'rose' },
  ];

  const teacherCards: DashboardCard[] = [
    { title: '교사 검토 대기', value: statsLoading ? '...' : (dashboardStats.teacherPending || '--'), icon: 'ri-file-search-line', color: 'amber' },
    { title: '검토 완료', value: statsLoading ? '...' : (dashboardStats.teacherDone || '--'), icon: 'ri-check-line', color: 'emerald' },
    { title: '전체 사명자', value: statsLoading ? '...' : (dashboardStats.totalMissionaries || '--'), icon: 'ri-team-line', color: 'sky' },
    { title: '이번 주 제출률', value: statsLoading ? '...' : (dashboardStats.weekSubmitRate || '--'), icon: 'ri-pie-chart-line', color: 'rose' },
  ];

  const presidentCards: DashboardCard[] = [
    { title: '회장 검토 대기', value: statsLoading ? '...' : (dashboardStats.presidentPending || '--'), icon: 'ri-file-search-line', color: 'teal' },
    { title: '검토 완료', value: statsLoading ? '...' : (dashboardStats.presidentDone || '--'), icon: 'ri-check-line', color: 'emerald' },
    { title: '이번 주 제출', value: statsLoading ? '...' : (dashboardStats.presidentWeek || '--'), icon: 'ri-send-plane-line', color: 'amber' },
    { title: '전체 보고서', value: statsLoading ? '...' : (dashboardStats.presidentAll || '--'), icon: 'ri-file-list-line', color: 'sky' },
  ];

  const chiefCards: DashboardCard[] = [
    { title: '승인 대기', value: statsLoading ? '...' : (dashboardStats.pendingApproval || '--'), icon: 'ri-hourglass-line', color: 'amber' },
    { title: '출석률', value: statsLoading ? '...' : (dashboardStats.attendanceRate || '--'), icon: 'ri-user-heart-line', color: 'emerald' },
    { title: '보고서 제출률', value: statsLoading ? '...' : (dashboardStats.reportSubmitRate || '--'), icon: 'ri-pie-chart-line', color: 'sky' },
    { title: '이번 달 보고서', value: statsLoading ? '...' : (dashboardStats.monthReports || '--'), icon: 'ri-file-list-line', color: 'rose' },
    { title: '활성 동아리', value: `${clubs.length}`, icon: 'ri-shapes-line', color: 'teal' },
  ];

  const cards = role === 'chief' ? chiefCards : role === 'teacher' ? teacherCards : role === 'president' ? presidentCards : missionaryCards;

  const isTeacherOrAbove = ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.teacher;
  const canViewAllSuggestions = ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.teacher;

  const visibleSuggestions = suggestions.filter(s => {
    if (canViewAllSuggestions) return true;
    if (profile && s.author_name === profile.name) return true;
    return false;
  });

  const hiddenCount = suggestions.length - visibleSuggestions.length;

  const colorMap: Record<string, string> = {
    amber: 'bg-primary-50 text-primary-600',
    emerald: 'bg-accent-50 text-accent-600',
    sky: 'bg-secondary-50 text-secondary-600',
    rose: 'bg-rose-50 text-rose-600',
    teal: 'bg-teal-50 text-teal-600',
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="mb-6 md:mb-8">
          <h1 className="text-xl md:text-2xl font-bold text-foreground-950 mb-1">
            {greeting}, {profile.name}님
          </h1>
          <div className="flex items-center gap-3 text-sm text-foreground-600">
            <span className="flex items-center gap-1.5">
              <i className="ri-shield-user-line"></i>
              {ROLE_LABELS[role]}
            </span>
            {profile.club && (
              <span className="flex items-center gap-1.5">
                <i className="ri-group-line"></i>
                {CLUB_LABELS[profile.club as ClubType]}
              </span>
            )}
            {profile.zone && (
              <span className="flex items-center gap-1.5">
                <i className="ri-map-pin-line"></i>
                {profile.zone}
              </span>
            )}
          </div>
        </div>

        <div className={`grid grid-cols-2 ${role === 'chief' ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-2 md:gap-4 mb-6 md:mb-8`}>
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.08 }}
              className="bg-background-100 rounded-2xl p-5 shadow-card"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colorMap[card.color]}`}>
                <i className={`${card.icon} text-xl`}></i>
              </div>
              {statsLoading ? (
                <div className="w-12 h-7 bg-background-200 rounded-md animate-pulse mb-1"></div>
              ) : (
                <p className="text-2xl font-bold text-foreground-950 mb-1">{card.value}</p>
              )}
              <p className="text-xs text-foreground-500">{card.title}</p>
            </motion.div>
          ))}
        </div>

        {myClub && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.32 }}
            className="bg-background-100 rounded-2xl p-6 shadow-card mb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground-950">내 동아리</h2>
              <Link
                to={`/clubs/${myClub.id}`}
                className="text-sm text-primary-600 hover:text-amber-700 font-medium whitespace-nowrap cursor-pointer"
              >
                자세히 보기
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl ${myClub.iconBg} flex items-center justify-center`}>
                <i className={`ri-music-line text-2xl ${myClub.iconText}`}></i>
              </div>
              <div>
                <p className="font-bold text-foreground-950">{myClub.name}</p>
                <p className="text-sm text-foreground-600">{myClub.subtitle}</p>
                <p className="text-xs text-foreground-500 mt-1">{myClub.schedule}</p>
              </div>
            </div>
          </motion.div>
        )}

        {weeklyVisitations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.36 }}
            className="bg-background-100 rounded-2xl p-6 shadow-card mb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground-950 flex items-center gap-2">
                <i className="ri-heart-pulse-line text-primary-600"></i>
                이번 주 내 심방 일정
              </h2>
              <Link
                to="/visitations"
                className="text-sm text-primary-600 hover:text-primary-700 font-medium whitespace-nowrap cursor-pointer"
              >
                전체 보기
              </Link>
            </div>
            <div className="space-y-2">
              {weeklyVisitations.map((v, i) => {
                const d = new Date(v.scheduled_at);
                const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
                const dayLabel = `${d.getMonth() + 1}/${d.getDate()} (${weekdays[d.getDay()]})`;
                const timeLabel = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                return (
                  <Link
                    key={v.id}
                    to={`/visitations/${v.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl bg-background-50 hover:bg-primary-50 transition-colors cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                      <i className="ri-user-heart-line text-primary-500"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground-800 group-hover:text-foreground-950">{v.student_name} 학생</p>
                      <p className="text-xs text-foreground-500">{dayLabel} {timeLabel}{v.topic ? ` · ${v.topic}` : ''}</p>
                    </div>
                    <i className="ri-arrow-right-s-line text-foreground-400 group-hover:text-primary-500 transition-colors"></i>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="bg-background-100 rounded-2xl p-6 shadow-card mb-6"
        >
          <h2 className="text-lg font-bold text-foreground-950 mb-4">빠른 메뉴</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
            {ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.assistant_zone_leader && (
              <>
              <Link
                to="/reports/weekly"
                className="flex items-center gap-2.5 p-3 rounded-xl bg-background-50 hover:bg-primary-50 transition-colors cursor-pointer group"
              >
                <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center">
                  <i className="ri-file-add-line text-primary-600"></i>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground-800 group-hover:text-gray-900">주간 보고서</p>
                  <p className="text-xs text-foreground-500">작성하기</p>
                </div>
              </Link>
              <Link
                to="/reports/growth"
                className="flex items-center gap-2.5 p-3 rounded-xl bg-background-50 hover:bg-accent-50 transition-colors cursor-pointer group"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <i className="ri-plant-line text-accent-600"></i>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground-800 group-hover:text-gray-900">성장 기록</p>
                  <p className="text-xs text-foreground-500">학생별 관리</p>
                </div>
              </Link>
              <Link
                to="/reports/events"
                className="flex items-center gap-2.5 p-3 rounded-xl bg-background-50 hover:bg-violet-50 transition-colors cursor-pointer group"
              >
                <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center">
                  <i className="ri-calendar-event-line text-violet-600"></i>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground-800 group-hover:text-gray-900">행사 보고서</p>
                  <p className="text-xs text-foreground-500">행사별 기록</p>
                </div>
              </Link>
              </>
            )}
            <Link
              to="/dashboard/attendance"
              className="flex items-center gap-2.5 p-3 rounded-xl bg-background-50 hover:bg-accent-50 transition-colors cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-lg bg-accent-100 flex items-center justify-center">
                <i className="ri-user-heart-line text-accent-600"></i>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground-800 group-hover:text-gray-900">스마트 출석</p>
                <p className="text-xs text-foreground-500">원클릭 체크인</p>
              </div>
            </Link>
            <button
              onClick={() => {
                suggestionSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                setShowSuggestionForm(true);
              }}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-background-50 hover:bg-primary-50 transition-colors cursor-pointer group text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center">
                <i className="ri-lightbulb-line text-primary-600"></i>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground-800 group-hover:text-gray-900">건의사항</p>
                <p className="text-xs text-foreground-500">의견 남기기</p>
              </div>
            </button>
            {role === 'president' && (
              <Link
                to="/reports/review"
                className="flex items-center gap-2.5 p-3 rounded-xl bg-background-50 hover:bg-primary-50 transition-colors cursor-pointer group"
              >
                <div className="w-9 h-9 rounded-lg bg-teal-100 flex items-center justify-center">
                  <i className="ri-file-search-line text-teal-600"></i>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground-800 group-hover:text-gray-900">보고서 검토</p>
                  <p className="text-xs text-foreground-500">회장 검토</p>
                </div>
              </Link>
            )}
            {ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.teacher && (
              <Link
                to="/reports/review"
                className="flex items-center gap-2.5 p-3 rounded-xl bg-background-50 hover:bg-primary-50 transition-colors cursor-pointer group"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <i className="ri-file-search-line text-accent-600"></i>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground-800 group-hover:text-gray-900">보고서 검토</p>
                  <p className="text-xs text-foreground-500">피드백</p>
                </div>
              </Link>
            )}
            {ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.chief && (
              <>
                <Link
                  to="/admin/roles"
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-background-50 hover:bg-primary-50 transition-colors cursor-pointer group"
                >
                  <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center">
                    <i className="ri-shield-keyhole-line text-violet-600"></i>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground-800 group-hover:text-gray-900">권한 관리</p>
                    <p className="text-xs text-foreground-500">역할·소속</p>
                  </div>
                </Link>
                <Link
                  to="/admin/approvals"
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-background-50 hover:bg-primary-50 transition-colors cursor-pointer group"
                >
                  <div className="w-9 h-9 rounded-lg bg-secondary-100 flex items-center justify-center">
                    <i className="ri-check-double-line text-secondary-600"></i>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground-800 group-hover:text-gray-900">최종 승인</p>
                    <p className="text-xs text-foreground-500">관리</p>
                  </div>
                </Link>
                <Link
                  to="/admin/strategy"
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-background-50 hover:bg-primary-50 transition-colors cursor-pointer group"
                >
                  <div className="w-9 h-9 rounded-lg bg-rose-100 flex items-center justify-center">
                    <i className="ri-bar-chart-line text-rose-600"></i>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground-800 group-hover:text-gray-900">전략 대시보드</p>
                    <p className="text-xs text-foreground-500">지표 분석</p>
                  </div>
                </Link>
              </>
            )}
            <Link
              to="/notices"
              className="flex items-center gap-2.5 p-3 rounded-xl bg-background-50 hover:bg-primary-50 transition-colors cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center">
                <i className="ri-megaphone-line text-violet-600"></i>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground-800 group-hover:text-gray-900">공지사항</p>
                <p className="text-xs text-foreground-500">확인하기</p>
              </div>
            </Link>
          </div>
        </motion.div>

        {recentProofs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.44 }}
            className="bg-background-100 rounded-2xl p-6 shadow-card mb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground-950 flex items-center gap-2">
                <i className="ri-gallery-line text-emerald-600"></i>
                최근 사명 인증
              </h2>
              <Link
                to="/missions/wall"
                className="text-sm text-primary-600 hover:text-primary-700 font-medium whitespace-nowrap cursor-pointer"
              >
                전체보기
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {recentProofs.map((p) => (
                <Link
                  key={p.id}
                  to="/missions/wall"
                  className="bg-background-50 rounded-xl p-3 hover:bg-emerald-50 transition-colors cursor-pointer group"
                >
                  <div className="w-full aspect-square rounded-lg bg-background-200 overflow-hidden mb-2">
                    {p.proof_image_url ? (
                      <img src={p.proof_image_url} alt={p.mission_title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <i className="ri-checkbox-circle-line text-2xl text-foreground-300"></i>
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-foreground-900 truncate">{p.mission_title}</p>
                  <p className="text-[10px] text-foreground-500 mt-0.5 truncate">{p.student_name}</p>
                  {p.proof_note && (
                    <p className="text-[10px] text-foreground-400 mt-1 line-clamp-1">"{p.proof_note}"</p>
                  )}
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div
          ref={suggestionSectionRef}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.48 }}
          className="bg-background-100 rounded-2xl p-6 shadow-card scroll-mt-24"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-foreground-950">건의사항</h2>
              <p className="text-xs text-foreground-500 mt-0.5">
                {isTeacherOrAbove
                  ? '전체 건의사항을 확인하고 답변할 수 있습니다'
                  : '학생회 운영에 대한 의견을 자유롭게 남겨주세요'}
              </p>
            </div>
            <button
              onClick={() => {
                setShowSuggestionForm(!showSuggestionForm);
                setSuggestionSuccess(false);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap cursor-pointer"
            >
              <i className={`text-base ${showSuggestionForm ? 'ri-close-line' : 'ri-add-line'}`}></i>
              {showSuggestionForm ? '닫기' : '건의하기'}
            </button>
          </div>

          <AnimatePresence>
            {suggestionSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-4 px-4 py-3 bg-accent-50 border border-accent-200 rounded-xl flex items-center gap-2 text-sm text-accent-700"
              >
                <i className="ri-check-line text-emerald-500"></i>
                건의사항이 제출되었습니다. 검토 후 답변 드리겠습니다.
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showSuggestionForm && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                onSubmit={handleSubmitSuggestion}
                className="mb-5 overflow-hidden"
              >
                <div className="p-4 bg-primary-50/50 rounded-xl border border-amber-100">
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-foreground-600 mb-1.5">제목</label>
                    <input
                      type="text"
                      name="suggestion_title"
                      value={suggestionTitle}
                      onChange={(e) => setSuggestionTitle(e.target.value)}
                      placeholder="건의사항 제목을 입력해주세요"
                      maxLength={100}
                      className="w-full px-3 py-2.5 text-sm bg-background-100 border border-background-200 rounded-lg outline-none focus:border-primary-400 transition-colors"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-foreground-600 mb-1.5">내용</label>
                    <textarea
                      name="suggestion_content"
                      value={suggestionContent}
                      onChange={(e) => setSuggestionContent(e.target.value)}
                      placeholder="구체적인 건의 내용을 작성해주세요 (특수문자, 이모지, 줄바꿈 모두 가능)"
                      maxLength={2000}
                      rows={5}
                      className="w-full px-3 py-2.5 text-sm bg-background-100 border border-background-200 rounded-lg outline-none focus:border-primary-400 transition-colors resize-none"
                    ></textarea>
                    <p className="text-xs text-foreground-500 mt-1 text-right">{suggestionContent.length}/2000</p>
                  </div>
                  <button
                    type="submit"
                    disabled={suggestionSubmitting || !suggestionTitle.trim() || !suggestionContent.trim()}
                    className="w-full py-2.5 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
                  >
                    {suggestionSubmitting ? '제출 중...' : '건의사항 제출하기'}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {suggestions.length === 0 ? (
            <div className="text-center py-10 text-foreground-500">
              <i className="ri-chat-smile-2-line text-3xl block mb-2"></i>
              <p className="text-sm">아직 등록된 건의사항이 없습니다</p>
              <p className="text-xs mt-1">첫 번째 건의사항을 작성해보세요!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {hiddenCount > 0 && (
                <p className="text-xs text-foreground-500 text-center py-1">{visibleSuggestions.length}개의 건의사항만 표시됩니다 ({hiddenCount}건 숨김)</p>
              )}
              {visibleSuggestions.map((suggestion, idx) => {
                const isExpanded = expandedSuggestion === suggestion.id;
                const clubInfo = clubs.find((c) => c.id === suggestion.club);
                return (
                  <motion.div
                    key={suggestion.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: idx * 0.04 }}
                    className="relative border border-background-200 rounded-xl overflow-hidden"
                  >
                    <button
                      onClick={() =>
                        setExpandedSuggestion(isExpanded ? null : suggestion.id)
                      }
                      className="w-full p-4 text-left hover:bg-background-50/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <i className="ri-lightbulb-line text-amber-500"></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="hidden md:flex items-center gap-2 flex-wrap mb-1">
                            <p className="text-sm font-medium text-foreground-950 truncate">
                              {suggestion.title}
                            </p>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[suggestion.status]}`}
                            >
                              {STATUS_LABELS[suggestion.status]}
                            </span>
                          </div>
                          <p className="md:hidden text-sm font-medium text-foreground-950 truncate mb-1 pr-16">
                            {suggestion.title}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-foreground-500">
                            <span>{suggestion.author_name}</span>
                            {clubInfo && (
                              <>
                                <span className="text-gray-200">|</span>
                                <span>{clubInfo.name}</span>
                              </>
                            )}
                            <span className="text-gray-200">|</span>
                            <span>{new Date(suggestion.created_at).toLocaleDateString('ko-KR')}</span>
                          </div>
                        </div>
                        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                          <i
                            className={`text-foreground-500 text-sm transition-transform duration-200 ${
                              isExpanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'
                            }`}
                          ></i>
                        </div>
                      </div>
                    </button>
                    <span
                      className={`md:hidden absolute top-3 right-9 text-[10px] px-2 py-0.5 rounded-full font-bold pointer-events-none ${STATUS_COLORS[suggestion.status]}`}
                    >
                      {STATUS_LABELS[suggestion.status]}
                    </span>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pt-0 border-t border-gray-50">
                            <p className="text-sm text-foreground-700 leading-relaxed mt-3 whitespace-pre-wrap">
                              {suggestion.content}
                            </p>
                            {suggestion.response && (
                              <div className="mt-3 p-3 bg-secondary-50 rounded-lg">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <i className="ri-chat-quote-line text-sky-500 text-xs"></i>
                                  <span className="text-xs font-medium text-secondary-600">답변</span>
                                </div>
                                <p className="text-sm text-foreground-800 leading-relaxed whitespace-pre-wrap">
                                  {suggestion.response}
                                </p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}