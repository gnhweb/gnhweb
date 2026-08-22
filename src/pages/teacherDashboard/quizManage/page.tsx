import { formatKoreanDate, formatKoreanDateTime } from '@/lib/date';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  type: string;
  difficulty: string;
  points: number;
  created_at: string;
}

interface QuestionReport {
  id: string;
  question_id: string | null;
  question_text: string;
  question_options: string[] | null;
  question_answer: string | null;
  reason: string | null;
  reporter_name: string;
  status: string;
  created_at: string;
}

const DIFFICULTIES = ['상', '중', '하'];
const DEFAULT_POINTS: Record<string, number> = { '상': 30, '중': 20, '하': 10 };

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'multiple', label: '객관식' },
  { value: 'ox', label: 'OX 퀴즈' },
];

const typeLabel = (t: string | undefined | null): string => {
  if (!t) return '객관식';
  const found = TYPE_OPTIONS.find(o => o.value === t);
  return found ? found.label : t;
};

export default function QuizManagePage() {
  const { user, hasRole } = useAuth();
  const canManage = user && (hasRole('teacher') || hasRole('chief'));

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formQuestion, setFormQuestion] = useState('');
  const [formOptions, setFormOptions] = useState(['', '', '', '']);
  const [formAnswer, setFormAnswer] = useState('');
  const [formExplanation, setFormExplanation] = useState('');
  const [formDifficulty, setFormDifficulty] = useState('중');
  const [formType, setFormType] = useState('multiple');
  const [formPoints, setFormPoints] = useState(DEFAULT_POINTS['중']);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [difficultyFilter, setDifficultyFilter] = useState<string>('전체');

  // 문제 제보함
  const [reports, setReports] = useState<QuestionReport[]>([]);
  const [showReports, setShowReports] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const pendingReports = reports.filter(r => r.status === 'pending');

  const filteredQuestions = difficultyFilter === '전체'
    ? questions
    : questions.filter(q => q.difficulty === difficultyFilter);

  const difficultyCounts = {
    '전체': questions.length,
    '상': questions.filter(q => q.difficulty === '상').length,
    '중': questions.filter(q => q.difficulty === '중').length,
    '하': questions.filter(q => q.difficulty === '하').length,
  };

  useEffect(() => {
    if (canManage) loadQuestions();
  }, [canManage]);

  // Supabase Realtime 구독 - 실시간 목록 갱신
  useEffect(() => {
    if (!canManage) return;

    const channel = supabase
      .channel('quiz_questions_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'quiz_questions' },
        (payload) => {
          setQuestions(prev => [payload.new as QuizQuestion, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'quiz_questions' },
        (payload) => {
          setQuestions(prev =>
            prev.map(q => q.id === (payload.new as QuizQuestion).id ? (payload.new as QuizQuestion) : q)
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'quiz_questions' },
        (payload) => {
          setQuestions(prev =>
            prev.filter(q => q.id !== (payload.old as QuizQuestion).id)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canManage]);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('quiz_questions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      setQuestions((data as QuizQuestion[]) || []);
    } catch {
      setError('문제 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadReports = async () => {
    try {
      const { data } = await supabase
        .from('quiz_question_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      setReports((data as QuestionReport[]) || []);
    } catch {
      /* 조용히 실패 */
    }
  };

  useEffect(() => {
    if (canManage) loadReports();
  }, [canManage]);

  // 제보 실시간 구독
  useEffect(() => {
    if (!canManage) return;
    const channel = supabase
      .channel('quiz_question_reports_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'quiz_question_reports' },
        (payload) => {
          setReports(prev => [payload.new as QuestionReport, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'quiz_question_reports' },
        (payload) => {
          setReports(prev =>
            prev.map(r => r.id === (payload.new as QuestionReport).id ? (payload.new as QuestionReport) : r)
          );
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [canManage]);

  const resolveReport = async (reportId: string) => {
    setResolvingId(reportId);
    try {
      const { error: fnError } = await supabase.functions.invoke('quiz-report', {
        method: 'PATCH',
        body: { report_id: reportId, status: 'resolved' },
      });
      if (fnError) throw fnError;
    } catch {
      /* 실시간 구독이 실패 시에도 목록은 다시 불러와 동기화 */
      loadReports();
    } finally {
      setResolvingId(null);
    }
  };

  const jumpToQuestionFromReport = (report: QuestionReport) => {
    const target = report.question_id ? questions.find(q => q.id === report.question_id) : null;
    if (target) {
      openEditForm(target);
    } else {
      setError('원본 문제를 찾을 수 없습니다. 이미 삭제됐을 수 있어요.');
    }
    setShowReports(false);
  };

  const resetForm = () => {
    setFormQuestion('');
    setFormOptions(['', '', '', '']);
    setFormAnswer('');
    setFormExplanation('');
    setFormDifficulty('중');
    setFormType('multiple');
    setFormPoints(DEFAULT_POINTS['중']);
    setFormError(null);
    setEditingId(null);
  };

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (q: QuizQuestion) => {
    setEditingId(q.id);
    setFormQuestion(q.question);
    if (q.type === 'ox') {
      setFormOptions(['O', 'X']);
    } else {
      setFormOptions(q.options && q.options.length === 4 ? [...q.options] : ['', '', '', '']);
    }
    setFormAnswer(q.answer);
    setFormExplanation(q.explanation || '');
    setFormDifficulty(q.difficulty || '중');
    setFormType(q.type || 'multiple');
    setFormPoints(q.points || DEFAULT_POINTS[q.difficulty] || 20);
    setFormError(null);
    setShowForm(true);
  };

  const validateForm = (): boolean => {
    if (!formQuestion.trim()) { setFormError('문제 지문을 입력해주세요.'); return false; }
    if (formType === 'ox') {
      if (formAnswer !== 'O' && formAnswer !== 'X') { setFormError('정답을 선택해주세요 (O 또는 X).'); return false; }
      return true;
    }
    if (formOptions.some(o => !o.trim())) { setFormError('4개의 보기를 모두 입력해주세요.'); return false; }
    if (!formAnswer.trim()) { setFormError('정답을 입력해주세요.'); return false; }
    if (!formOptions.includes(formAnswer.trim())) { setFormError('정답이 보기 목록에 포함되어야 합니다.'); return false; }
    return true;
  };

  const handleTypeChange = (newType: string) => {
    setFormType(newType);
    if (newType === 'ox') {
      setFormOptions(['O', 'X']);
      setFormAnswer('');
      setFormError(null);
    } else {
      if (formType === 'ox') {
        setFormOptions(['', '', '', '']);
        setFormAnswer('');
      }
      setFormError(null);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm() || submitting) return;
    setSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        question: formQuestion.trim(),
        options: formOptions.map(o => o.trim()),
        answer: formAnswer.trim(),
        explanation: formExplanation.trim(),
        type: formType,
        difficulty: formDifficulty,
        points: formPoints,
      };

      if (editingId) {
        const { data: updatedData, error: updateErr } = await supabase
          .from('quiz_questions')
          .update(payload)
          .eq('id', editingId)
          .select();
        if (updateErr) throw updateErr;
      } else {
        const { data: insertedData, error: insertErr } = await supabase
          .from('quiz_questions')
          .insert(payload)
          .select();
        if (insertErr) {
          console.error('[QuizManage] INSERT failed:', {
            code: (insertErr as any)?.code,
            message: insertErr.message,
            details: (insertErr as any)?.details,
            hint: (insertErr as any)?.hint,
          });
          throw insertErr;
        }
      }

      setShowForm(false);
      resetForm();
      await loadQuestions();
    } catch (err: any) {
      setFormError(err?.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const { error: delErr } = await supabase
        .from('quiz_questions')
        .delete()
        .eq('id', id);
      if (delErr) throw delErr;
      setQuestions(prev => prev.filter(q => q.id !== id));
    } catch {
      setError('삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const handleDifficultyChange = (diff: string) => {
    setFormDifficulty(diff);
    setFormPoints(DEFAULT_POINTS[diff] || 20);
  };

  if (!canManage) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-[20px] bg-primary-100 flex items-center justify-center mx-auto mb-4">
            <i className="ri-shield-keyhole-line text-3xl text-primary-600"></i>
          </div>
          <p className="text-lg font-bold text-foreground-950 mb-2">접근 권한이 없습니다</p>
          <p className="text-sm text-foreground-600">교사 또는 부장님 계정으로 로그인해주세요</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary-400 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  const difficultyDot = (d: string) => {
    if (d === '상') return <span className="w-2 h-2 rounded-full bg-rose-400 inline-block"></span>;
    if (d === '중') return <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>;
    return <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>;
  };

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-1">성경퀴즈 출제 관리</h1>
              <p className="text-sm text-foreground-600">
                직접 문제를 출제해서 퀴즈 풀에 추가할 수 있습니다 · 총 {questions.length}문제
              </p>
            </div>
            <button
              onClick={openCreateForm}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary-500 text-white text-sm font-bold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-add-line"></i>새 문제 출제
            </button>
          </div>

          {/* 문제 제보함 */}
          <div className="mb-6">
            <button
              onClick={() => setShowReports(!showReports)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-colors cursor-pointer whitespace-nowrap ${
                pendingReports.length > 0
                  ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                  : 'bg-background-100 border-background-200 text-foreground-600 hover:bg-background-100'
              }`}
            >
              <i className="ri-flag-2-line"></i>
              <span className="text-sm font-semibold">문제 제보함</span>
              {pendingReports.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold">{pendingReports.length}</span>
              )}
              <i className={`ri-arrow-down-s-line text-sm transition-transform duration-200 ${showReports ? 'rotate-180' : ''}`}></i>
            </button>

            <AnimatePresence>
              {showReports && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 space-y-2">
                    {reports.length === 0 && (
                      <p className="text-sm text-foreground-500 py-4 text-center bg-background-100 border border-background-200 rounded-xl">
                        접수된 제보가 없습니다
                      </p>
                    )}
                    {reports.map(r => (
                      <div
                        key={r.id}
                        className={`p-4 rounded-xl border ${
                          r.status === 'pending' ? 'bg-rose-50/60 border-rose-200' : 'bg-background-100 border-background-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                r.status === 'pending' ? 'bg-rose-500 text-white' : 'bg-background-200 text-foreground-500'
                              }`}>
                                {r.status === 'pending' ? '미처리' : '처리완료'}
                              </span>
                              <span className="text-xs text-foreground-400">{r.reporter_name}</span>
                              <span className="text-xs text-foreground-300">{formatKoreanDateTime(r.created_at)}</span>
                            </div>
                            <p className="text-sm text-foreground-800 mb-1">{r.question_text}</p>
                            {r.reason && (
                              <p className="text-xs text-foreground-500">사유: {r.reason}</p>
                            )}
                          </div>
                          <div className="flex flex-col gap-1.5 flex-shrink-0">
                            {r.question_id && (
                              <button
                                onClick={() => jumpToQuestionFromReport(r)}
                                className="text-xs px-3 py-1.5 rounded-full bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors cursor-pointer whitespace-nowrap"
                              >
                                수정하러 가기
                              </button>
                            )}
                            {r.status === 'pending' && (
                              <button
                                onClick={() => resolveReport(r.id)}
                                disabled={resolvingId === r.id}
                                className="text-xs px-3 py-1.5 rounded-full bg-background-200 text-foreground-600 hover:bg-background-300 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                              >
                                {resolvingId === r.id ? '처리 중...' : '처리완료'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Difficulty filter tabs */}
          <div className="flex items-center gap-1 mb-6 px-1 py-1 rounded-full bg-background-200/70 w-fit">
            {['전체', '상', '중', '하'].map(d => (
              <button
                key={d}
                onClick={() => setDifficultyFilter(d)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  difficultyFilter === d
                    ? 'bg-background-100 text-foreground-950 shadow-sm'
                    : 'text-foreground-600 hover:text-foreground-800'
                }`}
              >
                {d === '전체' ? '전체' : d === '상' ? '상 (어려움)' : d === '중' ? '중 (보통)' : '하 (쉬움)'}
                <span className="ml-1 text-xs opacity-60">{difficultyCounts[d]}</span>
              </button>
            ))}
          </div>

          {error && (
            <div className="bg-accent-100 border border-accent-200 rounded-[20px] p-4 mb-6">
              <p className="text-sm text-accent-700 flex items-center gap-2"><i className="ri-error-warning-line"></i>{error}</p>
              <button onClick={() => { setError(null); loadQuestions(); }} className="mt-2 text-xs text-accent-600 underline cursor-pointer">다시 시도</button>
            </div>
          )}

          {/* Question List */}
          {filteredQuestions.length === 0 ? (
            <div className="text-center py-16 bg-background-100 border border-background-200 rounded-[20px]">
              <div className="w-16 h-16 rounded-[20px] bg-amber-50 flex items-center justify-center mx-auto mb-4">
                <i className="ri-question-answer-line text-2xl text-amber-400"></i>
              </div>
              <p className="text-sm text-foreground-600 mb-4">
                {difficultyFilter === '전체' ? '아직 등록된 문제가 없습니다' : `'${difficultyFilter}' 난이도 문제가 없습니다`}
              </p>
              <button onClick={openCreateForm} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary-500 text-white text-sm font-bold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap">
                <i className="ri-add-line"></i>첫 문제 출제하기
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredQuestions.map((q, idx) => (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="bg-background-100 border border-background-200 rounded-[16px] p-4 hover:border-background-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          q.difficulty === '상' ? 'bg-rose-100 text-rose-700' :
                          q.difficulty === '중' ? 'bg-amber-100 text-amber-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {difficultyDot(q.difficulty)} {q.difficulty}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-background-100 text-foreground-600 font-medium">{typeLabel(q.type)}</span>
                        <span className="text-[10px] text-foreground-400">{q.points}점</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground-900 mb-2 line-clamp-2">{q.question}</p>
                      <div className="grid grid-cols-2 gap-1 mb-1.5">
                        {q.options.map((opt, oi) => (
                          <span
                            key={oi}
                            className={`text-xs px-2 py-1 rounded-lg ${
                              opt === q.answer
                                ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200'
                                : 'bg-background-50 text-foreground-600'
                            }`}
                          >
                            {oi + 1}. {opt}
                          </span>
                        ))}
                      </div>
                      {q.explanation && (
                        <p className="text-xs text-foreground-500 mt-1 line-clamp-2">
                          <span className="font-medium">해설:</span> {q.explanation}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => openEditForm(q)}
                        className="w-8 h-8 rounded-lg bg-background-100 hover:bg-primary-100 text-foreground-500 hover:text-primary-600 flex items-center justify-center transition-colors cursor-pointer"
                        title="수정"
                      >
                        <i className="ri-edit-line text-sm"></i>
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(q.id)}
                        className="w-8 h-8 rounded-lg bg-background-100 hover:bg-rose-100 text-foreground-500 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                        title="삭제"
                      >
                        <i className="ri-delete-bin-line text-sm"></i>
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Create/Edit Form Modal */}
          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-10 md:pt-20 px-4 overflow-y-auto"
                onClick={() => { setShowForm(false); resetForm(); }}
              >
                <motion.div
                  initial={{ scale: 0.95, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.95, y: 20 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-background-100 rounded-[24px] p-6 md:p-8 max-w-lg w-full shadow-xl mb-10"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-foreground-950">
                      {editingId ? '문제 수정' : '새 문제 출제'}
                    </h2>
                    <button
                      onClick={() => { setShowForm(false); resetForm(); }}
                      className="w-8 h-8 rounded-full bg-background-100 hover:bg-background-200 flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <i className="ri-close-line text-foreground-600"></i>
                    </button>
                  </div>

                  {formError && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-4">
                      <p className="text-sm text-rose-700 flex items-center gap-2"><i className="ri-error-warning-line"></i>{formError}</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Question */}
                    <div>
                      <label className="block text-sm font-medium text-foreground-950 mb-1.5">문제 지문</label>
                      <textarea
                        value={formQuestion}
                        onChange={e => setFormQuestion(e.target.value)}
                        placeholder="성경 퀴즈 문제를 입력하세요..."
                        rows={3}
                        maxLength={500}
                        className="w-full px-4 py-2.5 text-sm rounded-[13px] border border-background-200 bg-background-50 focus:border-primary-400 outline-none resize-none"
                      />
                    </div>

                    {/* Options */}
                    <div>
                      <label className="block text-sm font-medium text-foreground-950 mb-1.5">
                        {formType === 'ox' ? '정답 선택 (OX 퀴즈)' : '보기 (4지선다)'}
                      </label>
                      {formType === 'ox' ? (
                        <div className="flex gap-3">
                          <button
                            onClick={() => setFormAnswer('O')}
                            className={`flex-1 py-4 rounded-xl text-lg font-bold transition-all cursor-pointer whitespace-nowrap border-2 ${
                              formAnswer === 'O'
                                ? 'bg-primary-100 border-primary-400 text-primary-700'
                                : 'bg-background-50 border-background-200 text-foreground-600 hover:border-primary-300 hover:bg-primary-50'
                            }`}
                          >
                            <span className="text-2xl mr-2">⭕</span>O
                          </button>
                          <button
                            onClick={() => setFormAnswer('X')}
                            className={`flex-1 py-4 rounded-xl text-lg font-bold transition-all cursor-pointer whitespace-nowrap border-2 ${
                              formAnswer === 'X'
                                ? 'bg-primary-100 border-primary-400 text-primary-700'
                                : 'bg-background-50 border-background-200 text-foreground-600 hover:border-primary-300 hover:bg-primary-50'
                            }`}
                          >
                            <span className="text-2xl mr-2">❌</span>X
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {formOptions.map((opt, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                opt.trim() === formAnswer.trim()
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-background-100 text-foreground-500'
                              }`}>
                                {i + 1}
                              </span>
                              <input
                                type="text"
                                value={opt}
                                onChange={e => {
                                  const next = [...formOptions];
                                  next[i] = e.target.value;
                                  setFormOptions(next);
                                }}
                                placeholder={`보기 ${i + 1}`}
                                maxLength={200}
                                className="flex-1 px-3 py-2 text-sm rounded-xl border border-background-200 bg-background-50 focus:border-primary-400 outline-none"
                              />
                              <button
                                onClick={() => setFormAnswer(opt.trim())}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors ${
                                  opt.trim() === formAnswer.trim()
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-background-100 text-foreground-400 hover:bg-emerald-100 hover:text-emerald-600'
                                }`}
                                title="정답으로 설정"
                              >
                                <i className="ri-check-line text-sm"></i>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {formType !== 'ox' && (
                        <p className="text-xs text-foreground-400 mt-1.5">
                          정답 보기 옆의 체크 버튼을 눌러 정답을 지정하세요
                        </p>
                      )}
                    </div>

                    {/* Difficulty + Type + Points */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-foreground-600 mb-1">난이도</label>
                        <div className="flex bg-background-100 rounded-full p-0.5">
                          {DIFFICULTIES.map(d => (
                            <button
                              key={d}
                              onClick={() => handleDifficultyChange(d)}
                              className={`flex-1 py-1.5 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                                formDifficulty === d
                                  ? 'bg-background-100 text-foreground-950 shadow-sm'
                                  : 'text-foreground-500 hover:text-foreground-700'
                              }`}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground-600 mb-1">유형</label>
                        <select
                          value={formType}
                          onChange={e => handleTypeChange(e.target.value)}
                          className="w-full px-3 py-2 text-sm rounded-xl border border-background-200 bg-background-50 focus:border-primary-400 outline-none"
                        >
                          {TYPE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground-600 mb-1">배점</label>
                        <input
                          type="number"
                          value={formPoints}
                          onChange={e => setFormPoints(Math.max(5, Math.min(100, parseInt(e.target.value) || 10)))}
                          min={5}
                          max={100}
                          className="w-full px-3 py-2 text-sm rounded-xl border border-background-200 bg-background-50 focus:border-primary-400 outline-none"
                        />
                      </div>
                    </div>

                    {/* Explanation */}
                    <div>
                      <label className="block text-sm font-medium text-foreground-950 mb-1.5">해설 (선택)</label>
                      <textarea
                        value={formExplanation}
                        onChange={e => setFormExplanation(e.target.value)}
                        placeholder="정답에 대한 해설을 입력하세요..."
                        rows={2}
                        maxLength={500}
                        className="w-full px-4 py-2.5 text-sm rounded-[13px] border border-background-200 bg-background-50 focus:border-primary-400 outline-none resize-none"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={() => { setShowForm(false); resetForm(); }}
                        className="flex-1 py-3 rounded-full border border-background-200 text-foreground-600 text-sm font-medium hover:bg-background-50 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        취소
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="flex-1 py-3 rounded-full bg-primary-500 text-white text-sm font-bold hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                      >
                        {submitting ? '저장 중...' : editingId ? '수정하기' : '출제하기'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Delete Confirm Modal */}
          <AnimatePresence>
            {deleteConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
                onClick={() => setDeleteConfirm(null)}
              >
                <motion.div
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 20 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-background-100 rounded-[24px] p-6 max-w-sm w-full shadow-xl"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                      <i className="ri-delete-bin-line text-xl text-rose-600"></i>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground-950">문제를 삭제할까요?</p>
                      <p className="text-xs text-foreground-500">삭제하면 복구할 수 없습니다</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="flex-1 py-2.5 rounded-full border border-background-200 text-foreground-600 text-sm font-medium hover:bg-background-50 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      취소
                    </button>
                    <button
                      onClick={() => handleDelete(deleteConfirm)}
                      disabled={deleting}
                      className="flex-1 py-2.5 rounded-full bg-rose-500 text-white text-sm font-bold hover:bg-rose-600 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    >
                      {deleting ? '삭제 중...' : '삭제'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

        </motion.div>
      </div>
    </div>
  );
}