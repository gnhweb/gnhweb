import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import '../dark-contrast.css';

type Theme = 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyDarkThemeToDocument() {
  const root = document.documentElement;
  root.classList.add('dark');
  root.style.colorScheme = 'dark';
  root.style.setProperty('--background-color', '#0b0e1a');
  root.style.setProperty('--foreground-color', '#ffffff');

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', '#0b0e1a');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme] = useState<Theme>('dark');

  useEffect(() => {
    applyDarkThemeToDocument();
  }, []);

  const setTheme = useCallback((_next: Theme) => {
    applyDarkThemeToDocument();
  }, []);

  const toggleTheme = useCallback(() => {
    // 사이트는 다크모드 전용이므로 테마를 변경하지 않습니다.
    applyDarkThemeToDocument();
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
