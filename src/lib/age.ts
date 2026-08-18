/**
 * 만 나이(국제 나이) 계산
 * 공식: 현재 연도 - 출생 연도, 생일이 지나지 않았으면 -1
 * 예: 2008년 8월 1일생 → 2026년 8월 1일 기준 18세 (생일 당일부터 만 나이 증가)
 * 예: 2008년 9월 1일생 → 2026년 8월 1일 기준 17세
 */
export function getInternationalAge(birthYear: number, birthMonth: number, birthDay: number): number {
  if (!birthYear || birthYear <= 0) return 0;
  const today = new Date();
  let age = today.getFullYear() - birthYear;
  // 생일이 아직 안 지났으면 -1
  if (
    today.getMonth() + 1 < birthMonth ||
    (today.getMonth() + 1 === birthMonth && today.getDate() < birthDay)
  ) {
    age--;
  }
  return age;
}

/**
 * @deprecated 만 나이로 전환되었습니다. getInternationalAge 사용 권장
 */
export function getKoreanAge(birthYear: number): number {
  if (!birthYear || birthYear <= 0) return 0;
  return new Date().getFullYear() - birthYear + 1;
}