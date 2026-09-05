import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { todayKey } from '@/lib/date';

type JournalMood = 'joyful' | 'peaceful' | 'reflective' | 'grateful' | 'struggling';
type StoryType = 'baptism' | 'grace' | 'decision' | 'calling' | 'other';
type RecordKind = 'journal' | 'moment' | 'repentance';

interface FaithEntry { id: string; user_id: string; scripture: string; content: string; mood: JournalMood; entry_date: string; created_at: string; }
interface StoryEvent { id: string; author_id: string; title: string; description: string | null; event_type: StoryType; event_date: string; photo_url: string | null; created_at: string; }
interface RepentanceEntry { id: string; author_id: string; title: string; content: string; scripture: string | null; prayer: string | null; created_at: string; }
interface TimelineItem { id: string; kind: RecordKind; date: string; title: string; body: string; scripture?: string | null; prayer?: string | null; mood?: JournalMood; photoUrl?: string | null; }

const MOODS: Record<JournalMood, { icon: string; label: string }> = {
  joyful: { icon: 'ri-emotion-happy-line', label: '기쁨' }, peaceful: { icon: 'ri-emotion-line', label: '평안' }, reflective: { icon: 'ri-lightbulb-line', label: '묵상' }, grateful: { icon: 'ri-heart-line', label: '감사' }, struggling: { icon: 'ri-emotion-sad-line', label: '고민' },
};
const STORY_TYPES: Record<StoryType, { icon: string; label: string }> = {
  baptism: { icon: 'ri-drop-line', label: '세례' }, grace: { icon: 'ri-heart-line', label: '은혜' }, decision: { icon: 'ri-check-double-line', label: '결단' }, calling: { icon: 'ri-compass-line', label: '소명' }, other: { icon: 'ri-star-line', label: '신앙의 순간' },
};
const PROMPTS = [
  '오늘 하나님께서 내 마음에 가장 먼저 보여주신 것은 무엇이었나요?',
  '오늘 말씀을 내 삶에 한 가지로 옮긴다면 무엇을 실천할 수 있을까요?',
  '오늘 감사할 수 있는 하나님의 은혜는 무엇인가요?',
  '지금 하나님께 솔직하게 털어놓고 싶은 마음은 무엇인가요?',
  '어제의 나와 비교했을 때, 오늘 조금이라도 자란 부분은 무엇인가요?',
];
function sortDate(value: string) { return new Date(value).getTime(); }

export default function FaithJournal() {
  const { user } = useAuth();
  const [journalEntries, setJournalEntries] = useState<FaithEntry[]>([]);
  const [storyEvents, setStoryEvents] = useState<StoryEvent[]>([]);
  const [repentanceEntries, setRepentanceEntries] = useState<RepentanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeKind, setActiveKind] = useState<RecordKind>('journal');
  const [showForm, setShowForm] = useState(false);
  const [promptIndex, setPromptIndex] = useState(0);
  const [journalForm, setJournalForm] = useState({ scripture: '', content: '', mood: 'reflective' as JournalMood });
  const [storyForm, setStoryForm] = useState({ date: todayKey(), title: '', description: '', type: 'grace' as StoryType, file: null as File | null });
  const [repentanceForm, setRepentanceForm] = useState({ title: '', content: '', scripture: '', prayer: '' });

  const loadAll = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const [journal, stories, repentance] = await Promise.all([
        supabase.from('faith_journal_entries').select('*').eq('user_id', user.id).order('entry_date', { ascending: false }),
        supabase.from('faith_storybooks').select('*').eq('author_id', user.id).order('event_date', { ascending: false }),
        supabase.from('repentance_journals').select('*').eq('author_id', user.id).order('created_at', { ascending: false }),
      ]);
      if (journal.error) throw journal.error;
      if (stories.error) throw stories.error;
      if (repentance.error) throw repentance.error;
      setJournalEntries((journal.data || []) as FaithEntry[]);
      setStoryEvents((stories.data || []) as StoryEvent[]);
      setRepentanceEntries((repentance.data || []) as RepentanceEntry[]);
    } catch { setError('신앙 기록을 불러오지 못했습니다. 다시 시도해주세요.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadAll(); }, [user]);
  useEffect(() => { setPromptIndex(new Date().getDate() % PROMPTS.length); }, []);

  const timeline = useMemo<TimelineItem[]>(() => [
    ...journalEntries.map(entry => ({ id: `journal-${entry.id}`, kind: 'journal' as const, date: entry.entry_date, title: '오늘의 묵상', body: entry.content, scripture: entry.scripture, mood: entry.mood })),
    ...storyEvents.map(event => ({ id: `moment-${event.id}`, kind: 'moment' as const, date: event.event_date, title: event.title, body: event.description || '', photoUrl: event.photo_url })),
    ...repentanceEntries.map(entry => ({ id: `repentance-${entry.id}`, kind: 'repentance' as const, date: entry.created_at, title: entry.title, body: entry.content, scripture: entry.scripture, prayer: entry.prayer })),
  ].sort((a, b) => sortDate(b.date) - sortDate(a.date)), [journalEntries, storyEvents, repentanceEntries]);
  const lastSevenDays = useMemo(() => { const cutoff = new Date(); cutoff.setHours(0, 0, 0, 0); cutoff.setDate(cutoff.getDate() - 6); return timeline.filter(item => sortDate(item.date) >= cutoff.getTime()).length; }, [timeline]);
  const journalDays = useMemo(() => new Set(journalEntries.map(entry => entry.entry_date)), [journalEntries]);
  const openForm = (kind: RecordKind) => { setActiveKind(kind); setShowForm(true); };

  const handleJournalSave = async () => {
    if (!user || !journalForm.scripture.trim() || !journalForm.content.trim() || saving) return;
    setSaving(true); setError(null);
    try {
      const { data, error: insertError } = await supabase.from('faith_journal_entries').insert({ user_id: user.id, scripture: journalForm.scripture.trim(), content: journalForm.content.trim(), mood: journalForm.mood, entry_date: todayKey() }).select().single();
      if (insertError) throw insertError;
      if (data) setJournalEntries(prev => [data as FaithEntry, ...prev]);
      setJournalForm({ scripture: '', content: '', mood: 'reflective' }); setShowForm(false);
    } catch { setError('오늘의 신앙일지를 저장하지 못했습니다.'); }
    finally { setSaving(false); }
  };
  const handleStorySave = async () => {
    if (!user || !storyForm.date || !storyForm.title.trim() || saving) return;
    setSaving(true); setError(null); let uploadedPath: string | null = null;
    try {
      let photoUrl: string | null = null;
      if (storyForm.file) {
        const ext = storyForm.file.name.split('.').pop() || 'jpg';
        uploadedPath = `storybook/${user.id}-${Date.now()}.${ext}`;
        const upload = await supabase.storage.from('Public').upload(uploadedPath, storyForm.file, { upsert: true });
        if (upload.error) throw upload.error;
        photoUrl = supabase.storage.from('Public').getPublicUrl(uploadedPath).data.publicUrl;
      }
      const { data, error: insertError } = await supabase.from('faith_storybooks').insert({ author_id: user.id, title: storyForm.title.trim(), description: storyForm.description.trim() || null, event_type: storyForm.type, event_date: storyForm.date, photo_url: photoUrl }).select().single();
      if (insertError) throw insertError;
      if (data) setStoryEvents(prev => [data as StoryEvent, ...prev]);
      setStoryForm({ date: todayKey(), title: '', description: '', type: 'grace', file: null }); setShowForm(false);
    } catch { if (uploadedPath) await supabase.storage.from('Public').remove([uploadedPath]); setError('신앙의 순간을 저장하지 못했습니다.'); }
    finally { setSaving(false); }
  };
  const handleRepentanceSave = async () => {
    if (!user || !repentanceForm.title.trim() || !repentanceForm.content.trim() || saving) return;
    setSaving(true); setError(null);
    try {
      const { data, error: insertError } = await supabase.from('repentance_journals').insert({ author_id: user.id, title: repentanceForm.title.trim(), content: repentanceForm.content.trim(), scripture: repentanceForm.scripture.trim() || null, prayer: repentanceForm.prayer.trim() || null }).select().single();
      if (insertError) throw insertError;
      if (data) setRepentanceEntries(prev => [data as RepentanceEntry, ...prev]);
      setRepentanceForm({ title: '', content: '', scripture: '', prayer: '' }); setShowForm(false);
    } catch { setError('회개와 회복의 기록을 저장하지 못했습니다.'); }
    finally { setSaving(false); }
  };
  const handleDelete = async (item: TimelineItem) => {
    setError(null);
    try {
      if (item.kind === 'journal') {
        const id = item.id.replace('journal-', ''); const result = await supabase.from('faith_journal_entries').delete().eq('id', id); if (result.error) throw result.error; setJournalEntries(prev => prev.filter(entry => entry.id !== id));
      } else if (item.kind === 'moment') {
        const id = item.id.replace('moment-', ''); const event = storyEvents.find(entry => entry.id === id);
        if (event?.photo_url) { try { const url = new URL(event.photo_url); const parts = url.pathname.split('/'); const bucket = parts.findIndex(part => part === 'Public'); if (bucket >= 0) await supabase.storage.from('Public').remove([parts.slice(bucket + 1).join('/')]); } catch { /* best effort */ } }
        const result = await supabase.from('faith_storybooks').delete().eq('id', id); if (result.error) throw result.error; setStoryEvents(prev => prev.filter(entry => entry.id !== id));
      } else {
        const id = item.id.replace('repentance-', ''); const result = await supabase.from('repentance_journals').delete().eq('id', id); if (result.error) throw result.error; setRepentanceEntries(prev => prev.filter(entry => entry.id !== id));
      }
    } catch { setError('기록을 삭제하지 못했습니다. 다시 시도해주세요.'); }
  };

  if (!user) return <div className="min-h-screen bg-background-50 flex items-center justify-center"><div className="text-center"><div className="w-16 h-16 rounded-card bg-primary-100 flex items-center justify-center mx-auto mb-4"><i className="ri-lock-line text-3xl text-primary-600" /></div><p className="text-lg font-bold text-foreground-950 mb-2">비공개 공간입니다</p><p className="text-sm text-foreground-600">로그인이 필요합니다</p></div></div>;
  if (loading) return <div className="min-h-screen bg-background-50 flex items-center justify-center"><i className="ri-loader-4-line animate-spin text-2xl text-primary-500" /></div>;

  const recordButtons: { kind: RecordKind; label: string; icon: string; description: string }[] = [
    { kind: 'journal', label: '오늘의 신앙일지', icon: 'ri-quill-pen-line', description: '말씀을 읽고 오늘의 마음과 적용을 기록해요.' },
    { kind: 'moment', label: '신앙의 순간', icon: 'ri-bookmark-line', description: '세례, 은혜, 결단처럼 오래 간직할 순간을 남겨요.' },
    { kind: 'repentance', label: '회개와 회복', icon: 'ri-hand-heart-line', description: '돌아보고 기도하며 다시 하나님께 나아가요.' },
  ];
  return <div className="min-h-screen bg-background-50"><div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-14"><motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
    <header className="rounded-card border border-primary-100 bg-primary-50/70 p-6 md:p-8 shadow-card mb-5"><div className="flex items-start gap-4"><div className="shrink-0 flex h-14 w-14 items-center justify-center rounded-card bg-background-100 border border-primary-200"><i className="ri-seedling-line text-2xl text-primary-600" /></div><div className="min-w-0"><div className="flex items-center gap-2 text-xs font-bold text-primary-700"><i className="ri-lock-line" /> 나만의 비공개 공간</div><h1 className="mt-1 text-2xl md:text-3xl font-black tracking-tight text-foreground-950">신앙일기</h1><p className="mt-2 text-sm leading-6 text-foreground-600">기록을 많이 남기는 것보다, 말씀 앞에서 솔직해지고 한 걸음씩 살아내는 것을 목표로 해요.</p></div></div><div className="mt-6 grid grid-cols-3 gap-2 md:gap-3"><div className="rounded-input bg-background-100 border border-background-200 p-3"><p className="text-[11px] font-bold text-foreground-400">전체 기록</p><p className="mt-1 text-xl font-black text-foreground-950">{timeline.length}</p></div><div className="rounded-input bg-background-100 border border-background-200 p-3"><p className="text-[11px] font-bold text-foreground-400">최근 7일</p><p className="mt-1 text-xl font-black text-foreground-950">{lastSevenDays}</p></div><div className="rounded-input bg-background-100 border border-background-200 p-3"><p className="text-[11px] font-bold text-foreground-400">말씀 기록일</p><p className="mt-1 text-xl font-black text-foreground-950">{journalDays.size}</p></div></div></header>
    <section className="rounded-card bg-background-100 border border-background-200 p-5 md:p-6 shadow-card mb-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold text-primary-600">오늘의 질문</p><p className="mt-1 font-heading font-bold text-foreground-950 leading-6">{PROMPTS[promptIndex]}</p></div><button type="button" onClick={() => setPromptIndex((promptIndex + 1) % PROMPTS.length)} className="shrink-0 h-10 w-10 rounded-chip border border-background-200 text-foreground-500 hover:bg-primary-50 hover:text-primary-600 cursor-pointer" aria-label="다른 질문 보기"><i className="ri-refresh-line" /></button></div></section>
    {error && <div className="mb-5 rounded-card border border-accent-200 bg-accent-50 p-4 text-sm text-accent-700 flex items-center justify-between gap-3"><span><i className="ri-error-warning-line mr-2" />{error}</span><button type="button" onClick={() => void loadAll()} className="shrink-0 text-xs font-bold underline cursor-pointer">다시 시도</button></div>}
    <section className="grid gap-3 md:grid-cols-3 mb-8">{recordButtons.map(button => <button key={button.kind} type="button" onClick={() => openForm(button.kind)} className="text-left rounded-card bg-background-100 border border-background-200 p-4 shadow-card hover:border-primary-200 hover:bg-primary-50/40 transition-colors cursor-pointer"><span className="flex h-10 w-10 items-center justify-center rounded-input bg-primary-100 text-primary-600"><i className={`${button.icon} text-lg`} /></span><span className="mt-3 block text-sm font-bold text-foreground-950">{button.label}</span><span className="mt-1 block text-xs leading-5 text-foreground-500">{button.description}</span></button>)}</section>
    <div className="flex items-center gap-2 mb-4"><i className="ri-time-line text-primary-600" /><h2 className="text-lg font-black text-foreground-950">나의 신앙 기록</h2><span className="text-xs text-foreground-400">모든 기록은 나에게만 보여요</span></div>
    {timeline.length === 0 ? <div className="rounded-card border border-dashed border-background-300 bg-background-100 py-16 text-center"><i className="ri-book-open-line text-3xl text-primary-300" /><p className="mt-3 text-sm font-bold text-foreground-700">아직 첫 페이지가 비어 있어요.</p><p className="mt-1 text-xs text-foreground-500">오늘 읽은 말씀과 하나님께 드리고 싶은 마음부터 적어보세요.</p></div> : <div className="relative pl-5"><div className="absolute left-[7px] top-2 bottom-2 w-px bg-primary-100" /><div className="space-y-4">{timeline.map((item, index) => <motion.article key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 10) * 0.035 }} className="relative"><div className="absolute -left-5 top-4 h-3.5 w-3.5 rounded-full bg-primary-400 border-2 border-background-50" /><div className="rounded-card border border-background-200 bg-background-100 p-5 shadow-card"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2 text-xs font-bold text-primary-600"><i className={item.kind === 'journal' ? 'ri-quill-pen-line' : item.kind === 'moment' ? 'ri-bookmark-line' : 'ri-hand-heart-line'} />{item.kind === 'journal' ? '신앙일지' : item.kind === 'moment' ? '신앙의 순간' : '회개와 회복'}</div><div className="flex items-center gap-2"><span className="text-[11px] text-foreground-400">{item.date.slice(0, 10)}</span><button type="button" onClick={() => void handleDelete(item)} className="text-foreground-300 hover:text-accent-600 cursor-pointer" aria-label="기록 삭제"><i className="ri-delete-bin-line" /></button></div></div><h3 className="mt-2 text-base font-bold text-foreground-950">{item.title}</h3>{item.mood && <span className="mt-2 inline-flex items-center gap-1 rounded-chip bg-primary-50 px-2.5 py-1 text-[11px] font-bold text-primary-700"><i className={MOODS[item.mood].icon} />{MOODS[item.mood].label}</span>}{item.photoUrl && <img src={item.photoUrl} alt={item.title} className="mt-3 w-full max-h-72 object-contain rounded-input bg-background-50" />}{item.scripture && <div className="mt-3 rounded-input bg-primary-50 border border-primary-100 p-3"><p className="font-quote text-sm leading-6 text-primary-800">{item.scripture}</p></div>}<p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground-700">{item.body}</p>{item.prayer && <div className="mt-3 rounded-input bg-accent-50 border border-accent-100 p-3"><p className="text-xs font-bold text-accent-700"><i className="ri-hand-heart-line mr-1" />기도</p><p className="mt-1 text-sm leading-6 text-accent-800 whitespace-pre-wrap">{item.prayer}</p></div>}</div></motion.article>)}</div></div>}
  </motion.div></div>
  <AnimatePresence>{showForm && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-foreground-950/30 p-4 backdrop-blur-sm" onClick={() => !saving && setShowForm(false)}><motion.div initial={{ opacity: 0, y: 12, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: .98 }} className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-card border border-background-200 bg-background-100 p-6 shadow-card-lg" onClick={e => e.stopPropagation()}>
    <div className="flex items-center justify-between mb-5"><div><p className="text-xs font-bold text-primary-600">비공개 기록</p><h2 className="mt-1 text-xl font-black text-foreground-950">{activeKind === 'journal' ? '오늘의 신앙일지' : activeKind === 'moment' ? '신앙의 순간' : '회개와 회복'}</h2></div><button type="button" onClick={() => !saving && setShowForm(false)} className="h-9 w-9 rounded-chip text-foreground-400 hover:bg-background-100 cursor-pointer"><i className="ri-close-line text-lg" /></button></div>
    {activeKind === 'journal' && <div className="space-y-4"><div className="rounded-input bg-primary-50 border border-primary-100 p-3 text-xs leading-5 text-primary-800"><b>오늘의 질문</b><br />{PROMPTS[promptIndex]}</div><input value={journalForm.scripture} onChange={e => setJournalForm(prev => ({ ...prev, scripture: e.target.value }))} placeholder="오늘 붙잡은 말씀 (예: 빌립보서 4:13)" className="w-full rounded-input border border-background-200 bg-background-50 px-4 py-3 text-sm text-foreground-900 outline-none focus:border-primary-300" /><textarea value={journalForm.content} onChange={e => setJournalForm(prev => ({ ...prev, content: e.target.value }))} placeholder="말씀을 통해 깨달은 것, 감사한 것, 오늘 실천할 것, 하나님께 드릴 기도까지 자유롭게 적어보세요." rows={7} maxLength={1500} className="w-full resize-none rounded-input border border-background-200 bg-background-50 px-4 py-3 text-sm leading-6 text-foreground-900 outline-none focus:border-primary-300" /><div><p className="mb-2 text-xs font-bold text-foreground-600">오늘의 마음</p><div className="flex flex-wrap gap-2">{(Object.keys(MOODS) as JournalMood[]).map(mood => <button type="button" key={mood} onClick={() => setJournalForm(prev => ({ ...prev, mood }))} className={`rounded-chip px-3 py-2 text-xs font-bold cursor-pointer ${journalForm.mood === mood ? 'bg-primary-100 text-primary-700 border border-primary-200' : 'bg-background-100 text-foreground-500 border border-background-200'}`}><i className={`${MOODS[mood].icon} mr-1`} />{MOODS[mood].label}</button>)}</div></div><button type="button" onClick={() => void handleJournalSave()} disabled={saving || !journalForm.scripture.trim() || !journalForm.content.trim()} className="w-full rounded-chip bg-primary-500 py-3 text-sm font-bold text-background-50 disabled:opacity-40 cursor-pointer">{saving ? '저장 중...' : '오늘의 신앙일기 남기기'}</button></div>}
    {activeKind === 'moment' && <div className="space-y-4"><input type="date" value={storyForm.date} onChange={e => setStoryForm(prev => ({ ...prev, date: e.target.value }))} className="w-full rounded-input border border-background-200 bg-background-50 px-4 py-3 text-sm outline-none focus:border-primary-300" /><input value={storyForm.title} onChange={e => setStoryForm(prev => ({ ...prev, title: e.target.value }))} placeholder="무엇을 오래 기억하고 싶나요?" maxLength={50} className="w-full rounded-input border border-background-200 bg-background-50 px-4 py-3 text-sm outline-none focus:border-primary-300" /><div className="flex flex-wrap gap-2">{(Object.keys(STORY_TYPES) as StoryType[]).map(type => <button type="button" key={type} onClick={() => setStoryForm(prev => ({ ...prev, type }))} className={`rounded-chip px-3 py-2 text-xs font-bold cursor-pointer ${storyForm.type === type ? 'bg-primary-100 text-primary-700 border border-primary-200' : 'bg-background-100 text-foreground-500 border border-background-200'}`}><i className={`${STORY_TYPES[type].icon} mr-1`} />{STORY_TYPES[type].label}</button>)}</div><textarea value={storyForm.description} onChange={e => setStoryForm(prev => ({ ...prev, description: e.target.value }))} placeholder="그날 하나님께서 하신 일을 기록해보세요." rows={5} maxLength={800} className="w-full resize-none rounded-input border border-background-200 bg-background-50 px-4 py-3 text-sm leading-6 outline-none focus:border-primary-300" /><input type="file" accept="image/*" onChange={e => setStoryForm(prev => ({ ...prev, file: e.target.files?.[0] || null }))} className="w-full text-sm text-foreground-600" /><button type="button" onClick={() => void handleStorySave()} disabled={saving || !storyForm.date || !storyForm.title.trim()} className="w-full rounded-chip bg-primary-500 py-3 text-sm font-bold text-background-50 disabled:opacity-40 cursor-pointer">{saving ? '저장 중...' : '신앙의 순간 남기기'}</button></div>}
    {activeKind === 'repentance' && <div className="space-y-4"><div className="rounded-input bg-accent-50 border border-accent-100 p-3 text-xs leading-5 text-accent-800"><b>정죄가 아니라 회복을 위한 기록이에요.</b><br />잘못을 적고 끝내지 말고, 하나님께 돌아갈 다음 한 걸음까지 적어보세요.</div><input value={repentanceForm.title} onChange={e => setRepentanceForm(prev => ({ ...prev, title: e.target.value }))} placeholder="오늘 돌아보고 싶은 제목" maxLength={50} className="w-full rounded-input border border-background-200 bg-background-50 px-4 py-3 text-sm outline-none focus:border-primary-300" /><textarea value={repentanceForm.content} onChange={e => setRepentanceForm(prev => ({ ...prev, content: e.target.value }))} placeholder="솔직하게 돌아보고 싶은 내용을 적어보세요." rows={5} maxLength={1000} className="w-full resize-none rounded-input border border-background-200 bg-background-50 px-4 py-3 text-sm leading-6 outline-none focus:border-primary-300" /><input value={repentanceForm.scripture} onChange={e => setRepentanceForm(prev => ({ ...prev, scripture: e.target.value }))} placeholder="붙잡고 싶은 말씀 (선택)" className="w-full rounded-input border border-background-200 bg-background-50 px-4 py-3 text-sm outline-none focus:border-primary-300" /><textarea value={repentanceForm.prayer} onChange={e => setRepentanceForm(prev => ({ ...prev, prayer: e.target.value }))} placeholder="하나님께 드리는 기도" rows={4} maxLength={700} className="w-full resize-none rounded-input border border-background-200 bg-background-50 px-4 py-3 text-sm leading-6 outline-none focus:border-primary-300" /><button type="button" onClick={() => void handleRepentanceSave()} disabled={saving || !repentanceForm.title.trim() || !repentanceForm.content.trim()} className="w-full rounded-chip bg-primary-500 py-3 text-sm font-bold text-background-50 disabled:opacity-40 cursor-pointer">{saving ? '저장 중...' : '회개와 회복 기록하기'}</button></div>}
  </motion.div></motion.div>}</AnimatePresence></div>;
}
