import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { getInternationalAge } from '@/lib/age';

interface MasterChecklistItem {
  id: string;
  task: string;
  phase: '6months' | '3months' | '1month' | 'after';
  sort_order: number;
}

interface StudentCheck {
  master_item_id: string;
  completed: boolean;
}

const PHASES = [
  { key: '6months', label: '졸업 6개월 전', icon: 'ri-time-line', color: 'amber' },
  { key: '3months', label: '졸업 3개월 전', icon: 'ri-timer-line', color: 'orange' },
  { key: '1month', label: '졸업 1개월 전', icon: 'ri-timer-flash-line', color: 'rose' },
  { key: 'after', label: '졸업 후', icon: 'ri-flag-line', color: 'emerald' },
];

const PHASE_CLASSES: Record<string, { bg: string; border: string; text: string; dotBg: string }> = {
  '6months': { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dotBg: 'bg-amber-100' },
  '3months': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dotBg: 'bg-orange-100' },
  '1month': { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', dotBg: 'bg-rose-100' },
  'after': { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dotBg: 'bg-emerald-100' },
};

export default function GraduationTransition() {
  const { user, profile, hasRole } = useAuth();
  const isTeacher = hasRole('teacher');
  const isChief = hasRole('chief');

  const isGraduatingStudent = profile?.graduation_expected === true || getInternationalAge(profile?.birth_year || 0, profile?.birth_month || 0, profile?.birth_day || 0) >= 19;
  const isEditor = isTeacher || isChief;
  const canView = isTeacher || isChief || isGraduatingStudent;

  // Master checklist (shared items created by teachers/chiefs)
  const [masterItems, setMasterItems] = useState<MasterChecklistItem[]>([]);
  // Per-student completion status
  const [studentChecks, setStudentChecks] = useState<StudentCheck[]>([]);
  const [transferNote, setTransferNote] = useState('');
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state for teachers/chiefs
  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [newItemTask, setNewItemTask] = useState('');
  const [newItemPhase, setNewItemPhase] = useState<MasterChecklistItem['phase']>('6months');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemTask, setEditingItemTask] = useState('');

  const loadMasterItems = useCallback(async () => {
    const { data } = await supabase
      .from('graduation_master_checklist')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    setMasterItems((data || []) as MasterChecklistItem[]);
  }, []);

  const loadStudentChecks = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('graduation_student_checks')
      .select('master_item_id, completed')
      .eq('user_id', user.id);
    setStudentChecks((data || []) as StudentCheck[]);
  }, [user]);

  const loadTransferNote = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('graduation_transition')
      .select('transfer_note')
      .eq('user_id', user.id)
      .maybeSingle();
    setTransferNote((data?.transfer_note as string) || '');
  }, [user]);

  useEffect(() => {
    if (!user || !canView) return;
    const loadAll = async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([loadMasterItems(), loadStudentChecks(), loadTransferNote()]);
      } catch {
        setError('데이터를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    loadAll();

    // Realtime subscriptions
    const masterChannel = supabase
      .channel('graduation-master-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'graduation_master_checklist' }, () => loadMasterItems())
      .subscribe();

    const checksChannel = supabase
      .channel('graduation-checks-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'graduation_student_checks', filter: `user_id=eq.${user.id}` }, () => loadStudentChecks())
      .subscribe();

    return () => {
      supabase.removeChannel(masterChannel);
      supabase.removeChannel(checksChannel);
    };
  }, [user, canView, loadMasterItems, loadStudentChecks, loadTransferNote]);

  const toggleCheck = async (masterItemId: string) => {
    if (!user) return;
    setSaving(true);
    try {
      const existing = studentChecks.find(c => c.master_item_id === masterItemId);
      if (existing) {
        if (existing.completed) {
          // Un-check: delete the record
          await supabase.from('graduation_student_checks').delete().eq('user_id', user.id).eq('master_item_id', masterItemId);
        } else {
          // Mark completed
          await supabase.from('graduation_student_checks').update({ completed: true, completed_at: new Date().toISOString() }).eq('user_id', user.id).eq('master_item_id', masterItemId);
        }
      } else {
        // Create new check as completed
        await supabase.from('graduation_student_checks').insert({ user_id: user.id, master_item_id: masterItemId, completed: true, completed_at: new Date().toISOString() });
      }
      await loadStudentChecks();
    } catch {
      setError('체크 상태 저장에 실패했어요.');
    } finally {
      setSaving(false);
    }
  };

  // ── Master item CRUD (teachers/chiefs only) ──
  const handleAddMasterItem = async () => {
    if (!newItemTask.trim() || !isEditor) return;
    setSaving(true);
    try {
      await supabase.from('graduation_master_checklist').insert({
        task: newItemTask.trim(),
        phase: newItemPhase,
        sort_order: masterItems.filter(m => m.phase === newItemPhase).length,
        created_by: user!.id,
      });
      await loadMasterItems();
      setNewItemTask('');
      setShowNewItemForm(false);
    } catch {
      setError('항목 추가에 실패했어요.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateMasterItem = async (itemId: string) => {
    if (!editingItemTask.trim() || !isEditor) return;
    setSaving(true);
    try {
      await supabase.from('graduation_master_checklist').update({ task: editingItemTask.trim(), updated_at: new Date().toISOString() }).eq('id', itemId);
      await loadMasterItems();
      setEditingItemId(null);
      setEditingItemTask('');
    } catch {
      setError('항목 수정에 실패했어요.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMasterItem = async (itemId: string) => {
    if (!isEditor) return;
    setSaving(true);
    try {
      await supabase.from('graduation_master_checklist').delete().eq('id', itemId);
      await loadMasterItems();
    } catch {
      setError('항목 삭제에 실패했어요.');
    } finally {
      setSaving(false);
    }
  };

  const saveTransferNote = async () => {
    setTransferNote(noteDraft);
    setEditingNote(false);
    setSaving(true);
    try {
      await supabase.from('graduation_transition').upsert({
        user_id: user!.id,
        transfer_note: noteDraft,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    } catch {
      setError('인수인계 노트 저장에 실패했어요.');
    } finally {
      setSaving(false);
    }
  };

  if (!user || !canView) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-accent-100 flex items-center justify-center mx-auto mb-4">
            <i className="ri-shield-user-line text-2xl text-accent-500"></i>
          </div>
          <h2 className="text-lg font-bold text-foreground-950 mb-2">접근 권한이 없습니다</h2>
          <p className="text-sm text-foreground-600">
            졸업 전환 로드맵은 만 19세 이상 학생회원 또는 교사·부장만 열람할 수 있어요.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  const isCompleted = (masterItemId: string) => studentChecks.some(c => c.master_item_id === masterItemId && c.completed);

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-gradient-to-br from-amber-100 to-rose-100 border border-amber-200 mb-5">
              <i className="ri-road-map-line text-3xl text-amber-600"></i>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">졸업 전환 로드맵</h1>
            <p className="text-sm text-foreground-600">고3 졸업 후 대학부/청년부로 자연스럽게 연결되는 여정</p>
            {saving && <p className="text-xs text-foreground-500 mt-1">저장 중...</p>}
          </div>

          {error && (
            <div className="bg-accent-100 border border-accent-200 rounded-[20px] p-4 mb-6">
              <p className="text-sm text-accent-700 flex items-center gap-2">
                <i className="ri-error-warning-line"></i>{error}
              </p>
              <button onClick={() => { setError(null); loadMasterItems(); loadStudentChecks(); }} className="mt-2 text-xs text-accent-600 underline cursor-pointer">다시 시도</button>
            </div>
          )}

          {/* Master item CRUD (teachers/chiefs only) */}
          {isEditor && (
            <div className="mb-4">
              {!showNewItemForm ? (
                <button
                  onClick={() => setShowNewItemForm(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-add-line"></i> 새 체크리스트 항목 추가
                </button>
              ) : (
                <div className="bg-background-100 border border-background-200 rounded-[20px] p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={newItemTask}
                      onChange={e => setNewItemTask(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && newItemTask.trim()) handleAddMasterItem(); }}
                      placeholder="새 체크리스트 항목..."
                      maxLength={100}
                      className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-background-200 bg-background-50 focus:border-primary-400 outline-none"
                      autoFocus
                    />
                    <select
                      value={newItemPhase}
                      onChange={e => setNewItemPhase(e.target.value as MasterChecklistItem['phase'])}
                      className="px-3 py-2.5 text-sm rounded-xl border border-background-200 bg-background-50 outline-none cursor-pointer"
                    >
                      {PHASES.map(p => (
                        <option key={p.key} value={p.key}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAddMasterItem}
                      disabled={!newItemTask.trim()}
                      className="px-4 py-2 rounded-full bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                    >
                      추가
                    </button>
                    <button
                      onClick={() => { setShowNewItemForm(false); setNewItemTask(''); }}
                      className="text-sm text-foreground-500 hover:text-foreground-700 cursor-pointer"
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Checklist by phase */}
          <div className="space-y-4 mb-6">
            {PHASES.map(phase => {
              const items = masterItems.filter(c => c.phase === phase.key);
              const completed = items.filter(i => isCompleted(i.id)).length;
              const cls = PHASE_CLASSES[phase.key];
              return (
                <div key={phase.key} className={`${cls.bg} border ${cls.border} rounded-[20px] p-5`}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-8 h-8 rounded-lg ${cls.dotBg} flex items-center justify-center`}>
                      <i className={`${phase.icon} ${cls.text} text-sm`}></i>
                    </div>
                    <h3 className="text-sm font-bold text-foreground-950">{phase.label}</h3>
                    <span className="ml-auto text-xs text-foreground-600">{completed}/{items.length} 완료</span>
                  </div>
                  <div className="space-y-1.5">
                    {items.map(item => (
                      <div key={item.id} className="group flex items-start gap-3 p-2.5 rounded-xl transition-colors hover:bg-background-100/60">
                        {editingItemId === item.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="text"
                              value={editingItemTask}
                              onChange={e => setEditingItemTask(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleUpdateMasterItem(item.id); if (e.key === 'Escape') { setEditingItemId(null); setEditingItemTask(''); } }}
                              maxLength={100}
                              className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-amber-200 bg-background-100 outline-none"
                              autoFocus
                            />
                            <button onClick={() => handleUpdateMasterItem(item.id)} className="text-xs text-emerald-600 hover:text-emerald-700 cursor-pointer font-medium whitespace-nowrap">저장</button>
                            <button onClick={() => { setEditingItemId(null); setEditingItemTask(''); }} className="text-xs text-foreground-500 hover:text-foreground-700 cursor-pointer">취소</button>
                          </div>
                        ) : (
                          <>
                            <div
                              onClick={() => toggleCheck(item.id)}
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors cursor-pointer ${isCompleted(item.id) ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 hover:border-emerald-400'}`}
                            >
                              {isCompleted(item.id) && <i className="ri-check-line text-white text-[10px]"></i>}
                            </div>
                            <span className={`flex-1 text-sm ${isCompleted(item.id) ? 'text-foreground-500 line-through' : 'text-foreground-800'}`}>{item.task}</span>
                            {isEditor && (
                              <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => { setEditingItemId(item.id); setEditingItemTask(item.task); }}
                                  className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-foreground-400 hover:text-foreground-700 hover:bg-background-200 cursor-pointer"
                                >
                                  <i className="ri-edit-line text-sm"></i>
                                </button>
                                <button
                                  onClick={() => handleDeleteMasterItem(item.id)}
                                  className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-foreground-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                >
                                  <i className="ri-delete-bin-line text-sm"></i>
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  {items.length === 0 && (
                    <p className="text-xs text-foreground-500 py-2">이 시기의 체크리스트가 없습니다.</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Transfer note */}
          <div className="bg-background-100 border border-background-200 rounded-[20px] p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-foreground-950 flex items-center gap-2">
                <i className="ri-file-text-line text-amber-600"></i>
                인수인계 노트
              </h3>
              {canView && (
                <button
                  onClick={() => {
                    if (editingNote) {
                      saveTransferNote();
                    } else {
                      setNoteDraft(transferNote);
                      setEditingNote(true);
                    }
                  }}
                  className="text-xs text-primary-600 hover:text-primary-700 cursor-pointer font-medium"
                >
                  {editingNote ? '저장' : '수정'}
                </button>
              )}
            </div>
            {editingNote ? (
              <div>
                <textarea
                  value={noteDraft}
                  onChange={e => setNoteDraft(e.target.value)}
                  rows={5}
                  maxLength={500}
                  placeholder="후임자에게 전달할 내용, 진행 중인 업무, 주의사항 등을 기록해주세요..."
                  className="w-full px-4 py-3 text-sm rounded-xl border border-gray-200 focus:border-amber-400 outline-none resize-none"
                />
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => { setEditingNote(false); setNoteDraft(transferNote); }}
                    className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
                  >
                    취소
                  </button>
                  <span className="text-xs text-foreground-500">{noteDraft.length}/500</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-foreground-700 leading-relaxed whitespace-pre-wrap">
                {transferNote || '아직 작성된 인수인계 노트가 없습니다.'}
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}