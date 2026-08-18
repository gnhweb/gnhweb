import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

type AgeGroup = 'elementary' | 'middle' | 'high';

const AGE_GROUPS: { key: AgeGroup; label: string; icon: string; color: string }[] = [
  { key: 'elementary', label: '초등부', icon: 'ri-seedling-line', color: 'emerald' },
  { key: 'middle', label: '중등부', icon: 'ri-plant-line', color: 'amber' },
  { key: 'high', label: '고등부', icon: 'ri-tree-line', color: 'rose' },
];

interface VerseItem {
  id: string;
  age_group: AgeGroup;
  title: string;
  reference: string;
  verse: string;
  theme: string;
  application: string;
  created_by: string;
  created_at: string;
}

export default function BibleByAge() {
  const { user, profile, hasRole } = useAuth();
  const isEditor = user && hasRole('teacher');
  const [selectedAge, setSelectedAge] = useState<AgeGroup>('high');
  const [expandedVerse, setExpandedVerse] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [versesData, setVersesData] = useState<Record<AgeGroup, VerseItem[]>>({
    elementary: [],
    middle: [],
    high: [],
  });

  // Add/edit form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', reference: '', verse: '', theme: '', application: '' });

  const fetchVerses = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('bible_age_verses')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const grouped: Record<AgeGroup, VerseItem[]> = {
        elementary: [],
        middle: [],
        high: [],
      };

      (data || []).forEach((v: Record<string, unknown>) => {
        const item: VerseItem = {
          id: v.id as string,
          age_group: v.age_group as AgeGroup,
          title: v.title as string,
          reference: v.reference as string,
          verse: v.verse as string,
          theme: (v.theme as string) || '',
          application: (v.application as string) || '',
          created_by: v.created_by as string,
          created_at: v.created_at as string,
        };
        if (grouped[item.age_group]) {
          grouped[item.age_group].push(item);
        }
      });

      setVersesData(grouped);
    } catch {
      setError('데이터를 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerses();
  }, []);

  const currentAgeGroup = AGE_GROUPS.find(g => g.key === selectedAge)!;
  const verses = versesData[selectedAge];

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm({ title: '', reference: '', verse: '', theme: '', application: '' });
    setShowForm(true);
  };

  const handleOpenEdit = (v: VerseItem) => {
    setEditingId(v.id);
    setForm({ title: v.title, reference: v.reference, verse: v.verse, theme: v.theme, application: v.application });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.reference.trim() || !form.verse.trim() || !user) return;
    setSubmitting(true);
    try {
      if (editingId) {
        const { data, error: updateError } = await supabase
          .from('bible_age_verses')
          .update({
            title: form.title.trim(),
            reference: form.reference.trim(),
            verse: form.verse.trim(),
            theme: form.theme.trim(),
            application: form.application.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId)
          .select()
          .single();

        if (updateError) throw updateError;

        if (data) {
          setVersesData(prev => ({
            ...prev,
            [selectedAge]: prev[selectedAge].map(v => v.id === editingId ? ({
              ...data as unknown as VerseItem,
            }) : v),
          }));
        }
      } else {
        const { data, error: insertError } = await supabase
          .from('bible_age_verses')
          .insert({
            age_group: selectedAge,
            title: form.title.trim(),
            reference: form.reference.trim(),
            verse: form.verse.trim(),
            theme: form.theme.trim(),
            application: form.application.trim(),
            created_by: user.id,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        if (data) {
          setVersesData(prev => ({
            ...prev,
            [selectedAge]: [data as unknown as VerseItem, ...prev[selectedAge]],
          }));
        }
      }

      setShowForm(false);
      setEditingId(null);
      setForm({ title: '', reference: '', verse: '', theme: '', application: '' });
    } catch {
      setSaveError('저장에 실패했어요. 다시 시도해주세요');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.from('bible_age_verses').delete().eq('id', id);
      setVersesData(prev => ({
        ...prev,
        [selectedAge]: prev[selectedAge].filter(v => v.id !== id),
      }));
    } catch {
      setError('삭제에 실패했어요. 다시 시도해주세요');
    }
  };

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-secondary-100 border border-secondary-200 mb-5">
              <i className="ri-book-read-line text-3xl text-secondary-600"></i>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">연령대별 말씀 정리</h1>
            <p className="text-sm text-foreground-600">내 연령대에 맞는 말씀을 찾아 묵상해보세요</p>
          </div>

          {/* Age group tabs */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {AGE_GROUPS.map(group => (
              <button
                key={group.key}
                onClick={() => { setSelectedAge(group.key); setExpandedVerse(null); }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  selectedAge === group.key
                    ? `bg-${group.color}-100 text-${group.color}-700 border-2 border-${group.color}-200`
                    : 'bg-background-100 text-foreground-600 border border-background-200 hover:border-secondary-300'
                }`}
              >
                <i className={group.icon}></i>
                {group.label}
              </button>
            ))}
          </div>

          {/* Editor actions */}
          {isEditor && (
            <div className="flex items-center justify-end mb-4">
              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-add-line"></i> 새 말씀 등록
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-accent-100 border border-accent-200 rounded-[20px] p-4 mb-6">
              <p className="text-sm text-accent-700 flex items-center gap-2">
                <i className="ri-error-warning-line"></i>
                {error}
              </p>
              <button onClick={fetchVerses} className="mt-2 text-xs text-accent-600 underline cursor-pointer">다시 시도</button>
            </div>
          )}

          {/* Add/Edit form modal */}
          <AnimatePresence>
            {showForm && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-background-100 rounded-[20px] border border-gray-200 p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
                  <h3 className="text-lg font-bold text-foreground-950 mb-4">{editingId ? '말씀 수정' : '새 말씀 등록'}</h3>
                  <div className="space-y-3">
                    <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="제목" maxLength={30} className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:border-primary-400" />
                    <input type="text" value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} placeholder="성경 구절 (예: 요한복음 3:16)" maxLength={40} className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:border-primary-400" />
                    <textarea value={form.verse} onChange={e => setForm(p => ({ ...p, verse: e.target.value }))} placeholder="말씀 본문" rows={3} maxLength={300} className="w-full px-4 py-3 text-sm rounded-xl border border-gray-200 outline-none focus:border-primary-400 resize-none" />
                    <input type="text" value={form.theme} onChange={e => setForm(p => ({ ...p, theme: e.target.value }))} placeholder="주제 (예: 사랑, 믿음)" maxLength={20} className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:border-primary-400" />
                    <textarea value={form.application} onChange={e => setForm(p => ({ ...p, application: e.target.value }))} placeholder="묵상 포인트" rows={2} maxLength={200} className="w-full px-4 py-3 text-sm rounded-xl border border-gray-200 outline-none focus:border-primary-400 resize-none" />
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-full border border-gray-200 text-sm font-medium text-gray-600 cursor-pointer whitespace-nowrap">취소</button>
                      <button onClick={handleSave} disabled={!form.title.trim() || !form.reference.trim() || !form.verse.trim() || submitting} className="flex-1 py-2.5 rounded-full bg-primary-500 text-background-50 text-sm font-semibold disabled:opacity-40 cursor-pointer whitespace-nowrap">{submitting ? '저장 중...' : (editingId ? '수정' : '등록')}</button>
                    </div>
                    {saveError && <p className="text-xs text-accent-600 mt-2 flex items-center gap-1"><i className="ri-error-warning-line"></i>{saveError}</p>}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {loading ? (
            <div className="text-center py-16">
              <i className="ri-loader-4-line animate-spin text-2xl text-secondary-400"></i>
            </div>
          ) : verses.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-sm text-foreground-600">아직 등록된 말씀이 없어요</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {verses.map((verse, idx) => (
                <motion.div
                  key={verse.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.05, 0.3) }}
                  className="bg-background-100 border border-background-200 rounded-[20px] overflow-hidden hover:border-secondary-300 transition-all"
                >
                  <div className="p-5 cursor-pointer" onClick={() => setExpandedVerse(expandedVerse === verse.id ? null : verse.id)}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium bg-${currentAgeGroup.color}-100 text-${currentAgeGroup.color}-600`}>
                            {verse.theme}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-foreground-950">{verse.title}</h3>
                        <p className="text-xs text-foreground-600 mt-0.5">{verse.reference}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {isEditor && (
                          <div className="flex items-center gap-1 mr-1">
                            <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(verse); }} className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-primary-50 cursor-pointer">
                              <i className="ri-edit-line text-xs text-primary-600"></i>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(verse.id); }} className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-rose-50 cursor-pointer">
                              <i className="ri-delete-bin-line text-xs text-rose-500"></i>
                            </button>
                          </div>
                        )}
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform duration-300 ${expandedVerse === verse.id ? 'rotate-180' : ''}`}>
                          <i className="ri-arrow-down-s-line text-foreground-500"></i>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-foreground-700 leading-relaxed italic mt-2">"{verse.verse}"</p>
                  </div>

                  <AnimatePresence>
                    {expandedVerse === verse.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 pt-0 border-t border-background-200 mx-5">
                          <div className="mt-3 pt-3">
                            <div className="flex items-center gap-1.5 mb-2">
                              <i className="ri-lightbulb-line text-xs text-amber-500"></i>
                              <span className="text-xs font-bold text-amber-700">묵상 포인트</span>
                            </div>
                            <p className="text-sm text-foreground-700 leading-relaxed">{verse.application}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}