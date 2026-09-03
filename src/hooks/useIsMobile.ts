import { useState, useEffect } from 'react';

const MOBILE_QUERY = '(max-width: 767px)'; // Tailwind `md:` 브레이크포인트(768px)와 동일한 기준

/**
 * Tailwind의 `md:` 브레이크포인트와 동일한 기준으로 모바일 여부를 판단하는 훅.
 *
 * 이 프로젝트 여러 곳에서 `md:hidden` / `hidden md:grid` 클래스로 모바일/데스크톱 레이아웃을
 * "둘 다" DOM에 넣고 CSS로 하나만 보이게 하는 패턴을 쓰는데, 그 안에 <img>가 있으면
 * display:none이어도 브라우저가 뷰포트와 무관하게 무조건 다운로드해버려 이미지를 2배로
 * 받아오게 된다 (club-banners 카드 이미지가 이 문제로 요청이 2배가 됐던 사례).
 *
 * 이 훅을 써서 실제로 필요한 레이아웃 "하나만" 조건부로 렌더링하면 그 문제를 원천 차단할 수 있다.
 * 이 프로젝트는 순수 클라이언트 SPA(Vite, SSR 없음)라 초기 렌더부터 정확한 값을 동기적으로
 * 얻을 수 있어 하이드레이션 불일치나 깜빡임 걱정이 없다.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_QUERY).matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
