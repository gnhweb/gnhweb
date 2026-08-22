import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { todayKey } from '@/lib/date';

interface SeniorStudent {
  user_id: string;
  name: string;
  club: string | null;
}

interface RollingPaper {
  id: string;
  target_user_id: string;
  target_name: string;
  author_id: string;
  author_name: string;
  is_anonymous: boolean;
  content: string;
  reveal_date: string;
  created_at: string;
}

export default function SeniorRollingPaper() {
  const { user, profile, hasRole } = useAuth();
  const isTeacherOrChief = hasRole('teacher') || hasRole('chief');

  const [seniors, setSeniors] = useState<SeniorStudent[]>([]);
  const [selectedSenior, setSelectedSenior] = useState<SeniorStudent | null>(null);
  const [papers, setPapers] = useState<RollingPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWrite, setShowWrite] = useState(false);

  // Write form
  const [writeContent, setWriteContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [revealDate, setRevealDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSeniors();
  }, []);

  useEffect(() => {
    if (selectedSenior) {
      loadPapers(selectedSenior.user_id);
    }
  }, [selectedSenior]);

  const loadSeniors = async () => {
    try {
      const { data } = await supabase.from('user_roles').select('user_id,name,club').or('grade.eq.고3,graduation_expected.eq.true').order('name');
      setSeniors((data || []) as SeniorStudent[]);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const loadPapers = async (targetId: string) => {
    try {
      const { data } = await supabase.from('senior_rolling_papers').select('*').eq('target_user_id', targetId).order('created_at', { ascending: false });
      setPapers((data || []) as RollingPaper[]);
    } catch { /* ignore */ }
  };

  const handleSubmit = async () => {
    if (!writeContent.trim() || !selectedSenior || !revealDate || !user) return;
    setSaving(true);
    setError(null);
    try {
      const { error: insertErr } = await supabase.from('senior_rolling_papers').insert({
        target_user_id: selectedSenior.user_id,
        target_name: selectedSenior.name,
        author_id: user.id,
        author_name: isAnonymous ? '익명' : (profile?.name || '익명'),
        is_anonymous: isAnonymous,
        content: writeContent.trim(),
        reveal_date: revealDate,
      });
      if (insertErr) throw insertErr;
      setShowWrite(false);
      setWriteContent('');
      loadPapers(selectedSenior.user_id);
    } catch {
      setError('저장 중 오류가 발생했습니다.');
    }
    setSaving(false);
  };

  const handleDelete = async (paperId: string) => {
    await supabase.from('senior_rolling_papers').delete().eq('id', paperId);
    if (selectedSenior) loadPapers(selectedSenior.user_id);
  };

  const canViewPaper = (paper: RollingPaper) => {
    const today = todayKey();
    if (paper.reveal_date <= today) return true;
    if (paper.author_id === user?.id) return true;
    if (paper.target_user_id === user?.id && paper.reveal_date <= today) return true;
    return false;
  };

  const isLocked = (paper: RollingPaper) => {
    const today = todayKey();
    return paper.reveal_date > today;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-violet-400 border-t-transparent animate-spin"></div>
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
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-gradient-to-br from-violet-100 to-purple-100 border border-violet-200 mb-5">
              <i className="ri-message-3-line text-3xl text-violet-600"></i>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">온라인 롤링페이퍼</h1>
            <p className="text-sm text-foreground-600">고3 친구들에게 마음을 담은 편지를 남겨보세요</p>
          </div>

          {!selectedSenior ? (
            <div>
              <p className="text-sm text-foreground-600 mb-4 text-center">편지를 남길 고3 학생을 선택해주세요</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {seniors.map(s => (
                  <motion.button
                    key={s.user_id}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setSelectedSenior(s)}
                    className="bg-background-100 border-0 md:border md:border-violet-200 rounded-[20px] md:rounded-2xl shadow-card md:shadow-none p-4 text-center hover:border-violet-400 hover:bg-violet-50 transition-all cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-400 to-secondary-400 md:bg-none md:bg-violet-100 flex items-center justify-center mx-auto mb-2">
                      <span className="text-base font-bold text-white md:text-violet-600">{s.name.charAt(0)}</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground-950">{s.name}</p>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <button onClick={() => setSelectedSenior(null)} className="w-8 h-8 rounded-full bg-background-100 flex items-center justify-center cursor-pointer hover:bg-background-200 transition-colors">
                    <i className="ri-arrow-left-line"></i>
                  </button>
                  <div>
                    <h2 className="text-lg font-bold text-foreground-950">{selectedSenior.name}님의 롤링페이퍼</h2>
                    <p className="text-xs text-foreground-600">총 {papers.length}개의 편지</p>
                  </div>
                </div>
                <button onClick={() => setShowWrite(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-violet-500 text-white text-sm font-semibold hover:bg-violet-600 cursor-pointer whitespace-nowrap">
                  <i className="ri-quill-pen-line"></i> 편지 쓰기
                </button>
              </div>

              {papers.length === 0 ? (
                <div className="text-center py-16 bg-background-100 border border-background-200 rounded-2xl">
                  <div className="w-14 h-14 rounded-xl bg-violet-100 flex items-center justify-center mx-auto mb-4">
                    <i className="ri-message-3-line text-2xl text-violet-400"></i>
                  </div>
                  <p className="text-sm text-foreground-600">아직 도착한 편지가 없어요</p>
                  <button onClick={() => setShowWrite(true)} className="mt-3 text-sm text-violet-600 font-medium cursor-pointer">첫 편지 쓰기</button>
                </div>
              ) : (
                <div className="space-y-3">
                  {papers.map(paper => {
                    const canView = canViewPaper(paper);
                    const locked = isLocked(paper);

                    return (
                      <div key={paper.id} className="bg-background-100 border-0 md:border md:border-background-200 rounded-[20px] md:rounded-2xl shadow-card md:shadow-none p-5 relative group">
                        {locked && !canView ? (
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                              <i className="ri-lock-line text-violet-500"></i>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground-700">🔒 잠긴 편지</p>
                              <p className="text-xs text-foreground-500">{paper.reveal_date}에 공개됩니다</p>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
                                  <span className="text-xs font-bold text-violet-600">{paper.author_name.charAt(0)}</span>
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-foreground-950">{paper.author_name} {paper.is_anonymous && <span className="text-xs text-foreground-500 font-normal">(익명)</span>}</p>
                                  <p className="text-[11px] text-foreground-500">{new Date(paper.created_at).toLocaleDateString('ko-KR')}</p>
                                </div>
                              </div>
                              {(paper.author_id === user?.id || isTeacherOrChief) && (
                                <button onClick={() => handleDelete(paper.id)} className="md:opacity-0 md:group-hover:opacity-100 transition-opacity w-7 h-7 rounded-full flex items-center justify-center text-foreground-400 hover:text-rose-600 cursor-pointer">
                                  <i className="ri-delete-bin-line text-sm"></i>
                                </button>
                              )}
                            </div>
                            <p className="text-sm text-foreground-700 leading-relaxed whitespace-pre-wrap">{paper.content}</p>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* Write modal */}
      <AnimatePresence>
        {showWrite && selectedSenior && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowWrite(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-background-100 border border-background-200 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-foreground-950 mb-2">{selectedSenior.name}님께 편지 쓰기</h3>
              <p className="text-xs text-foreground-600 mb-4">마음을 담아 진심을 전해주세요. 공개일 전까지는 내용이 비밀로 유지됩니다.</p>

              {error && (
                <div className="bg-accent-100 border border-accent-200 rounded-xl p-3 mb-4">
                  <p className="text-xs text-accent-700">{error}</p>
                </div>
              )}

              <div className="space-y-3">
                <textarea value={writeContent} onChange={e => setWriteContent(e.target.value)} placeholder="편지 내용을 작성해주세요..." rows={6} maxLength={500} className="w-full px-4 py-3 text-sm rounded-xl border border-background-200 outline-none focus:border-violet-400 resize-none" />
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)} className="w-4 h-4 rounded accent-violet-500 cursor-pointer" />
                    <span className="text-sm text-foreground-700">익명으로 보내기</span>
                  </label>
                </div>
                <div>
                  <label className="text-xs text-foreground-600 block mb-1">공개일 지정</label>
                  <input type="date" value={revealDate} onChange={e => setRevealDate(e.target.value)} min={todayKey()} className="w-full px-4 py-2.5 text-sm rounded-xl border border-background-200 outline-none focus:border-violet-400" />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <button onClick={handleSubmit} disabled={!writeContent.trim() || !revealDate || saving} className="px-5 py-2.5 rounded-full bg-violet-500 text-white text-sm font-semibold hover:bg-violet-600 disabled:opacity-40 cursor-pointer whitespace-nowrap">
                  {saving ? '보내는 중...' : '편지 보내기'}
                </button>
                <button onClick={() => setShowWrite(false)} className="text-sm text-foreground-500 cursor-pointer">취소</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}