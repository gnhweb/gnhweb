import type { ClubType } from '@/types/auth';

export interface WeeklyReport {
  id: string;
  author_id: string;
  author_name: string;
  club: ClubType;
  week_start: string;
  attendance_count: number;
  total_members: number;
  progress_summary: string;
  special_notes: string;
  status: 'draft' | 'submitted' | 'president_reviewed' | 'reviewed' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  reviewer_name?: string;
  feedback?: string;
}

export const mockWeeklyReports: WeeklyReport[] = [];

export const STATUS_LABELS: Record<WeeklyReport['status'], string> = {
  draft: '작성중',
  submitted: '제출됨',
  president_reviewed: '회장검토완료',
  reviewed: '교사검토완료',
  approved: '승인됨',
  rejected: '반려됨',
};

export const STATUS_COLORS: Record<WeeklyReport['status'], string> = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-amber-100 text-amber-700',
  president_reviewed: 'bg-teal-100 text-teal-700',
  reviewed: 'bg-sky-100 text-sky-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
};