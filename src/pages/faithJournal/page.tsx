import { formatLocalDate } from '@/lib/date';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

interface FaithEntry {
  id: string;
  user_id: string;
  scripture: string;
  content: string;
  mood: 'joyful' | 'peaceful' | 'reflective' | 'grateful' | 'struggling';
  entry_date: string;
  created_at: string;
}

const MOODS: Record<string, { icon: string; label: string; color: string }> = {
  joyful: { icon: 'ri-emotion-happy-line', label: '기쁨', color: 'text-amber-600' },
  peaceful: { icon: 'ri-emotion-line', label: '평안', color: 'text-emerald-600' },
  reflective: { icon: 'ri-lightbulb-line', label: '묵상', color: 'text-sky-600' },
  grateful: { icon: 'ri-heart-line', label: '감사', color: 'text-rose-600' },
  struggling: { icon: 'ri-emotion-sad-line', label: '고민', color: 'text-secondary-600' },
};

export default function FaithJournal() {
  const { user, profile } = useAuth();
  const [entries, setEntries] = useState<FaithEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ scripture: '', content: '', mood: 'reflective' as FaithEntry['mood'] });

  const fetchEntries = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('faith_journal_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('entry_date', { ascending: false });

      if (fetchError) throw fetchError;
      setEntries((data || []) as FaithEntry[]);
    } catch {
      setError('데이터를 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [user]);

  const handleAdd = async () => {
    if (!formData.scripture.trim() || !formData.content.trim() || !user) return;
    setSubmitting(true);
    try {
      const { data, error: insertError } = await supabase
        .from('faith_journal_entries')
        .insert({
          user_id: user.id,
          scripture: formData.scripture.trim(),
          content: formData.content.trim(),
          mood: formData.mood,
          entry_date: formatLocalDate(new Date()),
        })
        .select()
        .single();

      if (insertError) throw insertError;
      if (data) setEntries(prev => [data as FaithEntry, ...prev]);
      setFormData({ scripture: '', content: '', mood: 'reflective' });
      setShowForm(false);
    } catch {
      setError('기록 저장에 실패했어요. 다시 시도해주세요');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.from('faith_journal_entries').delete().eq('id', id);
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch {
      setError('삭제에 실패했어요. 다시 시도해주세요');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-[20px] bg-sky-100 flex items-center justify-center mx-auto mb-4">
            <i className="ri-lock-line text-3xl text-sky-600"></i>
          </div>
          <p className="text-lg font-bold text-foreground-950 mb-2">비공개 공간입니다</p>
          <p className="text-sm text-foreground-600">로그인이 필요합니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-sky-100 border border-sky-200 mb-5">
              <i className="ri-quill-pen-line text-3xl text-sky-600"></i>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">신앙 일지</h1>
            <p className="text-sm text-foreground-600 flex items-center justify-center gap-1">
              <i className="ri-lock-line text-xs"></i>
              비공개 — 개인 신앙 묵상과 일기를 기록하는 공간
            </p>
          </div>

          <div className="mb-6">
            <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-sky-500 text-background-50 text-sm font-semibold hover:bg-sky-600 transition-all cursor-pointer whitespace-nowrap">
              <i className="ri-add-line"></i> 오늘의 묵상 기록
            </button>
          </div>

          {error && (
            <div className="bg-accent-100 border border-accent-200 rounded-[20px] p-4 mb-6">
              <p className="text-sm text-accent-700 flex items-center gap-2">
                <i className="ri-error-warning-line"></i>
                {error}
              </p>
              <button onClick={fetchEntries} className="mt-2 text-xs text-accent-600 underline cursor-pointer">다시 시도</button>
            </div>
          )}

          {loading ? (
            <div className="text-center py-16">
              <i className="ri-loader-4-line animate-spin text-2xl text-sky-400"></i>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-sky-50 flex items-center justify-center mx-auto mb-4">
                <i className="ri-book-open-line text-2xl text-sky-300"></i>
              </div>
              <p className="text-sm text-foreground-600">아직 기록이 없어요. 오늘 읽은 말씀을 기록해보세요.</p>
            </div>
          ) : (
            <div className="relative pl-5">
              {/* 타임라인 세로선 */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-sky-200"></div>
              <div className="space-y-5">
                {entries.map((entry, idx) => {
                  const mood = MOODS[entry.mood];
                  return (
                    <motion.div key={entry.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx, 10) * 0.05 }} className="relative">
                      {/* 타임라인 점 */}
                      <div className="absolute -left-5 top-1.5 w-3.5 h-3.5 rounded-full bg-sky-400 border-2 border-background-50"></div>
                      <div className="bg-[#fdfbf5] border border-amber-100/70 rounded-[20px] p-5 shadow-card">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <i className={`${mood.icon} ${mood.color} text-sm`}></i>
                            <span className={`text-xs font-medium ${mood.color}`}>{mood.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-xs text-foreground-500">
                              <i className="ri-calendar-line text-[11px]"></i>
                              {entry.entry_date}
                            </span>
                            <button onClick={() => handleDelete(entry.id)} className="text-gray-300 hover:text-rose-500 cursor-pointer">
                              <i className="ri-delete-bin-line text-sm"></i>
                            </button>
                          </div>
                        </div>
                        <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 mb-3">
                          <p className="text-sm text-sky-700 font-medium italic">"{entry.scripture}"</p>
                        </div>
                        <p className="text-sm text-foreground-700 leading-relaxed whitespace-pre-wrap">{entry.content}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-background-100 rounded-[20px] border border-gray-200 p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-gray-800 mb-4">오늘의 묵상</h3>
              <div className="space-y-3">
                <input type="text" value={formData.scripture} onChange={e => setFormData(prev => ({ ...prev, scripture: e.target.value }))} placeholder="오늘 읽은 말씀 (예: 빌립보서 4:13)" className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 focus:border-sky-400 outline-none" />
                <textarea value={formData.content} onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))} placeholder="말씀을 통해 깨달은 것, 적용할 것, 기도제목..." rows={4} maxLength={1000} className="w-full px-4 py-3 text-sm rounded-xl border border-gray-200 focus:border-sky-400 outline-none resize-none" />
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">오늘의 마음</label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(MOODS) as FaithEntry['mood'][]).map(m => (
                      <button key={m} onClick={() => setFormData(prev => ({ ...prev, mood: m }))} className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap flex items-center gap-1 ${formData.mood === m ? 'bg-sky-100 text-sky-700 border border-sky-200' : 'bg-gray-100 text-gray-500'}`}>
                        <i className={MOODS[m].icon}></i> {MOODS[m].label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-full border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">취소</button>
                  <button onClick={handleAdd} disabled={!formData.scripture.trim() || !formData.content.trim() || submitting} className="flex-1 py-2.5 rounded-full bg-sky-500 text-background-50 text-sm font-semibold hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap">{submitting ? '저장 중...' : '기록하기'}</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}