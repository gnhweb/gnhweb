import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { searchSite } from '@/lib/siteSearch';

export default function SearchPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialQuery = new URLSearchParams(location.search).get('q') ?? '';
  const [query, setQuery] = useState(initialQuery);
  const results = useMemo(() => searchSite(query), [query]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
  };

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-background-50 px-4 py-5 text-foreground-950 transition-colors dark:bg-[#0b1220] dark:text-white sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-5 sm:mb-7">
          <p className="mb-1 text-xs font-semibold text-primary-600 dark:text-primary-400">강릉학생회</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground-950 dark:text-white sm:text-3xl">사이트 검색</h1>
          <p className="mt-1.5 text-sm text-foreground-500 dark:text-slate-300">찾고 싶은 기능이나 메뉴를 입력해보세요.</p>
        </div>

        <form onSubmit={submit} className="sticky top-[env(safe-area-inset-top)] z-10 mb-5">
          <div className="flex items-center gap-2 rounded-2xl border border-background-200 bg-white p-2 shadow-sm transition-colors focus-within:border-primary-300 focus-within:ring-4 focus-within:ring-primary-50 dark:border-white/10 dark:bg-[#111b2e] dark:shadow-black/20 dark:focus-within:border-primary-500/70 dark:focus-within:ring-primary-500/10">
            <i className="ri-search-line ml-2 text-lg text-foreground-400 dark:text-slate-300" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="예: 행사, 출석, 리더십, 회의, 성경"
              aria-label="사이트 검색"
              enterKeyHint="search"
              autoComplete="off"
              autoCapitalize="none"
              className="min-w-0 flex-1 bg-transparent px-1 py-2 text-[16px] text-foreground-950 outline-none placeholder:text-foreground-400 dark:text-white dark:placeholder:text-slate-400"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-foreground-400 active:bg-background-100 dark:text-slate-300 dark:active:bg-white/10"
                aria-label="검색어 지우기"
              >
                <i className="ri-close-line text-lg" />
              </button>
            )}
            <button
              type="submit"
              className="flex h-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 px-4 text-sm font-semibold text-white active:scale-[0.98] dark:bg-primary-500 dark:text-white dark:hover:bg-primary-400"
            >
              검색
            </button>
          </div>
        </form>

        <div className="mb-3 flex items-center justify-between px-1">
          <p className="text-sm font-semibold text-foreground-800 dark:text-slate-100">{query ? `${results.length}개 결과` : '전체 기능'}</p>
        </div>

        <div className="grid gap-2.5">
          {results.map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className="flex min-h-[72px] w-full items-center gap-3 rounded-2xl border border-background-200 bg-white px-4 py-3 text-left shadow-sm transition active:scale-[0.99] dark:border-white/10 dark:bg-[#111b2e] dark:shadow-black/20"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300">
                <i className={`${item.icon} text-lg`} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold text-foreground-900 dark:text-white">{item.label}</span>
                <span className="mt-0.5 block truncate text-xs text-foreground-500 dark:text-slate-300">{item.description}</span>
              </span>
              <i className="ri-arrow-right-s-line shrink-0 text-lg text-foreground-300 dark:text-slate-500" />
            </button>
          ))}
        </div>

        {query && results.length === 0 && (
          <div className="rounded-2xl border border-dashed border-background-300 bg-white px-5 py-10 text-center dark:border-white/15 dark:bg-[#111b2e]">
            <i className="ri-search-line text-3xl text-foreground-300 dark:text-slate-500" />
            <p className="mt-3 text-sm font-semibold text-foreground-700 dark:text-slate-100">검색 결과가 없어요.</p>
            <p className="mt-1 text-xs text-foreground-400 dark:text-slate-400">다른 키워드로 다시 검색해보세요.</p>
          </div>
        )}
      </div>
    </main>
  );
}
