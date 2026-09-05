/**
 * 브라우저에서 이미지를 리사이즈/압축해 작은 용량의 썸네일 Blob을 만든다.
 * - 추억창(memoryBoard) 업로드 시 원본과 별도로 그리드용 썸네일을 생성하기 위해 사용.
 * - 서버(Supabase Storage Image Transformations)가 막혀 있는 무료 플랜에서도 동작하도록
 *   전적으로 클라이언트(canvas)에서 처리한다.
 */

export interface ResizeOptions {
  /** 리사이즈 후 가로/세로 중 긴 변의 최대 픽셀 수 (기본 480px, 그리드 셀 표시에는 충분) */
  maxDimension?: number;
  /** 출력 압축 품질 0~1 (기본 0.72) */
  quality?: number;
  /** 출력 MIME 타입 (기본 image/jpeg — 투명도가 필요 없는 사진에 가장 작은 용량) */
  mimeType?: string;
  /** 출력 Blob의 최대 바이트 수. 지정하면 품질/크기를 자동으로 낮춰 상한을 맞춘다. */
  maxBytes?: number;
}

const DEFAULTS = {
  maxDimension: 480,
  quality: 0.72,
  mimeType: 'image/jpeg',
} satisfies Required<Omit<ResizeOptions, 'maxBytes'>>;

function isHeicFile(source: File | Blob): boolean {
  const type = source.type.toLowerCase();
  if (type === 'image/heic' || type === 'image/heif' || type === 'image/heic-sequence' || type === 'image/heif-sequence') {
    return true;
  }

  if (source instanceof File) {
    return /\.(heic|heif)$/i.test(source.name);
  }

  return false;
}

function sourceDescription(source: File | Blob): string {
  const name = source instanceof File ? source.name : 'converted-image';
  const type = source.type || 'unknown';
  const size = `${Math.round(source.size / 1024)}KB`;
  return `${name} | ${type} | ${size}`;
}

function errorDescription(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name || 'unknown error';
  }
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'unknown error';
  }
}

async function convertHeicToJpeg(source: File | Blob): Promise<Blob> {
  if (!isHeicFile(source)) return source;

  try {
    const { default: heic2any } = await import('heic2any');
    const converted = await heic2any({
      blob: source,
      toType: 'image/jpeg',
      quality: 0.88,
    });
    return Array.isArray(converted) ? converted[0] : converted;
  } catch (error) {
    console.error('HEIC/HEIF 이미지 변환 실패:', error);
    throw new Error(`[IMAGE_HEIC_CONVERSION_ERROR] ${sourceDescription(source)} | ${errorDescription(error)}`);
  }
}

/** HEIC/HEIF는 먼저 JPG로 변환한 뒤 브라우저 이미지 디코딩을 진행한다. */
async function loadDrawable(source: File | Blob): Promise<{ drawable: CanvasImageSource; width: number; height: number; close: () => void }> {
  const drawableSource = await convertHeicToJpeg(source);
  const sourceInfo = sourceDescription(drawableSource);
  let bitmapError: unknown = null;

  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(drawableSource);
      return { drawable: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch (error) {
      bitmapError = error;
      console.warn('createImageBitmap 이미지 디코딩 실패:', error);
      // fall through to <img> 기반 디코딩
    }
  }

  const objectUrl = URL.createObjectURL(drawableSource);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('브라우저 Image 디코딩 실패'));
      el.src = objectUrl;
    });
    return { drawable: img, width: img.naturalWidth || img.width, height: img.naturalHeight || img.height, close: () => URL.revokeObjectURL(objectUrl) };
  } catch (imgError) {
    URL.revokeObjectURL(objectUrl);
    const bitmapDetail = bitmapError ? ` | createImageBitmap=${errorDescription(bitmapError)}` : '';
    throw new Error(`[IMAGE_DECODE_ERROR] ${sourceInfo}${bitmapDetail} | Image=${errorDescription(imgError)}`);
  }
}

/**
 * 이미지 파일(File | Blob)을 지정한 최대 크기로 축소하고 압축한 Blob을 반환한다.
 * 원본이 이미 maxDimension보다 작으면 확대하지 않는다.
 *
 * 디코딩에 실패하면 원본을 그대로 저장하지 않고 업로드를 중단한다.
 * 업로드 계층에서는 maxBytes를 지정해 Storage에 들어가는 이미지 크기도 제한한다.
 */
export async function resizeImageFile(source: File | Blob, options: ResizeOptions = {}): Promise<Blob> {
  const { maxDimension, quality, mimeType } = { ...DEFAULTS, ...options };

  let drawableResult: Awaited<ReturnType<typeof loadDrawable>>;
  drawableResult = await loadDrawable(source);

  const { drawable, width, height, close } = drawableResult;
  try {
    if (!width || !height) throw new Error(`[IMAGE_DIMENSION_ERROR] ${sourceDescription(source)} | width=${width} height=${height}`);

    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(`[IMAGE_CANVAS_ERROR] ${sourceDescription(source)} | 2D context unavailable`);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(drawable, 0, 0, targetW, targetH);

    const encode = (targetCanvas: HTMLCanvasElement, targetQuality: number) =>
      new Promise<Blob | null>((resolve) => targetCanvas.toBlob(resolve, mimeType, targetQuality));

    let currentCanvas = canvas;
    let currentQuality = Math.min(1, Math.max(0.2, quality));
    let blob = await encode(currentCanvas, currentQuality);
    if (!blob) throw new Error(`[IMAGE_ENCODE_ERROR] ${sourceDescription(source)} | mime=${mimeType} quality=${currentQuality}`);

    if (options.maxBytes && blob.size > options.maxBytes) {
      for (let attempt = 0; attempt < 8 && blob.size > options.maxBytes; attempt += 1) {
        currentQuality = Math.max(0.2, currentQuality - 0.1);
        blob = await encode(currentCanvas, currentQuality);
        if (!blob) break;
      }
    }

    if (options.maxBytes && blob && blob.size > options.maxBytes) {
      let width = currentCanvas.width;
      let height = currentCanvas.height;
      for (let attempt = 0; attempt < 5 && blob.size > options.maxBytes; attempt += 1) {
        width = Math.max(1, Math.round(width * 0.85));
        height = Math.max(1, Math.round(height * 0.85));
        const smallerCanvas = document.createElement('canvas');
        smallerCanvas.width = width;
        smallerCanvas.height = height;
        const smallerCtx = smallerCanvas.getContext('2d');
        if (!smallerCtx) break;
        smallerCtx.imageSmoothingEnabled = true;
        smallerCtx.imageSmoothingQuality = 'high';
        smallerCtx.drawImage(drawable, 0, 0, width, height);
        currentCanvas = smallerCanvas;
        blob = await encode(currentCanvas, currentQuality);
        if (!blob) break;
      }
    }

    if (!blob) throw new Error(`[IMAGE_ENCODE_ERROR] ${sourceDescription(source)} | mime=${mimeType}`);
    if (options.maxBytes && blob.size > options.maxBytes) {
      throw new Error(`[IMAGE_SIZE_LIMIT_ERROR] ${sourceDescription(source)} | output=${blob.size} max=${options.maxBytes}`);
    }
    return blob;
  } finally {
    close();
  }
}

/** 업로드 원본 파일명에서 안전한 썸네일 저장 경로용 파일명을 만든다 (항상 .jpg로 통일) */
export function thumbFileNameFor(safeName: string): string {
  return `thumb_${safeName.replace(/\.[^./]+$/, '')}.jpg`;
}
