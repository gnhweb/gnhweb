import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

/** 기존 Home 캐러셀을 유지하면서 실제 memory_photos를 랜덤으로 주입한다. 데이터가 없거나 이미지가 깨지면 원래 hero/main.svg로 복구한다. */
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
        .select('id, photo_url')
        .not('photo_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);
      if (cancelled || error || !data?.length) return;
      const usable = data.filter((x: { photo_url?: string }) => typeof x.photo_url === 'string' && x.photo_url.trim());
      if (!usable.length) return;
      selectedUrl = usable[Math.floor(Math.random() * usable.length)].photo_url;
      apply();
    })();

    return () => { cancelled = true; observer.disconnect(); };
  }, []);

  return null;
}
