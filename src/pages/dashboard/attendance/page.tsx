import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { todayKey } from '@/lib/date';
import SmartAttendance from '@/components/feature/SmartAttendance';
import LateAttendanceNotice from '@/components/feature/LateAttendanceNotice';

export default function AttendancePage() {
  const [lateSubmitted, setLateSubmitted] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase
        .from('attendance')
        .select('status')
        .eq('attendance_date', todayKey())
        .maybeSingle();
      setLateSubmitted(data?.status === 'late');
      setChecked(true);
    };
    check();
  }, []);

  if (!checked) return <div className="min-h-screen bg-background-50 flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-primary-400 border-t-transparent animate-spin" /></div>;

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
