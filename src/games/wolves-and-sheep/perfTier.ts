/**
 * [3단계 최적화] 기기 성능 티어 판정 유틸.
 *
 * 판정은 2단계로 이루어진다.
 *  1) 1차(즉시) — create() 시작 시점에 navigator.hardwareConcurrency,
 *     devicePixelRatio, WebGL 지원 여부(렌더러 폴백)만으로 추정한다.
 *     아직 실제로 렉이 나는지 모르는 상태라 다소 보수적으로("애매하면 low") 판단한다.
 *  2) 2차(실측) — 실제 플레이 중 5초간 FPS를 모아서, 그래도 느리면 저사양으로
 *     "강등"한다. 반대로 고사양으로 "승급"은 하지 않는다 — 초반 5초만 우연히
 *     빨랐다가 이후 렉이 나면 저사양 대응이 늦게 걸리는 쪽이 더 나쁘기 때문에,
 *     한쪽 방향(빠름→느림)으로만 움직이도록 보수적으로 설계했다.
 *
 * MainScene은 이 판정 결과(lowSpecMode)로 다음을 조절한다:
 *  - 안개(Fog of War) 갱신을 격프레임으로 (RoomDecor/MainScene 쪽 로직)
 *  - 킬 이펙트 파티클 개수 절반, 카메라 shake 생략 (BeanCharacter.spawnKillPoof)
 *  - 정지 캐릭터의 "숨쉬기" 스케일 애니메이션 생략 (BeanCharacter.applyWalkAnim)
 *  - 화면 밖 캐릭터 위치 보간 빈도를 더 낮춤 (MainScene.update)
 */

export type PerfTier = "high" | "low";

export interface TierEstimate {
  tier: PerfTier;
  reason: string;
}

/**
 * URL 쿼리로 강제 지정한다 (테스트/QA용).
 * `?lowspec=1` → 무조건 저사양 모드로 시작, `?highspec=1` → 무조건 고사양 모드로 시작.
 * 둘 다 없으면 null을 반환하고 estimateInitialTier()가 스펙 기반으로 판단한다.
 */
export function tierOverrideFromQuery(): PerfTier | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  if (q.get("lowspec") === "1") return "low";
  if (q.get("highspec") === "1") return "high";
  return null;
}

/**
 * 1차 추정: 기기 스펙만으로 판단한다 (게임 시작 즉시, FPS 측정 없이 가능).
 * - CPU 코어 수가 적을수록(≤4) 저사양일 확률이 높다.
 * - devicePixelRatio가 매우 높으면(≥3) 실제 렌더링 해상도가 커져서 같은 코드라도
 *   GPU 드로우 비용이 커진다.
 * 둘 중 하나라도 저사양 신호면 보수적으로 "low"로 판단한다 — 과대추정으로 화질이
 * 살짝 아쉬워지는 것보다, 렉을 놓치는 쪽이 사용자 체감에 더 나쁘다.
 */
export function estimateInitialTier(): TierEstimate {
  const override = tierOverrideFromQuery();
  if (override) {
    const flag = override === "low" ? "lowspec" : "highspec";
    return { tier: override, reason: `쿼리 강제 지정(?${flag}=1)` };
  }

  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  if (cores <= 4 || dpr >= 3) {
    return { tier: "low", reason: `hardwareConcurrency=${cores}, devicePixelRatio=${dpr}` };
  }
  return { tier: "high", reason: `hardwareConcurrency=${cores}, devicePixelRatio=${dpr}` };
}

const SAMPLE_WINDOW_MS = 5000;
const DOWNGRADE_FPS_THRESHOLD = 40;

/**
 * 2차 판정: 실제 플레이 중 FPS를 모아서 평균이 낮으면 저사양으로 강등할지 결정한다.
 * MainScene.update(time)에서 매 프레임 sample()을 호출하면 되고, 5초가 지나면 딱 한 번
 * true/false를 반환한다(이후로는 계속 false). true가 나오면 그 즉시 lowSpecMode를 켜면 된다.
 */
export class RuntimeFpsSampler {
  private startTime: number | null = null;
  private sum = 0;
  private count = 0;
  private finished = false;

  /** 강등 여부가 이번 호출에서 "막" 결정됐으면 true. 그 외에는 항상 false. */
  sample(time: number, fps: number): boolean {
    if (this.finished) return false;
    if (this.startTime === null) this.startTime = time;
    this.sum += fps;
    this.count += 1;
    if (time - this.startTime < SAMPLE_WINDOW_MS) return false;

    this.finished = true;
    const avg = this.count > 0 ? this.sum / this.count : 60;
    return avg < DOWNGRADE_FPS_THRESHOLD;
  }
}