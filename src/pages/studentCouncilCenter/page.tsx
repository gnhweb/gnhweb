import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_HIERARCHY } from '@/types/auth';
import type { UserRole } from '@/types/auth';
import { supabase } from '@/lib/supabase';
import { formatKoreanDate } from '@/lib/date';

type Tab = 'cockpit' | 'feedback' | 'execution' | 'events' | 'people' | 'learning';
interface Row { [key: string]: any }

const safe = <T,>(value: T[] | null | undefined) => Array.isArray(value) ? value : [];
const daysAgo = (date?: string | null) => {
  if (!date) return 999;
  const t = new Date(date).getTime();
  return Number.isFinite(t) ? Math.max(0, Math.floor((Date.now() - t) / 86400000)) : 999;
};

export default function StudentCouncilCenter() {
  const { profile } = useAuth();
  const role = profile?.role as UserRole;
  const [tab, setTab] = useState<Tab>('cockpit');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Row[]>([]);
  const [meetings, setMeetings] = useState<Row[]>([]);
  const [schedules, setSchedules] = useState<Row[]>([]);
  const [reports, setReports] = useState<Row[]>([]);
  const [users, setUsers] = useState<Row[]>([]);
  const [projects, setProjects] = useState<Row[]>([]);
  const [actions, setActions] = useState<Row[]>([]);
  const [initiatives, setInitiatives] = useState<Row[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const canAccess = !!role && ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.assistant_zone_leader;

  const load = useCallback(async () => {
    if (!canAccess) return;
    setRefreshing(true);
    setError(null);
    const results = await Promise.all([
      supabase.from('suggestions').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('meeting_minutes').select('*').order('date', { ascending: false }).limit(80),
      supabase.from('schedules').select('*').order('event_date', { ascending: true }).limit(80),
      supabase.from('weekly_reports').select('*').order('created_at', { ascending: false }).limit(80),
      supabase.from('user_roles').select('user_id,name,role,club,zone,is_active,updated_at').limit(300),
      supabase.from('student_council_projects').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('student_council_actions').select('*').order('due_date', { ascending: true }).limit(150),
      supabase.from('student_council_initiatives').select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    const [s, m, sc, r, u, p, a, i] = results;
    setSuggestions(s.data || []); setMeetings(m.data || []); setSchedules(sc.data || []); setReports(r.data || []); setUsers(u.data || []);
    setProjects(p.data || []); setActions(a.data || []); setInitiatives(i.data || []);
    const errors = [p.error, a.error, i.error].filter(Boolean);
    if (errors.length === 3 && (s.error || m.error || r.error)) setError('운영 데이터 조회에 실패했습니다. Supabase SQL 설정과 RLS를 확인해주세요.');
    setLoading(false); setRefreshing(false);
  }, [canAccess]);

  useEffect(() => { load(); }, [load]);

  const metrics = useMemo(() => {
    const pendingSuggestions = suggestions.filter(x => ['pending', 'reviewing'].includes(String(x.status))).length;
    const unanswered = suggestions.filter(x => !x.response && !['closed', 'rejected'].includes(String(x.status))).length;
    const overdueActions = actions.filter(x => x.due_date && new Date(x.due_date) < new Date() && !['done','completed','closed'].includes(String(x.status))).length;
    const openActions = actions.filter(x => !['done','completed','closed'].includes(String(x.status))).length;
    const activeProjects = projects.filter(x => !['done','completed','archived'].includes(String(x.status))).length;
    const upcomingEvents = schedules.filter(x => x.event_date && new Date(x.event_date) >= new Date()).length;
    const recentMeetings = meetings.filter(x => daysAgo(x.date) <= 14).length;
    const reportRecent = reports.filter(x => daysAgo(x.created_at) <= 14).length;
    const inactive = users.filter(x => x.is_active !== false && daysAgo(x.updated_at) >= 14).length;
    const scoreParts = [
      Math.min(100, Math.round((suggestions.length ? (suggestions.length - pendingSuggestions) / suggestions.length * 100 : 100))),
      Math.min(100, openActions ? Math.max(0, 100 - overdueActions / openActions * 100) : 100),
      Math.min(100, activeProjects ? Math.max(0, 100 - activeProjects * 5) : 90),
      Math.min(100, Math.max(0, 100 - inactive * 3)),
    ];
    const health = Math.round(scoreParts.reduce((a,b) => a+b, 0) / scoreParts.length);
    return { pendingSuggestions, unanswered, overdueActions, openActions, activeProjects, upcomingEvents, recentMeetings, reportRecent, inactive, health };
  }, [suggestions, actions, projects, schedules, meetings, reports, users]);

  const priorities = useMemo(() => {
    const out: {level:'high'|'medium'; title:string; detail:string; href?:string}[] = [];
    if (metrics.overdueActions) out.push({level:'high', title:`기한을 넘긴 실행 과제 ${metrics.overdueActions}건`, detail:'회의에서 결정된 일이 실제 결과로 이어지지 않고 있습니다.', href:'#execution'});
    if (metrics.unanswered) out.push({level:'high', title:`학생 의견 ${metrics.unanswered}건이 아직 닫히지 않음`, detail:'학생에게 답변하거나 실행 계획을 공개해야 합니다.', href:'#feedback'});
    if (metrics.inactive) out.push({level:'medium', title:`최근 활동이 오래된 회원 ${metrics.inactive}명`, detail:'개별 상황을 확인하고 필요한 지원을 연결하세요.', href:'#people'});
    if (!metrics.overdueActions && !metrics.unanswered) out.push({level:'medium', title:'이번 주 개선 실험을 하나 시작하세요', detail:'작게 실행하고 학생 피드백으로 검증하는 것을 권장합니다.', href:'#learning'});
    return out.slice(0, 4);
  }, [metrics]);

  const tabs: {id:Tab; label:string; icon:string}[] = [
    {id:'cockpit', label:'오늘의 핵심', icon:'ri-dashboard-3-line'},
    {id:'feedback', label:'학생 목소리', icon:'ri-chat-voice-line'},
    {id:'execution', label:'실행센터', icon:'ri-task-line'},
    {id:'events', label:'행사·프로젝트', icon:'ri-calendar-check-line'},
    {id:'people', label:'조직 건강', icon:'ri-team-line'},
    {id:'learning', label:'혁신·학습', icon:'ri-flask-line'},
  ];

  if (!canAccess) return <div className="p-6 text-center text-sm text-foreground-500">부구역장 이상만 접근할 수 있습니다.</div>;

  return (
    <div className="min-h-screen pb-24 bg-background-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
        <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-primary-900 text-white p-5 sm:p-7 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
            <div>
              <p className="text-xs font-bold tracking-[.18em] uppercase text-white/60">GNH STUDENT COUNCIL</p>
              <h1 className="text-2xl sm:text-3xl font-black mt-1">학생회 발전센터</h1>
              <p className="text-sm text-white/70 mt-2 max-w-2xl">전도 실적이 아니라 학생의 삶·만족·신뢰·참여·성장을 실제 결과로 만드는 운영 시스템입니다.</p>
            </div>
            <button onClick={load} disabled={refreshing} className="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-bold">{refreshing ? '새로고침 중…' : '데이터 새로고침'}</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            <Metric label="학생회 건강도" value={`${metrics.health}점`} icon="ri-heart-pulse-line" />
            <Metric label="열린 실행과제" value={`${metrics.openActions}건`} icon="ri-list-check-3" />
            <Metric label="미응답 의견" value={`${metrics.unanswered}건`} icon="ri-chat-off-line" />
            <Metric label="활성 프로젝트" value={`${metrics.activeProjects}개`} icon="ri-rocket-line" />
          </div>
        </div>

        <div className="sticky top-0 z-20 mt-4 -mx-1 px-1 py-2 bg-background-50/95 backdrop-blur overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={`px-3.5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap ${tab===t.id ? 'bg-primary-600 text-white shadow' : 'bg-white text-foreground-600 border border-background-200'}`}><i className={`${t.icon} mr-1.5`} />{t.label}</button>)}
          </div>
        </div>

        {error && <div className="mt-3 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700">{error} <button onClick={load} className="font-bold underline ml-2">다시 시도</button></div>}
        {loading ? <div className="py-20 text-center text-sm text-foreground-500">학생회 발전 데이터를 모으는 중…</div> : <>
          {tab === 'cockpit' && <Cockpit priorities={priorities} metrics={metrics} suggestions={suggestions} meetings={meetings} />}
          {tab === 'feedback' && <Feedback suggestions={suggestions} />}
          {tab === 'execution' && <Execution actions={actions} projects={projects} />}
          {tab === 'events' && <Events schedules={schedules} projects={projects} />}
          {tab === 'people' && <People users={users} metrics={metrics} />}
          {tab === 'learning' && <Learning initiatives={initiatives} meetings={meetings} />}
        </>}
      </div>
    </div>
  );
}

function Metric({label,value,icon}:{label:string;value:string;icon:string}) { return <div className="rounded-2xl bg-white/10 p-3"><i className={`${icon} text-lg text-white/80`} /><div className="text-xl font-black mt-1">{value}</div><div className="text-[11px] text-white/60">{label}</div></div>; }
function Section({title,sub,children}:{title:string;sub?:string;children:React.ReactNode}) { return <section className="mt-5 rounded-2xl bg-white border border-background-200 p-4 sm:p-5 shadow-sm"><div className="mb-4"><h2 className="font-black text-lg">{title}</h2>{sub&&<p className="text-xs text-foreground-500 mt-1">{sub}</p>}</div>{children}</section>; }
function Empty({text}:{text:string}) { return <div className="py-8 text-center text-sm text-foreground-400">{text}</div>; }

function Cockpit({priorities,metrics,suggestions,meetings}:{priorities:any[];metrics:any;suggestions:Row[];meetings:Row[]}) {
  return <>
    <Section title="지금 가장 중요한 일" sub="데이터를 읽는 데서 끝나지 않고 바로 행동할 항목입니다.">
      <div className="grid gap-3">{priorities.map((p,i)=><motion.div initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} transition={{delay:i*.04}} key={p.title} className={`rounded-2xl p-4 border ${p.level==='high'?'border-rose-200 bg-rose-50':'border-amber-200 bg-amber-50'}`}><div className="flex gap-3"><span className={`mt-0.5 w-2.5 h-2.5 rounded-full shrink-0 ${p.level==='high'?'bg-rose-500':'bg-amber-500'}`} /><div><b className="text-sm">{p.title}</b><p className="text-xs text-foreground-600 mt-1">{p.detail}</p></div></div></motion.div>)}</div>
    </Section>
    <div className="grid lg:grid-cols-3 gap-4 mt-4">
      <Card title="학생 의견" value={`${suggestions.length}건`} note={`미응답 ${metrics.unanswered}건`} href="#feedback" icon="ri-chat-voice-line" />
      <Card title="최근 회의" value={`${metrics.recentMeetings}건`} note="최근 14일" href="/meetings" icon="ri-discuss-line" />
      <Card title="주간 실행" value={`${metrics.openActions}건`} note={`기한초과 ${metrics.overdueActions}건`} href="#execution" icon="ri-check-double-line" />
    </div>
    <Section title="운영 원칙" sub="전국 최고 수준을 만드는 기준은 경쟁보다 폐쇄루프입니다."><div className="grid sm:grid-cols-4 gap-3">{['학생이 말한다','학생회가 결정한다','담당자가 실행한다','학생이 결과를 평가한다'].map((x,i)=><div key={x} className="rounded-xl bg-background-50 p-4 text-center"><div className="text-xs text-primary-600 font-black">0{i+1}</div><div className="text-sm font-bold mt-1">{x}</div></div>)}</div></Section>
  </>;
}
function Card({title,value,note,href,icon}:{title:string;value:string;note:string;href:string;icon:string}) { return <Link to={href} className="rounded-2xl bg-white border border-background-200 p-4 hover:-translate-y-0.5 transition shadow-sm"><i className={`${icon} text-xl text-primary-600`} /><div className="text-2xl font-black mt-2">{value}</div><div className="font-bold text-sm">{title}</div><div className="text-xs text-foreground-500 mt-1">{note}</div></Link>; }

function Feedback({suggestions}:{suggestions:Row[]}) { const grouped = useMemo(()=>{const m:Record<string,number>={}; suggestions.forEach(x=>{const k=String(x.status||'pending');m[k]=(m[k]||0)+1});return m},[suggestions]); return <><Section title="학생 목소리 → 실행" sub="건의사항을 단순 답변으로 끝내지 않고 실행 대상으로 바꾸는 곳입니다."><div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">{Object.entries(grouped).map(([k,v])=><div key={k} className="rounded-xl bg-background-50 p-3"><div className="text-xs text-foreground-500">{k}</div><b className="text-xl">{v}</b></div>)}</div><div className="space-y-2">{suggestions.slice(0,12).map(x=><div key={x.id} className="rounded-xl border border-background-200 p-3 flex justify-between gap-3"><div><b className="text-sm">{x.title}</b><p className="text-xs text-foreground-500 mt-1 line-clamp-2">{x.content}</p></div><span className="text-[11px] font-bold text-primary-600">{x.status||'pending'}</span></div>)}</div>{!suggestions.length&&<Empty text="아직 등록된 학생 의견이 없습니다."/>}</Section><div className="mt-4 flex gap-2"><Link className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-bold" to="/suggestions">전체 의견 보기</Link><Link className="px-4 py-2 rounded-xl bg-white border border-background-200 text-sm font-bold" to="/meetings">회의로 연결</Link></div></>; }
function Execution({actions,projects}:{actions:Row[];projects:Row[]}) { const open=actions.filter(x=>!['done','completed','closed'].includes(String(x.status))); return <><Section title="실행센터" sub="회의의 결정이 실제 결과로 이어지는지 추적합니다."><div className="grid sm:grid-cols-3 gap-3 mb-4"><MetricBox label="전체 과제" value={actions.length}/><MetricBox label="진행 중" value={open.length}/><MetricBox label="기한초과" value={actions.filter(x=>x.due_date&&new Date(x.due_date)<new Date()&&!['done','completed','closed'].includes(String(x.status))).length}/></div>{actions.length?<div className="space-y-2">{actions.slice(0,15).map(x=><div key={x.id} className="p-3 rounded-xl border border-background-200 flex justify-between"><div><b className="text-sm">{x.title}</b><p className="text-xs text-foreground-500">{x.assignee_name||'담당자 미지정'} · {x.due_date||'기한 미지정'}</p></div><span className="text-xs font-bold">{x.status||'todo'}</span></div>)}</div>:<Empty text="실행과제가 없습니다. 회의 결정사항을 실행과제로 만들어 보세요."/>}</Section><Section title="프로젝트 포트폴리오"><div className="grid md:grid-cols-2 gap-3">{projects.slice(0,12).map(x=><div key={x.id} className="rounded-xl border p-4"><div className="flex justify-between"><b>{x.title}</b><span className="text-xs text-primary-600">{x.progress??0}%</span></div><div className="h-2 bg-background-100 rounded-full mt-3 overflow-hidden"><div className="h-full bg-primary-600" style={{width:`${Math.min(100,Math.max(0,Number(x.progress)||0))}%`}}/></div><p className="text-xs text-foreground-500 mt-2">{x.owner_name||'담당자 미지정'} · {x.status||'planning'}</p></div>)}{!projects.length&&<Empty text="프로젝트를 등록하면 학생회 핵심 과제를 한 곳에서 관리할 수 있습니다."/>}</div></Section></>; }
function MetricBox({label,value}:{label:string;value:number}){return <div className="rounded-xl bg-background-50 p-4"><div className="text-xs text-foreground-500">{label}</div><b className="text-2xl">{value}</b></div>}
function Events({schedules,projects}:{schedules:Row[];projects:Row[]}){return <><Section title="다가오는 행사" sub="행사를 단순 일정이 아니라 프로젝트로 운영하세요."><div className="space-y-2">{schedules.slice(0,15).map(x=><div key={x.id} className="rounded-xl border p-3 flex justify-between"><div><b className="text-sm">{x.title||x.event_title||'행사'}</b><p className="text-xs text-foreground-500 mt-1">{x.event_date||x.start_at||''}</p></div><span className="text-xs">{x.target_club||'전체'}</span></div>)}{!schedules.length&&<Empty text="등록된 일정이 없습니다."/>}</div></Section><Section title="프로젝트와 연결"><p className="text-sm text-foreground-600">행사마다 담당자·체크리스트·예산·리스크·사후평가를 연결하는 구조입니다. 현재 등록 프로젝트 {projects.length}개.</p></Section></>}
function People({users,metrics}:{users:Row[];metrics:any}){const active=users.filter(x=>x.is_active!==false);const byRole=useMemo(()=>{const m:Record<string,number>={};active.forEach(x=>m[x.role||'member']=(m[x.role||'member']||0)+1);return m},[active]);return <><Section title="조직 건강도" sub="사람을 점수화하기보다 지원이 필요한 신호를 찾습니다."><div className="grid sm:grid-cols-3 gap-3"><MetricBox label="활성 회원" value={active.length}/><MetricBox label="활동 공백 14일+" value={metrics.inactive}/><MetricBox label="역할 수" value={Object.keys(byRole).length}/></div></Section><Section title="역할별 인원"><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{Object.entries(byRole).map(([k,v])=><div key={k} className="p-3 rounded-xl bg-background-50"><div className="text-xs text-foreground-500">{k}</div><b>{v}명</b></div>)}</div></Section><Section title="운영 원칙"><p className="text-sm text-foreground-600">업무가 특정 사람에게 몰리지 않도록 담당자·기한·대체 담당자를 기록하고, 활동 공백은 비난이 아니라 지원 신호로 처리합니다.</p></Section></>}
function Learning({initiatives,meetings}:{initiatives:Row[];meetings:Row[]}){return <><Section title="혁신 실험실" sub="작게 실험하고 빠르게 배우는 학생회입니다."><div className="grid md:grid-cols-2 gap-3">{initiatives.map(x=><div key={x.id} className="rounded-xl border p-4"><div className="flex justify-between"><b>{x.title}</b><span className="text-xs text-primary-600">{x.status||'idea'}</span></div><p className="text-xs text-foreground-500 mt-2">가설: {x.hypothesis||'가설 미작성'}</p><p className="text-xs text-foreground-500">성공 기준: {x.success_metric||'미설정'}</p></div>)}{!initiatives.length&&<Empty text="첫 번째 개선 실험을 등록해 보세요. 예: 행사 만족도 10% 개선 파일럿"/>}</div></Section><Section title="회의에서 배우기"><p className="text-sm text-foreground-600">최근 회의 {meetings.length}건의 결정·병목·미해결 항목을 다음 실험과 연결하는 구조입니다.</p><Link to="/meeting-copilot" className="inline-block mt-3 px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-bold">AI 회의 코파일럿 열기</Link></Section></>}
