export type Mood = 'joyful' | 'peaceful' | 'reflective' | 'grateful' | 'struggling';
export type StoryType = 'baptism' | 'grace' | 'decision' | 'calling' | 'other';
export type DiaryFilter = 'all' | 'journal' | 'moment' | 'repentance';

export interface FaithEntry { id: string; user_id: string; scripture: string | null; content: string; mood: Mood; entry_date: string; created_at: string; }
export interface StoryEvent { id: string; author_id: string; title: string; description: string | null; event_type: StoryType; event_date: string; photo_url: string | null; created_at: string; }
export interface RepentanceEntry { id: string; author_id: string; title: string; content: string; scripture: string | null; prayer: string | null; created_at: string; }
export interface DiaryDay { date: string; journals: FaithEntry[]; moments: StoryEvent[]; repentances: RepentanceEntry[]; }

export const MOODS: Record<Mood, { icon: string; label: string; chip: string }> = {
  joyful: { icon: 'ri-emotion-happy-line', label: '기쁨', chip: 'bg-primary-100 text-primary-700 border-primary-200' },
  peaceful: { icon: 'ri-emotion-line', label: '평안', chip: 'bg-secondary-100 text-secondary-700 border-secondary-200' },
  reflective: { icon: 'ri-lightbulb-line', label: '묵상', chip: 'bg-accent-100 text-accent-700 border-accent-200' },
  grateful: { icon: 'ri-heart-line', label: '감사', chip: 'bg-accent-100 text-accent-700 border-accent-200' },
  struggling: { icon: 'ri-emotion-sad-line', label: '고민', chip: 'bg-secondary-100 text-secondary-700 border-secondary-200' },
};

export const STORY_TYPES: Record<StoryType, { icon: string; label: string; chip: string }> = {
  baptism: { icon: 'ri-drop-line', label: '세례', chip: 'bg-primary-100 text-primary-700' },
  grace: { icon: 'ri-heart-line', label: '은혜', chip: 'bg-accent-100 text-accent-700' },
  decision: { icon: 'ri-check-double-line', label: '결단', chip: 'bg-secondary-100 text-secondary-700' },
  calling: { icon: 'ri-compass-line', label: '소명', chip: 'bg-primary-100 text-primary-700' },
  other: { icon: 'ri-star-line', label: '기타', chip: 'bg-background-200 text-foreground-600' },
};

export function buildDiaryDays(journals: FaithEntry[], moments: StoryEvent[], repentances: RepentanceEntry[]): DiaryDay[] {
  const map = new Map<string, DiaryDay>();
  const get = (date: string) => { let day = map.get(date); if (!day) { day = { date, journals: [], moments: [], repentances: [] }; map.set(date, day); } return day; };
  journals.forEach(j => { if (j.entry_date) get(j.entry_date).journals.push(j); });
  moments.forEach(m => { if (m.event_date) get(m.event_date).moments.push(m); });
  repentances.forEach(r => { const date = (r.created_at || '').slice(0, 10); if (date) get(date).repentances.push(r); });
  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export function computeStreak(dateStrs: string[]): number {
  const set = new Set(dateStrs);
  const fmt = (d: Date) => { const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return y+'-'+m+'-'+day; };
  let cursor = new Date();
  if (!set.has(fmt(cursor))) { cursor.setDate(cursor.getDate()-1); if (!set.has(fmt(cursor))) return 0; }
  let streak=0;
  while (set.has(fmt(cursor))) { streak += 1; cursor = new Date(cursor); cursor.setDate(cursor.getDate()-1); }
  return streak;
}

export function formatDiaryDate(dateStr: string): string {
  const [y,m,d]=dateStr.split('-').map(Number); if(!y||!m||!d) return dateStr;
  const week=['일','월','화','수','목','금','토'][new Date(y,m-1,d).getDay()];
  return y+'년 '+m+'월 '+d+'일 ('+week+')';
}

export function getWeekDays(base: Date = new Date()): { start: string; end: string; days: string[] } {
  const d=new Date(base); const diff=(d.getDay()+6)%7; const monday=new Date(d); monday.setDate(d.getDate()-diff);
  const days=Array.from({length:7},(_,i)=>{const c=new Date(monday);c.setDate(monday.getDate()+i);const y=c.getFullYear();const m=String(c.getMonth()+1).padStart(2,'0');const day=String(c.getDate()).padStart(2,'0');return y+'-'+m+'-'+day;});
  return {start:days[0],end:days[6],days};
}

export function formatWeekLabel(start: string,end: string): string {
  const fmt=(s:string)=>{const [,m,d]=s.split('-').map(Number);return m+'월 '+d+'일';}; return fmt(start)+' ~ '+fmt(end);
}

export function buildWeekEntries(days: DiaryDay[], weekDays: string[]) {
  const inWeek=new Set(weekDays);
  return days.flatMap(day => {
    if(!inWeek.has(day.date)) return [];
    return [
      ...day.journals.map(j=>({date:day.date,type:'journal' as const,content:j.content,scripture:j.scripture,mood:MOODS[j.mood]?.label??null})),
      ...day.moments.map(m=>({date:day.date,type:'moment' as const,content:[m.title,m.description].filter(Boolean).join(' — '),momentType:STORY_TYPES[m.event_type]?.label??null})),
      ...day.repentances.map(r=>({date:day.date,type:'repentance' as const,content:r.content,scripture:r.scripture})),
    ];
  }).sort((a,b)=>a.date.localeCompare(b.date));
}
