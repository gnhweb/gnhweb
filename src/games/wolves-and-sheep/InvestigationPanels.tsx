import { useEffect, useState } from "react";
import { GameManager } from "./GameManger";
import { ROOMS, WORLD_W, WORLD_H } from "./types";
import { findCurrentRoom, MapBackground } from "./mapUtils";
import { POP_IN_STYLE } from "./uiFeedback";

/** 지도 실제 비율(3600:2800 = 9:7)로 맞춘 CSS aspect-ratio 값. 이전엔 이 값 없이
 * "aspect-[47/33]"(≈1.42)로 고정돼 있어 실제 지도 비율(≈1.29)과 어긋났다 — SVG가
 * 기본 preserveAspectRatio(xMidYMid meet) 때문에 컨테이너 안에서 레터박스로 축소
 * 렌더링되어, 특히 화면이 작은 모바일에서 지도가 실제보다 작고 흐릿하게 보이는
 * 원인이었다. 비율을 맞추면 컨테이너를 꽉 채워 그만큼 더 크고 선명하게 그려진다. */
const MAP_ASPECT_RATIO = `${WORLD_W} / ${WORLD_H}`;

/** 관리실(어몽어스 Admin) 역할을 하는 방. "The Skeld" 스타일 재설계 이후 관리실(teacher) 방을 그대로 쓴다. */
const ADMIN_ROOM_ID = "teacher";
/** CCTV실(어몽어스 Cameras) 역할을 하는 방. 새 레이아웃에서도 CCTV실(avroom) 그대로 유지. */
const CAMERA_ROOM_ID = "avroom";
/** CCTV가 실제로 비추는 구역 — 지도 전체가 아니라 기도실(허브)과 각 구역 초입 한 곳씩만 감시한다.
 * (어몽어스 카메라도 맵 전체가 아니라 지정된 방들만 비추는 것과 동일한 설계)
 * 재설계 전 id(lobby1/piano3/art4)가 새 레이아웃(hall/piano1/art1)에서 존재하지 않아
 * 최종 점검 중 목록이 비어 있던 문제를 발견해 새 방 id로 갱신했다. */
const MONITORED_ROOM_IDS = ["hall", "storage1", "piano1", "storage4", "culture", "art1"];

/** 일정 주기로 리렌더시켜서 gm.me/gm.players의 최신 좌표를 따라가게 한다(다른 HUD와 동일한 패턴). */
function usePoll(intervalMs: number) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

/** 관리실/CCTV실 어디에서도 절대 잡히지 않는 사람: 사망자, 숨어있는 사람.
 * (하이딩 기능의 의미를 지키기 위해 두 시스템 모두 동일한 필터를 쓴다) */
function detectablePlayers(gm: GameManager) {
  const list: { id: string; name: string; x: number; y: number }[] = [];
  gm.players.forEach((p, id) => {
    if (!p.alive || p.hidden) return;
    list.push({ id, name: p.name, x: p.x, y: p.y });
  });
  return list;
}

/**
 * 🖥️ 관리실 — 어몽어스 Admin Table처럼, 이 방에 들어와 있는 동안 전체 지도 위에
 * 감지된 인원의 위치와 이름표가 실시간으로 뜬다. "누가 지금 어디 있는지" 한눈에 파악해서
 * 알리바이를 맞춰보거나 의심스러운 동선을 잡아낼 수 있다.
 */
export function AdminMap({ gm }: { gm: GameManager }) {
  usePoll(350);
  const me = gm.me;
  const myRoom = me ? findCurrentRoom(me.x, me.y) : null;
  const inRoom = myRoom?.id === ADMIN_ROOM_ID;

  // 버그 수정(관리실에서 나갈 수 없음): 예전엔 이 방에 있는 동안 화면 전체를 덮는 딤 배경이
  // pointer-events-auto로 항상 떠 있어서, 캐릭터를 움직이는 조작(가상 조이스틱/클릭 이동 등)이
  // 전부 이 오버레이에 막혔다 — 방을 나가지 않는 한 빠져나올 방법이 없었다. 미니맵의
  // "펼치기/접기" 패턴과 동일하게 열림 상태를 자체 관리해서, 방에 처음 들어올 때는 자동으로
  // 펼쳐 보여주되 닫기 버튼/배경 탭으로 언제든 끄고(=조작 가능), 방을 나가지 않은 채로도
  // 작은 재열기 버튼으로 다시 켤 수 있게 했다.
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (inRoom) setOpen(true);
  }, [inRoom]);

  if (!me || !inRoom) return null;

  if (!open) {
    return (
      <button
        onPointerDown={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        style={{ top: "calc(0.5rem + env(safe-area-inset-top, 0px))" }}
        className="fixed left-1/2 -translate-x-1/2 z-40 bg-gray-900/90 border border-gray-600 rounded-full px-3 py-1.5 text-white text-xs cursor-pointer pointer-events-auto"
      >
        🖥️ 관리실 화면 다시 보기
      </button>
    );
  }

  const players = detectablePlayers(gm);

  return (
    // 버그 수정(모바일/작은 화면 UI 잘림):
    // 예전엔 top: 12rem 같은 고정 오프셋 + calc(100dvh - 13rem)로 높이를 억지로 맞췄는데,
    // 화면이 낮은 기기(가로모드 폰, 좁은 미리보기 프레임 등)에서는 그 고정값이 실제 남은
    // 공간보다 커서 패널이 화면 아래로 반쯤 잘려나갔다(위쪽은 시작 지점부터 이미 밀려있고,
    // 아래쪽은 계산된 높이가 실제 뷰포트를 넘어섬). MeetingModal/미니맵 펼침 화면과 동일하게
    // "화면 전체를 덮는 딤 배경 + flex 중앙 정렬" 패턴으로 바꿔서, 화면 크기가 어떻든 항상
    // 뷰포트 안에 온전히 들어오고, 내용이 넘치면 패널 자체가 스크롤되게 했다.
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 pointer-events-auto"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-gray-900/95 border border-gray-600 rounded-xl p-3 w-[min(96vw,720px)] max-h-[85dvh] overflow-y-auto"
        style={POP_IN_STYLE}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-white font-semibold">🖥️ 관리실 — 실시간 인원 현황</p>
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              setOpen(false);
            }}
            className="text-gray-400 hover:text-white text-sm leading-none px-1.5 py-0.5 cursor-pointer"
          >
            ✕
          </button>
        </div>
        <div className="w-full rounded-lg overflow-hidden bg-black/40" style={{ aspectRatio: MAP_ASPECT_RATIO }}>
          <svg viewBox={`0 0 ${WORLD_W} ${WORLD_H}`} className="w-full h-full block">
            <rect x={0} y={0} width={WORLD_W} height={WORLD_H} fill="#0a0a12" />
            <MapBackground highlightIds={new Set([ADMIN_ROOM_ID])} showLabels />
            {players.map((p) => (
              <g key={p.id}>
                <circle cx={p.x} cy={p.y} r={26} fill="#34d399" stroke="#064e3b" strokeWidth={5} />
                <text x={p.x} y={p.y - 36} fontSize={22} fill="#d1fae5" textAnchor="middle" fontWeight="bold">
                  {p.name}
                </text>
              </g>
            ))}
          </svg>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          사망했거나 숨어있는 인원은 잡히지 않습니다. ({players.length}명 감지됨)
        </p>
      </div>
    </div>
  );
}

/**
 * 📹 CCTV실 — 어몽어스 Cameras처럼, 이 방에 들어와 있는 동안 지정된 구역 몇 곳의
 * 화면이 작은 격자로 뜬다. 관리실과 달리 지도 전체가 아니라 정해진 구역만 보여서,
 * "그 시간에 그 구역 카메라에 아무도 안 찍혔는데?" 같은 알리바이 추궁이 가능해진다.
 */
export function SecurityCameras({ gm }: { gm: GameManager }) {
  usePoll(350);
  const me = gm.me;
  const myRoom = me ? findCurrentRoom(me.x, me.y) : null;
  const inRoom = myRoom?.id === CAMERA_ROOM_ID;

  // 버그 수정(CCTV실에서 나갈 수 없음): AdminMap과 동일한 원인 — 딤 배경이 항상 조작을
  // 가로채서 방을 나가지 않는 한 빠져나올 방법이 없었다. 같은 열림/닫힘 토글 패턴을 적용.
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (inRoom) setOpen(true);
  }, [inRoom]);

  if (!me || !inRoom) return null;

  if (!open) {
    return (
      <button
        onPointerDown={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        style={{ top: "calc(0.5rem + env(safe-area-inset-top, 0px))" }}
        className="fixed left-1/2 -translate-x-1/2 z-40 bg-gray-900/90 border border-gray-600 rounded-full px-3 py-1.5 text-white text-xs cursor-pointer pointer-events-auto"
      >
        📹 CCTV 화면 다시 보기
      </button>
    );
  }

  const players = detectablePlayers(gm);

  return (
    // 버그 수정(모바일/작은 화면 UI 잘림): AdminMap과 동일하게, 고정 오프셋(top: 12rem) 방식을
    // 버리고 화면 전체를 덮는 딤 배경 + flex 중앙 정렬로 바꿔서 어떤 화면 크기에서도 패널
    // 전체가 항상 뷰포트 안에 보이게 했다(넘치면 패널 자체가 스크롤).
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 pointer-events-auto"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-gray-900/95 border border-gray-600 rounded-xl p-3 w-[min(96vw,720px)] max-h-[85dvh] overflow-y-auto"
        style={POP_IN_STYLE}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-white font-semibold">📹 CCTV실 — 지정 구역 감시 화면</p>
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              setOpen(false);
            }}
            className="text-gray-400 hover:text-white text-sm leading-none px-1.5 py-0.5 cursor-pointer"
          >
            ✕
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MONITORED_ROOM_IDS.map((roomId) => {
            const room = ROOMS.find((r) => r.id === roomId);
            if (!room) return null;
            const here = players.filter(
              (p) => p.x >= room.x && p.x <= room.x + room.w && p.y >= room.y && p.y <= room.y + room.h
            );
            return (
              <div key={roomId} className="bg-black/60 border border-gray-700 rounded-lg overflow-hidden">
                <div className="aspect-square relative">
                  <svg viewBox={`${room.x} ${room.y} ${room.w} ${room.h}`} className="w-full h-full block">
                    <rect x={room.x} y={room.y} width={room.w} height={room.h} fill="#15151f" />
                    {here.map((p) => (
                      <circle
                        key={p.id}
                        cx={p.x}
                        cy={p.y}
                        r={room.w * 0.05}
                        fill="#34d399"
                        stroke="#064e3b"
                        strokeWidth={room.w * 0.012}
                      />
                    ))}
                  </svg>
                  <div className="absolute top-1 left-1 text-xs bg-black/70 text-rose-400 px-1 rounded font-bold">
                    ● REC
                  </div>
                </div>
                <p className="text-xs text-gray-300 text-center py-0.5">
                  {room.label}
                  {here.length > 0 ? ` (${here.length})` : ""}
                </p>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-2">사망했거나 숨어있는 인원, 지정되지 않은 구역은 화면에 잡히지 않습니다.</p>
      </div>
    </div>
  );
}