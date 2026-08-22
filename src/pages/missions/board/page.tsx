import { formatKoreanDate, formatKoreanDateTime } from '@/lib/date';
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { MISSION_CATEGORIES } from '@/constants/missionBadges';
import { Link } from 'react-router-dom';

interface Mission {
  id: string;
  title: string;
  description: string;
  category: string;
  club: string;
}

interface AssignmentWithMission {
  id: string;
  mission_id: string;
  mission_title: string;
  mission_category: string;
  status: string;
  assigned_at: string;
  completed_at: string | null;
  proof_image_url: string | null;
  proof_note: string | null;
  submitted_at: string | null;
  reject_reason: string | null;
}

export default function MissionBoardPage() {
  const { user } = useAuth();

  const [myAssignments, setMyAssignments] = useState<AssignmentWithMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState<'all' | 'assigned' | 'submitted' | 'completed' | 'rejected'>('all');
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Proof submission modal
  const [showProofModal, setShowProofModal] = useState(false);
  const [proofAssignmentId, setProofAssignmentId] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [proofNote, setProofNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    loadMyMissions();
  }, [user]);

  const loadMyMissions = async () => {
    setLoading(true);
    try {
      const { data: aData } = await supabase
        .from('mission_assignments')
        .select('*')
        .eq('student_id', user!.id)
        .order('assigned_at', { ascending: false });

      if (aData && aData.length > 0) {
        const missionIds = [...new Set(aData.map((a: { mission_id: string }) => a.mission_id))];
        const { data: mData } = await supabase
          .from('missions')
          .select('*')
          .in('id', missionIds);

        const missionMap = new Map((mData || []).map((m: { id: string; title: string; category: string }) => [m.id, m]));
        setMyAssignments(aData.map((a: { id: string; mission_id: string; status: string; assigned_at: string; completed_at: string | null; proof_image_url: string | null; proof_note: string | null; submitted_at: string | null; reject_reason: string | null }) => ({
          id: a.id,
          mission_id: a.mission_id,
          mission_title: missionMap.get(a.mission_id)?.title || '삭제된 미션',
          mission_category: missionMap.get(a.mission_id)?.category || 'general',
          status: a.status,
          assigned_at: a.assigned_at,
          completed_at: a.completed_at,
          proof_image_url: a.proof_image_url,
          proof_note: a.proof_note,
          submitted_at: a.submitted_at,
          reject_reason: a.reject_reason,
        })));
      }
    } catch {
      setError('미션 목록을 불러오는 중 문제가 발생했어요. 다시 시도해주세요');
    }
    setLoading(false);
  };

  const openProofModal = (assignmentId: string) => {
    const existing = myAssignments.find(a => a.id === assignmentId);
    setProofAssignmentId(assignmentId);
    setProofFile(null);
    setProofPreview(existing?.proof_image_url || null);
    setProofNote(existing?.proof_note || '');
    setShowProofModal(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setProofPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitProof = async () => {
    if (!proofAssignmentId || (!proofFile && !proofPreview) || proofNote.trim().length < 10) return;
    setUploading(true);
    setMsg('');
    try {
      // Upload image only if a new file was picked; otherwise keep the existing image (note-only edit)
      let proofImageUrl = proofPreview;
      if (proofFile) {
        const fileExt = proofFile.name.split('.').pop() || 'jpg';
        const filePath = `missions/proof/${proofAssignmentId}_${Date.now()}.${fileExt}`;
        const { error: uploadErr } = await supabase.storage.from('Public').upload(filePath, proofFile, {
          cacheControl: '3600',
          upsert: false,
        });

        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage.from('Public').getPublicUrl(filePath);
        proofImageUrl = urlData.publicUrl;
      }

      // Update assignment
      const { error: updateErr } = await supabase
        .from('mission_assignments')
        .update({
          status: 'submitted',
          proof_image_url: proofImageUrl,
          proof_note: proofNote.trim(),
          submitted_at: new Date().toISOString(),
        })
        .eq('id', proofAssignmentId)
        .eq('student_id', user!.id);

      if (updateErr) throw updateErr;

      setMsg('인증이 제출되었습니다! 승인을 기다려주세요.');
      setShowProofModal(false);
      setProofAssignmentId(null);
      setProofFile(null);
      setProofPreview(null);
      setProofNote('');
      loadMyMissions();
    } catch (err) {
      console.error('인증 제출 실패:', err);
      setMsg('인증 제출에 실패했습니다. 다시 시도해주세요.');
    }
    setUploading(false);
  };

  const handleDeleteProof = async (assignmentId: string) => {
    if (!confirm('업로드한 인증(사진/내용)을 삭제할까요? 삭제 후 다시 제출할 수 있어요.')) return;
    setDeletingId(assignmentId);
    setMsg('');
    try {
      const { error: deleteErr } = await supabase
        .from('mission_assignments')
        .update({
          status: 'assigned',
          proof_image_url: null,
          proof_note: null,
          submitted_at: null,
          completed_at: null,
          reviewed_by: null,
          reviewed_at: null,
          reject_reason: null,
        })
        .eq('id', assignmentId)
        .eq('student_id', user!.id);

      if (deleteErr) throw deleteErr;

      setMsg('인증이 삭제되었습니다.');
      loadMyMissions();
    } catch (err) {
      console.error('인증 삭제 실패:', err);
      setMsg('인증 삭제에 실패했습니다. 다시 시도해주세요.');
    }
    setDeletingId(null);
  };

  const filtered = myAssignments.filter(a => {
    if (filter === 'all') return true;
    return a.status === filter;
  });

  const assignedCount = myAssignments.filter(a => a.status === 'assigned').length;
  const submittedCount = myAssignments.filter(a => a.status === 'submitted').length;
  const completedCount = myAssignments.filter(a => a.status === 'completed').length;
  const rejectedCount = myAssignments.filter(a => a.status === 'rejected').length;

  const statusBadge = (status: string) => {
    switch (status) {
      case 'assigned': return { label: '진행 중', color: 'bg-amber-100 text-amber-700' };
      case 'submitted': return { label: '승인 대기 중', color: 'bg-sky-100 text-sky-700' };
      case 'completed': return { label: '인증 완료', color: 'bg-emerald-100 text-emerald-700' };
      case 'rejected': return { label: '반려됨', color: 'bg-rose-100 text-rose-700' };
      default: return { label: status, color: 'bg-background-200 text-foreground-500' };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary-400 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 md:py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-6 md:mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent-100 border border-accent-200 mb-4">
              <i className="ri-medal-line text-2xl text-accent-600"></i>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground-950 mb-1">내 작은 사명</h1>
            <p className="text-sm text-foreground-600">맡은 미션을 확인하고 인증하세요</p>
            <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
              <Link
                to="/missions/leaderboard"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold hover:bg-amber-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-trophy-line"></i>이달의 사명왕 보기
              </Link>
              <Link
                to="/missions/wall"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold hover:bg-emerald-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-gallery-line"></i>인증 게시판
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            {[
              { count: assignedCount, label: '진행 중', color: 'bg-amber-50 text-amber-700' },
              { count: submittedCount, label: '승인 대기', color: 'bg-sky-50 text-sky-700' },
              { count: completedCount, label: '인증 완료', color: 'bg-emerald-50 text-emerald-700' },
              { count: rejectedCount, label: '반려', color: 'bg-rose-50 text-rose-700' },
            ].map(s => (
              <div key={s.label} className={`${s.color} rounded-2xl p-3 text-center`}>
                <p className="text-lg font-bold">{s.count}</p>
                <p className="text-[10px] font-medium mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 mb-5 px-1 py-1 rounded-full bg-background-200/70 w-fit overflow-x-auto max-w-full">
            {(['all', 'assigned', 'submitted', 'completed', 'rejected'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${filter === f ? 'bg-background-100 text-foreground-950 shadow-sm' : 'text-foreground-600 hover:text-foreground-800'}`}
              >
                {f === 'all' ? '전체' : f === 'assigned' ? '진행 중' : f === 'submitted' ? '승인 대기' : f === 'completed' ? '인증 완료' : '반려'}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 bg-accent-100 border border-accent-200 rounded-xl flex items-center justify-between text-sm text-accent-700">
              <span className="flex items-center gap-2"><i className="ri-error-warning-line"></i>{error}</span>
              <button onClick={loadMyMissions} className="text-xs text-accent-600 underline cursor-pointer">다시 시도</button>
            </div>
          )}

          {msg && (
            <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 ${msg.includes('실패') ? 'bg-rose-100 border border-rose-200 text-rose-700' : 'bg-emerald-100 border border-emerald-200 text-emerald-700'}`}>
              <i className={msg.includes('실패') ? 'ri-error-warning-line' : 'ri-check-line'}></i>
              {msg}
            </div>
          )}

          {/* Mission list */}
          <div className="space-y-2">
            {filtered.length === 0 && (
              <div className="text-center py-12">
                <div className="w-14 h-14 rounded-2xl bg-background-200 flex items-center justify-center mx-auto mb-3">
                  <i className="ri-checkbox-circle-line text-2xl text-foreground-400"></i>
                </div>
                <p className="text-sm text-foreground-500">
                  {filter === 'completed' ? '아직 인증 완료된 미션이 없어요' : filter === 'submitted' ? '승인 대기 중인 미션이 없어요' : filter === 'rejected' ? '반려된 미션이 없어요' : '맡은 미션이 없습니다'}
                </p>
              </div>
            )}
            {filtered.map(a => {
              const cat = MISSION_CATEGORIES[a.mission_category] || MISSION_CATEGORIES.general;
              const badge = statusBadge(a.status);
              const isAssigned = a.status === 'assigned';
              const isRejected = a.status === 'rejected';
              const isSubmitted = a.status === 'submitted';
              const isCompleted = a.status === 'completed';

              return (
                <div
                  key={a.id}
                  className={`bg-background-100 border rounded-2xl p-4 transition-colors ${
                    isCompleted ? 'border-emerald-200' : isSubmitted ? 'border-sky-200' : isRejected ? 'border-rose-200' : 'border-background-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isCompleted ? 'bg-emerald-100' : isSubmitted ? 'bg-sky-100' : isRejected ? 'bg-rose-100' : 'bg-accent-100'
                    }`}>
                      <i className={`${cat.icon} ${
                        isCompleted ? 'text-emerald-600' : isSubmitted ? 'text-sky-600' : isRejected ? 'text-rose-600' : 'text-accent-600'
                      }`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-foreground-950">{a.mission_title}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-foreground-500">{cat.label}</span>
                        <span className="text-xs text-foreground-400">· {formatKoreanDate(a.assigned_at)} 배정</span>
                      </div>
                      {isSubmitted && a.submitted_at && (
                        <p className="text-xs text-sky-600 mt-1">
                          <i className="ri-time-line mr-1"></i>
                          {formatKoreanDate(a.submitted_at)} 제출 - 승인 대기 중
                        </p>
                      )}
                      {isCompleted && a.completed_at && (
                        <p className="text-xs text-emerald-600 mt-1">
                          <i className="ri-check-double-line mr-1"></i>
                          {formatKoreanDate(a.completed_at)} 인증 완료
                        </p>
                      )}
                      {isRejected && a.reject_reason && (
                        <p className="text-xs text-rose-600 mt-1">
                          <i className="ri-close-circle-line mr-1"></i>
                          반려 사유: {a.reject_reason}
                        </p>
                      )}
                      {/* Show proof image if submitted/completed/rejected */}
                      {(isSubmitted || isCompleted || isRejected) && a.proof_image_url && (
                        <div className="mt-2">
                          <img
                            src={a.proof_image_url}
                            alt="인증 사진"
                            className="w-20 h-20 rounded-lg object-cover border border-background-200"
                          />
                        </div>
                      )}
                    </div>
                    {/* Action buttons */}
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      {(isAssigned || isRejected || isSubmitted) && (
                        <button
                          onClick={() => openProofModal(a.id)}
                          disabled={submittingId === a.id}
                          className="px-4 py-2 rounded-full bg-primary-500 text-background-50 text-xs font-semibold hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                        >
                          {isAssigned ? '인증 제출하기' : '수정'}
                        </button>
                      )}
                      {(isSubmitted || isCompleted || isRejected) && a.proof_image_url && (
                        <button
                          onClick={() => handleDeleteProof(a.id)}
                          disabled={deletingId === a.id}
                          className="px-4 py-2 rounded-full bg-background-200 text-foreground-600 text-xs font-semibold hover:bg-rose-100 hover:text-rose-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                        >
                          {deletingId === a.id ? '삭제 중...' : '삭제'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Proof Submission Modal */}
      {showProofModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => { if (!uploading) setShowProofModal(false); }}></div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-background-100 rounded-2xl shadow-xl max-w-md w-full p-6 z-10 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-lg font-bold text-foreground-950 mb-4">인증 제출하기</h3>

            {/* Photo upload */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground-700 mb-2">인증 사진 (필수)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />
              {proofPreview ? (
                <div className="relative">
                  <img
                    src={proofPreview}
                    alt="미리보기"
                    className="w-full h-48 object-cover rounded-xl border border-background-200"
                  />
                  <button
                    onClick={() => { setProofFile(null); setProofPreview(null); }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center cursor-pointer hover:bg-black/70 transition-colors"
                  >
                    <i className="ri-close-line text-white text-sm"></i>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-36 border-2 border-dashed border-background-300 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary-400 hover:bg-primary-50/50 transition-colors cursor-pointer"
                >
                  <i className="ri-camera-line text-2xl text-foreground-400"></i>
                  <span className="text-sm text-foreground-500">사진 업로드하기</span>
                  <span className="text-xs text-foreground-400">JPG, PNG, 최대 10MB</span>
                </button>
              )}
            </div>

            {/* Note */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-foreground-700 mb-2">
                소감 / 설명 <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={proofNote}
                onChange={e => setProofNote(e.target.value)}
                placeholder="미션을 어떻게 수행했는지, 느낀 점을 자유롭게 적어주세요 (최소 10자)"
                rows={4}
                maxLength={500}
                className="w-full px-4 py-3 text-sm rounded-xl border border-background-200 bg-background-50 focus:border-primary-400 outline-none resize-none"
              />
              <p className="text-xs text-foreground-500 mt-1 text-right">
                {proofNote.length}/500{proofNote.length < 10 ? ' (최소 10자)' : ''}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleSubmitProof}
                disabled={uploading || (!proofFile && !proofPreview) || proofNote.trim().length < 10}
                className="flex-1 py-2.5 rounded-full bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                {uploading ? '업로드 중...' : '제출하기'}
              </button>
              <button
                onClick={() => setShowProofModal(false)}
                disabled={uploading}
                className="px-4 py-2.5 rounded-full bg-background-200 text-foreground-600 text-sm font-semibold hover:bg-background-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                취소
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
