export type UserRole =
  | 'chief'
  | 'teacher'
  | 'president'
  | 'secretary'
  | 'treasurer'
  | 'service_manager'
  | 'recreation_manager'
  | 'education_manager'
  | 'sports_manager'
  | 'praise_manager'
  | 'planning_manager'
  | 'zone_leader'
  | 'assistant_zone_leader'
  | 'member';

export type ClubType = 'saeullim' | 'cheonjipoong' | 'cheonjihu' | 'munhwabu' | 'cheonhwarae_cheongmyeong';

export interface AuditLogEntry {
  id: string;
  target_user_id: string;
  target_user_name: string;
  action: 'expel' | 'restore';
  performed_by: string;
  performed_by_name: string;
  created_at: string;
}

export interface UserProfile {
  user_id: string;
  role: UserRole;
  roles?: UserRole[];
  name: string;
  club: ClubType | null;
  zone: string | null;
  isActive: boolean;
  birth_year?: number | null;
  birth_month?: number | null;
  birth_day?: number | null;
  gender?: string | null;
  grade?: string | null;
  interests?: string | null;
  bio?: string | null;
  profile_image?: string | null;
  approval_status?: string | null;
  assigned_teacher_id?: ClubType | null;
  dual_club?: ClubType | null;
  is_expelled?: boolean;
  graduation_expected?: boolean;
}

export const CLUB_LABELS: Record<ClubType, string> = {
  saeullim: '새울림 (북)',
  cheonjipoong: '천지풍 (기창)',
  cheonjihu: '천지후 (치어)',
  munhwabu: '문화부 (미디어·편집)',
  cheonhwarae_cheongmyeong: '천화래와 청명 (찬양·밴드)',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  chief: '부장',
  teacher: '교사',
  president: '회장',
  secretary: '서기',
  treasurer: '회계',
  service_manager: '봉사과장',
  recreation_manager: '오락과장',
  education_manager: '교육과장',
  sports_manager: '체육과장',
  praise_manager: '찬양과장',
  planning_manager: '기획과장',
  zone_leader: '구역장',
  assistant_zone_leader: '부구역장',
  member: '일반 학생회원',
};

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  chief: 6,
  teacher: 5,
  president: 4,
  secretary: 4,
  treasurer: 4,
  service_manager: 4,
  recreation_manager: 4,
  education_manager: 4,
  sports_manager: 4,
  praise_manager: 4,
  planning_manager: 4,
  zone_leader: 3,
  assistant_zone_leader: 2,
  member: 1,
};

export const ROLE_GROUP_LABELS: Record<string, string> = {
  chief: '최고 관리자',
  teacher: '지도 교사',
  president: '임원',
  secretary: '임원',
  treasurer: '임원',
  service_manager: '임원',
  recreation_manager: '임원',
  education_manager: '임원',
  sports_manager: '임원',
  praise_manager: '임원',
  planning_manager: '임원',
  zone_leader: '구역장',
  assistant_zone_leader: '부구역장',
  member: '일반',
};