import { motion } from 'framer-motion';
import {
  MOODS,
  STORY_TYPES,
  normalizeStoryType,
  formatDiaryDate,
  type DiaryDay,
  type DiaryFilter,
} from '@/pages/faithDiary/lib';

interface DiaryTimelineProps {
  days: DiaryDay[];
  filter: DiaryFilter;
  onDeleteJournal: (id: string) => void;
  onDeleteMoment: (id: string, photoUrl: string | null) => void;
  onDeleteRepentance: (id: string) => void;
}

// 하루 = 하나의 카드. 말씀 묵상 · 신앙의 순간 · 회개와 기도를 날짜별로 묶어 보여줍니다.
export default function DiaryTimeline({
  days,
  filter,
  onDeleteJournal,
  onDeleteMoment,
  onDeleteRepentance,
}: DiaryTimelineProps) {
  const showJournal = filter === 'all' || filter === 'journal';
  const showMoment = filter === 'all' || filter === 'moment';
  const showRepentance = filter === 'all' || filter === 'repentance';

  return (
    <div className="relative pl-8">
      {/* 타임라인 세로선 */}
      <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-background-200"></div>
      <div className="space-y-6">
        {days.map((day, idx) => (
          <motion.div
            key={day.date}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(idx, 8) * 0.04 }}
            className="relative"
          >
            {/* 타임라인 점 */}
            <div className="absolute -left-8 top-1.5 w-6 h-6 rounded-full bg-background-50 border-2 border-primary-300 flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-primary-500"></span>
            </div>

            <div className="rounded-[20px] border border-background-200 bg-background-100 p-5">
              {/* 날짜 헤더 */}
              <div className="flex items-center gap-2 mb-3">
                <i className="ri-calendar-line text-primary-500 text-sm"></i>
                <span className="text-sm font-bold text-foreground-950">{formatDiaryDate(day.date)}</span>
              </div>

              <div className="space-y-3">
                {/* 말씀과 묵상 */}
                {showJournal && day.journals.map(j => {
                  const mood = MOODS[j.mood] || MOODS.reflective;
                  return (
                    <div key={j.id} className="rounded-2xl bg-primary-50/70 border border-primary-100 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${mood.chip}`}>
                          <i className={mood.icon}></i>{mood.label}
                        </span>
                        <button onClick={() => onDeleteJournal(j.id)} className="text-foreground-300 hover:text-rose-500 transition-colors cursor-pointer">
                          <i className="ri-delete-bin-line text-sm"></i>
                        </button>
                      </div>
                      {j.scripture && (
                        <div className="rounded-xl bg-background-100 border border-primary-100 px-3 py-2 mb-2">
                          <p className="text-sm text-primary-700 font-medium italic">"{j.scripture}"</p>
                        </div>
                      )}
                      <p className="text-sm text-foreground-700 leading-relaxed whitespace-pre-wrap">{j.content}</p>
                    </div>
                  );
                })}

                {/* 신앙의 순간 */}
                {showMoment && day.moments.map(m => {
                  const type = STORY_TYPES[normalizeStoryType(m.event_type)] || STORY_TYPES.other;
                  return (
                    <div key={m.id} className="rounded-2xl bg-accent-50/60 border border-accent-100 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${type.chip}`}>
                          <i className={type.icon}></i>{type.label}
                        </span>
                        <button onClick={() => onDeleteMoment(m.id, m.photo_url)} className="text-foreground-300 hover:text-rose-500 transition-colors cursor-pointer">
                          <i className="ri-delete-bin-line text-sm"></i>
                        </button>
                      </div>
                      {m.photo_url && (
                        <div className="mb-2 rounded-xl overflow-hidden bg-background-200">
                          <img src={m.photo_url} alt={m.title} className="w-full h-auto max-h-64 object-contain" />
                        </div>
                      )}
                      <h3 className="text-sm font-bold text-foreground-950 mb-1">{m.title}</h3>
                      {m.description && <p className="text-sm text-foreground-700 leading-relaxed whitespace-pre-wrap">{m.description}</p>}
                    </div>
                  );
                })}

                {/* 회개와 기도 */}
                {showRepentance && day.repentances.map(r => (
                  <div key={r.id} className="rounded-2xl bg-rose-50/60 border border-rose-100 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                        <i className="ri-hand-heart-line"></i>회개와 기도
                      </span>
                      <button onClick={() => onDeleteRepentance(r.id)} className="text-foreground-300 hover:text-rose-500 transition-colors cursor-pointer">
                        <i className="ri-delete-bin-line text-sm"></i>
                      </button>
                    </div>
                    <p className="text-sm text-foreground-700 leading-relaxed whitespace-pre-wrap mb-2">{r.content}</p>
                    {r.scripture && (
                      <div className="rounded-xl bg-background-100 border border-amber-200 px-3 py-2 mb-2">
                        <p className="text-xs text-amber-700 italic">"{r.scripture}"</p>
                      </div>
                    )}
                    {r.prayer && (
                      <div className="rounded-xl bg-background-100 border border-rose-200 px-3 py-2">
                        <div className="flex items-center gap-1.5 mb-1">
                          <i className="ri-hand-heart-line text-rose-500 text-xs"></i>
                          <span className="text-[11px] font-bold text-rose-700">회개의 기도</span>
                        </div>
                        <p className="text-sm text-rose-700 leading-relaxed whitespace-pre-wrap">{r.prayer}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}