import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { Link } from 'react-router-dom';

export interface BibleVerseData {
  verse: string;
  reference: string;
  recommendation: string;
  practice: string;
  prayers: string[];
  analyzedEmotions: string[];
  primaryEmotion: string;
  crisisMessage?: string;
}

interface VerseResultProps {
  verseData: BibleVerseData;
  userText: string;
  onReset: () => void;
}

export default function VerseResult({ verseData, userText, onReset }: VerseResultProps) {
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    const timers = [200, 700, 1150].map((delay, i) =>
      setTimeout(() => setRevealed(i + 1), delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const fadeUp: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] } },
  };

  const hasCrisis = Boolean(verseData.crisisMessage);

  return (
    <div>
      {/* 상단: 오늘 나눈 마음 + 감정 태그 */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" className="text-center mb-7">
        <p className="text-xs text-foreground-500 mb-2">당신이 나눠준 마음</p>
        <p className="text-sm text-foreground-700 leading-relaxed max-w-md mx-auto">
          "{userText}"
        </p>
        {verseData.analyzedEmotions.length > 0 && (
          <div className="inline-flex items-center gap-1.5 flex-wrap justify-center mt-3">
            {verseData.analyzedEmotions.map((em, i) => (
              <span
                key={em}
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  i === 0
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-background-100 text-foreground-500'
                }`}
              >
                {em}
              </span>
            ))}
          </div>
        )}
      </motion.div>

      {/* 말씀 카드 — 시그니처 요소 */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="relative overflow-hidden rounded-[28px] mb-6"
        style={{
          background: 'linear-gradient(160deg, oklch(var(--primary-100)) 0%, oklch(var(--background-50)) 65%)',
        }}
      >
        <div className="absolute -top-4 -left-2 select-none pointer-events-none">
          <span className="font-quote text-primary-300/40" style={{ fontSize: '7rem', lineHeight: 1 }}>“</span>
        </div>
        <div className="relative px-7 py-10 md:px-12 md:py-14">
          <p className="font-quote text-xl md:text-[1.6rem] leading-[1.7] text-foreground-900 text-center max-w-xl mx-auto">
            {verseData.verse}
          </p>
          <div className="flex items-center justify-center gap-3 mt-7">
            <span className="h-px w-8 bg-primary-300"></span>
            <span className="text-sm font-semibold text-primary-700 tracking-wide">{verseData.reference}</span>
            <span className="h-px w-8 bg-primary-300"></span>
          </div>
        </div>
      </motion.div>

      {/* 위기 상황 특별 안내 — 기능적으로 구분되는 알림이라 별도 카드 유지 */}
      {hasCrisis && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="mb-6 rounded-[20px] border-2 border-amber-300 bg-amber-50 p-5 md:p-6">
          <div className="flex items-start gap-3">
            <i className="ri-heart-pulse-line text-amber-700 text-lg mt-0.5 flex-shrink-0"></i>
            <div>
              <h3 className="text-sm font-bold text-amber-800 mb-1.5">당신은 혼자가 아니에요</h3>
              <p className="text-sm text-amber-700 leading-relaxed">{verseData.crisisMessage}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* 흐르는 본문: 왜 이 말씀인지 → 오늘의 실천 → 기도 */}
      {revealed >= 1 && verseData.recommendation && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-6">
          <p className="text-[15px] md:text-base text-foreground-800 leading-[1.85]">
            {verseData.recommendation}
          </p>
        </motion.div>
      )}

      {revealed >= 2 && (verseData.practice || verseData.prayers.length > 0) && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="border-t border-background-200 pt-6 mb-6 space-y-6">
          {verseData.practice && (
            <div className="flex gap-3.5">
              <div className="w-8 h-8 rounded-full bg-accent-100 flex items-center justify-center flex-shrink-0">
                <i className="ri-footprint-line text-accent-700 text-sm"></i>
              </div>
              <div>
                <p className="text-xs font-semibold text-accent-700 mb-1">오늘의 실천</p>
                <p className="text-sm text-foreground-700 leading-relaxed">{verseData.practice}</p>
              </div>
            </div>
          )}

          {verseData.prayers.length > 0 && (
            <div className="flex gap-3.5">
              <div className="w-8 h-8 rounded-full bg-secondary-100 flex items-center justify-center flex-shrink-0">
                <i className="ri-moon-line text-secondary-700 text-sm"></i>
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-secondary-700 mb-1.5">자기 전 기도</p>
                <div className="space-y-2">
                  {verseData.prayers.map((prayer, idx) => (
                    <p key={idx} className="text-sm text-foreground-700 leading-relaxed">
                      {prayer}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* 하단 버튼 */}
      {revealed >= 3 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary-500 text-background-50 font-semibold text-sm hover:bg-primary-600 transition-all duration-300 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-refresh-line"></i>
            다시 뽑기
          </button>
          <Link
            to="/bible-pick/history"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-background-200 text-foreground-600 font-medium text-sm hover:bg-background-100 transition-all duration-300 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-history-line"></i>
            나의 히스토리
          </Link>
        </motion.div>
      )}
    </div>
  );
}
