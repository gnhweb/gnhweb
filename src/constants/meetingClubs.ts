import { CLUB_LABELS, ROLE_HIERARCHY } from '@/types/auth';
import type { ClubType, UserRole } from '@/types/auth';

/** 회의록에 붙일 수 있는 분류 — 5개 동아리 + 회장단 */
export type MeetingClub = ClubType | 'executive';

export const MEETING_CLUB_OPTIONS: { id: MeetingClub; label: string }[] = [
  { id: 'saeullim', label: CLUB_LABELS.saeullim },
  { id: 'cheonjipoong', label: CLUB_LABELS.cheonjipoong },
  { id: 'cheonjihu', label: CLUB_LABELS.cheonjihu },
  { id: 'munhwabu', label: CLUB_LABELS.munhwabu },
  { id: 'cheonhwarae_cheongmyeong', label: CLUB_LABELS.cheonhwarae_cheongmyeong },
  { id: 'executive', label: '회장단' },
];

export const MEETING_CLUB_LABELS: Record<MeetingClub, string> = MEETING_CLUB_OPTIONS.reduce(
  (acc, opt) => ({ ...acc, [opt.id]: opt.label }),
  {} as Record<MeetingClub, string>
);

const EXECUTIVE_ROLES: UserRole[] = ['president', 'secretary', 'treasurer'];

/**
 * 이 회의록을 열람할 수 있는지 판단합니다.
 * - 부장/교사: 전체 열람 가능
 * - 분류가 없는(공통) 회의록: 사명자(부구역장 이상) 누구나 열람 가능
 * - 회장단 회의록: 회장/서기/회계만 열람 가능
 * - 특정 동아리 회의록: 그 동아리 소속(주소속/부소속) 사명자만 열람 가능
 */
export function canAccessMeetingClub(
  club: string | null | undefined,
  role: UserRole | undefined,
  primaryClub: ClubType | null | undefined,
  secondaryClubs: string[]
): boolean {
  if (!role) return false;
  if (role === 'chief' || role === 'teacher') return true;
  if (!club) return true;

  const isLeader = ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.assistant_zone_leader;
  if (!isLeader) return false;

  if (club === 'executive') {
    return EXECUTIVE_ROLES.includes(role);
  }

  return primaryClub === club || secondaryClubs.includes(club);
}
