import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { CLUB_LABELS } from '@/types/auth';
import type { ClubType, UserRole } from '@/types/auth';
import { formatPracticeDate, getAttendanceSummary, parsePracticeEntries } from '@/lib/weeklyReport';

export type ReportType = 'weekly' | 'growth' | 'event';
type ReportStatus = 'submitted' | 'president_reviewed' | 'reviewed';

type ReviewItem = {
  id: string;
  report_type: ReportType;
  title: string;
  subtitle: string;
  author_id: string;
  author_name: string;
  club: ClubType;
  date: string;
  submitted_at: string;
  status: ReportStatus;
  feedback: string;
  reviewer_name: string;
  content_sections: { label: string; content: string }[];
};

const labels: Record<ReportType, string> = { weekly: '주간 보고서', growth: '성장 기록', event: '행사 보고서' };
const statuses: Record<string, string> = { submitted: '회장 1차 검토 대기', president_reviewed: '담당 교사 2차 검토 대기', reviewed: '부장 총검토 대기' };
const roleTitle: Record<string, string> = { president: '회장 1차 검토', teacher: '담당 교사 2차 검토', chief: '부장 총검토' };

function mapWeekly(r: Record<string, unknown>): ReviewItem {
  const entries = parsePracticeEntries(r.practice_entries); const summary = getAttendanceSummary(entries);
  return { id: r.id as string, report_type: 'weekly', title: `${CLUB_LABELS[r.club as ClubType]} 주간 보고서`, subtitle: entries.length ? `${summary.practiceCount}회 연습 · 평균 출석 ${summary.averageAttendance}/${r.total_members}명` : `출석 ${r.attendance_count}/${r.total_members}명`, author_id: r.author_id as string, author_name: (r.author_name as string) || '', club: r.club as ClubType, date: (r.week_start as string) || '', submitted_at: r.created_at as string, status: r.status as ReportStatus, feedback: (r.feedback as string) || '', reviewer_name: (r.reviewer_name as string) || '', content_sections: [{ label: '연습일별 기록', content: entries.map((e) => `${formatPracticeDate(e.practice_date)} · 출석 ${e.attendance_count ?? '-'}명\n${e.progress_summary}${e.special_notes ? `\n특이: ${e.special_notes}` : ''}`).join('\n\n') || (r.progress_summary as string) || '' }, { label: '주간 총평', content: (r.progress_summary as string) || '' }, { label: '주간 특이 사항', content: (r.special_notes as string) || '' }] };
}
function mapGrowth(r: Record<string, unknown>): ReviewItem { return { id: r.id as string, report_type: 'growth', title: `${r.student_name || '학생'} 성장 기록`, subtitle: '영적 성장 · 참여도 변화', author_id: r.author_id as string, author_name: (r.author_name as string) || '', club: r.club as ClubType, date: (r.record_date as string) || '', submitted_at: r.created_at as string, status: r.status as ReportStatus, feedback: (r.feedback as string) || '', reviewer_name: (r.reviewer_name as string) || '', content_sections: [{ label: '영적 성장', content: (r.spiritual_growth as string) || '' }, { label: '참여도 변화', content: (r.participation_change as string) || '' }, { label: '기도제목', content: (r.prayer_requests as string) || '' }] }; }
function mapEvent(r: Record<string, unknown>): ReviewItem { return { id: r.id as string, report_type: 'event', title: (r.event_name as string) || '행사 보고서', subtitle: `${r.participant_count || 0}명 참여`, author_id: r.author_id as string, author_name: (r.author_name as string) || '', club: r.club as ClubType, date: (r.event_date as string) || '', submitted_at: r.created_at as string, status: r.status as ReportStatus, feedback: (r.feedback as string) || '', reviewer_name: (r.reviewer_name as string) || '', content_sections: [{ label: '성과 요약', content: (r.performance_summary as string) || '' }, { label: '개선점', content: (r.improvement_points as string) || '' }, { label: '참가자 피드백', content: (r.feedback_text as string) || '' }] }; }

async function notifyUsers(userIds: string[], title: string, message: string) {
  const ids = [...new Set(userIds.filter(Boolean))]; if (!ids.length) return;
  const { error } = await supabase.from('notifications').insert(ids.map((user_id) => ({ user_id, type: 'report_review', title, message, is_read: false, link_url: '/reports/review' })));
  if (error) console.warn('[report-review] notification failed:', error.message);
}

export default function ReportReviewWorkflow() {
  const { profile } = useAuth();
  const role = (profile?.role || 'member') as UserRole;
  const canReview = role === 'president' || role === 'teacher' || role === 'chief';
  const [items, setItems] = useState<ReviewItem[]>([]); const [typeFilter, setTypeFilter] = useState<'all' | ReportType>('all'); const [clubFilter, setClubFilter] = useState<'all' | string>('all'); const [selected, setSelected] = useState<ReviewItem | null>(null); const [feedback, setFeedback] = useState(''); const [selectedIds, setSelectedIds] = useState<string[]>([]); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!canReview) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const queryStatus = role === 'president' ? 'submitted' : role === 'teacher' ? 'president_reviewed' : 'reviewed';
      const [w, g, e] = await Promise.all([
        supabase.from('weekly_reports').select('*').eq('status', queryStatus).order('created_at', { ascending: false }),
        supabase.from('growth_records').select('*').eq('status', queryStatus).order('created_at', { ascending: false }),
        supabase.from('event_reports').select('*').eq('status', queryStatus).order('created_at', { ascending: false }),
      ]);
      if (w.error || g.error || e.error) throw new Error(w.error?.message || g.error?.message || e.error?.message);
      const all = [...(w.data || []).map(mapWeekly), ...(g.data || []).map(mapGrowth), ...(e.data || []).map(mapEvent)];
      all.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()); setItems(all); setSelectedIds([]);
    } catch (err) { setError(err instanceof Error ? err.message : '보고서를 불러오지 못했습니다.'); } finally { setLoading(false); }
  }, [canReview, role]);
  useEffect(() => { void load(); }, [load]);

  const clubs = useMemo(() => [...new Set(items.map((item) => item.club))], [items]);
  const filtered = useMemo(() => items.filter((item) => (typeFilter === 'all' || item.report_type === typeFilter) && (clubFilter === 'all' || item.club === clubFilter)), [items, typeFilter, clubFilter]);
  const selectedBatchType = selectedIds.length ? filtered.find((item) => item.id === selectedIds[0])?.report_type : undefined;
  const batchable = role === 'chief' && !!selectedBatchType && selectedIds.every((id) => filtered.some((item) => item.id === id && item.report_type === selectedBatchType));

  const review = async (action: 'approve' | 'reject') => {
    if (!selected) return;
    if (!feedback.trim()) { setError('검토 의견을 입력해주세요.'); return; }
    setSaving(true); setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('review_report', { p_report_type: selected.report_type, p_report_id: selected.id, p_action: action, p_feedback: feedback.trim() });
      if (rpcError || !data?.ok) throw new Error(rpcError?.message || '검토 처리에 실패했습니다.');
      const title = action === 'approve' ? `${labels[selected.report_type]} 검토 완료` : `${labels[selected.report_type]} 반려`;
      if (action === 'approve' && role === 'president') {
        const { data: rows } = await supabase.from('club_teachers').select('teacher_id').eq('club', selected.club);
        let teacherIds = (rows || []).map((r: { teacher_id: string }) => r.teacher_id);
        if (!teacherIds.length) { const { data: fallback } = await supabase.from('user_roles').select('user_id').eq('role', 'teacher').eq('club', selected.club).eq('is_active', true); teacherIds = (fallback || []).map((r: { user_id: string }) => r.user_id); }
        await notifyUsers(teacherIds, title, `${CLUB_LABELS[selected.club]} ${labels[selected.report_type]}가 회장 검토를 통과했습니다. 담당 교사 2차 검토가 필요합니다.`);
      } else if (action === 'approve' && role === 'teacher') {
        const { data: chiefs } = await supabase.from('user_roles').select('user_id').eq('role', 'chief').eq('is_active', true); await notifyUsers((chiefs || []).map((r: { user_id: string }) => r.user_id), title, `${labels[selected.report_type]} 담당 교사 2차 검토가 완료되었습니다. 부장 총검토 대상입니다.`);
      } else if (action === 'approve' && role === 'chief') {
        await notifyUsers([selected.author_id], title, `${labels[selected.report_type]} 총검토가 완료되었습니다.`);
      } else {
        await notifyUsers([selected.author_id], title, `${labels[selected.report_type]}가 반려되었습니다. 검토 의견을 확인하고 수정 후 다시 제출해주세요.`);
      }
      setSelected(null); setFeedback(''); await load();
    } catch (err) { setError(err instanceof Error ? err.message : '검토 처리 중 오류가 발생했습니다.'); } finally { setSaving(false); }
  };

  const batchApprove = async () => {
    if (!batchable || !selectedBatchType) return;
    setSaving(true); setError('');
    try {
      const chosen = filtered.filter((item) => selectedIds.includes(item.id) && item.report_type === selectedBatchType);
      const { data, error: rpcError } = await supabase.rpc('batch_finalize_reports', { p_report_type: selectedBatchType, p_report_ids: chosen.map((item) => item.id), p_feedback: '부장 총검토 완료' });
      if (rpcError || !data?.ok) throw new Error(rpcError?.message || '일괄 최종 검토에 실패했습니다.');
      await notifyUsers(chosen.map((item) => item.author_id), `${labels[selectedBatchType]} 총검토 완료`, `${labels[selectedBatchType]} 총검토가 완료되었습니다.`);
      await load(); setSelectedIds([]);
    } catch (err) { setError(err instanceof Error ? err.message : '일괄 처리 중 오류가 발생했습니다.'); } finally { setSaving(false); }
  };

  if (!canReview) return <div className="max-w-4xl mx-auto px-4 py-10"><div className="rounded-3xl border border-background-200 bg-background-100 p-8 text-center"><h1 className="text-xl font-bold text-foreground-950">보고서 검토 권한이 없습니다</h1><p className="text-sm text-foreground-600 mt-2">회장, 담당 교사, 부장만 이 화면을 사용할 수 있습니다.</p></div></div>;

  return <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10 pb-32 touch-manipulation">
    <div className="mb-6"><p className="text-xs font-bold text-primary-600 tracking-wide">REPORT REVIEW</p><h1 className="text-2xl md:text-3xl font-black text-foreground-950 mt-1">{roleTitle[role]}</h1><p className="text-sm text-foreground-600 mt-2">사명자 제출 → 회장 1차 → 담당 교사 2차 → 부장 총검토</p></div>
    {role === 'chief' && selectedIds.length > 0 && <div className="sticky top-3 z-30 mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><p className="text-sm font-bold text-emerald-800">{selectedIds.length}건 선택됨 · 같은 보고서 종류끼리 일괄 최종 검토</p><button type="button" onClick={batchApprove} disabled={!batchable || saving} className="min-h-11 px-4 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-50">{saving ? '처리 중...' : '선택 항목 일괄 최종검토'}</button></div>}
    <div className="flex gap-2 overflow-x-auto pb-2 mb-4">{(['all','weekly','growth','event'] as const).map((type) => <button key={type} type="button" onClick={() => { setTypeFilter(type); setSelectedIds([]); }} className={`min-h-10 px-4 rounded-full border text-sm font-semibold whitespace-nowrap ${typeFilter === type ? 'bg-primary-100 border-primary-200 text-primary-700' : 'bg-background-100 border-background-200 text-foreground-600'}`}>{type === 'all' ? '전체' : labels[type]}</button>)}</div>
    {clubs.length > 1 && <div className="flex gap-2 overflow-x-auto pb-2 mb-6"><button type="button" onClick={() => setClubFilter('all')} className={`min-h-10 px-4 rounded-full border text-sm font-semibold whitespace-nowrap ${clubFilter === 'all' ? 'bg-background-900 text-white' : 'bg-background-100 border-background-200 text-foreground-600'}`}>전체 동아리</button>{clubs.map((club) => <button key={club} type="button" onClick={() => setClubFilter(club)} className={`min-h-10 px-4 rounded-full border text-sm font-semibold whitespace-nowrap ${clubFilter === club ? 'bg-background-900 text-white' : 'bg-background-100 border-background-200 text-foreground-600'}`}>{CLUB_LABELS[club]}</button>)}</div>}
    {error && <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
    {loading ? <div className="py-20 text-center text-sm text-foreground-500">검토 대상 보고서를 불러오는 중...</div> : filtered.length === 0 ? <div className="py-20 text-center text-sm text-foreground-500">현재 이 단계에서 검토할 보고서가 없습니다.</div> : <div className="space-y-3">{filtered.map((item, index) => <motion.div key={`${item.report_type}-${item.id}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.03, 0.3) }} className="rounded-2xl border border-background-200 bg-background-100 p-4 md:p-5"><div className="flex gap-3 items-start">{role === 'chief' && <input aria-label="보고서 선택" type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => setSelectedIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} className="mt-1.5 h-5 w-5" />}<button type="button" onClick={() => { setSelected(item); setFeedback(''); setError(''); }} className="flex-1 text-left min-w-0"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="px-2.5 py-1 rounded-full bg-background-200 text-foreground-700 text-[11px] font-bold">{labels[item.report_type]}</span><span className="px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 text-[11px] font-bold">{statuses[item.status]}</span></div><h2 className="mt-2 text-base md:text-lg font-bold text-foreground-950 truncate">{item.title}</h2><p className="mt-1 text-xs md:text-sm text-foreground-600">{item.subtitle}</p></div><span className="shrink-0 text-xs text-foreground-500">›</span></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground-500"><span>{item.author_name}</span><span>{CLUB_LABELS[item.club]}</span><span>{item.date}</span></div></button></div></motion.div>)}</div>}
    {selected && <div className="fixed inset-0 z-50 flex justify-end"><button type="button" aria-label="닫기" onClick={() => setSelected(null)} className="absolute inset-0 bg-black/30" /><div className="relative w-full max-w-[560px] h-full overflow-y-auto bg-background-50 shadow-2xl p-5 md:p-6"><div className="sticky top-0 z-10 -mx-5 md:-mx-6 px-5 md:px-6 py-4 bg-background-50/95 backdrop-blur border-b border-background-200 flex items-center justify-between"><div><p className="text-xs font-bold text-primary-600">{labels[selected.report_type]}</p><h2 className="text-lg font-black text-foreground-950">{selected.title}</h2></div><button type="button" onClick={() => setSelected(null)} className="w-11 h-11 rounded-xl border border-background-200 text-xl">×</button></div><div className="py-5 space-y-4"><div className="text-sm text-foreground-600">작성자 {selected.author_name} · {CLUB_LABELS[selected.club]} · {selected.date}</div>{selected.content_sections.map((section) => <section key={section.label}><h3 className="text-sm font-bold text-foreground-900 mb-2">{section.label}</h3><div className="rounded-2xl border border-background-200 bg-background-100 p-4 text-sm leading-6 whitespace-pre-wrap text-foreground-800">{section.content || '내용 없음'}</div></section>)}{selected.feedback && <section><h3 className="text-sm font-bold text-foreground-900 mb-2">이전 검토 의견</h3><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 whitespace-pre-wrap text-amber-900">{selected.feedback}</div></section>}<section><h3 className="text-sm font-bold text-foreground-900 mb-2">{role === 'president' ? '회장 1차 검토 의견' : role === 'teacher' ? '담당 교사 2차 검토 의견' : '부장 총검토 의견'}</h3><textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={1000} rows={6} placeholder="검토 의견을 작성해주세요." className="w-full rounded-2xl border border-background-200 bg-background-100 p-4 text-sm resize-none outline-none focus:ring-2 focus:ring-primary-200" /><div className="mt-2 text-right text-xs text-foreground-400">{feedback.length}/1000</div></section><div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-8"><button type="button" onClick={() => review('reject')} disabled={saving} className="min-h-12 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-bold disabled:opacity-50">반려</button><button type="button" onClick={() => review('approve')} disabled={saving} className="min-h-12 rounded-xl bg-primary-600 text-white font-bold disabled:opacity-50">{saving ? '처리 중...' : role === 'chief' ? '최종 승인' : '검토 완료'}</button></div></div></div></div>}
  </div>;
}
