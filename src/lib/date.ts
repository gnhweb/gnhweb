/**
 * Date helpers for site business dates in Korea (Asia/Seoul).
 * Avoid Date#toISOString().split('T')[0] for date-only values because
 * ISO conversion is UTC-based and can shift dates around midnight in Korea.
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

export function formatDateKey(value: string | Date | number): string {
  return dateKey(value);
}

/** Backward-compatible alias used by pages importing formatLocalDate. */
export function formatLocalDate(value: string | Date | number): string {
  return dateKey(value);
}
