import { memo } from "react";
import { ROOMS, HALLWAYS, RoomDef } from "./types";

/** 좌표가 어느 방 안에 있는지 찾는다. 방과 방 사이(복도)에 있으면 undefined. */
export function findCurrentRoom(x: number, y: number): RoomDef | undefined {
  return ROOMS.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}

/**
 * 방 id → 구역(zone) 매핑. types.ts의 ROOMS 배열에 달린 "======== ○○ 구역 ========"
 * 주석 그대로 나눈 것으로, 미니맵/관리실/CCTV실에서 구역별로 한 톤씩 입혀 방향감을 주기 위함이다.
 * (ROOMS 자체의 좌표는 건드리지 않고, 시각 표현 레이어에서만 구역을 구분한다)
 */
const ROOM_ZONE: Record<string, string> = {
  hall: "center",
  art1: "north", art2: "north",
  storage4: "south", art3: "south", library: "south",
  kitchen3: "east", piano1: "east", piano2: "east", avroom: "east", lounge: "east",
  storage1: "west", storage2: "west", control: "west", teacher: "west",
  culture: "southwest", kitchen5: "southwest", edu: "southwest",
};

/** 구역별 기본 톤 — 어둡고 채도 낮은 팔레트를 유지하되 구역마다 색상 축을 다르게 줬다. */
const ZONE_TONE: Record<string, string> = {
  center: "#3a3a52",
  north: "#3a2b46",
  south: "#2b3a45",
  east: "#463a2b",
  west: "#33333f",
  southwest: "#2b452f",
};

function zoneToneFor(roomId: string): string {
  const zone = ROOM_ZONE[roomId];
  return (zone && ZONE_TONE[zone]) || "#26263a";
}

/**
 * 방 이름 라벨 폰트 크기(SVG 뷰박스 기준 "월드 단위"). 이전엔 40이었는데, 미니맵처럼
 * 뷰박스(3600×2800)를 100~300px짜리 작은 컨테이너에 욱여넣는 화면에서는 40이 실제
 * 렌더링 시 3~4px밖에 안 나와 한글 획이 다 뭉개져 보였다. 88로 올려서 어떤 컨테이너
 * 크기에서도 최소한의 가독성을 확보한다.
 */
const ROOM_LABEL_FONT_SIZE = 104;
/** 방 폭 대비 라벨이 넘칠 때 압축해서 넣을 최대 비율. 너무 빡빡하면 옆방 라벨과 겹친다. */
const ROOM_LABEL_MAX_WIDTH_RATIO = 0.88;
/** 한 글자당 대략적인 폭 추정치(폰트 크기 대비 비율) — 한글은 정사각형에 가까워 라틴 문자보다 넓다. */
const ROOM_LABEL_CHAR_WIDTH_RATIO = 0.95;

/**
 * 방 + 복도 배경을 그리는 SVG 조각. 미니맵/관리실/CCTV실이 전부 이걸 공유해서 쓴다.
 * highlightIds에 담긴 방은 강조색으로, 나머지는 기본색으로 그린다.
 *
 * [4단계 최적화] React.memo로 감쌌다. MiniMap이 300ms마다 리렌더되는데, 그때마다
 * 방/복도 도형(정적인 내용) 전체를 다시 계산할 필요가 없다 — highlightIds가 실제로
 * 바뀔 때(방을 이동했을 때)만 다시 그리면 된다. 단, 호출 측에서 highlightIds를
 * 매 렌더마다 `new Set(...)`으로 새로 만들면 참조가 계속 바뀌어 memo가 무력화되므로,
 * 호출 측(MiniMap.tsx)에서 useMemo로 참조를 안정시켜야 한다.
 */
export const MapBackground = memo(function MapBackground({
  highlightIds,
  showLabels,
}: {
  highlightIds?: Set<string>;
  showLabels?: boolean;
}) {
  return (
    <>
      {/* 복도 — 예전엔 테두리가 아예 없어서 방과 경계가 흐릿하게 뭉개져 보였다(특히 작은
          컨테이너에 욱여넣는 미니맵/관리실 화면에서 두드러짐). 검은 윤곽선을 둘러서 "벽"
          경계가 뚜렷해지게 했다. strokeWidth는 vectorEffect="non-scaling-stroke"로 화면
          픽셀 기준 고정폭을 쓴다 — 그래야 뷰박스(3600×2800)를 100px짜리 미니맵에 욱여넣든
          600px짜리 관리실 패널에 넣든 항상 같은 두께로, 선명하게 보인다(모바일에서 선이
          0.5px 미만으로 짜부라져 뿌옇게 보이던 문제의 원인이 이거였다). */}
      {HALLWAYS.map((h) => (
        <rect
          key={h.id}
          x={h.x}
          y={h.y}
          width={h.w}
          height={h.h}
          fill="#1c1e30"
          stroke="#05060f"
          strokeWidth={1.4}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {ROOMS.map((r) => {
        const hi = highlightIds?.has(r.id);
        return (
          <rect
            key={r.id}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            rx={8}
            fill={hi ? "#4c4c8a" : zoneToneFor(r.id)}
            stroke={hi ? "#facc15" : "#8b93a8"}
            strokeWidth={hi ? 2.6 : 1.6}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      {showLabels &&
        ROOMS.map((r) => {
          // 방 폭보다 라벨이 넓어질 것 같으면 textLength로 압축해서 옆방 라벨과 겹치지
          // 않게 한다(뭉개짐 방지의 두 번째 축 — 첫 번째는 위의 폰트 크기 상향).
          const maxWidth = r.w * ROOM_LABEL_MAX_WIDTH_RATIO;
          const estWidth = r.label.length * ROOM_LABEL_FONT_SIZE * ROOM_LABEL_CHAR_WIDTH_RATIO;
          const needsCompress = estWidth > maxWidth;
          return (
            <text
              key={`${r.id}-label`}
              x={r.x + r.w / 2}
              y={r.y + r.h / 2}
              fontSize={ROOM_LABEL_FONT_SIZE}
              fontWeight={700}
              fill={highlightIds?.has(r.id) ? "#fef9c3" : "#e2e8f0"}
              stroke="#0f0f1a"
              strokeWidth={3}
              vectorEffect="non-scaling-stroke"
              paintOrder="stroke"
              textAnchor="middle"
              dominantBaseline="middle"
              {...(needsCompress ? { textLength: maxWidth, lengthAdjust: "spacingAndGlyphs" } : {})}
            >
              {r.label}
            </text>
          );
        })}
    </>
  );
});