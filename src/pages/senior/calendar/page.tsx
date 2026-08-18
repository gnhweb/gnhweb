import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

interface SeniorEvent {
  id: string;
  title: string;
  description: string;
  event_date: string;
  event_time: string;
  location: string;
  target_group: string;
  created_by: string;
  created_at: string;
}

export default function SeniorCalendar() {
  const { user, profile, hasRole } = useAuth();
  const isTeacherOrChief = hasRole('teacher') || hasRole('chief');

  const [events, setEvents] = useState<SeniorEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<SeniorEvent | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // CRUD form
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<SeniorEvent | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [saving, setSaving] = useState(false);

  const loadEvents = async () => {
    try {
      const { data } = await supabase
        .from('schedules')
        .select('*')
        .eq('target_group', 'senior')
        .order('event_date', { ascending: true });
      setEvents((data || []) as SeniorEvent[]);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const months = useMemo(() => {
    const grouped: Record<string, SeniorEvent[]> = {};
    events.forEach(e => {
      const m = e.event_date.substring(0, 7);
      if (!grouped[m]) grouped[m] = [];
      grouped[m].push(e);
    });
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  const resetForm = () => {
    setFormTitle('');
    setFormDesc('');
    setFormDate('');
    setFormTime('');
    setFormLocation('');
    setEditingEvent(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (ev: SeniorEvent) => {
    setEditingEvent(ev);
    setFormTitle(ev.title);
    setFormDesc(ev.description || '');
    setFormDate(ev.event_date);
    setFormTime(ev.event_time || '');
    setFormLocation(ev.location || '');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formDate) return;
    setSaving(true);
    try {
      if (editingEvent) {
        await supabase.from('schedules').update({
          title: formTitle.trim(),
          description: formDesc.trim(),
          event_date: formDate,
          event_time: formTime,
          location: formLocation.trim(),
          target_group: 'senior',
        }).eq('id', editingEvent.id);
      } else {
        await supabase.from('schedules').insert({
          title: formTitle.trim(),
          description: formDesc.trim(),
          event_date: formDate,
          event_time: formTime,
          location: formLocation.trim(),
          target_group: 'senior',
          created_by: user?.id,
          author_id: user?.id,
          author_name: profile?.name || '교사',
        });
      }
      setShowForm(false);
      resetForm();
      loadEvents();
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!selectedEvent) return;
    setDeleting(true);
    await supabase.from('schedules').delete().eq('id', selectedEvent.id);
    setEvents(prev => prev.filter(e => e.id !== selectedEvent.id));
    setSelectedEvent(null);
    setShowDelete(false);
    setDeleting(false);
  };

  const monthLabel = (key: string) => {
    const [y, m] = key.split('-');
    return `${y}년 ${parseInt(m)}월`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-6">
            <Link to="/senior" className="inline-flex items-center gap-1 text-sm text-foreground-500 hover:text-foreground-700 cursor-pointer mb-4">
              <i className="ri-arrow-left-line"></i> 고3구역
            </Link>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-gradient-to-br from-emerald-100 to-teal-100 border border-emerald-200 mb-5">
              <i className="ri-calendar-event-line text-3xl text-emerald-600"></i>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">고3 전용 캘린더</h1>
            <p className="text-sm text-foreground-600">수련회·기도모임 등 고3만의 특별한 일정</p>
          </div>

          {isTeacherOrChief && (
            <div className="flex items-center gap-2 mb-6">
              <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors cursor-pointer whitespace-nowrap">
                <i className="ri-add-line"></i> 일정 추가
              </button>
            </div>
          )}

          {months.length === 0 ? (
            <div className="text-center py-16 bg-background-100 border border-background-200 rounded-2xl">
              <div className="w-14 h-14 rounded-xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <i className="ri-calendar-event-line text-2xl text-emerald-500"></i>
              </div>
              <p className="text-sm text-foreground-600">아직 등록된 고3 전용 일정이 없어요</p>
            </div>
          ) : (
            <>
              {/* ===== PC (md 이상) — 기존 리스트 그대로 ===== */}
              <div className="hidden md:block space-y-6">
                {months.map(([month, monthEvents], mIdx) => (
                  <motion.div key={month} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: mIdx * 0.08 }}>
                    <h2 className="text-base font-bold text-foreground-950 mb-2 px-1">{monthLabel(month)}</h2>
                    <div className="space-y-2">
                      {monthEvents.map(ev => (
                        <div key={ev.id} onClick={() => setSelectedEvent(ev)} className="bg-background-100 border border-background-200 rounded-2xl p-4 hover:border-emerald-300 transition-all duration-200 cursor-pointer group flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex flex-col items-center justify-center flex-shrink-0">
                            <span className="text-lg font-bold text-emerald-600">{new Date(ev.event_date).getDate()}</span>
                            <span className="text-[10px] text-emerald-500">{new Date(ev.event_date).getMonth() + 1}월</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-foreground-950">{ev.title}</h3>
                            <p className="text-xs text-foreground-600 flex items-center gap-3 mt-0.5">
                              {ev.event_time && <span className="flex items-center gap-1"><i className="ri-time-line text-[10px]"></i>{ev.event_time}</span>}
                              {ev.location && <span className="flex items-center gap-1"><i className="ri-map-pin-line text-[10px]"></i>{ev.location}</span>}
                            </p>
                          </div>
                          <i className="ri-arrow-right-s-line text-foreground-400 group-hover:text-emerald-500 transition-colors hidden sm:block"></i>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* ===== 모바일 (md 미만) — 그라디언트 날짜 배지 타임라인 카드 ===== */}
              <div className="md:hidden space-y-5">
                {months.map(([month, monthEvents], mIdx) => (
                  <motion.div key={month} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(mIdx, 10) * 0.08 }}>
                    <h2 className="text-sm font-bold text-foreground-500 mb-2 px-1">{monthLabel(month)}</h2>
                    <div className="space-y-2.5">
                      {monthEvents.map(ev => (
                        <motion.div
                          key={ev.id}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setSelectedEvent(ev)}
                          className="flex items-center gap-3 bg-background-100 rounded-[20px] p-3.5 shadow-card cursor-pointer"
                        >
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-400 flex flex-col items-center justify-center flex-shrink-0">
                            <span className="text-base font-black text-white leading-none">{new Date(ev.event_date).getDate()}</span>
                            <span className="text-[9px] text-white/80 leading-none mt-0.5">{new Date(ev.event_date).getMonth() + 1}월</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-foreground-950 truncate">{ev.title}</h3>
                            <p className="text-[11px] text-foreground-500 flex items-center gap-2 mt-0.5">
                              {ev.event_time && <span className="flex items-center gap-1"><i className="ri-time-line"></i>{ev.event_time}</span>}
                              {ev.location && <span className="flex items-center gap-1 truncate"><i className="ri-map-pin-line"></i>{ev.location}</span>}
                            </p>
                          </div>
                          <i className="ri-arrow-right-s-line text-foreground-300 flex-shrink-0"></i>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Event detail modal */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedEvent(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-background-100 border border-background-200 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold text-emerald-600">{new Date(selectedEvent.event_date).getDate()}</span>
                    <span className="text-[10px] text-emerald-500">{new Date(selectedEvent.event_date).getMonth() + 1}월</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground-950">{selectedEvent.title}</h3>
                    <p className="text-xs text-foreground-600">{selectedEvent.event_date}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedEvent(null)} className="w-8 h-8 rounded-full bg-background-100 flex items-center justify-center cursor-pointer">
                  <i className="ri-close-line"></i>
                </button>
              </div>
              <div className="space-y-2 mb-4 text-sm text-foreground-700">
                {selectedEvent.event_time && <p className="flex items-center gap-2"><i className="ri-time-line text-foreground-500"></i>{selectedEvent.event_time}</p>}
                {selectedEvent.location && <p className="flex items-center gap-2"><i className="ri-map-pin-line text-foreground-500"></i>{selectedEvent.location}</p>}
              </div>
              {selectedEvent.description && (
                <div className="bg-background-50 rounded-xl p-4 mb-4">
                  <p className="text-sm text-foreground-700">{selectedEvent.description}</p>
                </div>
              )}
              {isTeacherOrChief && (
                <div className="flex items-center gap-2 pt-2 border-t border-background-200">
                  <button onClick={() => { setSelectedEvent(null); openEdit(selectedEvent); }} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 cursor-pointer whitespace-nowrap">
                    <i className="ri-edit-line"></i> 수정
                  </button>
                  <button onClick={() => setShowDelete(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-rose-300 text-rose-600 text-sm font-medium hover:bg-rose-50 cursor-pointer whitespace-nowrap">
                    <i className="ri-delete-bin-line"></i> 삭제
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {showDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => !deleting && setShowDelete(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-background-100 border border-background-200 rounded-2xl p-6 max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-12 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-4">
                <i className="ri-alert-line text-xl text-accent-600"></i>
              </div>
              <h3 className="text-lg font-bold text-foreground-950 mb-2">일정 삭제</h3>
              <p className="text-sm text-foreground-600 mb-6">정말 삭제할까요?</p>
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => setShowDelete(false)} disabled={deleting} className="px-4 py-2 rounded-full border border-background-200 text-sm font-medium cursor-pointer whitespace-nowrap">취소</button>
                <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 rounded-full bg-rose-500 text-white text-sm font-medium hover:bg-rose-600 cursor-pointer whitespace-nowrap">{deleting ? '삭제 중...' : '삭제'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CRUD Form modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-background-100 border border-background-200 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-foreground-950 mb-4">{editingEvent ? '일정 수정' : '새 일정 추가'}</h3>
              <div className="space-y-3">
                <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="일정 제목" maxLength={100} className="w-full px-4 py-2.5 text-sm rounded-xl border border-background-200 outline-none focus:border-emerald-400" />
                <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className="w-full px-4 py-2.5 text-sm rounded-xl border border-background-200 outline-none focus:border-emerald-400" />
                <input type="time" value={formTime} onChange={e => setFormTime(e.target.value)} className="w-full px-4 py-2.5 text-sm rounded-xl border border-background-200 outline-none focus:border-emerald-400" />
                <input type="text" value={formLocation} onChange={e => setFormLocation(e.target.value)} placeholder="장소" maxLength={100} className="w-full px-4 py-2.5 text-sm rounded-xl border border-background-200 outline-none focus:border-emerald-400" />
                <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="설명" rows={3} maxLength={500} className="w-full px-4 py-2.5 text-sm rounded-xl border border-background-200 outline-none focus:border-emerald-400 resize-none" />
              </div>
              <div className="flex items-center gap-2 mt-4">
                <button onClick={handleSave} disabled={!formTitle.trim() || !formDate || saving} className="px-5 py-2.5 rounded-full bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 disabled:opacity-40 cursor-pointer whitespace-nowrap">
                  {saving ? '저장 중...' : editingEvent ? '수정하기' : '추가하기'}
                </button>
                <button onClick={() => { setShowForm(false); resetForm(); }} className="text-sm text-foreground-500 cursor-pointer">취소</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}