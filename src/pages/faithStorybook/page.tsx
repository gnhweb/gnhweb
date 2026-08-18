import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

interface StoryEvent {
  id: string;
  author_id: string;
  title: string;
  description: string;
  event_type: 'baptism' | 'grace' | 'decision' | 'calling' | 'other';
  event_date: string;
  photo_url: string;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { icon: string; label: string; bg: string; textColor: string; lineColor: string }> = {
  baptism: { icon: 'ri-drop-line', label: '세례', bg: 'bg-sky-100', textColor: 'text-sky-700', lineColor: 'border-sky-300' },
  grace: { icon: 'ri-heart-line', label: '은혜', bg: 'bg-rose-100', textColor: 'text-rose-700', lineColor: 'border-rose-300' },
  decision: { icon: 'ri-check-double-line', label: '결단', bg: 'bg-amber-100', textColor: 'text-amber-700', lineColor: 'border-amber-300' },
  calling: { icon: 'ri-compass-line', label: '소명', bg: 'bg-emerald-100', textColor: 'text-emerald-700', lineColor: 'border-emerald-300' },
  other: { icon: 'ri-star-line', label: '기타', bg: 'bg-secondary-100', textColor: 'text-secondary-700', lineColor: 'border-secondary-300' },
};

export default function FaithStorybook() {
  const { user, profile } = useAuth();
  const [events, setEvents] = useState<StoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ date: '', title: '', description: '', type: 'grace' as StoryEvent['event_type'] });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({ date: '', title: '', description: '', type: 'grace' as StoryEvent['event_type'] });
  const [editUploadFile, setEditUploadFile] = useState<File | null>(null);

  useEffect(() => {
    if (user !== undefined) loadEvents();
  }, [user]);

  const loadEvents = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from('faith_storybooks')
        .select('*')
        .eq('author_id', user.id)
        .order('event_date', { ascending: true });
      if (fetchErr) throw fetchErr;
      setEvents(data || []);
    } catch {
      setError('기록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.date || !formData.title.trim() || !user || saving) return;
    setSaving(true);
    try {
      let photoUrl = '';
      if (uploadFile) {
        setUploading(true);
        const ext = uploadFile.name.split('.').pop();
        const path = `storybook/${user.id}-${Date.now()}.${ext}`;
        await supabase.storage.from('Public').upload(path, uploadFile, { upsert: true });
        const { data: urlData } = supabase.storage.from('Public').getPublicUrl(path);
        photoUrl = urlData.publicUrl;
        setUploading(false);
      }

      const { error: insertErr } = await supabase
        .from('faith_storybooks')
        .insert({
          author_id: user.id,
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          event_type: formData.type,
          event_date: formData.date,
          photo_url: photoUrl || null,
        });
      if (insertErr) throw insertErr;
      setFormData({ date: '', title: '', description: '', type: 'grace' });
      setUploadFile(null);
      setIsAdding(false);
      await loadEvents();
    } catch {
      setError('저장 중 오류가 발생했습니다.');
    }
    setUploading(false);
    setSaving(false);
  };

  const handleUpdate = async () => {
    if (!editFormData.date || !editFormData.title.trim() || !user || !editingEvent || saving) return;
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        title: editFormData.title.trim(),
        description: editFormData.description.trim() || null,
        event_type: editFormData.type,
        event_date: editFormData.date,
      };
      if (editUploadFile) {
        setUploading(true);
        const ext = editUploadFile.name.split('.').pop();
        const path = `storybook/${user.id}-${Date.now()}.${ext}`;
        await supabase.storage.from('Public').upload(path, editUploadFile, { upsert: true });
        const { data: urlData } = supabase.storage.from('Public').getPublicUrl(path);
        updates.photo_url = urlData.publicUrl;
        setUploading(false);
      }
      const { error: updateErr } = await supabase
        .from('faith_storybooks')
        .update(updates)
        .eq('id', editingEvent);
      if (updateErr) throw updateErr;
      setEditingEvent(null);
      setEditUploadFile(null);
      await loadEvents();
    } catch {
      setError('수정 중 오류가 발생했습니다.');
    }
    setUploading(false);
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      const entry = events.find(e => e.id === id);
      if (entry?.photo_url) {
        try {
          const urlObj = new URL(entry.photo_url);
          const pathParts = urlObj.pathname.split('/');
          const bucketIndex = pathParts.findIndex(p => p === 'Public');
          if (bucketIndex !== -1) {
            const storagePath = pathParts.slice(bucketIndex + 1).join('/');
            await supabase.storage.from('Public').remove([storagePath]);
          }
        } catch { /* ignore storage cleanup errors */ }
      }
      const { error: deleteErr } = await supabase.from('faith_storybooks').delete().eq('id', id);
      if (deleteErr) {
        console.error('Faith storybook delete error:', deleteErr);
        throw deleteErr;
      }
      setEvents(prev => prev.filter(e => e.id !== id));
      setEditId(null);
    } catch (err) {
      console.error('Faith storybook delete failed:', err);
      setError('삭제 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-accent-400 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-accent-100 border border-accent-200 mb-5">
              <i className="ri-bookmark-line text-3xl text-accent-600"></i>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">신앙 정체성 스토리북</h1>
            <p className="text-sm text-foreground-600">세례, 첫 은혜, 중요한 신앙의 순간들을 시간순으로 기록하는 나만의 아카이브</p>
          </div>

          {error && (
            <div className="bg-accent-100 border border-accent-200 rounded-[20px] p-4 mb-6">
              <p className="text-sm text-accent-700"><i className="ri-error-warning-line mr-1"></i>{error}</p>
              <button onClick={() => { setError(null); loadEvents(); }} className="mt-2 text-xs text-accent-600 underline cursor-pointer">다시 시도</button>
            </div>
          )}

          {user && (
            <div className="mb-6">
              <button onClick={() => setIsAdding(true)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 transition-all cursor-pointer whitespace-nowrap">
                <i className="ri-add-line"></i> 새 기록 추가
              </button>
            </div>
          )}

          <div className="relative pl-8 border-l-2 border-background-200">
            {events.map((event, idx) => {
              const config = TYPE_CONFIG[event.event_type] || TYPE_CONFIG.other;
              return (
                <motion.div key={event.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(idx * 0.05, 0.3) }} className="mb-6 relative">
                  <div className={`absolute -left-[41px] top-1 w-8 h-8 rounded-full ${config.bg} border-2 ${config.lineColor} flex items-center justify-center z-10`}>
                    <i className={`${config.icon} ${config.textColor} text-sm`}></i>
                  </div>
                  <div className="bg-background-100 border border-background-200 rounded-[20px] p-5">
                    {event.photo_url && (
                      <div className="mb-3 rounded-xl overflow-hidden bg-gray-50">
                        <img src={event.photo_url} alt={event.title} className="w-full h-auto max-h-64 object-contain" />
                      </div>
                    )}
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.bg} ${config.textColor}`}>{config.label}</span>
                      <div className="flex items-center gap-1">
                        {user && user.id === event.author_id && (
                          <button onClick={() => setEditId(editId === event.id ? null : event.id)} className="text-gray-400 hover:text-foreground-600 cursor-pointer">
                            <i className="ri-more-line text-sm"></i>
                          </button>
                        )}
                      </div>
                    </div>
                    <h3 className="text-base font-bold text-foreground-950 mb-1">{event.title}</h3>
                    <p className="text-xs text-foreground-600 mb-2">{event.event_date}</p>
                    {event.description && <p className="text-sm text-foreground-700 leading-relaxed">{event.description}</p>}
                    <AnimatePresence>
                      {editId === event.id && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <div className="mt-4 pt-3 border-t border-background-200 flex gap-2">
                            <button onClick={() => {
                              setEditId(null);
                              setEditingEvent(event.id);
                              setEditFormData({ date: event.event_date, title: event.title, description: event.description, type: event.event_type });
                            }} className="text-xs text-primary-600 hover:underline cursor-pointer">
                              <i className="ri-edit-line mr-1"></i>수정
                            </button>
                            <button onClick={() => handleDelete(event.id)} className="text-xs text-rose-600 hover:underline cursor-pointer">
                              <i className="ri-delete-bin-line mr-1"></i>삭제
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
            {events.length === 0 && (
              <div className="text-center py-10">
                <p className="text-sm text-foreground-600">아직 기록된 신앙의 순간이 없어요. 첫 기록을 추가해보세요!</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsAdding(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-background-100 rounded-[20px] border border-gray-200 p-6 max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-gray-800 mb-4">새 신앙 기록</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">날짜</label>
                  <input type="date" value={formData.date} onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))} className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 focus:border-accent-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">제목</label>
                  <input type="text" value={formData.title} onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))} placeholder="예: 첫 세례, 수련회 은혜..." maxLength={50} className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 focus:border-accent-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">사진 (선택)</label>
                  <input type="file" accept="image/*" onChange={e => setUploadFile(e.target.files?.[0] || null)} className="w-full text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">유형</label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(TYPE_CONFIG) as StoryEvent['event_type'][]).map(t => (
                      <button key={t} onClick={() => setFormData(prev => ({ ...prev, type: t }))} className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap ${formData.type === t ? TYPE_CONFIG[t].bg + ' ' + TYPE_CONFIG[t].textColor : 'bg-gray-100 text-gray-500'}`}>{TYPE_CONFIG[t].label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">내용</label>
                  <textarea value={formData.description} onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} placeholder="그날의 감동을 자세히 기록해보세요..." rows={3} maxLength={500} className="w-full px-4 py-3 text-sm rounded-xl border border-gray-200 focus:border-accent-400 outline-none resize-none" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setIsAdding(false)} className="flex-1 py-2.5 rounded-full border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">취소</button>
                  <button onClick={handleAdd} disabled={!formData.date || !formData.title.trim() || saving || uploading} className="flex-1 py-2.5 rounded-full bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap">
                    {uploading ? '업로드 중...' : saving ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingEvent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setEditingEvent(null); setEditUploadFile(null); }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-background-100 rounded-[20px] border border-gray-200 p-6 max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-gray-800 mb-4">신앙 기록 수정</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">날짜</label>
                  <input type="date" value={editFormData.date} onChange={e => setEditFormData(prev => ({ ...prev, date: e.target.value }))} className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 focus:border-accent-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">제목</label>
                  <input type="text" value={editFormData.title} onChange={e => setEditFormData(prev => ({ ...prev, title: e.target.value }))} maxLength={50} className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 focus:border-accent-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">사진 변경 (선택)</label>
                  <input type="file" accept="image/*" onChange={e => setEditUploadFile(e.target.files?.[0] || null)} className="w-full text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">유형</label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(TYPE_CONFIG) as StoryEvent['event_type'][]).map(t => (
                      <button key={t} onClick={() => setEditFormData(prev => ({ ...prev, type: t }))} className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap ${editFormData.type === t ? TYPE_CONFIG[t].bg + ' ' + TYPE_CONFIG[t].textColor : 'bg-gray-100 text-gray-500'}`}>{TYPE_CONFIG[t].label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">내용</label>
                  <textarea value={editFormData.description} onChange={e => setEditFormData(prev => ({ ...prev, description: e.target.value }))} rows={3} maxLength={500} className="w-full px-4 py-3 text-sm rounded-xl border border-gray-200 focus:border-accent-400 outline-none resize-none" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => { setEditingEvent(null); setEditUploadFile(null); }} className="flex-1 py-2.5 rounded-full border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">취소</button>
                  <button onClick={handleUpdate} disabled={!editFormData.date || !editFormData.title.trim() || saving || uploading} className="flex-1 py-2.5 rounded-full bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap">
                    {uploading ? '업로드 중...' : saving ? '저장 중...' : '수정 완료'}
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