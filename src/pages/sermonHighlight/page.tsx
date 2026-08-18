import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

interface Highlight {
  id: string;
  author_id: string;
  author_name: string;
  content: string;
  is_anonymous: boolean;
  likes: number;
  created_at: string;
}

export default function SermonHighlight() {
  const { user, profile, hasRole } = useAuth();
  const isEditor = user && (hasRole('teacher') || hasRole('chief'));
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newHighlight, setNewHighlight] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadHighlights(); }, []);

  const loadHighlights = async () => {
    setLoading(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from('sermon_highlights')
        .select('*')
        .order('created_at', { ascending: false });
      if (fetchErr) throw fetchErr;
      setHighlights(data || []);
    } catch {
      setError('하이라이트를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!newHighlight.trim() || !profile || submitting) return;
    setSubmitting(true);
    try {
      const { error: insertErr } = await supabase
        .from('sermon_highlights')
        .insert({
          author_id: user!.id,
          author_name: isAnonymous ? '익명' : profile.name,
          content: newHighlight.trim(),
          is_anonymous: isAnonymous,
        });
      if (insertErr) throw insertErr;
      setNewHighlight('');
      await loadHighlights();
    } catch {
      setError('등록 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 하이라이트를 삭제할까요?')) return;
    try {
      await supabase.from('sermon_highlights').delete().eq('id', id);
      setHighlights(prev => prev.filter(h => h.id !== id));
    } catch {
      setError('삭제 중 오류가 발생했습니다.');
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

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
              <i className="ri-quill-pen-line text-3xl text-sky-600"></i>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">설교 하이라이트</h1>
            <p className="text-sm text-foreground-600">설교 중 마음에 남는 문장을 실시간으로 공유해보세요</p>
          </div>

          {error && (
            <div className="bg-accent-100 border border-accent-200 rounded-[20px] p-4 mb-6">
              <p className="text-sm text-accent-700 flex items-center gap-2"><i className="ri-error-warning-line"></i>{error}</p>
              <button onClick={() => { setError(null); loadHighlights(); }} className="mt-2 text-xs text-accent-600 underline cursor-pointer">다시 시도</button>
            </div>
          )}

          {/* Live indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-semibold text-emerald-700">LIVE · 지금 설교 중</span>
          </div>

          {/* Input */}
          {user && (
            <div className="bg-background-100 border border-background-200 rounded-[20px] p-5 mb-6">
              <textarea
                value={newHighlight}
                onChange={e => setNewHighlight(e.target.value)}
                placeholder="지금 마음에 남는 설교 말씀을 공유해주세요..."
                rows={2}
                maxLength={200}
                className="w-full px-4 py-3 text-sm rounded-[13px] border border-background-200 bg-background-50 focus:border-sky-400 outline-none resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <label className="flex items-center gap-1.5 text-xs text-foreground-600 cursor-pointer">
                  <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)} className="rounded" />
                  익명
                </label>
                <button onClick={handleSubmit} disabled={!newHighlight.trim() || submitting} className="px-5 py-2 rounded-full bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap">
                  {submitting ? '올리는 중...' : '올리기'}
                </button>
              </div>
            </div>
          )}

          {/* Highlights list */}
          <div className="space-y-3">
            {highlights.map((h, idx) => (
              <motion.div key={h.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }} className="bg-background-100 border border-background-200 rounded-[16px] p-4">
                <p className="text-sm text-foreground-800 leading-relaxed mb-2">{h.content}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-sky-100 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-sky-600">{h.author_name.charAt(0)}</span>
                    </div>
                    <span className="text-xs text-foreground-600">{h.author_name}</span>
                    <span className="text-xs text-foreground-500">{formatTime(h.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isEditor && (
                      <button onClick={() => handleDelete(h.id)} className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-rose-50 cursor-pointer">
                        <i className="ri-delete-bin-line text-xs text-rose-400"></i>
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {highlights.length === 0 && (
            <div className="text-center py-16">
              <p className="text-sm text-foreground-600">아직 공유된 하이라이트가 없어요</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}