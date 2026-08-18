import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

interface BucketItem {
  id: string;
  author_id: string;
  author_name: string;
  content: string;
  likes: number;
  created_at: string;
}

export default function BucketListBoard() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<BucketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const [newItem, setNewItem] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    if (user !== undefined) loadAll();
  }, [user]);

  const loadAll = async () => {
    setLoading(true);
    try {
      // Only load own items - bucket list is now private
      const { data, error: fetchErr } = await supabase
        .from('bucket_list_items')
        .select('*')
        .eq('author_id', user?.id)
        .order('created_at', { ascending: false });
      if (fetchErr) throw fetchErr;
      setItems(data || []);

      if (user) {
        const { data: likeData } = await supabase
          .from('bucket_list_likes')
          .select('item_id')
          .eq('user_id', user.id);

        if (likeData) {
          setLikedIds(new Set(likeData.map(l => l.item_id)));
        }
      }
    } catch {
      setError('데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newItem.trim() || !profile || submitting) return;
    setSubmitting(true);
    try {
      const { error: insertErr } = await supabase
        .from('bucket_list_items')
        .insert({ author_id: user!.id, author_name: profile.name, content: newItem.trim() });
      if (insertErr) throw insertErr;
      setNewItem('');
      await loadAll();
    } catch {
      setError('등록 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (item: BucketItem) => {
    if (!user) return;

    const isLiked = likedIds.has(item.id);
    const newLiked = new Set(likedIds);
    const delta = isLiked ? -1 : 1;

    if (isLiked) newLiked.delete(item.id); else newLiked.add(item.id);
    setLikedIds(newLiked);

    const newLikes = item.likes + delta;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, likes: newLikes } : i));

    try {
      if (isLiked) {
        await supabase.from('bucket_list_likes').delete().eq('item_id', item.id).eq('user_id', user.id);
      } else {
        await supabase.from('bucket_list_likes').insert({ item_id: item.id, user_id: user.id });
      }
      await supabase.from('bucket_list_items').update({ likes: newLikes }).eq('id', item.id);
    } catch {
      // rollback
      setLikedIds(isLiked ? new Set([...likedIds, item.id]) : new Set([...likedIds].filter(id => id !== item.id)));
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, likes: item.likes } : i));
    }
  };

  const handleStartEdit = (item: BucketItem) => {
    setEditingId(item.id);
    setEditContent(item.content);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim() || !editingId) return;
    try {
      await supabase.from('bucket_list_items').update({ content: editContent.trim() }).eq('id', editingId);
      setItems(prev => prev.map(i => i.id === editingId ? { ...i, content: editContent.trim() } : i));
    } catch {
      setError('수정 중 오류가 발생했습니다.');
    }
    setEditingId(null);
    setEditContent('');
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm('이 버킷리스트 항목을 삭제할까요?')) return;
    try {
      await supabase.from('bucket_list_items').delete().eq('id', itemId);
      setItems(prev => prev.filter(i => i.id !== itemId));
    } catch {
      setError('삭제 중 오류가 발생했습니다.');
    }
  };

  const isOwnItem = (item: BucketItem) => profile && item.author_id === profile.user_id;

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-emerald-100 border border-emerald-200 mb-5">
              <i className="ri-todo-line text-3xl text-emerald-600"></i>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">버킷리스트 무드보드</h1>
            <p className="text-sm text-foreground-600">올해 학생회에서 하고 싶은 것을 자유롭게 적고 관리하는 개인 공간이에요</p>
          </div>

          {error && (
            <div className="bg-accent-100 border border-accent-200 rounded-[20px] p-4 mb-6">
              <p className="text-sm text-accent-700 flex items-center gap-2"><i className="ri-error-warning-line"></i>{error}</p>
              <button onClick={() => { setError(null); loadAll(); }} className="mt-2 text-xs text-accent-600 underline cursor-pointer">다시 시도</button>
            </div>
          )}

          {user && (
            <div className="bg-background-100 border border-background-200 rounded-[20px] p-4 mb-6">
              <div className="flex gap-2">
                <input type="text" value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }} placeholder="올해 꼭 해보고 싶은 것..." maxLength={100} className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:border-emerald-400" />
                <button onClick={handleAdd} disabled={!newItem.trim() || submitting} className="px-4 py-2.5 rounded-full bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 disabled:opacity-40 cursor-pointer whitespace-nowrap">{submitting ? '등록 중...' : '등록'}</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {items.map((item, idx) => (
              <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx, 10) * 0.05 }} className="bg-background-100 border border-background-200 rounded-[20px] p-4 hover:border-emerald-300 transition-colors">
                <p className="text-sm text-foreground-800 leading-relaxed mb-3">
                  {editingId === item.id ? (
                    <input
                      type="text"
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-emerald-300 outline-none focus:border-emerald-500"
                      autoFocus
                    />
                  ) : (
                    item.content
                  )}
                </p>
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-emerald-600">{item.author_name.charAt(0)}</span>
                    </div>
                    <span className="text-xs text-foreground-600 truncate">{item.author_name}</span>
                  </div>
                  <motion.button
                    onClick={() => handleLike(item)}
                    whileTap={{ scale: 1.3 }}
                    animate={likedIds.has(item.id) ? { scale: [1, 1.35, 1] } : { scale: 1 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className={`flex items-center gap-1 text-xs cursor-pointer flex-shrink-0 ${likedIds.has(item.id) ? 'text-rose-500' : 'text-gray-400'}`}
                  >
                    <i className={likedIds.has(item.id) ? 'ri-heart-fill' : 'ri-heart-line'}></i>
                    {item.likes}
                  </motion.button>
                </div>
                {(isOwnItem(item) || editingId === item.id) && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-background-200">
                    {editingId === item.id ? (
                      <>
                        <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">취소</button>
                        <button onClick={handleSaveEdit} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium cursor-pointer whitespace-nowrap">저장</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleStartEdit(item)} className="text-xs text-gray-400 hover:text-emerald-600 cursor-pointer">
                          <i className="ri-edit-line"></i> 수정
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="text-xs text-gray-400 hover:text-rose-600 cursor-pointer">
                          <i className="ri-delete-bin-line"></i> 삭제
                        </button>
                      </>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {items.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-[20px] bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-4">
                <i className="ri-todo-line text-2xl text-emerald-300"></i>
              </div>
              <p className="text-sm text-foreground-600">아직 등록된 버킷리스트가 없어요</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}