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
  const isLeader = hasRole('zone_leader') || hasRole('teacher') || hasRole('chief');

  const [missions, setMissions] = useState<Mission[]>([]);
  const [assignments, setAssignments] = useState<MissionAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [newClub, setNewClub] = useState('');
  const [savingMission, setSavingMission] = useState(false);
  const [createMsg, setCreateMsg] = useState('');

  // Assign form
  const [assignMissionId, setAssignMissionId] = useState<string | null>(null);
  const [assignStudentId, setAssignStudentId] = useState('');
  const [assignStudentName, setAssignStudentName] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState('');

  // Student search
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState<{ id: string; name: string }[]>([]);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);

  // Club list from DB
  const [availableClubs, setAvailableClubs] = useState<string[]>([]);

  // Approval
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Tabs
  const [tab, setTab] = useState<'missions' | 'assignments'>('missions');

  useEffect(() => {
    if (!user) return;
    loadData();
    loadClubs();
  }, [user]);

  const loadClubs = async () => {
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('club')
        .eq('is_active', true)
        .not('club', 'is', null);
      if (data && data.length > 0) {
        const uniqueClubs = [...new Set(data.map((d: { club: string }) => d.club).filter(Boolean))];
        setAvailableClubs(uniqueClubs as string[]);
      }
    } catch { /* ignore */ }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: mData } = await supabase.from('missions').select('*').order('created_at', { ascending: false });
      if (mData && mData.length > 0) {
        setMissions(mData);
      }

      const { data: aData } = await supabase.from('mission_assignments').select('*').order('assigned_at', { ascending: false }).limit(100);
      if (aData && aData.length > 0) {
        setAssignments(aData);
      }
    } catch {
      setError('미션 데이터를 불러오는 중 문제가 발생했어요. 다시 시도해주세요');
    }
    setLoading(false);
  };

  const handleCreateMission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSavingMission(true);
    setCreateMsg('');
    try {
      const { error } = await supabase.from('missions').insert({
        title: newTitle.trim(),
        description: newDescription.trim(),
        category: newCategory,
        club: newClub.trim() || '',
        created_by: user!.id,
      });
      if (error) throw error;
      setCreateMsg('미션이 생성되었습니다!');
      setNewTitle('');
      setNewDescription('');
      setNewCategory('general');
      setNewClub('');
      setShowCreateForm(false);
      loadData();
    } catch {
      setCreateMsg('미션 생성에 실패했습니다.');
    }
    setSavingMission(false);
  };

  const handleSearchStudents = async (query: string) => {
    setStudentSearch(query);
    if (query.length < 1) { setStudentResults([]); setShowStudentDropdown(false); return; }
    setSearchingStudents(true);
    setShowStudentDropdown(true);
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('user_id, name')
        .ilike('name', `%${query}%`)
        .limit(8);
      if (data && data.length > 0) {
        setStudentResults(data.map(d => ({ id: d.user_id, name: d.name })));
      } else {
        setStudentResults([]);
      }
    } catch {
      setStudentResults([]);
    }
    setSearchingStudents(false);
  };

  const handleAssign = async () => {
    if (!assignMissionId || !assignStudentId || !assignStudentName.trim()) return;
    setAssigning(true);
    setAssignMsg('');
    try {
      const { error } = await supabase.from('mission_assignments').insert({
        mission_id: assignMissionId,
        student_id: assignStudentId,
        assigned_by: user!.id,
        status: 'assigned',
      });
      if (error) throw error;

      // 알림 전송
      const mission = missions.find(m => m.id === assignMissionId);
      try {
        await supabase.from('notifications').insert({
          user_id: assignStudentId,
          type: 'mission_assigned',
          title: '새로운 작은 사명이 배정됐어요!',
          message: `${mission?.title || '작은 사명'}이(가) 배정되었습니다. 확인하고 완료해주세요!`,
          is_read: false,
          link_url: '/missions/board',
        });
      } catch { /* non-critical */ }

      setAssignMsg(`${assignStudentName}님에게 미션이 배정되었습니다!`);
      setAssignMissionId(null);
      setAssignStudentId('');
      setAssignStudentName('');
      setStudentSearch('');
      setStudentResults([]);
      setShowStudentDropdown(false);
      loadData();
    } catch {
      setAssignMsg('배정에 실패했습니다.');
    }
    setAssigning(false);
  };

  const handleDeleteMission = async (missionId: string) => {
    if (!confirm('정말 이 미션을 삭제할까요? 관련 배정 내역도 함께 삭제됩니다.')) return;
    try {
      const { error } = await supabase.from('missions').delete().eq('id', missionId);
      if (error) throw error;
      loadData();
    } catch {
      setError('미션 삭제에 실패했습니다.');
    }
  };

  const [deletingProofId, setDeletingProofId] = useState<string | null>(null);
  const handleDeleteProof = async (assignmentId: string) => {
    if (!confirm('학생이 올린 인증(사진/내용)을 삭제할까요? 학생이 다시 제출할 수 있는 상태로 되돌아갑니다.')) return;
    setDeletingProofId(assignmentId);
    try {
      const { error } = await supabase
        .from('mission_assignments')
        .update({
          status: 'assigned',
          proof_image_url: null,
          proof_note: null,
          submitted_at: null,
          completed_at: null,
          reviewed_by: null,
          reviewed_at: null,
          reject_reason: null,
        })
        .eq('id', assignmentId);
      if (error) throw error;
      loadData();
    } catch {
      setError('인증 삭제에 실패했습니다.');
    }
    setDeletingProofId(null);
  };

  const handleApprove = async (assignmentId: string, studentId: string) => {
    setApprovingId(assignmentId);
    try {
      const { error } = await supabase
        .from('mission_assignments')
        .update({
          status: 'completed',
          reviewed_by: user!.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', assignmentId);

      if (error) throw error;

      // 뱃지 체크
      const assignment = assignments.find(a => a.id === assignmentId);
      const mission = missions.find(m => m.id === assignment?.mission_id);
      try {
        const { count: completedCount } = await supabase
          .from('mission_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', studentId)
          .eq('status', 'completed');

        const totalCompleted = completedCount || 1;
        const { data: catCounts } = await supabase
          .from('mission_assignments')
          .select('mission_id')
          .eq('student_id', studentId)
          .eq('status', 'completed');

        let cleaningCount = 0, serviceCount = 0, mediaCount = 0, welcomeCount = 0;
        let equipmentCount = 0, prayerCount = 0, praiseCount = 0, educationCount = 0;

        if (catCounts) {
          const mIds = [...new Set(catCounts.map((c: { mission_id: string }) => c.mission_id))];
          const { data: mInfo } = await supabase.from('missions').select('id, category').in('id', mIds);
          if (mInfo) {
            const catMap = new Map(mInfo.map((m: { id: string; category: string }) => [m.id, m.category]));
            for (const c of catCounts) {
              const cat = catMap.get(c.mission_id);
              if (cat === 'cleaning') cleaningCount++;
              else if (cat === 'service') serviceCount++;
              else if (cat === 'media') mediaCount++;
              else if (cat === 'welcome') welcomeCount++;
              else if (cat === 'equipment') equipmentCount++;
              else if (cat === 'prayer') prayerCount++;
              else if (cat === 'praise') praiseCount++;
              else if (cat === 'education') educationCount++;
            }
          }
        }

        // Check each badge
        const earnedBadges: string[] = [];
        for (const badge of BADGE_DEFINITIONS) {
          if (badge.streakCondition || badge.monthlyKing) continue;
          try {
            const fn = badge.condition as (...args: number[]) => boolean;
            if (fn(totalCompleted, cleaningCount, serviceCount, mediaCount, welcomeCount, equipmentCount, prayerCount, praiseCount, educationCount)) {
              earnedBadges.push(badge.title);
            }
          } catch { /* skip */ }
        }

        if (earnedBadges.length > 0) {
          await supabase.from('notifications').insert({
            user_id: studentId,
            type: 'mission_badge',
            title: '새 뱃지를 획득했어요! 🎖️',
            message: `${earnedBadges.join(', ')} 뱃지를 획득했습니다! 축하해요!`,
            is_read: false,
            link_url: '/missions/board',
          });
        }
      } catch { /* badge check non-critical */ }

      // 승인 알림
      try {
        await supabase.from('notifications').insert({
          user_id: studentId,
          type: 'mission_reviewed',
          title: '작은 사명이 인증됐어요!',
          message: `${mission?.title || '작은 사명'} 인증이 승인되었습니다.`,
          is_read: false,
          link_url: '/missions/board',
        });
      } catch { /* non-critical */ }

      loadData();
    } catch {
      setError('승인 처리에 실패했습니다.');
    }
    setApprovingId(null);
  };

  const handleReject = async (assignmentId: string, studentId: string) => {
    if (!rejectReason.trim()) return;
    const reason = rejectReason;
    setRejectingId(null);
    setRejectReason('');

    try {
      const { error } = await supabase
        .from('mission_assignments')
        .update({
          status: 'rejected',
          reviewed_by: user!.id,
          reviewed_at: new Date().toISOString(),
          reject_reason: reason,
        })
        .eq('id', assignmentId);

      if (error) throw error;

      const assignment = assignments.find(a => a.id === assignmentId);
      const mission = missions.find(m => m.id === assignment?.mission_id);
      try {
        await supabase.from('notifications').insert({
          user_id: studentId,
          type: 'mission_reviewed',
          title: '작은 사명 인증이 반려됐어요',
          message: `${mission?.title || '작은 사명'} 인증이 반려되었습니다. 사유: ${reason}`,
          is_read: false,
          link_url: '/missions/board',
        });
      } catch { /* non-critical */ }

      loadData();
    } catch {
      setError('반려 처리에 실패했습니다.');
    }
  };

  const getAssignmentCount = (missionId: string) =>
    assignments.filter(a => a.mission_id === missionId).length;

  const getCompletedCount = (missionId: string) =>
    assignments.filter(a => a.mission_id === missionId && a.status === 'completed').length;

  const submittedAssignments = assignments.filter(a => a.status === 'submitted');

  // Fetch student names for submitted assignments
  const [studentNames, setStudentNames] = useState<Record<string, { name: string; club: string }>>({});
  useEffect(() => {
    const fetchNames = async () => {
      const ids = [...new Set(assignments.map(a => a.student_id))];
      if (ids.length === 0) return;
      const { data } = await supabase
        .from('user_roles')
        .select('user_id, name, club')
        .in('user_id', ids)
        .eq('is_active', true);
      if (data) {
        const map: Record<string, { name: string; club: string }> = {};
        for (const u of data) {
          map[u.user_id] = { name: u.name, club: u.club };
        }
        setStudentNames(map);
      }
    };
    fetchNames();
  }, [assignments]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary-400 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-foreground-950 mb-1">작은 사명 관리</h1>
              <p className="text-sm text-foreground-600">미션을 생성하고 학생들에게 배정하세요</p>
            </div>
            {isLeader && (
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className={`${showCreateForm ? 'ri-close-line' : 'ri-add-line'}`}></i>
                {showCreateForm ? '닫기' : '새 미션'}
              </button>
            )}
          </div>

          {error && (
            <div className="mb-6 px-4 py-3 bg-accent-100 border border-accent-200 rounded-xl flex items-center justify-between text-sm text-accent-700">
              <span className="flex items-center gap-2"><i className="ri-error-warning-line"></i>{error}</span>
              <button onClick={loadData} className="text-xs text-accent-600 underline cursor-pointer">다시 시도</button>
            </div>
          )}

          {/* Create form */}
          {isLeader && (
            <AnimatePresence>
              {showCreateForm && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleCreateMission}
                  className="overflow-hidden mb-6"
                >
                  <div className="bg-background-100 border border-background-200 rounded-2xl p-5 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground-950 mb-1.5">미션 제목</label>
                      <input
                        type="text"
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        placeholder="예: 주일 청소 당번"
                        maxLength={100}
                        required
                        className="w-full px-4 py-2.5 text-sm rounded-xl border border-background-200 bg-background-50 focus:border-primary-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground-950 mb-1.5">설명</label>
                      <textarea
                        value={newDescription}
                        onChange={e => setNewDescription(e.target.value)}
                        placeholder="미션에 대한 상세 설명을 입력하세요..."
                        rows={3}
                        maxLength={500}
                        className="w-full px-4 py-3 text-sm rounded-xl border border-background-200 bg-background-50 focus:border-primary-400 outline-none resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground-950 mb-1.5">카테고리</label>
                        <select
                          value={newCategory}
                          onChange={e => setNewCategory(e.target.value)}
                          className="w-full px-4 py-2.5 text-sm rounded-xl border border-background-200 bg-background-50 focus:border-primary-400 outline-none appearance-none cursor-pointer"
                        >
                          {Object.entries(MISSION_CATEGORIES).map(([key, val]) => (
                            <option key={key} value={key}>{val.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground-950 mb-1.5">관련 동아리 (선택)</label>
                        <select
                          value={newClub}
                          onChange={e => setNewClub(e.target.value)}
                          className="w-full px-4 py-2.5 text-sm rounded-xl border border-background-200 bg-background-50 focus:border-primary-400 outline-none appearance-none cursor-pointer"
                        >
                          <option value="">전체 (동아리 무관)</option>
                          {availableClubs.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={savingMission || !newTitle.trim()}
                        className="px-5 py-2.5 rounded-full bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                      >
                        {savingMission ? '생성 중...' : '미션 생성'}
                      </button>
                      {createMsg && (
                        <span className={`text-sm ${createMsg.includes('실패') ? 'text-accent-600' : 'text-emerald-600'}`}>
                          {createMsg}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-1 mb-5 px-1 py-1 rounded-full bg-background-200/70 w-fit">
            <button
              onClick={() => setTab('missions')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${tab === 'missions' ? 'bg-background-100 text-foreground-950 shadow-sm' : 'text-foreground-600 hover:text-foreground-800'}`}
            >
              미션 목록 ({missions.length})
            </button>
            <button
              onClick={() => setTab('assignments')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${tab === 'assignments' ? 'bg-background-100 text-foreground-950 shadow-sm' : 'text-foreground-600 hover:text-foreground-800'}`}
            >
              배정 현황 ({assignments.length})
            </button>
          </div>

          {/* Missions list */}
          {tab === 'missions' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {missions.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <div className="w-14 h-14 rounded-2xl bg-background-200 flex items-center justify-center mx-auto mb-3">
                    <i className="ri-checkbox-circle-line text-2xl text-foreground-400"></i>
                  </div>
                  <p className="text-sm text-foreground-500">등록된 미션이 없습니다</p>
                </div>
              )}
              {missions.map(m => {
                const cat = MISSION_CATEGORIES[m.category] || MISSION_CATEGORIES.general;
                const total = getAssignmentCount(m.id);
                const completed = getCompletedCount(m.id);
                const canModifyMission = user && (
                  hasRole('teacher') || hasRole('chief') || m.created_by === user.id
                );
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-background-100 border border-background-200 rounded-2xl p-4 hover:border-background-300/60 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-accent-100 flex items-center justify-center flex-shrink-0">
                          <i className={`${cat.icon} text-accent-600`}></i>
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-foreground-950">{m.title}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-foreground-500">{cat.label}</span>
                            {m.club && <span className="text-xs text-accent-600">· {m.club}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {canModifyMission && (
                          <button
                            onClick={() => handleDeleteMission(m.id)}
                            className="w-7 h-7 rounded-full flex items-center justify-center text-foreground-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="미션 삭제"
                          >
                            <i className="ri-delete-bin-line text-xs"></i>
                          </button>
                        )}
                        {isLeader && (
                          <button
                            onClick={() => setAssignMissionId(assignMissionId === m.id ? null : m.id)}
                            className="px-3 py-1.5 rounded-full bg-accent-100 text-accent-700 text-xs font-semibold hover:bg-accent-200 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <i className="ri-user-add-line mr-1"></i>배정
                          </button>
                        )}
                      </div>
                    </div>
                    {m.description && (
                      <p className="text-xs text-foreground-600 leading-relaxed mt-2 mb-3">{m.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-foreground-500 mt-2">
                      <span><i className="ri-user-line mr-1"></i>배정 {total}회</span>
                      <span><i className="ri-check-line mr-1 text-emerald-500"></i>완료 {completed}회</span>
                    </div>

                    {/* Assign section */}
                    {isLeader && (
                      <AnimatePresence>
                        {assignMissionId === m.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-4 pt-4 border-t border-background-200 space-y-3">
                              <div className="relative">
                                <label className="block text-xs font-medium text-foreground-700 mb-1">학생 검색</label>
                                <input
                                  type="text"
                                  value={studentSearch}
                                  onChange={e => handleSearchStudents(e.target.value)}
                                  onFocus={() => studentResults.length > 0 && setShowStudentDropdown(true)}
                                  placeholder="학생 이름 입력..."
                                  className="w-full px-3 py-2 text-sm rounded-xl border border-background-200 bg-background-50 focus:border-primary-400 outline-none"
                                />
                                {showStudentDropdown && (
                                  <div className="absolute top-full left-0 right-0 mt-1 bg-background-100 border border-background-200 rounded-xl shadow-lg z-10 max-h-40 overflow-y-auto">
                                    {searchingStudents ? (
                                      <div className="px-3 py-2.5 text-sm text-foreground-500">검색 중...</div>
                                    ) : studentResults.length === 0 ? (
                                      <div className="px-3 py-2.5 text-sm text-foreground-500">검색 결과가 없습니다</div>
                                    ) : (
                                      studentResults.map(s => (
                                        <button
                                          key={s.id}
                                          onClick={() => {
                                            setAssignStudentId(s.id);
                                            setAssignStudentName(s.name);
                                            setStudentSearch(s.name);
                                            setShowStudentDropdown(false);
                                          }}
                                          className="w-full text-left px-3 py-2 text-sm hover:bg-background-100 transition-colors cursor-pointer"
                                        >
                                          {s.name}
                                        </button>
                                      ))
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={handleAssign}
                                  disabled={assigning || !assignStudentId}
                                  className="px-4 py-2 rounded-full bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                                >
                                  {assigning ? '배정 중...' : '배정하기'}
                                </button>
                                {assignMsg && (
                                  <span className={`text-xs ${assignMsg.includes('실패') ? 'text-accent-600' : 'text-emerald-600'}`}>
                                    {assignMsg}
                                  </span>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Assignments list */}
          {tab === 'assignments' && (
            <div className="space-y-6">
              {/* 승인 대기 섹션 */}
              {isLeader && submittedAssignments.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                    <h3 className="text-sm font-bold text-foreground-950">승인 대기 ({submittedAssignments.length})</h3>
                  </div>
                  <div className="space-y-3">
                    {submittedAssignments.map(a => {
                      const mission = missions.find(m => m.id === a.mission_id);
                      const stu = studentNames[a.student_id];
                      return (
                        <div key={a.id} className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                              <i className="ri-hourglass-line text-amber-600"></i>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground-950">{mission?.title || '삭제된 미션'}</p>
                              <p className="text-xs text-foreground-600">
                                {stu?.name || a.student_id?.slice(0, 8)}
                                {stu?.club ? ` · ${stu.club}` : ''}
                                {a.submitted_at ? ` · ${new Date(a.submitted_at).toLocaleDateString('ko-KR')} 제출` : ''}
                              </p>
                            </div>
                          </div>

                          {/* Proof image */}
                          {a.proof_image_url && (
                            <div className="mb-3">
                              <button
                                onClick={() => window.open(a.proof_image_url!, '_blank')}
                                className="block w-32 h-32 rounded-xl overflow-hidden bg-background-200 cursor-pointer hover:opacity-90 transition-opacity"
                              >
                                <img src={a.proof_image_url} alt="인증 사진" className="w-full h-full object-cover" />
                              </button>
                            </div>
                          )}

                          {/* Proof note */}
                          {a.proof_note && (
                            <p className="text-sm text-foreground-700 bg-background-100 rounded-xl p-3 mb-3 leading-relaxed">
                              "{a.proof_note}"
                            </p>
                          )}

                          {/* Actions */}
                          {rejectingId === a.id ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={rejectReason}
                                onChange={e => setRejectReason(e.target.value)}
                                placeholder="반려 사유를 입력하세요..."
                                className="w-full px-3 py-2 text-sm rounded-xl border border-rose-200 bg-background-100 focus:border-rose-400 outline-none"
                                autoFocus
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleReject(a.id, a.student_id)}
                                  disabled={!rejectReason.trim()}
                                  className="px-4 py-2 rounded-full bg-rose-500 text-white text-xs font-semibold hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                                >
                                  반려 확정
                                </button>
                                <button
                                  onClick={() => { setRejectingId(null); setRejectReason(''); }}
                                  className="px-4 py-2 rounded-full bg-background-200 text-foreground-600 text-xs font-semibold hover:bg-background-300 cursor-pointer whitespace-nowrap"
                                >
                                  취소
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleApprove(a.id, a.student_id)}
                                disabled={approvingId === a.id}
                                className="px-4 py-2 rounded-full bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                              >
                                {approvingId === a.id ? '처리 중...' : '승인'}
                              </button>
                              <button
                                onClick={() => setRejectingId(a.id)}
                                className="px-4 py-2 rounded-full bg-rose-100 text-rose-700 text-xs font-semibold hover:bg-rose-200 cursor-pointer whitespace-nowrap"
                              >
                                반려
                              </button>
                              {hasRole('teacher') && (
                                <button
                                  onClick={() => handleDeleteProof(a.id)}
                                  disabled={deletingProofId === a.id}
                                  className="px-4 py-2 rounded-full bg-background-200 text-foreground-600 text-xs font-semibold hover:bg-rose-100 hover:text-rose-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                                >
                                  {deletingProofId === a.id ? '삭제 중...' : '인증 삭제'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 전체 배정 현황 */}
              <div className="space-y-2">
                {assignments.length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-14 h-14 rounded-2xl bg-background-200 flex items-center justify-center mx-auto mb-3">
                      <i className="ri-user-line text-2xl text-foreground-400"></i>
                    </div>
                    <p className="text-sm text-foreground-500">배정 내역이 없습니다</p>
                  </div>
                )}
                {assignments.map(a => {
                  const mission = missions.find(m => m.id === a.mission_id);
                  const stu = studentNames[a.student_id];
                  const statusColors: Record<string, string> = {
                    assigned: 'bg-amber-100 text-amber-700',
                    submitted: 'bg-sky-100 text-sky-700',
                    completed: 'bg-emerald-100 text-emerald-700',
                    rejected: 'bg-rose-100 text-rose-700',
                  };
                  const statusLabels: Record<string, string> = {
                    assigned: '진행 중',
                    submitted: '승인 대기',
                    completed: '완료',
                    rejected: '반려',
                  };
                  return (
                    <div key={a.id} className="flex items-center gap-3 bg-background-100 border border-background-200 rounded-xl px-4 py-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        a.status === 'completed' ? 'bg-emerald-400' : a.status === 'rejected' ? 'bg-rose-400' : a.status === 'submitted' ? 'bg-sky-400' : 'bg-amber-400'
                      }`}></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground-900 truncate">{mission?.title || '삭제된 미션'}</p>
                        <p className="text-xs text-foreground-500">
                          {stu?.name || a.student_id?.slice(0, 8)} · {new Date(a.assigned_at).toLocaleDateString('ko-KR')}
                          {a.completed_at && ` → 완료: ${new Date(a.completed_at).toLocaleDateString('ko-KR')}`}
                          {a.reject_reason && ` · 사유: ${a.reject_reason}`}
                        </p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${statusColors[a.status] || 'bg-background-200 text-foreground-500'}`}>
                        {statusLabels[a.status] || a.status}
                      </span>
                      {hasRole('teacher') && a.proof_image_url && (a.status === 'completed' || a.status === 'rejected' || a.status === 'submitted') && (
                        <button
                          onClick={() => handleDeleteProof(a.id)}
                          disabled={deletingProofId === a.id}
                          className="p-1.5 rounded-full text-foreground-400 hover:bg-rose-100 hover:text-rose-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex-shrink-0"
                          title="인증 삭제"
                        >
                          <i className="ri-delete-bin-line text-sm"></i>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}