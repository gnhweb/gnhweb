import { formatKoreanDate, formatKoreanDateTime } from '@/lib/date';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { clubs } from '@/mocks/clubs';
import { ROLE_HIERARCHY } from '@/types/auth';
import type { UserRole } from '@/types/auth';

interface Suggestion {
  id: string;
  author_id: string;
  author_name: string | null;
  club: string;
  title: string;
  content: string;
  status: string;
  response: string | null;
  is_anonymous?: boolean;
  created_at: string;
  updated_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: '검토 중',
  reviewed: '검토 완료',
  responded: '답변 완료',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-primary-100 text-primary-700',
  reviewed: 'bg-emerald-100 text-emerald-700',
  responded: 'bg-secondary-100 text-secondary-700',
};

export default function SuggestionsPage() {
  const { profile } = useAuth();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  const formRef = useRef<HTMLDivElement>(null);

  const role = profile?.role as UserRole;
  const isTeacherOrAbove = ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.teacher;
  const isMember = role === 'member';
  const canViewAll = ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.teacher; // 교사, 부장

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('suggestions')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setSuggestions((data as Suggestion[]) || []);
    } catch {
      setError('건의사항을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !profile) return;

    setSubmitting(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) throw new Error('로그인 정보가 없습니다');

      const { error: insertError } = await supabase
        .from('suggestions')
        .insert({
          author_id: userId,
          author_name: isAnonymous ? null : profile.name,
          club: profile.club || null,
          title: title.trim(),
          content: content.trim(),
          status: 'pending',
          is_anonymous: isAnonymous,
        });

      if (insertError) throw insertError;

      setTitle('');
      setContent('');
      setIsAnonymous(false);
      setShowForm(false);
      setSuccessMsg('건의사항이 제출되었습니다. 검토 후 답변 드리겠습니다.');
      setTimeout(() => setSuccessMsg(null), 3500);
      await fetchSuggestions();
    } catch {
      setError('제출 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRespond = async (suggestionId: string) => {
    if (!responseText.trim() || !profile) return;
    const suggestion = suggestions.find((item) => item.id === suggestionId);
    if (!suggestion) return;

    const isResponseEdit = Boolean(suggestion.response);
    try {
      const { error: updateError } = await supabase
        .from('suggestions')
        .update({
          response: responseText.trim(),
          status: 'responded',
          updated_at: new Date().toISOString(),
        })
        .eq('id', suggestionId);

      if (updateError) throw updateError;

      // 답변 등록/수정 사실을 건의사항 작성자에게 알린다.
      // 알림 실패가 답변 저장 자체를 실패시키지는 않는다.
      if (suggestion.author_id && suggestion.author_id !== profile.user_id) {
        try {
          await supabase.from('notifications').insert({
            user_id: suggestion.author_id,
            type: 'suggestion_response',
            title: isResponseEdit ? '건의사항 답변이 수정되었어요' : '건의사항에 답변이 달렸어요',
            message: isResponseEdit
              ? `${profile.name} 님이 내 건의사항의 답변을 수정했습니다.`
              : `${profile.name} 님이 내 건의사항에 답변을 달았습니다.`,
            is_read: false,
            link_url: '/suggestions',
          });
        } catch {
          // 알림은 부가 기능이므로 답변 저장 결과에는 영향을 주지 않는다.
        }
      }

      setResponseText('');
      setRespondingId(null);
      setSuccessMsg(isResponseEdit ? '답변이 수정되었습니다.' : '답변이 등록되었습니다.');
      setTimeout(() => setSuccessMsg(null), 3000);
      await fetchSuggestions();
    } catch {
      setError(isResponseEdit ? '답변 수정 중 오류가 발생했습니다.' : '답변 등록 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (suggestionId: string) => {
    if (!window.confirm('정말 이 건의사항을 삭제할까요?')) return;
    try {
      const { error: deleteError } = await supabase
        .from('suggestions')
        .delete()
        .eq('id', suggestionId);
      if (deleteError) {
        console.error('Delete error:', deleteError);
        throw deleteError;
      }
      setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
      setSuccessMsg('건의사항이 삭제되었습니다.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('건의사항 삭제 실패:', err);
      setError('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleEditStart = (item: Suggestion) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditContent(item.content);
  };

  const handleEditSave = async (suggestionId: string) => {
    if (!editTitle.trim() || !editContent.trim()) return;
    try {
      const { error: updateError } = await supabase
        .from('suggestions')
        .update({
          title: editTitle.trim(),
          content: editContent.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', suggestionId);
      if (updateError) {
        console.error('Edit error:', updateError);
        throw updateError;
      }
      setSuggestions(prev => prev.map(s => s.id === suggestionId ? { ...s, title: editTitle.trim(), content: editContent.trim(), updated_at: new Date().toISOString() } : s));
      setEditingId(null);
      setEditTitle('');
      setEditContent('');
      setSuccessMsg('건의사항이 수정되었습니다.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('건의사항 수정 실패:', err);
      setError('수정 중 오류가 발생했습니다.');
    }
  };

  const visibleSuggestions = suggestions.filter(s => {
    if (canViewAll) return true;
    if (profile && s.author_id === profile.user_id) return true;
    return false;
  });

  const hiddenCount = suggestions.length - visibleSuggestions.length;

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-6 md:mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-primary-100 flex items-center justify-center">
                <i className="ri-lightbulb-line text-xl md:text-2xl text-primary-600"></i>
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-foreground-950">건의사항</h1>
                <p className="text-xs md:text-sm text-foreground-600 mt-0.5">
                  {isTeacherOrAbove
                    ? '전체 건의사항을 확인하고 답변할 수 있습니다'
                    : '학생회 운영에 대한 의견을 자유롭게 남겨주세요'}
                </p>
              </div>
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-accent-100 border border-accent-200 rounded-xl p-4 mb-6"
            >
              <p className="text-sm text-accent-700 flex items-center gap-2">
                <i className="ri-error-warning-line"></i>{error}
              </p>
            </motion.div>
          )}

          <AnimatePresence>
            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-5 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-sm text-emerald-700"
              >
                <i className="ri-check-line"></i>
                {successMsg}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              {hiddenCount > 0 && (
                <span className="text-xs text-foreground-500 bg-background-100 border border-background-200 px-2.5 py-1 rounded-full">
                  {visibleSuggestions.length}건 표시 ({hiddenCount}건 숨김)
                </span>
              )}
            </div>
            {profile && (
              <button
                onClick={() => {
                  setShowForm(!showForm);
                  setSuccessMsg(null);
                  if (!showForm) {
                    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary-500 text-background-50 text-sm font-medium hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className={`text-sm ${showForm ? 'ri-close-line' : 'ri-add-line'}`}></i>
                {showForm ? '닫기' : '건의하기'}
              </button>
            )}
          </div>

          <AnimatePresence>
            {showForm && (
              <motion.div
                ref={formRef}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="mb-6 overflow-hidden"
              >
                <form onSubmit={handleSubmit} className="p-5 bg-background-100 border border-background-200 rounded-2xl">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-foreground-950 mb-2">
                      <i className="ri-edit-line mr-1.5 text-foreground-600"></i>
                      제목
                    </label>
                    <input
                      type="text"
                      name="suggestion_title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="건의사항 제목을 입력해주세요"
                      maxLength={100}
                      className="w-full px-4 py-2.5 text-sm bg-background-50 border border-background-200 rounded-xl outline-none focus:border-primary-400 transition-colors"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-foreground-950 mb-2">
                      <i className="ri-file-text-line mr-1.5 text-foreground-600"></i>
                      내용
                      <span className="text-foreground-500 font-normal ml-1">({content.length}/2000)</span>
                    </label>
                    <textarea
                      name="suggestion_content"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="구체적인 건의 내용을 작성해주세요"
                      maxLength={2000}
                      rows={5}
                      className="w-full px-4 py-3 text-sm bg-background-50 border border-background-200 rounded-xl outline-none focus:border-primary-400 transition-colors resize-none"
                    ></textarea>
                  </div>
                  <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="w-4 h-4 rounded border-background-300 text-primary-500 focus:ring-primary-400 cursor-pointer"
                    />
                    <span className="text-sm text-foreground-700">
                      <i className="ri-user-unfollow-line mr-1 text-foreground-500"></i>
                      익명으로 제출하기
                    </span>
                  </label>
                  <p className="text-xs text-foreground-500 -mt-3 mb-4">
                    익명으로 제출하면 다른 학생과 검토자 모두에게 이름이 표시되지 않아요
                  </p>
                  <button
                    type="submit"
                    disabled={submitting || !title.trim() || !content.trim()}
                    className="w-full py-2.5 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 text-background-50 text-sm font-medium rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:cursor-not-allowed"
                  >
                    {submitting ? '제출 중...' : '건의사항 제출하기'}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <i className="ri-loader-4-line animate-spin text-2xl text-primary-500"></i>
            </div>
          ) : visibleSuggestions.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-background-100 border border-background-200 flex items-center justify-center mx-auto mb-4">
                <i className="ri-lightbulb-line text-2xl text-foreground-400"></i>
              </div>
              <p className="text-sm text-foreground-600 mb-1">아직 등록된 건의사항이 없습니다</p>
              <p className="text-xs text-foreground-500">첫 번째 건의사항을 작성해보세요!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleSuggestions.map((item, idx) => {
                const isExpanded = expandedId === item.id;
                const isEditing = editingId === item.id;
                const clubInfo = item.club ? clubs.find((c) => c.id === item.club) : null;
                const isMySuggestion = profile && item.author_id === profile.user_id;
                const canManage = profile && (ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.assistant_zone_leader || item.author_id === profile.user_id);

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: idx * 0.04 }}
                    className="bg-background-100 border border-background-200 rounded-2xl overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="w-full p-4 md:p-5 text-left hover:bg-background-50/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <i className="ri-lightbulb-line text-primary-500"></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="text-sm font-medium text-foreground-950 truncate">{item.title}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[item.status]}`}>
                              {STATUS_LABELS[item.status]}
                            </span>
                            {isMySuggestion && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-background-200 text-foreground-600 font-medium flex-shrink-0">
                                내 글
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-foreground-500 flex-wrap">
                            <span>{item.is_anonymous ? '익명' : (item.author_name || '작성자')}</span>
                            {clubInfo && (
                              <>
                                <span className="text-gray-200">|</span>
                                <span>{clubInfo.name}</span>
                              </>
                            )}
                            <span className="text-gray-200">|</span>
                            <span>{formatKoreanDate(item.created_at)}</span>
                          </div>
                        </div>
                        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                          <i className={`text-foreground-500 text-sm transition-transform duration-200 ${isExpanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`}></i>
                        </div>
                      </div>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pt-0 border-t border-background-200/60">
                            {isEditing ? (
                              <div className="mt-3 space-y-3">
                                <div>
                                  <label className="block text-xs font-medium text-foreground-600 mb-1">제목</label>
                                  <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    maxLength={100}
                                    className="w-full px-3 py-2 text-sm bg-background-50 border border-background-200 rounded-lg outline-none focus:border-primary-400 transition-colors"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-foreground-600 mb-1">내용</label>
                                  <textarea
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    maxLength={2000}
                                    rows={4}
                                    className="w-full px-3 py-2.5 text-sm bg-background-50 border border-background-200 rounded-lg outline-none focus:border-primary-400 transition-colors resize-none"
                                  ></textarea>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => { setEditingId(null); setEditTitle(''); setEditContent(''); }}
                                    className="px-3 py-1.5 text-xs text-foreground-500 hover:text-foreground-700 cursor-pointer"
                                  >
                                    취소
                                  </button>
                                  <button
                                    onClick={() => handleEditSave(item.id)}
                                    disabled={!editTitle.trim() || !editContent.trim()}
                                    className="px-4 py-1.5 rounded-full bg-primary-500 text-background-50 text-xs font-semibold hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                                  >
                                    저장
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="text-sm text-foreground-700 leading-relaxed mt-3 whitespace-pre-wrap">
                                  {item.content}
                                </p>

                                {item.response && (
                                  <div className="mt-3 p-4 bg-secondary-50 rounded-xl border border-secondary-100">
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                      <div className="flex items-center gap-1.5">
                                        <i className="ri-chat-quote-line text-secondary-500 text-xs"></i>
                                        <span className="text-xs font-bold text-secondary-600">답변</span>
                                      </div>
                                      {isTeacherOrAbove && respondingId !== item.id && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setRespondingId(item.id);
                                            setResponseText(item.response || '');
                                          }}
                                          className="inline-flex items-center gap-1 text-xs font-medium text-secondary-600 hover:text-secondary-700 cursor-pointer"
                                        >
                                          <i className="ri-edit-line"></i>
                                          답변 수정
                                        </button>
                                      )}
                                    </div>
                                    <p className="text-sm text-foreground-800 leading-relaxed whitespace-pre-wrap">
                                      {item.response}
                                    </p>
                                  </div>
                                )}

                                {isTeacherOrAbove && !item.response && respondingId !== item.id && (
                                  <div className="mt-3">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setRespondingId(item.id);
                                        setResponseText('');
                                      }}
                                      className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 cursor-pointer"
                                    >
                                      <i className="ri-reply-line"></i>
                                      답변하기
                                    </button>
                                  </div>
                                )}

                                {respondingId === item.id && (
                                  <div className="mt-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                                    <textarea
                                      name="response_text"
                                      value={responseText}
                                      onChange={(e) => setResponseText(e.target.value)}
                                      placeholder="건의사항에 대한 답변을 작성해주세요..."
                                      rows={3}
                                      maxLength={1000}
                                      className="w-full px-4 py-2.5 text-sm rounded-xl border border-emerald-200 bg-background-100 focus:border-emerald-400 outline-none resize-none"
                                    ></textarea>
                                    <div className="flex items-center gap-2 mt-2">
                                      <button
                                        onClick={() => { setRespondingId(null); setResponseText(''); }}
                                        className="text-xs text-foreground-500 hover:text-foreground-700 cursor-pointer"
                                      >
                                        취소
                                      </button>
                                      <button
                                        onClick={() => handleRespond(item.id)}
                                        disabled={!responseText.trim()}
                                        className="px-4 py-2 rounded-full bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                                      >
                                        {item.response ? '답변 저장' : '답변 등록'}
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {canManage && (
                                  <div className="mt-3 flex items-center gap-3 pt-2 border-t border-background-200/60">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditStart(item);
                                      }}
                                      className="text-xs text-foreground-500 hover:text-primary-600 cursor-pointer flex items-center gap-1"
                                    >
                                      <i className="ri-edit-line"></i> 수정
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(item.id);
                                      }}
                                      className="text-xs text-foreground-500 hover:text-rose-600 cursor-pointer flex items-center gap-1"
                                    >
                                      <i className="ri-delete-bin-line"></i> 삭제
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
