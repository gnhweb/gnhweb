import { useEffect, useRef } from 'react';

/**
 * 모바일 모달/드로어 전용 뒤로가기 처리.
 *
 * - 데스크톱에서는 history를 건드리지 않는다.
 * - 모바일에서 모달이 열릴 때만 history entry를 하나 추가한다.
 * - 시스템/브라우저 뒤로가기는 해당 entry를 소비하면서 모달만 닫는다.
 * - X/바깥 클릭으로 닫은 경우에는 우리가 추가한 entry만 되돌린다.
 * - React Router가 관리하는 history.state는 임의로 덮어쓰지 않는다.
 */
export function useMobileBackHandler(open: boolean, onClose: () => void) {
  const pushedRef = useRef(false);
  const closingByBackRef = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;

    const isMobile =
      window.matchMedia?.('(pointer: coarse)').matches ||
      /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent);

    if (!isMobile) return;

    if (!window.history.state?.__gnhMobileModal) {
      const marker = {
        ...(window.history.state ?? {}),
        __gnhMobileModal: true,
        __gnhMobileModalId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      };

      window.history.pushState(marker, document.title, window.location.href);
      pushedRef.current = true;
    } else {
      pushedRef.current = true;
    }

    const handlePopState = () => {
      if (!pushedRef.current) return;

      pushedRef.current = false;
      closingByBackRef.current = true;
      onCloseRef.current();

      window.setTimeout(() => {
        closingByBackRef.current = false;
      }, 0);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);

      if (
        pushedRef.current &&
        !closingByBackRef.current &&
        window.history.state?.__gnhMobileModal
      ) {
        pushedRef.current = false;
        window.history.back();
      }
    };
  }, [open]);
}
