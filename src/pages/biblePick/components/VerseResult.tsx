import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export interface BibleVerseData {
  verse: string;
  reference: string;
  answer?: string;
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

export default function VerseResult({ verseData, userText: _userText, onReset }: VerseResultProps) {
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

  const answer = verseData.answer?.trim() || verseData.biblicalContext || verseData.recommendation;
  const practice = verseData.nextStep || verseData.application || verseData.practice;
  const prayer = verseData.prayer || verseData.prayers[0];

  const answerParagraphs = answer
    ? answer.split(/\\n{2,}/).map((part) => part.trim()).filter(Boolean)
    : [];

  return (
    <div className="space-y-7">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-card border border-primary-200 bg-primary-50/70 p-6 md:p-10 dark:border-primary-800 dark:bg-primary-950/20"
      >
        <div className="flex items-center justify-between gap-3 mb-6">
          <p className="text-sm font-label font-semibold text-primary-700 dark:text-primary-300">오늘 읽어볼 말씀</p>
          <span className="rounded-chip bg-primary-100 px-3 py-1.5 text-xs font-label font-semibold text-primary-800 dark:bg-primary-900/50 dark:text-primary-200">
            {verseData.reference}
          </span>
        </div>
        <blockquote className="font-quote text-[1.2rem] md:text-[1.5rem] leading-[1.9] text-foreground-950 dark:text-foreground-50">
          {verseData.verse}
        </blockquote>
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
            <p className="text-sm leading-7 text-accent-800 dark:text-accent-200">{verseData.crisisMessage}</p>
          </div>
        </section>
      )}

      {answerParagraphs.length > 0 && (
        <motion.article
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-card border border-background-200 bg-background-50 p-6 md:p-8 dark:border-background-700 dark:bg-background-50"
        >
          {answerParagraphs.map((paragraph, index) => (
            <p key={index} className={index === 0 ? "text-[0.98rem] leading-8 text-foreground-900 dark:text-foreground-50" : "mt-5 text-[0.98rem] leading-8 text-foreground-800 dark:text-foreground-100"}>
              {paragraph}
            </p>
          ))}
        </motion.article>
      )}

      {practice && (
        <section className="rounded-card border border-secondary-200 bg-secondary-50 p-5 md:p-6 dark:border-secondary-800 dark:bg-secondary-950/20">
          <div className="flex items-center gap-2 mb-3">
            <i className="ri-footprint-line text-secondary-600 dark:text-secondary-300" />
            <h2 className="text-sm font-heading font-bold text-foreground-900 dark:text-foreground-50">오늘 한 가지 해볼 것</h2>
          </div>
          <p className="text-[0.95rem] leading-8 text-foreground-800 dark:text-foreground-100">{practice}</p>
        </section>
      )}

      {verseData.takeaway && (
        <p className="px-2 text-center font-heading text-base md:text-lg font-semibold leading-7 text-foreground-900 dark:text-foreground-50">
          {verseData.takeaway}
        </p>
      )}

      {prayer && (
        <section className="rounded-card border border-background-200 bg-background-100 p-5 md:p-6 dark:border-background-700">
          <div className="flex items-center gap-2">
            <i className="ri-prayer-line text-base text-secondary-600 dark:text-secondary-300" />
            <h2 className="text-sm font-heading font-bold text-foreground-900 dark:text-foreground-50">잠깐, 이렇게 기도해봐요</h2>
          </div>
          <p className="mt-3 font-quote text-[0.95rem] leading-8 text-foreground-700 dark:text-foreground-100">{prayer}</p>
        </section>
      )}

      {verseData.contextCaution && <p className="px-1 text-xs leading-6 text-foreground-500">이 말씀은 앞뒤 문맥과 함께 읽어보면 뜻을 더 정확하게 이해할 수 있어요.</p>}

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
