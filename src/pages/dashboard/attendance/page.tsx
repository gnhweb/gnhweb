import SmartAttendance from '@/components/feature/SmartAttendance';
import LateAttendance from '@/components/feature/LateAttendance';
import { useAuth } from '@/hooks/useAuth';

export default function AttendancePage() {
  const { profile } = useAuth();
  return (
    <>
      <SmartAttendance />
      {profile && <div className="max-w-4xl mx-auto px-4 md:px-6 pb-8"><LateAttendance profile={profile} /></div>}
    </>
  );
}
