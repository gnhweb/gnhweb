import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { clubs } from '@/mocks/clubs';
import { CategoryChip, CategoryChipRow } from '@/components/base/CategoryChip';
import { todayKey } from '@/lib/date';

interface CalDay {
  date: number;
  dateStr: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  hasEvent: boolean;
}

function getCalDays(year: number, month: number, eventDates: Set<string>): CalDay[] {
  const days: CalDay[] = [];
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = todayKey();

  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({ date: d, dateStr, isCurrentMonth: false, isToday: false, hasEvent: eventDates.has(dateStr) });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({ date: d, dateStr, isCurrentMonth: true, isToday: dateStr === todayStr, hasEvent: eventDates.has(dateStr) });
  }
  const remainder = (7 - (days.length % 7)) % 7;
  for (let d = 1; d <= remainder; d++) {
    const m = month === 11 ? 0 : month + 1;
    const y = month === 11 ? year + 1 : year;
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({ date: d, dateStr, isCurrentMonth: false, isToday: false, hasEvent: eventDates.has(dateStr) });
  }
  return days;
}

interface ScheduleItem {
  id: string;
  author_id: string;
  author_name: string;
  title: string;
  event_date: string;
  event_time: string;
  location: string;
  description: string;
  target_club: string | null;
  created_at: string;
  updated_at: string;
}

export default function Schedule() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClub, setSelectedClub] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleItem | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const fetchSchedules = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('schedules')
        .select('*')
        .order('event_date', { ascending: true });

      if (fetchError) throw fetchError;
      setSchedules(data || []);
    } catch {
      setError('일정을 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const filtered = useMemo(() => {
    if (!selectedClub) return schedules;
    return schedules.filter(s => s.target_club === selectedClub);
  }, [selectedClub, schedules]);

  const months = useMemo(() => {
    const grouped: Record<string, ScheduleItem[]> = {};
    filtered.forEach(s => {
      const month = s.event_date.substring(0, 7);
      if (!grouped[month]) grouped[month] = [];
      grouped[month].push(s);
    });
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const eventDateSet = useMemo(() => new Set(filtered.map(s => s.event_date)), [filtered]);
  const calDays = useMemo(() => getCalDays(calYear, calMonth, eventDateSet), [calYear, calMonth, eventDateSet]);
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    return filtered.filter(s => s.event_date === selectedDate);
  }, [selectedDate, filtered]);

  const goPrevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else { setCalMonth(m => m - 1); }
  };
  const goNextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else { setCalMonth(m => m + 1); }
  };

  const canModifyEvent = (event: ScheduleItem) => {
    return profile && (
      profile.user_id === event.author_id ||
      profile.role === 'teacher' ||
      profile.role === 'chief'
    );
  };

  const handleDelete = async () => {
    if (!selectedEvent) return;
    setDeleting(true);
    try {
      const { error: deleteError } = await supabase
        .from('schedules')
        .delete()
        .eq('id', selectedEvent.id);

      if (deleteError) {
        setError('삭제 중 오류가 발생했습니다');
        setShowDeleteConfirm(false);
        return;
      }

      setSchedules(prev => prev.filter(s => s.id !== selectedEvent.id));
      setSelectedEvent(null);
      setShowDeleteConfirm(false);
    } catch {
      setError('삭제 중 오류가 발생했습니다');
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  const monthLabel = (key: string) => {
    const [y, m] = key.split('-');
    return `${y}년 ${parseInt(m)}월`;
  };

  const dateLabel = (d: string) => {
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const date = new Date(d);
    return `${date.getMonth() + 1}.${date.getDate()} (${weekdays[date.getDay()]})`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-10 md:py-16">
          <div className="flex items-center justify-center py-20">
            <i className="ri-loader-4-line animate-spin text-2xl text-primary-500"></i>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-10">
            <div className="text-center sm:text-left">
              <div className="inline-flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-[20px] bg-background-100 border border-background-200 mb-4 md:mb-5">
                <i className="ri-calendar-event-line text-2xl md:text-3xl text-primary-600"></i>
              </div>
              <h1 className="text-xl md:text-3xl font-bold text-foreground-950 mb-2 md:mb-3">행사 일정</h1>
              <p className="text-foreground-600 text-sm">다가오는 학생회 행사와 동아리 일정을 확인하세요</p>
            </div>
            {profile && profile.role !== 'member' && (
              <Link
                to="/schedule/write"
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-primary-500 text-background-50 text-sm font-medium hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap self-start"
              >
                <i className="ri-add-line"></i>
                일정 추가
              </Link>
            )}
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-accent-100 border border-accent-200 rounded-[20px] p-4 mb-6"
            >
              <p className="text-sm text-accent-700 flex items-center gap-2">
                <i className="ri-error-warning-line"></i>
                {error}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 text-xs text-accent-600 underline cursor-pointer"
              >
                다시 시도
              </button>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="hidden md:flex items-center gap-2 mb-8 overflow-x-auto pb-2 flex-wrap"
          >
            <button
              onClick={() => setSelectedClub(null)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 cursor-pointer ${!selectedClub ? 'bg-primary-500 text-background-50' : 'bg-background-100 text-foreground-600 border border-background-200 hover:border-primary-300'}`}
            >
              전체 일정
            </button>
            {clubs.map(club => (
              <button
                key={club.id}
                onClick={() => setSelectedClub(selectedClub === club.id ? null : club.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 cursor-pointer ${selectedClub === club.id ? 'bg-primary-500 text-background-50' : 'bg-background-100 text-foreground-600 border border-background-200 hover:border-primary-300'}`}
              >
                {club.name}
              </button>
            ))}
          </motion.div>

          {/* 모바일: 동아리 필터 칩 */}
          <div className="md:hidden mb-4">
            <CategoryChipRow>
              <CategoryChip active={!selectedClub} onClick={() => setSelectedClub(null)}>전체 일정</CategoryChip>
              {clubs.map(club => (
                <CategoryChip key={club.id} active={selectedClub === club.id} onClick={() => setSelectedClub(selectedClub === club.id ? null : club.id)}>
                  {club.name}
                </CategoryChip>
              ))}
            </CategoryChipRow>
          </div>

          {/* 모바일: 미니 캘린더 — 홈 화면과 톤 통일 */}
          <div className="md:hidden bg-background-100 border border-background-200 rounded-[20px] p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <button onClick={goPrevMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-background-200 cursor-pointer">
                <i className="ri-arrow-left-s-line text-foreground-600"></i>
              </button>
              <span className="text-sm font-bold text-foreground-900">{calYear}년 {calMonth + 1}월</span>
              <button onClick={goNextMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-background-200 cursor-pointer">
                <i className="ri-arrow-right-s-line text-foreground-600"></i>
              </button>
            </div>
            <div className="grid grid-cols-7 gap-y-1 text-center">
              {['일', '월', '화', '수', '목', '금', '토'].map(w => (
                <span key={w} className="text-[10px] font-semibold text-foreground-400">{w}</span>
              ))}
              {calDays.map((d, i) => (
                <button
                  key={`${d.dateStr}-${i}`}
                  onClick={() => d.isCurrentMonth && setSelectedDate(selectedDate === d.dateStr ? null : d.dateStr)}
                  disabled={!d.isCurrentMonth}
                  className="relative flex flex-col items-center justify-center py-1 cursor-pointer disabled:cursor-default"
                >
                  <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-medium transition-all ${
                    selectedDate === d.dateStr
                      ? 'bg-gradient-to-br from-primary-500 to-accent-500 text-white font-bold'
                      : d.isToday
                        ? 'bg-primary-100 text-primary-700 font-bold'
                        : d.isCurrentMonth ? 'text-foreground-800' : 'text-foreground-300'
                  }`}>
                    {d.date}
                  </span>
                  {d.hasEvent && d.isCurrentMonth && selectedDate !== d.dateStr && (
                    <span className="absolute bottom-0 w-1 h-1 rounded-full bg-accent-500"></span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 모바일: 선택한 날짜의 일정 카드 */}
          {selectedDate && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="md:hidden mb-6">
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-sm font-bold text-foreground-900">{dateLabel(selectedDate)} 일정</p>
                <button onClick={() => setSelectedDate(null)} className="text-xs text-foreground-500 cursor-pointer">전체 보기</button>
              </div>
              {selectedDateEvents.length === 0 ? (
                <div className="text-center py-8 bg-background-100 border border-background-200 rounded-[20px]">
                  <p className="text-xs text-foreground-500">이 날엔 일정이 없어요</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedDateEvents.map(event => (
                    <motion.div key={event.id} whileTap={{ scale: 0.97 }} onClick={() => setSelectedEvent(event)} className="bg-background-100 border border-background-200 rounded-[20px] p-4 flex items-center gap-3 cursor-pointer">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center flex-shrink-0">
                        <i className="ri-calendar-event-line text-white text-sm"></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground-950 truncate">{event.title}</p>
                        <p className="text-xs text-foreground-500">{event.event_time} · {event.location}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {months.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-[20px] bg-background-100 border border-background-200 flex items-center justify-center mx-auto mb-4">
                <i className="ri-calendar-event-line text-2xl text-foreground-500"></i>
              </div>
              <p className="text-foreground-600 text-sm mb-4">아직 등록된 일정이 없어요</p>
              {profile && profile.role !== 'member' ? (
                <Link
                  to="/schedule/write"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary-500 text-background-50 text-sm font-medium hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-add-line"></i>
                  첫 일정 등록하기
                </Link>
              ) : (
                <p className="text-xs text-foreground-600">작성 권한이 없습니다</p>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {months.map(([month, events], mIdx) => (
                <motion.div
                  key={month}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: mIdx * 0.1 }}
                >
                  <h2 className="text-lg font-bold text-foreground-950 mb-3 px-1">{monthLabel(month)}</h2>
                  <div className="space-y-2">
                    {events.map((event) => (
                      <div
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className="bg-background-100 border border-background-200 rounded-[20px] p-4 md:p-5 hover:border-background-300/60 transition-all duration-300 cursor-pointer group flex items-center gap-4"
                      >
                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-primary-100 flex flex-col items-center justify-center flex-shrink-0">
                          <span className="text-lg md:text-xl font-bold text-primary-600">{new Date(event.event_date).getDate()}</span>
                          <span className="text-[10px] text-primary-500">{new Date(event.event_date).getMonth() + 1}월</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="text-sm md:text-base font-semibold text-foreground-950 group-hover:text-primary-600 transition-colors">{event.title}</h3>
                            {event.target_club && (
                              <span className="text-[10px] bg-background-200 text-foreground-600 px-1.5 py-0.5 rounded whitespace-nowrap">
                                {clubs.find(c => c.id === event.target_club)?.name || event.target_club}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-foreground-600 flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <i className="ri-time-line text-[10px]"></i>
                              {event.event_time}
                            </span>
                            <span className="flex items-center gap-1">
                              <i className="ri-map-pin-line text-[10px]"></i>
                              {event.location}
                            </span>
                          </p>
                        </div>
                        <i className="ri-arrow-right-s-line text-foreground-500 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all hidden sm:block"></i>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedEvent(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-background-100 border border-background-200 rounded-[20px] p-6 md:p-8 max-w-md w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary-100 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold text-primary-600">{new Date(selectedEvent.event_date).getDate()}</span>
                    <span className="text-[10px] text-primary-500">{new Date(selectedEvent.event_date).getMonth() + 1}월</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground-950">{selectedEvent.title}</h3>
                    <p className="text-xs text-foreground-600">{dateLabel(selectedEvent.event_date)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  <i className="ri-close-line text-gray-500"></i>
                </button>
              </div>
              <div className="space-y-3 mb-5">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <i className="ri-time-line text-foreground-600"></i>
                  <span>{selectedEvent.event_time}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <i className="ri-map-pin-line text-foreground-600"></i>
                  <span>{selectedEvent.location}</span>
                </div>
                {selectedEvent.target_club && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <i className="ri-group-line text-foreground-600"></i>
                    <span>{clubs.find(c => c.id === selectedEvent.target_club)?.name} 대상</span>
                  </div>
                )}
              </div>
              {selectedEvent.description && (
                <div className="bg-background-100 border border-background-200 rounded-xl p-4 mb-5">
                  <p className="text-sm text-foreground-700 leading-relaxed">{selectedEvent.description}</p>
                </div>
              )}

              {canModifyEvent(selectedEvent) && (
                <div className="flex items-center gap-2 pt-2 border-t border-background-200">
                  <Link
                    to={`/schedule/${selectedEvent.id}/edit`}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary-500 text-background-50 text-sm font-medium hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-edit-line"></i>
                    수정
                  </Link>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-accent-300 text-sm font-medium text-accent-600 hover:bg-accent-100 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-delete-bin-line"></i>
                    삭제
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteConfirm && selectedEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={() => !deleting && setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-background-100 border border-background-200 rounded-[20px] p-6 max-w-sm w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-4">
                  <i className="ri-alert-line text-xl text-accent-600"></i>
                </div>
                <h3 className="text-lg font-bold text-foreground-950 mb-2">일정 삭제</h3>
                <p className="text-sm text-foreground-600 mb-6">
                  정말 이 일정을 삭제할까요?<br />이 작업은 되돌릴 수 없어요.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleting}
                    className="px-4 py-2 rounded-full border border-background-200 text-sm font-medium text-foreground-700 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-4 py-2 rounded-full bg-accent-500 text-background-50 text-sm font-medium hover:bg-accent-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? '삭제 중...' : '삭제하기'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}