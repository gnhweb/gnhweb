import { formatKoreanDate, formatKoreanDateTime } from '@/lib/date';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { MISSION_CATEGORIES, BADGE_DEFINITIONS } from '@/constants/missionBadges';

interface Mission {
  id: string;
  title: string;
  description: string;
  category: string;
  club: string;
  created_at: string;
  created_by: string;
}

interface MissionAssignment {
  id: string;
  mission_id: string;
  student_id: string;
  student_name?: string;
  status: string;
  assigned_at: string;
  completed_at: string | null;
  proof_image_url: string | null;
  proof_note: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reject_reason: string | null;
  assigned_by: string;
}

export default function MissionsPage() {
  const { user, profile, hasRole } = useAuth();
  const canManage = hasRole('service_manager') || hasRole('zone_leader') || hasRole('teacher') || hasRole('chief');
  const canPublish = hasRole('assistant_zone_leader');

  const [missions, setMissions] = useState<Mission[]>([]);
  const [assignments, setAssignments] = useState<MissionAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [newClub, setNewClub] = useState('');
  const [savingMission, setSavingMission] = useState(false);
  const [createMsg, setCreateMsg] = useState('');
  const [availableClubs, setAvailableClubs] = useState<string[]>([]);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [deletingProofId, setDeletingProofId] = useState<string | null>(null);
  const [tab, setTab] = useState<'missions' | 'assignments'>('missions');
  const [studentNames, setStudentNames] = useState<Record<string, { name: string; club: string }>>({});

  useEffect(() => {
    if (!user) return;
    void loadData();
    void loadClubs();
  }, [user]);

  const loadClubs = async () => {
    const { data } = await supabase.from('user_roles').select('club').eq('is_active', true).not('club', 'is', null);
    if (data) setAvailableClubs([...new Set(data.map(d => d.club).filter(Boolean))] as string[]);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: mData, error: mError } = await supabase.from('missions').select('*').order('created_at', { ascending: false });
      if (mError) throw mError;
      setMissions((mData || []) as Mission[]);
      const { data: aData, error: aError } = await supabase.from('mission_assignments').select('*').order('assigned_at', { ascending: false }).limit(100);
      if (aError) throw aError;
      setAssignments((aData || []) as MissionAssignment[]);
    } catch {
      setError('미션 데이터를 불러오는 중 문제가 발생했어요. 다시 시도해주세요');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !user) return;
    setSavingMission(true); setCreateMsg('');
    try {
      const { error: insertError } = await supabase.from('missions').insert({ title: newTitle.trim(), description: newDescription.trim(), category: newCategory, club: newClub.trim(), created_by: user.id });
      if (insertError) throw insertError;
      setCreateMsg('작은 사명이 게시되었습니다.'); setNewTitle(''); setNewDescription(''); setNewCategory('general'); setNewClub(''); setShowCreateForm(false); await loadData();
    } catch { setCreateMsg('작은 사명 게시에 실패했습니다.'); }
    setSavingMission(false);
  };

  const handleClaim = async (mission: Mission) => {
    if (!user) return;
    try {
      const { error: claimError } = await supabase.rpc('claim_mission', { p_mission_id: Number(mission.id) });
      if (claimError) throw claimError;
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '작은 사명을 맡지 못했습니다.');
    }
  };

  const handleDeleteMission = async (missionId: string) => {
    if (!confirm('정말 이 작은 사명을 삭제할까요? 관련 배정 내역도 함께 삭제됩니다.')) return;
    const { error: deleteError } = await supabase.from('missions').delete().eq('id', missionId);
    if (deleteError) setError('작은 사명 삭제에 실패했습니다.'); else await loadData();
  };

  const handleDeleteProof = async (assignmentId: string) => {
    if (!confirm('학생이 올린 인증(사진/내용)을 삭제할까요? 학생이 다시 제출할 수 있는 상태로 되돌아갑니다.')) return;
    setDeletingProofId(assignmentId);
    try {
      const { error } = await supabase.rpc('reset_mission_proof', { p_assignment_id: Number(assignmentId) });
      if (error) throw error;
      await loadData();
    } catch { setError('인증 삭제에 실패했습니다.'); }
    setDeletingProofId(null);
  };

  const handleApprove = async (assignmentId: string, studentId: string) => {
    setApprovingId(assignmentId);
    try {
      const { error } = await supabase.rpc('review_mission_assignment', { p_assignment_id: Number(assignmentId), p_action: 'approve', p_reject_reason: null });
      if (error) throw error;
      const assignment = assignments.find(a => a.id === assignmentId);
      const mission = missions.find(m => m.id === assignment?.mission_id);
      try {
        const { count: completedCount } = await supabase.from('mission_assignments').select('*', { count: 'exact', head: true }).eq('student_id', studentId).eq('status', 'completed');
        const totalCompleted = completedCount || 1;
        const { data: catCounts } = await supabase.from('mission_assignments').select('mission_id').eq('student_id', studentId).eq('status', 'completed');
        let cleaningCount = 0, serviceCount = 0, mediaCount = 0, welcomeCount = 0, equipmentCount = 0, prayerCount = 0, praiseCount = 0, educationCount = 0;
        if (catCounts) {
          const mIds = [...new Set(catCounts.map(c => c.mission_id))];
          const { data: mInfo } = await supabase.from('missions').select('id, category').in('id', mIds);
          const catMap = new Map((mInfo || []).map(m => [m.id, m.category]));
          for (const c of catCounts) { const cat = catMap.get(c.mission_id); if (cat === 'cleaning') cleaningCount++; else if (cat === 'service') serviceCount++; else if (cat === 'media') mediaCount++; else if (cat === 'welcome') welcomeCount++; else if (cat === 'equipment') equipmentCount++; else if (cat === 'prayer') prayerCount++; else if (cat === 'praise') praiseCount++; else if (cat === 'education') educationCount++; }
        }
        const earnedBadges: string[] = [];
        for (const badge of BADGE_DEFINITIONS) {
          if (badge.streakCondition || badge.monthlyKing) continue;
          try { const fn = badge.condition as (...args: number[]) => boolean; if (fn(totalCompleted, cleaningCount, serviceCount, mediaCount, welcomeCount, equipmentCount, prayerCount, praiseCount, educationCount)) earnedBadges.push(badge.title); } catch { /* ignore */ }
        }
        if (earnedBadges.length > 0) await supabase.from('notifications').insert({ user_id: studentId, type: 'mission_badge', title: '새 뱃지를 획득했어요!', message: `${earnedBadges.join(', ')} 뱃지를 획득했습니다!`, is_read: false, link_url: '/missions/board' });
      } catch { /* badge check non-critical */ }
      try { await supabase.from('notifications').insert({ user_id: studentId, type: 'mission_reviewed', title: '작은 사명이 인증됐어요!', message: `${mission?.title || '작은 사명'} 인증이 승인되었습니다.`, is_read: false, link_url: '/missions/board' }); } catch { /* notification non-critical */ }
      await loadData();
    } catch { setError('승인 처리에 실패했습니다.'); }
    setApprovingId(null);
  };

  const handleReject = async (assignmentId: string, studentId: string) => {
    if (!rejectReason.trim()) return;
    const reason = rejectReason.trim(); setRejectingId(null); setRejectReason('');
    try {
      const { error } = await supabase.rpc('review_mission_assignment', { p_assignment_id: Number(assignmentId), p_action: 'reject', p_reject_reason: reason });
      if (error) throw error;
      const assignment = assignments.find(a => a.id === assignmentId); const mission = missions.find(m => m.id === assignment?.mission_id);
      try { await supabase.from('notifications').insert({ user_id: studentId, type: 'mission_reviewed', title: '작은 사명 인증이 반려됐어요', message: `${mission?.title || '작은 사명'} 인증이 반려되었습니다. 사유: ${reason}`, is_read: false, link_url: '/missions/board' }); } catch { /* notification non-critical */ }
      await loadData();
    } catch { setError('반려 처리에 실패했습니다.'); }
  };

  const getAssignmentCount = (missionId: string) => assignments.filter(a => a.mission_id === missionId && ['assigned', 'submitted', 'completed'].includes(a.status)).length;
  const getCompletedCount = (missionId: string) => assignments.filter(a => a.mission_id === missionId && a.status === 'completed').length;
  const submittedAssignments = assignments.filter(a => a.status === 'submitted');

  useEffect(() => {
    const fetchNames = async () => {
      const ids = [...new Set(assignments.map(a => a.student_id))]; if (!ids.length) return;
      const { data } = await supabase.from('user_roles').select('user_id,name,club').in('user_id', ids).eq('is_active', true);
      if (data) { const map: Record<string, { name: string; club: string }> = {}; for (const u of data) map[u.user_id] = { name: u.name, club: u.club }; setStudentNames(map); }
    };
    void fetchNames();
  }, [assignments]);

  if (loading) return <div className="min-h-screen bg-background-50 flex items-center justify-center"><div className="w-8 h-8 rounded-chip border-2 border-primary-400 border-t-transparent animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background-50"><div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-12"><motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-start justify-between gap-4 mb-6 md:mb-8"><div className="min-w-0"><h1 className="text-xl md:text-2xl font-bold text-foreground-950 mb-1">작은 사명</h1><p className="text-sm text-foreground-600">사명자가 올린 작은 사명을 보고, 내가 할 사명을 직접 맡아보세요.</p></div>{canPublish && <button type="button" onClick={() => setShowCreateForm(v => !v)} className="min-h-10 inline-flex items-center gap-2 px-4 py-2.5 rounded-chip bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"><i className={showCreateForm ? 'ri-close-line' : 'ri-add-line'} />{showCreateForm ? '닫기' : '작은 사명 올리기'}</button>}</div>
      {error && <div className="mb-4 px-4 py-3 bg-accent-100 border border-accent-200 rounded-input text-sm text-accent-700 flex items-center gap-2"><i className="ri-error-warning-line" />{error}<button type="button" onClick={() => setError(null)} className="ml-auto text-xs underline">닫기</button></div>}
      {canPublish && showCreateForm && <motion.form initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleCreateMission} className="mb-6 bg-background-100 border border-background-200 rounded-card p-5 space-y-4"><div><label className="block text-sm font-medium text-foreground-950 mb-1.5">작은 사명 내용</label><input value={newTitle} onChange={e => setNewTitle(e.target.value)} maxLength={100} required placeholder="예: 이번 주 금요일까지 교회 주변 쓰레기 줍기 할 사람?" className="w-full px-4 py-2.5 text-sm rounded-input border border-background-200 bg-background-50 focus:border-primary-400 outline-none" /></div><div><label className="block text-sm font-medium text-foreground-950 mb-1.5">상세 설명</label><textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} rows={3} maxLength={500} placeholder="어디서, 언제까지, 무엇을 하면 되는지 적어주세요." className="w-full px-4 py-3 text-sm rounded-input border border-background-200 bg-background-50 focus:border-primary-400 outline-none resize-none" /></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-foreground-950 mb-1.5">카테고리</label><select value={newCategory} onChange={e => setNewCategory(e.target.value)} className="w-full px-4 py-2.5 text-sm rounded-input border border-background-200 bg-background-50 focus:border-primary-400 outline-none appearance-none cursor-pointer">{Object.entries(MISSION_CATEGORIES).map(([key,value]) => <option key={key} value={key}>{value.label}</option>)}</select></div><div><label className="block text-sm font-medium text-foreground-950 mb-1.5">관련 동아리 (선택)</label><select value={newClub} onChange={e => setNewClub(e.target.value)} className="w-full px-4 py-2.5 text-sm rounded-input border border-background-200 bg-background-50 focus:border-primary-400 outline-none appearance-none cursor-pointer"><option value="">전체 (동아리 무관)</option>{availableClubs.map(club => <option key={club} value={club}>{club}</option>)}</select></div></div><div className="flex items-center gap-3"><button type="submit" disabled={savingMission || !newTitle.trim()} className="min-h-10 px-5 py-2.5 rounded-chip bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">{savingMission ? '게시 중...' : '작은 사명 게시'}</button>{createMsg && <span className={`text-sm ${createMsg.includes('실패') ? 'text-accent-600' : 'text-primary-600'}`}>{createMsg}</span>}</div></motion.form>}
      <div className="flex items-center gap-1 mb-5 px-1 py-1 rounded-chip bg-background-200/70 w-fit"><button type="button" onClick={() => setTab('missions')} className={`px-4 py-1.5 rounded-chip text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${tab === 'missions' ? 'bg-background-100 text-foreground-950 shadow-sm' : 'text-foreground-600 hover:text-foreground-800'}`}>작은 사명 목록 ({missions.length})</button>{canManage && <button type="button" onClick={() => setTab('assignments')} className={`px-4 py-1.5 rounded-chip text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${tab === 'assignments' ? 'bg-background-100 text-foreground-950 shadow-sm' : 'text-foreground-600 hover:text-foreground-800'}`}>인증 검토 ({submittedAssignments.length})</button>}</div>
      {tab === 'missions' && <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{missions.length === 0 && <div className="col-span-full text-center py-12"><div className="w-14 h-14 rounded-card bg-background-200 flex items-center justify-center mx-auto mb-3"><i className="ri-checkbox-circle-line text-2xl text-foreground-400" /></div><p className="text-sm text-foreground-500">등록된 작은 사명이 없습니다</p></div>}{missions.map(m => { const cat = MISSION_CATEGORIES[m.category] || MISSION_CATEGORIES.general; const total = getAssignmentCount(m.id); const completed = getCompletedCount(m.id); const canModify = user && (hasRole('service_manager') || hasRole('teacher') || hasRole('chief') || m.created_by === user.id); const mine = assignments.some(a => a.mission_id === m.id && a.student_id === user?.id && ['assigned','submitted','completed'].includes(a.status)); return <motion.div key={m.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-background-100 border border-background-200 rounded-card p-4"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2.5 min-w-0"><div className="w-9 h-9 rounded-input bg-accent-100 flex items-center justify-center flex-shrink-0"><i className={`${cat.icon} text-accent-600`} /></div><div className="min-w-0"><h3 className="text-sm font-semibold text-foreground-950 break-words">{m.title}</h3><div className="flex items-center gap-2 mt-0.5"><span className="text-xs text-foreground-500">{cat.label}</span>{m.club && <span className="text-xs text-accent-600">· {m.club}</span>}</div></div></div><div className="flex items-center gap-1">{canModify && <button type="button" onClick={() => void handleDeleteMission(m.id)} className="w-8 h-8 rounded-chip flex items-center justify-center text-foreground-400 hover:text-accent-700 hover:bg-accent-100 cursor-pointer" title="작은 사명 삭제"><i className="ri-delete-bin-line text-xs" /></button>}</div></div>{m.description && <p className="text-xs text-foreground-600 leading-relaxed mt-3 whitespace-pre-wrap">{m.description}</p>}<div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-background-200"><span className="text-[11px] text-foreground-500"><i className="ri-user-line mr-1" />진행 {total} · 완료 {completed}</span><button type="button" onClick={() => void handleClaim(m)} disabled={!!mine} className={`min-h-10 px-4 rounded-chip text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${mine ? 'bg-background-200 text-foreground-500 cursor-default' : 'bg-primary-500 text-background-50 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed'}`}><i className={`${mine ? 'ri-check-line' : 'ri-hand-heart-line'} mr-1`} />{mine ? '내가 맡은 사명' : '작은 사명 하기'}</button></div></motion.div>; })}</div>}
      {tab === 'assignments' && canManage && <div className="space-y-6">{submittedAssignments.length > 0 && <div><div className="flex items-center gap-2 mb-3"><div className="w-2 h-2 rounded-full bg-amber-400"/><h3 className="text-sm font-bold text-foreground-950">승인 대기 ({submittedAssignments.length})</h3></div><div className="space-y-3">{submittedAssignments.map(a => { const mission = missions.find(m => m.id === a.mission_id); const stu = studentNames[a.student_id]; return <div key={a.id} className="bg-amber-50 border border-amber-200 rounded-card p-4"><div className="flex items-start gap-3 mb-3"><div className="w-10 h-10 rounded-input bg-amber-100 flex items-center justify-center flex-shrink-0"><i className="ri-hourglass-line text-amber-600" /></div><div className="flex-1 min-w-0"><p className="text-sm font-semibold text-foreground-950">{mission?.title || '삭제된 미션'}</p><p className="text-xs text-foreground-600">{stu?.name || a.student_id?.slice(0,8)}{stu?.club ? ` · ${stu.club}` : ''}{a.submitted_at ? ` · ${formatKoreanDate(a.submitted_at)} 제출` : ''}</p></div></div>{a.proof_image_url && <button type="button" onClick={() => window.open(a.proof_image_url!, '_blank')} className="block w-32 h-32 rounded-input overflow-hidden bg-background-200 cursor-pointer hover:opacity-90 transition-opacity mb-3"><img src={a.proof_image_url} alt="인증 사진" className="w-full h-full object-cover" /></button>}{a.proof_note && <p className="text-sm text-foreground-700 bg-background-100 rounded-input p-3 mb-3 leading-relaxed">"{a.proof_note}"</p>}{rejectingId === a.id ? <div className="space-y-2"><input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="반려 사유를 입력하세요..." className="w-full px-3 py-2 text-sm rounded-input border border-rose-200 bg-background-100 focus:border-rose-400 outline-none" autoFocus={!(typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)')?.matches)} /><div className="flex items-center gap-2"><button type="button" onClick={() => void handleReject(a.id, a.student_id)} disabled={!rejectReason.trim()} className="px-4 py-2 rounded-chip bg-rose-500 text-white text-xs font-semibold disabled:opacity-40 cursor-pointer">반려 확정</button><button type="button" onClick={() => { setRejectingId(null); setRejectReason(''); }} className="px-4 py-2 rounded-chip bg-background-200 text-foreground-600 text-xs font-semibold cursor-pointer">취소</button></div></div> : <div className="flex items-center gap-2"><button type="button" onClick={() => void handleApprove(a.id,a.student_id)} disabled={approvingId===a.id} className="px-4 py-2 rounded-chip bg-primary-500 text-background-50 text-xs font-semibold hover:bg-primary-600 disabled:opacity-50 cursor-pointer">{approvingId===a.id?'처리 중...':'승인'}</button><button type="button" onClick={() => setRejectingId(a.id)} className="px-4 py-2 rounded-chip bg-rose-100 text-rose-700 text-xs font-semibold cursor-pointer">반려</button>{hasRole('teacher') && <button type="button" onClick={() => void handleDeleteProof(a.id)} disabled={deletingProofId===a.id} className="px-4 py-2 rounded-chip bg-background-200 text-foreground-600 text-xs font-semibold cursor-pointer">{deletingProofId===a.id?'삭제 중...':'인증 초기화'}</button>}</div>}</div>; })}</div></div>}{assignments.length === 0 ? <div className="text-center py-12 text-sm text-foreground-500">배정 내역이 없습니다</div> : <div className="space-y-2">{assignments.map(a => { const mission = missions.find(m => m.id === a.mission_id); const stu = studentNames[a.student_id]; const statusLabels: Record<string,string> = { assigned:'진행 중', submitted:'승인 대기', completed:'완료', rejected:'반려' }; return <div key={a.id} className="flex items-center gap-3 bg-background-100 border border-background-200 rounded-input px-4 py-3"><div className={`w-2 h-2 rounded-full ${a.status==='completed'?'bg-primary-400':a.status==='rejected'?'bg-rose-400':a.status==='submitted'?'bg-sky-400':'bg-amber-400'}`} /><div className="flex-1 min-w-0"><p className="text-sm font-medium text-foreground-900 truncate">{mission?.title || '삭제된 미션'}</p><p className="text-xs text-foreground-500">{stu?.name || a.student_id?.slice(0,8)} · {formatKoreanDate(a.assigned_at)}{a.completed_at && ` → 완료: ${formatKoreanDate(a.completed_at)}`}{a.reject_reason && ` · 사유: ${a.reject_reason}`}</p></div><span className="px-2.5 py-1 rounded-chip text-xs font-semibold whitespace-nowrap bg-background-200 text-foreground-600">{statusLabels[a.status] || a.status}</span></div>; })}</div>}</div>}
    </motion.div></div></div>
  );
}
