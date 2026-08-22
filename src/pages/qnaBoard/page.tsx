import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { CLUB_LABELS } from '@/types/auth';
import type { ClubType } from '@/types/auth';
import { formatDateKey } from '@/lib/date';

interface Question {
  id: string;
  author_id: string;
  question: string;
  answer?: string;
  answer_author?: string;
  answered_at?: string;
  created_at: string;
}

const ALL_CLUBS: ClubType[] = ['saeullim', 'cheonjipoong', 'cheonjihu', 'munhwabu', 'cheonhwarae_cheongmyeong'];

export default function QandABoard() {
  const { user, profile, hasRole, assignedTeacherClub } = useAuth();
  const isTeacher = user && (hasRole('teacher') || hasRole('chief'));
  const isChief = hasRole('chief');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newQuestion, setNewQuestion] = useState('');
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Edit/Delete for own question
  const [editingQId, setEditingQId] = useState<string | null>(null);
  const [editQText, setEditQText] = useState('');
  const [deletingQId, setDeletingQId] = useState<string | null>(null);

  // Teacher club filter
  const [teacherClubFilter, setTeacherClubFilter] = useState<ClubType | 'all'>('all');
  const [clubMemberIds, setClubMemberIds] = useState<Set<string>>(new Set());

  useEffect(() => { loadQuestions(); }, []);

  // Fetch club member IDs for teacher filtering
  useEffect(() => {
    if (!isTeacher || !assignedTeacherClub) return;
    const fetchClubMembers = async () => {
      const targetClub = isChief ? teacherClubFilter : assignedTeacherClub;
      if (!targetClub || targetClub === 'all') {
        setClubMemberIds(new Set());
        return;
      }
      try {
        const { data } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('club', targetClub);
        if (data) {
          setClubMemberIds(new Set(data.map((d: { user_id: string }) => d.user_id)));
        }
      } catch { /* ignore */ }
    };
    fetchClubMembers();
  }, [isTeacher, assignedTeacherClub, teacherClubFilter, isChief]);

  const loadQuestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('qna_questions')
        .select('*')
        .order('created_at', { ascending: false });
      if (fetchErr) throw fetchErr;
      setQuestions((data as Question[]) || []);
    } catch {
      setError('질문을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitQuestion = async () => {
    if (!newQuestion.trim() || !user || submitting) return;
    setSubmitting(true);
    try {
      const { error: insertErr } = await supabase
        .from('qna_questions')
        .insert({ author_id: user.id, question: newQuestion.trim() });
      if (insertErr) throw insertErr;
      setNewQuestion('');
      await loadQuestions();
    } catch {
      setError('질문 등록 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitAnswer = async (qId: string) => {
    if (!answerText.trim() || !profile) return;
    try {
      const { error: updateErr } = await supabase
        .from('qna_questions')
        .update({
          answer: answerText.trim(),
          answer_author: profile.name,
          answer_author_id: user!.id,
          answered_at: new Date().toISOString(),
        })
        .eq('id', qId);
      if (updateErr) throw updateErr;

      // Send notification to question author
      const question = questions.find(q => q.id === qId);
      if (question?.author_id) {
        try {
          await supabase.from('notifications').insert({
            user_id: question.author_id,
            type: 'qna_answer',
            title: '질문에 답변이 달렸어요',
            message: `${profile.name} 님이 내 질문에 답변을 달았습니다.`,
            is_read: false,
            link_url: '/qna-board',
          });
        } catch { /* notification non-critical */ }
      }

      setAnsweringId(null);
      setAnswerText('');
      await loadQuestions();
    } catch {
      setError('답변 등록 중 오류가 발생했습니다.');
    }
  };

  const handleEditQuestion = async (qId: string) => {
    if (!editQText.trim() || !user) return;
    try {
      const { error: updateErr } = await supabase
        .from('qna_questions')
        .update({ question: editQText.trim() })
        .eq('id', qId)
        .eq('author_id', user.id);
      if (updateErr) throw updateErr;
      setEditingQId(null);
      setEditQText('');
      await loadQuestions();
    } catch {
      setError('질문 수정 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (!confirm('정말 이 질문을 삭제할까요?')) return;
    if (!user) return;
    const question = questions.find(q => q.id === qId);
    if (!question || !canDeleteQuestion(question.author_id)) return;
    try {
      let query = supabase.from('qna_questions').delete().eq('id', qId);
      if (!isTeacher) {
        query = query.eq('author_id', user.id);
      } else if (assignedTeacherClub && assignedTeacherClub !== 'all') {
        // 같은 동아리 학생 것만 삭제 가능
        query = query.eq('id', qId); // clubMemberIds로 이미 필터링됨
      }
      const { error: deleteErr } = await query;
      if (deleteErr) throw deleteErr;
      await loadQuestions();
    } catch {
      setError('질문 삭제 중 오류가 발생했습니다.');
    }
  };

  const canEditQuestion = (authorId: string) => {
    if (!user) return false;
    if (isTeacher) {
      // 교사/부장은 같은 동아리 학생의 질문만 수정 가능
      if (!assignedTeacherClub || assignedTeacherClub === 'all') return true; // 부장은 전체 가능
      // 담당 동아리 학생인지 확인
      return clubMemberIds.has(authorId);
    }
    return authorId === user.id;
  };

  const canDeleteQuestion = (authorId: string) => {
    if (!user) return false;
    if (isTeacher) {
      if (!assignedTeacherClub || assignedTeacherClub === 'all') return true;
      return clubMemberIds.has(authorId);
    }
    return authorId === user.id;
  };

  // Apply club filter for teacher view
  const getFilteredQuestions = (list: Question[]) => {
    if (!isTeacher) return list;
    const targetClub = isChief ? teacherClubFilter : assignedTeacherClub;
    if (!targetClub || targetClub === 'all' || clubMemberIds.size === 0) return list;
    return list.filter(q => clubMemberIds.has(q.author_id));
  };

  const unanswered = getFilteredQuestions(questions.filter(q => !q.answer));
  const answered = getFilteredQuestions(questions.filter(q => q.answer));

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
              <i className="ri-question-answer-line text-3xl text-accent-600"></i>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">질문 있어요</h1>
            <p className="text-sm text-foreground-600">신앙과 신학에 대한 궁금증을 익명으로 질문하고, 교사/부장님의 답변을 받아보세요</p>
          </div>

          {error && (
            <div className="bg-accent-100 border border-accent-200 rounded-[20px] p-4 mb-6">
              <p className="text-sm text-accent-700 flex items-center gap-2"><i className="ri-error-warning-line"></i>{error}</p>
              <button onClick={() => { setError(null); loadQuestions(); }} className="mt-2 text-xs text-accent-600 underline cursor-pointer">다시 시도</button>
            </div>
          )}

          {/* Teacher club filter */}
          {isTeacher && assignedTeacherClub && (
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              <span className="text-xs text-foreground-600 mr-1">질문 보기:</span>
              <div className="flex items-center gap-1 bg-background-100 border border-background-200 rounded-full p-1">
                <button
                  onClick={() => setTeacherClubFilter('all')}
                  className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${teacherClubFilter === 'all' ? 'bg-accent-100 text-accent-700' : 'text-foreground-600 hover:text-foreground-950'}`}
                >
                  전체
                </button>
                {isChief ? (
                  ALL_CLUBS.map(c => (
                    <button
                      key={c}
                      onClick={() => setTeacherClubFilter(c)}
                      className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${teacherClubFilter === c ? 'bg-accent-100 text-accent-700' : 'text-foreground-600 hover:text-foreground-950'}`}
                    >
                      {CLUB_LABELS[c].split(' ')[0]}
                    </button>
                  ))
                ) : (
                  <button
                    onClick={() => setTeacherClubFilter(assignedTeacherClub as ClubType)}
                    className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${teacherClubFilter === assignedTeacherClub ? 'bg-accent-100 text-accent-700' : 'text-foreground-600 hover:text-foreground-950'}`}
                  >
                    {CLUB_LABELS[assignedTeacherClub as ClubType]?.split(' ')[0]}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Question form */}
          {user && (
            <div className="bg-background-100 border border-background-200 rounded-[20px] p-5 mb-8">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-accent-100 flex items-center justify-center">
                  <i className="ri-shield-user-line text-accent-600 text-xs"></i>
                </div>
                <span className="text-xs font-bold text-accent-700">익명 질문</span>
              </div>
              <textarea
                value={newQuestion}
                onChange={e => setNewQuestion(e.target.value)}
                placeholder="신앙이나 신학에 대해 궁금한 점을 자유롭게 질문해주세요. 모든 질문은 익명으로 게시됩니다."
                rows={3}
                maxLength={300}
                className="w-full px-4 py-3 text-sm rounded-[13px] border border-background-200 bg-background-50 focus:border-accent-400 outline-none resize-none"
              />
              <div className="flex items-center justify-end mt-2">
                <button
                  onClick={handleSubmitQuestion}
                  disabled={!newQuestion.trim() || submitting}
                  className="px-5 py-2.5 rounded-full bg-accent-500 text-background-50 text-sm font-semibold hover:bg-accent-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                >
                  {submitting ? '등록 중...' : '익명으로 질문하기'}
                </button>
              </div>
            </div>
          )}

          {/* Answered questions */}
          {answered.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-bold text-emerald-700 flex items-center gap-2 mb-4">
                <i className="ri-check-double-line"></i> 답변 완료된 질문
              </h2>
              <div className="space-y-4">
                {answered.map((q, idx) => (
                  <motion.div key={q.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.05, 0.3) }} className="bg-background-100 border border-emerald-200 rounded-[20px] overflow-hidden">
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-full bg-accent-100 flex items-center justify-center">
                          <i className="ri-question-mark text-accent-600 text-xs"></i>
                        </div>
                        <span className="text-xs text-accent-600 font-medium">익명 · {formatDateKey(q.created_at)}</span>
                        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">답변 완료</span>
                        {canEditQuestion(q.author_id) && (
                          <button onClick={(e) => { e.preventDefault(); setEditingQId(q.id); setEditQText(q.question); }} className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full text-gray-400 hover:text-foreground-600 hover:bg-background-200 cursor-pointer">
                            <i className="ri-edit-line text-sm"></i>
                          </button>
                        )}
                        {canDeleteQuestion(q.author_id) && (
                          <button onClick={(e) => { e.preventDefault(); handleDeleteQuestion(q.id); }} className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full text-gray-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer">
                            <i className="ri-delete-bin-line text-sm"></i>
                          </button>
                        )}
                      </div>
                      {editingQId === q.id ? (
                        <div className="mb-3">
                          <input
                            type="text"
                            value={editQText}
                            onChange={e => setEditQText(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleEditQuestion(q.id); if (e.key === 'Escape') setEditingQId(null); }}
                            className="w-full px-3 py-2 text-sm rounded-xl border border-accent-300 bg-accent-50 focus:border-accent-400 outline-none"
                            autoFocus
                          />
                          <div className="flex items-center gap-2 mt-1.5">
                            <button onClick={() => setEditingQId(null)} className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer">취소</button>
                            <button onClick={() => handleEditQuestion(q.id)} className="text-xs text-accent-600 font-medium cursor-pointer whitespace-nowrap">저장</button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-foreground-800 font-medium leading-relaxed mb-4">{q.question}</p>
                      )}
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-full bg-emerald-200 flex items-center justify-center">
                            <i className="ri-user-star-line text-emerald-700 text-xs"></i>
                          </div>
                          <span className="text-xs font-bold text-emerald-700">{q.answer_author}</span>
                          {q.answered_at && <span className="text-xs text-emerald-600">{formatDateKey(q.answered_at)}</span>}
                        </div>
                        <p className="text-sm text-emerald-800 leading-relaxed">{q.answer}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Unanswered questions */}
          {unanswered.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-foreground-700 flex items-center gap-2 mb-4">
                <i className="ri-time-line"></i> 답변을 기다리는 질문
              </h2>
              <div className="space-y-3">
                {unanswered.map((q, idx) => (
                  <motion.div key={q.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.05, 0.3) }} className="bg-background-100 border border-background-200 rounded-[20px] p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-full bg-accent-100 flex items-center justify-center">
                        <i className="ri-question-mark text-accent-600 text-xs"></i>
                      </div>
                      <span className="text-xs text-accent-600 font-medium">익명 · {formatDateKey(q.created_at)}</span>
                      <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">답변 대기</span>
                      {canEditQuestion(q.author_id) && (
                        <button onClick={(e) => { e.preventDefault(); setEditingQId(q.id); setEditQText(q.question); }} className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full text-gray-400 hover:text-foreground-600 hover:bg-background-200 cursor-pointer">
                          <i className="ri-edit-line text-sm"></i>
                        </button>
                      )}
                      {canDeleteQuestion(q.author_id) && (
                        <button onClick={(e) => { e.preventDefault(); handleDeleteQuestion(q.id); }} className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full text-gray-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer">
                          <i className="ri-delete-bin-line text-sm"></i>
                        </button>
                      )}
                    </div>
                    {editingQId === q.id ? (
                      <div className="mb-3">
                        <input
                          type="text"
                          value={editQText}
                          onChange={e => setEditQText(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleEditQuestion(q.id); if (e.key === 'Escape') setEditingQId(null); }}
                          className="w-full px-3 py-2 text-sm rounded-xl border border-accent-300 bg-accent-50 focus:border-accent-400 outline-none"
                          autoFocus
                        />
                        <div className="flex items-center gap-2 mt-1.5">
                          <button onClick={() => setEditingQId(null)} className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer">취소</button>
                          <button onClick={() => handleEditQuestion(q.id)} className="text-xs text-accent-600 font-medium cursor-pointer whitespace-nowrap">저장</button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground-800 font-medium leading-relaxed">{q.question}</p>
                    )}

                    {isTeacher && answeringId === q.id && (
                      <div className="mt-4 pt-4 border-t border-background-200">
                        <textarea
                          value={answerText}
                          onChange={e => setAnswerText(e.target.value)}
                          placeholder="답변을 작성해주세요..."
                          rows={3}
                          maxLength={500}
                          className="w-full px-4 py-3 text-sm rounded-[13px] border border-emerald-200 bg-emerald-50 focus:border-emerald-400 outline-none resize-none"
                        />
                        <div className="flex items-center gap-2 mt-2">
                          <button onClick={() => { setAnsweringId(null); setAnswerText(''); }} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 cursor-pointer">취소</button>
                          <button onClick={() => handleSubmitAnswer(q.id)} disabled={!answerText.trim()} className="px-4 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 disabled:opacity-40 cursor-pointer whitespace-nowrap">답변 등록</button>
                        </div>
                      </div>
                    )}

                    {isTeacher && answeringId !== q.id && (
                      <button onClick={() => setAnsweringId(q.id)} className="mt-3 text-xs text-emerald-600 hover:text-emerald-700 font-medium cursor-pointer">
                        <i className="ri-reply-line mr-1"></i> 답변하기
                      </button>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {questions.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-accent-50 flex items-center justify-center mx-auto mb-4">
                <i className="ri-question-line text-2xl text-accent-300"></i>
              </div>
              <p className="text-sm text-foreground-600">아직 질문이 없어요. 첫 질문을 남겨보세요!</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}