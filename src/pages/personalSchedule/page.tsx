import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

interface PersonalSchedule {
  id: string;
  date: string;
  time: string;
  title: string;
  description: string;
  created_at: string;
}

export default function PersonalSchedule() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const prefilled = (location.state as { prefilledTitle?: string; prefilledDescription?: string } | null) || {};

  const [schedules, setSchedules] = useState<PersonalSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '',
    title: prefilled.prefilledTitle || '',
    description: prefilled.prefilledDescription || '',
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadSchedules();
    // prefill이 있으면 폼 자동 열기
    if (prefilled.prefilledTitle) {
      setShowForm(true);
    }
  }, [user]);

  const loadSchedules = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('personal_schedules')
        .select('*')
        .eq('user_id', user!.id)
        .order('date', { ascending: true });
      if (fetchErr) throw fetchErr;
      setSchedules(data || []);
    } catch {
      setError('일정을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.date || !formData.title.trim() || !user || saving) return;
    setSaving(true);
    try {
      if (editingId) {
        await supabase
          .from('personal_schedules')
          .update({
            date: formData.date,
            time: formData.time || null,
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);
      } else {
        await supabase
          .from('personal_schedules')
          .insert({
            user_id: user.id,
            date: formData.date,
            time: formData.time || null,
            title: formData.title.trim(),
            description: formData.description.trim() || null,
          });
      }
      setFormData({ date: '', time: '', title: '', description: '' });
      setShowForm(false);
      setEditingId(null);
      await loadSchedules();
    } catch {
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (s: PersonalSchedule) => {
    setFormData({ date: s.date, time: s.time || '', title: s.title, description: s.description || '' });
    setEditingId(s.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await supabase.from('personal_schedules').delete().eq('id', id);
      setSchedules(prev => prev.filter(s => s.id !== id));
    } catch {
      setError('삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ date: '', time: '', title: '', description: '' });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-[20px] bg-sky-100 flex items-center justify-center mx-auto mb-4">
            <i className="ri-lock-line text-3xl text-sky-600"></i>
          </div>
          <p className="text-lg font-bold text-foreground-950 mb-2">로그인이 필요합니다</p>
          <p className="text-sm text-foreground-600">개인 일정은 로그인한 본인만 볼 수 있습니다</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-sky-400 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-sky-100 border border-sky-200 mb-5">
              <i className="ri-calendar-check-line text-3xl text-sky-600"></i>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">개인 일정</h1>
            <p className="text-sm text-foreground-600 flex items-center justify-center gap-1">
              <i className="ri-lock-line text-xs"></i>
              비공개 — 본인과 담당 교사만 열람 가능
            </p>
          </div>

          {error && (
            <div className="bg-accent-100 border border-accent-200 rounded-[20px] p-4 mb-6">
              <p className="text-sm text-accent-700 flex items-center gap-2">
                <i className="ri-error-warning-line"></i>{error}
              </p>
              <button onClick={() => { setError(null); loadSchedules(); }} className="mt-2 text-xs text-accent-600 underline cursor-pointer">다시 시도</button>
            </div>
          )}

          <div className="mb-6">
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-sky-500 text-background-50 text-sm font-semibold hover:bg-sky-600 transition-all cursor-pointer whitespace-nowrap"
            >
              <i className="ri-add-line"></i> 일정 추가
            </button>
          </div>

          {schedules.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-full bg-sky-50 flex items-center justify-center mx-auto mb-3">
                <i className="ri-calendar-line text-2xl text-sky-300"></i>
              </div>
              <p className="text-sm text-foreground-600">등록된 개인 일정이 없어요</p>
              <p className="text-xs text-foreground-500 mt-1">위 버튼으로 첫 일정을 추가해보세요!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map((s, idx) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.05, 0.3) }}
                  className="bg-background-100 border border-background-200 rounded-[20px] p-4 flex items-start gap-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-sky-100 flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-lg font-bold text-sky-600">{new Date(s.date).getDate()}</span>
                    <span className="text-[10px] text-sky-500">{new Date(s.date).getMonth() + 1}월</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-foreground-950">{s.title}</h3>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleEdit(s)} className="text-gray-400 hover:text-sky-600 cursor-pointer p-0.5">
                          <i className="ri-edit-line text-xs"></i>
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          disabled={deletingId === s.id}
                          className="text-gray-400 hover:text-rose-500 cursor-pointer p-0.5 disabled:opacity-30"
                        >
                          <i className={deletingId === s.id ? 'ri-loader-4-line animate-spin text-xs' : 'ri-delete-bin-line text-xs'}></i>
                        </button>
                      </div>
                    </div>
                    {s.time && <p className="text-xs text-sky-600">{s.time}</p>}
                    {s.description && <p className="text-sm text-foreground-700 mt-1">{s.description}</p>}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={closeForm}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-background-100 rounded-[20px] p-6 max-w-md w-full"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-4">{editingId ? '일정 수정' : '개인 일정 추가'}</h3>
              <div className="space-y-3">
                <input
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData(p => ({ ...p, date: e.target.value }))}
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:border-sky-400"
                />
                <input
                  type="text"
                  value={formData.time}
                  onChange={e => setFormData(p => ({ ...p, time: e.target.value }))}
                  placeholder="시간 (예: 14:00)"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none"
                />
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                  placeholder="일정 제목"
                  maxLength={50}
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none"
                />
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                  placeholder="설명 (선택)"
                  rows={2}
                  maxLength={200}
                  className="w-full px-4 py-3 text-sm rounded-xl border border-gray-200 outline-none resize-none"
                />
                <div className="flex gap-2 pt-2">
                  <button onClick={closeForm} className="flex-1 py-2.5 rounded-full border border-gray-200 text-sm cursor-pointer">취소</button>
                  <button
                    onClick={handleSave}
                    disabled={!formData.date || !formData.title.trim() || saving}
                    className="flex-1 py-2.5 rounded-full bg-sky-500 text-white text-sm font-semibold disabled:opacity-40 cursor-pointer whitespace-nowrap"
                  >
                    {saving ? '저장 중...' : editingId ? '수정' : '추가'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}