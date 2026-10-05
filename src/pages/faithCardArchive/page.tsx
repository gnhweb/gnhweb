import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { downloadBlob, shareBlob } from '@/lib/cardCapture';
import { deleteFaithCard, listFaithCards, type FaithCardRecord } from '@/lib/faithCardStore';

type CardWithUrl = FaithCardRecord & { url: string };

function formatStamp(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

function fileStamp(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

// 저장한 주간 요약 카드를 모아보는 "나의 신앙 카드 보관함".
export default function FaithCardArchive() {
  const [cards, setCards] = useState<CardWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<CardWithUrl | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const urlsRef = useRef<string[]>([]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const records = await listFaithCards();
      if (!active) return;
      const withUrls: CardWithUrl[] = records.map(r => {
        const url = URL.createObjectURL(r.blob);
        urlsRef.current.push(url);
        return { ...r, url };
      });
      setCards(withUrls);
      setLoading(false);
    })();
    return () => {
      active = false;
      urlsRef.current.forEach(u => URL.revokeObjectURL(u));
      urlsRef.current = [];
    };
  }, []);

  const handleDownload = (card: CardWithUrl) => {
    downloadBlob(card.blob, `신앙일기_${card.weekLabel}_요약_${fileStamp(card.createdAt)}.png`);
    showToast('이미지로 저장했어요');
  };

  const handleShare = async (card: CardWithUrl) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await shareBlob(card.blob, `신앙일기_${card.weekLabel}_요약.png`, '이번 주 신앙 여정을 돌아봤어요');
      if (result === 'shared') showToast('공유를 시작했어요');
      else if (result === 'downloaded') showToast('공유를 지원하지 않아 이미지로 저장했어요');
    } catch {
      showToast('공유에 실패했어요. 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    const target = cards.find(c => c.id === id);
    if (target) {
      URL.revokeObjectURL(target.url);
      urlsRef.current = urlsRef.current.filter(u => u !== target.url);
    }
    await deleteFaithCard(id);
    setCards(prev => prev.filter(c => c.id !== id));
    setViewing(prev => (prev && prev.id === id ? null : prev));
    setConfirmId(null);
    showToast('보관함에서 삭제했어요');
  };

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-14">
        {/* 헤더 */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-gradient-to-br from-primary-500 to-accent-500 mb-5">
              <i className="ri-gallery-line text-3xl text-white"></i>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">나의 신앙 카드 보관함</h1>
            <p className="text-sm text-foreground-600 leading-relaxed">
              주간 요약 카드로 저장한 순간들을<br className="md:hidden" /> 한 곳에 모아두고 다시 꺼내볼 수 있어요
            </p>
            <p className="text-[11px] text-foreground-400 mt-2 inline-flex items-center gap-1">
              <i className="ri-device-line"></i>
              이 기기에만 안전하게 보관돼요
            </p>
          </div>
        </motion.div>

        {loading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-primary-400 border-t-transparent animate-spin mx-auto"></div>
          </div>
        ) : cards.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 rounded-[24px] bg-background-100 border border-background-200"
          >
            <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4">
              <i className="ri-folder-image-line text-2xl text-primary-300"></i>
            </div>
            <p className="text-sm text-foreground-600 mb-1">아직 보관한 카드가 없어요.</p>
            <p className="text-xs text-foreground-400 mb-5">신앙일기에서 이번 주 여정을 요약하고 카드로 저장해보세요.</p>
            <Link
              to="/faith-diary"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary-500 text-background-50 text-sm font-bold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-book-2-line"></i> 신앙일기로 가기
            </Link>
          </motion.div>
        ) : (
          <>
            <p className="text-xs text-foreground-500 mb-3">
              총 <b className="text-primary-600 font-bold">{cards.length}장</b>의 카드를 보관 중이에요
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cards.map(card => (
                <motion.div
                  key={card.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[20px] bg-background-100 border border-background-200 overflow-hidden group"
                >
                  <button
                    onClick={() => setViewing(card)}
                    className="relative block w-full aspect-[4/5] overflow-hidden cursor-pointer"
                  >
                    <img src={card.url} alt={`${card.weekLabel} 신앙 카드`} title={`${card.weekLabel} 주간 신앙 여정 카드`} className="absolute inset-0 w-full h-full object-cover object-top" />
                    <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <span className="w-10 h-10 rounded-full bg-white/85 text-foreground-900 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <i className="ri-zoom-in-line text-lg"></i>
                      </span>
                    </span>
                  </button>
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-bold text-foreground-950 truncate">{card.weekLabel}</p>
                      {card.moodEmoji && <span className="text-base shrink-0 leading-none">{card.moodEmoji}</span>}
                    </div>
                    {card.verseRef && (
                      <p className="text-[11px] text-primary-600 font-semibold truncate mb-1">
                        <i className="ri-book-open-line mr-0.5"></i>{card.verseRef}
                      </p>
                    )}
                    <p className="text-[11px] text-foreground-400 mb-2.5">보관일 {formatStamp(card.createdAt)}</p>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleDownload(card)}
                        className="flex-1 flex items-center justify-center gap-1 py-2 rounded-full bg-primary-500 text-background-50 text-[11px] font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <i className="ri-download-line"></i> 저장
                      </button>
                      <button
                        onClick={() => handleShare(card)}
                        disabled={busy}
                        className="flex-1 flex items-center justify-center gap-1 py-2 rounded-full border border-primary-200 text-primary-600 text-[11px] font-semibold hover:bg-primary-50 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                      >
                        <i className="ri-share-forward-line"></i> 공유
                      </button>
                      <button
                        onClick={() => setConfirmId(card.id)}
                        aria-label="카드 삭제"
                        className="w-8 h-8 flex items-center justify-center rounded-full border border-background-200 text-foreground-400 hover:text-rose-500 hover:border-rose-200 transition-colors cursor-pointer shrink-0"
                      >
                        <i className="ri-delete-bin-line text-sm"></i>
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 이미지 뷰어 */}
      <AnimatePresence>
        {viewing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setViewing(null)}
            className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm max-h-full flex flex-col"
            >
              <div className="max-h-[70vh] overflow-y-auto rounded-[20px]">
                <img src={viewing.url} alt={`${viewing.weekLabel} 신앙 카드`} className="w-full rounded-[20px]" />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleDownload(viewing)}
                  className="flex items-center justify-center gap-1.5 py-3 rounded-full bg-background-50 text-foreground-900 text-sm font-semibold hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-download-line"></i> 저장
                </button>
                <button
                  onClick={() => handleShare(viewing)}
                  disabled={busy}
                  className="flex items-center justify-center gap-1.5 py-3 rounded-full bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  <i className="ri-share-forward-line"></i> 공유
                </button>
                <button
                  onClick={() => { setConfirmId(viewing.id); }}
                  className="flex items-center justify-center gap-1.5 py-3 rounded-full border border-white/40 text-white text-sm font-semibold hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-delete-bin-line"></i> 삭제
                </button>
              </div>
              <button
                onClick={() => setViewing(null)}
                className="mt-2 py-2.5 text-white/80 text-sm font-medium hover:text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                닫기
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 삭제 확인 */}
      <AnimatePresence>
        {confirmId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirmId(null)}
            className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-background-50 rounded-[24px] p-6 w-full max-w-xs text-center"
            >
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center mx-auto mb-3">
                <i className="ri-delete-bin-line text-xl"></i>
              </div>
              <p className="text-base font-bold text-foreground-950 mb-1">카드를 삭제할까요?</p>
              <p className="text-xs text-foreground-500 mb-5">보관함에서 삭제하면 되돌릴 수 없어요.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmId(null)} className="flex-1 py-2.5 rounded-full border border-background-200 text-sm font-medium text-foreground-600 hover:bg-background-100 cursor-pointer whitespace-nowrap">취소</button>
                <button onClick={() => handleDelete(confirmId)} className="flex-1 py-2.5 rounded-full bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 cursor-pointer whitespace-nowrap">삭제</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 토스트 */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[95] px-4 py-2.5 rounded-full bg-foreground-950/90 text-background-50 text-xs font-medium"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}