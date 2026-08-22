import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_LABELS } from '@/types/auth';
import type { UserRole } from '@/types/auth';
import { formatKoreanDateTime } from '@/lib/date';

type Tab = 'overview' | 'people' | 'followup' | 'workload' | 'meeting' | 'history';
type Person = { user_id: string; name: string; role: UserRole; club: string | null; zone: string | null; is_active: boolean; approval_status: string | null };
type Activity = { user_id: string; type: string; label: string; at: string; detail?: string | null; href?: string };
type Visit = { id: string; student_id: string; student_name: string; scheduled_at: string; status: string; follow_up_needed: boolean; topic: string | null; notes: string | null };
type MissionAssignment = { id: number; mission_id: number; student_id: string; status: string; assigned_at: string; submitted_at: string | null; completed_at: string | null };
type ReportRow = { id: string; author_id: string; status: string | null; created_at: string };
type GrowthRow = { id: string; student_id: string; author_id: string; status: string | null; record_date: string; prayer_requests: string | null; spiritual_growth: string | null };
type AttendanceRow = { user_id: string; attendance_date: string; status: string };
type Teacher = { user_id: string; name: string; role: UserRole; club: string | null };
type ClubTeacher = { club: string; teacher_id: string };
type AuditLog = { id: string; target_user_name: string; action: string; performed_by_name: string; created_at: string };

const DAY_MS = 86400000;
const daysSince = (value?: string | null) => value ? Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / DAY_MS)) : 999;
const scoreColor = (score: number) => score < 60 ? 'text-rose-600 bg-rose-50 border-rose-200' : score < 80 ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-emerald-600 bg-emerald-50 border-emerald-200';
const scoreLabel = (score: number) => score < 60 ? '최우선 케어' : score < 80 ? '관심 필요' : '안정적';
const shortDate = (value?: string | null) => value ? formatKoreanDateTime(value) : '기록 없음';

export default function MissionsOperationsPage() {
  const { user, profile, hasRole } = useAuth();
  const canAccess = hasRole('assistant_zone_leader');
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [reminderMsg, setReminderMsg] = useState<string | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [assignments, setAssignments] = useState<MissionAssignment[]>([]);
  const [weeklyReports, setWeeklyReports] = useState<ReportRow[]>([]);
  const [eventReports, setEventReports] = useState<ReportRow[]>([]);
  const [growth, setGrowth] = useState<GrowthRow[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [clubTeachers, setClubTeachers] = useState<ClubTeacher[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const loadData = useCallback(async () => {
    if (!canAccess) return;
    setRefreshing(true); setError(null);
    const today = new Date();
    const since14 = new Date(today.getTime() - 14 * DAY_MS).toISOString();
    const since30 = new Date(today.getTime() - 30 * DAY_MS).toISOString();
    try {
      const [peopleRes, attendanceRes, visitsRes, assignmentRes, weeklyRes, eventRes, growthRes, teacherRes, clubTeacherRes, auditRes] = await Promise.all([
        supabase.from('user_roles').select('user_id,name,role,club,zone,is_active,approval_status').eq('is_active', true).not('role', 'in', '("chief","teacher")').order('name').limit(500),
        supabase.from('attendance').select('user_id,attendance_date,status').gte('attendance_date', since14.slice(0, 10)).order('attendance_date', { ascending: false }).limit(3000),
        supabase.from('visitations').select('id,student_id,student_name,scheduled_at,status,follow_up_needed,topic,notes').order('scheduled_at', { ascending: false }).limit(1000),
        supabase.from('mission_assignments').select('id,mission_id,student_id,status,assigned_at,submitted_at,completed_at').order('assigned_at', { ascending: false }).limit(2000),
        supabase.from('weekly_reports').select('id,author_id,status,created_at').gte('created_at', since30).order('created_at', { ascending: false }).limit(1000),
        supabase.from('event_reports').select('id,author_id,status,created_at').gte('created_at', since30).order('created_at', { ascending: false }).limit(1000),
        supabase.from('growth_records').select('id,student_id,author_id,status,record_date,prayer_requests,spiritual_growth').gte('record_date', since30.slice(0, 10)).order('record_date', { ascending: false }).limit(1000),
        supabase.from('user_roles').select('user_id,name,role,club').eq('is_active', true).in('role', ['teacher', 'chief']).order('name'),
        supabase.from('club_teachers').select('club,teacher_id'),
        supabase.from('audit_log').select('id,target_user_name,action,performed_by_name,created_at').order('created_at', { ascending: false }).limit(20),
      ]);
      const firstError = [peopleRes, attendanceRes, visitsRes, assignmentRes, weeklyRes, eventRes, growthRes, teacherRes, clubTeacherRes, auditRes].find(r => r.error)?.error;
      if (firstError) throw firstError;
      setPeople((peopleRes.data || []) as Person[]);
      setAttendance((attendanceRes.data || []) as AttendanceRow[]);
      setVisits((visitsRes.data || []) as Visit[]);
      setAssignments((assignmentRes.data || []) as MissionAssignment[]);
      setWeeklyReports((weeklyRes.data || []) as ReportRow[]);
      setEventReports((eventRes.data || []) as ReportRow[]);
      setGrowth((growthRes.data || []) as GrowthRow[]);
      setTeachers((teacherRes.data || []) as Teacher[]);
      setClubTeachers((clubTeacherRes.data || []) as ClubTeacher[]);
      setAuditLogs((auditRes.data || []) as AuditLog[]);
    } catch (e) { console.error('[MissionOperations] load failed', e); setError('사명 운영 데이터를 불러오지 못했습니다. 다시 시도해주세요.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [canAccess]);

  useEffect(() => { void loadData(); }, [loadData]);

  const teachersByClub = useMemo(() => {
    const map = new Map<string, Teacher[]>();
    for (const rel of clubTeachers) {
      const teacher = teachers.find(t => t.user_id === rel.teacher_id);
      if (!teacher) continue;
      map.set(rel.club, [...(map.get(rel.club) || []), teacher]);
    }
    return map;
  }, [clubTeachers, teachers]);

  const activities = useMemo<Activity[]>(() => {
    const rows: Activity[] = [];
    attendance.forEach(r => rows.push({ user_id: r.user_id, type: 'attendance', label: r.status === 'attended' ? '출석 기록' : '결석 기록', at: r.attendance_date, href: '/dashboard/attendance' }));
    assignments.forEach(r => rows.push({ user_id: r.student_id, type: 'mission', label: `작은 사명 ${r.status === 'completed' ? '완료' : r.status === 'submitted' ? '검토 요청' : '배정'}`, at: r.completed_at || r.submitted_at || r.assigned_at, href: '/missions' }));
    growth.forEach(r => rows.push({ user_id: r.student_id, type: 'growth', label: '성장 기록 작성', at: r.record_date, detail: r.prayer_requests || r.spiritual_growth, href: '/reports/growth' }));
    visits.forEach(r => rows.push({ user_id: r.student_id, type: 'visitation', label: r.status === 'completed' ? '심방 완료' : '심방 일정', at: r.scheduled_at, detail: r.topic, href: '/visitations' }));
    weeklyReports.forEach(r => rows.push({ user_id: r.author_id, type: 'weekly', label: '주간 보고서 제출', at: r.created_at, href: '/reports/weekly' }));
    eventReports.forEach(r => rows.push({ user_id: r.author_id, type: 'event', label: '행사 보고서 제출', at: r.created_at, href: '/reports/events' }));
    return rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [attendance, assignments, growth, visits, weeklyReports, eventReports]);

  const personStats = useMemo(() => {
    const map = new Map<string, { lastActivity: string | null; lastVisit: string | null; nextVisit: string | null; pendingMission: number; pendingFollowup: number; attendance14: number; attended14: number; prayerRequests: number; activityCount30: number; teacherNames: string[] }>();
    people.forEach(p => map.set(p.user_id, { lastActivity: null, lastVisit: null, nextVisit: null, pendingMission: 0, pendingFollowup: 0, attendance14: 0, attended14: 0, prayerRequests: 0, activityCount30: 0, teacherNames: teachersByClub.get(p.club || '')?.map(t => t.name) || [] }));
    activities.forEach(a => { const s = map.get(a.user_id); if (!s) return; if (!s.lastActivity || new Date(a.at).getTime() > new Date(s.lastActivity).getTime()) s.lastActivity = a.at; s.activityCount30 += 1; });
    const now = Date.now();
    visits.forEach(v => { const s = map.get(v.student_id); if (!s) return; if (v.status === 'completed' && (!s.lastVisit || new Date(v.scheduled_at).getTime() > new Date(s.lastVisit).getTime())) s.lastVisit = v.scheduled_at; if (v.status === 'scheduled' && new Date(v.scheduled_at).getTime() >= now && (!s.nextVisit || new Date(v.scheduled_at).getTime() < new Date(s.nextVisit).getTime())) s.nextVisit = v.scheduled_at; if (v.follow_up_needed && v.status !== 'cancelled') s.pendingFollowup += 1; });
    assignments.forEach(a => { const s = map.get(a.student_id); if (s && ['assigned', 'submitted', 'rejected'].includes(a.status)) s.pendingMission += 1; });
    attendance.forEach(a => { const s = map.get(a.user_id); if (!s) return; s.attendance14 += 1; if (a.status === 'attended') s.attended14 += 1; });
    growth.forEach(g => { const s = map.get(g.student_id); if (s && g.prayer_requests?.trim()) s.prayerRequests += 1; });
    return map;
  }, [activities, assignments, attendance, growth, people, teachersByClub, visits]);

  const health = useMemo(() => people.map(person => {
    const stats = personStats.get(person.user_id)!;
    const inactiveDays = daysSince(stats.lastActivity);
    let score = 100;
    if (inactiveDays > 7) score -= Math.min(40, (inactiveDays - 7) * 5);
    if (stats.attendance14 === 0) score -= 10; else if (stats.attendance14 >= 3 && stats.attended14 === 0) score -= 15;
    score -= Math.min(20, stats.pendingMission * 5);
    score -= Math.min(15, stats.pendingFollowup * 8);
    if (stats.prayerRequests > 0) score += 5;
    return { person, stats, score: Math.max(0, Math.min(100, score)), inactiveDays };
  }).sort((a, b) => a.score - b.score), [people, personStats]);

  const filteredPeople = useMemo(() => { const q = query.trim().toLowerCase(); if (!q) return health; return health.filter(x => x.person.name.toLowerCase().includes(q) || (x.person.club || '').toLowerCase().includes(q) || (x.person.zone || '').toLowerCase().includes(q)); }, [health, query]);
  const selected = selectedId ? health.find(h => h.person.user_id === selectedId) : null;
  const selectedActivities = selected ? activities.filter(a => a.user_id === selected.person.user_id).slice(0, 20) : [];

  const followUps = useMemo(() => {
    const result: { key: string; title: string; subtitle: string; name: string; href: string; tone: 'rose' | 'amber' | 'sky' }[] = [];
    visits.filter(v => v.follow_up_needed && v.status !== 'cancelled').slice(0, 10).forEach(v => result.push({ key: `visit-${v.id}`, title: '심방 후속 필요', subtitle: v.topic || '후속 연락 필요', name: v.student_name, href: `/visitations/${v.id}`, tone: 'rose' }));
    assignments.filter(a => a.status === 'submitted').slice(0, 10).forEach(a => { const p = people.find(x => x.user_id === a.student_id); result.push({ key: `mission-${a.id}`, title: '미션 검토 필요', subtitle: '인증 검토 요청', name: p?.name || '알 수 없음', href: '/missions', tone: 'amber' }); });
    [...weeklyReports, ...eventReports].filter(r => ['submitted', 'pending', 'review'].includes(String(r.status))).slice(0, 10).forEach(r => { const p = people.find(x => x.user_id === r.author_id); result.push({ key: `report-${r.id}`, title: '보고서 확인 필요', subtitle: r.status || '검토 대기', name: p?.name || '알 수 없음', href: '/reports/review', tone: 'sky' }); });
    return result.slice(0, 24);
  }, [assignments, eventReports, people, visits, weeklyReports]);

  const weeklySummary = useMemo(() => { const since = Date.now() - 7 * DAY_MS; const recent = activities.filter(a => new Date(a.at).getTime() >= since); return { activePeople: new Set(recent.map(a => a.user_id)).size, totalPeople: people.length, missions: recent.filter(a => a.type === 'mission' && a.label.includes('완료')).length, visits: recent.filter(a => a.type === 'visitation' && a.label.includes('완료')).length, reports: recent.filter(a => a.type === 'weekly' || a.type === 'event').length, attendance: recent.filter(a => a.type === 'attendance' && a.label === '출석 기록').length }; }, [activities, people.length]);

  const workload = useMemo(() => {
    const clubs = [...new Set(people.map(p => p.club).filter(Boolean))] as string[];
    return clubs.map(club => { const members = health.filter(h => h.person.club === club); const mappedTeachers = teachersByClub.get(club) || []; return { name: mappedTeachers.map(t => t.name).join(', ') || '담당 교사 미지정', club, people: members.length, atRisk: members.filter(m => m.score < 60).length }; }).sort((a, b) => b.atRisk - a.atRisk || b.people - a.people);
  }, [health, people, teachersByClub]);

  const sendReminder = async (person: Person) => {
    if (!user) return;
    setRemindingId(person.user_id); setReminderMsg(null);
    try {
      const { error: insertError } = await supabase.from('notifications').insert({ user_id: person.user_id, type: 'mission_followup', title: '사명자 확인 요청', message: `${profile?.name || '담당 리더'}님이 최근 활동을 확인해 달라는 요청을 보냈습니다.`, link_url: '/missions' });
      if (insertError) throw insertError;
      setReminderMsg(`${person.name}님에게 확인 알림을 보냈습니다.`);
    } catch { setReminderMsg('알림 전송에 실패했습니다.'); }
    finally { setRemindingId(null); window.setTimeout(() => setReminderMsg(null), 3000); }
  };

  if (!canAccess) return <div className="min-h-[60vh] flex items-center justify-center p-6"><div className="text-center"><i className="ri-shield-user-line text-4xl text-foreground-300"/><h2 className="text-lg font-bold mt-3">부구역장 이상만 사용할 수 있습니다</h2></div></div>;

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview', label: '전체 현황', icon: 'ri-dashboard-line' },
    { key: 'people', label: '사명자', icon: 'ri-group-line' },
    { key: 'followup', label: '후속관리', icon: 'ri-inbox-archive-line' },
    { key: 'workload', label: '담당 현황', icon: 'ri-user-settings-line' },
    { key: 'meeting', label: '주간 회의', icon: 'ri-file-list-3-line' },
    { key: 'history', label: '변경 이력', icon: 'ri-history-line' },
  ];

  return <div className="min-h-screen bg-background-50"><div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10">
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6"><div><div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold mb-3"><i className="ri-shield-star-line"/> 부구역장 이상 운영센터</div><h1 className="text-2xl md:text-3xl font-black text-foreground-950">사명 운영센터</h1><p className="text-sm text-foreground-600 mt-2">사명·출석·심방·미션·보고서 데이터를 묶어 오늘 먼저 챙겨야 할 사람과 일을 보여줍니다.</p></div><button onClick={() => void loadData()} disabled={refreshing} className="px-4 py-2.5 rounded-full bg-background-100 border border-background-200 text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50"><i className={`ri-refresh-line ${refreshing ? 'animate-spin' : ''}`}/> 새로고침</button></div>
    {error && <div className="mb-5 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-sm text-rose-700">{error}</div>}{reminderMsg && <div className="mb-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">{reminderMsg}</div>}
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-5">{tabs.map(t => <button key={t.key} onClick={() => setTab(t.key)} className={`shrink-0 px-4 py-2.5 rounded-full text-sm font-semibold inline-flex items-center gap-2 ${tab === t.key ? 'bg-foreground-950 text-background-50' : 'bg-background-100 border border-background-200 text-foreground-600'}`}><i className={t.icon}/>{t.label}</button>)}</div>

    {loading ? <div className="py-24 text-center"><i className="ri-loader-4-line animate-spin text-3xl text-primary-500"/><p className="text-sm text-foreground-500 mt-3">운영 데이터를 모으는 중…</p></div> : <>
      {tab === 'overview' && <div className="space-y-5"><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[['관리 대상',people.length,'ri-group-line'],['최우선 케어',health.filter(x=>x.score<60).length,'ri-alarm-warning-line'],['후속관리',followUps.length,'ri-inbox-archive-line'],['주간 활동자',weeklySummary.activePeople,'ri-pulse-line']].map(([label,value,icon]) => <div key={String(label)} className="bg-background-100 border border-background-200 rounded-2xl p-4"><div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3"><i className={String(icon)}/></div><p className="text-2xl font-black">{value}</p><p className="text-xs text-foreground-600 mt-1">{label}</p></div>)}</div><div className="grid lg:grid-cols-[1.35fr_.65fr] gap-5"><div className="bg-background-100 border border-background-200 rounded-2xl p-5"><div className="flex items-center justify-between mb-4"><div><h2 className="font-bold">오늘 먼저 볼 사람</h2><p className="text-xs text-foreground-500 mt-1">활동 공백·미션·심방 후속을 종합한 우선순위입니다.</p></div><button onClick={()=>setTab('people')} className="text-xs text-primary-600 font-semibold">전체 보기</button></div><div className="space-y-2">{health.slice(0,6).map(item=><button key={item.person.user_id} onClick={()=>{setSelectedId(item.person.user_id);setTab('people')}} className="w-full text-left p-3 rounded-xl border border-background-200 flex items-center gap-3"><div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border ${scoreColor(item.score)}`}>{item.score}</div><div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate">{item.person.name}</p><p className="text-xs text-foreground-500 truncate">{ROLE_LABELS[item.person.role]} · {item.person.club||'소속 없음'} · {scoreLabel(item.score)}</p></div><i className="ri-arrow-right-s-line text-foreground-300"/></button>)}{health.length===0&&<p className="text-sm text-foreground-500 py-8 text-center">관리 대상이 없습니다.</p>}</div></div><div className="bg-background-100 border border-background-200 rounded-2xl p-5"><h2 className="font-bold">후속관리 Inbox</h2><p className="text-xs text-foreground-500 mt-1 mb-4">지금 처리할 일만 압축해서 보여줍니다.</p><div className="space-y-2">{followUps.slice(0,7).map(item=><Link key={item.key} to={item.href} className="block p-3 rounded-xl border border-background-200"><p className="text-sm font-semibold truncate">{item.title} · {item.name}</p><p className="text-xs text-foreground-500 mt-1 truncate">{item.subtitle}</p></Link>)}{followUps.length===0&&<div className="py-8 text-center text-sm text-foreground-500">급한 후속조치가 없습니다.</div>}</div></div></div></div>}

      {tab === 'people' && <div className="space-y-4"><div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3"><div><h2 className="text-xl font-bold">사명자 전체 현황</h2><p className="text-xs text-foreground-500 mt-1">건강도는 공개 점수가 아니라 관리 우선순위용 내부 지표입니다.</p></div><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="이름 · 동아리 · 구역 검색" className="w-full md:w-72 px-4 py-3 rounded-xl border border-background-200 bg-background-100 text-sm"/></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filteredPeople.map(item=><button key={item.person.user_id} onClick={()=>setSelectedId(item.person.user_id)} className="text-left bg-background-100 border border-background-200 rounded-2xl p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{item.person.name}</p><p className="text-xs text-foreground-500 mt-1">{ROLE_LABELS[item.person.role]} · {item.person.club||'소속 없음'}</p></div><span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${scoreColor(item.score)}`}>{item.score} · {scoreLabel(item.score)}</span></div><div className="grid grid-cols-2 gap-2 mt-4 text-xs"><div className="rounded-xl bg-background-50 p-3"><p className="text-foreground-400">마지막 활동</p><p className="font-semibold mt-1">{item.inactiveDays===999?'없음':`${item.inactiveDays}일 전`}</p></div><div className="rounded-xl bg-background-50 p-3"><p className="text-foreground-400">미션/후속</p><p className="font-semibold mt-1">{item.stats.pendingMission} / {item.stats.pendingFollowup}</p></div></div></button>)}</div>{selected&&<div className="fixed inset-0 z-[80] bg-black/30 flex items-end md:items-center justify-center p-3 md:p-6" onClick={()=>setSelectedId(null)}><div className="w-full max-w-3xl max-h-[90dvh] overflow-y-auto bg-background-100 rounded-2xl p-5 md:p-6" onClick={e=>e.stopPropagation()}><div className="flex items-start justify-between"><div><h3 className="text-xl font-bold">{selected.person.name}</h3><p className="text-xs text-foreground-500 mt-1">{ROLE_LABELS[selected.person.role]} · {selected.person.club||'소속 없음'} · {selected.person.zone||'구역 정보 없음'}</p></div><button onClick={()=>setSelectedId(null)} className="w-10 h-10 rounded-full bg-background-200 flex items-center justify-center"><i className="ri-close-line"/></button></div><div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5"><div className="rounded-xl bg-background-50 p-3"><p className="text-xs text-foreground-400">건강도</p><p className="text-xl font-black mt-1">{selected.score}</p></div><div className="rounded-xl bg-background-50 p-3"><p className="text-xs text-foreground-400">마지막 심방</p><p className="text-xs font-semibold mt-1">{shortDate(selected.stats.lastVisit)}</p></div><div className="rounded-xl bg-background-50 p-3"><p className="text-xs text-foreground-400">다음 심방</p><p className="text-xs font-semibold mt-1">{shortDate(selected.stats.nextVisit)}</p></div><div className="rounded-xl bg-background-50 p-3"><p className="text-xs text-foreground-400">담당 교사</p><p className="text-xs font-semibold mt-1">{selected.stats.teacherNames.join(', ')||'미지정'}</p></div></div><div className="flex flex-wrap gap-2 mt-4"><Link to="/visitations" className="px-3 py-2 rounded-full border border-background-200 text-xs font-semibold">심방 보기</Link><Link to="/reports/growth" className="px-3 py-2 rounded-full border border-background-200 text-xs font-semibold">성장 기록</Link><Link to="/missions" className="px-3 py-2 rounded-full border border-background-200 text-xs font-semibold">미션 관리</Link><button onClick={()=>void sendReminder(selected.person)} disabled={remindingId===selected.person.user_id} className="px-3 py-2 rounded-full bg-foreground-950 text-background-50 text-xs font-semibold disabled:opacity-50">{remindingId===selected.person.user_id?'전송 중…':'확인 요청 보내기'}</button></div><div className="mt-6"><h4 className="font-bold mb-3">최근 활동 타임라인</h4><div className="space-y-2">{selectedActivities.map((a,i)=><div key={`${a.type}-${a.at}-${i}`} className="flex gap-3 p-3 rounded-xl border border-background-200"><div className="w-8 h-8 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center shrink-0"><i className={a.type==='attendance'?'ri-user-heart-line':a.type==='mission'?'ri-medal-line':a.type==='visitation'?'ri-heart-pulse-line':'ri-file-list-3-line'}/></div><div className="min-w-0"><p className="text-sm font-semibold">{a.label}</p><p className="text-xs text-foreground-500 mt-1">{shortDate(a.at)}{a.detail?` · ${a.detail}`:''}</p></div></div>)}{selectedActivities.length===0&&<p className="text-sm text-foreground-500 py-8 text-center">최근 활동 기록이 없습니다.</p>}</div></div></div></div>}</div>}

      {tab === 'followup' && <div className="bg-background-100 border border-background-200 rounded-2xl p-5"><h2 className="text-xl font-bold">후속관리 Inbox</h2><p className="text-sm text-foreground-500 mt-1 mb-5">심방·미션·보고서에서 현재 후속이 필요한 항목을 자동으로 모았습니다.</p><div className="space-y-2">{followUps.map(item=><Link key={item.key} to={item.href} className="flex items-center gap-3 p-4 rounded-xl border border-background-200"><div className={`w-9 h-9 rounded-full flex items-center justify-center ${item.tone==='rose'?'bg-rose-50 text-rose-600':item.tone==='amber'?'bg-amber-50 text-amber-600':'bg-sky-50 text-sky-600'}`}><i className={item.tone==='rose'?'ri-heart-pulse-line':item.tone==='amber'?'ri-medal-line':'ri-file-search-line'}/></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate">{item.title} · {item.name}</p><p className="text-xs text-foreground-500 mt-1 truncate">{item.subtitle}</p></div><i className="ri-arrow-right-s-line text-foreground-300"/></Link>)}{followUps.length===0&&<div className="py-12 text-center text-sm text-foreground-500">후속관리 항목이 없습니다.</div>}</div></div>}

      {tab === 'workload' && <div className="space-y-4"><div><h2 className="text-xl font-bold">담당 현황</h2><p className="text-sm text-foreground-500 mt-1">동아리-담당교사 연결을 기준으로 관리 대상과 위험 인원을 보여줍니다.</p></div><div className="grid md:grid-cols-2 gap-3">{workload.map(row=><div key={row.club} className="bg-background-100 border border-background-200 rounded-2xl p-4"><div className="flex items-center justify-between"><div><p className="font-bold">{row.name}</p><p className="text-xs text-foreground-500 mt-1">{row.club}</p></div><span className="px-2.5 py-1 rounded-full bg-background-50 text-xs font-bold">{row.people}명</span></div><div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-background-50 p-3"><p className="text-foreground-400">관리 대상</p><p className="font-semibold mt-1">{row.people}명</p></div><div className="rounded-xl bg-rose-50 p-3"><p className="text-rose-500">최우선 케어</p><p className="font-semibold mt-1 text-rose-700">{row.atRisk}명</p></div></div></div>)}{workload.length===0&&<div className="py-12 text-center text-sm text-foreground-500">담당 현황 데이터가 없습니다.</div>}</div></div>}

      {tab === 'meeting' && <div className="space-y-5"><div className="bg-gradient-to-br from-rose-50 to-amber-50 border border-rose-100 rounded-2xl p-5"><p className="text-xs font-semibold text-rose-600 mb-2">이번 주 사명회의 준비</p><h2 className="text-2xl font-black">활동 {weeklySummary.activePeople}/{weeklySummary.totalPeople}명</h2><p className="text-sm text-foreground-600 mt-2">지난 7일 데이터를 기준으로 자동 요약했습니다.</p></div><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[['출석',weeklySummary.attendance,'ri-user-heart-line'],['미션',weeklySummary.missions,'ri-medal-line'],['심방',weeklySummary.visits,'ri-heart-pulse-line'],['보고서',weeklySummary.reports,'ri-file-list-3-line']].map(([label,value,icon])=><div key={String(label)} className="bg-background-100 border border-background-200 rounded-2xl p-4"><i className={String(icon)+' text-primary-600'}/><p className="text-2xl font-black mt-2">{value}</p><p className="text-xs text-foreground-500">{label}</p></div>)}</div><div className="bg-background-100 border border-background-200 rounded-2xl p-5"><h3 className="font-bold mb-4">회의에서 먼저 논의할 사람</h3><div className="space-y-2">{health.filter(x=>x.score<80).slice(0,8).map(item=><div key={item.person.user_id} className="flex items-center justify-between p-3 rounded-xl border border-background-200"><div><p className="text-sm font-semibold">{item.person.name}</p><p className="text-xs text-foreground-500 mt-1">{scoreLabel(item.score)} · 마지막 활동 {item.inactiveDays===999?'없음':`${item.inactiveDays}일 전`}</p></div><button onClick={()=>{setSelectedId(item.person.user_id);setTab('people')}} className="px-3 py-2 rounded-full bg-foreground-950 text-background-50 text-xs font-semibold">상세</button></div>)}{health.filter(x=>x.score<80).length===0&&<p className="text-sm text-foreground-500">특이사항이 없습니다.</p>}</div></div></div>}

      {tab === 'history' && <div className="bg-background-100 border border-background-200 rounded-2xl p-5"><h2 className="text-xl font-bold">변경 이력</h2><p className="text-sm text-foreground-500 mt-1 mb-5">기존 관리자 감사 로그를 그대로 연결했습니다.</p><div className="space-y-2">{auditLogs.map(log=><div key={log.id} className="p-3 rounded-xl border border-background-200 flex items-center justify-between"><div><p className="text-sm font-semibold">{log.target_user_name} · {log.action}</p><p className="text-xs text-foreground-500 mt-1">{log.performed_by_name} · {shortDate(log.created_at)}</p></div><i className="ri-history-line text-foreground-300"/></div>)}{auditLogs.length===0&&<p className="text-sm text-foreground-500 py-8 text-center">최근 감사 이력이 없습니다.</p>}</div></div>}
    </>}
  </div></div>;
}
