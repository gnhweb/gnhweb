import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { notifyUser } from '@/lib/mobileFeedback';

type Result = {
  verse: string;
  reference: string;
  answer: string;
  recommendation: string;
  practice: string;
  prayers: string[];
  analyzedEmotions?: string[];
  primaryEmotion?: string;
  crisisMessage?: string;
};

type BiblePickRecord = {
  emotion: string;
  situation: string;
  verse: string;
  reference: string;
  practice: string;
  prayers: string[];
  created_at: string;
};

const HISTORY_STORAGE_KEY = 'bible_picks_history';
const fallbackPrayer = '하나님, 오늘 제 마음을 있는 그대로 맡겨드립니다. 말씀을 통해 제가 혼자가 아니라는 것을 기억하게 하시고, 오늘 제게 필요한 한 걸음을 걸어가게 해주세요. 아멘.';

function saveToLocalHistory(record: BiblePickRecord) {
  try {
    const existing = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]');
    const history = Array.isArray(existing) ? existing : [];
    history.unshift(record);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify([record]));
  }
}

async function savePick(result: Result, userText: string, userId?: string) {
  const record: BiblePickRecord = {
    emotion: result.primaryEmotion || result.analyzedEmotions?.[0] || '평안',
    situation: userText,
    verse: result.verse,
    reference: result.reference,
    practice: result.practice || '',
    prayers: result.prayers || [],
    created_at: new Date().toISOString(),
  };

  if (!userId) {
    saveToLocalHistory(record);
    return true;
  }

  const { error } = await supabase.from('bible_picks').insert({ user_id: userId, ...record });
  if (error) {
    console.error('Failed to save bible pick:', error);
    return false;
  }
  return true;
}

function ResultView({ result, onReset }: { result: Result; onReset: () => void }) {
  const prayer = result.prayers?.[0] || fallbackPrayer;
  const share = async () => {
    const text = `오늘의 말씀 · ${result.reference}\n${result.answer}\n\n${result.verse}\n\n오늘의 기도\n${prayer}`;
    try {
      if (navigator.share) await navigator.share({ title: '오늘의 말씀', text });
      else if (navigator.clipboard) await navigator.clipboard.writeText(text);
      notifyUser('말씀을 나눌 준비가 되었어요.');
    } catch {
      // 공유 창을 닫은 경우에는 아무 동작도 하지 않습니다.
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <header className="px-1 pt-2">
        <button type="button" onClick={onReset} className="inline-flex items-center gap-2 text-sm font-semibold text-foreground-600">
          <i className="ri-arrow-left-line" aria-hidden="true" /> 다시 적어보기
        </button>
        <p className="mt-6 text-xs font-bold tracking-[0.16em] text-primary-600">AI 말씀뽑기</p>
        <h1 className="mt-2 font-heading text-2xl font-bold leading-tight text-foreground-950 md:text-3xl">지금 네 상황에<br />말씀으로 답해볼게요</h1>
      </header>

      <section className="rounded-card border border-background-200 bg-background-100 p-5 shadow-card md:p-7">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-chip bg-primary-100 text-primary-700"><i className="ri-heart-pulse-line text-lg" aria-hidden="true" /></span>
          <div><p className="text-xs font-bold text-foreground-500">지금 필요한 답</p><p className="mt-0.5 text-sm font-semibold text-foreground-800">네가 적어준 상황을 중심으로 말씀을 골랐어요</p></div>
        </div>
        <p className="mt-5 text-[15px] leading-8 text-foreground-800 md:text-base">{result.answer}</p>
      </section>

      <section className="rounded-card border border-primary-200 bg-primary-50 p-6 shadow-card md:p-8">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold tracking-[0.12em] text-primary-700">TODAY'S WORD</p>
          {result.primaryEmotion && <span className="rounded-chip bg-background-100 px-3 py-1 text-xs font-semibold text-foreground-600">{result.primaryEmotion}</span>}
        </div>
        <h2 className="mt-4 font-heading text-2xl font-bold text-foreground-950">{result.reference}</h2>
        <p className="mt-5 font-quote text-[17px] leading-9 text-foreground-900 md:text-lg">“{result.verse}”</p>
      </section>

      <section className="rounded-card border border-background-200 bg-background-100 p-5 shadow-card md:p-6">
        <p className="text-xs font-bold tracking-wide text-primary-600">왜 지금 이 말씀일까요?</p>
        <p className="mt-3 text-[15px] leading-8 text-foreground-800">{result.recommendation}</p>
      </section>

      <section className="rounded-card border border-background-200 bg-background-100 p-5 shadow-card md:p-6">
        <div className="flex items-center gap-2"><i className="ri-footprint-line text-lg text-primary-600" aria-hidden="true" /><p className="text-sm font-bold text-foreground-900">지금 해볼 한 걸음</p></div>
        <p className="mt-3 text-[15px] leading-8 text-foreground-800">{result.practice}</p>
      </section>

      <section className="rounded-card border border-secondary-200 bg-secondary-50 p-5 md:p-6">
        <div className="flex items-center gap-2"><i className="ri-heart-3-line text-lg text-secondary-700" aria-hidden="true" /><p className="text-sm font-bold text-secondary-900">하나님께 이렇게 기도해봐요</p></div>
        <p className="mt-3 font-quote text-[15px] leading-8 text-secondary-900">{prayer}</p>
        {result.prayers?.length > 1 && <div className="mt-4 border-t border-secondary-200 pt-4">{result.prayers.slice(1, 3).map((item, index) => <p key={`${item}-${index}`} className="mt-2 font-quote text-sm leading-7 text-secondary-800">{item}</p>)}</div>}
      </section>

      {result.crisisMessage && <section className="rounded-card border border-accent-300 bg-accent-50 p-5"><div className="flex gap-3"><i className="ri-hand-heart-line mt-0.5 text-lg text-accent-700" aria-hidden="true" /><div><p className="text-sm font-bold text-accent-900">혼자 버티지 않아도 돼요</p><p className="mt-2 text-sm leading-7 text-accent-800">{result.crisisMessage}</p></div></div></section>}

      <div className="grid grid-cols-2 gap-3 pb-2">
        <button type="button" onClick={onReset} className="min-h-12 rounded-input border border-background-300 bg-background-100 px-4 text-sm font-bold text-foreground-700 hover:bg-background-50">다시 적어보기</button>
        <button type="button" onClick={share} className="min-h-12 rounded-input bg-primary-600 px-4 text-sm font-bold text-background-50 hover:bg-primary-700"><i className="ri-share-forward-line mr-1" aria-hidden="true" />나누기</button>
      </div>
      <Link to="/bible-pick/history" className="flex min-h-12 items-center justify-center gap-2 rounded-input border border-background-300 bg-background-100 text-sm font-bold text-primary-700 hover:bg-background-50"><i className="ri-history-line" aria-hidden="true" />말씀 히스토리 보기</Link>
    </motion.div>
  );
}

export default function BiblePickEnhanced() {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const userText = text.trim();
    if (!userText || loading) return;
    setLoading(true);
    setError('');
    try {
      const { data, error: functionError } = await supabase.functions.invoke('bible-pick', { body: { userText } });
      if (functionError || !data) throw new Error(functionError?.message || '말씀을 준비하지 못했습니다.');
      if (data.error) throw new Error(data.error);
      const nextResult = data as Result;
      if (!nextResult.answer || !nextResult.verse || !nextResult.reference) throw new Error('응답 형식이 올바르지 않습니다. 잠시 후 다시 시도해주세요.');
      const saved = await savePick(nextResult, userText, user?.id);
      if (!saved) throw new Error('말씀은 준비됐지만 히스토리 저장에 실패했어요. 잠시 후 다시 시도해주세요.');
      setResult(nextResult);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '말씀을 준비하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-50">
      <div className="mx-auto max-w-2xl px-4 pb-28 pt-8 md:px-6 md:pt-12">
        {result ? <ResultView result={result} onReset={() => { setResult(null); setError(''); }} /> : (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <header className="mb-8 px-1 pt-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-card border border-primary-200 bg-primary-50 text-primary-700"><i className="ri-book-open-line text-2xl" aria-hidden="true" /></div>
              <p className="mt-6 text-xs font-bold tracking-[0.16em] text-primary-600">GNH · AI 말씀뽑기</p>
              <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-foreground-950 md:text-4xl">지금 마음과 상황을<br />그대로 적어주세요</h1>
              <p className="mt-4 max-w-lg text-[15px] leading-8 text-foreground-600">좋은 말만 골라 적지 않아도 괜찮아요. 지금 어떤 일이 있고, 무엇 때문에 힘든지, 어떻게 되었으면 하는지 편하게 적어주세요. 그 상황을 말씀에 비추어 지금 필요한 답을 찾아드릴게요.</p>
            </header>

            <form onSubmit={submit} className="rounded-card border border-background-200 bg-background-100 p-5 shadow-card md:p-7">
              <label htmlFor="bible-pick-question" className="mb-3 block text-sm font-bold text-foreground-900">지금 어떤 상황인가요?</label>
              <textarea id="bible-pick-question" value={text} onChange={(event) => { setText(event.target.value); setError(''); }} placeholder="예) 친구와 크게 싸웠어요. 내가 먼저 사과하고 싶은데 또 상처받을까 봐 무서워요. 어떻게 해야 할지 모르겠어요." rows={7} maxLength={1000} className="w-full resize-none rounded-input border border-background-300 bg-background-50 px-4 py-4 text-[16px] leading-7 text-foreground-950 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:bg-background-100" />
              <div className="mt-2 flex items-center justify-between"><span className="text-xs text-foreground-500">{text.length}/1000</span><Link to="/bible-pick/history" className="text-xs font-bold text-primary-600">지난 말씀 보기</Link></div>
              {error && <div role="alert" className="mt-4 rounded-input border border-accent-300 bg-accent-50 p-3 text-sm leading-6 text-accent-800">{error}</div>}
              <button type="submit" disabled={!text.trim() || loading} className="mt-5 min-h-14 w-full rounded-input bg-primary-600 px-5 text-base font-bold text-background-50 shadow-card hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40"><i className="ri-sparkling-2-line mr-2" aria-hidden="true" />{loading ? '지금 상황을 읽고 답을 준비하고 있어요…' : '말씀으로 답받기'}</button>
            </form>

            <div className="mt-5 rounded-card border border-background-200 bg-background-100 p-4"><div className="flex items-start gap-3"><i className="ri-information-line mt-0.5 text-primary-600" aria-hidden="true"/><p className="text-xs leading-6 text-foreground-600">성경이 모든 상황을 한 번에 해결해주는 정답지는 아니에요. 대신 지금의 마음과 상황을 말씀에 비추어 무엇을 붙들고 어떻게 한 걸음 내디딜지 함께 찾도록 도와줘요.</p></div></div>
          </motion.div>
        )}
        {loading && <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground-950/20 p-4" aria-live="polite"><div className="w-full max-w-sm rounded-card border border-background-200 bg-background-100 p-7 text-center shadow-card-lg"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-chip bg-primary-100 text-primary-700"><i className="ri-sparkling-2-line animate-pulse text-xl" aria-hidden="true" /></div><p className="font-bold text-foreground-950">네 상황을 천천히 읽고 있어요</p><p className="mt-2 text-sm leading-6 text-foreground-600">지금 어떤 일이 있는지 살펴보고, 그 상황에 맞는 말씀과 실제로 도움이 될 답을 준비하고 있어요.</p></div></div>}
      </div>
    </div>
  );
}
