import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * SPA route changes should start at the top of the new page.
 * Browser history keeps its own restoration behavior; this only handles
 * explicit in-app route transitions.
 */
export default function ScrollToTop() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, search, hash]);

  return null;
}
