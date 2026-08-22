import { useEffect, useRef } from 'react';

/**
 * 모바일에서 열린 패널/모달이 있을 때 브라우저 뒤로가기를
 * 먼저 모달 닫기로 소비하도록 돕습니다.
 *
 * open 상태가 유지되는 동안 onClose 함수가 바뀌더라도 history entry가
 * 반복해서 쌓이지 않도록 callback은 ref로 보관합니다.
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

    const marker = { ...(window.history.state ?? {}), __gnhMobileModal: true };
    window.history.pushState(marker, document.title, window.location.href);
    pushedRef.current = true;

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

      // X/바깥 영역 등으로 닫힌 경우, 우리가 추가했던 history entry만 제거합니다.
      if (pushedRef.current && !closingByBackRef.current && window.history.state?.__gnhMobileModal) {
        pushedRef.current = false;
        window.history.back();
      }
    };
  }, [open]);
}
