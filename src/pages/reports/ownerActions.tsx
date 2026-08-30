import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

type ReportType = 'weekly' | 'growth' | 'event';
const tableMap: Record<ReportType, string> = { weekly: 'weekly_reports', growth: 'growth_records', event: 'event_reports' };

export default function ReportOwnerActions({ reportType, reportId }: { reportType: ReportType; reportId: string }) {
  const { user } = useAuth(); const navigate = useNavigate();
  const [canWithdraw, setCanWithdraw] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; (async () => { if (!user) return; const { data } = await supabase.from(tableMap[reportType]).select('author_id,status').eq('id', reportId).maybeSingle(); if (!active || !data) return; setCanWithdraw(data.author_id === user.id && ['submitted','president_reviewed','rejected'].includes(data.status)); })(); return () => { active = false; }; }, [user, reportType, reportId]);
  if (!canWithdraw) return null;
  const withdraw = async () => { if (!window.confirm('이 보고서를 회수할까요? 실제 데이터는 삭제되지 않고 회수 기록으로 보존됩니다.')) return; setBusy(true); const { error } = await supabase.rpc('withdraw_report', { p_report_type: reportType, p_report_id: reportId, p_note: '작성자가 제출한 보고서를 직접 회수' }); setBusy(false); if (error) return; navigate(reportType === 'weekly' ? '/reports/weekly' : reportType === 'growth' ? '/reports/growth' : '/reports/events'); };
  return <div className="mx-auto max-w-6xl px-4 md:px-6 pb-24"><div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><p className="text-sm font-bold text-orange-900">제출한 내용이 잘못되었나요?</p><p className="text-xs text-orange-800 mt-1">회수하면 목록에서 내려가지만 데이터와 수정 이력은 삭제되지 않습니다.</p></div><button type="button" onClick={withdraw} disabled={busy} className="min-h-11 px-4 rounded-xl border border-orange-300 bg-white text-orange-700 text-sm font-bold disabled:opacity-50">{busy ? '회수 중...' : '보고서 회수'}</button></div></div></div>;
}
