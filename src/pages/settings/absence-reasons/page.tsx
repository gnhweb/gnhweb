import { Link } from "react-router-dom";
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_HIERARCHY } from '@/types/auth';

interface AbsenceReason {
  id: string;
  reason_label: string;
  is_active: boolean;
  created_at: string;
}

export default function AbsenceReasonsPage() {
  const { profile } = useAuth();
  const isAdmin = profile ? ROLE_HIERARCHY[profile.role] >= ROLE_HIERARCHY.chief : false;

  const [reasons, setReasons] = useState<AbsenceReason[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newReason, setNewReason] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchReasons = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('absence_reasons')
        .select('*')
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;
      setReasons((data || []) as AbsenceReason[]);
    } catch (err) {
      console.error('불참 사유 로딩 실패:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReasons();
  }, [fetchReasons]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const handleAdd = async () => {
    const trimmed = newReason.trim();
    if (!trimmed) return;
    if (trimmed.length > 50) {
      setError('사유는 50자 이내로 입력해주세요');
      return;
    }
    if (reasons.some((r) => r.reason_label === trimmed)) {
      setError('이미 존재하는 사유입니다');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      const { error: insertError } = await supabase
        .from('absence_reasons')
        .insert({ reason_label: trimmed });

      if (insertError) throw insertError;
      setNewReason('');
      showSuccess('불참 사유가 추가되었어요');
      fetchReasons();
    } catch (err) {
      console.error('추가 실패:', err);
      setError('추가 중 오류가 발생했어요');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editingId) return;
    const trimmed = editValue.trim();
    if (!trimmed) return;
    if (trimmed.length > 50) {
      setError('사유는 50자 이내로 입력해주세요');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('absence_reasons')
        .update({ reason_label: trimmed, updated_at: new Date().toISOString() })
        .eq('id', editingId);

      if (updateError) throw updateError;
      setEditingId(null);
      setEditValue('');
      showSuccess('불참 사유가 수정되었어요');
      fetchReasons();
    } catch (err) {
      console.error('수정 실패:', err);
      setError('수정 중 오류가 발생했어요');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (item: AbsenceReason) => {
    setIsSaving(true);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('absence_reasons')
        .update({ is_active: !item.is_active, updated_at: new Date().toISOString() })
        .eq('id', item.id);

      if (updateError) throw updateError;
      showSuccess(item.is_active ? '비활성화되었어요' : '활성화되었어요');
      fetchReasons();
    } catch (err) {
      console.error('토글 실패:', err);
      setError('상태 변경 중 오류가 발생했어요');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('정말 삭제할까요? 이 작업은 되돌릴 수 없어요.')) return;

    setIsSaving(true);
    setError('');
    try {
      const { error: deleteError } = await supabase
        .from('absence_reasons')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      showSuccess('불참 사유가 삭제되었어요');
      fetchReasons();
    } catch (err) {
      console.error('삭제 실패:', err);
      setError('삭제 중 오류가 발생했어요');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4">
            <i className="ri-shield-keyhole-line text-2xl text-rose-600"></i>
          </div>
          <p className="text-lg font-bold text-foreground-950 mb-2">접근 권한이 없어요</p>
          <p className="text-sm text-foreground-500">부장 또는 교사만 접근할 수 있는 페이지예요</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <i className="ri-loader-4-line animate-spin text-3xl text-primary-500 block mb-3"></i>
          <p className="text-sm text-foreground-500">불참 사유 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const activeCount = reasons.filter((r) => r.is_active).length;

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground-950 mb-1">불참 사유 관리</h1>
            <p className="text-sm text-foreground-500">
              학생들이 선택할 수 있는 불참 사유 카테고리를 관리해요 · 현재 {activeCount}개 활성
            </p>
          </div>
          <Link
            to="/dashboard/attendance/analytics"
            className="flex items-center gap-2 px-5 py-2.5 bg-background-100 border border-background-200 rounded-2xl text-sm font-bold text-foreground-700 hover:bg-background-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-arrow-left-line text-lg"></i>
            돌아가기
          </Link>
        </div>

        {/* Success / Error messages */}
        <AnimatePresence>
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700"
            >
              <i className="ri-check-line mr-2"></i>
              {successMsg}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-4 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700"
            >
              <i className="ri-error-warning-line mr-2"></i>
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add new reason */}
        <div className="bg-background-100 border border-background-200 rounded-[20px] p-5 mb-5">
          <p className="text-sm font-bold text-foreground-800 mb-3">새 불참 사유 추가</p>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
              placeholder="예) 교회 행사, 봉사 활동..."
              maxLength={50}
              className="flex-1 px-4 py-3 text-sm bg-background-50 border border-background-200 rounded-xl outline-none focus:border-primary-300 transition-colors"
              disabled={isSaving}
            />
            <button
              onClick={handleAdd}
              disabled={isSaving || !newReason.trim()}
              className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap"
            >
              추가
            </button>
          </div>
          <p className="text-xs text-foreground-400 mt-2">{newReason.length}/50</p>
        </div>

        {/* Reason list */}
        <div className="bg-background-100 border border-background-200 rounded-[20px] p-5">
          <p className="text-sm font-bold text-foreground-800 mb-4">등록된 불참 사유 목록</p>
          {reasons.length === 0 ? (
            <p className="text-sm text-foreground-400 text-center py-8">아직 등록된 불참 사유가 없어요</p>
          ) : (
            <div className="space-y-2">
              {reasons.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    item.is_active
                      ? 'bg-background-50 border-background-200'
                      : 'bg-background-100/50 border-background-200/50 opacity-60'
                  }`}
                >
                  {editingId === item.id ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleEdit(); }}
                        maxLength={50}
                        className="flex-1 px-3 py-2 text-sm bg-background-50 border border-background-200 rounded-lg outline-none focus:border-primary-300"
                        autoFocus
                      />
                      <button
                        onClick={handleEdit}
                        disabled={isSaving || !editValue.trim()}
                        className="px-3 py-2 text-xs font-bold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setEditValue(''); }}
                        className="px-3 py-2 text-xs text-foreground-500 hover:text-foreground-700 cursor-pointer whitespace-nowrap"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 flex items-center gap-3 min-w-0">
                        <span className="text-sm font-medium text-foreground-800 truncate">{item.reason_label}</span>
                        {!item.is_active && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-rose-100 text-rose-600">비활성</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggle(item)}
                          disabled={isSaving}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                            item.is_active
                              ? 'text-foreground-400 hover:text-foreground-600 hover:bg-background-200'
                              : 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={item.is_active ? '비활성화' : '활성화'}
                        >
                          <i className={`text-sm ${item.is_active ? 'ri-toggle-line' : 'ri-toggle-fill'}`}></i>
                        </button>
                        <button
                          onClick={() => { setEditingId(item.id); setEditValue(item.reason_label); }}
                          disabled={isSaving}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground-400 hover:text-primary-600 hover:bg-primary-50 transition-colors cursor-pointer"
                          title="수정"
                        >
                          <i className="ri-pencil-line text-sm"></i>
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={isSaving}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="삭제"
                        >
                          <i className="ri-delete-bin-line text-sm"></i>
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Info card */}
        <div className="mt-5 bg-accent-50 border border-accent-200 rounded-[20px] p-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className="ri-information-line text-accent-600 text-sm"></i>
            </div>
            <div>
              <p className="text-sm font-bold text-accent-800 mb-1">불참 사유 관리 안내</p>
              <ul className="text-xs text-accent-700 space-y-1.5">
                <li>• 활성화된 사유만 학생들에게 선택지로 표시돼요</li>
                <li>• 비활성화하면 기존 데이터는 유지되고 새로운 선택만 제한돼요</li>
                <li>• 사유명을 수정해도 기존 불참 기록의 텍스트는 바뀌지 않아요</li>
                <li>• 통계 분석에서는 키워드 매칭으로 사유를 자동 분류해요</li>
              </ul>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}