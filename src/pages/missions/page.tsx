import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { MISSION_CATEGORIES } from '@/constants/missionBadges';

interface Mission {
  id: string;
  title: string;
  description: string;
  category: string;
  club: string;
  created_at: string;
  created_by: string;
}

export default function MissionsPage() {
  const { user, hasRole } = useAuth();
  const canPublish = hasRole('assistant_zone_leader');
  const [missions, setMissions] = useState<Mission[]>([]);
  const [claimedMissionIds, setClaimedMissionIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [newClub, setNewClub] = useState('');
  const [availableClubs, setAvailableClubs] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    void loadData();
    void loadClubs();
  }, [user]);

  const loadClubs = async () => {
    const { data } = await supabase
      .from('user_roles')
      .select('club')
      .eq('is_active', true)
      .not('club', 'is', null);
    if (data) {
      setAvailableClubs([...new Set(data.map(d => d.club).filter(Boolean))] as string[]);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: missionData, error: missionError } = await supabase
        .from('missions')
        .select('*')
        .order('created_at', { ascending: false });
      if (missionError) throw missionError;
      setMissions((missionData || []) as Mission[]);

      const { data: ownAssignments, error: assignmentError } = await supabase
        .from('mission_assignments')
        .select('mission_id')
        .eq('student_id', user!.id)
        .in('status', ['assigned', 'submitted', 'completed']);
      if (assignmentError) throw assignmentError;
      setClaimedMissionIds(new Set((ownAssignments || []).map(a => String(a.mission_id))));
    } catch {
      setError('작은 사명을 불러오는 중 문제가 발생했어요. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !newTitle.trim() || saving) return;
    setSaving(true);
    setMessage('');
    setError(null);
    try {
      const { error: insertError } = await supabase.from('missions').insert({
        title: newTitle.trim(),
        description: newDescription.trim(),
        category: newCategory,
        club: newClub,
        created_by: user.id,
      });
      if (insertError) throw insertError;
      setNewTitle('');
      setNewDescription('');
      setNewCategory('general');
      setNewClub('');
      setShowCreateForm(false);
      setMessage('작은 사명이 게시되었습니다.');
      await loadData();
    } catch {
      setError('작은 사명 게시에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleClaim = async (mission: Mission) => {
    if (!user || claimingId) return;
    setClaimingId(mission.id);
    setMessage('');
    setError(null);
    try {
      const { data, error: claimError } = await supabase.rpc('claim_mission', {
        p_mission_id: Number(mission.id),
      });
      if (claimError) throw claimError;
      if (!data) throw new Error('작은 사명을 맡지 못했어요.');
      setMessage(`「${mission.title}」 작은 사명을 맡았어요. 내 작은 사명에서 확인해주세요.`);
      await loadData();
    } catch (err) {
      const text = err instanceof Error ? err.message : '';
      setError(text.includes('이미 다른') ? text : '작은 사명을 맡는 중 문제가 발생했어요. 이미 다른 사람이 맡았는지 확인해주세요.');
    } finally {
      setClaimingId(null);
    }
  };

  const handleDelete = async (missionId: string) => {
    if (!confirm('이 작은 사명을 삭제할까요? 관련 배정 내역도 함께 삭제됩니다.')) return;
    const { error: deleteError } = await supabase.from('missions').delete().eq('id', missionId);
    if (deleteError) {
      setError('작은 사명 삭제에 실패했습니다.');
      return;
    }
    await loadData();
  };

  if (loading) {
    return <div className="min-h-screen bg-background-50 flex items-center justify-center"><div className="w-8 h-8 rounded-chip border-2 border-primary-400 border-t-transparent animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-start justify-between gap-4 mb-6 md:mb-8">
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold text-foreground-950 mb-1">작은 사명</h1>
              <p className="text-sm text-foreground-600">사명자가 올린 작은 사명을 보고, 내가 할 사명을 직접 맡아보세요.</p>
            </div>
            {canPublish && (
              <button type="button" onClick={() => setShowCreateForm(value => !value)} className="min-h-10 inline-flex items-center gap-2 px-4 py-2.5 rounded-chip bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap">
                <i className={showCreateForm ? 'ri-close-line' : 'ri-add-line'} />
                {showCreateForm ? '닫기' : '작은 사명 올리기'}
              </button>
            )}
          </div>

          {error && <div className="mb-4 px-4 py-3 bg-accent-100 border border-accent-200 rounded-input text-sm text-accent-700 flex items-center gap-2"><i className="ri-error-warning-line" />{error}</div>}
          {message && <div className="mb-4 px-4 py-3 bg-primary-100 border border-primary-200 rounded-input text-sm text-primary-700 flex items-center gap-2"><i className="ri-check-line" />{message}</div>}

          {canPublish && showCreateForm && (
            <motion.form initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleCreate} className="mb-6 bg-background-100 border border-background-200 rounded-card p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground-950 mb-1.5">작은 사명 내용</label>
                <input value={newTitle} onChange={e => setNewTitle(e.target.value)} maxLength={100} required placeholder="예: 이번 주 금요일까지 교회 주변 쓰레기 줍기 할 사람?" className="w-full px-4 py-2.5 text-sm rounded-input border border-background-200 bg-background-50 focus:border-primary-400 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-950 mb-1.5">상세 설명</label>
                <textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} rows={3} maxLength={500} placeholder="어디서, 언제까지, 무엇을 하면 되는지 적어주세요." className="w-full px-4 py-3 text-sm rounded-input border border-background-200 bg-background-50 focus:border-primary-400 outline-none resize-none" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground-950 mb-1.5">카테고리</label>
                  <select value={newCategory} onChange={e => setNewCategory(e.target.value)} className="w-full px-4 py-2.5 text-sm rounded-input border border-background-200 bg-background-50 focus:border-primary-400 outline-none appearance-none cursor-pointer">
                    {Object.entries(MISSION_CATEGORIES).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-950 mb-1.5">관련 동아리 (선택)</label>
                  <select value={newClub} onChange={e => setNewClub(e.target.value)} className="w-full px-4 py-2.5 text-sm rounded-input border border-background-200 bg-background-50 focus:border-primary-400 outline-none appearance-none cursor-pointer">
                    <option value="">전체 (동아리 무관)</option>
                    {availableClubs.map(club => <option key={club} value={club}>{club}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" disabled={saving || !newTitle.trim()} className="min-h-10 px-5 py-2.5 rounded-chip bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                {saving ? '게시 중...' : '작은 사명 게시'}
              </button>
            </motion.form>
          )}

          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-foreground-950">신청할 수 있는 작은 사명</h2>
              <p className="text-xs text-foreground-500 mt-1">원하는 사명의 「작은 사명 하기」를 누르면 내 사명으로 연결됩니다.</p>
            </div>
            <Link to="/missions/board" className="min-h-10 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-chip bg-background-100 border border-background-200 text-xs font-semibold text-foreground-700 hover:bg-background-200 cursor-pointer whitespace-nowrap">
              <i className="ri-list-check-2" />내 작은 사명
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {missions.length === 0 && <div className="col-span-full text-center py-12"><div className="w-14 h-14 rounded-card bg-background-200 flex items-center justify-center mx-auto mb-3"><i className="ri-checkbox-circle-line text-2xl text-foreground-400" /></div><p className="text-sm text-foreground-500">등록된 작은 사명이 없습니다</p></div>}
            {missions.map(mission => {
              const category = MISSION_CATEGORIES[mission.category] || MISSION_CATEGORIES.general;
              const mine = claimedMissionIds.has(String(mission.id));
              const claiming = claimingId === mission.id;
              const canDelete = user && (hasRole('teacher') || hasRole('chief') || mission.created_by === user.id);
              return (
                <motion.article key={mission.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-background-100 border border-background-200 rounded-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-input bg-accent-100 flex items-center justify-center flex-shrink-0"><i className={`${category.icon} text-accent-600`} /></div>
                      <div className="min-w-0"><h3 className="text-sm font-semibold text-foreground-950 break-words">{mission.title}</h3><p className="text-xs text-foreground-500 mt-0.5">{category.label}{mission.club ? ` · ${mission.club}` : ''}</p></div>
                    </div>
                    {canDelete && <button type="button" onClick={() => void handleDelete(mission.id)} className="w-8 h-8 rounded-chip flex items-center justify-center text-foreground-400 hover:text-accent-700 hover:bg-accent-100 cursor-pointer flex-shrink-0" title="작은 사명 삭제"><i className="ri-delete-bin-line text-xs" /></button>}
                  </div>
                  {mission.description && <p className="text-xs text-foreground-600 leading-relaxed mt-3 whitespace-pre-wrap">{mission.description}</p>}
                  <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-background-200">
                    <span className="text-[11px] text-foreground-500"><i className="ri-time-line mr-1" />{new Date(mission.created_at).toLocaleDateString('ko-KR')} 게시</span>
                    <button type="button" onClick={() => void handleClaim(mission)} disabled={mine || claiming} className={`min-h-10 px-4 rounded-chip text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${mine ? 'bg-background-200 text-foreground-500 cursor-default' : 'bg-primary-500 text-background-50 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed'}`}>
                      <i className={`${mine ? 'ri-check-line' : 'ri-hand-heart-line'} mr-1`} />{mine ? '내가 맡은 사명' : claiming ? '맡는 중...' : '작은 사명 하기'}
                    </button>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
