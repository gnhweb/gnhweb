import type { ClubType } from '@/types/auth';

export interface EventReport {
  id: string;
  author_id: string;
  author_name: string;
  club: ClubType;
  event_name: string;
  event_date: string;
  participant_count: number;
  performance_summary: string;
  improvement_points: string;
  feedback_text: string;
  status: 'draft' | 'submitted' | 'president_reviewed' | 'reviewed' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  reviewer_name?: string;
  feedback?: string;
}

export const EVENT_STATUS_LABELS: Record<EventReport['status'], string> = {
  draft: '작성중',
  submitted: '제출됨',
  president_reviewed: '회장검토완료',
  reviewed: '교사검토완료',
  approved: '승인됨',
  rejected: '반려됨',
};

export const EVENT_STATUS_COLORS: Record<EventReport['status'], string> = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-amber-100 text-amber-700',
  president_reviewed: 'bg-teal-100 text-teal-700',
  reviewed: 'bg-sky-100 text-sky-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
};

export const mockEventReports: EventReport[] = [];