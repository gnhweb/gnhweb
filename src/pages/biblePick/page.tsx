import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import VerseResult from './components/VerseResult';
import type { BibleVerseData } from './components/VerseResult';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const HISTORY_STORAGE_KEY = 'bible_picks_history';

const MOOD_STARTERS: { label: string; icon: string; starter: string }[] = [
  { label: '걱정돼요', icon: 'ri-contrast-drop-line', starter: '요즘 ' },
  { label: '지쳤어요', icon: 'ri-moon-line', starter: '요즘 너무 지치고 ' },
  { label: '속상해요', icon: 'ri-emotion-sad-line', starter: '' },
  { label: '불안해요', icon: 'ri-cloud-line', starter: '' },
  { label: '감사해요', icon: 'ri-heart-line', starter: '요즘 ' },
  { label: '막막해요', icon: 'ri-lock-line', starter: '' },
];

function saveToLocalHistory(record: Record<string, unknown>) {
  try {
    const existing = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]');
    existing.unshift(record);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(existing));
  } catch {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify([record]));
  }
}

// 히스토리 기록 실패를 조용히 무시하지 않고 true/false로 성공 여부를 알려줍니다.
async function savePick(verseData: BibleVerseData, userText: string, userId?: string): Promise<boolean> {
  const record = {
    emotion: verseData.primaryEmotion || verseData.analyzedEmotions?.[0] || '평안',
    situation: userText,
    verse: verseData.verse,
    reference: verseData.reference,
    practice: verseData.practice || '',
    prayers: verseData.prayers || [],
    created_at: new Date().toISOString(),
  };

  if (userId) {
    const { error } = await supabase.from('bible_picks').insert({
      user_id: userId,
      ...record,
    });
    if (error) {
      console.error('Failed to save bible pick:', error);
      return false;
    }
    return true;
  }

  saveToLocalHistory(record);
  return true;
}

export default function BiblePick() {
  const { user } = useAuth();
  const [userText, setUserText] = useState('');
  const [verseData, setVerseData] = useState<BibleVerseData | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const fetchVerseFromAI = async (text: string): Promise<BibleVerseData> => {
    const { data, error: fnError } = await supabase.functions.invoke('bible-pick', {
      body: { userText: text },
    });

    if (fnError) {
      let errMsg = '';
      try {
        if (fnError && typeof fnError === 'object' && 'context' in fnError) {
          const response = (fnError as any).context as Response;
          const body = await response.json();
          errMsg = body?.error || body?.message || '';
        }
      } catch { /* fallback */ }
      if (!errMsg) errMsg = fnError instanceof Error ? fnError.message : String(fnError);
      throw new Error(errMsg);
    }

    if (data?.error) throw new Error(data.error);

    return data as BibleVerseData;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userText.trim().length === 0) return;

    setIsDrawing(true);
    setError('');

    try {
      const verse = await fetchVerseFromAI(userText.trim());
      const saved = await savePick(verse, userText.trim(), user?.id);
      if (!saved) {
        throw new Error('말씀은 준비됐지만 히스토리 저장에 실패했어요. 잠시 후 다시 시도해주세요.');
      }
      setVerseData(verse);
      setIsSubmitted(true);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '알 수 없는 오류';
      setError(errMsg);
    } finally {
      setIsDrawing(false);
    }
  };

  const handleReset = () => {
    setUserText('');
    setVerseData(null);
    setIsSubmitted(false);
    setIsDrawing(false);
    setError('');
  };

  const handleMoodTap = (starter: string) => {
    setUserText((prev) => (prev.trim().length > 0 ? prev : starter));
    setError('');
  };

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <AnimatePresence mode="wait">
          {isSubmitted && verseData ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              {error && (
                <div className="mb-4 p-3 rounded-xl bg-accent-100 border border-accent-200 text-sm text-accent-700 flex items-start gap-2">
                  <i className="ri-error-warning-line mt-0.5 flex-shrink-0"></i>
                  <span>{error}</span>
                </div>
              )}
              <VerseResult verseData={verseData} userText={userText} onReset={handleReset} />
            </motion.div>
          ) : (
            <motion.div
              key="draw"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4 }}
            >
              {/* Header */}
              <div className="relative text-center mb-9">
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full opacity-60 pointer-events-none"
                  style={{ background: 'radial-gradient(circle, oklch(var(--primary-200) / 0.55) 0%, transparent 70%)' }}
                ></div>
                <div className="relative inline-flex items-center justify-center w-14 h-14 rounded-full bg-background-50 mb-4">
                  <i className="ri-book-open-line text-2xl text-primary-600"></i>
                </div>
                <h1 className="relative text-2xl md:text-3xl font-bold text-foreground-950 mb-2.5">말씀 뽑기</h1>
                <p className="relative text-foreground-600 text-sm md:text-base leading-relaxed">
                  지금 마음에 있는 이야기를 자유롭게 적어주세요<br />
                  당신의 이야기를 읽고 꼭 맞는 말씀 한 구절을 골라드려요
                </p>
              </div>

              {/* Mood quick chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-4 -mx-1 px-1 scrollbar-hide">
                {MOOD_STARTERS.map((m) => (
                  <button
                    key={m.label}
                    type="button"
                    onClick={() => handleMoodTap(m.starter)}
                    className="flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-background-100 border border-background-200 text-sm text-foreground-700 hover:border-primary-300 hover:text-primary-700 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className={`${m.icon} text-primary-500`}></i>
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Input Card */}
              <div className="bg-background-100 border border-background-200 rounded-[20px] p-6 md:p-8">
                <form onSubmit={handleSubmit}>
                  <label className="block text-sm font-medium text-foreground-700 mb-3">
                    오늘 어떤 마음인가요?
                  </label>
                  <textarea
                    value={userText}
                    onChange={(e) => { setUserText(e.target.value); setError(''); }}
                    placeholder="예) 내일 중요한 발표가 있어서 너무 떨리고 걱정돼요. 준비는 열심히 했는데 자꾸 불안한 마음이 들어요..."
                    maxLength={500}
                    rows={5}
                    className="w-full px-4 py-3 rounded-[13px] border border-background-200 bg-background-50 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-all resize-none text-sm text-foreground-950 placeholder-foreground-600"
                  />
                  <div className="flex items-center justify-between mt-2 mb-1">
                    <span className="text-xs text-foreground-600">{userText.length}/500</span>
                  </div>

                  {error && (
                    <div className="mt-3 p-3 rounded-xl bg-accent-100 border border-accent-200 text-sm text-accent-700 flex items-start gap-2">
                      <i className="ri-error-warning-line mt-0.5 flex-shrink-0"></i>
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={userText.trim().length === 0}
                    className="mt-5 w-full py-3.5 rounded-[20px] bg-primary-500 text-background-50 font-semibold text-base hover:bg-primary-600 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                  >
                    <i className="ri-book-open-line text-lg"></i>
                    나를 위한 말씀 뽑기
                  </button>
                </form>
              </div>

              {/* 하단 링크 */}
              <div className="text-center mt-7">
                <Link
                  to="/bible-pick/history"
                  className="inline-flex items-center gap-1.5 text-sm text-foreground-500 hover:text-primary-600 transition-colors cursor-pointer"
                >
                  <i className="ri-history-line"></i>
                  지금까지 뽑은 말씀 보기
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading overlay */}
        {isDrawing && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center px-4">
            <div className="bg-background-50 rounded-[24px] p-10 md:p-14 text-center max-w-sm w-full shadow-card-lg">
              <motion.div
                className="relative w-16 h-16 mx-auto mb-6"
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <div className="absolute inset-0 rounded-full bg-primary-100"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <i className="ri-book-open-line text-2xl text-primary-600"></i>
                </div>
              </motion.div>
              <p className="text-base font-semibold text-foreground-950 mb-1.5">말씀을 고르고 있어요</p>
              <p className="text-sm text-foreground-600">당신의 이야기에 꼭 맞는 구절을 찾는 중이에요</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
