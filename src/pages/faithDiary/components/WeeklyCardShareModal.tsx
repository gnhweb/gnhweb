import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { captureElementToBlob, downloadBlob, shareBlob } from '@/lib/cardCapture';
import { saveFaithCard } from '@/lib/faithCardStore';
import type { DiaryWeekSummary } from '@/lib/nvidiaNim';

interface WeeklyCardShareModalProps {
  open: boolean;
  onClose: () => void;
  summary: DiaryWeekSummary;
  /** 'M월 D일 ~ M월 D일' 형태의 주간 라벨 */
  weekLabel: string;
  /** 주 식별자(주 시작일) — 보관함 저장 키 */
  weekKey?: string;
  /** 이번 주 대표 무드 */
  mood?: { emoji: string; label: string } | null;
}

function todayStamp(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

// 이번 주 요약을 한 장의 이미지 카드로 저장·공유하는 모달.
export default function WeeklyCardShareModal({
  open,
  onClose,
  summary,
  weekLabel,
  weekKey,
  mood,
}: WeeklyCardShareModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fileName = `신앙일기_이번주요약_${todayStamp()}.png`;

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  };

  const handleSave = async () => {
    if (!cardRef.current || busy) return;
    setBusy(true);
    try {
      const blob = await captureElementToBlob(cardRef.current, '#ffffff');
      downloadBlob(blob, fileName);
      showToast('이미지로 저장했어요');
    } catch {
      showToast('이미지 저장에 실패했어요. 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    if (!cardRef.current || busy) return;
    setBusy(true);
    try {
      const blob = await captureElementToBlob(cardRef.current, '#ffffff');
      const result = await shareBlob(blob, fileName, '이번 주 신앙 여정을 돌아봤어요');
      if (result === 'shared') showToast('공유를 시작했어요');
      else if (result === 'downloaded') showToast('공유를 지원하지 않아 이미지로 저장했어요');
    } catch {
      showToast('공유에 실패했어요. 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  const handleArchive = async () => {
    if (!cardRef.current || busy) return;
    setBusy(true);
    try {
      const blob = await captureElementToBlob(cardRef.current, '#ffffff');
      await saveFaithCard({
        id: weekKey || weekLabel,
        weekLabel,
        createdAt: Date.now(),
        summaryText: summary.summary,
        verseRef: summary.verseRef || '',
        moodLabel: mood?.label || '',
        moodEmoji: mood?.emoji || '',
        blob,
      });
      showToast('보관함에 저장했어요');
    } catch {
      showToast('보관함 저장에 실패했어요. 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-[80] bg-black/55 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm my-auto"
          >
            {/* ── 공유용 카드 (이 영역만 캡처됨) ── */}
            <div
              ref={cardRef}
              className="relative w-full rounded-[24px] overflow-hidden bg-gradient-to-br from-primary-500 via-primary-600 to-accent-600 text-white p-6"
            >
              {/* 배경 장식 */}
              <div className="absolute -top-16 -right-12 w-48 h-48 rounded-full bg-white/10"></div>
              <div className="absolute -bottom-20 -left-16 w-56 h-56 rounded-full bg-white/5"></div>

              <div className="relative">
                {/* 상단 브랜드 */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                      <i className="ri-book-2-line text-sm"></i>
                    </span>
                    <span className="text-xs font-bold tracking-wide">신앙일기</span>
                  </div>
                  <span className="text-[11px] font-medium text-white/80 whitespace-nowrap">{weekLabel}</span>
                </div>

                {/* 대표 무드 + 이번 주 말씀 (개인화 하이라이트) */}
                <div className="mb-5">
                  {mood && (
                    <div className="flex items-center gap-3 mb-4">
                      <span className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-3xl leading-none flex-shrink-0">
                        {mood.emoji}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold tracking-wide text-white/70">이번 주의 마음</p>
                        <p className="text-lg font-black leading-tight">{mood.label}</p>
                      </div>
                    </div>
                  )}
                  {summary.verseRef ? (
                    <div className="relative rounded-2xl bg-white/15 px-4 py-4">
                      <i className="ri-double-quotes-l absolute top-1.5 left-2.5 text-white/25 text-2xl"></i>
                      <p className="relative text-[10px] font-bold tracking-wide text-white/70 mb-1 pl-0.5">이번 주 붙든 말씀</p>
                      <p className="relative text-xl font-black leading-snug pl-0.5">{summary.verseRef}</p>
                    </div>
                  ) : null}
                </div>

                {/* 타이틀 */}
                <p className="text-[11px] font-semibold text-white/75 mb-1">이번 주 신앙 여정</p>
                <p className="text-sm leading-relaxed mb-5">{summary.summary}</p>

                {/* 핵심 주제 */}
                {summary.themes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {summary.themes.map((t, i) => (
                      <span
                        key={`card-theme-${i}`}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-white/20"
                      >
                        <i className="ri-price-tag-3-line"></i>{t}
                      </span>
                    ))}
                  </div>
                )}

                {/* 기억할 순간 */}
                {summary.highlights.length > 0 && (
                  <div className="rounded-2xl bg-white/10 p-4 mb-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <i className="ri-bookmark-2-line text-xs"></i>
                      <span className="text-[11px] font-bold">이번 주 기억할 순간</span>
                    </div>
                    <ul className="space-y-1.5">
                      {summary.highlights.map((h, i) => (
                        <li key={`card-highlight-${i}`} className="flex items-start gap-2 text-xs leading-relaxed text-white/90">
                          <span className="w-1.5 h-1.5 rounded-full bg-white/70 flex-shrink-0 mt-1.5"></span>
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 격려 */}
                {summary.encouragement && (
                  <div className="rounded-2xl bg-white/10 p-4 mb-4">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <i className="ri-heart-3-line text-xs"></i>
                      <span className="text-[11px] font-bold">격려의 말</span>
                    </div>
                    <p className="text-xs leading-relaxed text-white/90">{summary.encouragement}</p>
                  </div>
                )}

                {/* 다음 주 한 걸음 */}
                {summary.nextFocus && (
                  <div className="rounded-2xl bg-white/10 p-4 mb-5">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <i className="ri-flag-2-line text-xs"></i>
                      <span className="text-[11px] font-bold">다음 주 한 걸음</span>
                    </div>
                    <p className="text-xs leading-relaxed text-white/90">{summary.nextFocus}</p>
                  </div>
                )}

                {/* 푸터 */}
                <div className="pt-4 border-t border-white/20 flex items-center justify-center gap-1.5 text-[10px] font-semibold text-white/75">
                  <i className="ri-cross-line"></i>
                  스스로 신앙하는 거침없는 강릉 학생회
                </div>
              </div>
            </div>

            {/* ── 액션 버튼 (캡처 영역 밖) ── */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={handleSave}
                disabled={busy}
                className="flex items-center justify-center gap-1.5 py-3 rounded-full bg-background-50 text-foreground-900 text-sm font-semibold hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="ri-download-line"></i>
                {busy ? '만드는 중...' : '이미지 저장'}
              </button>
              <button
                onClick={handleShare}
                disabled={busy}
                className="flex items-center justify-center gap-1.5 py-3 rounded-full bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="ri-share-forward-line"></i>
                공유하기
              </button>
            </div>
            <button
              onClick={handleArchive}
              disabled={busy}
              className="mt-2 w-full flex items-center justify-center gap-1.5 py-3 rounded-full border border-white/40 text-white text-sm font-semibold hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="ri-gallery-line"></i>
              보관함에 저장
            </button>
            <div className="mt-2 flex items-center justify-center gap-4">
              <Link
                to="/faith-card-archive"
                onClick={onClose}
                className="text-white/75 text-xs font-medium hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1"
              >
                <i className="ri-folder-image-line"></i> 신앙 카드 보관함
              </Link>
              <button
                onClick={onClose}
                className="text-white/75 text-xs font-medium hover:text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                닫기
              </button>
            </div>

            {/* 토스트 */}
            <AnimatePresence>
              {toast && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  className="mt-3 mx-auto w-fit px-4 py-2 rounded-full bg-foreground-950/90 text-background-50 text-xs font-medium"
                >
                  {toast}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}