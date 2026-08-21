/**
 * Format a Date as YYYY-MM-DD using the browser's local timezone.
 * This is intended for date-only values (attendance, schedules, missions, etc.).
 * Avoid toISOString() here because it converts to UTC and can shift the date
 * for users in Asia/Seoul during the local morning hours.
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayLocalDate(): string {
  return formatLocalDate(new Date());
}
