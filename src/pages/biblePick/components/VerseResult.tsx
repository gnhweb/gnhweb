import { useState } from 'react';
import { motion } from 'framer-motion';
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
  understanding?: string;
  biblicalContext?: string;
  whyThisVerse?: string;
  application?: string;
  nextStep?: string;
  takeaway?: string;
  prayer?: string;
  contextCaution?: boolean;
}

interface VerseResultProps {
  verseData: BibleVerseData;
  userText: string;
  onReset: () => void;
}

export default function VerseResult({ verseData, userText, onReset }: VerseResultProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText('"'+verseData.verse+'" ('+verseData.reference+')');
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard failures
    }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="text-center px-2">
        <p className="text-xs font-label text-foreground-500 mb-2">네가 들려준 이야기</p>
        <p className="text-sm md:text-base leading-7 text-foreground-700 max-w-xl mx-auto">“{userText}”</p>
        {verseData.analyzedEmotions.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
            {verseData.analyzedEmotions.slice(0, 3).map((emotion, index) => (
              <span key={emotion} className={index === 0 ? 'rounded-chip px-2.5 py-1 text-xs font-label bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200' : 'rounded-chip px-2.5 py-1 text-xs font-label bg-background-100 text-foreground-500'}>
                {emotion}
              </span>
            ))}
          </div>
        )}
      </motion.div>

      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="rounded-card border border-primary-200 bg-primary-50/70 p-6 md:p-10 dark:border-primary-800 dark:bg-primary-950/20">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <p className="text-xs font-label font-semibold tracking-wide text-primary-700 dark:text-primary-300">오늘의 말씀</p>
            <p className="mt-1 text-sm font-label text-foreground-500">성경 본문을 먼저 읽어봐요</p>
          </div>
          <span className="rounded-chip bg-primary-100 px-3 py-1.5 text-xs font-label font-semibold text-primary-800 dark:bg-primary-900/50 dark:text-primary-200">{verseData.reference}</span>
        </div>
        <blockquote className="font-quote text-[1.2rem] md:text-[1.5rem] leading-[1.9] text-foreground-950 dark:text-foreground-50">{verseData.verse}</blockquote>
        <div className="mt-6 flex justify-end">
          <button type="button" onClick={handleCopy} className="inline-flex min-h-10 items-center gap-1.5 rounded-chip px-3 py-2 text-xs font-label text-foreground-600 transition-colors hover:bg-background-100 hover:text-primary-700 dark:hover:bg-background-200">
            <i className={copied ? 'ri-check-line' : 'ri-file-copy-line'} />
            {copied ? '복사했어요' : '말씀 복사'}
          </button>
        </div>
      </motion.section>

      {verseData.crisisMessage && (
        <section className="rounded-card border border-accent-300 bg-accent-50 p-5 dark:border-accent-800 dark:bg-accent-950/30">
          <div className="flex items-start gap-3">
            <i className="ri-heart-pulse-line mt-0.5 text-lg text-accent-700 dark:text-accent-300" />
            <div>
              <h2 className="text-sm font-heading font-bold text-accent-900 dark:text-accent-100">혼자 버티지 않아도 돼요</h2>
              <p className="mt-1.5 text-sm leading-7 text-accent-800 dark:text-accent-200">{verseData.crisisMessage}</p>
            </div>
          </div>
        </section>
      )}

      {verseData.understanding && (
        <section className="rounded-card border border-background-200 bg-background-100 p-5 md:p-6 dark:border-background-700">
          <p className="text-xs font-label font-semibold text-foreground-500">네 이야기에서 보이는 핵심</p>
          <p className="mt-2 text-[0.95rem] leading-7 text-foreground-800 dark:text-foreground-100">{verseData.understanding}</p>
        </section>
      )}

      {(verseData.biblicalContext || verseData.whyThisVerse || verseData.application || verseData.nextStep) && (
        <div className="rounded-card border border-background-200 bg-background-50 overflow-hidden dark:border-background-700">
          {verseData.biblicalContext && (
            <section className="p-5 md:p-6">
              <div className="flex items-start gap-3">
                <i className="ri-book-open-line mt-0.5 text-base text-primary-600 dark:text-primary-300" />
                <div>
                  <h2 className="text-sm font-heading font-bold text-foreground-900 dark:text-foreground-50">본문에서 먼저 볼 것</h2>
                  <p className="mt-2 text-[0.95rem] leading-7 text-foreground-700 dark:text-foreground-100">{verseData.biblicalContext}</p>
                </div>
              </div>
            </section>
          )}
          {verseData.whyThisVerse && (
            <section className="border-t border-background-200 p-5 md:p-6 dark:border-background-700">
              <div className="flex items-start gap-3">
                <i className="ri-links-line mt-0.5 text-base text-primary-600 dark:text-primary-300" />
                <div>
                  <h2 className="text-sm font-heading font-bold text-foreground-900 dark:text-foreground-50">이 말씀이 닿는 이유</h2>
                  <p className="mt-2 text-[0.95rem] leading-7 text-foreground-700 dark:text-foreground-100">{verseData.whyThisVerse}</p>
                </div>
              </div>
            </section>
          )}
          {(verseData.application || verseData.nextStep) && (
            <section className="border-t border-background-200 p-5 md:p-6 dark:border-background-700">
              <div className="flex items-start gap-3">
                <i className="ri-footprint-line mt-0.5 text-base text-primary-600 dark:text-primary-300" />
                <div>
                  <h2 className="text-sm font-heading font-bold text-foreground-900 dark:text-foreground-50">오늘 여기서 해볼 것</h2>
                  {verseData.application && <p className="mt-2 text-[0.95rem] leading-7 text-foreground-700 dark:text-foreground-100">{verseData.application}</p>}
                  {verseData.nextStep && <p className="mt-3 rounded-input bg-background-100 px-4 py-3 text-sm font-semibold leading-6 text-foreground-800 dark:bg-background-200 dark:text-foreground-100">{verseData.nextStep}</p>}
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {verseData.takeaway && (
        <section className="rounded-card bg-secondary-50 px-5 py-5 dark:bg-secondary-950/20">
          <p className="text-xs font-label font-semibold text-secondary-700 dark:text-secondary-300">오늘 가져갈 한 문장</p>
          <p className="mt-2 font-heading text-base md:text-lg font-semibold leading-7 text-foreground-900 dark:text-foreground-50">{verseData.takeaway}</p>
        </section>
      )}

      {(verseData.prayer || verseData.prayers.length > 0) && (
        <section className="rounded-card border border-background-200 bg-background-100 p-5 md:p-6 dark:border-background-700">
          <div className="flex items-center gap-2">
            <i className="ri-prayer-line text-base text-secondary-600 dark:text-secondary-300" />
            <h2 className="text-sm font-heading font-bold text-foreground-900 dark:text-foreground-50">이렇게 기도해봐요</h2>
          </div>
          <p className="mt-3 font-quote text-[0.95rem] leading-8 text-foreground-700 dark:text-foreground-100">{verseData.prayer || verseData.prayers[0]}</p>
        </section>
      )}

      {verseData.contextCaution && (
        <p className="px-1 text-xs leading-6 text-foreground-500">이 구절은 한 문장만 떼어 읽기보다 앞뒤 문맥과 함께 읽어보면 더 정확하게 이해할 수 있어요.</p>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-1">
        <button type="button" onClick={onReset} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-chip bg-primary-600 px-6 py-3 text-sm font-label font-semibold text-background-50 transition-colors hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-400">
          <i className="ri-refresh-line" />
          다시 말씀 찾아보기
        </button>
        <Link to="/bible-pick/history" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-chip border border-background-300 bg-background-50 px-6 py-3 text-sm font-label font-semibold text-foreground-700 transition-colors hover:bg-background-100 dark:border-background-600 dark:bg-background-50 dark:text-foreground-100">
          <i className="ri-history-line" />
          말씀 기록 보기
        </Link>
      </div>
    </div>
  );
}
