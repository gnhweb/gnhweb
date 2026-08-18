import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { CategoryChipRow, CategoryChip } from '@/components/base/CategoryChip';

interface Proposal {
  id: string;
  author_id: string;
  author_name: string;
  title: string;
  content: string;
  status: 'proposed' | 'adopted' | 'completed';
  vote_count: number;
  created_at: string;
}

export default function SeniorProposals() {
  const { user, profile, hasRole } = useAuth();
  const isTeacherOrChief = hasRole('teacher') || hasRole('chief');

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'votes' | 'latest'>('latest');
  const [statusFilter, setStatusFilter] = useState<'all' | 'proposed' | 'adopted' | 'completed'>('all');

  // User's votes
  const [userVotes, setUserVotes] = useState<Set<string>>(new Set());

  // CRUD
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandId, setExpandId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    if (user) loadUserVotes();
  }, [user]);

  const loadData = async () => {
    try {
      const { data } = await supabase.from('senior_proposals').select('*').order('created_at', { ascending: false });
      setProposals((data || []) as Proposal[]);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const loadUserVotes = async () => {
    if (!user) return;
    const { data } = await supabase.from('senior_proposal_votes').select('proposal_id').eq('user_id', user.id);
    setUserVotes(new Set((data || []).map((v: any) => v.proposal_id)));
  };

  const handleVote = async (proposalId: string) => {
    if (!user) return;
    const hasVoted = userVotes.has(proposalId);

    // Optimistic update
    setUserVotes(prev => {
      const next = new Set(prev);
      if (hasVoted) next.delete(proposalId);
      else next.add(proposalId);
      return next;
    });
    setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, vote_count: hasVoted ? Math.max(0, p.vote_count - 1) : p.vote_count + 1 } : p));

    try {
      if (hasVoted) {
        const { error } = await supabase.from('senior_proposal_votes').delete().eq('proposal_id', proposalId).eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('senior_proposal_votes').insert({ proposal_id: proposalId, user_id: user.id });
        if (error) throw error;
      }
      // Reload actual state from DB to ensure consistency
      await loadUserVotes();
      await loadData();
    } catch {
      // Rollback optimistic update
      setUserVotes(prev => {
        const next = new Set(prev);
        if (hasVoted) next.add(proposalId);
        else next.delete(proposalId);
        return next;
      });
      setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, vote_count: hasVoted ? p.vote_count + 1 : Math.max(0, p.vote_count - 1) } : p));
    }
  };

  const handleStatusChange = async (proposalId: string, newStatus: 'proposed' | 'adopted' | 'completed') => {
    if (!isTeacherOrChief) return;
    await supabase.from('senior_proposals').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', proposalId);
    setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, status: newStatus } : p));
  };

  const openCreate = () => {
    setEditingId(null);
    setFormTitle('');
    setFormContent('');
    setShowForm(true);
  };

  const openEdit = (p: Proposal) => {
    setEditingId(p.id);
    setFormTitle(p.title);
    setFormContent(p.content);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formContent.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await supabase.from('senior_proposals').update({
          title: formTitle.trim(),
          content: formContent.trim(),
          updated_at: new Date().toISOString(),
        }).eq('id', editingId);
      } else {
        await supabase.from('senior_proposals').insert({
          author_id: user?.id,
          author_name: profile?.name || '익명',
          title: formTitle.trim(),
          content: formContent.trim(),
          status: 'proposed',
          vote_count: 0,
        });
      }
      loadData();
      setShowForm(false);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('senior_proposals').delete().eq('id', id);
    loadData();
  };

  const filtered = proposals
    .filter(p => statusFilter === 'all' || p.status === statusFilter)
    .sort((a, b) => sortBy === 'votes' ? b.vote_count - a.vote_count : new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const statusLabel = (s: string) => {
    switch (s) {
      case 'proposed': return { text: '제안됨', cls: 'bg-amber-100 text-amber-700' };
      case 'adopted': return { text: '채택됨', cls: 'bg-emerald-100 text-emerald-700' };
      case 'completed': return { text: '완료', cls: 'bg-sky-100 text-sky-700' };
      default: return { text: s, cls: 'bg-background-100 text-foreground-600' };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-rose-400 border-t-transparent animate-spin"></div>
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
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-gradient-to-br from-rose-100 to-pink-100 border border-rose-200 mb-5">
              <i className="ri-vip-crown-line text-3xl text-rose-600"></i>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">헌신예배 제안·투표</h1>
            <p className="text-sm text-foreground-600">함께 만들어가는 헌신예배, 자유롭게 제안하고 투표하세요</p>
          </div>

          {/* ===== PC (md 이상) — 기존 툴바 그대로 ===== */}
          <div className="hidden md:flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setSortBy('latest')} className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap ${sortBy === 'latest' ? 'bg-rose-100 text-rose-700' : 'bg-background-100 text-foreground-600'}`}>최신순</button>
              <button onClick={() => setSortBy('votes')} className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap ${sortBy === 'votes' ? 'bg-rose-100 text-rose-700' : 'bg-background-100 text-foreground-600'}`}>투표순</button>
              <span className="text-foreground-400 mx-1">|</span>
              {(['all', 'proposed', 'adopted', 'completed'] as const).map(f => (
                <button key={f} onClick={() => setStatusFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap ${statusFilter === f ? 'bg-rose-100 text-rose-700' : 'bg-background-100 text-foreground-600'}`}>
                  {f === 'all' ? '전체' : f === 'proposed' ? '제안' : f === 'adopted' ? '채택' : '완료'}
                </button>
              ))}
            </div>
            <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 transition-colors cursor-pointer whitespace-nowrap">
              <i className="ri-add-line"></i> 제안하기
            </button>
          </div>

          {/* ===== 모바일 (md 미만) — 가로 스크롤 칩 + 하단 고정 느낌의 제안 버튼 ===== */}
          <div className="md:hidden mb-5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <CategoryChipRow>
                <CategoryChip active={sortBy === 'latest'} onClick={() => setSortBy('latest')}>최신순</CategoryChip>
                <CategoryChip active={sortBy === 'votes'} onClick={() => setSortBy('votes')}>투표순</CategoryChip>
              </CategoryChipRow>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={openCreate}
                className="flex-shrink-0 flex items-center gap-1 px-3.5 py-2 rounded-chip bg-gradient-to-r from-rose-500 to-accent-500 text-white text-xs font-bold whitespace-nowrap cursor-pointer"
              >
                <i className="ri-add-line"></i> 제안
              </motion.button>
            </div>
            <CategoryChipRow>
              {(['all', 'proposed', 'adopted', 'completed'] as const).map((f) => (
                <CategoryChip key={f} active={statusFilter === f} onClick={() => setStatusFilter(f)}>
                  {f === 'all' ? '전체' : f === 'proposed' ? '제안' : f === 'adopted' ? '채택' : '완료'}
                </CategoryChip>
              ))}
            </CategoryChipRow>
          </div>

          {/* Proposals list */}
          {filtered.length === 0 ? (
            <div className="text-center py-16 bg-background-100 border border-background-200 rounded-2xl">
              <div className="w-14 h-14 rounded-xl bg-rose-100 flex items-center justify-center mx-auto mb-4">
                <i className="ri-lightbulb-line text-2xl text-rose-500"></i>
              </div>
              <p className="text-sm text-foreground-600">아직 등록된 제안이 없어요</p>
              <button onClick={openCreate} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 cursor-pointer whitespace-nowrap">첫 제안하기</button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(p => (
                <div key={p.id} className="bg-background-100 border-0 md:border md:border-background-200 rounded-[20px] md:rounded-2xl shadow-card md:shadow-none overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0" onClick={() => setExpandId(expandId === p.id ? null : p.id)} style={{ cursor: 'pointer' }}>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-sm font-bold text-foreground-950">{p.title}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusLabel(p.status).cls}`}>{statusLabel(p.status).text}</span>
                        </div>
                        <p className="text-xs text-foreground-600">
                          {p.author_name} · {new Date(p.created_at).toLocaleDateString('ko-KR')}
                        </p>
                        <AnimatePresence>
                          {expandId === p.id && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                              <p className="text-sm text-foreground-700 mt-3 leading-relaxed whitespace-pre-wrap">{p.content}</p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Vote button */}
                      <motion.button
                        onClick={() => handleVote(p.id)}
                        whileTap={{ scale: 0.97 }}
                        className={`flex flex-col items-center min-w-[48px] px-3 py-2 rounded-xl transition-colors cursor-pointer ${userVotes.has(p.id) ? 'bg-rose-100 text-rose-600' : 'bg-background-100 text-foreground-500 hover:bg-rose-50 hover:text-rose-500'}`}
                      >
                        <motion.i
                          animate={userVotes.has(p.id) ? { scale: [1, 1.4, 1] } : { scale: 1 }}
                          transition={{ duration: 0.35 }}
                          className={`${userVotes.has(p.id) ? 'ri-heart-fill' : 'ri-heart-line'} text-lg`}
                        />
                        <span className="text-xs font-bold mt-0.5">{p.vote_count}</span>
                      </motion.button>
                    </div>

                    {/* Admin actions */}
                    {isTeacherOrChief && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-background-100">
                        <select
                          value={p.status}
                          onChange={e => handleStatusChange(p.id, e.target.value as any)}
                          className="text-xs px-2 py-1.5 rounded-lg border border-background-200 bg-background-100 outline-none cursor-pointer"
                        >
                          <option value="proposed">제안됨</option>
                          <option value="adopted">채택됨</option>
                          <option value="completed">완료</option>
                        </select>
                        {(user?.id === p.author_id || isTeacherOrChief) && (
                          <>
                            <button onClick={() => openEdit(p)} className="text-xs text-foreground-500 hover:text-foreground-700 cursor-pointer">수정</button>
                            <button onClick={() => handleDelete(p.id)} className="text-xs text-rose-500 hover:text-rose-700 cursor-pointer">삭제</button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Form modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-background-100 border border-background-200 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-foreground-950 mb-4">{editingId ? '제안 수정' : '새 제안 작성'}</h3>
              <div className="space-y-3">
                <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="제목" maxLength={100} className="w-full px-4 py-2.5 text-sm rounded-xl border border-background-200 outline-none focus:border-rose-400" />
                <textarea value={formContent} onChange={e => setFormContent(e.target.value)} placeholder="내용을 자세히 작성해주세요" rows={5} maxLength={1000} className="w-full px-4 py-2.5 text-sm rounded-xl border border-background-200 outline-none focus:border-rose-400 resize-none" />
              </div>
              <div className="flex items-center gap-2 mt-4">
                <button onClick={handleSave} disabled={!formTitle.trim() || !formContent.trim() || saving} className="px-5 py-2.5 rounded-full bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 disabled:opacity-40 cursor-pointer whitespace-nowrap">
                  {saving ? '저장 중...' : editingId ? '수정하기' : '제안하기'}
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