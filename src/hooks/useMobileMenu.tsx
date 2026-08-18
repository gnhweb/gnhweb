import { createContext, useContext, useState, type ReactNode } from 'react';

// 모바일 하단 탭바의 "더보기" 탭과 Navbar의 전체화면 모바일 메뉴가
// 같은 열림/닫힘 상태를 공유해야 해서(탭바에서 눌러도 Navbar 메뉴가 열려야 함)
// 가벼운 컨텍스트로 상태만 끌어올렸다. 로직/라우팅은 그대로, 상태 저장 위치만 이동.
interface MobileMenuContextValue {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const MobileMenuContext = createContext<MobileMenuContextValue | null>(null);

export function MobileMenuProvider({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <MobileMenuContext.Provider value={{ mobileOpen, setMobileOpen }}>
      {children}
    </MobileMenuContext.Provider>
  );
}

export function useMobileMenu() {
  const ctx = useContext(MobileMenuContext);
  if (!ctx) {
    // Provider 밖에서 쓰이는 경우를 대비한 안전한 폴백(에러로 앱을 죽이지 않음)
    return { mobileOpen: false, setMobileOpen: () => {} };
  }
  return ctx;
}
