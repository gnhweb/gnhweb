import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { CLUB_LABELS } from '@/types/auth';
import type { ClubType } from '@/types/auth';
import { CLUB_META } from '@/mocks/attendance';
import type { ClubAttendanceSummary, ClubMemberStatus, AttendanceRecord } from '@/mocks/attendance';
import { todayKey, formatKoreanDate } from '@/lib/date';
import { Link } from 'react-router-dom';

interface AttendanceLocationData {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
}

const CLUB_IDS: ClubType[] = ['saeullim', 'cheonjipoong', 'cheonjihu', 'munhwabu'];

function KpiCard({ title, value, icon, colorClass, delay }: {
  title: string;
  value: string;
  icon: string;
  colorClass: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="bg-background-100 border border-background-200 rounded-[20px] p-5"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colorClass}`}>
        <i className={`${icon} text-xl`}></i>
      </div>
      <p className="text-2xl font-bold text-foreground-950 mb-0.5">{value}</p>
      <p className="text-xs text-foreground-600">{title}</p>
    </motion.div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <i className="ri-loader-4-line animate-spin text-3xl text-primary-500 block mb-3"></i>
        <p className="text-sm text-foreground-500">{label}</p>
      </div>
    </div>
  );
}

interface SmartAttendanceProps {
  clubId?: string;
}

export default function SmartAttendance({ clubId }: SmartAttendanceProps) {
  const { profile } = useAuth();
  if (!profile) return <Spinner label="프로필을 불러오는 중..." />;


  if (clubId && profile.club !== clubId) {
    return null;
  }

  return <StudentAttendanceView profile={profile} />;
}

function getDistanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

type AttendanceState = 'idle' | 'loading-attend' | 'loading-absent' | 'loading-cancel' | 'success-attend' | 'success-absent' | 'already-attend' | 'already-absent' | 'checking-location' | 'location-denied' | 'location-out-of-range';

// Attendance notifications are intentionally handled by the Supabase DB trigger
// `attendance_notify_teacher` after the attendance row is inserted.
// This keeps the recipient policy identical across web/PWA devices and avoids
// client-side duplicate notifications. The trigger targets only:
// 1) assigned teacher, 2) same-club assistant_zone_leader, 3) same-club zone_leader.

function StudentAttendanceView({ profile }: { profile: { name: string; club?: string; user_id: string; role?: string } }) {
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceState>('idle');
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [showAiPopup, setShowAiPopup] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [absenceReason, setAbsenceReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);

  // DB 위치 정보 (다중 활성 위치 지원)
  const [activeLocations, setActiveLocations] = useState<AttendanceLocationData[]>([]);
  const [locationLoaded, setLocationLoaded] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const today = new Date();
  const dateStr = formatKoreanDate(today, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const clubMeta = profile.club && CLUB_META[profile.club as ClubType] ? CLUB_META[profile.club as ClubType] : null;

  // ── DB에서 활성 위치 가져오기 ──
  const fetchLocation = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('attendance_locations')
        .select('*')
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setActiveLocations((data as AttendanceLocationData[]) || []);
    } catch (err) {
      console.error('출석 위치 로딩 실패:', err);
      setActiveLocations([]);
    } finally {
      setLocationLoaded(true);
    }
  }, []);

  // ── Realtime 구독 ──
  useEffect(() => {
    fetchLocation();

    const channel = supabase
      .channel('attendance-locations-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_locations' },
        () => {
          fetchLocation();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLocation]);

  // ── 오늘 출석 상태 확인 ──
  useEffect(() => {
    checkTodayStatus();
  }, []);

  const checkTodayStatus = async () => {
    try {
      const todayStr = todayKey();
      const { data, error } = await supabase
        .from('attendance')
        .select('id,status,absence_reason')
        .eq('user_id', profile.user_id)
        .eq('attendance_date', todayStr)
        .maybeSingle();

      if (!error && data) {
        setRecordId(data.id);
        if (data.status === 'attended') {
          setAttendanceStatus('already-attend');
        } else if (data.status === 'absent') {
          setAttendanceStatus('already-absent');
          if (data.absence_reason) setAbsenceReason(data.absence_reason);
        }
      }
    } catch {
      setAttendanceStatus('idle');
    }
  };

  const fetchAiWelcome = async () => {
    // 체크인 환영 문구는 매번 NVIDIA API를 호출할 필요가 없는 고정 콘텐츠입니다.
    // 동아리별 문구를 로컬에서 선택해 API 사용량과 비용을 줄입니다.
    const clubName = clubMeta?.name || '학생회';
    const welcomeMessages: Record<string, string> = {
      '새울림': '북치는 새울림! 오늘도 힘차게 드럼을 두드리며 하나님을 찬양합시다! "여호와는 나의 힘이요 나의 방패시니 내 마음이 그를 의지하여 도움을 얻었도다" (시편 28:7)',
      '천지풍': '기창 천지풍! 오늘도 깃발을 높이 들고 믿음의 전진을 외칩시다! "오직 여호와를 앙망하는 자는 새 힘을 얻으리니" (이사야 40:31)',
      '천지후': '댄스 천지후! 오늘도 열정의 춤으로 하나님께 영광을 돌립시다! "너는 마음을 다하여 여호와를 신뢰하고" (잠언 3:5)',
      '문화부': '미디어 문화부! 오늘도 창의적인 콘텐츠로 복음을 전합시다! "너희는 세상의 빛이라 산 위에 있는 동네가 숨겨지지 못할 것이요" (마태복음 5:14)',
      '학생회': '반갑습니다! 오늘도 함께 예배할 수 있어서 기쁩니다! "이는 여호와의 날이니 우리가 그 가운데서 기뻐하리로다" (시편 118:24)',
    };

    setAiMessage(welcomeMessages[clubName] || welcomeMessages['학생회']);
    setShowAiPopup(true);
  };

  const doCheckIn = async () => {
    try {
      const todayStr = todayKey();
      const clubValue = profile.club || 'saeullim';

      const { data, error } = await supabase
        .from('attendance')
        .insert({
          user_id: profile.user_id,
          user_name: profile.name,
          club: clubValue,
          attendance_date: todayStr,
          status: 'attended',
          checked_in_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        if (error.code === '23505') {
          setAttendanceStatus('already-attend');
          return;
        }
        throw error;
      }

      if (data?.id) setRecordId(data.id);
      setAttendanceStatus('success-attend');

      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#10b981', '#f43f5e', '#8b5cf6', '#06b6d4'],
      });

      setTimeout(() => {
        confetti({
          particleCount: 60,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
        });
        confetti({
          particleCount: 60,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
        });
      }, 300);

      fetchAiWelcome();

    } catch (err) {
      console.error('출석 체크 실패:', err);
      setErrorMsg('출석 처리 중 오류가 발생했어요. 다시 시도해주세요.');
      setAttendanceStatus('idle');
    }
  };

  const handleCheckIn = useCallback(async () => {
    if (attendanceStatus !== 'idle') return;

    setAttendanceStatus('checking-location');
    setErrorMsg('');

    if (!navigator.geolocation) {
      setErrorMsg('위치 정보를 사용할 수 없는 브라우저예요. 다른 브라우저로 시도해주세요.');
      setAttendanceStatus('idle');
      return;
    }

    // DB에 활성 위치가 없으면 위치 검증 건너뛰기
    if (!activeLocations || activeLocations.length === 0) {
      setAttendanceStatus('loading-attend');
      await doCheckIn();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        // 모든 활성 위치 중 하나라도 반경 안에 있으면 통과
        let withinAny = false;
        let closestDistance = Infinity;
        let closestLabel = '';

        for (const loc of activeLocations) {
          const distance = getDistanceM(
            position.coords.latitude,
            position.coords.longitude,
            loc.latitude,
            loc.longitude
          );
          if (distance <= loc.radius_meters) {
            withinAny = true;
            break;
          }
          if (distance < closestDistance) {
            closestDistance = distance;
            closestLabel = loc.label;
          }
        }

        if (!withinAny) {
          setErrorMsg(
            `등록된 출석 위치 반경 밖이에요. 가장 가까운 위치 '${closestLabel}'까지 약 ${Math.round(closestDistance)}m 떨어져 있어요.`
          );
          setAttendanceStatus('location-out-of-range');
          return;
        }

        setAttendanceStatus('loading-attend');
        await doCheckIn();
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
        if (err.code === err.PERMISSION_DENIED) {
          setErrorMsg('위치 권한이 거부되었어요. iPhone에서는 설정 → 개인정보 보호 및 보안 → 위치 서비스에서 사용하는 브라우저의 위치 권한을 허용한 뒤 다시 시도해주세요.');
          setAttendanceStatus('location-denied');
        } else {
          setErrorMsg('위치를 확인할 수 없어요. 학관 내에서 다시 시도해주세요.');
          setAttendanceStatus('idle');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [attendanceStatus, profile, activeLocations]);

  const handleAbsence = useCallback(async () => {
    if (attendanceStatus !== 'idle' || !absenceReason.trim()) return;

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const todayStr = todayKey();
      const clubValue = profile.club || 'saeullim';

      const { data, error } = await supabase
        .from('attendance')
        .insert({
          user_id: profile.user_id,
          user_name: profile.name,
          club: clubValue,
          attendance_date: todayStr,
          status: 'absent',
          absence_reason: absenceReason.trim(),
          checked_in_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        if (error.code === '23505') {
          setAttendanceStatus('already-absent');
          setShowAbsenceModal(false);
          setIsSubmitting(false);
          return;
        }
        throw error;
      }

      if (data?.id) setRecordId(data.id);
      setAttendanceStatus('success-absent');
      setShowAbsenceModal(false);
      setIsSubmitting(false);

    } catch (err) {
      console.error('불참 신고 실패:', err);
      setErrorMsg('불참 신고 중 오류가 발생했어요. 다시 시도해주세요.');
      setIsSubmitting(false);
    }
  }, [attendanceStatus, absenceReason, profile]);

  const handleCancelAttendance = useCallback(async () => {
    if (!recordId) return;
    setAttendanceStatus('loading-cancel');
    setErrorMsg('');

    try {
      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('id', recordId);

      if (error) throw error;

      setRecordId(null);
      setAttendanceStatus('idle');
      setAbsenceReason('');
      setShowCancelConfirm(false);
    } catch (err) {
      console.error('출석 취소 실패:', err);
      setErrorMsg('출석 취소 중 오류가 발생했어요. 다시 시도해주세요.');
      checkTodayStatus();
      setShowCancelConfirm(false);
    }
  }, [recordId]);

  const isButtonDisabled = attendanceStatus !== 'idle' && attendanceStatus !== 'already-attend' && attendanceStatus !== 'success-attend' && attendanceStatus !== 'already-absent' && attendanceStatus !== 'success-absent' && attendanceStatus !== 'location-out-of-range';
  const canCancel = attendanceStatus === 'already-attend' || attendanceStatus === 'success-attend' || attendanceStatus === 'already-absent' || attendanceStatus === 'success-absent';

  const buttonBg = attendanceStatus === 'success-attend' || attendanceStatus === 'already-attend'
    ? 'linear-gradient(135deg, #10b981, #059669)'
    : attendanceStatus === 'success-absent' || attendanceStatus === 'already-absent'
      ? 'linear-gradient(135deg, #f97316, #ea580c)'
      : attendanceStatus === 'loading-attend' || attendanceStatus === 'loading-absent' || attendanceStatus === 'loading-cancel' || attendanceStatus === 'checking-location'
        ? 'linear-gradient(135deg, #f59e0b, #d97706)'
        : 'linear-gradient(135deg, #f59e0b, #ef4444, #ec4899)';

  const buttonShadow = attendanceStatus === 'success-attend' || attendanceStatus === 'already-attend'
    ? '0 0 40px rgba(16,185,129,0.3)'
    : attendanceStatus === 'success-absent' || attendanceStatus === 'already-absent'
      ? '0 0 40px rgba(249,115,22,0.25)'
      : '0 8px 32px rgba(245,158,11,0.25)';

  const isAnySuccess = attendanceStatus === 'already-attend' || attendanceStatus === 'success-attend' || attendanceStatus === 'already-absent' || attendanceStatus === 'success-absent';

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center w-full max-w-md"
      >
        <p className="text-sm text-foreground-500 mb-1">{dateStr}</p>
        <h1 className="text-xl font-bold text-foreground-950 mb-2">
          {profile.name}님, 환영합니다!
        </h1>
        {clubMeta && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-8" style={{ backgroundColor: `${clubMeta.color}15`, color: clubMeta.color }}>
            <i className={`${clubMeta.icon} text-sm`}></i>
            {clubMeta.name}
          </div>
        )}

        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 px-4 py-2.5 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700"
          >
            {errorMsg}
          </motion.div>
        )}

        {attendanceStatus === 'location-denied' && (
          <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
            <p className="font-medium mb-1">위치 권한이 필요해요</p>
            <p className="text-xs text-amber-600">브라우저 설정 → 개인정보 보호 → 위치 서비스에서 이 사이트의 위치 접근을 허용해주세요.</p>
          </div>
        )}

        {attendanceStatus === 'location-out-of-range' && (
          <div className="mb-4 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-700">
            <p className="font-medium mb-1">위치 확인 실패</p>
            <p className="text-xs text-orange-600">{errorMsg}</p>
            <button
              onClick={() => setAttendanceStatus('idle')}
              className="mt-2 text-xs text-orange-600 underline cursor-pointer hover:text-orange-800"
            >
              다시 시도하기
            </button>
          </div>
        )}

        {/* 교사/부장에게만 위치 미지정 안내 */}
        {isTeacherOrChief && locationLoaded && (!activeLocations || activeLocations.length === 0) && attendanceStatus === 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm"
          >
            <div className="flex items-start gap-2">
              <i className="ri-map-pin-line text-amber-600 mt-0.5 flex-shrink-0"></i>
              <div>
                <p className="font-medium text-amber-800 mb-1">출석 위치가 아직 지정되지 않았어요</p>
                <p className="text-xs text-amber-700">
                  지금은 위치 검증 없이 출석이 가능해요. 설정 페이지에서 출석 위치를 지정하면 학생들의 위치 기반 출석 인증이 활성화돼요.
                </p>
                <Link
                  to="/settings/attendance-location"
                  className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-amber-700 underline hover:text-amber-900 cursor-pointer"
                >
                  <i className="ri-settings-3-line"></i>
                  출석 위치 설정하러 가기
                </Link>
              </div>
            </div>
          </motion.div>
        )}

        {attendanceStatus === 'already-absent' && absenceReason && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-700"
          >
            <p className="font-medium mb-1">이미 불참 신고하셨어요</p>
            <p className="text-xs text-orange-600">{absenceReason}</p>
          </motion.div>
        )}

        <motion.button
          onClick={handleCheckIn}
          disabled={isButtonDisabled}
          whileTap={!isButtonDisabled ? { scale: 0.95 } : {}}
          className="relative w-52 h-52 rounded-full flex flex-col items-center justify-center cursor-pointer select-none transition-all duration-300"
          style={{
            background: buttonBg,
            boxShadow: buttonShadow,
            opacity: (attendanceStatus === 'loading-attend' || attendanceStatus === 'loading-absent' || attendanceStatus === 'loading-cancel' || attendanceStatus === 'checking-location') ? 0.8 : 1,
          }}
        >
          {(attendanceStatus === 'loading-attend' || attendanceStatus === 'loading-absent' || attendanceStatus === 'loading-cancel' || attendanceStatus === 'checking-location') && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 rounded-full border-4 border-white/30 border-t-white"
            ></motion.div>
          )}

          <AnimatePresence mode="wait">
            {attendanceStatus === 'checking-location' ? (
              <motion.div key="checking-location" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-white text-center">
                <i className="ri-map-pin-line text-4xl block mb-2"></i>
                <span className="text-sm font-bold">위치 확인 중...</span>
              </motion.div>
            ) : attendanceStatus === 'loading-attend' || attendanceStatus === 'loading-absent' ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-white text-center">
                <i className="ri-loader-4-line animate-spin text-4xl block mb-2"></i>
                <span className="text-sm font-bold">{attendanceStatus === 'loading-absent' ? '불참 신고 중...' : '출석 체크 중...'}</span>
              </motion.div>
            ) : attendanceStatus === 'loading-cancel' ? (
              <motion.div key="cancel-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-white text-center">
                <i className="ri-loader-4-line animate-spin text-4xl block mb-2"></i>
                <span className="text-sm font-bold">출석 취소 중...</span>
              </motion.div>
            ) : attendanceStatus === 'success-attend' || attendanceStatus === 'already-attend' ? (
              <motion.div key="success" initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }} className="text-white text-center">
                <i className="ri-check-line text-6xl block mb-2"></i>
                <span className="text-sm font-bold">
                  {attendanceStatus === 'already-attend' ? '이미 출석 완료!' : '출석 완료!'}
                </span>
              </motion.div>
            ) : attendanceStatus === 'success-absent' || attendanceStatus === 'already-absent' ? (
              <motion.div key="absent-success" initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }} className="text-white text-center">
                <i className="ri-calendar-close-line text-6xl block mb-2"></i>
                <span className="text-sm font-bold">
                  {attendanceStatus === 'already-absent' ? '이미 불참 신고 완료!' : '불참 신고 완료!'}
                </span>
              </motion.div>
            ) : (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-white text-center">
                <i className="ri-fingerprint-line text-4xl block mb-2"></i>
                <span className="text-lg font-extrabold whitespace-nowrap">오늘 출석</span>
                <span className="text-lg font-extrabold whitespace-nowrap">완료하기</span>
              </motion.div>
            )}
          </AnimatePresence>

          {attendanceStatus === 'idle' && (
            <motion.div
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-full border-2 border-white/20"
            ></motion.div>
          )}
        </motion.button>

        {attendanceStatus === 'idle' && (
          <>
            <p className="text-xs text-foreground-400 mt-6">
              {activeLocations && activeLocations.length > 0
                ? `${activeLocations.map(l => `'${l.label}'`).join(', ')} 반경 내 위치 확인 후 출석이 완료돼요!`
                : '출석 위치 지정 전이라 바로 출석이 가능해요.'}
            </p>
            <button
              onClick={() => setShowAbsenceModal(true)}
              className="mt-5 px-6 py-3 bg-background-100 border border-orange-200 rounded-2xl text-sm font-medium text-orange-600 hover:bg-orange-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-calendar-close-line mr-2"></i>
              오늘은 참석이 어려워요 (불참)
            </button>
          </>
        )}

        {canCancel && (
          <button
            onClick={() => setShowCancelConfirm(true)}
            className="mt-5 px-6 py-3 bg-background-100 border border-rose-200 rounded-2xl text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-arrow-go-back-line mr-2"></i>
            출석 취소하기
          </button>
        )}

        {isAnySuccess && !showCancelConfirm && (
          <div className="mt-8 px-6 py-4 bg-background-50 border border-background-200 rounded-2xl">
            <p className="text-sm text-foreground-600">
              {attendanceStatus.startsWith('success-attend') || attendanceStatus.startsWith('already-attend')
                ? '오늘 예배에서 만나요! 하나님의 은혜가 함께하길 바랍니다.'
                : '내일은 꼭 함께할 수 있길 기도할게요. 힘내세요!'}
            </p>
          </div>
        )}
      </motion.div>

      {/* AI Welcome Popup */}
      <AnimatePresence>
        {showAiPopup && aiMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setShowAiPopup(false)}
          >
            <motion.div
              initial={{ scale: 0.8, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 30 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background-100 rounded-[24px] p-6 md:p-8 max-w-md w-full shadow-xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-accent-100 flex items-center justify-center">
                  <i className="ri-sparkling-line text-2xl text-accent-600"></i>
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground-900">AI 멘토의 환영 인사</p>
                  <p className="text-xs text-foreground-500">오늘도 힘내세요!</p>
                </div>
              </div>
              <div className="bg-background-50 rounded-xl p-4 mb-5">
                <p className="text-sm text-foreground-800 leading-relaxed whitespace-pre-wrap">{aiMessage}</p>
              </div>
              <button
                onClick={() => setShowAiPopup(false)}
                className="w-full py-3 bg-primary-500 hover:bg-primary-600 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer"
              >
                확인했어요!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {showCancelConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setShowCancelConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background-100 rounded-[24px] p-6 md:p-8 max-w-md w-full shadow-xl"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center">
                  <i className="ri-error-warning-line text-2xl text-rose-600"></i>
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground-900">
                    {attendanceStatus.startsWith('already-absent') || attendanceStatus.startsWith('success-absent')
                      ? '불참 신고를 취소할까요?'
                      : '출석을 취소할까요?'}
                  </p>
                  <p className="text-xs text-foreground-500">취소하면 기록이 삭제되고 다시 체크할 수 있어요</p>
                </div>
              </div>

              {errorMsg && (
                <div className="mb-4 px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                  {errorMsg}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 py-3 bg-background-50 border border-background-200 text-foreground-700 text-sm font-medium rounded-xl hover:bg-background-200 transition-colors cursor-pointer whitespace-nowrap"
                >
                  유지하기
                </button>
                <button
                  onClick={handleCancelAttendance}
                  className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                >
                  네, 취소할게요
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Absence Reason Modal */}
      <AnimatePresence>
        {showAbsenceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => { if (!isSubmitting) setShowAbsenceModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background-100 rounded-[24px] p-6 md:p-8 max-w-md w-full shadow-xl"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                  <i className="ri-calendar-close-line text-2xl text-orange-600"></i>
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground-900">불참 사유 입력</p>
                  <p className="text-xs text-foreground-500">구역장님과 교사님께 전달됩니다</p>
                </div>
              </div>

              <div className="mb-5">
                <textarea
                  value={absenceReason}
                  onChange={(e) => setAbsenceReason(e.target.value)}
                  placeholder="예) 오늘 학교 시험 준비로 참석이 어려워요"
                  maxLength={500}
                  rows={4}
                  className="w-full px-4 py-3 bg-background-50 border border-background-200 rounded-xl text-sm text-foreground-900 placeholder:text-foreground-400 resize-none focus:outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-200 transition-colors"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-foreground-400 mt-1.5 text-right">{absenceReason.length}/500</p>
              </div>

              {errorMsg && (
                <div className="mb-4 px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                  {errorMsg}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { if (!isSubmitting) setShowAbsenceModal(false); }}
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-background-50 border border-background-200 text-foreground-700 text-sm font-medium rounded-xl hover:bg-background-200 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  취소
                </button>
                <button
                  onClick={handleAbsence}
                  disabled={isSubmitting || !absenceReason.trim()}
                  className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <i className="ri-loader-4-line animate-spin"></i>
                      신고 중...
                    </span>
                  ) : (
                    '불참 신고하기'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AdminAttendanceView({ profile }: { profile: { name: string; club?: string; user_id: string; role?: string } }) {
  const [clubSummaries, setClubSummaries] = useState<ClubAttendanceSummary[]>([]);
  const [selectedClub, setSelectedClub] = useState<ClubType>('saeullim');
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchAttendanceData = useCallback(async () => {
    try {
      const todayStr = todayKey();

      const { data: allMembers, error: memberError } = await supabase
        .from('user_roles')
        .select('user_id, name, club, role')
        .eq('is_active', true)
        .eq('approval_status', 'approved')
        .not('role', 'in', '(teacher,chief)')

      if (memberError) throw memberError;

      const { data: records, error: recError } = await supabase
        .from('attendance')
        .select('*')
        .eq('attendance_date', todayStr);

      if (recError) throw recError;

      const realRecords = (records || []) as AttendanceRecord[];

      const summaries = buildClubSummaries(allMembers || [], realRecords);
      setClubSummaries(summaries);
    } catch (err) {
      console.error('출석 데이터 로딩 실패:', err);
      setClubSummaries([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const buildClubSummaries = (
    allMembers: { user_id: string; name: string; club: string | null; role: string }[],
    records: AttendanceRecord[]
  ): ClubAttendanceSummary[] => {
    return CLUB_IDS.map((clubId) => {
      const clubMembers = allMembers.filter((m) => m.club === clubId);

      const memberStatuses: ClubMemberStatus[] = clubMembers.map((m) => {
        const record = records.find((r) => r.user_id === m.user_id);
        if (record) {
          return {
            name: m.name,
            status: record.status,
            user_id: m.user_id,
            absence_reason: record.absence_reason,
          };
        }
        return { name: m.name, status: 'no_response' as const, user_id: m.user_id };
      });

      const attendedToday = memberStatuses.filter((m) => m.status === 'attended').length;
      const absentDeclared = memberStatuses.filter((m) => m.status === 'absent').length;
      const noResponse = memberStatuses.filter((m) => m.status === 'no_response').length;
      const meta = CLUB_META[clubId];
      const totalMembers = clubMembers.length;

      return {
        club: clubId,
        clubName: meta.name,
        clubIcon: meta.icon,
        clubColor: meta.color,
        clubBg: meta.bg,
        totalMembers,
        attendedToday,
        absentToday: absentDeclared,
        attendanceRate: totalMembers > 0 ? Math.round((attendedToday / totalMembers) * 100) : 0,
        memberList: memberStatuses,
      };
    });
  };

  useEffect(() => {
    fetchAttendanceData();
    const todayStr = todayKey();

    const channel = supabase
      .channel('attendance-realtime-admin')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: `attendance_date=eq.${todayStr}`,
        },
        () => {
          fetchAttendanceData();
        }
      )
      .subscribe();

    channelRef.current = channel;

    // 실시간 구독이 기본 갱신 경로이며, 폴링은 장애 대비 보조 수단으로만 유지합니다.
    const pollInterval = setInterval(() => {
      fetchAttendanceData();
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [fetchAttendanceData]);

  const overallRate = clubSummaries.length > 0
    ? Math.round(clubSummaries.reduce((s, c) => s + c.attendanceRate * c.totalMembers, 0) / clubSummaries.reduce((s, c) => s + c.totalMembers, 0))
    : 0;
  const totalAttended = clubSummaries.reduce((s, c) => s + c.attendedToday, 0);
  const totalMembers = clubSummaries.reduce((s, c) => s + c.totalMembers, 0);
  const totalAbsent = clubSummaries.reduce((s, c) => s + c.absentToday, 0);
  const totalDeclaredAbsent = clubSummaries.reduce((s, c) => s + c.memberList.filter((m) => m.status === 'absent').length, 0);

  const selectedSummary = clubSummaries.find((c) => c.club === selectedClub);
  const attendedMembers = selectedSummary?.memberList.filter((m) => m.status === 'attended') || [];
  const declaredAbsentMembers = selectedSummary?.memberList.filter((m) => m.status === 'absent') || [];
  const noResponseMembers = selectedSummary?.memberList.filter((m) => m.status === 'no_response') || [];

  if (isLoading) {
    return <Spinner label="출석 데이터를 불러오는 중..." />;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground-950 mb-1">실시간 출석 현황판</h1>
            <p className="text-sm text-foreground-500">
              {formatKoreanDate(new Date(), { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          <KpiCard title="전체 출석률" value={`${overallRate}%`} icon="ri-user-heart-line" colorClass="bg-primary-100 text-primary-600" delay={0} />
          <KpiCard title="출석 완료" value={`${totalAttended}/${totalMembers}명`} icon="ri-check-double-line" colorClass="bg-accent-100 text-accent-600" delay={0.08} />
          <KpiCard title="불참 신고" value={`${totalDeclaredAbsent}명`} icon="ri-calendar-close-line" colorClass="bg-orange-100 text-orange-600" delay={0.12} />
          <KpiCard title="미응답" value={`${totalAbsent}명`} icon="ri-user-unfollow-line" colorClass="bg-rose-100 text-rose-600" delay={0.16} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {clubSummaries.map((club, i) => {
            const clubDeclaredAbsent = club.memberList.filter((m) => m.status === 'absent').length;
            const clubNoResponse = club.memberList.filter((m) => m.status === 'no_response').length;
            return (
              <motion.button
                key={club.club}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 + i * 0.06 }}
                onClick={() => setSelectedClub(club.club)}
                className={`bg-background-100 border rounded-[20px] p-5 text-left transition-all cursor-pointer ${
                  selectedClub === club.club ? 'border-primary-300 ring-1 ring-primary-200' : 'border-background-200 hover:border-primary-200'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${club.clubColor}15` }}>
                    <i className={`${club.clubIcon} text-xl`} style={{ color: club.clubColor }}></i>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-bold" style={{ backgroundColor: `${club.clubColor}15`, color: club.clubColor }}>
                    {club.attendanceRate}%
                  </span>
                </div>
                <p className="text-base font-bold text-foreground-950 mb-1">{club.clubName}</p>
                <div className="flex items-center gap-3 text-xs text-foreground-600 flex-wrap">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    출석 {club.attendedToday}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                    불참 {clubDeclaredAbsent}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                    미응답 {clubNoResponse}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-background-200 overflow-hidden mt-3">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: club.clubColor }}
                    initial={{ width: 0 }}
                    animate={{ width: `${club.attendanceRate}%` }}
                    transition={{ duration: 0.6, delay: 0.3 + i * 0.08, ease: 'easeOut' }}
                  ></motion.div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {selectedSummary && (
          <motion.div
            key={selectedClub}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-background-100 border border-background-200 rounded-[20px] p-5 md:p-6"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${selectedSummary.clubColor}15` }}>
                <i className={`${selectedSummary.clubIcon} text-2xl`} style={{ color: selectedSummary.clubColor }}></i>
              </div>
              <div className="flex-1">
                <p className="text-lg font-bold text-foreground-950">{selectedSummary.clubName}</p>
                <p className="text-xs text-foreground-500">
                  출석 {attendedMembers.length}명 / 불참 {declaredAbsentMembers.length}명 / 미응답 {noResponseMembers.length}명 · 전체 {selectedSummary.totalMembers}명 · 출석률 {selectedSummary.attendanceRate}%
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="bg-background-50 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <i className="ri-check-line text-emerald-600 text-sm"></i>
                  </div>
                  <p className="text-sm font-bold text-foreground-800">
                    출석 <span className="text-emerald-600">({attendedMembers.length})</span>
                  </p>
                </div>
                {attendedMembers.length === 0 ? (
                  <p className="text-xs text-foreground-400 text-center py-4">아직 출석한 학생이 없어요</p>
                ) : (
                  <div className="space-y-2">
                    {attendedMembers.map((member, idx) => (
                      <motion.div
                        key={member.user_id || idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="flex items-center gap-2.5 px-3 py-2 bg-emerald-50/50 border border-emerald-100 rounded-xl"
                      >
                        <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-emerald-700">{member.name[0]}</span>
                        </div>
                        <span className="text-sm font-medium text-foreground-800">{member.name}</span>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-background-50 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center">
                    <i className="ri-calendar-close-line text-orange-600 text-sm"></i>
                  </div>
                  <p className="text-sm font-bold text-foreground-800">
                    불참 신고 <span className="text-orange-600">({declaredAbsentMembers.length})</span>
                  </p>
                </div>
                {declaredAbsentMembers.length === 0 ? (
                  <p className="text-xs text-foreground-400 text-center py-4">불참 신고한 학생이 없어요</p>
                ) : (
                  <div className="space-y-2">
                    {declaredAbsentMembers.map((member, idx) => (
                      <motion.div
                        key={member.user_id || idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="px-3 py-2.5 bg-orange-50/50 border border-orange-100 rounded-xl"
                      >
                        <div className="flex items-center gap-2.5 mb-1.5">
                          <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-orange-700">{member.name[0]}</span>
                          </div>
                          <span className="text-sm font-medium text-foreground-800">{member.name}</span>
                        </div>
                        {member.absence_reason && (
                          <p className="text-xs text-orange-600 pl-9 mb-2">{member.absence_reason}</p>
                        )}
                        <div className="flex justify-end">
                          <button
                            onClick={() => {
                              window.open('https://t.me/', '_blank', 'noopener,noreferrer');
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-sky-100 text-sky-700 text-xs font-medium hover:bg-sky-200 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <i className="ri-telegram-2-fill text-sm"></i>
                            텔레그램으로 심방하기
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-background-50 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center">
                    <i className="ri-close-line text-rose-600 text-sm"></i>
                  </div>
                  <p className="text-sm font-bold text-foreground-800">
                    미응답 <span className="text-rose-600">({noResponseMembers.length})</span>
                  </p>
                </div>
                {noResponseMembers.length === 0 ? (
                  <p className="text-xs text-foreground-400 text-center py-4">전원 응답 완료!</p>
                ) : (
                  <div className="space-y-2">
                    {noResponseMembers.map((member, idx) => (
                      <motion.div
                        key={member.user_id || idx}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="flex items-center justify-between px-3 py-2 bg-rose-50/50 border border-rose-100 rounded-xl"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-rose-700">{member.name[0]}</span>
                          </div>
                          <span className="text-sm font-medium text-foreground-800">{member.name}</span>
                        </div>
                        <button
                          onClick={() => {
                            window.open('https://t.me/', '_blank', 'noopener,noreferrer');
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-sky-100 text-sky-700 text-xs font-medium hover:bg-sky-200 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <i className="ri-telegram-2-fill text-sm"></i>
                          텔레그램으로 심방하기
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
