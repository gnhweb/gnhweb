import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

interface PhotoLightboxProps {
  photos: string[];
  initialIndex: number;
  onClose: () => void;
  captions?: (string | null | undefined)[];
}

/**
 * 모바일 중심의 사진 확대 뷰어.
 * - 탭한 사진을 전체화면으로 확대
 * - 좌우 스와이프로 다음/이전 사진 이동
 * - 더블탭 또는 핀치로 확대/축소, 확대 상태에서 드래그 이동
 * - 아래로 스와이프하거나 배경/닫기 버튼 탭으로 닫기
 * - 데스크톱: 화살표 키 이동, ESC 닫기, 마우스 휠/드래그도 지원
 */
export default function PhotoLightbox({ photos, initialIndex, onClose, captions }: PhotoLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState(0); // 닫기용 수직 드래그 오프셋(미확대 상태)
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef(0);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartRef = useRef<{ dist: number; scale: number } | null>(null);
  const panStartRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const resetZoom = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  const goTo = useCallback((next: number) => {
    if (next < 0 || next >= photos.length) return;
    setIndex(next);
    resetZoom();
  }, [photos.length, resetZoom]);

  // body 스크롤 잠금
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

  // 키보드 네비게이션 (데스크톱)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') goTo(index + 1);
      else if (e.key === 'ArrowLeft') goTo(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, goTo, onClose]);

  const getDistance = (pts: { x: number; y: number }[]) => {
    const [a, b] = pts;
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      pinchStartRef.current = { dist: getDistance(pts), scale };
      swipeStartRef.current = null;
      panStartRef.current = null;
    } else if (pointersRef.current.size === 1) {
      if (scale > 1) {
        panStartRef.current = { x: e.clientX, y: e.clientY, tx: translate.x, ty: translate.y };
      } else {
        swipeStartRef.current = { x: e.clientX, y: e.clientY };
      }
      setIsDragging(true);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2 && pinchStartRef.current) {
      const pts = Array.from(pointersRef.current.values());
      const dist = getDistance(pts);
      const nextScale = Math.min(4, Math.max(1, pinchStartRef.current.scale * (dist / pinchStartRef.current.dist)));
      setScale(nextScale);
      return;
    }

    if (pointersRef.current.size === 1) {
      if (scale > 1 && panStartRef.current) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        setTranslate({ x: panStartRef.current.tx + dx, y: panStartRef.current.ty + dy });
      } else if (swipeStartRef.current) {
        const dx = e.clientX - swipeStartRef.current.x;
        const dy = e.clientY - swipeStartRef.current.y;
        // 수직 이동이 더 크면 닫기용 드래그로 처리
        if (Math.abs(dy) > Math.abs(dx)) {
          setDragOffset(dy);
        }
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);

    if (pointersRef.current.size === 0) {
      setIsDragging(false);

      if (scale <= 1 && swipeStartRef.current) {
        const dx = e.clientX - swipeStartRef.current.x;
        const dy = e.clientY - swipeStartRef.current.y;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        if (absY > absX && absY > 90) {
          onClose();
          swipeStartRef.current = null;
          return;
        }
        if (absX > absY && absX > 60) {
          if (dx < 0) goTo(index + 1);
          else goTo(index - 1);
        }
      }

      // 확대 상태에서 이미지 밖으로 과하게 벗어나면 다시 스냅
      if (scale > 1) {
        setTranslate(t => ({
          x: Math.max(-200 * scale, Math.min(200 * scale, t.x)),
          y: Math.max(-200 * scale, Math.min(200 * scale, t.y)),
        }));
      }

      setDragOffset(0);
      swipeStartRef.current = null;
      panStartRef.current = null;
      pinchStartRef.current = null;
    } else if (pointersRef.current.size === 1) {
      // 핀치에서 한 손가락만 남은 경우, 남은 손가락으로 팬 재시작
      const remaining = Array.from(pointersRef.current.values())[0];
      pinchStartRef.current = null;
      if (scale > 1) {
        panStartRef.current = { x: remaining.x, y: remaining.y, tx: translate.x, ty: translate.y };
      }
    }
  };

  const handleDoubleTapOrClick = (e: React.MouseEvent | React.PointerEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (scale > 1) {
        resetZoom();
      } else {
        setScale(2.2);
      }
    }
    lastTapRef.current = now;
    e.stopPropagation();
  };

  const currentCaption = captions?.[index];
  const closing = Math.abs(dragOffset) > 90;
  const bgOpacity = scale > 1 ? 1 : Math.max(0.35, 1 - Math.abs(dragOffset) / 400);

  const content = (
    <AnimatePresence>
      <motion.div
        key="lightbox-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: bgOpacity }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[100] bg-black flex flex-col select-none touch-none"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={onClose}
      >
        {/* 상단 바 */}
        <div className="relative z-10 flex items-center justify-between px-4 pt-3 pb-2 shrink-0" onClick={e => e.stopPropagation()}>
          <span className="text-white/80 text-xs font-medium tabular-nums">
            {photos.length > 1 ? `${index + 1} / ${photos.length}` : ''}
          </span>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {/* 이미지 영역 */}
        <div
          ref={containerRef}
          className="relative flex-1 flex items-center justify-center overflow-hidden"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={e => e.stopPropagation()}
        >
          <motion.img
            key={photos[index]}
            src={photos[index]}
            alt={currentCaption || `사진 ${index + 1}`}
            draggable={false}
            onClick={handleDoubleTapOrClick}
            animate={{
              scale,
              x: translate.x,
              y: scale > 1 ? translate.y : dragOffset,
              opacity: closing ? 0.5 : 1,
            }}
            transition={isDragging ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 30 }}
            className="max-w-full max-h-full w-auto h-auto object-contain"
            style={{ touchAction: 'none' }}
          />

          {/* 데스크톱 좌우 화살표 */}
          {photos.length > 1 && (
            <>
              {index > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); goTo(index - 1); }}
                  aria-label="이전 사진"
                  className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center cursor-pointer"
                >
                  <i className="ri-arrow-left-s-line text-2xl"></i>
                </button>
              )}
              {index < photos.length - 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); goTo(index + 1); }}
                  aria-label="다음 사진"
                  className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center cursor-pointer"
                >
                  <i className="ri-arrow-right-s-line text-2xl"></i>
                </button>
              )}
            </>
          )}
        </div>

        {/* 하단: 캡션 + 썸네일 스트립 */}
        <div className="relative z-10 shrink-0" onClick={e => e.stopPropagation()}>
          {currentCaption && (
            <p className="text-center text-white/85 text-sm px-6 pb-2 truncate">{currentCaption}</p>
          )}
          {photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto px-4 pb-4 pt-1 no-scrollbar">
              {photos.map((p, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-colors cursor-pointer ${i === index ? 'border-white' : 'border-transparent opacity-50'}`}
                >
                  <img src={p} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}