import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { todayKey } from '@/lib/date';
import { useAuth } from '@/hooks/useAuth';
import SmartAttendance from '@/components/feature/SmartAttendance';
import LateAttendanceNotice from '@/components/feature/LateAttendanceNotice';

export default function AttendancePage() {
  const { profile } = useAuth();
  const [lateSubmitted, setLateSubmitted] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!profile?.user_id) return;
    const check = async () => {
      const { data } = await supabase
        .from('attendance')
        .select('status')
        .eq('user_id', profile.user_id)
        .eq('attendance_date', todayKey())
        .maybeSingle();
      setLateSubmitted(data?.status === 'late');
      setChecked(true);
    };
    check();
  }, [profile?.user_id]);

  if (!profile || !checked) {
    return <div className="min-h-screen bg-background-50 flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-primary-400 border-t-transparent animate-spin" /></div>;
  }

  return (
    <div>
      {lateSubmitted ? (
        <LateAttendanceNotice />
      ) : (
        <>
          <SmartAttendance />
          <LateAttendanceNotice onSubmitted={() => setLateSubmitted(true)} />
        </>
      )}
    </div>
  );
}
