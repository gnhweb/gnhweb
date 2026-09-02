import { ROLE_LABELS, CLUB_LABELS } from '@/types/auth';
import type { UserRole, ClubType } from '@/types/auth';

export interface AdminUserData {
  user_id: string;
  role: UserRole;
  roles?: UserRole[];
  name: string;
  club?: ClubType;
  zone?: string;
  is_active: boolean;
  is_expelled: boolean;
  created_at: string;
  updated_at: string;
}

export const adminMockUsers: AdminUserData[] = [];
