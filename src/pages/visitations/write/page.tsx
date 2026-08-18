import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { ROLE_HIERARCHY } from '@/types/auth';
import type { UserRole } from '@/types/auth';

interface ConflictInfo {
  visitor_name: string;
  scheduled_at: string;
}

interface StudentOption {
  user_id: string;
  name: string;
}

export default function VisitationWrite() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [studentResults, setStudentResults] = useState<StudentOption[]>([]);
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [searchingStudents, setSearchingStudents] = useState(false);

  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [checkingConflict, setCheckingConflict] = useState(false);

  const role = profile?.role as UserRole;

  useEffect(() => {
    if (!profile) return;
    if (ROLE_HIERARCHY[role] < ROLE_HIERARCHY.assistant_zone_leader) {
      navigate('/visitations');
    }
  }, [profile, role, navigate]);

  const handleSearchStudents = async (query: string) => {
    setStudentSearch(query);
    if (query.length < 1) {
      setStudentResults([]);
      setShowStudentDropdown(false);
      return;
    }
    setSearchingStudents(true);
    setShowStudentDropdown(true);
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('user_id, name')
        .ilike('name', `%${query}%`)
        .eq('is_active', true)
        .limit(8);
      if (data && data.length > 0) {
        setStudentResults(data.map((d: { user_id: string; name: string }) => ({ user_id: d.user_id, name: d.name })));
      } else {
        setStudentResults([]);
      }
    } catch {
      setStudentResults([]);
    }
    setSearchingStudents(false);
  };

  const selectStudent = (s: StudentOption) => {
    setSelectedStudent(s);
    setStudentSearch(s.name);
    setShowStudentDropdown(false);
  };

  const checkConflict = useCallback(async () => {
    if (!selectedStudent || !scheduledDate || !scheduledTime) {
      setConflict(null);
      return;
    }

    setCheckingConflict(true);
    try {
      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();

      const { data } = await supabase
        .from('visitations')
        .select('visitor_name, scheduled_at')
        .eq('student_id', selectedStudent.user_id)
        .eq('status', 'scheduled');

      if (data && data.length > 0) {
        setConflict({
          visitor_name: data[0].visitor_name,
          scheduled_at: data[0].scheduled_at,
        });
      } else {
        setConflict(null);
      }
    } catch {
      setConflict(null);
    } finally {
      setCheckingConflict(false);
    }
  }, [selectedStudent, scheduledDate, scheduledTime]);

  useEffect(() => {
    if (selectedStudent && scheduledDate && scheduledTime) {
      const timer = setTimeout(checkConflict, 400);
      return () => clearTimeout(timer);
    }
    setConflict(null);
  }, [selectedStudent, scheduledDate, scheduledTime, checkConflict]);

  const handleSubmit = async () => {
    if (!profile || !selectedStudent || !scheduledDate || !scheduledTime) {
      setError('학생, 날짜, 시간을 모두 입력해주세요');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      const { error: insertError } = await supabase
        .from('visitations')
        .insert({
          visitor_id: userId,
          visitor_name: profile.name,
          student_id: selectedStudent.user_id,
          student_name: selectedStudent.name,
          scheduled_at: scheduledAt,
          topic: topic.trim() || null,
          notes: notes.trim() || null,
          status: 'scheduled',
        });

      if (insertError) throw insertError;

      navigate('/visitations');
    } catch (err: any) {
      setError(err?.message || '저장 중 오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="mb-8">
            <button
              onClick={() => navigate('/visitations')}
              className="flex items-center gap-1.5 text-sm text-foreground-600 hover:text-foreground-950 transition-colors mb-3 cursor-pointer"
            >
              <i className="ri-arrow-left-line"></i>
              심방 목록으로
            </button>
            <h1 className="text-2xl font-bold text-foreground-950 mb-1">심방 등록</h1>
            <p className="text-sm text-foreground-600">학생과의 1:1 심방 일정을 등록합니다</p>
          </div>

          {error && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="bg-accent-100 border border-accent-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-accent-700 flex items-center gap-2"><i className="ri-error-warning-line"></i>{error}</p>
            </motion.div>
          )}

          <div className="bg-background-100 border border-background-200 rounded-2xl p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground-950 mb-2">
                <i className="ri-user-line mr-1.5 text-foreground-600"></i>
                학생 선택
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="student_name"
                  value={studentSearch}
                  onChange={(e) => handleSearchStudents(e.target.value)}
                  onFocus={() => studentResults.length > 0 && setShowStudentDropdown(true)}
                  placeholder="학생 이름을 검색하세요 (등록된 학생 중 선택)"
                  maxLength={50}
                  autoComplete="off"
                  className="w-full px-4 py-2.5 rounded-xl border border-background-200 bg-background-50 text-sm text-foreground-950 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 transition-all"
                />
                {selectedStudent && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                      <i className="ri-check-line"></i> 선택됨
                    </span>
                  </div>
                )}
                {showStudentDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-background-100 border border-background-200 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                    {searchingStudents ? (
                      <div className="px-3 py-2.5 text-sm text-foreground-500">검색 중...</div>
                    ) : studentResults.length === 0 ? (
                      <div className="px-3 py-2.5 text-sm text-foreground-500">검색 결과가 없습니다</div>
                    ) : (
                      studentResults.map((s) => (
                        <button
                          key={s.user_id}
                          type="button"
                          onClick={() => selectStudent(s)}
                          className={`w-full text-left px-3 py-2.5 text-sm hover:bg-background-200 transition-colors cursor-pointer flex items-center gap-2 ${
                            selectedStudent?.user_id === s.user_id ? 'bg-primary-50 text-primary-700 font-medium' : 'text-foreground-700'
                          }`}
                        >
                          <i className="ri-user-line text-xs text-foreground-400"></i>
                          {s.name}
                          {selectedStudent?.user_id === s.user_id && (
                            <i className="ri-check-line text-primary-500 ml-auto"></i>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground-950 mb-2">
                  <i className="ri-calendar-line mr-1.5 text-foreground-600"></i>
                  날짜
                </label>
                <input
                  type="date"
                  name="scheduled_date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-background-200 bg-background-50 text-sm text-foreground-950 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 transition-all cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-950 mb-2">
                  <i className="ri-time-line mr-1.5 text-foreground-600"></i>
                  시간
                </label>
                <input
                  type="time"
                  name="scheduled_time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-background-200 bg-background-50 text-sm text-foreground-950 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 transition-all cursor-pointer"
                />
              </div>
            </div>

            {checkingConflict && (
              <div className="flex items-center gap-2 text-xs text-foreground-500">
                <i className="ri-loader-4-line animate-spin"></i>
                일정 충돌 확인 중...
              </div>
            )}

            {conflict && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-2">
                  <i className="ri-alert-line text-amber-600 mt-0.5"></i>
                  <div>
                    <p className="text-sm font-semibold text-amber-800 mb-1">
                      이 학생은 이미 예정된 심방이 있습니다
                    </p>
                    <p className="text-xs text-amber-700">
                      담당자: <strong>{conflict.visitor_name}</strong>
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      예정일: {new Date(conflict.scheduled_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-xs text-amber-600 mt-1">
                      중복 등록 시 담당자와 조율이 필요할 수 있습니다
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground-950 mb-2">
                <i className="ri-chat-3-line mr-1.5 text-foreground-600"></i>
                심방 주제
                <span className="text-foreground-500 font-normal ml-1">(선택)</span>
              </label>
              <input
                type="text"
                name="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="예: 신앙 성장, 진로 고민, 관계 상담"
                maxLength={200}
                className="w-full px-4 py-2.5 rounded-xl border border-background-200 bg-background-50 text-sm text-foreground-950 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground-950 mb-2">
                <i className="ri-file-text-line mr-1.5 text-foreground-600"></i>
                사전 메모
                <span className="text-foreground-500 font-normal ml-1">(선택, {notes.length}/500)</span>
              </label>
              <textarea
                name="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="심방 전 참고할 사항이나 준비할 내용을 메모하세요..."
                rows={3}
                maxLength={500}
                className="w-full px-4 py-3 rounded-xl border border-background-200 bg-background-50 text-sm text-foreground-950 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 transition-all resize-none"
              ></textarea>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => navigate('/visitations')}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-full border border-background-200 text-sm font-medium text-foreground-700 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-close-line"></i>
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !selectedStudent || !scheduledDate || !scheduledTime}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-primary-500 text-background-50 text-sm font-medium hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="ri-send-plane-line"></i>
                {saving ? '등록 중...' : '등록하기'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}