import { formatLocalDate } from '@/lib/date';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

interface RepentanceEntry {
  id: string;
  title: string;
  content: string;
  scripture: string;
  prayer: string;
  created_at: string;
}

export default function RepentanceJournal() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<RepentanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', content: '', scripture: '', prayer: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadEntries();
  }, [user]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from('repentance_journals')
        .select('*')
        .eq('author_id', user!.id)
        .order('created_at', { ascending: false });
      if (fetchErr) throw fetchErr;
      setEntries(data || []);
    } catch {
      setError('기록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.title.trim() || !formData.content.trim() || !user || submitting) return;
    setSubmitting(true);
    try {
      const { error: insertErr } = await supabase
        .from('repentance_journals')
        .insert({
          author_id: user.id,
          title: formData.title.trim(),
          content: formData.content.trim(),
          scripture: formData.scripture.trim() || null,
          prayer: formData.prayer.trim() || null,
        });
      if (insertErr) throw insertErr;
      setFormData({ title: '', content: '', scripture: '', prayer: '' });
      setShowForm(false);
      await loadEntries();
    } catch {
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.from('repentance_journals').delete().eq('id', id);
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch {
      setError('삭제 중 오류가 발생했습니다.');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-[20px] bg-rose-100 flex items-center justify-center mx-auto mb-4">
            <i className="ri-lock-line text-3xl text-rose-600"></i>
          </div>
          <p className="text-lg font-bold text-foreground-950 mb-2">비공개 공간입니다</p>
          <p className="text-sm text-foreground-600">로그인이 필요합니다</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-rose-400 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-rose-100 border border-rose-200 mb-5">
              <i className="ri-hand-heart-line text-3xl text-rose-600"></i>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">회개 저널</h1>
            <p className="text-sm text-foreground-600 flex items-center justify-center gap-1">
              <i className="ri-lock-line text-xs"></i>
              완전 비공개 — 본인만 열람할 수 있는 회개 기록 공간
            </p>
          </div>

          {error && (
            <div className="bg-accent-100 border border-accent-200 rounded-[20px] p-4 mb-6">
              <p className="text-sm text-accent-700 flex items-center gap-2">
                <i className="ri-error-warning-line"></i>
                {error}
              </p>
              <button onClick={() => { setError(null); loadEntries(); }} className="mt-2 text-xs text-accent-600 underline cursor-pointer">다시 시도</button>
            </div>
          )}

          <div className="mb-6">
            <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-rose-500 text-background-50 text-sm font-semibold hover:bg-rose-600 transition-all cursor-pointer whitespace-nowrap">
              <i className="ri-add-line"></i> 회개 기록하기
            </button>
          </div>

          {entries.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-4">
                <i className="ri-heart-line text-2xl text-rose-300"></i>
              </div>
              <p className="text-sm text-foreground-600">아직 기록이 없어요</p>
            </div>
          ) : (
            <div className="relative pl-5">
              {/* 타임라인 세로선 */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-rose-200"></div>
              <div className="space-y-5">
                {entries.map((entry, idx) => (
                  <motion.div key={entry.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx, 10) * 0.05 }} className="relative">
                    {/* 타임라인 점 */}
                    <div className="absolute -left-5 top-1.5 w-3.5 h-3.5 rounded-full bg-rose-400 border-2 border-background-50"></div>
                    <div className="bg-[#fdfbf5] border border-amber-100/70 rounded-[20px] p-5 shadow-card">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-foreground-950">{entry.title}</h3>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-xs text-foreground-500">
                            <i className="ri-calendar-line text-[11px]"></i>
                            {formatLocalDate(new Date(entry.created_at))}
                          </span>
                          <button onClick={() => handleDelete(entry.id)} className="text-gray-300 hover:text-rose-500 cursor-pointer">
                            <i className="ri-delete-bin-line text-sm"></i>
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-foreground-700 leading-relaxed mb-3 whitespace-pre-wrap">{entry.content}</p>
                      {entry.scripture && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-2">
                          <p className="text-xs text-amber-700 italic">"{entry.scripture}"</p>
                        </div>
                      )}
                      {entry.prayer && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <i className="ri-hand-heart-line text-rose-500 text-xs"></i>
                            <span className="text-xs font-bold text-rose-700">회개의 기도</span>
                          </div>
                          <p className="text-sm text-rose-700 leading-relaxed">{entry.prayer}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-background-100 rounded-[20px] border border-gray-200 p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <i className="ri-lock-line text-rose-500 text-sm"></i> 회개 기록
              </h3>
              <div className="space-y-3">
                <input type="text" value={formData.title} onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))} placeholder="제목" maxLength={50} className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 focus:border-rose-400 outline-none" />
                <textarea value={formData.content} onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))} placeholder="회개할 내용을 솔직하게 적어보세요..." rows={4} maxLength={500} className="w-full px-4 py-3 text-sm rounded-xl border border-gray-200 focus:border-rose-400 outline-none resize-none" />
                <input type="text" value={formData.scripture} onChange={e => setFormData(prev => ({ ...prev, scripture: e.target.value }))} placeholder="관련 성경 구절 (선택)" className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 focus:border-rose-400 outline-none" />
                <textarea value={formData.prayer} onChange={e => setFormData(prev => ({ ...prev, prayer: e.target.value }))} placeholder="회개의 기도" rows={2} maxLength={300} className="w-full px-4 py-3 text-sm rounded-xl border border-gray-200 focus:border-rose-400 outline-none resize-none" />
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-full border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">취소</button>
                  <button onClick={handleAdd} disabled={!formData.title.trim() || !formData.content.trim() || submitting} className="flex-1 py-2.5 rounded-full bg-rose-500 text-background-50 text-sm font-semibold hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap">
                    {submitting ? '저장 중...' : '기록하기'}
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