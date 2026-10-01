import { useEffect, useState } from 'react';
import { fetchAndCacheQuoteOfTheDay, getCachedQuoteOfTheDay } from '@/lib/dailyQuote';

export default function HomeDailyQuote() {
  const [dailyQuote, setDailyQuote] = useState(() => getCachedQuoteOfTheDay());

  useEffect(() => {
    let cancelled = false;

    const run = () => {
      void fetchAndCacheQuoteOfTheDay().then((quote) => {
        if (!cancelled) setDailyQuote(quote);
      });
    };

    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout: 2500 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }

    const id = globalThis.setTimeout(run, 800);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(id);
    };
  }, []);

  return (
    <section className="w-full max-w-6xl mx-auto px-2.5 min-[360px]:px-3 sm:px-4 md:px-6 mt-5 md:mt-6">
      <div className="relative overflow-hidden rounded-[1.25rem] bg-gradient-to-br from-primary-500 via-primary-600 to-primary-800 px-4 py-5 min-[360px]:px-5 sm:px-6 md:px-8 md:py-8 shadow-sm">
        <i className="ri-double-quotes-l absolute -top-3 right-1 min-[360px]:right-2 sm:right-4 md:right-6 text-white/15 text-[5.5rem] min-[360px]:text-[6.5rem] md:text-[7rem] pointer-events-none"></i>

        <div className="relative flex items-center gap-2.5 min-[360px]:gap-3 md:gap-3.5 mb-3 min-[360px]:mb-3.5 md:mb-5">
          <span className="flex w-10 h-10 min-[360px]:w-11 min-[360px]:h-11 md:w-12 md:h-12 flex-shrink-0 items-center justify-center rounded-xl bg-white/15 border border-white/20 shadow-inner">
            <i className="ri-book-open-line text-white text-base min-[360px]:text-lg md:text-xl"></i>
          </span>
          <p className="text-[clamp(0.7rem,2.8vw,0.8rem)] font-black tracking-[0.16em] text-white/90">오늘의 어록</p>
        </div>

        <div className="relative min-w-0">
          <span aria-hidden="true" className="absolute -left-0.5 -top-2 min-[360px]:-left-1 min-[360px]:-top-3 md:-left-1.5 md:-top-4 font-serif text-2xl min-[360px]:text-3xl md:text-4xl font-black text-white/35 leading-none">“</span>
          <p
            className="font-quote text-[clamp(1.04rem,4.6vw,1.44rem)] font-extrabold text-white leading-[1.72] min-[360px]:leading-[1.78] md:leading-[1.88] whitespace-pre-line break-keep tracking-[0.01em] drop-shadow-[0_1px_1px_rgba(0,0,0,0.22)] pl-3 min-[360px]:pl-4 md:pl-5"
            style={{
              fontFamily: '"Noto Serif KR", "Nanum Myeongjo", "AppleMyungjo", "Batang", ui-serif, Georgia, "Times New Roman", serif',
              fontWeight: 800,
              fontStyle: 'normal',
              fontSynthesis: 'weight',
              letterSpacing: '0.01em',
              textShadow: '0 1px 1px rgba(0,0,0,0.16)',
              WebkitTextStroke: '0.15px rgba(255,255,255,0.22)'
            }}
          >
            {dailyQuote}
          </p>
          <div className="mt-3 min-[360px]:mt-3.5 md:mt-4 h-px w-full bg-white/55 rounded-full" />
        </div>
      </div>
    </section>
  );
}
