import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface RelayEntry {
  id: string;
  user_id: string;
  nickname: string;
  prayer_text: string;
  entry_order: number;
  created_at: string;
}

interface PrayerRelay {
  id: string;
  starter_id: string;
  title: string;
  initial_prayer: string;
  status: string;
  max_entries: number;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  } catch { return iso; }
}

export default function PrayerRelay() {
  const { user, profile, hasRole } = useAuth();
  const isEditor = user && (hasRole('teacher') || hasRole('chief'));
  const [searchParams] = useSearchParams();
  const relayId = searchParams.get('id');

  const [view, setView] = useState<'list' | 'detail' | 'create'>(relayId ? 'detail' : 'list');
  const [relays, setRelays] = useState<PrayerRelay[]>([]);
  const [activeRelay, setActiveRelay] = useState<PrayerRelay | null>(null);
  const [entries, setEntries] = useState<RelayEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [title, setTitle] = useState('');
  const [prayer, setPrayer] = useState('');
  const [isAnon, setIsAnon] = useState(false);
  const [maxEntries, setMaxEntries] = useState(20);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  // Join form
  const [joinPrayer, setJoinPrayer] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState(false);

  const loadRelays = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('prayer-relay', { body: { action: 'list', status: 'active' } });
      setRelays(data?.relays || []);
    } catch { /* */ }
    setLoading(false);
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('prayer-relay', {
        body: { action: 'detail', relayId: id },
      });
      if (data?.relay) setActiveRelay(data.relay);
      if (data?.entries) setEntries(data.entries);
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (relayId) {
      setView('detail');
      loadDetail(relayId);
    } else {
      loadRelays();
    }
  }, [relayId, loadDetail, loadRelays]);

  const handleCreate = async () => {
    if (!title.trim() || !prayer.trim()) { setCreateError('제목과 첫 기도문을 입력해주세요.'); return; }
    if (!user) { setCreateError('로그인이 필요합니다.'); return; }
    setCreateError('');
    setCreating(true);
    try {
      const nickname = isAnon ? '익명' : (profile?.name || '익명');
      const { data, error } = await supabase.functions.invoke('prayer-relay', {
        body: {
          action: 'create',
          starter_id: user.id,
          starter_nickname: nickname,
          title: title.trim(),
          initial_prayer: prayer.trim(),
          is_anonymous: isAnon,
          max_entries: maxEntries,
        },
      });
      if (error) throw new Error(error.message);
      setView('list');
      setTitle(''); setPrayer(''); setIsAnon(false); setMaxEntries(20);
      loadRelays();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : '릴레이 생성에 실패했습니다.');
    }
    setCreating(false);
  };

  const handleDelete = async (relayId: string) => {
    if (!confirm('정말 이 릴레이를 삭제할까요? 이 작업은 되돌릴 수 없습니다.')) return;
    try {
      await supabase.functions.invoke('prayer-relay', { body: { action: 'delete', relayId } });
      setView('list');
      loadRelays();
    } catch { /* */ }
  };

  const handleJoin = async () => {
    if (!joinPrayer.trim()) { setJoinError('기도문을 작성해주세요.'); return; }
    if (!user || !activeRelay) return;
    setJoining(true);
    setJoinError('');
    try {
      const nickname = activeRelay.is_anonymous ? '익명' : (profile?.name || '익명');
      const { data, error } = await supabase.functions.invoke('prayer-relay', {
        body: {
          action: 'join',
          relay_id: activeRelay.id,
          user_id: user.id,
          nickname,
          prayer_text: joinPrayer.trim(),
          starter_nickname: entries[0]?.nickname,
        },
      });
      if (error) throw new Error(error.message);
      setJoinPrayer('');
      loadDetail(activeRelay.id);

      // Send notification to relay starter
      if (activeRelay?.starter_id && activeRelay.starter_id !== user.id) {
        try {
          await supabase.from('notifications').insert({
            user_id: activeRelay.starter_id,
            type: 'prayer_relay_join',
            title: '기도 릴레이에 새 응답',
            message: `${nickname}님이 "${activeRelay.title}" 릴레이에 기도 응답을 남겼습니다.`,
            is_read: false,
            link_url: `/prayer-relay?id=${activeRelay.id}`,
          });
        } catch { /* notification non-critical */ }
      }
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : '기도 참여에 실패했습니다.');
    }
    setJoining(false);
  };

  const isAlreadyJoined = entries.some(e => e.user_id === user?.id);

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-14">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-[20px] bg-accent-100 border border-accent-200 mb-4">
            <i className="ri-hand-heart-line text-2xl text-accent-600"></i>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">기도 릴레이</h1>
          <p className="text-sm text-foreground-600">서로의 기도제목을 이어가며 함께 기도해요</p>
        </motion.div>

        {/* List View */}
        {view === 'list' && (
          <>
            <div className="text-right mb-4">
              <button
                onClick={() => setView('create')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-add-line"></i> 새 릴레이 시작
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 rounded-full border-2 border-primary-400 border-t-transparent animate-spin mx-auto mb-3"></div>
              </div>
            ) : relays.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-accent-100 flex items-center justify-center">
                  <i className="ri-heart-line text-3xl text-accent-400"></i>
                </div>
                <h3 className="text-lg font-semibold text-foreground-950 mb-2">진행 중인 릴레이가 없어요</h3>
                <p className="text-sm text-foreground-600 mb-6">첫 기도 릴레이를 시작해보세요!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {relays.map((r) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-background-100 border border-background-200 rounded-[16px] p-5 cursor-pointer hover:border-accent-300 transition-all"
                    onClick={() => { setView('detail'); loadDetail(r.id); }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-foreground-800">{r.title}</h3>
                      <div className="flex items-center gap-1.5">
                        {isEditor && (
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }} className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-rose-50 cursor-pointer">
                            <i className="ri-delete-bin-line text-xs text-rose-500"></i>
                          </button>
                        )}
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                          {r.status === 'active' ? '진행중' : r.status === 'completed' ? '완료' : '종료'}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-foreground-600 line-clamp-2 mb-2">{r.initial_prayer}</p>
                    <p className="text-xs text-foreground-500">{formatDate(r.created_at)}</p>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Detail View */}
        {view === 'detail' && activeRelay && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <button
              onClick={() => { setView('list'); setActiveRelay(null); }}
              className="flex items-center gap-2 text-foreground-600 hover:text-foreground-950 mb-6 group cursor-pointer"
            >
              <i className="ri-arrow-left-line group-hover:-translate-x-1 transition-transform"></i>
              <span className="text-sm">목록으로</span>
            </button>

            <div className="bg-background-100 border border-background-200 rounded-[20px] p-6 mb-6">
              <div className="flex items-start justify-between mb-1">
                <h2 className="text-lg font-bold text-foreground-950">{activeRelay.title}</h2>
                {isEditor && (
                  <button onClick={() => handleDelete(activeRelay.id)} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-rose-50 cursor-pointer flex-shrink-0">
                    <i className="ri-delete-bin-line text-rose-500"></i>
                  </button>
                )}
              </div>
              <p className="text-xs text-foreground-500 mb-4">
                {activeRelay.is_anonymous ? '익명' : entries[0]?.nickname || '익명'}님 시작 · 최대 {activeRelay.max_entries}명
              </p>

              {/* 참여자 아바타 스택 */}
              {entries.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2.5">
                    {entries.slice(0, 6).map((entry) => (
                      <div
                        key={entry.id}
                        className="w-7 h-7 rounded-full bg-accent-100 border-2 border-background-100 flex items-center justify-center flex-shrink-0"
                        title={activeRelay.is_anonymous ? '익명' : entry.nickname}
                      >
                        <span className="text-[10px] font-bold text-accent-700">
                          {(activeRelay.is_anonymous ? '익' : entry.nickname).charAt(0)}
                        </span>
                      </div>
                    ))}
                    {entries.length > 6 && (
                      <div className="w-7 h-7 rounded-full bg-background-200 border-2 border-background-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-bold text-foreground-600">+{entries.length - 6}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-foreground-500">{entries.length}명 참여 중</span>
                </div>
              )}
            </div>

            {/* Entries */}
            <div className="space-y-3 mb-6">
              {entries.map((entry, idx) => (
                <div key={entry.id} className="bg-background-100 border border-background-200 rounded-[16px] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-accent-100 flex items-center justify-center">
                      <span className="text-xs font-bold text-accent-700">{entry.entry_order}</span>
                    </div>
                    <span className="text-xs font-semibold text-accent-700">{activeRelay.is_anonymous ? '익명' : entry.nickname}</span>
                  </div>
                  <p className="text-sm text-foreground-700 leading-relaxed">{entry.prayer_text}</p>
                </div>
              ))}
              {entries.length === 0 && <p className="text-center text-sm text-foreground-500 py-4">아직 참여자가 없어요</p>}
            </div>

            {/* Join form - only if active and not already joined */}
            {activeRelay.status === 'active' && !isAlreadyJoined && (
              <div className="bg-background-100 border border-background-200 rounded-[20px] p-5 mb-6">
                <h3 className="text-sm font-bold text-foreground-800 mb-3">이어서 기도하기</h3>
                <textarea
                  value={joinPrayer}
                  onChange={e => { setJoinPrayer(e.target.value); setJoinError(''); }}
                  placeholder="이 기도제목을 이어서 기도해주세요..."
                  maxLength={300}
                  rows={3}
                  className="w-full px-4 py-3 rounded-[13px] border border-background-200 bg-background-50 focus:border-accent-400 outline-none transition-all resize-none text-sm"
                />
                <div className="flex items-center justify-between mt-2 mb-3">
                  <span className="text-xs text-foreground-600">{joinPrayer.length}/300</span>
                </div>
                {joinError && (
                  <div className="mb-3 p-2 rounded-lg bg-accent-100 text-xs text-accent-700">{joinError}</div>
                )}
                <button
                  onClick={handleJoin}
                  disabled={joining || joinPrayer.trim().length === 0}
                  className="w-full py-2.5 rounded-full bg-accent-500 text-background-50 text-sm font-semibold hover:bg-accent-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer whitespace-nowrap"
                >
                  {joining ? '참여 중...' : '기도 이어가기 🙏'}
                </button>
              </div>
            )}

            {/* Already joined message */}
            {activeRelay.status === 'active' && isAlreadyJoined && (
              <div className="bg-accent-50 border border-accent-200 rounded-[20px] p-5 mb-6 text-center">
                <div className="w-10 h-10 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-3">
                  <i className="ri-check-double-line text-accent-600 text-lg"></i>
                </div>
                <p className="text-sm font-semibold text-accent-700">이미 참여하셨어요 🙏</p>
                <p className="text-xs text-accent-600 mt-1">하나님께서 여러분의 기도를 들으십니다</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Create View */}
        {view === 'create' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <button
              onClick={() => setView('list')}
              className="flex items-center gap-2 text-foreground-600 hover:text-foreground-950 mb-6 group cursor-pointer"
            >
              <i className="ri-arrow-left-line group-hover:-translate-x-1 transition-transform"></i>
              <span className="text-sm">목록으로</span>
            </button>

            <div className="bg-background-100 border border-background-200 rounded-[20px] p-6">
              <h2 className="text-lg font-bold text-foreground-950 mb-4">새 기도 릴레이 시작</h2>
              <div className="mb-4">
                <label className="block text-xs font-medium text-foreground-600 mb-1.5">기도제목</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="예) 수능 준비하는 친구들을 위해"
                  maxLength={50}
                  className="w-full px-4 py-2.5 text-sm bg-background-50 border border-background-200 rounded-xl outline-none focus:border-accent-400"
                />
              </div>
              <div className="mb-4">
                <label className="block text-xs font-medium text-foreground-600 mb-1.5">첫 기도문</label>
                <textarea
                  value={prayer}
                  onChange={e => setPrayer(e.target.value)}
                  placeholder="첫 기도를 시작해주세요..."
                  maxLength={300}
                  rows={4}
                  className="w-full px-4 py-3 rounded-[13px] border border-background-200 bg-background-50 focus:border-accent-400 outline-none resize-none text-sm"
                />
              </div>
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  id="anon"
                  checked={isAnon}
                  onChange={e => setIsAnon(e.target.checked)}
                  className="rounded cursor-pointer"
                />
                <label htmlFor="anon" className="text-xs text-foreground-600 cursor-pointer">익명으로 참여하기</label>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-medium text-foreground-600 mb-1.5">최대 참여 인원: {maxEntries}명</label>
                <input
                  type="range"
                  min={5}
                  max={50}
                  step={5}
                  value={maxEntries}
                  onChange={e => setMaxEntries(parseInt(e.target.value))}
                  className="w-full accent-primary-500 cursor-pointer"
                />
                <div className="flex justify-between text-xs text-foreground-500 mt-1">
                  <span>5명</span>
                  <span>50명</span>
                </div>
              </div>
              {createError && (
                <div className="mb-4 p-3 rounded-xl bg-accent-100 border border-accent-200 text-sm text-accent-700">{createError}</div>
              )}
              <button
                onClick={handleCreate}
                disabled={creating}
                className="w-full py-3 rounded-full bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer whitespace-nowrap"
              >
                {creating ? '생성 중...' : '릴레이 시작하기'}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}