import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { CLUB_LABELS } from '@/types/auth';
import type { ClubType } from '@/types/auth';
import { formatPracticeDate, parsePracticeEntries } from '@/lib/weeklyReport';

type ReportType = 'weekly' | 'growth' | 'event';
type ReportRow = {
  id: string;
  club: ClubType;
  author_name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
  week_start?: string;
  record_date?: string;
  event_date?: string;
  event_name?: string;
  student_name?: string;
  progress_summary?: string;
  spiritual_growth?: string;
  participant_count?: number;
  total_members?: number;
  participation_change?: string;
  performance_summary?: string;
  improvement_points?: string;
  feedback_text?: string;
  prayer_requests?: string;
  practice_entries?: unknown;
};

type Item = ReportRow & { report_type: ReportType; title: string; date: string };

const clubs: ClubType[] = ['saeullim', 'cheonjipoong', 'cheonjihu', 'munhwabu', 'cheonhwarae_cheongmyeong'];
const typeLabel: Record<ReportType, string> = { weekly: '주간', growth: '성장', event: '행사' };

export default function ApprovedReportsPanel() {
  const [items, setItems] = useState<Item[]>([]);
  const [club, setClub] = useState<ClubType | 'all'>('all');
  const [type, setType] = useState<ReportType | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Item | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [w, g, e] = await Promise.all([
        supabase.from('weekly_reports').select('*').eq('status', 'approved').is('deleted_at', null).order('finalized_at', { ascending: false }).limit(60),
        supabase.from('growth_records').select('*').eq('status', 'approved').is('deleted_at', null).order('finalized_at', { ascending: false }).limit(60),
        supabase.from('event_reports').select('*').eq('status', 'approved').is('deleted_at', null).order('finalized_at', { ascending: false }).limit(60),
      ]);
      if (!active) return;
      const list: Item[] = [
        ...(w.data || []).map((r: ReportRow) => ({ ...r, report_type: 'weekly' as const, title: `${CLUB_LABELS[r.club]} 주간 보고서`, date: r.week_start || r.created_at })),
        ...(g.data || []).map((r: ReportRow) => ({ ...r, report_type: 'growth' as const, title: `${r.student_name || '학생'} 성장 기록`, date: r.record_date || r.created_at })),
        ...(e.data || []).map((r: ReportRow) => ({ ...r, report_type: 'event' as const, title: r.event_name || '행사 보고서', date: r.event_date || r.created_at })),
      ];
      list.sort((a, b) => new Date(b.finalized_at || b.updated_at || b.created_at).getTime() - new Date(a.finalized_at || a.updated_at || a.created_at).getTime());
      setItems(list);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => items.filter((item) => (club === 'all' || item.club === club) && (type === 'all' || item.report_type === type)), [items, club, type]);
  const grouped = useMemo(() => clubs.map((c) => ({ club: c, items: filtered.filter((item) => item.club === c) })).filter((group) => club === 'all' ? group.items.length > 0 : group.club === club), [filtered, club]);

  return (
    <section className="max-w-6xl mx-auto px-4 md:px-6 pb-28">
      <div className="rounded-[24px] border border-emerald-200 bg-background-100 overflow-hidden">
        <div className="p-5 md:p-6 border-b border-background-200 bg-emerald-50/60">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-black tracking-wider text-emerald-700">APPROVED REPORT ARCHIVE</p>
              <h2 className="text-xl md:text-2xl font-black text-foreground-950 mt-1">최종 승인된 보고서</h2>
              <p className="text-sm text-foreground-600 mt-1">승인 후에도 사라지지 않습니다. 동아리별로 계속 확인하고 다음 업무의 근거로 사용할 수 있습니다.</p>
            </div>
            <Link to="/reports/review" className="min-h-11 inline-flex items-center justify-center px-4 rounded-xl bg-foreground-950 text-white text-sm font-bold">검토센터 열기</Link>
          </div>
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            <button type="button" onClick={() => setClub('all')} className={`min-h-10 px-4 rounded-full border text-sm font-bold whitespace-nowrap ${club === 'all' ? 'bg-foreground-950 text-white border-foreground-950' : 'bg-background-100 border-background-200 text-foreground-600'}`}>전체 동아리</button>
            {clubs.map((c) => <button key={c} type="button" onClick={() => setClub(c)} className={`min-h-10 px-4 rounded-full border text-sm font-bold whitespace-nowrap ${club === c ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-background-100 border-background-200 text-foreground-600'}`}>{CLUB_LABELS[c].split(' (')[0]}</button>)}
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {(['all', 'weekly', 'growth', 'event'] as const).map((t) => <button key={t} type="button" onClick={() => setType(t)} className={`min-h-9 px-3.5 rounded-full border text-xs font-bold whitespace-nowrap ${type === t ? 'bg-primary-600 text-white border-primary-600' : 'bg-background-100 border-background-200 text-foreground-600'}`}>{t === 'all' ? '전체 보고서' : `${typeLabel[t]} 보고서`}</button>)}
          </div>
        </div>

        <div className="p-5 md:p-6">
          {loading ? <div className="py-12 text-center text-sm text-foreground-500">승인된 보고서를 불러오는 중...</div> : grouped.length === 0 ? <div className="py-12 text-center text-sm text-foreground-500">아직 최종 승인된 보고서가 없습니다.</div> : (
            <div className="space-y-7">
              {grouped.map(({ club: c, items: group }) => (
                <div key={c}>
                  <div className="flex items-center gap-2 mb-3"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"/><h3 className="text-sm font-black text-foreground-950">{CLUB_LABELS[c]}</h3><span className="text-xs text-foreground-500">{group.length}건</span></div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {group.map((item) => (
                      <button key={`${item.report_type}-${item.id}`} type="button" onClick={() => setSelected(item)} className="block w-full text-left rounded-2xl border border-background-200 bg-background-50 p-4 hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors cursor-pointer">
                        <div className="flex items-start justify-between gap-2"><span className="px-2 py-1 rounded-full bg-background-200 text-foreground-700 text-[10px] font-black">{typeLabel[item.report_type]}</span><span className="text-[11px] text-emerald-700 font-bold">최종 승인</span></div>
                        <h4 className="text-sm font-black text-foreground-950 mt-3 line-clamp-2">{item.title}</h4>
                        <p className="text-xs text-foreground-600 mt-1">작성자 {item.author_name || '-'} · {item.date}</p>
                        {item.report_type === 'event' && <p className="text-xs text-foreground-500 mt-2">참여 {item.participant_count || 0}명</p>}
                        {item.report_type === 'weekly' && <p className="text-xs text-foreground-500 mt-2 line-clamp-2">{item.progress_summary || '내용 없음'}</p>}
                        {item.report_type === 'growth' && <p className="text-xs text-foreground-500 mt-2 line-clamp-2">{item.spiritual_growth || '내용 없음'}</p>}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="보고서 내용">
          <button type="button" aria-label="닫기" onClick={() => setSelected(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm cursor-pointer" />
          <div className="relative z-10 w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-card border border-background-200 bg-background-50 shadow-card-lg">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-background-200 bg-background-50/95 backdrop-blur px-5 py-4 md:px-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="px-2 py-1 rounded-chip bg-primary-100 text-primary-700 text-[10px] font-black">{typeLabel[selected.report_type]} 보고서</span>
                  <span className="text-[11px] text-emerald-700 font-bold">최종 승인</span>
                </div>
                <h3 className="text-lg md:text-xl font-black text-foreground-950">{selected.title}</h3>
                <p className="text-xs text-foreground-500 mt-1">작성자 {selected.author_name || '-'} · {selected.date}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="닫기" className="shrink-0 w-10 h-10 rounded-chip border border-background-200 text-foreground-700 hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg" />
              </button>
            </div>

            <div className="p-5 md:p-6 space-y-5">
              {selected.report_type === 'weekly' && (() => {
                const entries = parsePracticeEntries(selected.practice_entries);
                return (
                  <>
                    {entries.length > 0 && (
                      <section>
                        <h4 className="text-sm font-bold text-foreground-950 mb-2">연습일별 기록</h4>
                        <div className="space-y-3">
                          {entries.map((entry) => (
                            <div key={entry.practice_date} className="rounded-input border border-background-200 bg-background-100 p-4">
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <p className="text-sm font-bold text-foreground-950">{formatPracticeDate(entry.practice_date)}</p>
                                <span className="text-xs font-semibold text-primary-700">출석 {entry.attendance_count ?? '-'} / {selected.total_members || '-'}명</span>
                              </div>
                              <p className="text-sm text-foreground-800 leading-6 whitespace-pre-wrap">{entry.progress_summary || '기록 없음'}</p>
                              {entry.special_notes && <p className="mt-3 pt-3 border-t border-background-200 text-sm text-foreground-600 leading-6 whitespace-pre-wrap">특이 사항: {entry.special_notes}</p>}
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                    <section>
                      <h4 className="text-sm font-bold text-foreground-950 mb-2">주간 총평</h4>
                      <div className="rounded-input border border-background-200 bg-background-100 p-4 text-sm text-foreground-800 leading-6 whitespace-pre-wrap">{selected.progress_summary || '내용 없음'}</div>
                    </section>
                  </>
                );
              })()}

              {selected.report_type === 'growth' && (
                <>
                  <section><h4 className="text-sm font-bold text-foreground-950 mb-2">영적 성장</h4><div className="rounded-input border border-secondary-200 bg-secondary-50/50 p-4 text-sm text-foreground-800 leading-6 whitespace-pre-wrap">{selected.spiritual_growth || '내용 없음'}</div></section>
                  {selected.participation_change && <section><h4 className="text-sm font-bold text-foreground-950 mb-2">참여도 변화</h4><div className="rounded-input border border-primary-200 bg-primary-50/50 p-4 text-sm text-foreground-800 leading-6 whitespace-pre-wrap">{selected.participation_change}</div></section>}
                  {selected.prayer_requests && <section><h4 className="text-sm font-bold text-foreground-950 mb-2">기도제목</h4><div className="rounded-input border border-accent-200 bg-accent-50/50 p-4 text-sm text-foreground-800 leading-6 whitespace-pre-wrap">{selected.prayer_requests}</div></section>}
                </>
              )}

              {selected.report_type === 'event' && (
                <>
                  <section><h4 className="text-sm font-bold text-foreground-950 mb-2">성과 요약</h4><div className="rounded-input border border-secondary-200 bg-secondary-50/50 p-4 text-sm text-foreground-800 leading-6 whitespace-pre-wrap">{selected.performance_summary || '내용 없음'}</div></section>
                  {selected.improvement_points && <section><h4 className="text-sm font-bold text-foreground-950 mb-2">개선점</h4><div className="rounded-input border border-primary-200 bg-primary-50/50 p-4 text-sm text-foreground-800 leading-6 whitespace-pre-wrap">{selected.improvement_points}</div></section>}
                  {selected.feedback_text && <section><h4 className="text-sm font-bold text-foreground-950 mb-2">참가자 피드백</h4><div className="rounded-input border border-accent-200 bg-accent-50/50 p-4 text-sm text-foreground-800 leading-6 whitespace-pre-wrap">{selected.feedback_text}</div></section>}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
