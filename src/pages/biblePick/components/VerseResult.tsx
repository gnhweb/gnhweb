import { useState, useRef, useEffect } from 'react';
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
  const [visibleSections, setVisibleSections] = useState(0);

  useEffect(() => {
    const timers = [400, 800, 1200, 1600].map((delay, i) =>
      setTimeout(() => setVisibleSections(i + 1), delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] } },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* 헤더 */}
      <motion.div variants={itemVariants} initial="hidden" animate="visible" className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-primary-100 border border-primary-200 mb-5">
          <i className="ri-book-open-line text-3xl text-primary-600"></i>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">주님이 주시는 말씀</h1>
        <p className="text-sm text-foreground-600">당신의 이야기에 귀 기울여 준비된 말씀이에요</p>
      </motion.div>

      {/* 감정 분석 결과 */}
      {visibleSections >= 1 && verseData.analyzedEmotions.length > 0 && (
        <motion.div variants={itemVariants} initial="hidden" animate="visible" className="mb-5 text-center">
          <div className="inline-flex items-center gap-2 flex-wrap justify-center">
            <span className="text-xs text-foreground-500">AI 감정 분석:</span>
            {verseData.analyzedEmotions.map((em, i) => (
              <span key={em} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                i === 0 ? 'bg-primary-100 text-primary-700 border border-primary-200' : 'bg-background-100 text-foreground-600 border border-background-200'
              }`}>
                {em}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* 말씀 카드 */}
      {visibleSections >= 1 && (
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          className="bg-background-100 border border-background-200 rounded-[20px] p-6 md:p-8 mb-5 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-primary-500"></div>
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className="ri-double-quotes-l text-primary-600"></i>
            </div>
            <p className="text-base md:text-lg leading-relaxed text-foreground-700 font-medium">
              {verseData.verse}
            </p>
          </div>
          <p className="text-right text-sm font-semibold text-primary-700">
            {verseData.reference}
          </p>
        </motion.div>
      )}

      {/* 추천 이유 */}
      {visibleSections >= 1 && verseData.recommendation && (
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          className="bg-primary-100/70 border border-primary-200 rounded-[20px] p-5 md:p-6 mb-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-primary-200 flex items-center justify-center">
              <i className="ri-lightbulb-line text-primary-700 text-sm"></i>
            </div>
            <h3 className="text-sm font-bold text-primary-800">왜 이 말씀일까요?</h3>
          </div>
          <p className="text-sm md:text-base text-primary-700 leading-relaxed">
            {verseData.recommendation}
          </p>
        </motion.div>
      )}

      {/* 실천 방법 */}
      {visibleSections >= 2 && verseData.practice && (
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          className="bg-secondary-100 border border-secondary-200 rounded-[20px] p-5 md:p-6 mb-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-secondary-200 flex items-center justify-center">
              <i className="ri-footprint-line text-secondary-700 text-sm"></i>
            </div>
            <h3 className="text-base font-bold text-secondary-800">오늘의 실천 방법</h3>
          </div>
          <p className="text-sm md:text-base text-secondary-700 leading-relaxed">
            {verseData.practice}
          </p>
        </motion.div>
      )}

      {/* 자기 전 기도 */}
      {visibleSections >= 3 && verseData.prayers.length > 0 && (
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          className="bg-accent-100 border border-accent-200 rounded-[20px] p-5 md:p-6 mb-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-accent-200 flex items-center justify-center">
              <i className="ri-moon-line text-accent-700 text-sm"></i>
            </div>
            <h3 className="text-base font-bold text-accent-800">자기 전 기도</h3>
          </div>
          <div className="space-y-3">
            {verseData.prayers.map((prayer, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-accent-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-accent-700">{idx + 1}</span>
                </div>
                <p className="text-sm md:text-base text-accent-700 leading-relaxed">{prayer}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* 위기 상황 특별 안내 */}
      {visibleSections >= 1 && verseData.crisisMessage && (
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          className="bg-amber-50 border-2 border-amber-300 rounded-[20px] p-5 md:p-6 mb-5"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-200 flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className="ri-heart-pulse-line text-amber-700"></i>
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-800 mb-2">당신은 혼자가 아니에요</h3>
              <p className="text-sm text-amber-700 leading-relaxed">{verseData.crisisMessage}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* 하단 버튼 */}
      <motion.div variants={itemVariants} initial="hidden" animate="visible" className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary-200 text-primary-700 font-semibold text-sm hover:bg-primary-50 hover:border-primary-400 transition-all duration-300 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-refresh-line"></i>
          다시 뽑기
        </button>
        <Link
          to="/bible-pick/history"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-background-200 text-foreground-600 font-semibold text-sm hover:bg-background-100 hover:border-background-300/60 transition-all duration-300 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-history-line"></i>
          나의 히스토리
        </Link>
      </motion.div>
    </motion.div>
  );
}