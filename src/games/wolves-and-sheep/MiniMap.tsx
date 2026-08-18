import { useEffect, useRef, useState } from "react";
import type Phaser from "phaser";
import { GameManager } from "./GameManger";
import { WORLD_W, WORLD_H } from "./types";
import { findCurrentRoom, MapBackground } from "./mapUtils";
import { PRESS_FX, POP_IN_STYLE } from "./uiFeedback";
import { playPanelToggle } from "./soundManager";

/** 다른 인게임 HUD(AdminMap/SecurityCameras)와 동일한 패턴 — gm.me의 최신 좌표를 따라가도록
 * 일정 주기로 리렌더시킨다. 매 "player-moved" 브로드캐스트마다 리렌더하면 너무 잦으므로
 * (다른 사람이 움직여도 이벤트가 오는 구조) 폴링 방식을 그대로 따른다. */
function usePoll(intervalMs: number) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

const POLL_MS = 250;
/** 이 거리 이상 움직였을 때만 방향(각도)을 다시 계산한다 — 제자리에서 미세하게
 * 흔들리는 좌표 노이즈로 화살표가 파르르 떠는 것을 막기 위함. */
const HEADING_MOVE_THRESHOLD = 4;

/**
 * 6-2. 인게임 HUD & 미니맵.
 * 항상 화면 우상단에 작게 떠 있다가, 탭하면 부드러운 스케일 트랜지션으로 커진다
 * (기존에는 즉시 전환이라 딱딱하게 느껴졌던 지점 — CosmeticPanel/GameSettingsPanel과
 * 동일한 POP_IN_STYLE을 재사용해 다른 패널과 확장 연출의 결을 맞췄다).
 * 내 위치는 화살표 마커로 표시하고, 최근 이동 방향으로 부드럽게 회전시켜
 * "바라보는 각도"를 체감할 수 있게 한다.
 * 방 이름은 접힌 상태에서도 옆에 항상 노출해, 미니맵을 펼치지 않아도 위치를 인지할 수 있게 했다.
 */
export function MiniMap({ gm, game }: { gm: GameManager; game?: Phaser.Game | null }) {
  usePoll(POLL_MS);
  const [open, setOpen] = useState(false);
  const headingRef = useRef(0); // degrees, 0 = 오른쪽
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const me = gm.me;

  // 회의/로비/결과 화면에서는 다른 풀스크린 UI가 이미 화면을 덮으므로 미니맵은 숨긴다.
  const visible = !!me && gm.phase === "playing";

  useEffect(() => {
    if (!me) return;
    const last = lastPosRef.current;
    if (last) {
      const dx = me.x - last.x;
      const dy = me.y - last.y;
      if (Math.hypot(dx, dy) >= HEADING_MOVE_THRESHOLD) {
        headingRef.current = (Math.atan2(dy, dx) * 180) / Math.PI;
      }
    }
    lastPosRef.current = { x: me.x, y: me.y };
  });

  const toggleOpen = () => {
    setOpen((o) => {
      playPanelToggle(!o);
      return !o;
    });
  };

  // M키로도 미니맵을 켜고 끌 수 있게 한다(MainScene이 "toggle-minimap" 이벤트를 쏨).
  // 마우스로 우상단 버튼을 클릭하려면 이동 중이던 손을 키보드에서 떼야 하는 불편함이
  // 있었는데, 같은 키보드에서 바로 토글되게 해서 이동을 멈추지 않고도 켰다 끌 수 있다.
  useEffect(() => {
    if (!game || !visible) return;
    const onToggle = () => toggleOpen();
    game.events.on("toggle-minimap", onToggle);
    return () => {
      game.events.off("toggle-minimap", onToggle);
    };
  }, [game, visible]);

  if (!visible || !me) return null;

  const room = findCurrentRoom(me.x, me.y);
  const roomLabel = room?.label ?? "복도";

  // 마커를 확대해도 화면 밖으로 새지 않도록 세계 좌표계 기준 삼각형 크기를 정한다.
  const markerLen = Math.max(WORLD_W, WORLD_H) * 0.014;

  const marker = (rotate: number) => (
    <g style={{ transition: "transform 0.3s ease-out" }} transform={`translate(${me.x} ${me.y}) rotate(${rotate})`}>
      <polygon
        points={`${markerLen},0 ${-markerLen * 0.6},${markerLen * 0.65} ${-markerLen * 0.6},${-markerLen * 0.65}`}
        fill="#38bdf8"
        stroke="#0c4a6e"
        strokeWidth={markerLen * 0.18}
      />
    </g>
  );

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        onPointerDown={(e) => {
          // MobileControls의 액션 버튼과 동일한 패턴으로 통일: onClick은 터치 환경에서
          // (특히 다른 손가락으로 조이스틱을 누르고 있는 멀티터치 중에) 합성 클릭 이벤트가
          // 늦게 오거나 씹히는 경우가 있어, onPointerDown으로 눌리는 즉시 반응하게 했다.
          e.preventDefault();
          toggleOpen();
        }}
        className={`flex items-center gap-1.5 bg-gray-900/90 border border-gray-700 rounded-full pl-2.5 pr-1 py-1 cursor-pointer touch-manipulation ${PRESS_FX}`}
      >
        <span className="text-xs text-white font-medium max-w-[38vw] truncate">📍 {roomLabel}</span>
        <span
          className="text-[10px] text-gray-400 w-5 h-5 flex items-center justify-center"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease-out" }}
        >
          ▾
        </span>
      </button>

      {/* 버그 수정(UI 겹침): 예전엔 접힌 상태에서도 104×104 정사각 지도 미리보기를 항상
          코너에 띄워뒀는데, 세로 폭이 짧은 모바일 가로모드 화면에서는 이 미리보기가
          우상단 HUD 묶음(미션 진행도/생존/능력 버튼) 아래로 늘어지면서 우하단의 모바일
          액션 버튼(예: "덕트 안으로 이동")과 겹쳐버렸다. 방 이름은 이미 위 알약(pill)
          버튼에 항상 떠 있으므로, 접힌 상태에서는 이 미리보기를 없애 겹침 자체를
          원천적으로 막는다 — 실제 지도는 알약을 탭해 펼친 화면(아래)에서 크게 볼 수 있다. */}

      {/* 펼친 상태 — 화면 정중앙에 고정 오버레이로 띄운다. 뷰포트 가로/세로 중 짧은 쪽
          기준으로 크기를 잡아서(vw·vh 둘 다 제한) 어떤 화면 비율에서도 절대 잘리지 않는다.
          버그 수정(흐릿함): 예전엔 폭·높이를 똑같이 min(88vw,88dvh,480px)로 강제해서
          정사각형 박스에 넣었는데, 실제 지도 비율(WORLD_W:WORLD_H = 9:7)은 정사각형이
          아니라서 SVG가 레터박스(위아래 여백)로 축소 렌더링되어 그만큼 글자·선이 작고
          흐릿하게 보였다(AdminMap/CCTV실 패널에서 이미 같은 원인으로 고쳤던 문제와 동일).
          이제 지도 실제 비율대로 폭을 계산해서(aspectRatio와 함께) 레터박스 없이 박스를
          꽉 채우도록 한다. */}
      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 pointer-events-auto"
          // 버그 수정: 이동 중(왼손 엄지가 조이스틱을 누르고 있는 멀티터치 상태)에 이 배경을
          // 탭해서 미니맵을 닫으려 하면 onClick(합성 클릭 이벤트)이 늦게 오거나 아예 씹히는
          // 경우가 있었다 — 여는 버튼(위 toggleOpen 버튼)은 이미 onPointerDown으로 고쳐져
          // 있었는데 닫는 배경만 그대로 onClick이었다. 동일하게 onPointerDown으로 맞춘다.
          onPointerDown={(e) => {
            e.preventDefault();
            toggleOpen();
          }}
        >
          <div
            className="bg-gray-900/95 border border-gray-700 rounded-xl overflow-hidden shadow-2xl"
            style={{
              width: `min(92vw, calc(88dvh * ${WORLD_W} / ${WORLD_H}), 480px)`,
              aspectRatio: `${WORLD_W} / ${WORLD_H}`,
              ...POP_IN_STYLE,
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <svg
              viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
              className="w-full h-full block"
              shapeRendering="geometricPrecision"
              textRendering="optimizeLegibility"
            >
              <rect x={0} y={0} width={WORLD_W} height={WORLD_H} fill="#0a0a12" />
              <MapBackground highlightIds={new Set(room ? [room.id] : [])} showLabels />
              {marker(headingRef.current)}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}