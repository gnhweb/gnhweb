/**
 * 가로 스크롤 카테고리/필터 칩 (공지 카테고리, 동아리 필터 등에서 재사용)
 *
 * 사용 예시:
 * <CategoryChipRow>
 *   {categories.map((c) => (
 *     <CategoryChip key={c} active={active === c} onClick={() => setActive(c)}>
 *       {c}
 *     </CategoryChip>
 *   ))}
 * </CategoryChipRow>
 */
import type { ReactNode } from 'react';

export function CategoryChipRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 snap-x scrollbar-hide">
      {children}
    </div>
  );
}

interface CategoryChipProps {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  count?: number;
}

export function CategoryChip({ children, active, onClick, count }: CategoryChipProps) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 snap-start flex items-center gap-1.5 px-3.5 py-2 rounded-chip text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
        active
          ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-white shadow-card'
          : 'bg-background-100 text-foreground-600'
      }`}
    >
      {children}
      {typeof count === 'number' && count > 0 && (
        <span
          className={`text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center ${
            active ? 'bg-white/25' : 'bg-background-300 text-foreground-500'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
