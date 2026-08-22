import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { formatLocalDate } from '@/lib/date';

type Person = { user_id: string; name: string; club: string | null; role: string; assigned_teacher_id: string | null };
type Activity = { at: string; type: string; title: string; person: string; href?: string };
type Attention = { label: string; detail: string; href: string; icon: string };

const ROLE_LABEL: Record<string, string> = {
  assistant_zone_leader: '사명자', zone_leader: '구역장', planning_manager: '기획', education_manager: '교육',
  service_manager: '봉사', recreation_manager: '레크', sports_manager: '체육', praise_manager: '찬양',
  president: '회장', secretary: '총무', treasurer: '회계', teacher: '교사', chief: '부장', member: '학생',
};

function startOfWeek(d = new Date()) {
  const x = new Date(d); const day = x.getDay(); const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff); x.setHours(0,0,0,0); return x;
}

function daysAgo(days:number) { const d=new Date(); d.setDate(d.getDate()-days); return d.toISOString(); }

export default function MissionOperationsPage() {
  const { user, hasRole } = useAuth();
  const canManage = !!user && hasRole('assistant_zone_leader');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [attention, setAttention] = useState<Attention[]>([]);
  const [stats, setStats] = useState({ total:0, active:0, inactive:0, missions:0, pendingProofs:0, prayer:0, reports:0, visits:0, checklist:0 });
  const [selected, setSelected] = useState<Person | null>(null);
  const [selectedTimeline, setSelectedTimeline] = useState<Activity[]>([]);
  const [teachers, setTeachers] = useState<Person[]>([]);
  const [assignmentLoading, setAssignmentLoading] = useState(false);

  const weekIso = startOfWeek().toISOString();
  const sevenAgo = daysAgo(7);

  const load = async () => {
    if (!canManage) { setLoading(false); return; }
    setRefreshing(true);
    try {
      const [{ data: users }, missionP, pendingP, prayerP, reportP, visitP, checklistP, seniorTransitionP] = await Promise.all([
        supabase.from('user_roles').select('user_id,name,club,role,assigned_teacher_id').eq('is_active', true).order('name').limit(500),
        supabase.from('mission_assignments').select('id,status,student_id,assigned_at,completed_at,submitted_at').gte('assigned_at', weekIso),
        supabase.from('mission_assignments').select('id,student_id,submitted_at,status').eq('status','submitted').limit(200),
        supabase.from('prayer_topics').select('id,created_at').gte('created_at', sevenAgo),
        Promise.all([
          supabase.from('weekly_reports').select('id,author_id,created_at,status').gte('created_at', sevenAgo),
          supabase.from('growth_records').select('id,author_id,created_at,status').gte('created_at', sevenAgo),
          supabase.from('event_reports').select('id,author_id,created_at,status').gte('created_at', sevenAgo),
        ]),
        supabase.from('visitations').select('id,student_id,student_name,scheduled_at,status,follow_up_needed').gte('scheduled_at', sevenAgo),
        supabase.from('senior_checklist').select('id,completed'),
        supabase.from('graduation_transition').select('id,user_id,checklist,updated_at').gte('updated_at', sevenAgo),
      ]);

      const all = (users || []) as Person[];
      setPeople(all);
      const staff = all.filter(p => ['assistant_zone_leader','zone_leader','planning_manager','education_manager','service_manager','recreation_manager','sports_manager','praise_manager','president','secretary','treasurer','teacher','chief'].includes(p.role));
      setTeachers(staff);

      const activeMemberIds = new Set(all.filter(p=>p.role==='member').map(p=>p.user_id));
      const weekMissions = missionP.data || [];
      const completedThisWeek = weekMissions.filter((m:any)=>m.status==='completed').length;
      const activeIds = new Set<string>();
      weekMissions.forEach((m:any)=>{ if (m.student_id) activeIds.add(m.student_id); });
      const reportRows: any[] = (reportP || []).flatMap((r:any)=>r?.data || []);
      const recentPersonIds = new Set<string>();
      reportRows.forEach(r=>r.author_id && recentPersonIds.add(r.author_id));
      (visitP.data||[]).forEach((v:any)=>v.student_id&&recentPersonIds.add(v.student_id));
      (pendingP.data||[]).forEach((m:any)=>m.student_id&&recentPersonIds.add(m.student_id));

      setStats({
        total: activeMemberIds.size,
        active: Array.from(activeMemberIds).filter(id=>recentPersonIds.has(id)).length,
        inactive: Math.max(0, activeMemberIds.size - Array.from(activeMemberIds).filter(id=>recentPersonIds.has(id)).length),
        missions: completedThisWeek,
        pendingProofs: (pendingP.data||[]).length,
        prayer: (prayerP.data||[]).length,
        reports: reportRows.length,
        visits: (visitP.data||[]).length,
        checklist: (checklistP.data||[]).length ? Math.round((checklistP.data||[]).filter((x:any)=>x.completed).length/(checklistP.data||[]).length*100) : 0,
      });

      const alerts: Attention[] = [];
      if (activeMemberIds.size > 0 && activeMemberIds.size - recentPersonIds.size > 0) {
        alerts.push({label:'7일 이상 활동이 보이지 않는 학생', detail:`${Math.max(0, activeMemberIds.size-recentPersonIds.size)}명`, href:'/dashboard', icon:'ri-user-unfollow-line'});
      }
      if ((pendingP.data||[]).length) alerts.push({label:'검토 대기 사명 인증', detail:`${pendingP.data?.length||0}건`, href:'/missions', icon:'ri-time-line'});
      const followups = (visitP.data||[]).filter((v:any)=>v.follow_up_needed).length;
      if (followups) alerts.push({label:'후속 연락이 필요한 심방', detail:`${followups}건`, href:'/visitations', icon:'ri-heart-pulse-line'});
      const pendingReports = reportRows.filter(r=>['submitted','review','pending'].includes(r.status)).length;
      if (pendingReports) alerts.push({label:'검토가 필요한 보고서', detail:`${pendingReports}건`, href:'/reports/review', icon:'ri-file-search-line'});
      setAttention(alerts);

      const acts: Activity[] = [];
      (missionP.data||[]).slice(0,12).forEach((m:any)=>acts.push({at:m.completed_at||m.submitted_at||m.assigned_at,type:'미션',title:m.status==='completed'?'사명 완료':'사명 배정',person:all.find(p=>p.user_id===m.student_id)?.name||'학생',href:'/missions'}));
      reportRows.slice(0,12).forEach(r=>acts.push({at:r.created_at,type:'보고서',title:`보고서 ${r.status||'작성'}`,person:all.find(p=>p.user_id===r.author_id)?.name||'사명자',href:'/reports/weekly'}));
      (visitP.data||[]).slice(0,12).forEach((v:any)=>acts.push({at:v.scheduled_at,type:'심방',title:v.topic||'심방 일정',person:v.student_name||'학생',href:'/visitations'}));
      acts.sort((a,b)=>new Date(b.at).getTime()-new Date(a.at).getTime());
      setActivities(acts.slice(0,20));
    } finally {
      setLoading(false); setRefreshing(false);
    }
  };

  useEffect(()=>{ void load(); },[canManage]);

  const selectPerson = async (person:Person) => {
    setSelected(person);
    const [m,r,g,v] = await Promise.all([
      supabase.from('mission_assignments').select('assigned_at,completed_at,submitted_at,status,mission_id').eq('student_id',person.user_id).order('assigned_at',{ascending:false}).limit(20),
      supabase.from('weekly_reports').select('created_at,status,week_start,club').eq('author_id',person.user_id).order('created_at',{ascending:false}).limit(10),
      supabase.from('growth_records').select('created_at,status,record_date').eq('author_id',person.user_id).order('created_at',{ascending:false}).limit(10),
      supabase.from('visitations').select('scheduled_at,status,topic,follow_up_needed').eq('student_id',person.user_id).order('scheduled_at',{ascending:false}).limit(10),
    ]);
    const tl:Activity[]=[];
    (m.data||[]).forEach((x:any)=>tl.push({at:x.completed_at||x.submitted_at||x.assigned_at,type:'미션',title:x.status==='completed'?'미션 완료':`미션 ${x.status}`,person:person.name,href:'/missions'}));
    (r.data||[]).forEach((x:any)=>tl.push({at:x.created_at,type:'주간보고',title:`보고서 ${x.status}`,person:person.name,href:'/reports/weekly'}));
    (g.data||[]).forEach((x:any)=>tl.push({at:x.created_at,type:'성장기록',title:`성장 기록 ${x.status}`,person:person.name,href:'/reports/growth'}));
    (v.data||[]).forEach((x:any)=>tl.push({at:x.scheduled_at,type:'심방',title:x.topic||'심방',person:person.name,href:'/visitations'}));
    tl.sort((a,b)=>new Date(b.at).getTime()-new Date(a.at).getTime());
    setSelectedTimeline(tl.slice(0,25));
  };

  const assignTeacher = async (teacherId:string) => {
    if (!selected || assignmentLoading) return;
    setAssignmentLoading(true);
    try {
      const { error } = await supabase.from('user_roles').update({ assigned_teacher_id: teacherId || null }).eq('user_id', selected.user_id);
      if (!error) {
        setPeople(prev=>prev.map(p=>p.user_id===selected.user_id?{...p,assigned_teacher_id:teacherId||null}:p));
        setSelected({...selected,assigned_teacher_id:teacherId||null});
      }
    } finally { setAssignmentLoading(false); }
  };

  if (!canManage) return <div className="min-h-screen flex items-center justify-center p-6"><div className="text-center"><i className="ri-lock-line text-3xl text-foreground-300"/><h2 className="mt-3 text-lg font-bold">사명 운영센터 접근 권한이 없습니다.</h2></div></div>;

  const memberPeople = people.filter(p=>p.role==='member');

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div><p className="text-xs font-bold text-rose-600 mb-1">사명자 이상 전용</p><h1 className="text-2xl md:text-3xl font-bold">사명 운영센터</h1><p className="text-sm text-foreground-600 mt-1">출석·작은 사명·보고서·심방·기도 데이터를 한곳에서 확인하고 필요한 조치를 찾습니다.</p></div>
          <button onClick={()=>void load()} className="px-4 py-2 rounded-xl bg-background-100 border border-background-200 text-sm font-semibold" disabled={refreshing}>{refreshing?'새로고침 중…':'새로고침'}</button>
        </div>

        {loading ? <div className="py-20 text-center">불러오는 중…</div> : <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[['관리 대상',stats.total,'ri-group-line'],['7일 활동',stats.active,'ri-pulse-line'],['7일 미활동',stats.inactive,'ri-user-unfollow-line'],['이번 주 완료 사명',stats.missions,'ri-medal-line'],['검토 대기 인증',stats.pendingProofs,'ri-time-line'],['최근 기도 주제',stats.prayer,'ri-prayer-line'],['최근 7일 보고서',stats.reports,'ri-file-list-3-line'],['헌신예배 준비',`${stats.checklist}%`,'ri-task-line']].map(([l,v,i])=><div key={String(l)} className="bg-background-100 border border-background-200 rounded-2xl p-4"><i className={`${i} text-rose-600`}/><p className="text-xl md:text-2xl font-bold mt-2">{v}</p><p className="text-xs text-foreground-600 mt-1">{l}</p></div>)}
          </div>

          <div className="grid lg:grid-cols-3 gap-5">
            <section className="lg:col-span-2 space-y-5">
              <div className="bg-background-100 border border-background-200 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4"><div><h2 className="font-bold">주의가 필요한 현황</h2><p className="text-xs text-foreground-500 mt-1">기존 기능의 데이터를 기준으로 자동 계산합니다.</p></div><Link to="/dashboard" className="text-xs text-rose-600">대시보드</Link></div>
                {attention.length===0 ? <p className="text-sm text-foreground-500 py-6">현재 눈에 띄는 주의 항목이 없습니다.</p> : <div className="grid sm:grid-cols-2 gap-3">{attention.map(a=><Link key={a.label} to={a.href} className="border border-background-200 rounded-xl p-4 hover:border-rose-200"><i className={`${a.icon} text-rose-600`}/><p className="font-semibold text-sm mt-2">{a.label}</p><p className="text-xs text-foreground-500 mt-1">{a.detail}</p></Link>)}</div>}
              </div>

              <div className="bg-background-100 border border-background-200 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4"><h2 className="font-bold">최근 활동 타임라인</h2><div className="flex gap-2 text-xs"><Link to="/missions" className="text-rose-600">미션</Link><Link to="/reports/weekly" className="text-rose-600">보고서</Link><Link to="/visitations" className="text-rose-600">심방</Link></div></div>
                <div className="space-y-3">{activities.map((a,i)=><Link to={a.href||'/'} key={`${a.at}-${i}`} className="flex gap-3 p-3 rounded-xl hover:bg-background-50"><div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0"><i className="ri-time-line text-sm"/></div><div className="min-w-0 flex-1"><div className="flex gap-2 items-center"><span className="text-xs font-semibold">{a.type}</span><span className="text-[10px] text-foreground-400">{formatLocalDate(a.at)}</span></div><p className="text-sm font-medium truncate">{a.person} · {a.title}</p></div></Link>)}{activities.length===0&&<p className="text-sm text-foreground-500 py-6">최근 활동이 없습니다.</p>}</div>
              </div>

              <div className="bg-background-100 border border-background-200 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4"><h2 className="font-bold">사명자/학생 빠른 조회</h2><span className="text-xs text-foreground-400">이름을 눌러 상세 활동 확인</span></div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{memberPeople.slice(0,60).map(p=><button key={p.user_id} onClick={()=>void selectPerson(p)} className="text-left border border-background-200 rounded-xl p-3 hover:border-rose-200"><p className="text-sm font-semibold truncate">{p.name}</p><p className="text-[11px] text-foreground-500 truncate">{p.club||'소속 없음'} · {ROLE_LABEL[p.role]||p.role}</p></button>)}</div>
              </div>
            </section>

            <aside className="space-y-5">
              <div className="bg-background-100 border border-background-200 rounded-2xl p-5"><h2 className="font-bold mb-4">주간 운영 바로가기</h2><div className="grid gap-2">{[
                ['/meetings','사명자 회의록','ri-chat-check-line'],['/meeting-copilot','회의 코파일럿','ri-lightbulb-flash-line'],['/reports/review','보고서 검토','ri-file-search-line'],['/missions','작은 사명 관리','ri-medal-line'],['/visitations','심방 스케줄','ri-heart-pulse-line'],['/dashboard/attendance/analytics','출석 통계','ri-bar-chart-line'],['/senior/checklist','헌신예배 체크리스트','ri-task-line'],['/senior/proposals','헌신예배 제안·투표','ri-vip-crown-line']].map(([h,l,i])=><Link key={h} to={h} className="flex items-center gap-3 p-3 rounded-xl bg-background-50 hover:bg-rose-50"><i className={`${i} text-rose-600`}/><span className="text-sm font-semibold">{l}</span></Link>)}</div></div>

              {selected && <div className="bg-background-100 border border-background-200 rounded-2xl p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-foreground-400">선택한 사람</p><h2 className="font-bold mt-1">{selected.name}</h2><p className="text-xs text-foreground-500">{selected.club||'소속 없음'} · {ROLE_LABEL[selected.role]||selected.role}</p></div><button onClick={()=>setSelected(null)} className="text-foreground-400">×</button></div><div className="mt-4"><label className="text-xs font-semibold text-foreground-600">담당자 배정</label><select value={selected.assigned_teacher_id||''} onChange={e=>void assignTeacher(e.target.value)} disabled={assignmentLoading} className="mt-1"><option value="">담당자 없음</option>{teachers.map(t=><option key={t.user_id} value={t.user_id}>{t.name} · {ROLE_LABEL[t.role]||t.role}</option>)}</select></div><div className="mt-5"><p className="text-xs font-semibold text-foreground-600 mb-2">최근 활동</p><div className="space-y-2 max-h-64 overflow-y-auto">{selectedTimeline.map((a,i)=><Link to={a.href||'/'} key={`${a.at}-${i}`} className="block text-xs p-2 rounded-lg bg-background-50"><span className="text-foreground-400">{formatLocalDate(a.at)}</span><span className="ml-2 font-medium">{a.type} · {a.title}</span></Link>)}{selectedTimeline.length===0&&<p className="text-xs text-foreground-500">활동 기록이 없습니다.</p>}</div></div></div>}

              <div className="bg-background-100 border border-background-200 rounded-2xl p-5"><h2 className="font-bold mb-3">운영 지표</h2><div className="space-y-3 text-sm"><div className="flex justify-between"><span>심방 일정</span><strong>{stats.visits}</strong></div><div className="flex justify-between"><span>헌신예배 준비</span><strong>{stats.checklist}%</strong></div><div className="flex justify-between"><span>최근 보고서</span><strong>{stats.reports}</strong></div><div className="flex justify-between"><span>최근 기도 주제</span><strong>{stats.prayer}</strong></div></div></div>
            </aside>
          </div>
        </>}
      </div>
    </div>
  );
}
