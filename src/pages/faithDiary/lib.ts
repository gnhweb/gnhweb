// 신앙일기 — 신앙 스토리북 / 신앙 일지 / 회개 저널을 하나로 합친 통합 기록의
// 타입 · 상수 · 병합 헬퍼를 모아둔 파일입니다.

import type { DiaryWeekEntryPayload } from '@/lib/nvidiaNim';

export type Mood = 'joyful' | 'peaceful' | 'reflective' | 'grateful' | 'struggling';
export type StoryType = 'thanks' | 'grace' | 'decision' | 'calling' | 'other';
export type DiaryFilter = 'all' | 'journal' | 'moment' | 'repentance';

/** 말씀 묵상 일기 (기존 faith_journal_entries) */
export interface FaithEntry {
  id: string;
  user_id: string;
  scripture: string | null;
  content: string;
  mood: Mood;
  entry_date: string;
  created_at: string;
}

/** 신앙의 순간 기록 (기존 faith_storybooks) */
export interface StoryEvent {
  id: string;
  author_id: string;
  title: string;
  description: string | null;
  event_type: StoryType;
  event_date: string;
  photo_url: string | null;
  created_at: string;
}

/** 회개와 기도 기록 (기존 repentance_journals) */
export interface RepentanceEntry {
  id: string;
  author_id: string;
  title: string;
  content: string;
  scripture: string | null;
  prayer: string | null;
  created_at: string;
}

/** 하루치 신앙일기 — 하나의 날짜로 세 가지 요소를 묶은 단위 */
export interface DiaryDay {
  date: string;
  journals: FaithEntry[];
  moments: StoryEvent[];
  repentances: RepentanceEntry[];
}

export const MOODS: Record<Mood, { icon: string; label: string; chip: string; text: string }> = {
  joyful: { icon: 'ri-emotion-happy-line', label: '기쁨', chip: 'bg-amber-100 text-amber-700 border-amber-200', text: 'text-amber-600' },
  peaceful: { icon: 'ri-emotion-line', label: '평안', chip: 'bg-emerald-100 text-emerald-700 border-emerald-200', text: 'text-emerald-600' },
  reflective: { icon: 'ri-lightbulb-line', label: '묵상', chip: 'bg-primary-100 text-primary-700 border-primary-200', text: 'text-primary-600' },
  grateful: { icon: 'ri-heart-line', label: '감사', chip: 'bg-rose-100 text-rose-700 border-rose-200', text: 'text-rose-600' },
  struggling: { icon: 'ri-emotion-sad-line', label: '고민', chip: 'bg-secondary-100 text-secondary-700 border-secondary-200', text: 'text-secondary-600' },
};

export const STORY_TYPES: Record<StoryType, { icon: string; label: string; chip: string }> = {
  thanks: { icon: 'ri-heart-3-line', label: '감사', chip: 'bg-rose-100 text-rose-700' },
  grace: { icon: 'ri-heart-line', label: '은혜', chip: 'bg-primary-100 text-primary-700' },
  decision: { icon: 'ri-check-double-line', label: '결단', chip: 'bg-amber-100 text-amber-700' },
  calling: { icon: 'ri-compass-line', label: '소명', chip: 'bg-emerald-100 text-emerald-700' },
  other: { icon: 'ri-star-line', label: '기타', chip: 'bg-secondary-100 text-secondary-700' },
};

/** 과거에 'baptism'(세례)으로 저장된 기록도 새 유형(감사)으로 이어지도록 정규화 */
export function normalizeStoryType(type: string | null | undefined): StoryType {
  if (type === 'baptism') return 'thanks';
  if (type && type in STORY_TYPES) return type as StoryType;
  return 'other';
}

/** 공유 카드에 크게 넣을 대표 무드 이모지 */
export const MOOD_EMOJI: Record<Mood, string> = {
  joyful: '😊',
  peaceful: '😌',
  reflective: '💭',
  grateful: '🙏',
  struggling: '😔',
};

/** 세 소스를 날짜 기준으로 하나의 타임라인으로 병합 */
export function buildDiaryDays(
  journals: FaithEntry[],
  moments: StoryEvent[],
  repentances: RepentanceEntry[],
): DiaryDay[] {
  const map = new Map<string, DiaryDay>();
  const get = (date: string) => {
    let day = map.get(date);
    if (!day) {
      day = { date, journals: [], moments: [], repentances: [] };
      map.set(date, day);
    }
    return day;
  };

  journals.forEach(j => { if (j.entry_date) get(j.entry_date).journals.push(j); });
  moments.forEach(m => { if (m.event_date) get(m.event_date).moments.push(m); });
  repentances.forEach(r => {
    const date = (r.created_at || '').split('T')[0];
    if (date) get(date).repentances.push(r);
  });

  return Array.from(map.values()).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** 오늘(또는 어제)부터 거슬러 올라가며 연속으로 기록한 날 수 계산 */
export function computeStreak(dateStrs: string[]): number {
  const set = new Set(dateStrs);
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const today = new Date();
  let cursor: Date;
  if (set.has(fmt(today))) cursor = new Date(today);
  else {
    const yest = new Date(today);
    yest.setDate(today.getDate() - 1);
    if (set.has(fmt(yest))) cursor = yest;
    else return 0;
  }
  let streak = 0;
  while (set.has(fmt(cursor))) {
    streak += 1;
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** 'YYYY-MM-DD' → 'YYYY년 M월 D일 (요일)' */
export function formatDiaryDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(y, m - 1, d);
  const week = ['일', '월', '화', '수', '목', '금', '토'][dt.getDay()];
  return `${y}년 ${m}월 ${d}일 (${week})`;
}

/** Date → 'YYYY-MM-DD' (로컬 시간 기준) */
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 이번 주(월요일 시작)의 7일과 시작/끝 날짜를 계산 */
export function getWeekDays(base: Date = new Date()): { start: string; end: string; days: string[] } {
  const d = new Date(base);
  const diff = (d.getDay() + 6) % 7; // 월요일 = 0
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  const days: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const c = new Date(monday);
    c.setDate(monday.getDate() + i);
    days.push(toDateStr(c));
  }
  return { start: days[0], end: days[6], days };
}

/** 주 식별자 (주 시작일인 월요일) — 요약 캐시 키로 사용 */
export function getWeekCacheKey(base: Date = new Date()): string {
  return getWeekDays(base).start;
}

/** 'M월 D일 ~ M월 D일' 형태의 주간 라벨 */
export function formatWeekLabel(start: string, end: string): string {
  const fmt = (s: string) => {
    const [, m, d] = s.split('-').map(Number);
    return `${m}월 ${d}일`;
  };
  return `${fmt(start)} ~ ${fmt(end)}`;
}

/** 이번 주 기록들을 AI 요약용 평평한 목록으로 변환 */
export function buildWeekEntries(days: DiaryDay[], weekDays: string[]): DiaryWeekEntryPayload[] {
  const inWeek = new Set(weekDays);
  const list: DiaryWeekEntryPayload[] = [];
  days.forEach(day => {
    if (!inWeek.has(day.date)) return;
    day.journals.forEach(j =>
      list.push({
        date: day.date,
        type: 'journal',
        content: j.content,
        scripture: j.scripture,
        mood: MOODS[j.mood]?.label ?? null,
      }),
    );
    day.moments.forEach(m =>
      list.push({
        date: day.date,
        type: 'moment',
        content: [m.title, m.description].filter(Boolean).join(' — '),
        momentType: STORY_TYPES[normalizeStoryType(m.event_type)]?.label ?? null,
      }),
    );
    day.repentances.forEach(r =>
      list.push({
        date: day.date,
        type: 'repentance',
        content: r.content,
        scripture: r.scripture,
      }),
    );
  });
  return list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** 이번 주 기록에서 가장 자주 나타난 '대표 무드'를 이모지와 함께 계산 */
export function dominantWeekMood(
  entries: DiaryWeekEntryPayload[],
): { emoji: string; label: string } | null {
  const counts = new Map<string, number>();
  entries.forEach(entry => {
    if (entry.type === 'journal' && entry.mood) {
      counts.set(entry.mood, (counts.get(entry.mood) || 0) + 1);
    }
  });
  let bestLabel: string | null = null;
  let bestCount = 0;
  counts.forEach((count, label) => {
    if (count > bestCount) {
      bestCount = count;
      bestLabel = label;
    }
  });
  if (!bestLabel) return null;
  const key = (Object.keys(MOODS) as Mood[]).find(k => MOODS[k].label === bestLabel);
  if (!key) return null;
  return { emoji: MOOD_EMOJI[key], label: MOODS[key].label };
}