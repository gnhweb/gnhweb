import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';

type Result = {
  verse: string;
  reference: string;
  recommendation: string;
  practice: string;
  prayers: string[];
  analyzedEmotions?: string[];
  primaryEmotion?: string;
  crisisMessage?: string;
};

const fallbackPrayer = '하나님, 오늘 제 마음을 있는 그대로 맡겨드립니다. 말씀을 통해 제가 혼자가 아니라는 것을 기억하게 하시고, 오늘 제게 필요한 한 걸음을 걸어가게 해주세요. 아멘.';

function ResultView({ result, onReset }: { result: Result; onReset: () => void }) {
  const prayer = result.prayers?.[0] || fallbackPrayer;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <section className="overflow-hidden rounded-[28px] border border-primary-100 bg-gradient-to-br from-primary-50 via-background-100 to-background-100 p-6 shadow-sm">
        <p className="text-xs font-bold tracking-wide text-primary-600">오늘, 이 말씀을 천천히 읽어보세요</p>
        <h2 className="mt-2 text-2xl font-black leading-tight text-foreground-950">{result.reference}</h2>
        <p className="mt-4 whitespace-pre-line text-base leading-8 text-foreground-800">{result.verse}</p>
        {result.primaryEmotion && <span className="mt-4 inline-flex rounded-full bg-background-100 px-3 py-1 text-xs font-semibold text-foreground-600">지금 마음 · {result.primaryEmotion}</span>}
      </section>

      <section className="rounded-[24px] border border-background-200 bg-background-100 p-5 shadow-sm">
        <p className="text-xs font-bold text-primary-600">이 말씀이 지금 와닿는 이유</p>
        <p className="mt-2 whitespace-pre-line text-sm leading-8 text-foreground-800">{result.recommendation}</p>
      </section>

      <section className="rounded-[24px] border border-background-200 bg-background-100 p-5 shadow-sm">
        <p className="text-xs font-bold text-primary-600">오늘 내가 해볼 한 가지</p>
        <p className="mt-2 whitespace-pre-line text-sm leading-8 text-foreground-800">{result.practice}</p>
      </section>

      <section className="rounded-[24px] border border-primary-100 bg-primary-50 p-5">
        <p className="text-xs font-bold text-primary-700">오늘의 기도</p>
        <p className="mt-2 whitespace-pre-line text-sm leading-8 text-primary-950">{prayer}</p>
      </section>

      {result.prayers && result.prayers.length > 1 && (
        <section className="rounded-[24px] border border-background-200 bg-background-100 p-5 shadow-sm">
          <p className="text-xs font-bold text-foreground-700">기도를 이어가고 싶다면</p>
          <div className="mt-3 space-y-2">
            {result.prayers.slice(1, 4).map((item, index) => (
              <p key={`${item}-${index}`} className="rounded-xl bg-background-50 p-3 text-sm leading-7 text-foreground-700">{item}</p>
            ))}
          </div>
        </section>
      )}

      {result.crisisMessage && (
        <section className="rounded-[24px] border-2 border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-900">혼자 버티지 않아도 돼요</p>
          <p className="mt-2 whitespace-pre-line text-sm leading-7 text-amber-900/90">{result.crisisMessage}</p>
        </section>
      )}

      <button type="button" onClick={onReset} className="min-h-12 w-full rounded-2xl border border-background-200 bg-background-100 text-sm font-bold text-foreground-700">다른 마음으로 다시 말씀 받기</button>
    </motion.div>
  );
}

export default function BiblePickEnhanced() {
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
      const { data, error: functionError } = await supabase.functions.invoke('bible-pick-v2', {
        body: {
          userText,
          mode: 'pick',
          unifiedExperience: true,
          instruction: '사용자의 실제 문장을 중심으로 공감한 뒤 한 가지 성경 말씀을 추천한다. 말씀이 왜 지금 상황과 연결되는지 구체적으로 설명한다. 학생을 훈계하거나 정답을 단정하지 않는다. 답변은 현실적이고 따뜻하며 짧고 읽기 쉽게 작성한다. 사용자가 적지 않은 사건이나 감정을 만들어내지 않는다. 결과에는 말씀, 연결 이유, 오늘 할 수 있는 아주 작은 실천, 짧은 기도를 포함한다.',
        },
      });
      if (functionError || !data) throw new Error(functionError?.message || '말씀을 준비하지 못했습니다.');
      if (data.error) throw new Error(data.error);
      if (!data.reference || !data.verse || !data.recommendation || !data.practice) throw new Error('말씀 응답 형식이 올바르지 않습니다. 다시 시도해주세요.');
      setResult(data as Result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '말씀을 준비하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-50">
      <div className="mx-auto max-w-2xl px-4 pb-28 pt-8 md:px-6 md:pt-12">
        {result ? (
          <ResultView result={result} onReset={() => { setResult(null); setError(''); }} />
        ) : (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <header className="mb-7 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[24px] border border-primary-100 bg-primary-50">
                <i className="ri-book-open-line text-3xl text-primary-600" />
              </div>
              <p className="text-xs font-bold tracking-[0.16em] text-primary-600">GNH · 말씀뽑기</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground-950">오늘 네 마음에 필요한 말씀</h1>
              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-foreground-600">좋은 말만 쓰지 않아도 괜찮아요. 기쁜 일도, 걱정도, 아무에게도 말하지 못한 마음도 그대로 적어주세요.</p>
            </header>

            <form onSubmit={submit} className="rounded-[28px] border border-background-200 bg-background-100 p-5 shadow-sm md:p-7">
              <label className="mb-3 block text-sm font-bold text-foreground-800">지금 네 마음은 어떤가요?</label>
              <textarea
                value={text}
                onChange={(event) => { setText(event.target.value); setError(''); }}
                placeholder="예) 요즘 친구 관계 때문에 마음이 복잡하고, 내가 잘하고 있는지도 모르겠어요."
                rows={7}
                maxLength={1000}
                className="w-full resize-none rounded-2xl border border-background-200 bg-background-50 px-4 py-4 text-[16px] leading-7 text-foreground-950 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-foreground-500">{text.length}/1000</span>
                <Link to="/bible-pick/history" className="text-xs font-bold text-primary-600">지난 말씀 보기</Link>
              </div>
              {error && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-700">{error}</div>}
              <button disabled={!text.trim() || loading} className="mt-5 min-h-14 w-full rounded-2xl bg-primary-500 text-base font-bold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-40">
                {loading ? '네 마음을 바탕으로 말씀을 준비하고 있어요…' : '지금 나에게 필요한 말씀 받기'}
              </button>
            </form>

            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border border-background-200 bg-background-100 p-3"><p className="text-xs font-bold text-foreground-800">말씀</p><p className="mt-1 text-[11px] leading-5 text-foreground-500">지금 붙잡을 한 구절</p></div>
              <div className="rounded-2xl border border-background-200 bg-background-100 p-3"><p className="text-xs font-bold text-foreground-800">묵상</p><p className="mt-1 text-[11px] leading-5 text-foreground-500">왜 필요한지 이해하기</p></div>
              <div className="rounded-2xl border border-background-200 bg-background-100 p-3"><p className="text-xs font-bold text-foreground-800">기도</p><p className="mt-1 text-[11px] leading-5 text-foreground-500">오늘의 마음 맡기기</p></div>
            </div>
          </motion.div>
        )}

        {loading && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4"><div className="w-full max-w-sm rounded-3xl bg-background-100 p-7 text-center shadow-xl"><div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary-200 border-t-primary-500" /><p className="font-bold text-foreground-950">조금만 기다려줘요</p><p className="mt-1 text-sm leading-6 text-foreground-600">네가 적어준 마음을 바탕으로 말씀과 묵상을 준비하고 있어요.</p></div></div>}
      </div>
    </div>
  );
}
