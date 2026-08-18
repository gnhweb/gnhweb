import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

interface ChecklistItem {
  id: string;
  task: string;
  assignee_name: string;
  role: string;
  completed: boolean;
  sort_order: number;
  updated_at: string;
}

export default function SeniorChecklist() {
  const { user, profile, hasRole } = useAuth();
  const isTeacherOrChief = hasRole('teacher') || hasRole('chief');
  const canEdit = isTeacherOrChief || hasRole('president') || hasRole('secretary');

  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  // CRUD
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTask, setFormTask] = useState('');
  const [formAssignee, setFormAssignee] = useState('');
  const [formRole, setFormRole] = useState('');
  const [saving, setSaving] = useState(false);

  // Realtime
  const [channel, setChannel] = useState<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    loadItems();
    setupRealtime();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const setupRealtime = () => {
    const ch = supabase
      .channel('senior-checklist-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'senior_checklist' }, () => {
        loadItems();
      })
      .subscribe();
    setChannel(ch);
  };

  const loadItems = async () => {
    try {
      const { data } = await supabase.from('senior_checklist').select('*').order('sort_order');
      setItems((data || []) as ChecklistItem[]);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const toggleComplete = async (item: ChecklistItem) => {
    if (!canEdit) return;
    const newCompleted = !item.completed;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, completed: newCompleted } : i));
    await supabase.from('senior_checklist').update({
      completed: newCompleted,
      updated_at: new Date().toISOString(),
      updated_by: user?.id,
    }).eq('id', item.id);
  };

  const openCreate = () => {
    setEditingId(null);
    setFormTask('');
    setFormAssignee('');
    setFormRole('');
    setShowForm(true);
  };

  const openEdit = (item: ChecklistItem) => {
    setEditingId(item.id);
    setFormTask(item.task);
    setFormAssignee(item.assignee_name);
    setFormRole(item.role);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formTask.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await supabase.from('senior_checklist').update({
          task: formTask.trim(),
          assignee_name: formAssignee.trim(),
          role: formRole.trim(),
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        }).eq('id', editingId);
      } else {
        await supabase.from('senior_checklist').insert({
          task: formTask.trim(),
          assignee_name: formAssignee.trim(),
          role: formRole.trim(),
          sort_order: items.length,
          updated_by: user?.id,
        });
      }
      loadItems();
      setShowForm(false);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('senior_checklist').delete().eq('id', id);
    loadItems();
  };

  const completed = items.filter(i => i.completed).length;
  const total = items.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-teal-400 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-6">
            <Link to="/senior" className="inline-flex items-center gap-1 text-sm text-foreground-500 hover:text-foreground-700 cursor-pointer mb-4">
              <i className="ri-arrow-left-line"></i> 고3구역
            </Link>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-gradient-to-br from-teal-100 to-emerald-100 border border-teal-200 mb-5">
              <i className="ri-task-line text-3xl text-teal-600"></i>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">헌신예배 준비 체크리스트</h1>
            <p className="text-sm text-foreground-600">임원·교사가 함께 보는 실시간 공유 체크리스트</p>
          </div>

          {/* Progress */}
          <div className="bg-background-100 border border-background-200 rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-foreground-800">준비 진행률</span>
              <span className="text-sm font-bold text-teal-600">{progress}%</span>
            </div>
            <div className="h-2.5 bg-background-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.6 }}
                className="h-full bg-gradient-to-r from-teal-400 to-emerald-400 rounded-full"
              />
            </div>
            <p className="text-xs text-foreground-500 mt-2">{completed}/{total} 완료</p>
            <p className="text-[11px] text-foreground-500 mt-1 flex items-center gap-1">
              <i className="ri-flashlight-line text-teal-500"></i> 실시간 연동 중 — 다른 사람의 변경사항이 즉시 반영됩니다
            </p>
          </div>

          {canEdit && (
            <div className="flex items-center gap-2 mb-4">
              <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-teal-500 text-white text-sm font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap">
                <i className="ri-add-line"></i> 항목 추가
              </button>
            </div>
          )}

          {/* Checklist */}
          {items.length === 0 ? (
            <div className="text-center py-16 bg-background-100 border border-background-200 rounded-2xl">
              <div className="w-14 h-14 rounded-xl bg-teal-100 flex items-center justify-center mx-auto mb-4">
                <i className="ri-task-line text-2xl text-teal-400"></i>
              </div>
              <p className="text-sm text-foreground-600">아직 등록된 체크리스트 항목이 없어요</p>
              {canEdit && (
                <button onClick={openCreate} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-teal-500 text-white text-sm font-semibold hover:bg-teal-600 cursor-pointer whitespace-nowrap">첫 항목 추가</button>
              )}
            </div>
          ) : (
            <>
              {/* ===== PC (md 이상) — 기존 리스트 그대로 ===== */}
              <div className="hidden md:block bg-background-100 border border-background-200 rounded-2xl overflow-hidden">
                {items.map((item, idx) => (
                  <div key={item.id} className={`flex items-center gap-3 px-5 py-3.5 group ${idx < items.length - 1 ? 'border-b border-background-100' : ''}`}>
                    <div
                      onClick={() => toggleComplete(item)}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${canEdit ? 'cursor-pointer' : 'cursor-default'} ${item.completed ? 'bg-emerald-500 border-emerald-500' : 'border-background-300 hover:border-emerald-400'}`}
                    >
                      {item.completed && <i className="ri-check-line text-white text-[10px]"></i>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${item.completed ? 'text-foreground-500 line-through' : 'text-foreground-800'}`}>{item.task}</p>
                      {(item.assignee_name || item.role) && (
                        <p className="text-xs text-foreground-500 mt-0.5">
                          {item.assignee_name && <span className="font-medium">{item.assignee_name}</span>}
                          {item.assignee_name && item.role && ' · '}
                          {item.role && <span>{item.role}</span>}
                        </p>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(item)} className="w-7 h-7 rounded-full flex items-center justify-center text-foreground-400 hover:text-foreground-700 hover:bg-background-100 cursor-pointer">
                          <i className="ri-edit-line text-xs"></i>
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="w-7 h-7 rounded-full flex items-center justify-center text-foreground-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer">
                          <i className="ri-delete-bin-line text-xs"></i>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* ===== 모바일 (md 미만) — 카드형 체크리스트 + 그라디언트 체크 ===== */}
              <div className="md:hidden space-y-2.5">
                {items.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx, 10) * 0.04 }}
                    className="flex items-center gap-3 bg-background-100 rounded-[20px] shadow-card p-3.5"
                  >
                    <motion.div
                      whileTap={canEdit ? { scale: 0.85 } : undefined}
                      onClick={() => toggleComplete(item)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${canEdit ? 'cursor-pointer' : 'cursor-default'} ${
                        item.completed ? 'bg-gradient-to-br from-emerald-400 to-teal-400' : 'border-2 border-background-300'
                      }`}
                    >
                      {item.completed && <i className="ri-check-line text-white text-sm"></i>}
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${item.completed ? 'text-foreground-400 line-through' : 'text-foreground-800 font-medium'}`}>{item.task}</p>
                      {(item.assignee_name || item.role) && (
                        <p className="text-[11px] text-foreground-500 mt-0.5">
                          {item.assignee_name && <span className="font-medium">{item.assignee_name}</span>}
                          {item.assignee_name && item.role && ' · '}
                          {item.role && <span>{item.role}</span>}
                        </p>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button onClick={() => openEdit(item)} className="w-7 h-7 rounded-full flex items-center justify-center text-foreground-400 active:bg-background-100 cursor-pointer">
                          <i className="ri-edit-line text-xs"></i>
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="w-7 h-7 rounded-full flex items-center justify-center text-foreground-400 active:bg-rose-50 cursor-pointer">
                          <i className="ri-delete-bin-line text-xs"></i>
                        </button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Form modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-background-100 border border-background-200 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-foreground-950 mb-4">{editingId ? '항목 수정' : '새 항목 추가'}</h3>
              <div className="space-y-3">
                <input type="text" value={formTask} onChange={e => setFormTask(e.target.value)} placeholder="할 일" maxLength={200} className="w-full px-4 py-2.5 text-sm rounded-xl border border-background-200 outline-none focus:border-teal-400" />
                <input type="text" value={formAssignee} onChange={e => setFormAssignee(e.target.value)} placeholder="담당자 이름" maxLength={50} className="w-full px-4 py-2.5 text-sm rounded-xl border border-background-200 outline-none" />
                <input type="text" value={formRole} onChange={e => setFormRole(e.target.value)} placeholder="역할 (예: 사회, 찬양, 기도)" maxLength={50} className="w-full px-4 py-2.5 text-sm rounded-xl border border-background-200 outline-none" />
              </div>
              <div className="flex items-center gap-2 mt-4">
                <button onClick={handleSave} disabled={!formTask.trim() || saving} className="px-5 py-2.5 rounded-full bg-teal-500 text-white text-sm font-semibold hover:bg-teal-600 disabled:opacity-40 cursor-pointer whitespace-nowrap">
                  {saving ? '저장 중...' : editingId ? '수정하기' : '추가하기'}
                </button>
                <button onClick={() => setShowForm(false)} className="text-sm text-foreground-500 cursor-pointer">취소</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}