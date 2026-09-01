import { notifyUser } from '@/lib/mobileFeedback';

type ShareAwareWindow = Window & { __gnhBibleMbtiShareBound?: boolean };

const SHARE_FLAG = '__gnhBibleMbtiShareBound';

function getResultRoot(): HTMLElement | null {
  const profileSection = Array.from(document.querySelectorAll('section')).find((section) =>
    section.textContent?.includes('성경인물 소개 ·'),
  );

  if (!profileSection) return null;
  return profileSection.closest<HTMLElement>('.space-y-4') ?? profileSection.parentElement;
}

function downloadImage(blob: Blob, type: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `말씀MBTI_${type}_결과.png`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function shareResultImage() {
  const resultRoot = getResultRoot();
  if (!resultRoot) {
    notifyUser('결과 화면을 찾지 못했어요. 잠시 후 다시 시도해주세요.');
    return;
  }

  const type = resultRoot.querySelector('span')?.textContent?.trim() || '결과';
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(resultRoot, {
    scale: Math.min(window.devicePixelRatio || 2, 3),
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
    ignoreElements: (element) =>
      element.tagName === 'BUTTON' &&
      /공유하기|다시 검사|전체 보기|접기/.test(element.textContent || ''),
  });

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
  if (!blob) throw new Error('결과 이미지 생성에 실패했습니다.');

  const file = new File([blob], `말씀MBTI_${type}_결과.png`, { type: 'image/png' });
  const shareNavigator = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };

  if (typeof navigator.share === 'function' && shareNavigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title: '말씀 MBTI 결과',
      text: `말씀 MBTI ${type} 결과를 확인해보세요.`,
      files: [file],
    });
    notifyUser('결과 이미지를 공유했어요.');
    return;
  }

  downloadImage(blob, type);
  notifyUser('결과 이미지를 저장했어요. 저장된 이미지를 원하는 곳에 공유해 주세요.');
}

function bindShareButton() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const shareWindow = window as ShareAwareWindow;
  if (shareWindow[SHARE_FLAG]) return;
  shareWindow[SHARE_FLAG] = true;

  document.addEventListener(
    'click',
    (event) => {
      if (window.location.pathname !== '/bible-mbti') return;
      if (!(event.target instanceof Element)) return;

      const button = event.target.closest<HTMLButtonElement>('button');
      if (!button || button.textContent?.trim() !== '공유하기') return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      void shareResultImage().catch((error: unknown) => {
        console.error('[Bible MBTI] result image share failed:', error);
        notifyUser('결과 이미지 공유에 실패했어요. 다시 시도해주세요.');
      });
    },
    true,
  );
}

bindShareButton();
