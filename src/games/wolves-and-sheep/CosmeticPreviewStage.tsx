import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { createBeanSprite, applyWalkAnim, BeanCosmetics } from "./BeanCharacter";

const STAGE_W = 160;
const STAGE_H = 160;
/** 좌우로 돌아서기까지 걷는 시간(ms) — 너무 짧으면 산만하고 길면 심심해서 절충한 값. */
const TURN_INTERVAL_MS = 1400;

/**
 * 6-1: 로비 코스메틱 프리뷰 강화.
 * 기존 CosmeticPanel은 모자/펫을 아이콘 그리드로만 보여줘서 "실제로 착용하면 어떻게
 * 보이는지" 감이 잘 안 왔다. BeanCharacter.ts가 이미 절차적으로 굽는 콩 캐릭터를 그대로
 * 재사용해, 미리보기 전용 미니 Phaser 인스턴스 하나를 별도로 띄우고 캐릭터가 제자리에서
 * 계속 걸으며 주기적으로 좌우 방향을 바꾸는 작은 "스테이지"를 만든다.
 * MainScene의 성능 규칙(PERFORMANCE_GUIDELINES.md)은 실제 플레이 화면 기준이라
 * 로비의 미리보기 인스턴스 하나에는 해당 사항이 없다.
 */
export function CosmeticPreviewStage({ id, cosmetics }: { id: string; cosmetics: BeanCosmetics }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let container: Phaser.GameObjects.Container | undefined;
    let facing: 1 | -1 = 1;
    let nextTurnAt = 0;

    class PreviewScene extends Phaser.Scene {
      create() {
        container = createBeanSprite(this, STAGE_W / 2, STAGE_H / 2 + 14, id, cosmetics);
        nextTurnAt = this.time.now + TURN_INTERVAL_MS;
      }
      update(time: number) {
        if (!container) return;
        if (time >= nextTurnAt) {
          facing = facing === 1 ? -1 : 1;
          nextTurnAt = time + TURN_INTERVAL_MS;
        }
        applyWalkAnim(container, true, facing, time);
      }
    }

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: STAGE_W,
      height: STAGE_H,
      parent: host,
      transparent: true,
      scene: PreviewScene,
    });

    return () => {
      game.destroy(true);
    };
    // 모자/펫이 바뀔 때만 스테이지를 다시 만든다 — 탭 전환 등 다른 리렌더에는 영향받지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, cosmetics.hat, cosmetics.pet]);

  return (
    <div
      ref={hostRef}
      className="mx-auto rounded-xl bg-gradient-to-b from-gray-800/70 to-gray-900/70 border border-gray-700 overflow-hidden"
      style={{ width: STAGE_W, height: STAGE_H }}
    />
  );
}