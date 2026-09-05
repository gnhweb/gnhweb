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
}

const DEFAULTS: Required<ResizeOptions> = {
  maxDimension: 480,
  quality: 0.72,
  mimeType: 'image/jpeg',
};

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
    throw new Error('HEIC 사진을 JPG로 변환하지 못했습니다. 다른 사진을 선택해 주세요.');
  }
}

/** HEIC/HEIF는 먼저 JPG로 변환한 뒤 브라우저 이미지 디코딩을 진행한다. */
async function loadDrawable(source: File | Blob): Promise<{ drawable: CanvasImageSource; width: number; height: number; close: () => void }> {
  const drawableSource = await convertHeicToJpeg(source);

  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(drawableSource);
      return { drawable: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // fall through to <img> 기반 디코딩
    }
  }

  const objectUrl = URL.createObjectURL(drawableSource);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('이미지를 디코딩할 수 없습니다.'));
      el.src = objectUrl;
    });
    return { drawable: img, width: img.naturalWidth || img.width, height: img.naturalHeight || img.height, close: () => URL.revokeObjectURL(objectUrl) };
  } catch (e) {
    URL.revokeObjectURL(objectUrl);
    throw e;
  }
}

/**
 * 이미지 파일(File | Blob)을 지정한 최대 크기로 축소하고 압축한 Blob을 반환한다.
 * 원본이 이미 maxDimension보다 작으면 확대하지 않는다.
 */
export async function resizeImageFile(source: File | Blob, options: ResizeOptions = {}): Promise<Blob> {
  const { maxDimension, quality, mimeType } = { ...DEFAULTS, ...options };

  const { drawable, width, height, close } = await loadDrawable(source);
  try {
    if (!width || !height) throw new Error('이미지 크기를 확인할 수 없습니다.');

    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context를 생성할 수 없습니다.');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(drawable, 0, 0, targetW, targetH);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, quality));
    if (!blob) throw new Error('썸네일 생성에 실패했습니다.');
    return blob;
  } finally {
    close();
  }
}

/** 업로드 원본 파일명에서 안전한 썸네일 저장 경로용 파일명을 만든다 (항상 .jpg로 통일) */
export function thumbFileNameFor(safeName: string): string {
  return `thumb_${safeName.replace(/\.[^./]+$/, '')}.jpg`;
}
