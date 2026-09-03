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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timers = [200, 750, 1250].map((delay, i) =>
      setTimeout(() => setRevealed(i + 1), delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const fadeUp: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] } },
  };

  const hasCrisis = Boolean(verseData.crisisMessage);
  const brandGradient = 'linear-gradient(135deg, var(--grad-coral), var(--grad-rose) 55%, var(--grad-blue))';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`"${verseData.verse}" (${verseData.reference})`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* 클립보드 접근 실패 시 조용히 무시 */
    }
  };

  return (
    <div>
      {/* 상단: 오늘 나눈 마음 + 감정 태그 */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" className="text-center mb-8">
        <p className="text-xs text-foreground-500 mb-2 tracking-wide">당신이 나눠준 마음</p>
        <p className="text-sm text-foreground-700 leading-relaxed max-w-md mx-auto px-4">
          “{userText}”
        </p>
        {verseData.analyzedEmotions.length > 0 && (
          <div className="inline-flex items-center gap-1.5 flex-wrap justify-center mt-3.5">
            {verseData.analyzedEmotions.map((em, i) => (
              <span
                key={em}
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  i === 0 ? 'text-white shadow-sm' : 'bg-background-100 text-foreground-500'
                }`}
                style={i === 0 ? { background: brandGradient } : undefined}
              >
                {em}
              </span>
            ))}
          </div>
        )}
      </motion.div>

      {/* 말씀 카드 — 시그니처 요소: 브랜드 그라디언트 프레임 + 후광 */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" className="relative mb-7">
        <div
          className="absolute -inset-6 rounded-[36px] blur-3xl opacity-40 pointer-events-none"
          style={{ background: brandGradient }}
        ></div>
        <div className="relative rounded-[28px] p-[1.5px]" style={{ background: brandGradient }}>
          <div className="relative rounded-[27px] bg-background-50 px-7 py-11 md:px-12 md:py-14 overflow-hidden">
            <span
              className="absolute -top-3 left-4 select-none pointer-events-none font-quote"
              style={{
                fontSize: '6.5rem',
                lineHeight: 1,
                backgroundImage: brandGradient,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                opacity: 0.22,
              }}
            >
              “
            </span>
            <p className="relative font-quote text-xl md:text-[1.65rem] leading-[1.75] text-foreground-900 text-center max-w-xl mx-auto">
              {verseData.verse}
            </p>
            <div className="flex items-center justify-center mt-8">
              <span
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold text-white tracking-wide shadow-sm whitespace-nowrap"
                style={{ background: brandGradient }}
              >
                <i className="ri-book-open-line"></i>
                {verseData.reference}
              </span>
            </div>
            <div className="flex justify-center mt-5">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground-500 hover:text-primary-600 transition-colors cursor-pointer"
              >
                <i className={copied ? 'ri-check-line' : 'ri-file-copy-line'}></i>
                {copied ? '복사했어요' : '말씀 복사하기'}
              </button>
            </div>
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
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="border-t border-background-200 pt-7 mb-7">
          <div className="space-y-7">
            {verseData.practice && (
              <div className="relative flex gap-4">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white shadow-sm"
                  style={{ background: 'linear-gradient(135deg, var(--grad-coral), var(--grad-rose))' }}
                >
                  <i className="ri-footprint-line text-sm"></i>
                </div>
                {verseData.prayers.length > 0 && (
                  <span className="absolute left-[17px] top-9 bottom-[-28px] w-px bg-background-200"></span>
                )}
                <div>
                  <p className="text-xs font-bold text-foreground-800 mb-1">오늘의 실천</p>
                  <p className="text-sm text-foreground-700 leading-relaxed">{verseData.practice}</p>
                </div>
              </div>
            )}

            {verseData.prayers.length > 0 && (
              <div className="flex gap-4">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white shadow-sm"
                  style={{ background: 'linear-gradient(135deg, var(--grad-rose), var(--grad-blue))' }}
                >
                  <i className="ri-moon-line text-sm"></i>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-foreground-800 mb-1.5">자기 전 기도</p>
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
          </div>
        </motion.div>
      )}

      {/* 하단 버튼 */}
      {revealed >= 3 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-white font-semibold text-sm transition-all duration-300 hover:brightness-105 hover:-translate-y-0.5 cursor-pointer whitespace-nowrap shadow-sm"
            style={{ background: 'linear-gradient(135deg, var(--grad-coral), var(--grad-rose) 55%, var(--grad-blue))' }}
          >
            <i className="ri-refresh-line"></i>
            다시 뽑기
          </button>
          <Link
            to="/bible-pick/history"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-background-200 text-foreground-600 font-medium text-sm hover:bg-background-100 transition-all duration-300 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-history-line"></i>
            히스토리 바로가기
          </Link>
        </motion.div>
      )}
    </div>
  );
}
