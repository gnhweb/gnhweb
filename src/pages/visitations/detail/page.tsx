import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { ROLE_HIERARCHY } from '@/types/auth';
import type { UserRole } from '@/types/auth';


interface Visitation {
  id: string;
  visitor_id: string;
  visitor_name: string;
  student_id: string;
  student_name: string;
  scheduled_at: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  topic: string | null;
  notes: string | null;
  follow_up_needed: boolean;
  growth_record_summary: string | null;
  created_at: string;
  updated_at: string;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function VisitationDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [visitation, setVisitation] = useState<Visitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [completing, setCompleting] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [growthSummary, setGrowthSummary] = useState('');
  const [followUpNeeded, setFollowUpNeeded] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const role = profile?.role as UserRole;
  const isTeacherOrAbove = ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.teacher;

  const fetchVisitation = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('visitations')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (data) {
        setVisitation(data as Visitation);
        setCompletionNotes(data.notes || '');
        setFollowUpNeeded(data.follow_up_needed || false);
        setGrowthSummary(data.growth_record_summary || '');
      } else {
        setError('심방 기록을 찾을 수 없습니다');
      }
    } catch {
      setError('심방 기록을 불러오는 중 문제가 발생했어요. 다시 시도해주세요');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchVisitation();
  }, [fetchVisitation]);

  const handleComplete = async () => {
    if (!visitation) return;
    setCompleting(true);
    try {
      const updates: any = {
        status: 'completed',
        notes: completionNotes.trim() || null,
        follow_up_needed: followUpNeeded,
        growth_record_summary: growthSummary.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('visitations')
        .update(updates)
        .eq('id', visitation.id);

      if (updateError) throw updateError;

      if (growthSummary.trim()) {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        await supabase
          .from('growth_records')
          .insert({
            author_id: userId,
            author_name: profile?.name || '',
            student_name: visitation.student_name,
            content: `[심방 기록] ${growthSummary.trim()}`,
            type: 'visitation',
          });
      }

      setVisitation(prev => prev ? { ...prev, status: 'completed' as const, notes: completionNotes.trim() || null, follow_up_needed: followUpNeeded, growth_record_summary: growthSummary.trim() || null } : null);
      setSuccessMsg('심방이 완료 처리되었습니다.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err?.message || '완료 처리 중 오류가 발생했습니다');
    } finally {
      setCompleting(false);
    }
  };

  const handleUpdate = async () => {
    if (!visitation) return;
    setCompleting(true);
    try {
      const updates = {
        notes: completionNotes.trim() || null,
        follow_up_needed: followUpNeeded,
        growth_record_summary: growthSummary.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('visitations')
        .update(updates)
        .eq('id', visitation.id);

      if (updateError) throw updateError;

      setVisitation(prev => prev ? { ...prev, ...updates } : null);
      setIsEditing(false);
      setSuccessMsg('심방 기록이 수정되었습니다.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err?.message || '수정 중 오류가 발생했습니다');
    } finally {
      setCompleting(false);
    }
  };

  const handleDelete = async () => {
    if (!visitation) return;
    if (!window.confirm('이 심방 기록을 삭제하시겠습니까? 되돌릴 수 없습니다.')) return;
    setDeleting(true);
    try {
      const { error: deleteError } = await supabase
        .from('visitations')
        .delete()
        .eq('id', visitation.id);

      if (deleteError) throw deleteError;
      navigate('/visitations');
    } catch (err: any) {
      setError(err?.message || '삭제 중 오류가 발생했습니다');
      setDeleting(false);
    }
  };

  const handleCancel = async () => {
    if (!visitation) return;
    try {
      await supabase
        .from('visitations')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', visitation.id);
      setVisitation(prev => prev ? { ...prev, status: 'cancelled' as const } : null);
      setSuccessMsg('심방이 취소되었습니다.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setError('취소 중 오류가 발생했습니다');
    }
  };

  const formatDateTime = (d: string) => {
    const date = new Date(d);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = WEEKDAYS[date.getDay()];
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours < 12 ? '오전' : '오후';
    const displayHour = hours % 12 || 12;
    return `${date.getFullYear()}년 ${month}월 ${day}일 (${weekday}) ${ampm} ${displayHour}:${minutes}`;
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-primary-100 text-primary-700';
      case 'completed': return 'bg-emerald-100 text-emerald-700';
      case 'cancelled': return 'bg-rose-100 text-rose-700';
      default: return 'bg-background-200 text-foreground-600';
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'scheduled': return '예정';
      case 'completed': return '완료';
      case 'cancelled': return '취소';
      default: return status;
    }
  };

  const canModify = visitation && profile && (
    visitation.visitor_id === profile.user_id || isTeacherOrAbove
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <i className="ri-loader-4-line animate-spin text-2xl text-primary-500"></i>
      </div>
    );
  }

  if (error && !visitation) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-foreground-600 mb-4">{error}</p>
          <Link to="/visitations" className="text-primary-600 hover:text-primary-700 font-medium cursor-pointer">심방 목록으로</Link>
        </div>
      </div>
    );
  }

  if (!visitation) return null;

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="mb-6">
            <button
              onClick={() => navigate('/visitations')}
              className="flex items-center gap-1.5 text-sm text-foreground-600 hover:text-foreground-950 transition-colors mb-3 cursor-pointer"
            >
              <i className="ri-arrow-left-line"></i>
              심방 목록으로
            </button>
          </div>

          <AnimatePresence>
            {successMsg && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-5 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-sm text-emerald-700">
                <i className="ri-check-line"></i>{successMsg}
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="bg-accent-100 border border-accent-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-accent-700 flex items-center gap-2"><i className="ri-error-warning-line"></i>{error}</p>
            </motion.div>
          )}

          <div className="bg-background-100 border border-background-200 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center">
                  <i className="ri-user-heart-line text-2xl text-primary-500"></i>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground-950">{visitation.student_name} 학생</h1>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusBadge(visitation.status)}`}>
                    {statusLabel(visitation.status)}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <i className="ri-calendar-line text-foreground-600 w-5"></i>
                <span className="text-foreground-700">{formatDateTime(visitation.scheduled_at)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <i className="ri-user-line text-foreground-600 w-5"></i>
                <span className="text-foreground-700">담당: {visitation.visitor_name}</span>
              </div>
              {visitation.topic && (
                <div className="flex items-start gap-2 text-sm">
                  <i className="ri-chat-3-line text-foreground-600 w-5 mt-0.5"></i>
                  <span className="text-foreground-700">{visitation.topic}</span>
                </div>
              )}
              {visitation.notes && (
                <div className="mt-4 p-4 bg-background-50 rounded-xl border border-background-200">
                  <p className="text-xs font-semibold text-foreground-500 mb-1">메모</p>
                  <p className="text-sm text-foreground-700 leading-relaxed whitespace-pre-wrap">{visitation.notes}</p>
                </div>
              )}
              {visitation.growth_record_summary && (
                <div className="mt-4 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                  <p className="text-xs font-semibold text-emerald-600 mb-1">
                    <i className="ri-plant-line mr-1"></i>성장 기록 연동됨
                  </p>
                  <p className="text-sm text-emerald-800 leading-relaxed">{visitation.growth_record_summary}</p>
                </div>
              )}
              {visitation.follow_up_needed && (
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-2 border border-amber-100">
                  <i className="ri-alert-line"></i>
                  후속 심방이 필요합니다
                </div>
              )}
            </div>

            {visitation.status === 'scheduled' && canModify && (
              <div className="mt-6 pt-5 border-t border-background-200">
                <h3 className="text-sm font-bold text-foreground-950 mb-4">심방 완료하기</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-foreground-600 mb-1.5">
                      심방 기록 ({completionNotes.length}/1000)
                    </label>
                    <textarea
                      name="completion_notes"
                      value={completionNotes}
                      onChange={(e) => setCompletionNotes(e.target.value)}
                      placeholder="심방 중 나눈 대화, 학생의 상태, 기도제목 등을 기록하세요..."
                      rows={4}
                      maxLength={1000}
                      className="w-full px-4 py-2.5 rounded-xl border border-background-200 bg-background-50 text-sm text-foreground-950 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300 transition-all resize-none"
                    ></textarea>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground-600 mb-1.5">
                      성장 기록 요약 (선택 — growth_records 테이블에 한 줄 자동 연동)
                    </label>
                    <input
                      type="text"
                      name="growth_summary"
                      value={growthSummary}
                      onChange={(e) => setGrowthSummary(e.target.value)}
                      placeholder="예: 신앙 상담 — 진로 고민 해결을 위한 기도와 멘토링 연결"
                      maxLength={300}
                      className="w-full px-4 py-2.5 rounded-xl border border-background-200 bg-background-50 text-sm text-foreground-950 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300 transition-all"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-foreground-700 cursor-pointer">
                    <input
                      type="checkbox"
                      name="follow_up_needed"
                      checked={followUpNeeded}
                      onChange={(e) => setFollowUpNeeded(e.target.checked)}
                      className="rounded"
                    />
                    후속 심방 필요
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2.5 rounded-full border border-rose-200 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      심방 취소
                    </button>
                    <button
                      onClick={handleComplete}
                      disabled={completing}
                      className="px-5 py-2.5 rounded-full bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {completing ? '처리 중...' : '완료 처리'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {visitation.status === 'completed' && canModify && (
              <div className="mt-6 pt-5 border-t border-background-200">
                {!isEditing ? (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-4 py-2.5 rounded-full border border-background-200 text-sm font-medium text-foreground-700 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-edit-line mr-1"></i>수정
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="px-4 py-2.5 rounded-full border border-rose-200 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <i className="ri-delete-bin-line mr-1"></i>{deleting ? '삭제 중...' : '삭제'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-foreground-950 mb-1">심방 기록 수정</h3>
                    <div>
                      <label className="block text-xs font-medium text-foreground-600 mb-1.5">
                        심방 기록 ({completionNotes.length}/1000)
                      </label>
                      <textarea
                        value={completionNotes}
                        onChange={(e) => setCompletionNotes(e.target.value)}
                        rows={4}
                        maxLength={1000}
                        className="w-full px-4 py-2.5 rounded-xl border border-background-200 bg-background-50 text-sm text-foreground-950 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300 transition-all resize-none"
                      ></textarea>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground-600 mb-1.5">
                        성장 기록 요약 (선택)
                      </label>
                      <input
                        type="text"
                        value={growthSummary}
                        onChange={(e) => setGrowthSummary(e.target.value)}
                        maxLength={300}
                        className="w-full px-4 py-2.5 rounded-xl border border-background-200 bg-background-50 text-sm text-foreground-950 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300 transition-all"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-foreground-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={followUpNeeded}
                        onChange={(e) => setFollowUpNeeded(e.target.checked)}
                        className="rounded"
                      />
                      후속 심방 필요
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setCompletionNotes(visitation.notes || '');
                          setGrowthSummary(visitation.growth_record_summary || '');
                          setFollowUpNeeded(visitation.follow_up_needed || false);
                        }}
                        className="px-4 py-2.5 rounded-full border border-background-200 text-sm font-medium text-foreground-700 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        취소
                      </button>
                      <button
                        onClick={handleUpdate}
                        disabled={completing}
                        className="px-5 py-2.5 rounded-full bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {completing ? '저장 중...' : '저장'}
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="ml-auto px-4 py-2.5 rounded-full border border-rose-200 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deleting ? '삭제 중...' : '삭제'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}