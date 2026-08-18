import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

type StatusFilter = 'all' | 'draft' | 'submitted' | 'president_reviewed' | 'reviewed' | 'approved' | 'rejected';

interface UseReportListOptions<T> {
  tableName: string;
  orderColumn?: string;
  orderDirection?: 'asc' | 'desc';
  clubFilter?: string | null;
  mapRow: (row: Record<string, unknown>) => T;
}

interface UseReportListReturn<T> {
  items: T[];
  filteredItems: T[];
  loading: boolean;
  error: string | null;
  statusFilter: StatusFilter;
  setStatusFilter: (filter: StatusFilter) => void;
  refetch: () => Promise<void>;
}

export function useReportList<T extends { status: string; club?: string }>({
  tableName,
  orderColumn = 'created_at',
  orderDirection = 'desc',
  clubFilter,
  mapRow,
}: UseReportListOptions<T>): UseReportListReturn<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Use a ref for mapRow to avoid it being a dependency of fetchItems.
  // Inline mapRow functions change identity every render, which would cause
  // fetchItems to be recreated, triggering the useEffect, causing state update,
  // causing re-render, causing new mapRow... infinite loop!
  const mapRowRef = useRef(mapRow);
  mapRowRef.current = mapRow;

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from(tableName)
        .select('*')
        .order(orderColumn, { ascending: orderDirection === 'asc' });

      if (clubFilter && clubFilter !== 'all') {
        query = query.eq('club', clubFilter);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      if (data && data.length > 0) {
        const mapper = mapRowRef.current;
        const mapped = data.map(r => mapper(r as Record<string, unknown>));
        setItems(mapped);
      } else {
        setItems([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '데이터를 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
    // mapRow is intentionally NOT in the dependency array — we use a ref instead
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableName, orderColumn, orderDirection, clubFilter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filteredItems = statusFilter === 'all'
    ? items
    : items.filter(item => item.status === statusFilter);

  return {
    items,
    filteredItems,
    loading,
    error,
    statusFilter,
    setStatusFilter,
    refetch: fetchItems,
  };
}

export const REPORT_STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'draft', label: '작성중' },
  { value: 'submitted', label: '제출됨' },
  { value: 'president_reviewed', label: '회장검토완료' },
  { value: 'reviewed', label: '교사검토완료' },
  { value: 'approved', label: '승인됨' },
  { value: 'rejected', label: '반려됨' },
];

export type { StatusFilter };