import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import VerseResult from './components/VerseResult';
import type { BibleVerseData } from './components/VerseResult';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const HISTORY_STORAGE_KEY = 'bible_picks_history';

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
      // DB 저장이 실패해도 기록 자체가 사라지지 않도록 로컬에라도 남겨둡니다.
      saveToLocalHistory(record);
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
      setVerseData(verse);
      setIsSubmitted(true);
      const saved = await savePick(verse, userText.trim(), user?.id);
      if (!saved) {
        setError('말씀은 준비됐지만 히스토리 저장에는 실패했어요. 나의 히스토리에서 보이지 않는다면 다시 시도해주세요.');
      }
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

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-16" style={{ perspective: 1200 }}>
        <AnimatePresence mode="wait">
        {isSubmitted && verseData ? (
          <motion.div
            key="result"
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            style={{ transformStyle: 'preserve-3d' }}
          >
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-accent-100 border border-accent-200 text-sm text-accent-700 flex items-start gap-2">
                <i className="ri-error-warning-line mt-0.5 flex-shrink-0"></i>
                <span>{error}</span>
              </div>
            )}
            <VerseResult
              verseData={verseData}
              userText={userText}
              onReset={handleReset}
            />
          </motion.div>
        ) : (
          <motion.div
            key="draw"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ rotateY: -90, opacity: 0 }}
            transition={{ duration: 0.5 }}
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Header */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-background-100 border border-background-200 mb-5">
                <i className="ri-book-open-line text-3xl text-primary-600"></i>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-3">말씀 뽑기</h1>
              <p className="text-foreground-600 text-sm md:text-base leading-relaxed">
                지금 마음에 있는 이야기를 자유롭게 적어주세요<br />
                AI가 당신의 감정을 이해하고 꼭 맞는 말씀을 찾아드려요
              </p>
            </div>

            {/* Input Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-background-100 border border-background-200 rounded-[20px] p-6 md:p-8"
            >
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
            </motion.div>

            {/* 하단 링크 */}
            <div className="text-center mt-8">
              <Link
                to="/bible-pick/history"
                className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-amber-600 transition-colors cursor-pointer"
              >
                <i className="ri-history-line"></i>
                지금까지 뽑은 말씀 보기
              </Link>
            </div>
          </motion.div>
        )}
        </AnimatePresence>

        {/* Loading overlay — 카드 뒤집기(제비뽑기) 느낌 */}
        {isDrawing && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center" style={{ perspective: 800 }}>
            <div className="bg-background-100 border border-background-200 rounded-[20px] p-10 md:p-14 text-center max-w-sm w-full mx-4">
              <motion.div
                className="relative w-20 h-20 mx-auto mb-6"
                animate={{ rotateY: [0, 180, 360] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                style={{ transformStyle: 'preserve-3d' }}
              >
                <div className="absolute inset-0 rounded-full border-4 border-primary-200"></div>
                <div className="absolute inset-2 rounded-2xl bg-primary-100 flex items-center justify-center">
                  <i className="ri-book-open-line text-3xl text-primary-600"></i>
                </div>
              </motion.div>
              <p className="text-lg font-semibold text-foreground-950 mb-2">말씀을 준비하고 있어요</p>
              <p className="text-sm text-foreground-600">AI가 당신의 마음을 읽고 맞춤 말씀을 찾는 중...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}