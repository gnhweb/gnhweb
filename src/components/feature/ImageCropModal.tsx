import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ImageCropModalProps {
  open: boolean;
  imageFile: File | null;
  aspectRatio: number; // width / height, e.g. 2 for 2:1, 1.6 for 8:5
  outputWidth: number;
  outputHeight: number;
  title?: string;
  onApply: (croppedBlob: Blob, fileName: string) => void;
  onCancel: () => void;
}

export default function ImageCropModal({
  open,
  imageFile,
  aspectRatio,
  outputWidth,
  outputHeight,
  title = '이미지 편집',
  onApply,
  onCancel,
}: ImageCropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [previewSize, setPreviewSize] = useState({ w: 0, h: 0 });
  const [processing, setProcessing] = useState(false);

  // Load image when file changes
  useEffect(() => {
    if (!open || !imageFile) return;
    const img = new Image();
    const url = URL.createObjectURL(imageFile);
    img.onload = () => {
      imgRef.current = img;
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      // Compute preview size
      const maxPreviewW = Math.min(640, window.innerWidth - 48);
      const previewW = maxPreviewW;
      const previewH = previewW / aspectRatio;
      setPreviewSize({ w: previewW, h: previewH });
      // Reset zoom/pan
      setZoom(1);
      // Center the image initially
      const imgRatio = img.naturalWidth / img.naturalHeight;
      let baseW: number, baseH: number;
      if (imgRatio > aspectRatio) {
        baseH = img.naturalHeight;
        baseW = baseH * aspectRatio;
      } else {
        baseW = img.naturalWidth;
        baseH = baseW / aspectRatio;
      }
      const startX = (img.naturalWidth - baseW) / 2;
      const startY = (img.naturalHeight - baseH) / 2;
      setPan({ x: startX, y: startY });
    };
    img.src = url;
    return () => { URL.revokeObjectURL(url); };
  }, [open, imageFile, aspectRatio]);

  // Draw preview canvas
  useEffect(() => {
    if (!open || !imgRef.current || previewSize.w === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = previewSize.w;
    canvas.height = previewSize.h;

    const img = imgRef.current;
    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;

    // Base view size (at zoom=1) that covers image with correct aspect ratio
    let baseW: number, baseH: number;
    const imgRatio = imgW / imgH;
    if (imgRatio > aspectRatio) {
      baseH = imgH;
      baseW = baseH * aspectRatio;
    } else {
      baseW = imgW;
      baseH = baseW / aspectRatio;
    }

    // Apply zoom
    const viewW = baseW / zoom;
    const viewH = baseH / zoom;

    // Clamp pan to image bounds
    const maxPanX = imgW - viewW;
    const maxPanY = imgH - viewH;
    const clampedX = Math.max(0, Math.min(pan.x, maxPanX));
    const clampedY = Math.max(0, Math.min(pan.y, maxPanY));

    if (clampedX !== pan.x || clampedY !== pan.y) {
      setPan({ x: clampedX, y: clampedY });
      return; // Will re-render
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, clampedX, clampedY, viewW, viewH, 0, 0, previewSize.w, previewSize.h);
  }, [open, zoom, pan, previewSize, aspectRatio]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  }, []);

  const getDelta = useCallback((clientX: number, clientY: number) => {
    if (!imgRef.current) return;
    const dx = (clientX - dragStart.x);
    const dy = (clientY - dragStart.y);
    setDragStart({ x: clientX, y: clientY });

    const imgW = imgRef.current.naturalWidth;
    const imgH = imgRef.current.naturalHeight;
    const imgRatio = imgW / imgH;
    let baseW: number, baseH: number;
    if (imgRatio > aspectRatio) {
      baseH = imgH;
      baseW = baseH * aspectRatio;
    } else {
      baseW = imgW;
      baseH = baseW / aspectRatio;
    }
    const viewW = baseW / zoom;
    const viewH = baseH / zoom;
    const sourceDx = -(dx * (viewW / previewSize.w));
    const sourceDy = -(dy * (viewH / previewSize.h));

    setPan(prev => {
      const nextX = Math.max(0, Math.min(prev.x + sourceDx, imgW - viewW));
      const nextY = Math.max(0, Math.min(prev.y + sourceDy, imgH - viewH));
      return { x: nextX, y: nextY };
    });
  }, [isDragging, dragStart, zoom, previewSize, aspectRatio]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    getDelta(e.clientX, e.clientY);
  }, [isDragging, getDelta]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    e.preventDefault();
    getDelta(e.touches[0].clientX, e.touches[0].clientY);
  }, [isDragging, getDelta]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleApply = useCallback(async () => {
    if (!imgRef.current || !imageFile) return;
    setProcessing(true);

    const img = imgRef.current;
    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;
    const imgRatio = imgW / imgH;

    let baseW: number, baseH: number;
    if (imgRatio > aspectRatio) {
      baseH = imgH;
      baseW = baseH * aspectRatio;
    } else {
      baseW = imgW;
      baseH = baseW / aspectRatio;
    }

    const viewW = baseW / zoom;
    const viewH = baseH / zoom;
    const clampedX = Math.max(0, Math.min(pan.x, imgW - viewW));
    const clampedY = Math.max(0, Math.min(pan.y, imgH - viewH));

    // Create output canvas
    const outCanvas = document.createElement('canvas');
    outCanvas.width = outputWidth;
    outCanvas.height = outputHeight;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) {
      setProcessing(false);
      return;
    }

    outCtx.drawImage(img, clampedX, clampedY, viewW, viewH, 0, 0, outputWidth, outputHeight);

    outCanvas.toBlob((blob) => {
      if (blob) {
        const ext = imageFile.name.split('.').pop() || 'jpg';
        const newName = imageFile.name.replace(/\.[^.]+$/, '') + `-cropped.${ext}`;
        onApply(blob, newName);
      }
      setProcessing(false);
    }, 'image/jpeg', 0.92);
  }, [imgRef, imageFile, zoom, pan, aspectRatio, outputWidth, outputHeight, onApply]);

  if (!open || !imageFile) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.92, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-background-100 rounded-2xl w-full max-w-[680px] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-background-200">
              <h3 className="text-sm font-bold text-foreground-950">{title}</h3>
              <button
                onClick={onCancel}
                className="w-8 h-8 rounded-full hover:bg-background-100 flex items-center justify-center cursor-pointer transition-colors"
              >
                <i className="ri-close-line text-lg text-foreground-500"></i>
              </button>
            </div>

            {/* Canvas */}
            <div className="px-5 py-4">
              <div
                ref={containerRef}
                className="relative mx-auto rounded-xl overflow-hidden border-2 border-primary-300 cursor-move select-none bg-background-100"
                style={{
                  width: previewSize.w || '100%',
                  height: previewSize.h || 200,
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <canvas
                  ref={canvasRef}
                  className="w-full h-full"
                  style={{ touchAction: 'none' }}
                />
                {/* Overlay hint */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="absolute inset-0 border-2 border-white/60 rounded-xl"></div>
                  <div className="bg-black/40 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full">
                    드래그로 이동 · 슬라이더로 확대
                  </div>
                </div>
              </div>

              {/* Zoom slider */}
              <div className="mt-4 flex items-center gap-3">
                <i className="ri-zoom-out-line text-foreground-400 text-sm"></i>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="flex-1 h-1.5 bg-background-200 rounded-full appearance-none cursor-pointer accent-primary-500"
                />
                <i className="ri-zoom-in-line text-foreground-400 text-sm"></i>
                <span className="text-xs font-medium text-foreground-600 w-10 text-right">
                  {Math.round(zoom * 100)}%
                </span>
              </div>

              <p className="text-[11px] text-foreground-400 mt-2 text-center">
                출력 비율: {aspectRatio === 2 ? '2:1 (배너)' : aspectRatio === 1.6 ? '8:5 (카드)' : `${aspectRatio}:1`} ·
                출력 크기: {outputWidth}×{outputHeight}px
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-background-200">
              <button
                onClick={onCancel}
                disabled={processing}
                className="px-4 py-2 rounded-full text-sm font-medium text-foreground-600 hover:bg-background-100 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                취소
              </button>
              <button
                onClick={handleApply}
                disabled={processing}
                className="px-5 py-2 rounded-full bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {processing ? (
                  <span className="flex items-center gap-1.5">
                    <i className="ri-loader-4-line animate-spin"></i>
                    처리 중...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <i className="ri-check-line"></i>
                    적용하기
                  </span>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}