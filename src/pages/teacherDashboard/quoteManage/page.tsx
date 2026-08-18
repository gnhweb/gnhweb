import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface Quote {
  id: string;
  content: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const PAGE_SIZE = 25;

export default function QuoteManagePage() {
  const { user, hasRole } = useAuth();
  const canManage = user && (hasRole('teacher') || hasRole('chief'));

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 검색 / 필터 / 페이지네이션
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'전체' | '활성' | '비활성'>('전체');
  const [page, setPage] = useState(1);

  // 추가 폼
  const [showForm, setShowForm] = useState(false);
  const [formContent, setFormContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 인라인 수정
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [savingEditId, setSavingEditId] = useState<string | null>(null);

  // 삭제 확인
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 활성/비활성 토글
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    if (canManage) loadQuotes();
  }, [canManage]);

  // Supabase Realtime 구독 - 실시간 목록 갱신
  useEffect(() => {
    if (!canManage) return;

    const channel = supabase
      .channel('quotes_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'quotes' },
        (payload) => {
          setQuotes(prev => {
            const next = payload.new as Quote;
            if (prev.some(q => q.id === next.id)) return prev;
            return [next, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'quotes' },
        (payload) => {
          setQuotes(prev =>
            prev.map(q => q.id === (payload.new as Quote).id ? (payload.new as Quote) : q)
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'quotes' },
        (payload) => {
          setQuotes(prev =>
            prev.filter(q => q.id !== (payload.old as Quote).id)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canManage]);

  const loadQuotes = async () => {
    setLoading(true);
    try {
      const { data, error: loadErr } = await supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false });
      if (loadErr) throw loadErr;
      setQuotes((data as Quote[]) || []);
      setError(null);
    } catch {
      setError('어록 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 검색 + 상태 필터 (클라이언트 메모리 필터링, 448개 규모는 즉각 반응 가능)
  const filteredQuotes = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return quotes.filter(q => {
      if (statusFilter === '활성' && !q.is_active) return false;
      if (statusFilter === '비활성' && q.is_active) return false;
      if (keyword && !q.content.toLowerCase().includes(keyword)) return false;
      return true;
    });
  }, [quotes, search, statusFilter]);

  // 검색어/필터가 바뀌면 첫 페이지로
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredQuotes.length / PAGE_SIZE));
  const pagedQuotes = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredQuotes.slice(start, start + PAGE_SIZE);
  }, [filteredQuotes, page]);

  const totalCount = quotes.length;
  const activeCount = quotes.filter(q => q.is_active).length;
  const inactiveCount = totalCount - activeCount;

  const resetForm = () => {
    setFormContent('');
    setFormError(null);
  };

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formContent.trim()) { setFormError('어록 내용을 입력해주세요.'); return; }
    if (submitting) return;
    setSubmitting(true);
    setFormError(null);

    try {
      const { error: insertErr } = await supabase
        .from('quotes')
        .insert({
          content: formContent.trim(),
          created_by: user?.id ?? null,
        })
        .select();
      if (insertErr) throw insertErr;

      setShowForm(false);
      resetForm();
      await loadQuotes();
    } catch (err: any) {
      setFormError(err?.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (q: Quote) => {
    setEditingId(q.id);
    setEditContent(q.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const saveEdit = async (id: string) => {
    if (!editContent.trim()) { setError('어록 내용을 입력해주세요.'); return; }
    setSavingEditId(id);
    try {
      const { error: updateErr } = await supabase
        .from('quotes')
        .update({ content: editContent.trim() })
        .eq('id', id)
        .select();
      if (updateErr) throw updateErr;
      setEditingId(null);
      setEditContent('');
    } catch {
      setError('수정 중 오류가 발생했습니다.');
    } finally {
      setSavingEditId(null);
    }
  };

  const toggleActive = async (q: Quote) => {
    setTogglingId(q.id);
    try {
      const { error: toggleErr } = await supabase
        .from('quotes')
        .update({ is_active: !q.is_active })
        .eq('id', q.id)
        .select();
      if (toggleErr) throw toggleErr;
    } catch {
      setError('상태 변경 중 오류가 발생했습니다.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const { error: delErr } = await supabase
        .from('quotes')
        .delete()
        .eq('id', id);
      if (delErr) throw delErr;
      setQuotes(prev => prev.filter(q => q.id !== id));
    } catch {
      setError('삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
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

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-1">어록 관리</h1>
              <p className="text-sm text-foreground-600">
                홈 화면에 노출되는 어록을 관리할 수 있습니다 · 총 {totalCount}개 (활성 {activeCount} · 비활성 {inactiveCount})
              </p>
            </div>
            <button
              onClick={openCreateForm}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary-500 text-white text-sm font-bold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-add-line"></i>새 어록 추가
            </button>
          </div>

          {/* Search + Status filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-foreground-400"></i>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="어록 내용으로 검색..."
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-full border border-background-200 bg-background-100 focus:border-primary-400 outline-none"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400 hover:text-foreground-600 cursor-pointer"
                >
                  <i className="ri-close-line"></i>
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 px-1 py-1 rounded-full bg-background-200/70 w-fit">
              {(['전체', '활성', '비활성'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    statusFilter === s
                      ? 'bg-background-100 text-foreground-950 shadow-sm'
                      : 'text-foreground-600 hover:text-foreground-800'
                  }`}
                >
                  {s}
                  <span className="ml-1 text-xs opacity-60">
                    {s === '전체' ? totalCount : s === '활성' ? activeCount : inactiveCount}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-accent-100 border border-accent-200 rounded-[20px] p-4 mb-6">
              <p className="text-sm text-accent-700 flex items-center gap-2"><i className="ri-error-warning-line"></i>{error}</p>
              <button onClick={() => { setError(null); loadQuotes(); }} className="mt-2 text-xs text-accent-600 underline cursor-pointer">다시 시도</button>
            </div>
          )}

          {/* Quote List */}
          {filteredQuotes.length === 0 ? (
            <div className="text-center py-16 bg-background-100 border border-background-200 rounded-[20px]">
              <div className="w-16 h-16 rounded-[20px] bg-amber-50 flex items-center justify-center mx-auto mb-4">
                <i className="ri-chat-quote-line text-2xl text-amber-400"></i>
              </div>
              <p className="text-sm text-foreground-600 mb-4">
                {search ? `'${search}'에 대한 검색 결과가 없습니다` : '아직 등록된 어록이 없습니다'}
              </p>
              <button onClick={openCreateForm} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary-500 text-white text-sm font-bold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap">
                <i className="ri-add-line"></i>첫 어록 추가하기
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {pagedQuotes.map((q, idx) => (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className="bg-background-100 border border-background-200 rounded-[16px] p-4 hover:border-background-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            q.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-background-100 text-foreground-500'
                          }`}>
                            <span className={`w-2 h-2 rounded-full inline-block ${q.is_active ? 'bg-emerald-400' : 'bg-background-400'}`}></span>
                            {q.is_active ? '활성' : '비활성'}
                          </span>
                          <span className="text-[10px] text-foreground-400">{new Date(q.created_at).toLocaleDateString('ko-KR')}</span>
                        </div>

                        {editingId === q.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editContent}
                              onChange={e => setEditContent(e.target.value)}
                              rows={3}
                              className="w-full px-3 py-2 text-sm rounded-xl border border-background-200 bg-background-50 focus:border-primary-400 outline-none resize-none"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => saveEdit(q.id)}
                                disabled={savingEditId === q.id}
                                className="px-4 py-1.5 rounded-full bg-primary-500 text-white text-xs font-bold hover:bg-primary-600 disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
                              >
                                {savingEditId === q.id ? '저장 중...' : '저장'}
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="px-4 py-1.5 rounded-full border border-background-200 text-foreground-600 text-xs font-medium hover:bg-background-50 transition-colors cursor-pointer whitespace-nowrap"
                              >
                                취소
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-foreground-900 whitespace-pre-wrap">{q.content}</p>
                        )}
                      </div>

                      {editingId !== q.id && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => toggleActive(q)}
                            disabled={togglingId === q.id}
                            className="w-8 h-8 rounded-lg bg-background-100 hover:bg-emerald-100 text-foreground-500 hover:text-emerald-600 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
                            title={q.is_active ? '비활성화' : '활성화'}
                          >
                            <i className={`text-sm ${q.is_active ? 'ri-eye-line' : 'ri-eye-off-line'}`}></i>
                          </button>
                          <button
                            onClick={() => openEdit(q)}
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
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="w-8 h-8 rounded-lg bg-background-100 border border-background-200 text-foreground-600 flex items-center justify-center disabled:opacity-30 hover:bg-background-50 transition-colors cursor-pointer"
                  >
                    <i className="ri-arrow-left-s-line"></i>
                  </button>
                  <span className="text-sm text-foreground-600 px-2">
                    {page} / {totalPages} 페이지 · {filteredQuotes.length}개
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="w-8 h-8 rounded-lg bg-background-100 border border-background-200 text-foreground-600 flex items-center justify-center disabled:opacity-30 hover:bg-background-50 transition-colors cursor-pointer"
                  >
                    <i className="ri-arrow-right-s-line"></i>
                  </button>
                </div>
              )}
            </>
          )}

          {/* Create Form Modal */}
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
                    <h2 className="text-lg font-bold text-foreground-950">새 어록 추가</h2>
                    <button
                      onClick={() => { setShowForm(false); resetForm(); }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground-400 hover:bg-background-100 cursor-pointer"
                    >
                      <i className="ri-close-line"></i>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {formError && (
                      <div className="bg-accent-100 border border-accent-200 rounded-xl p-3">
                        <p className="text-xs text-accent-700">{formError}</p>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-foreground-950 mb-1.5">어록 내용</label>
                      <textarea
                        value={formContent}
                        onChange={e => setFormContent(e.target.value)}
                        placeholder="어록 내용을 입력하세요..."
                        rows={5}
                        className="w-full px-4 py-2.5 text-sm rounded-[13px] border border-background-200 bg-background-50 focus:border-primary-400 outline-none resize-none"
                      />
                    </div>

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
                        {submitting ? '저장 중...' : '추가하기'}
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
                      <p className="text-sm font-bold text-foreground-950">어록을 삭제할까요?</p>
                      <p className="text-xs text-foreground-500">삭제하면 복구할 수 없습니다. 완전히 지우지 않으려면 비활성화를 이용하세요.</p>
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