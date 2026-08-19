import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = 'theme';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage 접근 불가(프라이빗 모드 등) 시 시스템 설정으로 대체
  }
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function applyThemeToDocument(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  root.style.colorScheme = theme;

  // iOS 상단 상태바/브라우저 UI 색상도 테마에 맞춰 전환
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#0b0e1a' : '#ffffff');
  }

  // 추가: 모든 기기(PWA 포함)에서 일관되게 사용하도록 루트에 hex CSS 변수를 세팅합니다.
  // CSS에서는 우선 이 변수를 사용하고, 브라우저가 oklch() 를 지원하면 oklch 값이 보완적으로 적용됩니다.
  try {
    if (theme === 'dark') {
      root.style.setProperty('--background-color', '#0b0e1a');
      root.style.setProperty('--foreground-color', '#ffffff');
    } else {
      root.style.setProperty('--background-color', '#ffffff');
      root.style.setProperty('--foreground-color', '#0b0e1a');
    }
  } catch {
    // 일부 환경(엄격한 CSP 등)에서 setProperty 실패 가능 — 실패해도 앱 동작에는 영향 없음
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  // 최초 마운트 시 즉시 적용 (SSR/hydration 이슈 없이 CSR 전용이라 안전)
  useEffect(() => {
    applyThemeToDocument(theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyThemeToDocument(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 저장 실패 시 무시 — 이번 세션 동안은 상태로만 유지
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  // 사용자가 OS 다크모드 설정을 바꿨을 때, 사이트에서 직접 선택한 적이 없다면 따라간다
  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      let hasStoredPreference = false;
      try {
        hasStoredPreference = window.localStorage.getItem(STORAGE_KEY) !== null;
      } catch {
        hasStoredPreference = false;
      }
      if (!hasStoredPreference) {
        setThemeState(e.matches ? 'dark' : 'light');
        applyThemeToDocument(e.matches ? 'dark' : 'light');
      }
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme은 ThemeProvider 내부에서만 사용할 수 있습니다.');
  }
  return ctx;
}
