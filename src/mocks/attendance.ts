import type { ClubType } from '@/types/auth';

export interface AttendanceRecord {
  id: string;
  user_id: string;
  user_name: string;
  club: string;
  attendance_date: string;
  checked_in_at: string;
  status: 'attended' | 'absent' | 'late';
  absence_reason?: string;
  late_reason?: string;
}

export interface ClubAttendanceSummary {
  club: ClubType;
  clubName: string;
  clubIcon: string;
  clubColor: string;
  clubBg: string;
  totalMembers: number;
  attendedToday: number;
  absentToday: number;
  lateToday?: number;
  attendanceRate: number;
  memberList: ClubMemberStatus[];
}

export interface ClubMemberStatus {
  name: string;
  status: 'attended' | 'absent' | 'late' | 'no_response';
  user_id: string;
  absence_reason?: string;
  late_reason?: string;
}

export const CLUB_META: Record<ClubType, { name: string; icon: string; color: string; bg: string }> = {
  saeullim: { name: '새울림 (북)', icon: 'ri-music-line', color: '#d97706', bg: 'bg-amber-50' },
  cheonjipoong: { name: '천지풍 (기창)', icon: 'ri-riding-line', color: '#059669', bg: 'bg-emerald-50' },
  cheonjihu: { name: '천지후 (치어)', icon: 'ri-heart-pulse-line', color: '#7c3aed', bg: 'bg-violet-50' },
  munhwabu: { name: '문화부 (미디어)', icon: 'ri-camera-lens-line', color: '#be123c', bg: 'bg-rose-50' },
  cheonhwarae_cheongmyeong: { name: '천화래와 청명 (찬양·밴드)', icon: 'ri-mic-line', color: '#0284c7', bg: 'bg-sky-50' },
};
