export interface PracticeEntry {
  practice_date: string;
  attendance_count: number | null;
  progress_summary: string;
  special_notes: string;
}

export function createPracticeEntry(practiceDate: string): PracticeEntry {
  return {
    practice_date: practiceDate,
    attendance_count: null,
    progress_summary: '',
    special_notes: '',
  };
}

export function parsePracticeEntries(value: unknown): PracticeEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      practice_date: typeof item.practice_date === 'string' ? item.practice_date : '',
      attendance_count: typeof item.attendance_count === 'number' ? item.attendance_count : null,
      progress_summary: typeof item.progress_summary === 'string' ? item.progress_summary : '',
      special_notes: typeof item.special_notes === 'string' ? item.special_notes : '',
    }))
    .filter((item) => item.practice_date)
    .sort((a, b) => a.practice_date.localeCompare(b.practice_date));
}

export function getWeekMonday(dateValue: string | Date): string {
  const date = new Date(dateValue);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + diff);
  return formatDateKey(date);
}

export function getWeekSunday(weekStart: string): string {
  const date = new Date(`${weekStart}T12:00:00`);
  date.setDate(date.getDate() + 6);
  return formatDateKey(date);
}

export function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatPracticeDate(dateString: string): string {
  const date = new Date(`${dateString}T12:00:00`);
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${date.getMonth() + 1}.${date.getDate()} (${weekday})`;
}

export function isWithinWeek(dateString: string, weekStart: string): boolean {
  const start = new Date(`${weekStart}T12:00:00`);
  const end = new Date(`${getWeekSunday(weekStart)}T12:00:00`);
  const date = new Date(`${dateString}T12:00:00`);
  return date >= start && date <= end;
}

export function getAttendanceSummary(entries: PracticeEntry[]): {
  practiceCount: number;
  totalAttendance: number;
  averageAttendance: number;
  completedCount: number;
} {
  const completed = entries.filter((entry) => typeof entry.attendance_count === 'number');
  const totalAttendance = completed.reduce((sum, entry) => sum + (entry.attendance_count || 0), 0);
  return {
    practiceCount: entries.length,
    totalAttendance,
    averageAttendance: completed.length > 0 ? Math.round(totalAttendance / completed.length) : 0,
    completedCount: completed.length,
  };
}
