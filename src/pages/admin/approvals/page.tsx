import { formatKoreanDate, formatKoreanDateTime } from '@/lib/date';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

interface PendingUser {
  user_id: string;
  name: string;
  role: string;
  club: string | null;
  gender: string | null;
  birth_year: number | null;
  interests: string | null;
  created_at: string;
}

export default function AdminApprovals() {
  const { user, profile, hasRole } = useAuth();
  const isChief = hasRole('chief');
  const isTeacher = hasRole('teacher');

  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [approvedUsers, setApprovedUsers] = useState<PendingUser[]>([]);
  const [rejectedUsers, setRejectedUsers] = useState<PendingUser[]>([]);
  const [historyTab, setHistoryTab] = useState<'pending' | 'approved' | 'rejected'>('pending');

  useEffect(() => {
    loadPendingUsers();
  }, []);

  useEffect(() => {
    if (historyTab === 'approved') loadApprovedUsers();
    if (historyTab === 'rejected') loadRejectedUsers();
  }, [historyTab]);

  const loadPendingUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('user_roles')
        .select('*')
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false });

      if (fetchErr) {
        setError('승인 대기 목록을 불러오지 못했습니다.');
        console.error(fetchErr);
        return;
      }

      setPendingUsers(data || []);
    } catch (e) {
      setError('데이터 로딩 중 오류가 발생했습니다.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadApprovedUsers = async () => {
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('*')
        .eq('approval_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(20);
      setApprovedUsers(data || []);
    } catch { /* ignore */ }
  };

  const loadRejectedUsers = async () => {
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('*')
        .eq('approval_status', 'rejected')
        .order('created_at', { ascending: false })
        .limit(20);
      setRejectedUsers(data || []);
    } catch { /* ignore */ }
  };

  const handleApprove = async (userId: string) => {
    setProcessingId(userId);
    setMessage(null);
    try {
      const { error: updateErr } = await supabase
        .from('user_roles')
        .update({ approval_status: 'approved' })
        .eq('user_id', userId);

      if (updateErr) {
        setMessage({ type: 'error', text: '승인 처리 중 오류가 발생했습니다: ' + updateErr.message });
        return;
      }

      // Send notification to the approved user
      const approved = pendingUsers.find(u => u.user_id === userId);
      if (approved) {
        await supabase.from('notifications').insert({
          user_id: userId,
          type: 'approval',
          title: '회원가입이 승인되었습니다',
          message: `${approved.name}님, 회원가입이 승인되었습니다. 이제 모든 기능을 이용하실 수 있습니다.`,
          is_read: false,
          link_url: '/',
        });
      }

      setPendingUsers(prev => prev.filter(u => u.user_id !== userId));
      setMessage({ type: 'success', text: '승인되었습니다!' });
    } catch (e) {
      setMessage({ type: 'error', text: '처리 중 오류가 발생했습니다.' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (userId: string) => {
    setProcessingId(userId);
    setMessage(null);
    try {
      const { error: updateErr } = await supabase
        .from('user_roles')
        .update({ approval_status: 'rejected' })
        .eq('user_id', userId);

      if (updateErr) {
        setMessage({ type: 'error', text: '거절 처리 중 오류가 발생했습니다: ' + updateErr.message });
        return;
      }

      setPendingUsers(prev => prev.filter(u => u.user_id !== userId));
      setMessage({ type: 'success', text: '거절 처리되었습니다.' });
    } catch (e) {
      setMessage({ type: 'error', text: '처리 중 오류가 발생했습니다.' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRevokeApproval = async (userId: string, userName: string) => {
    if (!confirm(`${userName}님의 승인을 철회할까요? 철회 시 즉시 접근이 차단됩니다.`)) return;
    setProcessingId(userId);
    setMessage(null);
    try {
      const { error: updateErr } = await supabase
        .from('user_roles')
        .update({ approval_status: 'pending' })
        .eq('user_id', userId);
      if (updateErr) {
        setMessage({ type: 'error', text: '승인 철회 중 오류가 발생했습니다: ' + updateErr.message });
        return;
      }
      // Log the audit action
      await supabase.from('audit_logs').insert({
        target_user_id: userId,
        target_user_name: userName,
        action: 'approval_revoked',
        performed_by: user!.id,
        performed_by_name: profile?.name || '',
      }).then(undefined, () => {});
      // Send notification
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'approval_revoked',
        title: '가입 승인이 철회되었습니다',
        message: `${userName}님, 회원가입 승인이 철회되어 다시 승인 대기 상태로 변경되었습니다.`,
        is_read: false,
        link_url: '/',
      }).then(undefined, () => {});
      setApprovedUsers(prev => prev.filter(u => u.user_id !== userId));
      setMessage({ type: 'success', text: '승인이 철회되었습니다.' });
    } catch {
      setMessage({ type: 'error', text: '처리 중 오류가 발생했습니다.' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRevokeRejection = async (userId: string, userName: string) => {
    if (!confirm(`${userName}님의 거절을 철회할까요? 철회 시 다시 승인 대기 상태로 변경됩니다.`)) return;
    setProcessingId(userId);
    setMessage(null);
    try {
      const { error: updateErr } = await supabase
        .from('user_roles')
        .update({ approval_status: 'pending' })
        .eq('user_id', userId);
      if (updateErr) {
        setMessage({ type: 'error', text: '거절 철회 중 오류가 발생했습니다: ' + updateErr.message });
        return;
      }
      await supabase.from('audit_logs').insert({
        target_user_id: userId,
        target_user_name: userName,
        action: 'rejection_revoked',
        performed_by: user!.id,
        performed_by_name: profile?.name || '',
      }).then(undefined, () => {});
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'rejection_revoked',
        title: '가입 거절이 철회되었습니다',
        message: `${userName}님, 가입 거절이 철회되어 다시 승인 대기 상태로 변경되었습니다.`,
        is_read: false,
        link_url: '/',
      }).then(undefined, () => {});
      setRejectedUsers(prev => prev.filter(u => u.user_id !== userId));
      setMessage({ type: 'success', text: '거절이 철회되었습니다.' });
    } catch {
      setMessage({ type: 'error', text: '처리 중 오류가 발생했습니다.' });
    } finally {
      setProcessingId(null);
    }
  };

  if (!isTeacher && !isChief) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-[20px] bg-rose-100 flex items-center justify-center mx-auto mb-4">
            <i className="ri-shield-keyhole-line text-3xl text-rose-600"></i>
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
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <i className="ri-user-star-line text-xl text-amber-600"></i>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground-950">가입 승인 관리</h1>
            </div>
            <p className="text-sm text-foreground-600">신규 회원가입 승인 대기 목록입니다. 승인 전까지는 아무 페이지에도 접근할 수 없습니다.</p>
          </div>

          {error && (
            <div className="bg-accent-100 border border-accent-200 rounded-[20px] p-4 mb-6">
              <p className="text-sm text-accent-700 flex items-center gap-2">
                <i className="ri-error-warning-line"></i>{error}
              </p>
              <button onClick={loadPendingUsers} className="mt-2 text-xs text-accent-600 underline cursor-pointer">다시 시도</button>
            </div>
          )}

          {message && (
            <div className={`rounded-[16px] p-4 mb-6 ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200'}`}>
              <p className={`text-sm flex items-center gap-2 ${message.type === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
                <i className={message.type === 'success' ? 'ri-check-line' : 'ri-close-line'}></i>
                {message.text}
              </p>
            </div>
          )}

          {pendingUsers.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
                <i className="ri-check-double-line text-3xl text-emerald-500"></i>
              </div>
              <h3 className="text-lg font-semibold text-foreground-950 mb-2">승인 대기 중인 회원이 없습니다</h3>
              <p className="text-sm text-foreground-600">모든 신규 가입이 처리되었습니다.</p>
              <Link to="/teacher-dashboard" className="inline-flex items-center gap-1.5 mt-4 text-sm text-primary-600 hover:text-primary-700 cursor-pointer">
                <i className="ri-arrow-left-line"></i>
                교사 대시보드로 돌아가기
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {/* History tabs */}
              <div className="flex items-center gap-1 bg-background-200 rounded-full p-1 mb-4">
                {(['pending', 'approved', 'rejected'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setHistoryTab(tab)}
                    className={`flex-1 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      historyTab === tab ? 'bg-background-100 text-foreground-950 shadow-sm' : 'text-foreground-600 hover:text-foreground-950'
                    }`}
                  >
                    {tab === 'pending' ? `승인 대기 (${pendingUsers.length})` : tab === 'approved' ? `승인 완료` : `거절`}
                  </button>
                ))}
              </div>

              {/* Pending users */}
              {historyTab === 'pending' && (
                <div className="space-y-3">
                  {pendingUsers.map((u, idx) => (
                    <motion.div
                      key={u.user_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.05, 0.3) }}
                      className="bg-background-100 border border-background-200 rounded-[20px] p-5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-bold text-amber-700">{u.name.charAt(0)}</span>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-foreground-800">{u.name}</p>
                              <p className="text-xs text-foreground-500">
                                {u.gender && `${u.gender} · `}
                                {u.birth_year && `${u.birth_year}년생 · `}
                                가입 {formatKoreanDate(u.created_at)}
                              </p>
                            </div>
                          </div>
                          {u.interests && (
                            <div className="flex flex-wrap gap-1 ml-13 mb-2">
                              {u.interests.split(',').map((interest: string) => (
                                <span key={interest} className="text-[10px] px-2 py-0.5 rounded-full bg-background-200 text-foreground-600">{interest.trim()}</span>
                              ))}
                            </div>
                          )}
                          {u.club && (
                            <p className="text-xs text-primary-600 ml-13">
                              <i className="ri-group-line mr-1"></i>{u.club}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleApprove(u.user_id)}
                            disabled={processingId === u.user_id}
                            className="px-4 py-2 rounded-full bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
                          >
                            {processingId === u.user_id ? '처리 중...' : '승인'}
                          </button>
                          <button
                            onClick={() => handleReject(u.user_id)}
                            disabled={processingId === u.user_id}
                            className="px-4 py-2 rounded-full border-2 border-rose-200 text-rose-600 text-sm font-semibold hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
                          >
                            거절
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}