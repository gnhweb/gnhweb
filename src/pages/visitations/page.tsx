import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { ROLE_HIERARCHY } from '@/types/auth';
import type { UserRole } from '@/types/auth';


interface Visitation {
  id: string;
  visitor_id: string;
  visitor_name: string;
  student_id: string;
  student_name: string;
  scheduled_at: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  topic: string | null;
  notes: string | null;
  follow_up_needed: boolean;
  growth_record_summary: string | null;
  created_at: string;
  updated_at: string;
}

type TabType = 'scheduled' | 'completed';
type ViewType = 'list' | 'calendar';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function VisitationsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [visitations, setVisitations] = useState<Visitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('scheduled');
  const [viewType, setViewType] = useState<ViewType>('list');

  const role = profile?.role as UserRole;
  const isTeacherOrAbove = ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.teacher;
  const canWrite = role && ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.assistant_zone_leader;

  const fetchVisitations = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('visitations')
        .select('*')
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      if (data && data.length > 0) {
        setVisitations(data as Visitation[]);
      }
    } catch {
      setError('심방 데이터를 불러오는 중 문제가 발생했어요. 다시 시도해주세요');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVisitations();
  }, [fetchVisitations]);

  const [cancelError, setCancelError] = useState<string | null>(null);

  const handleCancel = async (v: Visitation) => {
    try {
      await supabase
        .from('visitations')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', v.id);
      setVisitations(prev => prev.map(item => item.id === v.id ? { ...item, status: 'cancelled' as const } : item));
    } catch {
      setCancelError('취소 처리에 실패했어요. 다시 시도해주세요');
      setTimeout(() => setCancelError(null), 3000);
    }
  };

  const filtered = visitations.filter(v => activeTab === 'scheduled' ? v.status === 'scheduled' : v.status === 'completed');

  const formatDate = (d: string) => {
    const date = new Date(d);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = WEEKDAYS[date.getDay()];
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours < 12 ? '오전' : '오후';
    const displayHour = hours % 12 || 12;
    return `${month}월 ${day}일 (${weekday}) ${ampm} ${displayHour}:${minutes}`;
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-primary-100 text-primary-700';
      case 'completed': return 'bg-emerald-100 text-emerald-700';
      case 'cancelled': return 'bg-rose-100 text-rose-700';
      default: return 'bg-background-200 text-foreground-600';
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'scheduled': return '예정';
      case 'completed': return '완료';
      case 'cancelled': return '취소';
      default: return status;
    }
  };

  const calendarDays = (() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    const days: { date: number; visitations: Visitation[] }[] = [];
    for (let d = 1; d <= lastDate; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayVisits = visitations.filter(v => v.scheduled_at.startsWith(dateStr));
      days.push({ date: d, visitations: dayVisits });
    }

    const blanks = Array(firstDay).fill(null);
    return { blanks, days, year, month };
  })();

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <i className="ri-loader-4-line animate-spin text-2xl text-primary-500"></i>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-primary-100 flex items-center justify-center">
                  <i className="ri-heart-pulse-line text-xl md:text-2xl text-primary-600"></i>
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-foreground-950">심방 스케줄</h1>
                  <p className="text-xs md:text-sm text-foreground-600 mt-0.5">
                    {isTeacherOrAbove ? '전체 심방 일정을 조회하고 관리합니다' : '내가 담당하는 학생의 심방 일정을 관리합니다'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canWrite && (
                <Link
                  to="/visitations/write"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-primary-500 text-background-50 text-sm font-medium hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-add-line"></i>
                  심방 등록
                </Link>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 bg-accent-100 border border-accent-200 rounded-xl flex items-center justify-between text-sm text-accent-700">
              <span className="flex items-center gap-2"><i className="ri-error-warning-line"></i>{error}</span>
              <button onClick={fetchVisitations} className="text-xs text-accent-600 underline cursor-pointer">다시 시도</button>
            </div>
          )}
          {cancelError && (
            <div className="mb-5 px-4 py-3 bg-accent-100 border border-accent-200 rounded-xl text-sm text-accent-700 flex items-center gap-2">
              <i className="ri-error-warning-line"></i>{cancelError}
            </div>
          )}
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div className="flex items-center gap-1 bg-background-100 rounded-full p-1">
              <button
                onClick={() => setActiveTab('scheduled')}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${activeTab === 'scheduled' ? 'bg-background-100 text-foreground-950 shadow-sm' : 'text-foreground-600 hover:text-foreground-950'}`}
              >
                예정
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${activeTab === 'completed' ? 'bg-background-100 text-foreground-950 shadow-sm' : 'text-foreground-600 hover:text-foreground-950'}`}
              >
                완료
              </button>
            </div>
            <div className="flex items-center gap-1 bg-background-100 rounded-full p-1">
              <button
                onClick={() => setViewType('list')}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${viewType === 'list' ? 'bg-background-100 text-foreground-950 shadow-sm' : 'text-foreground-600'}`}
              >
                <i className="ri-list-check text-sm"></i>
              </button>
              <button
                onClick={() => setViewType('calendar')}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${viewType === 'calendar' ? 'bg-background-100 text-foreground-950 shadow-sm' : 'text-foreground-600'}`}
              >
                <i className="ri-calendar-line text-sm"></i>
              </button>
            </div>
          </div>

          {viewType === 'list' ? (
            <div className="space-y-3">
              {filtered.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-2xl bg-background-100 border border-background-200 flex items-center justify-center mx-auto mb-4">
                    <i className="ri-heart-pulse-line text-2xl text-foreground-400"></i>
                  </div>
                  <p className="text-sm text-foreground-600 mb-1">
                    {activeTab === 'scheduled' ? '예정된 심방이 없습니다' : '완료된 심방 기록이 없습니다'}
                  </p>
                  {canWrite && activeTab === 'scheduled' && (
                    <Link
                      to="/visitations/write"
                      className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium cursor-pointer mt-2"
                    >
                      <i className="ri-add-line"></i>새 심방 등록하기
                    </Link>
                  )}
                </div>
              ) : (
                filtered.map((v, idx) => (
                  <motion.div
                    key={v.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: idx * 0.04 }}
                    className="bg-background-100 border border-background-200 rounded-2xl p-4 md:p-5 hover:border-background-300/60 transition-all cursor-pointer"
                    onClick={() => navigate(`/visitations/${v.id}`)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                          <i className="ri-user-heart-line text-primary-500"></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="text-sm font-semibold text-foreground-950">{v.student_name} 학생</h3>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${statusBadge(v.status)}`}>
                              {statusLabel(v.status)}
                            </span>
                            {v.follow_up_needed && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium flex-shrink-0">
                                후속 필요
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-foreground-600 mb-1">
                            <i className="ri-calendar-line mr-1"></i>{formatDate(v.scheduled_at)}
                          </p>
                          {v.topic && (
                            <p className="text-xs text-foreground-700 mt-1 line-clamp-1">
                              <i className="ri-chat-3-line mr-1 text-foreground-500"></i>{v.topic}
                            </p>
                          )}
                          <p className="text-xs text-foreground-500 mt-0.5">
                            <i className="ri-user-line mr-1"></i>담당: {v.visitor_name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <i className="ri-arrow-right-s-line text-foreground-400"></i>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          ) : (
            <div className="bg-background-100 border border-background-200 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-background-200">
                <h3 className="text-base font-bold text-foreground-950 text-center">
                  {calendarDays.year}년 {calendarDays.month + 1}월
                </h3>
              </div>
              <div className="grid grid-cols-7 text-center border-b border-background-200">
                {WEEKDAYS.map(day => (
                  <div key={day} className="py-2 text-xs font-semibold text-foreground-600">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {calendarDays.blanks.map((_, i) => (
                  <div key={`blank-${i}`} className="aspect-square p-1 border border-background-100"></div>
                ))}
                {calendarDays.days.map(({ date, visitations: dayVisits }) => {
                  const today = new Date();
                  const isToday = date === today.getDate() && calendarDays.month === today.getMonth() && calendarDays.year === today.getFullYear();
                  const hasScheduled = dayVisits.some(v => v.status === 'scheduled');
                  const hasCompleted = dayVisits.some(v => v.status === 'completed');

                  return (
                    <div
                      key={date}
                      className={`aspect-square p-1 border border-background-100 ${isToday ? 'bg-primary-50' : ''}`}
                    >
                      <span className={`text-xs font-medium ${isToday ? 'text-primary-700 font-bold' : 'text-foreground-600'}`}>
                        {date}
                      </span>
                      <div className="flex flex-col gap-0.5 mt-0.5">
                        {hasScheduled && (
                          <span className="w-full h-1.5 rounded-full bg-primary-400"></span>
                        )}
                        {hasCompleted && (
                          <span className="w-full h-1.5 rounded-full bg-emerald-400"></span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}