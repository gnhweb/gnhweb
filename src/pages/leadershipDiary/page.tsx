import { formatKoreanDate, formatKoreanDateTime } from '@/lib/date';
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { generateLeadershipCoaching } from '@/lib/nvidiaNim';

interface DiaryEntry {
  id: string;
  date: string;
  concern: string;
  advice: string;
  category: string;
  bookmarked: boolean;
}

const CATEGORIES = [
  { key: 'all', label: '전체', icon: 'ri-apps-line' },
  { key: 'team', label: '팀 관리', icon: 'ri-team-line' },
  { key: 'conflict', label: '갈등/소통', icon: 'ri-discuss-line' },
  { key: 'motivation', label: '동기부여', icon: 'ri-fire-line' },
  { key: 'planning', label: '기획/준비', icon: 'ri-calendar-event-line' },
  { key: 'personal', label: '개인 고민', icon: 'ri-user-heart-line' },
];

function renderInlineMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={index} className="font-bold text-foreground-950">{part.slice(2, -2)}</strong>
      : <span key={index}>{part}</span>
  );
}

function CoachingMarkdown({ content }: { content: string }) {
  const lines = content.replace(/\r/g, '').split('\n');

  return (
    <div className="space-y-3 text-sm text-foreground-800 leading-7">
      {lines.map((line, index) => {
        const trimmed = line.trim();

        if (!trimmed) return <div key={`blank-${index}`} className="h-1" aria-hidden="true" />;

        const heading = trimmed.match(/^#{1,3}\s+(.+)$/);
        if (heading) {
          return (
            <h3 key={index} className="pt-1 text-base font-bold text-foreground-950">
              {renderInlineMarkdown(heading[1])}
            </h3>
          );
        }

        if (trimmed.startsWith('> ')) {
          return (
            <blockquote key={index} className="border-l-2 border-accent-300 pl-3 text-sm text-foreground-700 font-quote leading-7">
              {renderInlineMarkdown(trimmed.slice(2))}
            </blockquote>
          );
        }

        const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);
        if (numbered) {
          return (
            <div key={index} className="flex items-start gap-2.5 rounded-input bg-background-50 border border-background-200 px-3 py-2.5">
              <span className="mt-0.5 flex h-5 min-w-5 items-center justify-center rounded-chip bg-accent-100 px-1 text-[11px] font-bold text-accent-700">
                {trimmed.match(/^\d+/)?.[0]}
              </span>
              <p className="min-w-0 flex-1">{renderInlineMarkdown(numbered[1])}</p>
            </div>
          );
        }

        const bullet = trimmed.match(/^[-•]\s+(.+)$/);
        if (bullet) {
          return (
            <div key={index} className="flex items-start gap-2.5">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-chip bg-accent-400" aria-hidden="true" />
              <p className="min-w-0 flex-1">{renderInlineMarkdown(bullet[1])}</p>
            </div>
          );
        }

        if (/^---+$/.test(trimmed)) {
          return <div key={index} className="border-t border-background-200 pt-1" aria-hidden="true" />;
        }

        return (
          <p key={index} className="text-sm text-foreground-800 leading-7">
            {renderInlineMarkdown(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

function detectCategory(concern: string): string {
  const lower = concern.toLowerCase();
  if (lower.includes('팀') || lower.includes('인원') || lower.includes('조직')) return 'team';
  if (lower.includes('갈등') || lower.includes('싸움') || lower.includes('소통') || lower.includes('다툼')) return 'conflict';
  if (lower.includes('동기') || lower.includes('의욕') || lower.includes('참여') || lower.includes('열정')) return 'motivation';
  if (lower.includes('기획') || lower.includes('준비') || lower.includes('행사') || lower.includes('일정')) return 'planning';
  return 'personal';
}

export default function LeadershipDiary() {
  const { user } = useAuth();
  const [concern, setConcern] = useState('');
  const [situation, setSituation] = useState('');
  const [advice, setAdvice] = useState('');
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [adviceExpanded, setAdviceExpanded] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [tone, setTone] = useState<'direct' | 'empathetic'>('direct');

  useEffect(() => {
    if (!user) {
      setLoadingEntries(false);
      return;
    }

    (async () => {
      try {
        const { data, error: loadError } = await supabase
          .from('leadership_entries')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100);

        if (loadError) throw loadError;

        setEntries((data || []).map((e: Record<string, unknown>) => ({
          id: e.id as string,
          date: e.created_at as string,
          concern: e.concern as string,
          advice: e.advice as string,
          category: e.category as string,
          bookmarked: Boolean(e.bookmarked),
        })));
      } catch (loadError) {
        console.error('Leadership diary load error:', loadError);
        setActionError('코칭 기록을 불러오지 못했습니다. 새로고침 후 다시 확인해주세요.');
      } finally {
        setLoadingEntries(false);
      }
    })();
  }, [user]);

  const filteredEntries = useMemo(() => {
    let list = entries;
    if (activeCategory !== 'all') list = list.filter(e => e.category === activeCategory);
    if (showBookmarksOnly) list = list.filter(e => e.bookmarked);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e => e.concern.toLowerCase().includes(q) || e.advice.toLowerCase().includes(q));
    }
    return list;
  }, [entries, activeCategory, showBookmarksOnly, searchQuery]);

  const stats = useMemo(() => {
    const total = entries.length;
    const bookmarked = entries.filter(e => e.bookmarked).length;
    const categories = CATEGORIES.filter(c => c.key !== 'all').map(c => ({
      key: c.key,
      label: c.label,
      count: entries.filter(e => e.category === c.key).length,
    }));
    return { total, bookmarked, categories };
  }, [entries]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!concern.trim() || !user) return;

    setIsLoading(true);
    setError('');
    setActionError('');
    try {
      const fullConcern = situation.trim()
        ? `${concern.trim()}\n\n[작성자가 처한 구체적 상황]\n${situation.trim()}`
        : concern.trim();
      const result = await generateLeadershipCoaching(fullConcern, tone);
      setAdvice(result);
      setAdviceExpanded(false);

      const category = detectCategory(concern);
      const entryId = crypto.randomUUID();
      const { error: saveError } = await supabase.from('leadership_entries').insert({
        id: entryId,
        user_id: user.id,
        concern: concern.trim(),
        advice: result,
        category,
        bookmarked: false,
      });

      if (saveError) {
        console.error('Leadership diary save error:', saveError);
        setActionError('AI 코칭은 생성됐지만 기록 저장에 실패했습니다. 결과는 확인할 수 있으며 다시 시도할 수 있습니다.');
      } else {
        setEntries(prev => [{
          id: entryId,
          date: new Date().toISOString(),
          concern: concern.trim(),
          advice: result,
          category,
          bookmarked: false,
        }, ...prev]);
        setConcern('');
        setSituation('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '코칭을 받아오지 못했어요');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleBookmark = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionError('');
    const current = entries.find(en => en.id === id);
    if (!current) return;
    const newVal = !current.bookmarked;

    const { error: updateError } = await supabase
      .from('leadership_entries')
      .update({ bookmarked: newVal })
      .eq('id', id)
      .eq('user_id', user?.id || '');

    if (updateError) {
      console.error('Leadership diary bookmark error:', updateError);
      setActionError('북마크 저장에 실패했습니다. 다시 시도해주세요.');
      return;
    }

    setEntries(prev => prev.map(en => en.id === id ? { ...en, bookmarked: newVal } : en));
  };

  const deleteEntry = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('이 기록을 삭제할까요?')) return;

    setActionError('');
    const { error: deleteError } = await supabase
      .from('leadership_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', user?.id || '');

    if (deleteError) {
      console.error('Leadership diary delete error:', deleteError);
      setActionError('기록 삭제에 실패했습니다. 다시 시도해주세요.');
      return;
    }

    setEntries(prev => prev.filter(en => en.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-accent-100 border border-accent-200 mb-5">
            <i className="ri-book-read-line text-3xl text-accent-600"></i>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">리더십 코칭 다이어리</h1>
          <p className="text-sm text-foreground-600">학생회에서 겪는 리더십 고민을 적어주세요. 지금 할 행동과 실제 대화, 성경 속 비슷한 사건까지 함께 살펴드려요</p>
        </motion.div>

        {entries.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-background-100 border border-background-200 rounded-2xl p-3 text-center"><p className="text-lg font-bold text-foreground-950">{stats.total}</p><p className="text-[10px] text-foreground-500">총 기록</p></div>
            <div className="bg-background-100 border border-background-200 rounded-2xl p-3 text-center"><p className="text-lg font-bold text-accent-600">{stats.bookmarked}</p><p className="text-[10px] text-foreground-500">북마크</p></div>
            <div className="bg-background-100 border border-background-200 rounded-2xl p-3 text-center"><p className="text-lg font-bold text-primary-600">{stats.categories.reduce((m, c) => Math.max(m, c.count), 0)}</p><p className="text-[10px] text-foreground-500">최다 주제</p></div>
          </motion.div>
        )}

        <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSubmit} className="bg-background-100 border border-background-200 rounded-[20px] p-6 md:p-8 mb-8">
          <label className="block text-sm font-semibold text-foreground-700 mb-3">오늘의 고민을 자유롭게 적어주세요</label>
          <textarea value={concern} onChange={e => setConcern(e.target.value)} placeholder="예) 동아리원들의 참여도가 점점 떨어지는 것 같아요. 어떻게 동기부여를 해야 할까요?" maxLength={500} rows={4} className="w-full px-4 py-3 rounded-xl border border-background-200 bg-background-50 focus:border-accent-400 outline-none transition-all resize-none text-sm text-foreground-950 mb-2" />
          <p className="text-xs text-foreground-500 mb-3">{concern.length}/500</p>

          <label className="block text-sm font-semibold text-foreground-700 mb-3"><i className="ri-file-list-3-line mr-1.5"></i>구체적인 상황 설명 (선택)</label>
          <textarea value={situation} onChange={e => setSituation(e.target.value)} placeholder="예) 지난 3주 연속으로 출석률이 80% → 72% → 65%로 떨어지고 있고, 특히 고3 학생들이 시험 기간이라 빠지는 경우가 많아요." maxLength={500} rows={3} className="w-full px-4 py-3 rounded-xl border border-background-200 bg-background-50 focus:border-accent-400 outline-none transition-all resize-none text-sm text-foreground-950 mb-2" />
          <p className="text-xs text-foreground-500 mb-4">{situation.length}/500</p>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-foreground-600 mb-2">AI 코칭 톤</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setTone('direct')} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${tone === 'direct' ? 'bg-rose-500 text-white' : 'bg-background-50 border border-background-200 text-foreground-600 hover:bg-background-100'}`}><i className="ri-flashlight-line"></i>직설적으로</button>
              <button type="button" onClick={() => setTone('empathetic')} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${tone === 'empathetic' ? 'bg-teal-500 text-white' : 'bg-background-50 border border-background-200 text-foreground-600 hover:bg-background-100'}`}><i className="ri-heart-line"></i>따뜻하게 공감하며</button>
            </div>
            <p className="text-[10px] text-foreground-400 mt-1.5">{tone === 'direct' ? '필요한 말은 분명하게 하고, 오늘 할 행동까지 짚어드려요.' : '마음을 먼저 살피면서도 책임과 다음 행동은 분명하게 짚어드려요.'}</p>
          </div>

          {(error || actionError) && (
            <div className={`mb-4 p-3 rounded-xl border text-sm flex items-start gap-2 ${error ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              <i className={`${error ? 'ri-error-warning-line' : 'ri-information-line'} mt-0.5 flex-shrink-0`}></i>
              <span>{error || actionError}</span>
            </div>
          )}

          <button type="submit" disabled={!concern.trim() || isLoading} className="w-full py-3.5 rounded-[20px] bg-accent-500 text-background-50 dark:text-foreground-950 font-semibold text-base hover:bg-accent-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap">
            <i className={`${isLoading ? 'ri-loader-4-line animate-spin' : 'ri-robot-line'} text-lg`}></i>
            {isLoading ? 'AI 코치가 분석 중...' : 'AI 코칭 받기'}
          </button>
        </motion.form>

        {isLoading && (
          <div className="md:hidden flex items-end gap-2 mb-8">
            <div className="w-8 h-8 rounded-full bg-accent-200 flex items-center justify-center flex-shrink-0"><i className="ri-robot-line text-accent-700 text-sm"></i></div>
            <div className="bg-accent-50 border border-accent-200 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-1.5 h-1.5 rounded-full bg-accent-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-1.5 h-1.5 rounded-full bg-accent-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        )}

        <AnimatePresence>
          {advice && !isLoading && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="hidden md:block bg-accent-50 border border-accent-200 rounded-[20px] p-6 md:p-8 mb-8">
              <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-xl bg-accent-200 flex items-center justify-center"><i className="ri-lightbulb-flash-line text-xl text-accent-700"></i></div><div><p className="text-base font-bold text-accent-800">AI 코치의 조언</p><p className="text-xs text-accent-600">방금 전</p></div></div>
              <CoachingMarkdown content={advice} />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {advice && !isLoading && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="md:hidden flex items-start gap-2 mb-8">
              <div className="w-8 h-8 rounded-full bg-accent-200 flex items-center justify-center flex-shrink-0 mt-0.5"><i className="ri-lightbulb-flash-line text-accent-700 text-sm"></i></div>
              <div className="flex-1 min-w-0 bg-accent-50 border border-accent-200 rounded-2xl rounded-tl-sm p-4">
                <p className="text-xs font-bold text-accent-700 mb-1.5">AI 코치의 조언</p>
                <div className={!adviceExpanded && advice.length > 700 ? 'max-h-72 overflow-hidden' : ''}>
                  <CoachingMarkdown content={advice} />
                </div>
                {advice.length > 700 && <button type="button" onClick={() => setAdviceExpanded(v => !v)} className="mt-3 min-h-10 px-3 rounded-chip bg-accent-100 text-xs font-semibold text-accent-700 cursor-pointer">{adviceExpanded ? '접기' : '더 보기'}</button>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {entries.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {CATEGORIES.map(cat => (
                <button key={cat.key} onClick={() => setActiveCategory(cat.key)} className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${activeCategory === cat.key ? 'bg-accent-500 text-background-50' : 'bg-background-100 border border-background-200 text-foreground-600 hover:bg-background-50'}`}>
                  <i className={`${cat.icon}`}></i>{cat.label}{cat.key !== 'all' && <span className="ml-0.5 text-[10px] opacity-70">{entries.filter(e => e.category === cat.key).length}</span>}
                </button>
              ))}
              <button onClick={() => setShowBookmarksOnly(!showBookmarksOnly)} className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${showBookmarksOnly ? 'bg-amber-500 text-background-50' : 'bg-background-100 border border-background-200 text-foreground-600 hover:bg-background-50'}`}><i className="ri-bookmark-line"></i> 북마크</button>
            </div>
            <div className="mt-2"><input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="기록 검색..." className="w-full px-4 py-2 text-sm bg-background-100 border border-background-200 rounded-xl outline-none focus:border-accent-400 transition-colors" /></div>
          </div>
        )}

        {loadingEntries ? (
          <div className="text-center py-8"><div className="w-8 h-8 border-2 border-accent-200 border-t-accent-500 rounded-full animate-spin mx-auto mb-3"></div><p className="text-sm text-foreground-500">기록을 불러오는 중...</p></div>
        ) : filteredEntries.length > 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            <h2 className="text-base font-bold text-foreground-700 mb-4">지난 코칭 기록<span className="text-xs font-normal text-foreground-500 ml-2">({filteredEntries.length}개)</span></h2>
            <div className="space-y-3">
              {filteredEntries.map(entry => {
                const isExpanded = expandedId === entry.id;
                const catConfig = CATEGORIES.find(c => c.key === entry.category);
                return (
                  <div key={entry.id} className="bg-background-100 border border-background-200 rounded-2xl overflow-hidden">
                    <button onClick={() => setExpandedId(isExpanded ? null : entry.id)} className="w-full p-4 text-left hover:bg-background-50/50 transition-colors cursor-pointer">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-accent-100 flex items-center justify-center flex-shrink-0 mt-0.5"><i className="ri-book-open-line text-accent-600"></i></div>
                        <div className="flex-1 min-w-0"><p className="text-sm font-medium text-foreground-900 truncate">{entry.concern}</p><div className="flex items-center gap-2 mt-1"><span className="text-[10px] px-1.5 py-0.5 rounded bg-background-200 text-foreground-500 font-medium">{catConfig?.label || '기타'}</span><span className="text-[10px] text-foreground-400">{formatKoreanDate(entry.date, { month: 'long', day: 'numeric', weekday: 'short' })}</span></div></div>
                        <div className="flex items-center gap-1">
                          <button onClick={(e) => toggleBookmark(entry.id, e)} className="p-1.5 rounded-lg hover:bg-background-200 transition-colors cursor-pointer"><i className={`${entry.bookmarked ? 'ri-bookmark-fill text-amber-500' : 'ri-bookmark-line text-foreground-400'} text-sm`}></i></button>
                          <button onClick={(e) => deleteEntry(entry.id, e)} className="p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"><i className="ri-delete-bin-line text-sm text-foreground-400 hover:text-rose-500"></i></button>
                          <i className={`text-foreground-500 text-sm transition-transform ${isExpanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`}></i>
                        </div>
                      </div>
                    </button>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <div className="px-4 pb-5 pt-4 border-t border-background-200">
                            <CoachingMarkdown content={entry.advice} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ) : filteredEntries.length === 0 && entries.length > 0 ? (
          <div className="text-center py-8"><p className="text-sm text-foreground-500">필터 조건에 맞는 기록이 없어요</p></div>
        ) : null}
      </div>
    </div>
  );
}
