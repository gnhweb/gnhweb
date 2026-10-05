import { toBlob } from 'dom-to-image-more';

export async function captureElementToBlob(element: HTMLElement, backgroundColor = '#ffffff'): Promise<Blob> {
  const blob = await toBlob(element, { bgcolor: backgroundColor, cacheBust: true, pixelRatio: Math.min(window.devicePixelRatio || 1, 2) });
  if (!blob) throw new Error('이미지 캡처에 실패했어요.');
  return blob;
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function shareBlob(blob: Blob, fileName: string, text?: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], fileName, { type: blob.type || 'image/png' });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], text });
    return 'shared';
  }
  downloadBlob(blob, fileName);
  return 'downloaded';
}
