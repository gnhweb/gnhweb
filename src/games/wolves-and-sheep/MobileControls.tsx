import { useEffect, useRef, useState, type PointerEvent } from "react";
import Phaser from "phaser";
import { PRESS_FX, POP_IN_STYLE } from "./uiFeedback";

/** 짧은 진동 피드백. iOS Safari 등 미지원 환경에서는 조용히 무시된다. */
function vibrate(ms: number) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      // 일부 브라우저는 사용자 제스처 밖에서 호출 시 예외를 던지기도 하므로 무시한다.
    }
  }
}

/**
 * 모바일 터치 조작 오버레이.
 * - 왼쪽: 가상 조이스틱 (드래그한 방향/거리를 -1~1 벡터로 정규화해 Phaser 씬에 전달)
 * - 오른쪽: 상황별 액션 버튼 (MainScene이 emit하는 "mobile-prompt" 이벤트를 그대로 보여주고,
 *   탭하면 "mobile-action" 이벤트로 동일한 type을 돌려보내 스페이스바/K/B/R/V/H를 대신함)
 *
 * 실제 이동/액션 로직은 MainScene.ts에 있고, 이 컴포넌트는 game.events를 통해
 * 입력을 전달하는 얇은 UI 레이어일 뿐이다.
 */
export function MobileControls({ game }: { game: Phaser.Game }) {
  const [prompt, setPrompt] = useState<{ label: string; type: string }>({ label: "", type: "" });

  useEffect(() => {
    const onPrompt = (data: { label: string; type: string }) => setPrompt(data);
    game.events.on("mobile-prompt", onPrompt);
    return () => {
      game.events.off("mobile-prompt", onPrompt);
    };
  }, [game]);

  return (
    <div className="absolute inset-0 pointer-events-none select-none touch-none">
      <FloatingJoystick game={game} />
      {prompt.type && (
        <button
          // key를 프롬프트 종류로 바꿔 상황이 바뀔 때마다(예: 이동 프롬프트→신고 프롬프트) 버튼을
          // 새로 마운트시켜서 팝인 애니메이션이 매번 다시 재생되게 한다 — 즉시 나타나던 것을
          // 페이드+스케일로 부드럽게 바꿔 어떤 행동이 가능해졌는지 눈에 잘 띄게 함.
          key={prompt.type}
          onPointerDown={(e) => {
            e.preventDefault();
            vibrate(15);
            game.events.emit("mobile-action", prompt.type);
          }}
          // safe-area 여백을 더해 노치/제스처 바 기기에서도 버튼이 화면 끝에 붙거나
          // 시스템 제스처 영역과 겹치지 않게 한다. 미니맵 버튼을 상단으로 옮겼으므로
          // (MiniMap.tsx 참고) 더 이상 겹칠 걱정 없이 우하단을 이 버튼 전용으로 쓴다.
          style={{
            bottom: "calc(2rem + env(safe-area-inset-bottom, 0px))",
            right: "calc(1.5rem + env(safe-area-inset-right, 0px))",
            ...POP_IN_STYLE,
          }}
          className={`absolute pointer-events-auto cursor-pointer
                     max-w-[150px] rounded-full bg-indigo-600/90 active:bg-indigo-400
                     text-white text-xs font-medium px-4 py-4 shadow-lg border border-indigo-300/40
                     leading-tight text-center z-10 ${PRESS_FX}`}
        >
          {formatMobileLabel(prompt.label)}
        </button>
      )}
    </div>
  );
}

// 프롬프트 텍스트 앞의 "OO키로 " 안내 문구는 키보드 전용이라 모바일 버튼에선 떼어내고 보여준다.
const KEY_PREFIXES = ["스페이스바로 ", "스페이스바 ", "K키로 ", "B키로 ", "R키로 ", "V키로 ", "H키로 "];
function formatMobileLabel(label: string): string {
  for (const prefix of KEY_PREFIXES) {
    if (label.startsWith(prefix)) return label.slice(prefix.length);
  }
  return label;
}

const JOYSTICK_RADIUS = 46;
// 터치 시작 지점을 조이스틱 중심으로 삼는 "플로팅" 방식이라, 실제 반응 영역은
// 화면 좌하단의 넓은 구역 전체다(고정된 92px짜리 원 안이 아님). 화면 폭/높이의
// 이 비율만큼을 히트 영역으로 잡는다 — 왼손 엄지가 어디를 짚어도 조이스틱이 뜬다.
const ZONE_WIDTH_RATIO = 0.55;
const ZONE_HEIGHT_RATIO = 0.6;
// 조이스틱이 화면 가장자리에 붙어 잘리지 않도록, 터치 지점을 이만큼 안쪽으로 clamp한다.
const EDGE_MARGIN = JOYSTICK_RADIUS * 1.3;

function FloatingJoystick({ game }: { game: Phaser.Game }) {
  const zoneRef = useRef<HTMLDivElement>(null);
  // origin === null → 아직 터치 안 함(조이스틱 숨김). 터치 시작 지점(뷰포트 좌표)이 origin이 된다.
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const activePointerId = useRef<number | null>(null);

  const updateVector = (dx: number, dy: number) => {
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, JOYSTICK_RADIUS);
    const angle = Math.atan2(dy, dx);
    const kx = Math.cos(angle) * clamped;
    const ky = Math.sin(angle) * clamped;
    setKnob({ x: kx, y: ky });
    // 데드존(살짝 건드린 정도는 무시) 적용 후 -1~1로 정규화
    const norm = clamped < 8 ? 0 : clamped / JOYSTICK_RADIUS;
    game.events.emit("mobile-move", {
      x: norm === 0 ? 0 : (kx / clamped) * norm,
      y: norm === 0 ? 0 : (ky / clamped) * norm,
    });
  };

  const reset = () => {
    activePointerId.current = null;
    setOrigin(null);
    setKnob({ x: 0, y: 0 });
    game.events.emit("mobile-move", { x: 0, y: 0 });
  };

  const onPointerDown = (e: PointerEvent) => {
    if (activePointerId.current !== null) return; // 멀티터치로 두 번째 손가락이 들어오면 무시
    e.preventDefault();
    vibrate(8);
    activePointerId.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const rect = zoneRef.current!.getBoundingClientRect();
    setOrigin({
      x: Math.min(Math.max(e.clientX, rect.left + EDGE_MARGIN), rect.right - EDGE_MARGIN),
      y: Math.min(Math.max(e.clientY, rect.top + EDGE_MARGIN), rect.bottom - EDGE_MARGIN),
    });
    setKnob({ x: 0, y: 0 });
  };

  const onPointerMove = (e: PointerEvent) => {
    if (activePointerId.current !== e.pointerId || !origin) return;
    e.preventDefault();
    updateVector(e.clientX - origin.x, e.clientY - origin.y);
  };

  const onPointerUp = (e: PointerEvent) => {
    if (activePointerId.current !== e.pointerId) return;
    e.preventDefault();
    reset();
  };

  return (
    <div
      ref={zoneRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      // 시각적으로는 아무것도 없는 넓은 터치 감지 영역. 조이스틱 자체는 origin이
      // 생긴 뒤에만 그 지점에 렌더링된다.
      className="absolute left-0 bottom-0 pointer-events-auto touch-none"
      style={{ width: `${ZONE_WIDTH_RATIO * 100}%`, height: `${ZONE_HEIGHT_RATIO * 100}%` }}
    >
      {origin && (
        <>
          <div
            className="fixed rounded-full bg-white/10 border border-white/25"
            style={{
              left: origin.x - JOYSTICK_RADIUS,
              top: origin.y - JOYSTICK_RADIUS,
              width: JOYSTICK_RADIUS * 2,
              height: JOYSTICK_RADIUS * 2,
            }}
          />
          <div
            className="fixed w-9 h-9 rounded-full bg-indigo-400/90 border border-indigo-200/60"
            style={{
              left: origin.x + knob.x - 18,
              top: origin.y + knob.y - 18,
            }}
          />
        </>
      )}
    </div>
  );
}