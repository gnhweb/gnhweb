/**
 * Calendar dates used by the site are business dates in Korea (Asia/Seoul).
 * Do not use Date#toISOString().split('T')[0] for date-only values: that
 * converts to UTC first and can shift the date around midnight in Korea.
 */

const KST = 'Asia/Seoul';

function partsToDateKey(parts: Intl.DateTimeFormatPart[]): string {
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function dateKey(value: Date | string | number = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: KST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return partsToDateKey(parts);
}

export function todayKey(): string {
  return dateKey(new Date());
}

/**
 * Format an ISO timestamp as a Korean local calendar date (YYYY-MM-DD).
 */
export function formatDateKey(value: string | Date | number): string {
  return dateKey(value);
}
