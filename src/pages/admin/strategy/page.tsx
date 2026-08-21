import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { ClubType } from '@/types/auth';
import { Link } from 'react-router-dom';

const CLUB_CHART_COLORS: Record<string, string> = {
  saeullim: '#f59e0b',
  cheonjipoong: '#10b981',
  cheonjihu: '#0ea5e9',
  munhwabu: '#f43f5e',
};

const STATUS_PIE_COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#9ca3af', '#f43f5e'];

interface ClubMetric {
  club: ClubType;
  clubName: string;
  shortName: string;
  attendanceRate: number;
  totalAttendance: number;
  totalMembers: number;
  weeklyReportCount: number;
  growthRecordCount: number;
  eventReportCount: number;
  submittedCount: number;
  approvedCount: number;
  draftedCount: number;
  activityIndex: number;
}

interface StatusDistribution {
  name: string;
  value: number;
}

const CLUB_IDS: ClubType[] = ['saeullim', 'cheonjipoong', 'cheonjihu', 'munhwabu'];

const CLUB_NAMES: Record<ClubType, string> = {
  saeullim: '새울림 (북)',
  cheonjipoong: '천지풍 (기창)',
  cheonjihu: '천지후 (치어)',
  munhwabu: '문화부 (미디어·편집)',
  cheonhwarae_cheongmyeong: '천화래와 청명 (찬양·밴드)',
};

const CLUB_SHORT: Record<ClubType, string> = {
  saeullim: '새울림',
  cheonjipoong: '천지풍',
  cheonjihu: '천지후',
  munhwabu: '문화부',
  cheonhwarae_cheongmyeong: '천화래',
};

export default function StrategyDashboard() {
  const { profile } = useAuth();
  const [clubMetrics, setClubMetrics] = useState<ClubMetric[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<StatusDistribution[]>([]);
  const [weeklyTrend, setWeeklyTrend] = useState<{ week: string; saeullim: number; cheonjipoong: number; cheonjihu: number; munhwabu: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState({ overallAttendanceRate: 0, reportSubmissionRate: 0, feedbackReflectionRate: 0, activeClubCount: 4 });
  const [kpiDeltas, setKpiDeltas] = useState({ attendanceDelta: 0, submissionDelta: 0, approvalDelta: 0 });
  const [totalReports, setTotalReports] = useState(0);
  const [totalSubmitted, setTotalSubmitted] = useState(0);
  const [totalApproved, setTotalApproved] = useState(0);
  const [totalDrafted, setTotalDrafted] = useState(0);
  const [meetingIssues, setMeetingIssues] = useState<{ tag: string; count: number }[]>([]);
  const [recurringAlerts, setRecurringAlerts] = useState<{ issue: string; meetings: string[]; count: number }[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchAllData = useCallback(async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      // Calculate date ranges for weekly trends
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      const fourWeeksAgoStr = fourWeeksAgo.toISOString().split('T')[0];

      const [membersRes, attRes, weeklyRes, growthRes, eventRes, histAttRes, meetingsRes] = await Promise.all([
        supabase.from('user_roles').select('club, role').eq('is_active', true).not('club', 'is', null),
        supabase.from('attendance').select('club, status').eq('attendance_date', todayStr),
        supabase.from('weekly_reports').select('club, status').order('created_at', { ascending: false }).limit(200),
        supabase.from('growth_records').select('club, status').order('created_at', { ascending: false }).limit(200),
        supabase.from('event_reports').select('club, status').order('created_at', { ascending: false }).limit(200),
        supabase.from('attendance').select('club, attendance_date').gte('attendance_date', fourWeeksAgoStr).order('attendance_date', { ascending: true }),
        supabase.from('meeting_minutes').select('id, date, title, issues, tags').order('date', { ascending: false }).limit(20),
      ]);

      const members = (membersRes.data || []) as { club: string; role: string }[];
      const attRecords = (attRes.data || []) as { club: string; status: string }[];
      const weeklyReports = (weeklyRes.data || []) as { club: string; status: string }[];
      const growthRecords = (growthRes.data || []) as { club: string; status: string }[];
      const eventReports = (eventRes.data || []) as { club: string; status: string }[];
      const histAttRecords = (histAttRes.data || []) as { club: string; attendance_date: string }[];
      const meetingRecords = (meetingsRes.data || []) as { id: string; date: string; title: string; issues: string[]; tags: string[] }[];

      const allReports = [...weeklyReports, ...growthRecords, ...eventReports];

      const metrics: ClubMetric[] = CLUB_IDS.map(club => {
        const clubMembers = members.filter(m => m.club === club).length;
        const attended = attRecords.filter(r => r.club === club && r.status === 'attended').length;
        const wCount = weeklyReports.filter(r => r.club === club).length;
        const gCount = growthRecords.filter(r => r.club === club).length;
        const eCount = eventReports.filter(r => r.club === club).length;
        const clubReports = [weeklyReports.filter(r => r.club === club), growthRecords.filter(r => r.club === club), eventReports.filter(r => r.club === club)];
        const allClubReports = clubReports.flat();
        const submitted = allClubReports.filter(r => r.status === 'submitted' || r.status === 'president_reviewed' || r.status === 'reviewed' || r.status === 'approved').length;
        const approved = allClubReports.filter(r => r.status === 'approved').length;
        const attRate = clubMembers > 0 ? Math.round((attended / clubMembers) * 100) : 0;
        const totalClubReports = wCount + gCount + eCount;
        const actIdx = Math.min(100, Math.round(
          (attRate * 0.4) + (totalClubReports > 0 ? Math.min(totalClubReports * 5, 30) : 0) + (clubMembers > 0 ? Math.min(clubMembers * 3, 30) : 0)
        ));

        return {
          club,
          clubName: CLUB_NAMES[club],
          shortName: CLUB_SHORT[club],
          attendanceRate: attRate,
          totalAttendance: attended,
          totalMembers: clubMembers,
          weeklyReportCount: wCount,
          growthRecordCount: gCount,
          eventReportCount: eCount,
          submittedCount: submitted,
          approvedCount: approved,
          draftedCount: totalClubReports - submitted,
          activityIndex: actIdx,
        };
      });

      setClubMetrics(metrics);

      const allSub = allReports.filter(r => r.status === 'submitted' || r.status === 'president_reviewed' || r.status === 'reviewed' || r.status === 'approved').length;
      const allAppr = allReports.filter(r => r.status === 'approved').length;
      const allDraft = allReports.length - allSub;

      setTotalReports(allReports.length);
      setTotalSubmitted(allSub);
      setTotalApproved(allAppr);
      setTotalDrafted(allDraft);

      const statusCounts: Record<string, number> = { submitted: 0, president_reviewed: 0, reviewed: 0, drafted: 0, approved: 0 };
      allReports.forEach(r => {
        const s = r.status || 'drafted';
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      });

      setStatusDistribution([
        { name: '승인', value: statusCounts.approved || 0 },
        { name: '검토 완료', value: statusCounts.reviewed || 0 },
        { name: '회장 검토', value: statusCounts.president_reviewed || 0 },
        { name: '임시 저장', value: statusCounts.drafted || 0 },
        { name: '제출', value: statusCounts.submitted || 0 },
      ]);

      const totalMems = metrics.reduce((s, c) => s + c.totalMembers, 0);
      const totalAtt = metrics.reduce((s, c) => s + c.totalAttendance, 0);
      const overallRate = totalMems > 0 ? Math.round((totalAtt / totalMems) * 100) : 0;
      const subRate = allReports.length > 0 ? Math.round((allSub / allReports.length) * 100) : 0;
      const refRate = allSub > 0 ? Math.round((allAppr / allSub) * 100) : 0;

      setKpi({ overallAttendanceRate: overallRate, reportSubmissionRate: subRate, feedbackReflectionRate: refRate, activeClubCount: 4 });

      // Calculate KPI deltas — compare this week vs last week
      const now = new Date();
      const thisWeekStart = new Date(now);
      thisWeekStart.setDate(now.getDate() - now.getDay());
      const lastWeekStart = new Date(thisWeekStart);
      lastWeekStart.setDate(thisWeekStart.getDate() - 7);
      const thisWeekStartStr = thisWeekStart.toISOString().split('T')[0];
      const lastWeekStartStr = lastWeekStart.toISOString().split('T')[0];

      const thisWeekAtt = histAttRecords.filter(r => r.attendance_date >= thisWeekStartStr).length;
      const lastWeekAtt = histAttRecords.filter(r => r.attendance_date >= lastWeekStartStr && r.attendance_date < thisWeekStartStr).length;
      const totalMemsAllWeeks = metrics.reduce((s, c) => s + c.totalMembers, 0);
      const thisWeekRate = totalMemsAllWeeks > 0 ? Math.round((thisWeekAtt / (totalMemsAllWeeks * 5)) * 100) : 0;
      const lastWeekRate = totalMemsAllWeeks > 0 ? Math.round((lastWeekAtt / (totalMemsAllWeeks * 5)) * 100) : 0;

      const thisWeekReports = allReports.filter(r => {
        const d = new Date((r as Record<string, string>).created_at || '');
        return d >= thisWeekStart;
      }).length;
      const lastWeekReports = allReports.filter(r => {
        const d = new Date((r as Record<string, string>).created_at || '');
        return d >= lastWeekStart && d < thisWeekStart;
      }).length;

      setKpiDeltas({
        attendanceDelta: lastWeekRate > 0 ? thisWeekRate - lastWeekRate : 0,
        submissionDelta: lastWeekReports > 0 ? thisWeekReports - lastWeekReports : 0,
        approvalDelta: 0,
      });

      // Generate weekly trend from real attendance data (last 4 weeks)
      const trends: { week: string; saeullim: number; cheonjipoong: number; cheonjihu: number; munhwabu: number }[] = [];
      for (let w = 3; w >= 0; w--) {
        const weekEndDate = new Date();
        weekEndDate.setDate(weekEndDate.getDate() - w * 7);
        const weekStartDate = new Date(weekEndDate);
        weekStartDate.setDate(weekEndDate.getDate() - 6);

        const weekStartStr = weekStartDate.toISOString().split('T')[0];
        const weekEndStr = weekEndDate.toISOString().split('T')[0];
        const weekLabel = `${weekStartDate.getMonth() + 1}/${weekStartDate.getDate()}`;

        const clubRates: Record<string, number> = {};
        for (const club of CLUB_IDS) {
          const cm = metrics.find(m => m.club === club);
          const clubMembers = members.filter(m => m.club === club).length;
          const clubWeekAtt = histAttRecords.filter(r => r.club === club && r.attendance_date >= weekStartStr && r.attendance_date <= weekEndStr).length;
          // Estimate weekly attendance rate — each member attends max 5 days a week
          const maxPossible = clubMembers * 5;
          const weekRate = maxPossible > 0 ? Math.round((clubWeekAtt / maxPossible) * 100) : (cm ? cm.attendanceRate : 70);
          clubRates[club] = cm ? Math.round(weekRate) : 70;
        }
        trends.push({
          week: weekLabel,
          saeullim: Math.min(100, Math.max(30, clubRates.saeullim || (metrics.find(m => m.club === 'saeullim')?.attendanceRate || 70))),
          cheonjipoong: Math.min(100, Math.max(30, clubRates.cheonjipoong || (metrics.find(m => m.club === 'cheonjipoong')?.attendanceRate || 70))),
          cheonjihu: Math.min(100, Math.max(30, clubRates.cheonjihu || (metrics.find(m => m.club === 'cheonjihu')?.attendanceRate || 70))),
          munhwabu: Math.min(100, Math.max(30, clubRates.munhwabu || (metrics.find(m => m.club === 'munhwabu')?.attendanceRate || 70))),
        });
      }
      setWeeklyTrend(trends);

      // Aggregate meeting issues from tags
      const tagCountMap = new Map<string, number>();
      meetingRecords.forEach(m => {
        (m.tags || []).forEach(tag => {
          tagCountMap.set(tag, (tagCountMap.get(tag) || 0) + 1);
        });
      });
      const sortedTags = Array.from(tagCountMap.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
      setMeetingIssues(sortedTags);

      // Find recurring issues (issues appearing in 3+ meetings)
      const issueMap = new Map<string, { count: number; meetings: string[] }>();
      meetingRecords.forEach(m => {
        (m.issues || []).forEach(issue => {
          const key = issue.replace(/[「」""''·•\-–—\s]+/g, '').slice(0, 25);
          if (issueMap.has(key)) {
            const entry = issueMap.get(key)!;
            entry.count++;
            entry.meetings.push(`${m.date} ${m.title}`);
          } else {
            issueMap.set(key, { count: 1, meetings: [`${m.date} ${m.title}`] });
          }
        });
      });
      const alerts = Array.from(issueMap.entries())
        .filter(([_, v]) => v.count >= 3)
        .map(([k, v]) => ({ issue: k, meetings: v.meetings, count: v.count }))
        .sort((a, b) => b.count - a.count);
      setRecurringAlerts(alerts);

    } catch (err) {
      console.error('전략 대시보드 데이터 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();

    const todayStr = new Date().toISOString().split('T')[0];
    const channel = supabase
      .channel('strategy-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance', filter: `attendance_date=eq.${todayStr}` }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'weekly_reports' }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'growth_records' }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_reports' }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_minutes' }, () => fetchAllData())
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAllData]);

  if (!profile || profile.role !== 'chief') {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-20 text-center">
        <div className="w-16 h-16 rounded-[20px] bg-accent-100 border border-accent-200 flex items-center justify-center mx-auto mb-4">
          <i className="ri-shield-flash-line text-2xl text-accent-600"></i>
        </div>
        <h1 className="text-xl font-bold text-foreground-950 mb-2">접근 권한이 없습니다</h1>
        <p className="text-foreground-600 text-sm">이 페이지는 부장만 접근할 수 있습니다</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-20 text-center">
        <div className="w-10 h-10 rounded-full border-2 border-primary-200 border-t-primary-500 animate-spin mx-auto mb-4"></div>
        <p className="text-sm text-foreground-600">실시간 데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground-950 mb-1">전략 대시보드</h1>
          <p className="text-sm text-foreground-600">전체 운영 지표와 동아리별 활동 현황을 실시간으로 확인합니다</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          <KpiCard title="전체 출석률" value={`${kpi.overallAttendanceRate}%`} delta={kpiDeltas.attendanceDelta} deltaUnit="%p" change="오늘 기준" changePositive={kpiDeltas.attendanceDelta >= 0} icon="ri-user-heart-line" color="primary" delay={0} />
          <KpiCard title="보고서 제출률" value={`${kpi.reportSubmissionRate}%`} delta={kpiDeltas.submissionDelta} deltaUnit="건" change={totalDrafted > 0 ? `${totalDrafted}건 미제출` : '전체 제출 완료'} changePositive={totalDrafted === 0} icon="ri-file-text-line" color="secondary" delay={0.08} />
          <KpiCard title="승인 반영률" value={`${kpi.feedbackReflectionRate}%`} delta={kpiDeltas.approvalDelta} deltaUnit="%p" change={`${totalApproved}건 승인`} changePositive icon="ri-check-double-line" color="accent" delay={0.16} />
          <KpiCard title="활성 동아리" value={`${kpi.activeClubCount}/4`} change="전체 활동 중" changePositive icon="ri-shapes-line" color="primary" delay={0.24} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="lg:col-span-3 bg-background-100 border border-background-200 rounded-[20px] p-5"
          >
            <h3 className="text-sm font-bold text-foreground-700 mb-1">동아리별 참여율 및 보고서 현황</h3>
            <p className="text-xs text-foreground-600 mb-4">참여율(막대) + 전체 보고서 수</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={clubMetrics} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="shortName" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                  formatter={(value: number, name: string) => {
                    if (name.includes('참여율')) return [`${value}%`, name];
                    return [`${value}건`, name];
                  }}
                />
                <Bar yAxisId="left" dataKey="attendanceRate" name="참여율" radius={[6, 6, 0, 0]} barSize={36}>
                  {clubMetrics.map(entry => (
                    <Cell key={entry.club} fill={CLUB_CHART_COLORS[entry.club]} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 justify-center mt-2 flex-wrap">
              {clubMetrics.map(m => (
                <div key={m.club} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CLUB_CHART_COLORS[m.club] }}></div>
                  <span className="text-xs text-foreground-600">{m.shortName}: {m.weeklyReportCount + m.growthRecordCount + m.eventReportCount}건</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="lg:col-span-2 bg-background-100 border border-background-200 rounded-[20px] p-5"
          >
            <h3 className="text-sm font-bold text-foreground-700 mb-1">보고서 상태 분포</h3>
            <p className="text-xs text-foreground-600 mb-2">전체 보고서 {totalReports}건 기준</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value" stroke="none">
                  {statusDistribution.map((_, i) => (
                    <Cell key={`cell-${i}`} fill={STATUS_PIE_COLORS[i % STATUS_PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                  formatter={(value: number) => [`${value}건`]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 justify-center mt-1">
              {statusDistribution.map((s, i) => (
                <div key={s.name} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_PIE_COLORS[i] }}></div>
                  <span className="text-xs text-foreground-600">{s.name} {s.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="lg:col-span-3 bg-background-100 border border-background-200 rounded-[20px] p-5"
          >
            <h3 className="text-sm font-bold text-foreground-700 mb-1">주간 참여율 추이</h3>
            <p className="text-xs text-foreground-600 mb-4">동아리별 최근 4주 출석률 추세</p>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={weeklyTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                <YAxis domain={[60, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }} formatter={(value: number) => [`${value}%`]} />
                <Line type="monotone" dataKey="saeullim" name="새울림" stroke={CLUB_CHART_COLORS.saeullim} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="cheonjipoong" name="천지풍" stroke={CLUB_CHART_COLORS.cheonjipoong} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="cheonjihu" name="천지후" stroke={CLUB_CHART_COLORS.cheonjihu} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="munhwabu" name="문화부" stroke={CLUB_CHART_COLORS.munhwabu} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.35 }}
            className="lg:col-span-2 bg-background-100 border border-background-200 rounded-[20px] p-5"
          >
            <h3 className="text-sm font-bold text-foreground-700 mb-1">동아리 활동 지수</h3>
            <p className="text-xs text-foreground-600 mb-4">참여율 40% + 보고서 30% + 인원 30%</p>
            <div className="space-y-4">
              {[...clubMetrics].sort((a, b) => b.activityIndex - a.activityIndex).map((club, i) => (
                <motion.div key={club.club} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: 0.4 + i * 0.08 }} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-background-200 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-foreground-600">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground-700">{club.shortName}</span>
                      <span className="text-sm font-bold text-foreground-950">{club.activityIndex}점</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-background-200 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${club.activityIndex}%` }}
                        transition={{ duration: 0.8, delay: 0.5 + i * 0.1, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: CLUB_CHART_COLORS[club.club] }}
                      ></motion.div>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-foreground-600">
                      <span>참여율 {club.attendanceRate}%</span>
                      <span>보고서 {club.weeklyReportCount + club.growthRecordCount + club.eventReportCount}건</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="bg-background-100 border border-background-200 rounded-[20px] overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-background-200">
            <h3 className="text-sm font-bold text-foreground-700">동아리별 상세 지표</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-background-200 bg-background-200/70">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-foreground-600 uppercase tracking-wider">동아리</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-foreground-600 uppercase tracking-wider">참여율</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-foreground-600 uppercase tracking-wider">주간보고</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-foreground-600 uppercase tracking-wider">성장기록</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-foreground-600 uppercase tracking-wider">행사보고</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-foreground-600 uppercase tracking-wider">제출/승인</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-foreground-600 uppercase tracking-wider">활동 지수</th>
                </tr>
              </thead>
              <tbody>
                {[...clubMetrics].sort((a, b) => b.activityIndex - a.activityIndex).map((club, i) => (
                  <motion.tr key={club.club} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.45 + i * 0.06 }} className="border-b border-background-200 hover:bg-background-200/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${CLUB_CHART_COLORS[club.club]}15`, color: CLUB_CHART_COLORS[club.club] }}>
                          <i className="ri-music-line text-sm"></i>
                        </div>
                        <span className="text-sm font-medium text-foreground-950">{club.clubName}</span>
                      </div>
                    </td>
                    <td className="text-center px-4 py-3.5">
                      <span className="text-sm font-semibold text-foreground-700">{club.attendanceRate}%</span>
                      <p className="text-xs text-foreground-600">{club.totalAttendance}/{club.totalMembers}명</p>
                    </td>
                    <td className="text-center px-4 py-3.5"><span className="text-sm text-foreground-700">{club.weeklyReportCount}건</span></td>
                    <td className="text-center px-4 py-3.5"><span className="text-sm text-foreground-700">{club.growthRecordCount}건</span></td>
                    <td className="text-center px-4 py-3.5"><span className="text-sm text-foreground-700">{club.eventReportCount}건</span></td>
                    <td className="text-center px-4 py-3.5">
                      <span className="text-sm font-medium text-secondary-600">{club.submittedCount}</span>
                      <span className="text-foreground-500 mx-1">/</span>
                      <span className="text-sm font-medium text-primary-600">{club.approvedCount}</span>
                    </td>
                    <td className="text-center px-4 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-background-200 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${club.activityIndex}%`, backgroundColor: CLUB_CHART_COLORS[club.club] }}></div>
                        </div>
                        <span className="text-sm font-bold text-foreground-950 w-9 text-right">{club.activityIndex}</span>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {meetingIssues.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.45 }}
            className="mb-6 bg-background-100 border border-background-200 rounded-[20px] p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-foreground-700 mb-1">회의 이슈 추이 및 반복 안건</h3>
                <p className="text-xs text-foreground-600">최근 회의록 기준 태그 빈도 및 3회 이상 반복 이슈</p>
              </div>
              <Link to="/meetings" className="text-sm text-primary-600 hover:text-primary-700 font-medium whitespace-nowrap cursor-pointer">
                회의록 보기
              </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              <div className="lg:col-span-3">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={meetingIssues} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="tag" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={60} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                      formatter={(value: number, name: string) => [`${value}회`, '언급 횟수']}
                    />
                    <Bar dataKey="count" name="언급 횟수" radius={[0, 6, 6, 0]} barSize={18} fill="#8b5cf6" fillOpacity={0.8} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="lg:col-span-2">
                <h4 className="text-xs font-semibold text-foreground-700 mb-2 flex items-center gap-1.5">
                  <i className="ri-loop-left-line text-rose-500"></i>
                  3회 이상 반복 이슈
                </h4>
                {recurringAlerts.length === 0 ? (
                  <p className="text-xs text-foreground-500 py-4">아직 3회 이상 반복된 이슈가 없습니다</p>
                ) : (
                  <div className="space-y-2 max-h-[180px] overflow-y-auto">
                    {recurringAlerts.map((alert, i) => (
                      <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                        <div className="w-6 h-6 rounded-md bg-rose-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-[10px] font-bold text-rose-700">{alert.count}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-rose-800 truncate">{alert.issue}</p>
                          <p className="text-[10px] text-rose-600 mt-0.5 line-clamp-2">{alert.meetings.slice(0, 3).join(' · ')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          className="mt-6 bg-primary-100 rounded-[20px] p-5 border border-primary-200"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary-200 flex items-center justify-center shrink-0">
              <i className="ri-lightbulb-line text-primary-700"></i>
            </div>
            <div>
              <p className="text-sm font-medium text-primary-800 mb-2">AI 인사이트</p>
              {totalReports === 0 ? (
                <p className="text-xs text-primary-700">아직 수집된 보고서 데이터가 없습니다. 사명자들이 주간 보고서, 성장 기록, 행사 보고서를 제출하면 이곳에서 실시간 분석을 확인할 수 있습니다.</p>
              ) : (
                <ul className="text-xs text-primary-700 space-y-1.5">
                  <li>&bull; <strong>{[...clubMetrics].sort((a, b) => b.attendanceRate - a.attendanceRate)[0]?.shortName}</strong>이(가) 가장 높은 참여율을 보이고 있습니다.</li>
                  <li>&bull; 전체 보고서 제출률이 {kpi.reportSubmissionRate}%입니다. {totalDrafted > 0 ? `미제출 ${totalDrafted}건에 대한 리마인드가 필요합니다.` : '모든 보고서가 제출되었습니다!'}</li>
                  <li>&bull; 승인 반영률 {kpi.feedbackReflectionRate}% — {kpi.feedbackReflectionRate < 50 ? '승인 프로세스 병목을 점검해보세요.' : '원활한 승인 흐름을 유지하고 있습니다.'}</li>
                </ul>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

function KpiCard({ title, value, delta, deltaUnit, change, changePositive, icon, color, delay }: {
  title: string; value: string; delta?: number; deltaUnit?: string; change: string; changePositive: boolean; icon: string; color: string; delay: number;
}) {
  const colorMap: Record<string, string> = {
    primary: 'bg-primary-100 text-primary-600',
    secondary: 'bg-secondary-100 text-secondary-600',
    accent: 'bg-accent-100 text-accent-600',
  };
  const showDelta = delta !== undefined && delta !== 0;
  const deltaIsPositive = delta !== undefined && delta > 0;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay }} className="bg-background-100 border border-background-200 rounded-[20px] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
          <i className={`${icon} text-xl`}></i>
        </div>
        <div className={`flex items-center gap-0.5 text-xs font-medium ${changePositive ? 'text-secondary-600' : 'text-foreground-600'}`}>
          {changePositive ? <i className="ri-arrow-up-s-line text-sm"></i> : <i className="ri-subtract-line text-sm"></i>}
          {change}
        </div>
      </div>
      <div className="flex items-baseline gap-2 mb-0.5">
        <p className="text-2xl md:text-3xl font-bold text-foreground-950">{value}</p>
        {showDelta && (
          <span className={`text-xs font-semibold flex items-center gap-0.5 ${deltaIsPositive ? 'text-secondary-600' : 'text-rose-600'}`}>
            <i className={`text-xs ${deltaIsPositive ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`}></i>
            {Math.abs(delta)}{deltaUnit || ''}
          </span>
        )}
      </div>
      <p className="text-xs text-foreground-600">{title}</p>
    </motion.div>
  );
}