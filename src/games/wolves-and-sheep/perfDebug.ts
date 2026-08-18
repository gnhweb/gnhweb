import Phaser from "phaser";

/**
 * [1단계 진단용 임시 코드] 렉 원인 분석을 위한 디버그 유틸.
 *
 * - import.meta.env.DEV 에서만 동작하도록 호출부(MainScene)에서 감싸서 쓴다.
 * - 프로덕션 빌드에 영향 주지 않기 위해, 사용이 끝나면(2단계 착수 시) 이 파일과
 *   MainScene의 호출부(logSceneObjectCounts / createFpsOverlay 관련 라인)를 통째로 지워도 된다.
 *
 * 사용법 요약 (README처럼 여기 적어둠):
 * 1) `npm run dev`로 로컬 서버를 띄우고 모바일 기기(또는 Chrome DevTools의
 *    Device Toolbar + CPU 4x~6x throttling)로 게임을 실행한다.
 * 2) 화면 좌상단에 표시되는 오버레이에서 FPS / 오브젝트 개수 / 마스크 오브젝트 개수를 확인한다.
 * 3) 브라우저 주소 끝에 `?nofog=1` 을 붙이고 재접속하면 안개(Fog of War)를 아예 만들지 않는다.
 *    이 상태의 FPS와 평소 FPS를 비교하면 "안개가 실제로 얼마나 렉을 유발하는지" 감을 잡을 수 있다.
 * 4) 콘솔(F12 → Console)에는 create() 시점에 오브젝트 종류별 개수가 한 번 표로 출력된다.
 *    이 로그와 오버레이 수치를 그대로 캡처/복사해서 PERF_BASELINE.md에 붙여넣으면 된다.
 */

/** 현재 URL에 ?nofog=1 이 있으면 안개를 생략한다 (임시 A/B 비교용). */
export function isFogDisabledByQuery(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("nofog") === "1";
}

/**
 * 씬에 존재하는 GameObject를 타입별로 집계하고, 그중 마스크(GeometryMask/BitmapMask)가
 * 걸린 오브젝트가 몇 개인지 함께 센다. console.table로 출력하고 결과 객체도 반환한다.
 * (2단계 최적화 전/후 비교의 기준 숫자가 되므로 콘솔 출력 그대로 캡처해두면 좋다.)
 */
export function logSceneObjectCounts(scene: Phaser.Scene, label: string) {
  const counts: Record<string, number> = {};
  let maskedCount = 0;

  const walk = (obj: Phaser.GameObjects.GameObject) => {
    const type = obj.constructor?.name ?? "Unknown";
    counts[type] = (counts[type] ?? 0) + 1;
    // Container/Rectangle 등 mask 프로퍼티가 있는 경우만 체크 (없으면 undefined)
    const maybeMasked = obj as unknown as { mask?: unknown };
    if (maybeMasked.mask) maskedCount++;
    if (obj instanceof Phaser.GameObjects.Container) {
      obj.list.forEach((child) => walk(child as Phaser.GameObjects.GameObject));
    }
  };

  scene.children.list.forEach((obj) => walk(obj));

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  // eslint-disable-next-line no-console
  console.log(`%c[perfDebug] ${label} — 오브젝트 집계`, "color:#ffd700;font-weight:bold");
  // eslint-disable-next-line no-console
  console.table(counts);
  // eslint-disable-next-line no-console
  console.log(`[perfDebug] 총 GameObject: ${total}개, 마스크(mask) 걸린 오브젝트: ${maskedCount}개`);

  return { counts, total, maskedCount };
}

/**
 * 화면 좌상단에 고정된(scrollFactor 0) 디버그 텍스트를 만들어 매 프레임 FPS를 갱신한다.
 * MainScene의 update(time) 안에서 overlay.refresh(time) 를 호출해줘야 한다.
 */
export function createFpsOverlay(scene: Phaser.Scene, extraStaticInfo: string) {
  const text = scene.add
    .text(8, 8, "", {
      fontSize: "13px",
      color: "#00ff88",
      backgroundColor: "#000000aa",
      padding: { x: 6, y: 4 },
    })
    .setScrollFactor(0)
    .setDepth(9999);

  let lastUpdateMs = 0;

  return {
    text,
    /** update()에서 매 프레임 호출. 너무 자주 문자열을 새로 만들지 않도록 200ms에 한 번만 갱신. */
    refresh(nowMs: number) {
      if (nowMs - lastUpdateMs < 200) return;
      lastUpdateMs = nowMs;
      const fps = scene.game.loop.actualFps.toFixed(1);
      const fogState = isFogDisabledByQuery() ? "OFF (?nofog=1)" : "ON";
      text.setText(
        `FPS: ${fps}\n안개: ${fogState}\n${extraStaticInfo}`
      );
    },
  };
}