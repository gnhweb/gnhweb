import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import VerseResult from './components/VerseResult';
import type { BibleVerseData } from './components/VerseResult';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const HISTORY_STORAGE_KEY = 'bible_picks_history';
type Mode = 'pick' | 'sleep' | 'prayer';
const MODES: Array<{ id: Mode; title: string; description: string; prompt: string; icon: string }> = [
  { id: 'pick', title: '말씀뽑기', description: '지금 내 마음과 상황에 맞는 말씀을 받아보세요.', prompt: '지금 어떤 마음이나 상황인가요?', icon: 'ri-book-open-line' },
  { id: 'sleep', title: '자기전', description: '하루를 내려놓고 평안하게 잠들기 위한 말씀입니다.', prompt: '오늘 하루를 돌아보며 마음에 남은 일을 적어주세요.', icon: 'ri-moon-line' },
  { id: 'prayer', title: '기도', description: '기도하고 싶은 내용을 적으면 말씀과 기도로 함께 정리해 드려요.', prompt: '지금 하나님께 이야기하고 싶은 기도제목은 무엇인가요?', icon: 'ri-hand-heart-line' },
];

async function savePick(verseData: BibleVerseData, userText: string, userId?: string) {
  const record = { emotion: verseData.primaryEmotion || verseData.analyzedEmotions?.[0] || '평안', situation: userText, verse: verseData.verse, reference: verseData.reference, practice: verseData.practice || '', prayers: verseData.prayers || [], created_at: new Date().toISOString() };
  if (userId) { const { error } = await supabase.from('bible_picks').insert({ user_id: userId, ...record }); if (error) console.error('Failed to save bible pick:', error); return; }
  try { const existing = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]'); existing.unshift(record); localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(existing)); } catch { localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify([record])); }
}

export default function BiblePick() {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>('pick');
  const [userText, setUserText] = useState('');
  const [verseData, setVerseData] = useState<BibleVerseData | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [error, setError] = useState('');
  const activeMode = MODES.find((item) => item.id === mode)!;

  const fetchVerseFromAI = async (text: string): Promise<BibleVerseData> => {
    const { data, error: fnError } = await supabase.functions.invoke('bible-pick', { body: { userText: text, mode } });
    if (fnError) {
      let errMsg = '';
      try { if (fnError && typeof fnError === 'object' && 'context' in fnError) { const body = await (fnError as any).context.json(); errMsg = body?.error || body?.message || ''; } } catch { /* fallback */ }
      throw new Error(errMsg || (fnError instanceof Error ? fnError.message : String(fnError)));
    }
    if (data?.error) throw new Error(data.error);
    return data as BibleVerseData;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = userText.trim();
    if (!text || isDrawing) return;
    setIsDrawing(true); setError('');
    try { const verse = await fetchVerseFromAI(text); setVerseData(verse); void savePick(verse, text, user?.id); }
    catch (err) { setError(err instanceof Error ? err.message : '말씀을 준비하지 못했어요.'); }
    finally { setIsDrawing(false); }
  };

  const reset = () => { setVerseData(null); setUserText(''); setError(''); };
  const changeMode = (next: Mode) => { setMode(next); reset(); };

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-7 md:py-12 pb-28" style={{ perspective: 1200 }}>
        <div className="mb-5 md:mb-7 flex gap-2 overflow-x-auto pb-1 scrollbar-hide" role="tablist" aria-label="신앙 콘텐츠 종류">
          {MODES.map((item) => <button key={item.id} type="button" role="tab" aria-selected={mode === item.id} onClick={() => changeMode(item.id)} className={`shrink-0 min-h-11 px-4 rounded-full border text-sm font-bold transition-all ${mode === item.id ? 'bg-primary-500 border-primary-500 text-white shadow-sm' : 'bg-background-100 border-background-200 text-foreground-600'}`}><i className={`${item.icon} mr-1.5`} aria-hidden="true" />{item.title}</button>)}
        </div>

        <AnimatePresence mode="wait">
          {verseData ? (
            <motion.div key="result" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: .25 }}>
              <div className="mb-4 rounded-2xl bg-background-100 border border-background-200 px-4 py-3 flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold text-primary-600">{activeMode.title}</p><p className="text-sm text-foreground-600 truncate">{activeMode.description}</p></div><button type="button" onClick={reset} className="shrink-0 min-h-11 px-3 rounded-full border border-background-200 text-sm font-semibold text-foreground-700">다시</button></div>
              <VerseResult verseData={verseData} userText={userText} onReset={reset} />
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <div className="text-center mb-7 md:mb-9"><div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-background-100 border border-background-200 mb-4"><i className={`${activeMode.icon} text-3xl text-primary-600`} aria-hidden="true" /></div><h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">{activeMode.title}</h1><p className="text-sm text-foreground-600 leading-relaxed">{activeMode.description}</p></div>
              <div className="bg-background-100 border border-background-200 rounded-[22px] p-5 md:p-7 shadow-sm"><form onSubmit={handleSubmit}><label className="block text-sm font-bold text-foreground-700 mb-3">{activeMode.prompt}</label><textarea value={userText} onChange={(e) => { setUserText(e.target.value); setError(''); }} placeholder={mode === 'pick' ? '예) 내일 중요한 발표가 있어서 떨리고 걱정돼요.' : mode === 'sleep' ? '예) 오늘 친구와 다퉈서 마음이 무거워요.' : '예) 내일 발표를 잘 해내고 가족도 평안했으면 좋겠어요.'} maxLength={500} rows={6} className="w-full px-4 py-3.5 rounded-2xl border border-background-200 bg-background-50 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 resize-none text-[16px] text-foreground-950 placeholder-foreground-500" autoComplete="off" /><div className="flex justify-between mt-2"><span className="text-xs text-foreground-500">{userText.length}/500</span><Link to="/bible-pick/history" className="text-xs font-semibold text-primary-600">히스토리</Link></div>{error && <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 flex items-start gap-2"><i className="ri-error-warning-line" aria-hidden="true" /><span>{error}</span></div>}<button type="submit" disabled={!userText.trim() || isDrawing} className="mt-5 w-full min-h-12 rounded-2xl bg-primary-500 text-white font-bold text-base hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"><i className={`${activeMode.icon} text-lg`} aria-hidden="true" />{isDrawing ? '준비하고 있어요…' : mode === 'pick' ? '나를 위한 말씀 뽑기' : mode === 'sleep' ? '오늘 밤의 말씀 받기' : '기도와 말씀 받기'}</button></form></div>
            </motion.div>
          )}
        </AnimatePresence>

        {isDrawing && <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4" aria-live="polite"><div className="w-full max-w-sm rounded-[22px] bg-background-100 border border-background-200 p-8 text-center shadow-xl"><motion.div className="w-16 h-16 mx-auto mb-5 rounded-full border-4 border-primary-200 border-t-primary-500" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} /><p className="text-lg font-bold text-foreground-950">{activeMode.title}을 준비하고 있어요</p><p className="text-sm text-foreground-600 mt-2">입력한 내용을 바탕으로 맞춤 말씀을 찾고 있습니다.</p></div></div>}
      </div>
    </div>
  );
}