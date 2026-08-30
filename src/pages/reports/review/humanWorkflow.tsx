import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { CLUB_LABELS } from '@/types/auth';
import type { ClubType, UserRole } from '@/types/auth';
import { parsePracticeEntries, getAttendanceSummary, formatPracticeDate } from '@/lib/weeklyReport';

type ReportType = 'weekly' | 'growth' | 'event';
type Status = 'submitted' | 'president_reviewed' | 'reviewed' | 'approved' | 'rejected';
type Item = Record<string, any> & { id: string; report_type: ReportType; club: ClubType; author_id: string; author_name: string; title: string; subtitle: string; status: Status; date: string };

const labels: Record<ReportType, string> = { weekly: '주간 보고서', growth: '성장 기록', event: '행사 보고서' };
const statusText: Record<Status, string> = { submitted: '회장 1차 검토 대기', president_reviewed: '담당 교사 2차 검토 대기', reviewed: '부장 총검토 대기', approved: '최종 승인', rejected: '수정 요청' };
const clubs: ClubType[] = ['saeullim', 'cheonjipoong', 'cheonjihu', 'munhwabu', 'cheonhwarae_cheongmyeong'];

function mapRows(type: ReportType, rows: Record<string, any>[]): Item[] {
  return rows.map((r) => {
    const common = { ...r, id: r.id, report_type: type, club: r.club as ClubType, author_id: r.author_id, author_name: r.author_name || '', status: r.status as Status };
    if (type === 'weekly') {
      const entries = parsePracticeEntries(r.practice_entries); const summary = getAttendanceSummary(entries);
      return { ...common, title: `${CLUB_LABELS[r.club as ClubType]} 주간 보고서`, subtitle: entries.length ? `${summary.practiceCount}회 연습 · 평균 출석 ${summary.averageAttendance}/${r.total_members}명` : `출석 ${r.attendance_count}/${r.total_members}명`, date: r.week_start || r.created_at };
    }
    if (type === 'growth') return { ...common, title: `${r.student_name || '학생'} 성장 기록`, subtitle: '영적 성장 · 참여도 변화', date: r.record_date || r.created_at };
    return { ...common, title: r.event_name || '행사 보고서', subtitle: `${r.participant_count || 0}명 참여`, date: r.event_date || r.created_at };
  });
}

function fields(item: Item) {
  if (item.report_type === 'weekly') return [
    { key: 'progress_summary', label: '주간 총평', kind: 'text' },
    { key: 'special_notes', label: '특이 사항', kind: 'text' },
    { key: 'attendance_count', label: '대표 출석 수', kind: 'number' },
  ];
  if (item.report_type === 'growth') return [
    { key: 'student_name', label: '학생 이름', kind: 'input' },
    { key: 'spiritual_growth', label: '영적 성장', kind: 'text' },
    { key: 'participation_change', label: '참여도 변화', kind: 'text' },
    { key: 'prayer_requests', label: '기도제목', kind: 'text' },
  ];
  return [
    { key: 'event_name', label: '행사명', kind: 'input' },
    { key: 'participant_count', label: '참여 인원', kind: 'number' },
    { key: 'performance_summary', label: '성과 요약', kind: 'text' },
    { key: 'improvement_points', label: '개선점', kind: 'text' },
    { key: 'feedback_text', label: '참가자 피드백', kind: 'text' },
  ];
}

export default function HumanReportReviewWorkflow() {
  const { profile } = useAuth();
  const role = (profile?.role || 'member') as UserRole;
  const canReview = role === 'president' || role === 'teacher' || role === 'chief';
  const [items, setItems] = useState<Item[]>([]); const [selected, setSelected] = useState<Item | null>(null); const [draft, setDraft] = useState<Record<string, any>>({}); const [feedback, setFeedback] = useState(''); const [filter, setFilter] = useState<'all' | ReportType>('all'); const [clubFilter, setClubFilter] = useState<'all' | ClubType>('all'); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [notice, setNotice] = useState(''); const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!canReview) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const status = role === 'president' ? ['submitted', 'rejected'] : role === 'teacher' ? ['president_reviewed'] : ['reviewed'];
      const [w, g, e] = await Promise.all([
        supabase.from('weekly_reports').select('*').in('status', status).is('deleted_at', null).order('updated_at', { ascending: false }),
        supabase.from('growth_records').select('*').in('status', status).is('deleted_at', null).order('updated_at', { ascending: false }),
        supabase.from('event_reports').select('*').in('status', status).is('deleted_at', null).order('updated_at', { ascending: false }),
      ]);
      if (w.error || g.error || e.error) throw new Error(w.error?.message || g.error?.message || e.error?.message);
      const all = [...mapRows('weekly', w.data || []), ...mapRows('growth', g.data || []), ...mapRows('event', e.data || [])];
      all.sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());
      setItems(all);
    } catch (err) { setError(err instanceof Error ? err.message : '보고서를 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  }, [canReview, role]);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => items.filter((item) => (filter === 'all' || item.report_type === filter) && (clubFilter === 'all' || item.club === clubFilter)), [items, filter, clubFilter]);

  const open = (item: Item) => {
    const next: Record<string, any> = {};
    fields(item).forEach((f) => { next[f.key] = item[f.key] ?? ''; });
    setSelected(item); setDraft(next); setFeedback(''); setNotice(''); setError('');
  };

  const edit = async () => {
    if (!selected || role === 'chief') return;
    const changes: Record<string, any> = {};
    fields(selected).forEach((f) => { changes[f.key] = f.kind === 'number' && draft[f.key] !== '' ? Number(draft[f.key]) : draft[f.key]; });
    setSaving(true); setError('');
    try {
      const { error: rpcError } = await supabase.rpc('revise_report', { p_report_type: selected.report_type, p_report_id: selected.id, p_changes: changes, p_note: `${role === 'president' ? '회장' : '담당 교사'}가 검토 중 수정` });
      if (rpcError) throw rpcError;
      setNotice('수정 내용이 저장되었습니다. 수정 이력이 보존됩니다.'); await load();
    } catch (err) { setError(err instanceof Error ? err.message : '수정에 실패했습니다.'); }
    finally { setSaving(false); }
  };

  const review = async (action: 'approve' | 'reject') => {
    if (!selected || !feedback.trim()) { setError('검토 의견을 입력해주세요.'); return; }
    setSaving(true); setError('');
    try {
      const { error: rpcError } = await supabase.rpc('review_report', { p_report_type: selected.report_type, p_report_id: selected.id, p_action: action, p_feedback: feedback.trim() });
      if (rpcError) throw rpcError;
      setSelected(null); setFeedback(''); setNotice(action === 'approve' ? '검토 완료했습니다.' : '수정 요청으로 돌려보냈습니다.'); await load();
    } catch (err) { setError(err instanceof Error ? err.message : '검토 처리에 실패했습니다.'); }
    finally { setSaving(false); }
  };

  const withdraw = async () => {
    if (!selected) return;
    if (!window.confirm('보고서를 회수할까요? 삭제되지 않고 기록으로 보관됩니다.')) return;
    setSaving(true); setError('');
    try {
      const { error: rpcError } = await supabase.rpc('withdraw_report', { p_report_type: selected.report_type, p_report_id: selected.id, p_note: '검토센터 회수' });
      if (rpcError) throw rpcError;
      setSelected(null); setNotice('보고서를 회수했습니다. 데이터는 보존됩니다.'); await load();
    } catch (err) { setError(err instanceof Error ? err.message : '회수에 실패했습니다.'); }
    finally { setSaving(false); }
  };

  if (!canReview) return <div className="max-w-4xl mx-auto px-4 py-10"><div className="rounded-3xl border border-background-200 bg-background-100 p-8 text-center"><h1 className="text-xl font-bold text-foreground-950">보고서 검토 권한이 없습니다</h1></div></div>;

  return <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10 pb-32">
    <div className="mb-6"><p className="text-xs font-black tracking-wider text-primary-600">REPORT WORKFLOW</p><h1 className="text-2xl md:text-3xl font-black text-foreground-950 mt-1">{role === 'president' ? '회장 1차 검토' : role === 'teacher' ? '담당 교사 2차 검토' : '부장 총검토'}</h1><p className="text-sm text-foreground-600 mt-2">실수와 수정이 가능한 조직을 전제로 합니다. 검토자가 내용을 고칠 수 있고, 수정 요청·회수·이력 보존이 가능합니다.</p></div>
    {notice && <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}
    {error && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
    <div className="flex gap-2 overflow-x-auto pb-2 mb-4">{(['all','weekly','growth','event'] as const).map((t) => <button key={t} type="button" onClick={() => setFilter(t)} className={`min-h-10 px-4 rounded-full border text-sm font-bold whitespace-nowrap ${filter === t ? 'bg-primary-600 text-white border-primary-600' : 'bg-background-100 border-background-200 text-foreground-600'}`}>{t === 'all' ? '전체' : labels[t]}</button>)}</div>
    <div className="flex gap-2 overflow-x-auto pb-2 mb-6"><button type="button" onClick={() => setClubFilter('all')} className={`min-h-10 px-4 rounded-full border text-xs font-bold whitespace-nowrap ${clubFilter === 'all' ? 'bg-foreground-950 text-white' : 'bg-background-100 border-background-200 text-foreground-600'}`}>전체 동아리</button>{clubs.map((c) => <button type="button" key={c} onClick={() => setClubFilter(c)} className={`min-h-10 px-4 rounded-full border text-xs font-bold whitespace-nowrap ${clubFilter === c ? 'bg-foreground-950 text-white' : 'bg-background-100 border-background-200 text-foreground-600'}`}>{CLUB_LABELS[c]}</button>)}</div>
    {loading ? <div className="py-20 text-center text-sm text-foreground-500">보고서를 불러오는 중...</div> : filtered.length === 0 ? <div className="py-20 text-center text-sm text-foreground-500">현재 검토할 보고서가 없습니다.</div> : <div className="space-y-3">{filtered.map((item) => <button key={`${item.report_type}-${item.id}`} type="button" onClick={() => open(item)} className="w-full text-left rounded-2xl border border-background-200 bg-background-100 p-4 md:p-5 hover:border-primary-300 transition-colors"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap gap-2"><span className="px-2.5 py-1 rounded-full bg-background-200 text-foreground-700 text-[11px] font-bold">{labels[item.report_type]}</span><span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${item.status === 'rejected' ? 'bg-orange-100 text-orange-700' : 'bg-primary-50 text-primary-700'}`}>{statusText[item.status]}</span>{item.revision_count > 0 && <span className="text-[10px] text-foreground-500">수정 {item.revision_count}회</span>}</div><h2 className="mt-2 text-base md:text-lg font-black text-foreground-950 truncate">{item.title}</h2><p className="mt-1 text-xs md:text-sm text-foreground-600">{item.subtitle} · {item.author_name} · {CLUB_LABELS[item.club]}</p></div><span className="text-xl text-foreground-400">›</span></div></button>)}</div>}
    {selected && <div className="fixed inset-0 z-50 flex justify-end"><button type="button" aria-label="닫기" onClick={() => setSelected(null)} className="absolute inset-0 bg-black/35"/><div className="relative w-full max-w-[680px] h-full overflow-y-auto bg-background-50 shadow-2xl p-5 md:p-6"><div className="sticky top-0 z-10 -mx-5 md:-mx-6 px-5 md:px-6 py-4 bg-background-50/95 backdrop-blur border-b border-background-200 flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold text-primary-600">{labels[selected.report_type]} · {statusText[selected.status]}</p><h2 className="text-lg font-black text-foreground-950 truncate">{selected.title}</h2></div><button type="button" onClick={() => setSelected(null)} className="w-11 h-11 shrink-0 rounded-xl border border-background-200">×</button></div><div className="py-5 space-y-5">{selected.report_type === 'weekly' && <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 leading-6"><b>연습일별 원기록</b><div className="mt-2 whitespace-pre-wrap">{parsePracticeEntries(selected.practice_entries).map((e: any) => `${formatPracticeDate(e.practice_date)} · 출석 ${e.attendance_count ?? '-'}명\n${e.progress_summary}${e.special_notes ? `\n특이: ${e.special_notes}` : ''}`).join('\n\n') || '기록 없음'}</div></div>}{fields(selected).map((f) => <div key={f.key}><label className="block text-sm font-bold text-foreground-900 mb-2">{f.label}</label>{f.kind === 'number' ? <input type="number" inputMode="numeric" value={draft[f.key] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))} disabled={role === 'chief'} className="w-full min-h-12 rounded-2xl border border-background-200 bg-background-100 px-4 text-[15px]"/> : f.kind === 'input' ? <input value={draft[f.key] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))} disabled={role === 'chief'} className="w-full min-h-12 rounded-2xl border border-background-200 bg-background-100 px-4 text-[15px]"/> : <textarea value={draft[f.key] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))} disabled={role === 'chief'} rows={6} className="w-full rounded-2xl border border-background-200 bg-background-100 p-4 text-[15px] leading-6 resize-y"/>}</div>)}{(role === 'president' || role === 'teacher') && <button type="button" onClick={edit} disabled={saving} className="w-full min-h-12 rounded-xl bg-sky-600 text-white font-bold">{saving ? '저장 중...' : '검토자가 내용 수정 저장'}</button>}{selected.feedback && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 whitespace-pre-wrap">이전 검토 의견\n\n{selected.feedback}</div>}<div><label className="block text-sm font-bold text-foreground-900 mb-2">검토 의견</label><textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={5} maxLength={1000} placeholder="잘된 점, 보완할 점, 확인한 내용을 적어주세요." className="w-full rounded-2xl border border-background-200 bg-background-100 p-4 text-[15px] resize-y"/></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-10">{role !== 'chief' && <button type="button" onClick={() => review('reject')} disabled={saving} className="min-h-12 rounded-xl border border-orange-200 bg-orange-50 text-orange-700 font-bold">수정 요청</button>}{role === 'chief' && <button type="button" onClick={withdraw} disabled={saving} className="min-h-12 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-bold">회수</button>}<button type="button" onClick={() => review('approve')} disabled={saving} className="min-h-12 rounded-xl bg-primary-600 text-white font-bold">{role === 'chief' ? '최종 승인' : '검토 완료'}</button></div></div></div></div>}
  </div>;
}
