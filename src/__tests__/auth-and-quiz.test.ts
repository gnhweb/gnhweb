import { describe, it, expect } from 'vitest';
import { ROLE_HIERARCHY } from '@/types/auth';
import type { UserRole } from '@/types/auth';

// ============================================================
// hasRole — 권한 체크 로직 (순수 함수로 재현)
// ============================================================

function hasRole(userRole: UserRole | null, minRole: UserRole): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

describe('hasRole', () => {
  it('chief는 모든 역할에 접근 가능해야 한다', () => {
    expect(hasRole('chief', 'member')).toBe(true);
    expect(hasRole('chief', 'teacher')).toBe(true);
    expect(hasRole('chief', 'president')).toBe(true);
    expect(hasRole('chief', 'chief')).toBe(true);
  });

  it('teacher는 member, assistant_zone_leader, zone_leader에 접근 가능해야 한다', () => {
    expect(hasRole('teacher', 'member')).toBe(true);
    expect(hasRole('teacher', 'assistant_zone_leader')).toBe(true);
    expect(hasRole('teacher', 'zone_leader')).toBe(true);
    expect(hasRole('teacher', 'teacher')).toBe(true);
  });

  it('teacher는 chief에 접근할 수 없어야 한다', () => {
    expect(hasRole('teacher', 'chief')).toBe(false);
  });

  it('member는 member에만 접근 가능해야 한다', () => {
    expect(hasRole('member', 'member')).toBe(true);
    expect(hasRole('member', 'teacher')).toBe(false);
    expect(hasRole('member', 'chief')).toBe(false);
    expect(hasRole('member', 'president')).toBe(false);
  });

  it('null 프로필은 어떤 권한도 없어야 한다', () => {
    expect(hasRole(null, 'member')).toBe(false);
    expect(hasRole(null, 'teacher')).toBe(false);
    expect(hasRole(null, 'chief')).toBe(false);
  });

  it('ROLE_HIERARCHY 값이 정렬되어 있어야 한다', () => {
    expect(ROLE_HIERARCHY.chief).toBeGreaterThan(ROLE_HIERARCHY.teacher);
    expect(ROLE_HIERARCHY.teacher).toBeGreaterThan(ROLE_HIERARCHY.president);
    expect(ROLE_HIERARCHY.president).toBeGreaterThan(ROLE_HIERARCHY.zone_leader);
    expect(ROLE_HIERARCHY.zone_leader).toBeGreaterThan(ROLE_HIERARCHY.assistant_zone_leader);
    expect(ROLE_HIERARCHY.assistant_zone_leader).toBeGreaterThan(ROLE_HIERARCHY.member);
  });

  it('모든 간부(과장) 역할은 member보다 높아야 한다', () => {
    const managerRoles: UserRole[] = [
      'secretary', 'treasurer', 'service_manager',
      'recreation_manager', 'education_manager', 'sports_manager',
      'praise_manager', 'planning_manager',
    ];
    managerRoles.forEach(role => {
      expect(ROLE_HIERARCHY[role]).toBeGreaterThan(ROLE_HIERARCHY.member);
    });
  });
});

// ============================================================
// validateOptionLengths — 선지 길이 균등 검증 로직
// ============================================================

function validateOptionLengths(options: string[]): boolean {
  if (options.length <= 1) return true;
  const lengths = options.map(o => o.length);
  const maxLen = Math.max(...lengths);
  const minLen = Math.min(...lengths);
  if (minLen === 0) return false;
  return (maxLen / minLen) <= 1.3;
}

describe('validateOptionLengths', () => {
  it('모든 선지 길이가 비슷하면 통과해야 한다', () => {
    const options = ['열두 글자로 된 선지', '열두 글자라 비슷', '열두 글자로 균등', '열두 글자가 모두'];
    expect(validateOptionLengths(options)).toBe(true);
  });

  it('길이 편차가 1.3배 이내면 통과해야 한다', () => {
    // 10글자와 13글자 → 13/10 = 1.3, 통과
    const options = ['열글자인 선지', '열세글자인 선지임', '열글자 선지다', '열두글자의 선지'];
    expect(validateOptionLengths(options)).toBe(true);
  });

  it('길이 편차가 1.3배 초과면 실패해야 한다', () => {
    // 5글자와 15글자 → 15/5 = 3.0, 실패
    const options = ['짧음', '열다섯글자나 되는 아주 긴 선지임', '짧은것', '또짧음'];
    expect(validateOptionLengths(options)).toBe(false);
  });

  it('빈 문자열이 포함되면 실패해야 한다', () => {
    const options = ['정상', '', '또정상', '마지막'];
    expect(validateOptionLengths(options)).toBe(false);
  });

  it('한 개짜리 옵션은 항상 통과해야 한다', () => {
    const options = ['단 하나뿐'];
    expect(validateOptionLengths(options)).toBe(true);
  });

  it('O/X 타입은 통과해야 한다', () => {
    const options = ['O', 'X'];
    expect(validateOptionLengths(options)).toBe(true);
  });
});

// ============================================================
// 보고서 상태 전이 검증
// ============================================================

type ReportStatus = 'draft' | 'submitted' | 'president_reviewed' | 'reviewed' | 'approved' | 'rejected';

const VALID_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  draft: ['submitted'],
  submitted: ['president_reviewed', 'reviewed', 'rejected', 'draft'],
  president_reviewed: ['reviewed', 'rejected', 'draft'],
  reviewed: ['approved', 'rejected', 'draft'],
  approved: [],
  rejected: ['draft', 'submitted'],
};

function isValidTransition(from: ReportStatus, to: ReportStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

describe('reportStatusTransitions', () => {
  it('draft에서 submitted로 변경 가능해야 한다', () => {
    expect(isValidTransition('draft', 'submitted')).toBe(true);
  });

  it('draft에서 approved로 바로 변경 불가능해야 한다', () => {
    expect(isValidTransition('draft', 'approved')).toBe(false);
  });

  it('submitted에서 rejected로 변경 가능해야 한다', () => {
    expect(isValidTransition('submitted', 'rejected')).toBe(true);
  });

  it('approved는 어떤 상태로도 변경 불가능해야 한다 (최종 승인)', () => {
    const statuses: ReportStatus[] = ['draft', 'submitted', 'president_reviewed', 'reviewed', 'approved', 'rejected'];
    statuses.forEach(to => {
      expect(isValidTransition('approved', to)).toBe(false);
    });
  });

  it('rejected에서 draft로 재작성 가능해야 한다', () => {
    expect(isValidTransition('rejected', 'draft')).toBe(true);
    expect(isValidTransition('rejected', 'submitted')).toBe(true);
  });

  it('submitted에서 president_reviewed 가능해야 한다', () => {
    expect(isValidTransition('submitted', 'president_reviewed')).toBe(true);
  });

  it('president_reviewed에서 reviewed 가능해야 한다', () => {
    expect(isValidTransition('president_reviewed', 'reviewed')).toBe(true);
  });

  it('reviewed에서 approved 가능해야 한다', () => {
    expect(isValidTransition('reviewed', 'approved')).toBe(true);
  });

  it('reviewed에서 rejected 가능해야 한다', () => {
    expect(isValidTransition('reviewed', 'rejected')).toBe(true);
  });
});

// ============================================================
// 금지 패턴 검증 — 삼위일체/신학적 논쟁 문제 필터링
// ============================================================

const FORBIDDEN_PATTERNS = [
  /삼위일체/, /성부.*성자.*성령/, /성자.*성부/,
  /trinity/i, /위격/, /본질.*하나님/, /예정/,
  /자유의지/, /은사.*논쟁/, /세대주의/,
];

function isForbidden(text: string): boolean {
  return FORBIDDEN_PATTERNS.some(p => p.test(text));
}

describe('forbiddenPatterns', () => {
  it('삼위일체 관련 내용은 금지되어야 한다', () => {
    expect(isForbidden('삼위일체에 대해 설명해주세요')).toBe(true);
    expect(isForbidden('성부와 성자와 성령의 관계')).toBe(true);
    expect(isForbidden('What is the Trinity?')).toBe(true);
  });

  it('예정론 관련 내용은 금지되어야 한다', () => {
    expect(isForbidden('예정론이 뭔가요?')).toBe(true);
  });

  it('일반 성경 이야기 질문은 금지되지 않아야 한다', () => {
    expect(isForbidden('다윗이 골리앗을 어떻게 이겼나요?')).toBe(false);
    expect(isForbidden('예수님은 어디서 태어나셨나요?')).toBe(false);
    expect(isForbidden('노아의 방주에는 몇 명이 탔나요?')).toBe(false);
  });

  it('출결 관련 질문은 금지되지 않아야 한다', () => {
    expect(isForbidden('출석률이 어떻게 되나요?')).toBe(false);
    expect(isForbidden('지각 3번이면 결석 1번인가요?')).toBe(false);
  });
});