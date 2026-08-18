import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

interface SongRequest {
  id: string;
  title: string;
  artist: string;
  requester_id: string;
  requester_name: string;
  reason: string;
  votes: number;
  status: 'pending' | 'accepted' | 'rejected';
  result_note: string;
  created_at: string;
}

export default function SongVoteBoard() {
  const { user, profile, hasRole, loading: authLoading } = useAuth();
  const [songs, setSongs] = useState<SongRequest[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', artist: '', reason: '' });
  const [showResult, setShowResult] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    loadAll();
  }, [user, authLoading]);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: songData, error: songErr } = await supabase
        .from('song_votes')
        .select('*')
        .order('votes', { ascending: false });

      if (songErr) throw songErr;
      setSongs(songData || []);

      if (user) {
        const { data: likeData } = await supabase
          .from('song_vote_likes')
          .select('song_id')
          .eq('user_id', user.id);

        if (likeData) {
          setLikedIds(new Set(likeData.map(l => l.song_id)));
        }
      }
    } catch {
      setError('데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (songId: string) => {
    if (!user) return;

    const isLiked = likedIds.has(songId);
    const newLiked = new Set(likedIds);
    const delta = isLiked ? -1 : 1;

    if (isLiked) newLiked.delete(songId); else newLiked.add(songId);
    setLikedIds(newLiked);
    setSongs(prev => prev.map(s => s.id === songId ? { ...s, votes: s.votes + delta } : s));

    try {
      if (isLiked) {
        await supabase.from('song_vote_likes').delete().eq('song_id', songId).eq('user_id', user.id);
      } else {
        await supabase.from('song_vote_likes').insert({ song_id: songId, user_id: user.id });
      }
      await supabase.from('song_votes').update({ votes: songs.find(s => s.id === songId)!.votes + delta }).eq('id', songId);
    } catch {
      // rollback UI
      setLikedIds(isLiked ? new Set([...likedIds, songId]) : new Set([...likedIds].filter(id => id !== songId)));
      setSongs(prev => prev.map(s => s.id === songId ? { ...s, votes: s.votes - delta } : s));
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.artist.trim() || !profile || !user || submitting) return;
    setSubmitting(true);
    try {
      const { data, error: insertErr } = await supabase
        .from('song_votes')
        .insert({
          title: formData.title.trim(),
          artist: formData.artist.trim(),
          requester_id: user.id,
          requester_name: profile.name,
          reason: formData.reason.trim(),
          votes: 1,
          status: 'pending',
        })
        .select('*')
        .single();

      if (insertErr) throw insertErr;

      if (data) {
        await supabase.from('song_vote_likes').insert({ song_id: data.id, user_id: user.id });
        setSongs(prev => [data as SongRequest, ...prev]);
        setLikedIds(prev => new Set([...prev, data.id]));
      }
      setFormData({ title: '', artist: '', reason: '' });
      setShowForm(false);
    } catch {
      setError('신청 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const isEditor = user && hasRole('teacher');
  const isChief = hasRole('chief');
  const canManage = user && (hasRole('teacher') || hasRole('chief'));

  const handleAccept = async (songId: string, result: string) => {
    try {
      const { error: updateErr } = await supabase
        .from('song_votes')
        .update({ status: 'accepted', result_note: result })
        .eq('id', songId);

      if (updateErr) throw updateErr;

      setSongs(prev => prev.map(s => s.id === songId ? { ...s, status: 'accepted' as const, result_note: result } : s));
    } catch {
      setError('채택 처리 중 오류가 발생했습니다.');
    }
    setShowResult(null);
  };

  const handleCancelAccept = async (songId: string) => {
    try {
      const { error: updateErr } = await supabase
        .from('song_votes')
        .update({ status: 'pending', result_note: null })
        .eq('id', songId);

      if (updateErr) throw updateErr;

      setSongs(prev => prev.map(s => s.id === songId ? { ...s, status: 'pending' as const, result_note: '' } : s));
    } catch {
      setError('채택 취소 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteSong = async (songId: string) => {
    if (!confirm('정말 이 곡을 삭제할까요?')) return;
    try {
      // Delete all likes first
      await supabase.from('song_vote_likes').delete().eq('song_id', songId);
      const { error: deleteErr } = await supabase.from('song_votes').delete().eq('id', songId);
      if (deleteErr) throw deleteErr;
      setSongs(prev => prev.filter(s => s.id !== songId));
      setLikedIds(prev => {
        const next = new Set(prev);
        next.delete(songId);
        return next;
      });
    } catch {
      setError('삭제 중 오류가 발생했습니다.');
    }
  };

  const canDeleteSong = (song: SongRequest) => {
    if (!user) return false;
    if (canManage) return true; // teacher/chief can delete any
    if (song.requester_id === user.id) return true; // own song
    return false;
  };

  const sorted = [...songs].sort((a, b) => b.votes - a.votes);

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-amber-100 border border-amber-200 mb-5">
              <i className="ri-music-line text-3xl text-amber-600"></i>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">찬양 신청·투표</h1>
            <p className="text-sm text-foreground-600">다음 모임에서 부르고 싶은 찬양을 신청하고 투표해주세요</p>
          </div>

          {error && (
            <div className="bg-accent-100 border border-accent-200 rounded-[20px] p-4 mb-6">
              <p className="text-sm text-accent-700 flex items-center gap-2"><i className="ri-error-warning-line"></i>{error}</p>
              <button onClick={() => { setError(null); loadAll(); }} className="mt-2 text-xs text-accent-600 underline cursor-pointer">다시 시도</button>
            </div>
          )}

          {user && (
            <div className="mb-6">
              <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-500 text-background-50 text-sm font-semibold hover:bg-amber-600 transition-all cursor-pointer whitespace-nowrap">
                <i className="ri-add-line"></i> 찬양 신청하기
              </button>
            </div>
          )}

          <div className="space-y-3">
            {sorted.map((song, idx) => (
              <motion.div key={song.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} className={`bg-background-100 border rounded-[20px] p-5 ${song.status === 'accepted' ? 'border-emerald-200' : 'border-background-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-bold text-foreground-950">{song.title}</h3>
                    <p className="text-xs text-foreground-600">{song.artist} · 신청: {song.requester_name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${song.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {song.status === 'accepted' ? '채택됨' : '투표중'}
                    </span>
                    {canManage && song.status === 'pending' && (
                      <button onClick={() => setShowResult(song.id)} className="text-xs text-emerald-600 hover:text-emerald-700 cursor-pointer">
                        <i className="ri-check-line"></i> 채택
                      </button>
                    )}
                    {canManage && song.status === 'accepted' && (
                      <button onClick={() => handleCancelAccept(song.id)} className="text-xs text-amber-600 hover:text-amber-700 cursor-pointer">
                        <i className="ri-arrow-go-back-line"></i> 취소
                      </button>
                    )}
                    {canDeleteSong(song) && (
                      <button onClick={() => handleDeleteSong(song.id)} className="text-xs text-rose-500 hover:text-rose-600 cursor-pointer ml-1">
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    )}
                  </div>
                </div>
                {song.reason && <p className="text-sm text-foreground-700 mb-3">"{song.reason}"</p>}
                {song.result_note && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-3">
                    <p className="text-xs text-emerald-700">{song.result_note}</p>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => handleVote(song.id)} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${user && likedIds.has(song.id) ? 'bg-amber-500 text-white' : 'bg-background-200 text-foreground-600 hover:bg-amber-100 hover:text-amber-700'}`}>
                      <i className={`${user && likedIds.has(song.id) ? 'ri-heart-fill' : 'ri-heart-line'}`}></i>
                      {song.votes}
                    </button>
                  </div>
                  <div className="flex -space-x-1.5">
                    {Array.from({ length: Math.min(song.votes, 5) }).map((_, i) => (
                      <div key={i} className="w-5 h-5 rounded-full bg-amber-200 border border-white"></div>
                    ))}
                    {song.votes > 5 && <span className="text-xs text-foreground-600 ml-2">+{song.votes - 5}</span>}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {songs.length === 0 && !loading && (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-[20px] bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto mb-4">
                <i className="ri-music-line text-2xl text-amber-300"></i>
              </div>
              <p className="text-sm text-foreground-600">아직 신청된 찬양이 없어요</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Add form modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-background-100 rounded-[20px] border border-gray-200 p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-gray-800 mb-4">찬양 신청</h3>
              <div className="space-y-3">
                <input type="text" value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} placeholder="찬양 제목" maxLength={50} className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:border-amber-400" />
                <input type="text" value={formData.artist} onChange={e => setFormData(p => ({ ...p, artist: e.target.value }))} placeholder="가수/팀" maxLength={30} className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:border-amber-400" />
                <textarea value={formData.reason} onChange={e => setFormData(p => ({ ...p, reason: e.target.value }))} placeholder="신청 이유 (선택)" rows={2} maxLength={200} className="w-full px-4 py-3 text-sm rounded-xl border border-gray-200 outline-none focus:border-amber-400 resize-none" />
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-full border border-gray-200 text-sm font-medium text-gray-600 cursor-pointer whitespace-nowrap">취소</button>
                  <button onClick={handleSubmit} disabled={!formData.title.trim() || !formData.artist.trim() || submitting} className="flex-1 py-2.5 rounded-full bg-amber-500 text-white text-sm font-semibold disabled:opacity-40 cursor-pointer whitespace-nowrap">{submitting ? '신청 중...' : '신청하기'}</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Accept result modal */}
      <AnimatePresence>
        {showResult && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowResult(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-background-100 rounded-[20px] p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-bold mb-3">채택 결과 메모</h3>
              <input type="text" id="resultNote" placeholder="예: 8월 둘째 주 예배에서 불렀습니다" className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none mb-4" onKeyDown={e => { if (e.key === 'Enter') { const val = (e.target as HTMLInputElement).value; handleAccept(showResult, val); }}} />
              <div className="flex gap-2">
                <button onClick={() => setShowResult(null)} className="flex-1 py-2 rounded-full border border-gray-200 text-sm cursor-pointer">취소</button>
                <button onClick={() => { const val = (document.getElementById('resultNote') as HTMLInputElement)?.value || ''; handleAccept(showResult, val); }} className="flex-1 py-2 rounded-full bg-emerald-500 text-white text-sm font-semibold cursor-pointer whitespace-nowrap">채택</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}