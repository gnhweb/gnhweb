import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

/** 기존 Home 캐러셀을 유지하면서 실제 memory_photos의 작은 썸네일을 랜덤으로 주입한다. 원본은 홈에서 요청하지 않는다. */
export default function HomeMemoryEnhancer() {
  useEffect(() => {
    let cancelled = false;
    let selectedUrl: string | null = null;

    const apply = () => {
      if (cancelled || !selectedUrl || location.pathname !== '/') return;
      document.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
        if (!img.src.includes('/hero/main.svg') && img.dataset.gnhMemoryHero !== '1') return;
        if (img.dataset.gnhMemoryHero === '1' && img.dataset.gnhMemoryUrl === selectedUrl) return;
        if (img.src.includes('/hero/main.svg')) {
          img.dataset.gnhMemoryOriginal = img.src;
          img.dataset.gnhMemoryHero = '1';
          img.dataset.gnhMemoryUrl = selectedUrl!;
          img.alt = '추억창 랜덤 사진';
          img.style.objectFit = 'cover';
          img.style.objectPosition = 'center';
          img.onerror = () => {
            const original = img.dataset.gnhMemoryOriginal;
            if (original) img.src = original;
            delete img.dataset.gnhMemoryHero;
            delete img.dataset.gnhMemoryUrl;
          };
          img.src = selectedUrl!;
        }
      });
    };

    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });

    (async () => {
      const { data, error } = await supabase
        .from('memory_photos')
        .select('id, thumb_url')
        .not('thumb_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);
      if (cancelled || error || !data?.length) return;
      const usable = data.filter((x: { thumb_url?: string | null }) => typeof x.thumb_url === 'string' && x.thumb_url.trim());
      if (!usable.length) return;
      selectedUrl = usable[Math.floor(Math.random() * usable.length)].thumb_url!;
      apply();
    })();

    return () => { cancelled = true; observer.disconnect(); };
  }, []);

  return null;
}
