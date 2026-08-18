export type Role = "sheep" | "wolf" | "shepherd" | "prophet" | "falseProphet" | "intercessor";
export type Phase = "lobby" | "playing" | "meeting" | "ended";
export type TaskType =
  | "typing"
  | "sort"
  | "offering"
  | "wiring"
  | "mixer"
  | "dragdrop"
  | "memory"
  | "timing"
  | "mash"
  | "maze"
  | "match"
  | "quiz"
  | "puzzle"
  | "whack"
  | "balance"
  | "water"
  | "lock"
  | "bells";

export interface PlayerState {
  id: string;
  name: string;
  role: Role;
  alive: boolean;
  x: number;
  y: number;
  tasksCompleted: number;
  hidden: boolean;
  /** 장착한 코스메틱(모자/펫) 텍스처 id — 미장착이면 undefined (cosmetics.ts 참고) */
  hat?: string;
  pet?: string;
}

export interface TaskSpot {
  id: string;
  x: number;
  y: number;
  label: string;
  zone: string;
  type: TaskType;
}

// ---------- 맵 크기 ("The Skeld" 스타일 — 중앙 허브 하나 + 6방향 짧은 복도) ----------
// 이전엔 로비 하나에서 4개의 아치가 제각기 다른 각도로 길게 뻗어나가고, 방마다 좌표가
// 어긋난 채 통로가 2~3번씩 꺾이는 구조였다. 그러다보니 맵이 넓고 산만해서 지금 어디쯤
// 있는지 감이 잘 안 왔다. 지금은 "기도실"(카페테리아 역할) 하나를 지도 정중앙에 두고,
// 거기서 6개의 짧은 복도가 사방으로 곧장 뻗어나가 각 구역(2~3개 방 클러스터)의 첫 방과
// 바로 연결되게 다시 짰다. 어느 방에서 출발해도 중앙 방까지 2~3번의 꺾임 안에 닿을 수
// 있고, 좌우/상하로 거의 대칭이라 지도를 한 번 보면 위치 감각이 잡힌다. 그 위에 완전한
// 트리 구조를 피하기 위해 서로 다른 구역끼리 바로 잇는 우회 루프를 3개 깔아서, 늑대에게
// 쫓길 때 다른 길로 돌아나갈 수 있게 했다.
export const WORLD_W = 3600;
export const WORLD_H = 2800;
export const WALL_THICKNESS = 10;

// ---------- 구역 안내 (중앙 기도실을 중심으로 6방향에 뻗은 구역) ----------
export interface FloorDef {
  floor: number;
  yStart: number;
  yEnd: number;
  label: string;
}
export const FLOORS: FloorDef[] = [
  { floor: 1, yStart: 250, yEnd: 950, label: "미술관 구역" },
  { floor: 2, yStart: 750, yEnd: 1700, label: "중앙·관리 구역" },
  { floor: 3, yStart: 1550, yEnd: 2250, label: "창고·도서 구역" },
  { floor: 4, yStart: 2050, yEnd: 2750, label: "문화·교육 구역" },
];

/** 각 복도 입구에 표시하는 안내판 텍스트 */
export interface FloorLanding {
  x: number;
  y: number;
  label: string;
}
export const FLOOR_LANDINGS: FloorLanding[] = [
  { x: 1800, y: 900, label: "미술관 구역" },
  { x: 1800, y: 1720, label: "창고·도서 구역" },
  { x: 2300, y: 1400, label: "음악·주방 구역" },
  { x: 900, y: 1420, label: "관리 구역" },
  { x: 900, y: 2050, label: "문화·교육 구역" },
];

// ---------- 맵 구조: 방마다 크기/문 개수를 다르게 설계 ----------
// 방 사이 빈 공간(중앙 허브 통로)은 벽으로 막지 않고 실제 복도로 취급하는 개방 공간이다.
// 문(door)은 각 방에 실제로 출입 가능한 지점만 뚫어 두었다.
export interface RoomDoor {
  side: "top" | "bottom" | "left" | "right";
  at: number; // top/bottom 문: 절대 x 시작좌표, left/right 문: 절대 y 시작좌표
  size: number;
}
export interface RoomDef {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  doors: RoomDoor[];
  color: number;
}

export const ROOMS: RoomDef[] = [
  // ======== 기도실(중앙 허브) — 6방향으로 짧은 복도가 뻗어나가는 지도의 심장부 ========
  { id: "hall", label: "기도실", x: 1450, y: 1170, w: 700, h: 460, doors: [
    { side: "top", at: 1740, size: 120 },
    { side: "bottom", at: 1740, size: 120 },
    { side: "left", at: 1330, size: 140 },
    { side: "right", at: 1330, size: 140 },
  ], color: 0x2b2b3a },
  // ======== 북쪽 구역: 미술관 (중앙에서 1번 꺾임으로 바로 도달) ========
  { id: "art1", label: "미술실 1", x: 1610, y: 650, w: 380, h: 280, doors: [
    { side: "bottom", at: 1740, size: 120 },
    { side: "left", at: 680, size: 140 },
  ], color: 0x3a2b4a },
  { id: "art2", label: "음악실", x: 1140, y: 560, w: 380, h: 300, doors: [
    { side: "right", at: 680, size: 140 },
  ], color: 0x2b3a4a },
  // ======== 남쪽 구역: 창고·도서 (문화 구역과 우회 루프로 연결) ========
  { id: "storage4", label: "창고", x: 1610, y: 1870, w: 380, h: 280, doors: [
    { side: "top", at: 1740, size: 120 },
    { side: "left", at: 1980, size: 140 },
    { side: "right", at: 1980, size: 140 },
  ], color: 0x33333f },
  { id: "art3", label: "무용실", x: 1140, y: 1940, w: 380, h: 300, doors: [
    { side: "right", at: 1980, size: 140 },
    { side: "left", at: 2140, size: 100 },
  ], color: 0x4a2b3a },
  { id: "library", label: "도서실", x: 2080, y: 1940, w: 420, h: 300, doors: [
    { side: "left", at: 1980, size: 140 },
    { side: "top", at: 2200, size: 140 },
  ], color: 0x3a2b4a },
  // ======== 동쪽 구역: 음악·주방 (피아노실-CCTV실이 루프로 이어짐) ========
  { id: "kitchen3", label: "주방 1", x: 2450, y: 1250, w: 440, h: 300, doors: [
    { side: "left", at: 1330, size: 140 },
    { side: "top", at: 2600, size: 140 },
    { side: "right", at: 1380, size: 140 },
    { side: "bottom", at: 2700, size: 140 },
  ], color: 0x4a3a2b },
  { id: "piano1", label: "피아노실 1", x: 2540, y: 880, w: 340, h: 300, doors: [
    { side: "bottom", at: 2600, size: 140 },
    { side: "right", at: 920, size: 140 },
  ], color: 0x2f3a2b },
  { id: "piano2", label: "피아노실 2", x: 2980, y: 820, w: 340, h: 280, doors: [
    { side: "left", at: 920, size: 140 },
    { side: "bottom", at: 3050, size: 140 },
  ], color: 0x2f3a2b },
  { id: "avroom", label: "CCTV실", x: 2990, y: 1330, w: 320, h: 280, doors: [
    { side: "left", at: 1380, size: 140 },
    { side: "top", at: 3050, size: 140 },
  ], color: 0x4a2b2b },
  { id: "lounge", label: "휴게실", x: 2650, y: 1650, w: 380, h: 280, doors: [
    { side: "top", at: 2700, size: 140 },
    { side: "left", at: 1750, size: 140 },
  ], color: 0x2b3a4a },
  // ======== 서쪽 구역: 창고·관리 (방재실이 중앙에서 바로 갈라짐) ========
  { id: "storage1", label: "창고 1", x: 800, y: 900, w: 360, h: 300, doors: [
    { side: "bottom", at: 910, size: 140 },
    { side: "left", at: 930, size: 100 },
  ], color: 0x33333f },
  { id: "storage2", label: "창고 2", x: 400, y: 750, w: 360, h: 300, doors: [
    { side: "right", at: 930, size: 100 },
  ], color: 0x33333f },
  { id: "control", label: "방재실", x: 480, y: 1080, w: 300, h: 320, doors: [
    { side: "right", at: 1330, size: 70 },
    { side: "bottom", at: 550, size: 140 },
  ], color: 0x4a2b2b },
  { id: "teacher", label: "관리실", x: 480, y: 1400, w: 320, h: 280, doors: [
    { side: "top", at: 550, size: 140 },
  ], color: 0x2f2b4a },
  // ======== 남서쪽 구역: 문화·교육 (남쪽 구역과 우회 루프로 연결) ========
  { id: "culture", label: "문화방", x: 700, y: 2100, w: 380, h: 300, doors: [
    { side: "right", at: 2140, size: 100 },
    { side: "bottom", at: 850, size: 140 },
    { side: "left", at: 2200, size: 140 },
    { side: "top", at: 1000, size: 140 },
  ], color: 0x2b3a3a },
  { id: "kitchen5", label: "주방 2", x: 780, y: 2470, w: 380, h: 280, doors: [
    { side: "top", at: 850, size: 140 },
  ], color: 0x4a3a2b },
  { id: "edu", label: "교육실", x: 280, y: 2150, w: 380, h: 320, doors: [
    { side: "right", at: 2200, size: 140 },
  ], color: 0x2b4a3a },
];

/** 지금은 격자 슬롯 채움용 필러가 필요 없음. 추후 특정 지점을 막고 싶을 때 사용. */
export const FILLER_WALLS: { x: number; y: number; w: number; h: number }[] = [];

// ---------- 복도(허브) 표시용 시각 요소 ----------
export interface HallwaySeg {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: number;
}
// 기도실에서 6방향으로 뻗은 짧고 곧은 "줄기"(-hub 접미사)가 있고, 대부분 방까지 꺾임
// 없이 1번만 꺾여 바로 이어진다. 그 위에 서로 다른 구역끼리 기도실을 거치지 않고
// 바로 잇는 우회 루프(loop-* 접두사)를 3개 깔아서, 한쪽 길이 막히거나 늑대가 지키고
// 있어도 다른 길로 돌아갈 수 있게 했다.
// 복도 색은 예전엔 전부 0x1c1e30 단일 색이라 어느 구역으로 가는 복도인지 색만 봐서는
// 구분이 안 됐다. FLOOR_LANDINGS/주석에 이미 있던 5구역(미술관/창고·도서/음악·주방/관리/
// 문화·교육) 구분을 복도 타일 색에도 그대로 반영해서, 걷다 보면 색만으로도 대략 어느
// 구역인지 감이 오게 했다. 우회 루프(loop-*)는 구역 색과 겹치지 않는 별도의 골드 톤으로
// 줘서 "지름길"이라는 느낌을 살렸다. 밝기(명도)는 원래 색과 비슷하게 맞춰서 복도다운
// 어두운 톤은 유지하고 색상(hue)만 바꿨다 — RenderTexture 베이킹 방식은 그대로라
// 복도가 몇 개든, 색이 몇 가지든 런타임 프레임 비용에는 전혀 영향이 없다.
const HZ_NORTH = 0x24203a;  // 미술관 구역(art1/art2) 톤 — 보라
const HZ_SOUTH = 0x28242e;  // 창고·도서 구역(storage4/art3/library) 톤 — 무채 보라
const HZ_EAST = 0x2c2820;   // 음악·주방 구역(kitchen3/piano/avroom/lounge) 톤 — 따뜻한 올리브
const HZ_WEST = 0x2a2030;   // 관리 구역(storage1/2/control/teacher) 톤 — 어두운 자주
const HZ_SW = 0x1e2c2c;     // 문화·교육 구역(culture/kitchen5/edu) 톤 — 어두운 청록
const HZ_LOOP = 0x342a1a;   // 우회 루프 — 골드 톤(지름길 표시)

export const HALLWAYS: HallwaySeg[] = [
  { id: "n-hub", x: 1740, y: 930, w: 120, h: 240, color: HZ_NORTH },
  { id: "n-art2", x: 1520, y: 680, w: 90, h: 140, color: HZ_NORTH },
  { id: "s-hub", x: 1740, y: 1630, w: 120, h: 240, color: HZ_SOUTH },
  { id: "s-art3", x: 1520, y: 1980, w: 90, h: 140, color: HZ_SOUTH },
  { id: "s-library", x: 1990, y: 1980, w: 90, h: 140, color: HZ_SOUTH },
  { id: "e-hub", x: 2150, y: 1330, w: 300, h: 140, color: HZ_EAST },
  { id: "e-piano1", x: 2600, y: 1180, w: 140, h: 70, color: HZ_EAST },
  { id: "e-piano2", x: 2880, y: 920, w: 100, h: 140, color: HZ_EAST },
  { id: "e-avroom", x: 2890, y: 1380, w: 100, h: 140, color: HZ_EAST },
  { id: "e-lounge", x: 2700, y: 1550, w: 140, h: 100, color: HZ_EAST },
  { id: "w-hub-a", x: 910, y: 1330, w: 540, h: 140, color: HZ_WEST },
  { id: "w-hub-b", x: 910, y: 1200, w: 140, h: 130, color: HZ_WEST },
  { id: "w-storage2", x: 760, y: 930, w: 40, h: 100, color: HZ_WEST },
  { id: "w-control", x: 780, y: 1330, w: 130, h: 70, color: HZ_WEST },
  { id: "sw-branch", x: 1000, y: 1470, w: 140, h: 630, color: HZ_SW },
  { id: "sw-kitchen5", x: 850, y: 2400, w: 140, h: 70, color: HZ_SW },
  { id: "sw-edu", x: 660, y: 2200, w: 40, h: 140, color: HZ_SW },
  { id: "loop-art3-culture", x: 1080, y: 2140, w: 60, h: 100, color: HZ_LOOP },
  { id: "loop-piano2-avroom", x: 3050, y: 1100, w: 140, h: 230, color: HZ_LOOP },
  { id: "loop-library-lounge-a", x: 2200, y: 1700, w: 140, h: 240, color: HZ_LOOP },
  { id: "loop-library-lounge-b", x: 2200, y: 1750, w: 450, h: 140, color: HZ_LOOP },
];

// 합심 기도(정전 시 스페이스바 연타) 지점 — 원래는 방재실(control) 구석에 처박혀 있었지만,
// 지도 심장부인 기도실(hall, 로비 역할) 정중앙 — 이미 러그가 깔려 있던 그 자리 — 로 옮겨
// 랜드마크로 삼았다. hall = { x:1450, y:1170, w:700, h:460 }이므로 중심은 (1800, 1400).
// [버그 수정] 예전 radius(60)는 촛불 랜드마크가 시각적으로 훨씬 넓게(반경+34까지) 은은한
// 글로우로 번져 있는 것과 비교하면 실제 반응 판정 구역이 너무 좁아서, 눈으로 보기엔 원
// 안에 서 있는 것 같은데도 스페이스바가 반응하지 않는 경우가 많았다(그대로 시간 초과 →
// 늑대 승리로 이어지던 원인 중 하나). 시각 장식이 이 값을 그대로 참조해서 함께 커지므로,
// 반경을 넉넉하게 키워서 눈에 보이는 범위 = 실제 반응 범위가 되도록 맞췄다.
export const PRAYER_ROOM = { x: 1800, y: 1400, radius: 90, label: "기도실" };

// ---------- 정전(보일러/배전) 사보타지 패널 (2인 협동 수리) — 창고 내부 ----------
export const REACTOR_PANELS = {
  left: { x: 1650, y: 1900, label: "왼쪽 패널" },
  right: { x: 1950, y: 1900, label: "오른쪽 패널" },
};
export const REACTOR_PANEL_RADIUS = 40;

// ---------- 촛불 화재 사보타지 (2인 협동 진화) — "방송 장비 오류"를 대체한 새 사보타지.
// 예전 방송 장비 오류는 배수관 파열과 완전히 같은 구조(지도 양 끝 2패널, 스페이스바 1번)라
// 사실상 스킨만 다른 사보타지였다. 촛불 화재는 후보 지점 4곳을 미리 깔아두고, 사보타지가
// 터질 때마다 그중 랜덤으로 2곳만 실제로 불이 붙는다 — 매번 어디가 위험한지 달라지므로
// 외워서 대응할 수 없고, 지도 곳곳을 두리번거리게 만든다. 게다가 패널처럼 스페이스바
// 한 번으로 끝나지 않고, 물을 붓듯 연타(CANDLE_PRESSES_NEEDED번)해야 꺼진다. ----------
export const CANDLE_SPOTS = {
  c1: { x: 1800, y: 790, label: "미술실 촛대" },
  c2: { x: 3150, y: 960, label: "피아노실 2 촛대" },
  c3: { x: 1330, y: 2090, label: "무용실 촛대" },
  c4: { x: 470, y: 2310, label: "교육실 촛대" },
} as const;
export type CandleSpotId = keyof typeof CANDLE_SPOTS;
export const CANDLE_SPOT_IDS = Object.keys(CANDLE_SPOTS) as CandleSpotId[];
export const CANDLE_SPOT_RADIUS = 40;
/** 촛불 하나를 끄는 데 필요한 스페이스바 연타 횟수 */
export const CANDLE_PRESSES_NEEDED = 3;

// ---------- 배수관 파열 사보타지 (2인 협동 수리) — 지도 양 끝(주방 2 ↔ 도서실) ----------
export const PIPE_PANELS = {
  a: { x: 900, y: 2680, label: "주방 2 밸브" },
  b: { x: 2350, y: 2180, label: "도서실 밸브" },
};
export const PIPE_PANEL_RADIUS = 40;
// 버그 수정(비상벨이 촛불 원 밖 위쪽에 떨어져 보임): 예전엔 y가 PRAYER_ROOM보다 200 위였는데,
// 그러면 화면상 비상벨이 기도실 중앙의 촛불 랜드마크와 따로 노는 것처럼 보였다.
// 같은 중심(1800, 1400)으로 맞춰서 "여기가 기도 모임의 중심"이 한 지점으로 보이게 했다.
export const BELL_SPOT = { x: 1800, y: 1400, radius: 55, label: "긴급 비상벨" };

// ---------- 엘리베이터 — 멀리 떨어진 두 구역을 즉시 이동시켜주는 지점 (양/늑대 공용) ----------
export interface ElevatorSpot {
  id: string;
  x: number;
  y: number;
  pairId: string; // 짝을 이루는 반대편 엘리베이터 id
  label: string;
}
export const ELEVATORS: ElevatorSpot[] = [
  { id: "elev-art2", x: 1180, y: 800, pairId: "elev-library", label: "음악실 엘리베이터" },
  { id: "elev-library", x: 2150, y: 2200, pairId: "elev-art2", label: "도서실 엘리베이터" },
  { id: "elev-teacher", x: 650, y: 1550, pairId: "elev-piano2", label: "관리실 엘리베이터" },
  { id: "elev-piano2", x: 3150, y: 950, pairId: "elev-teacher", label: "피아노실 2 엘리베이터" },
];
export const ELEVATOR_INTERACT_RADIUS = 40;
export const ELEVATOR_COOLDOWN_MS = 4000;

// ---------- 비상통로(4단계 스트레치 목표) — 정전 사보타지 중에만 열리는 지름길 ----------
// 평소엔 전자 잠금으로 막혀 있는 배전 통로 문이라 그냥 서 있어도 아무 일도 일어나지 않는다.
// 정전(B키 사보타지)이 발동해 전원이 끊기면 잠금이 풀리며 열리고, 정전이 끝나면(합심 기도로
// 수리되거나 시간 초과) 다시 잠긴다. ELEVATORS와 같은 순간이동 게이트 쌍 방식으로 만들었지만
// 항상 열려 있는 엘리베이터와 달리 정전 중에만 활성화된다는 점이 다르다.
// (실제로 벽에 구멍을 내는 대신 이 방식을 쓴 이유: 맵 바깥벽은 방/복도 배치를 격자로 스캔해
// 자동으로 세워지는 구조라(WallGen.ts) 벽 한 조각만 따로 열고 닫으면 다른 방의 충돌과
// 얽혀 깨질 위험이 있다. 게이트 쌍 방식은 기존 엘리베이터로 이미 검증된 안전한 패턴이다.)
export interface EmergencyPassageGate {
  id: string;
  x: number;
  y: number;
  pairId: string; // 짝을 이루는 반대편 게이트 id
  label: string;
}
export const EMERGENCY_PASSAGE_GATES: EmergencyPassageGate[] = [
  { id: "ep-control", x: 620, y: 1350, pairId: "ep-avroom", label: "방재실 비상통로" },
  { id: "ep-avroom", x: 3260, y: 1360, pairId: "ep-control", label: "CCTV실 비상통로" },
];
export const EMERGENCY_PASSAGE_INTERACT_RADIUS = 40;
export const EMERGENCY_PASSAGE_COOLDOWN_MS = 2500;

// ---------- 미션 20종 위치 (전 구역에 골고루 배치) ----------
// 처음엔 12개였다. 예전엔 미션 없는 방(무용실/피아노실 2/휴게실/창고 2/관리실/주방 2)이
// 6곳이나 비어 있어 그 방들은 그냥 지나치는 통로에 불과했다. 새 미션 8개를 그 방들과
// 인기 허브(기도실/교육실)에 나눠 채워 넣어 지도 전체를 고르게 쓰게 했다 — 새 미션은
// 기존 10종 미니게임을 복제하지 않고 전부 새로운 미니게임(TaskModal.tsx)으로 만들었다.
export const TASK_SPOTS: TaskSpot[] = [
  { id: "typing1", x: 1650, y: 1300, label: "방문록 타자로 적기", zone: "기도실", type: "typing" },
  { id: "offering", x: 1950, y: 1450, label: "모금함 정리", zone: "기도실", type: "offering" },
  { id: "dragdrop", x: 1900, y: 780, label: "미술 도구 정리", zone: "미술실 1", type: "dragdrop" },
  { id: "sort", x: 1250, y: 650, label: "악보 정리", zone: "음악실", type: "sort" },
  { id: "timing", x: 2650, y: 1000, label: "건반 타이밍 맞추기", zone: "피아노실 1", type: "timing" },
  { id: "mixer", x: 2550, y: 1350, label: "믹서기로 재료 섞기", zone: "주방 1", type: "mixer" },
  { id: "memory", x: 900, y: 1050, label: "창고 물품 배치 기억하기", zone: "창고 1", type: "memory" },
  { id: "maze", x: 1800, y: 2000, label: "박스 미로 사이 길찾기", zone: "창고", type: "maze" },
  { id: "mash", x: 950, y: 2250, label: "행사 배너 연타로 걸기", zone: "문화방", type: "mash" },
  { id: "wiring", x: 500, y: 2300, label: "빔프로젝터 배선 연결", zone: "교육실", type: "wiring" },
  { id: "bookSort", x: 2250, y: 2050, label: "도서실 책 정리", zone: "도서실", type: "sort" },
  { id: "avCheck", x: 3100, y: 1450, label: "방송 장비 점검", zone: "CCTV실", type: "wiring" },
  { id: "match1", x: 1330, y: 1990, label: "무용 동작 카드 짝맞추기", zone: "무용실", type: "match" },
  { id: "bells1", x: 3100, y: 880, label: "핸드벨 순서대로 연주하기", zone: "피아노실 2", type: "bells" },
  { id: "quiz1", x: 2900, y: 1850, label: "성경 상식 OX 퀴즈", zone: "휴게실", type: "quiz" },
  { id: "puzzle1", x: 550, y: 850, label: "비품 번호표 순서 맞추기", zone: "창고 2", type: "puzzle" },
  { id: "lock1", x: 650, y: 1580, label: "서류함 다이얼 자물쇠 맞추기", zone: "관리실", type: "lock" },
  { id: "whack1", x: 1050, y: 2600, label: "설거지 그릇 빠르게 씻기", zone: "주방 2", type: "whack" },
  { id: "water1", x: 1850, y: 1250, label: "로비 화분에 물 주기", zone: "기도실", type: "water" },
  { id: "balance1", x: 400, y: 2400, label: "교재 상자 균형 잡고 나르기", zone: "교육실", type: "balance" },
];

// ---------- 미션 랜덤 분배 (실제 어몽어스 방식) ----------
// 예전엔 양 진영 전원이 TASK_SPOTS 12개를 전부 완료해야 했다(현재는 20개로 늘었다).
// 인원이 많아질수록 "모두가 모든 미션을 다 돈다"는 부담이 커지고, 미션 지점이 뻔히
// 다 보이니 긴장감도 떨어졌다.
// 처음엔 각자가 독립적으로 무작위 몇 개씩 "뽑는" 방식으로 짰는데, 이 방식은 인원이
// 적을 때 표본이 크게 겹치거나(운이 나쁘면) 한쪽에 쏠려 보이는 경우가 있어 실제
// 테스트에서 "분배가 안 된 것 같다"는 문제가 나왔다. 그래서 트럼프 카드 돌리듯 —
// 미션 풀을 한 번 섞은 뒤 양 진영 인원 수만큼 순서대로 한 장씩 나눠주는 방식으로
// 바꿨다. 이러면 수학적으로 각자 floor(N/인원)~ceil(N/인원)개를 반드시 받고,
// 같은 미션이 두 사람에게 겹쳐 배정되는 일도 없다 — 인원수가 늘어날수록 자동으로
// 1인당 배정량이 줄어들어(인원수에 맞춘 분배) 총량은 항상 미션 풀 크기(taskPoolSize,
// 최대 20개)로 고정된다.
/** Fisher-Yates 셔플 — 배열을 직접 변형하지 않고 새 배열을 반환한다. */
function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 양 진영(늑대 제외) 플레이어 id 목록을 받아 미션을 셔플한 뒤 순서대로 한 명씩
 * 돌아가며 나눠준다(라운드로빈). 방장만 호출하고(game_start 페이로드에 실어 보냄),
 * 나머지 클라이언트는 받은 결과를 그대로 적용하기만 해서 전원이 동일한 배정을 본다.
 * 카드를 돌리는 방식이라 한 사람에게 몰리는 경우가 구조적으로 생길 수 없다.
 *
 * @param taskPoolSize 전체 미션 풀(TASK_SPOTS) 중 이번 판에 실제로 쓸 개수. 방장이 로비에서
 * 정한 값(GameSettings.taskPoolSize)을 그대로 받는다. 범위를 벗어난 값이 와도(저장된 옛 방
 * 설정 등) 안전하게 3~전체 개수 사이로 보정한다.
 */
export function assignRandomTasks(
  sheepFactionIds: string[],
  taskPoolSize: number = TASK_SPOTS.length
): Record<string, string[]> {
  const assignments: Record<string, string[]> = {};
  sheepFactionIds.forEach((id) => {
    assignments[id] = [];
  });
  if (sheepFactionIds.length === 0) return assignments;
  const poolSize = Math.max(3, Math.min(TASK_SPOTS.length, Math.round(taskPoolSize)));
  // 방장이 정한 개수만큼만 미션 종류를 무작위로 뽑아 이번 판의 풀로 쓴다.
  const taskPool = shuffled(TASK_SPOTS).slice(0, poolSize);
  // 인원이 미션 풀 크기보다 많아지는 대규모 방이어도 전원이 최소 1개씩은 받도록,
  // 필요한 만큼 풀을 다시 섞어 이어붙인다 — 그래도 라운드로빈이라 여전히 공평하다.
  const totalToShare = Math.max(taskPool.length, sheepFactionIds.length);
  const pool: TaskSpot[] = [];
  while (pool.length < totalToShare) {
    pool.push(...shuffled(taskPool));
  }
  pool.slice(0, totalToShare).forEach((t, i) => {
    const playerId = sheepFactionIds[i % sheepFactionIds.length];
    assignments[playerId].push(t.id);
  });
  return assignments;
}

// ---------- 은신 스팟 (하이딩) — 각 구역에 분산 배치 ----------
export interface HideSpot {
  id: string;
  x: number;
  y: number;
  label: string;
}
export const HIDE_SPOTS: HideSpot[] = [
  { id: "hide-desk", x: 2000, y: 1250, label: "안내 데스크 아래" },
  { id: "hide-curtain", x: 1300, y: 2050, label: "무용실 커튼 뒤" },
  { id: "hide-box", x: 550, y: 850, label: "창고 박스 뒤" },
  { id: "hide-pantry", x: 950, y: 2600, label: "주방 선반 뒤" },
  { id: "hide-lounge", x: 2800, y: 1750, label: "휴게실 소파 뒤" },
];
export const HIDE_INTERACT_RADIUS = 42;

// ---------- 환풍구(덕트) — 늑대 진영 전용 이동/은신 통로, 서로 먼 구역을 잇는 지름길 ----------
export interface VentSpot {
  id: string;
  x: number;
  y: number;
  links: string[]; // 연결된 다른 벤트 id들 (2개 이상이면 다방향 벤트)
  label: string;
}
// 예전엔 3쌍(1:1 연결)뿐이라 벤트를 타면 늘 목적지가 하나로 정해져 선택의 여지가
// 없었다. 거의 모든 방에 벤트를 하나씩 두고, 인접/원거리 구역을 넘나드는 간선을
// 촘촘히 깔아 대부분의 벤트가 2~3개의 목적지 중 고를 수 있는 "갈림길"이 되도록
// 재설계했다(links가 2개 이상이면 MainScene이 React 쪽 선택 메뉴를 띄운다).
export const VENTS: VentSpot[] = [
  // 북쪽(미술관) 구역
  { id: "vent-art1", x: 1650, y: 700, links: ["vent-kitchen3", "vent-art2"], label: "미술실 1 덕트" },
  { id: "vent-art2", x: 1330, y: 700, links: ["vent-art1", "vent-control"], label: "음악실 덕트" },
  // 동쪽(음악·주방) 구역
  { id: "vent-kitchen3", x: 2820, y: 1500, links: ["vent-art1", "vent-piano1"], label: "주방 1 덕트" },
  { id: "vent-piano1", x: 2700, y: 1030, links: ["vent-kitchen3", "vent-piano2"], label: "피아노실 1 덕트" },
  { id: "vent-piano2", x: 3150, y: 950, links: ["vent-piano1", "vent-avroom"], label: "피아노실 2 덕트" },
  { id: "vent-avroom", x: 3150, y: 1460, links: ["vent-piano2", "vent-lounge"], label: "CCTV실 덕트" },
  { id: "vent-lounge", x: 2950, y: 1880, links: ["vent-avroom", "vent-culture"], label: "휴게실 덕트" },
  // 남쪽(창고·도서) 구역
  { id: "vent-storage4", x: 1650, y: 2080, links: ["vent-storage1", "vent-library", "vent-art3"], label: "창고 덕트" },
  { id: "vent-art3", x: 1330, y: 2080, links: ["vent-storage4", "vent-library"], label: "무용실 덕트" },
  { id: "vent-library", x: 2290, y: 2080, links: ["vent-art3", "vent-storage4", "vent-kitchen5"], label: "도서실 덕트" },
  // 서쪽(창고·관리) 구역
  { id: "vent-storage1", x: 1080, y: 950, links: ["vent-storage4", "vent-storage2"], label: "창고 1 덕트" },
  { id: "vent-storage2", x: 580, y: 900, links: ["vent-storage1", "vent-control"], label: "창고 2 덕트" },
  { id: "vent-control", x: 630, y: 1230, links: ["vent-art2", "vent-storage2", "vent-teacher"], label: "방재실 덕트" },
  { id: "vent-teacher", x: 640, y: 1530, links: ["vent-control", "vent-edu"], label: "관리실 덕트" },
  // 남서쪽(문화·교육) 구역
  { id: "vent-culture", x: 750, y: 2350, links: ["vent-lounge", "vent-edu", "vent-kitchen5"], label: "문화방 덕트" },
  { id: "vent-kitchen5", x: 970, y: 2600, links: ["vent-culture", "vent-library"], label: "주방 2 덕트" },
  { id: "vent-edu", x: 470, y: 2300, links: ["vent-teacher", "vent-culture"], label: "교육실 덕트" },
];
export const VENT_INTERACT_RADIUS = 40;
export const VENT_COOLDOWN_MS = 2500;



// ---------- 말씀 타자 미션 구절 풀 — 4개 카테고리로 분류해 매번 다른 결을 준다 ----------
export type BiblePhraseCategory = "comfort" | "trust" | "discern" | "love";
export interface BiblePhraseEntry {
  phrase: string;
  ref: string;
  category: BiblePhraseCategory;
}
export const BIBLE_PHRASE_CATEGORY_LABEL: Record<BiblePhraseCategory, string> = {
  comfort: "위로와 평안",
  trust: "순종과 신뢰",
  discern: "분별과 경계",
  love: "사랑과 섬김",
};
// ---------- 세계관 한 줄 소개 — 로비/역할 배정 화면에 노출 ----------
export const WORLD_CONCEPT =
  "어느 밤, 목자가 잠깐 눈을 뗀 사이 노략질하는 이리가 양의 옷을 입고 양떼 속에 섞여 들어왔다. 해가 뜨기 전, 양들은 흩어진 사명을 완수하고 이리를 가려내야 한다.";

/** 회의(토론) 시작 시 상단에 노출 — "우리가 지금 분별하는 중"이라는 프레이밍을 준다 */
export const MEETING_DISCERNMENT_VERSE = {
  verse: "영을 다 믿지 말고 오직 영들이 하나님께 속하였나 시험하라",
  ref: "요한일서 4:1",
};

export const BIBLE_PHRASES: BiblePhraseEntry[] = [
  // 위로와 평안
  { phrase: "여호와는 나의 목자시니 내게 부족함이 없으리로다", ref: "시편 23:1", category: "comfort" },
  { phrase: "내 평안을 너희에게 주노라", ref: "요한복음 14:27", category: "comfort" },
  { phrase: "아무것도 염려하지 말고 오직 모든 일에 기도와 간구로", ref: "빌립보서 4:6", category: "comfort" },
  { phrase: "수고하고 무거운 짐 진 자들아 내게로 오라", ref: "마태복음 11:28", category: "comfort" },
  { phrase: "여호와는 나의 빛이요 나의 구원이시니 내가 누구를 두려워하리요", ref: "시편 27:1", category: "comfort" },
  { phrase: "항상 기뻐하라 쉬지 말고 기도하라", ref: "데살로니가전서 5:16-17", category: "comfort" },
  { phrase: "내가 너희에게 명한 것이 아니냐 강하고 담대하라 두려워하지 말라", ref: "여호수아 1:9", category: "comfort" },
  { phrase: "고아와 과부의 하나님은 그 거룩한 처소에 계시며", ref: "시편 68:5", category: "comfort" },
  { phrase: "슬퍼하는 자는 복이 있나니 그들이 위로를 받을 것임이요", ref: "마태복음 5:4", category: "comfort" },
  { phrase: "내가 너희와 함께 있으리라 세상 끝날까지", ref: "마태복음 28:20", category: "comfort" },
  // 순종과 신뢰
  { phrase: "내 양은 내 음성을 들으며 나는 그들을 알며", ref: "요한복음 10:27", category: "trust" },
  { phrase: "너는 마음을 다하여 여호와를 신뢰하고 네 명철을 의지하지 말라", ref: "잠언 3:5", category: "trust" },
  { phrase: "태초에 하나님이 천지를 창조하시니라", ref: "창세기 1:1", category: "trust" },
  { phrase: "여호와를 기다리는 자는 새 힘을 얻으리니", ref: "이사야 40:31", category: "trust" },
  { phrase: "내가 네게 명한 것이 아니냐 강하고 담대하라", ref: "여호수아 1:9", category: "trust" },
  { phrase: "먼저 그의 나라와 그의 의를 구하라", ref: "마태복음 6:33", category: "trust" },
  { phrase: "여호와의 말씀은 내 발에 등이요 내 길에 빛이니이다", ref: "시편 119:105", category: "trust" },
  { phrase: "네 걸음을 견고하게 하시리라", ref: "잠언 16:9", category: "trust" },
  { phrase: "하나님이 세상을 이처럼 사랑하사", ref: "요한복음 3:16", category: "trust" },
  { phrase: "내게 능력 주시는 자 안에서 내가 모든 것을 할 수 있느니라", ref: "빌립보서 4:13", category: "trust" },
  // 분별과 경계
  { phrase: "거짓 선지자들을 삼가라 양의 옷을 입고 나아오나 속에는 노략질하는 이리라", ref: "마태복음 7:15", category: "discern" },
  { phrase: "영을 다 믿지 말고 오직 영들이 하나님께 속하였나 시험하라", ref: "요한일서 4:1", category: "discern" },
  { phrase: "근신하라 깨어라 너희 대적 마귀가 우는 사자같이 두루 다니느니라", ref: "베드로전서 5:8", category: "discern" },
  { phrase: "지혜롭기는 뱀 같고 순결하기는 비둘기 같이 하라", ref: "마태복음 10:16", category: "discern" },
  { phrase: "그의 열매로 그들을 알리라", ref: "마태복음 7:16", category: "discern" },
  { phrase: "모든 것을 헤아려 좋은 것을 취하고", ref: "데살로니가전서 5:21", category: "discern" },
  { phrase: "삼가 아무도 철학과 헛된 속임수로 너희를 사로잡지 못하게 하라", ref: "골로새서 2:8", category: "discern" },
  { phrase: "각 사람을 그 앞에 모으고 각각 구분하기를", ref: "마태복음 25:32", category: "discern" },
  // 사랑과 섬김
  { phrase: "너희는 세상의 빛이라", ref: "마태복음 5:14", category: "love" },
  { phrase: "새 계명을 너희에게 주노니 서로 사랑하라", ref: "요한복음 13:34", category: "love" },
  { phrase: "사랑은 오래 참고 사랑은 온유하며", ref: "고린도전서 13:4", category: "love" },
  { phrase: "선한 목자는 양들을 위하여 목숨을 버리거니와", ref: "요한복음 10:11", category: "love" },
  { phrase: "너희가 여기 내 형제 중에 지극히 작은 자 하나에게 한 것이", ref: "마태복음 25:40", category: "love" },
  { phrase: "믿음 소망 사랑 그중에 제일은 사랑이라", ref: "고린도전서 13:13", category: "love" },
  { phrase: "네 이웃을 네 자신 같이 사랑하라", ref: "마태복음 22:39", category: "love" },
  { phrase: "우리가 사랑함은 그가 먼저 우리를 사랑하셨음이라", ref: "요한일서 4:19", category: "love" },
];

// ---------- 헌금 정리 미션 라벨 + 짧은 쓰임 안내 ----------
export const OFFERING_LABELS = ["십일조", "감사헌금", "주일헌금", "선교헌금", "절기헌금"];
export const OFFERING_MEANINGS: Record<string, string> = {
  십일조: "교회의 살림과 사역을 위해 쓰입니다.",
  감사헌금: "받은 은혜에 감사하며 드리는 예물입니다.",
  주일헌금: "매주 예배 가운데 드리는 정성입니다.",
  선교헌금: "땅끝까지 복음을 전하는 선교사님들을 후원합니다.",
  절기헌금: "성탄절, 부활절 등 절기를 기념하며 드립니다.",
};

// ---------- 성경 상식 OX 퀴즈 미션 문제 풀 (휴게실 quiz1) ----------
export interface QuizEntry {
  q: string;
  a: boolean;
}
export const QUIZ_QUESTIONS: QuizEntry[] = [
  { q: "다윗은 물맷돌로 골리앗을 쓰러뜨렸다", a: true },
  { q: "노아의 방주에는 동물이 종류마다 한 마리씩만 탔다", a: false },
  { q: "예수님은 베들레헴에서 태어나셨다", a: true },
  { q: "요나는 큰 물고기 뱃속에서 사흘을 보냈다", a: true },
  { q: "모세는 지팡이로 홍해를 갈랐다", a: true },
  { q: "삼손의 힘의 비밀은 옷의 색깔이었다", a: false },
  { q: "예수님의 열두 제자 중 유다는 스승을 배반했다", a: true },
  { q: "천지창조는 6일 동안 이루어졌고 7일째 하나님이 쉬셨다", a: true },
];

export const KILL_RADIUS = 55;
export const MEETING_CALL_RADIUS = 65;
export const TASK_RADIUS = 45;
export const KILL_COOLDOWN_MS = 20000;
export const SABOTAGE_COOLDOWN_MS = 40000;
export const BLACKOUT_DURATION_MS = 15000;
export const BLACKOUT_PROGRESS_NEEDED = 5;
export const MEETING_DISCUSS_MS = 30000;
export const MEETING_VOTE_MS = 30000;
export const MAX_EMERGENCY_CALLS = 1;

// ---------- 사보타지 확장: 보일러실(2인 협동) / 도어락 ----------
export const REACTOR_SABOTAGE_DURATION_MS = 45000;
export const DOOR_LOCK_DURATION_MS = 12000;
export const CANDLE_SABOTAGE_DURATION_MS = 40000;
export const PIPE_SABOTAGE_DURATION_MS = 40000;
/** 도어락 사보타지 대상이 될 수 있는 방 (각 층에서 하나씩) */
export const LOCKABLE_ROOM_IDS = ["hall", "art2", "piano1", "storage4", "culture", "edu"];

// ---------- 방장이 로비에서 조절할 수 있는 게임 설정값 (어몽어스 스타일) ----------
export const DEFAULT_VISION_DIAMETER = 782; // 빛 웅덩이 지름(px) — 기존 460에서 70% 확대. 기존 MainScene 고정값과 동일

export interface GameSettings {
  /** 늑대 처치 쿨다운(ms) */
  killCooldownMs: number;
  /** 사보타지(정전/보일러실/도어락 공용) 쿨다운(ms) */
  sabotageCooldownMs: number;
  /** 회의 토론 시간(ms) */
  meetingDiscussMs: number;
  /** 회의 투표 시간(ms) */
  meetingVoteMs: number;
  /** 게임당 긴급 소집 가능 횟수 */
  maxEmergencyMeetings: number;
  /** 플레이어 시야(안개 구멍) 지름(px). 죽은 사람(유령)에게는 적용되지 않음 */
  visionDiameter: number;
  /** 정전 사보타지 지속시간(ms) */
  blackoutDurationMs: number;
  /** 보일러실 사보타지 제한시간(ms) — 시간 내에 못 고치면 늑대 승리 */
  reactorSabotageDurationMs: number;
  /** 도어락 사보타지 지속시간(ms) */
  doorLockDurationMs: number;
  /** 방송 장비 오류 사보타지 제한시간(ms) — 시간 내에 두 패널을 못 고치면 늑대 승리 */
  candleSabotageDurationMs: number;
  /** 배수관 파열 사보타지 제한시간(ms) — 시간 내에 두 밸브를 못 잠그면 늑대 승리 */
  pipeSabotageDurationMs: number;
  /** 이번 판에서 실제로 사용할 미션 종류 개수(전체 풀 20개 중 방장이 고른 만큼만 골라 배정한다) */
  taskPoolSize: number;
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  killCooldownMs: KILL_COOLDOWN_MS,
  sabotageCooldownMs: SABOTAGE_COOLDOWN_MS,
  meetingDiscussMs: MEETING_DISCUSS_MS,
  meetingVoteMs: MEETING_VOTE_MS,
  maxEmergencyMeetings: MAX_EMERGENCY_CALLS,
  visionDiameter: DEFAULT_VISION_DIAMETER,
  blackoutDurationMs: BLACKOUT_DURATION_MS,
  reactorSabotageDurationMs: REACTOR_SABOTAGE_DURATION_MS,
  doorLockDurationMs: DOOR_LOCK_DURATION_MS,
  candleSabotageDurationMs: CANDLE_SABOTAGE_DURATION_MS,
  pipeSabotageDurationMs: PIPE_SABOTAGE_DURATION_MS,
  taskPoolSize: TASK_SPOTS.length,
};

export interface GameSettingFieldDef {
  key: keyof GameSettings;
  label: string;
  desc: string;
  min: number;
  max: number;
  step: number;
  /** "s"면 ms값을 초 단위 슬라이더로 변환해서 보여주고 편집한다. "px"/"count"는 원값을 그대로 사용 */
  unit: "s" | "px" | "count";
}

/** 로비 설정 패널을 이 배열 하나로 렌더링한다 — 항목을 늘리려면 여기에만 추가하면 됨 */
export const GAME_SETTINGS_FIELDS: GameSettingFieldDef[] = [
  { key: "taskPoolSize", label: "🧩 미션 개수", desc: "이번 판에 사용할 미션 종류 개수(전체 20개 중 방장이 정한 만큼만 무작위로 뽑아 배정)", min: 3, max: TASK_SPOTS.length, step: 1, unit: "count" },
  { key: "killCooldownMs", label: "🗡️ 처치 쿨다운", desc: "늑대가 다시 처치할 수 있을 때까지 걸리는 시간", min: 10, max: 60, step: 5, unit: "s" },
  { key: "sabotageCooldownMs", label: "💣 사보타지 쿨다운", desc: "사보타지를 다시 쓸 수 있을 때까지 걸리는 시간", min: 15, max: 60, step: 5, unit: "s" },
  { key: "meetingDiscussMs", label: "💬 토론 시간", desc: "회의 시작 후 자유 토론 시간", min: 15, max: 120, step: 5, unit: "s" },
  { key: "meetingVoteMs", label: "🗳️ 투표 시간", desc: "투표에 주어지는 시간", min: 15, max: 120, step: 5, unit: "s" },
  { key: "maxEmergencyMeetings", label: "🔔 긴급 소집 횟수", desc: "한 게임에서 긴급 기도 모임을 부를 수 있는 횟수", min: 0, max: 5, step: 1, unit: "count" },
  { key: "visionDiameter", label: "👁️ 플레이어 시야", desc: "내 캐릭터 주변으로 보이는 범위(유령은 항상 전체 시야)", min: 374, max: 1530, step: 34, unit: "px" },
  // [버그 수정] "정전 지속시간" 슬라이더는 지웠다 — 예전엔 이 시간이 지나면 스페이스바를
  // 5번 다 못 채워도 정전이 조용히 자동으로 꺼졌는데, 이제 정전은 오직 합심 기도(5번)나
  // 회의 소집으로만 꺼지도록 바꿨기 때문에 이 설정값 자체가 더 이상 아무 효과가 없다.
  // (GameSettings 타입의 blackoutDurationMs 필드는 기존에 저장된 설정과의 호환을 위해 남겨둠)
  { key: "reactorSabotageDurationMs", label: "🔧 보일러실 수리 제한시간", desc: "시간 안에 양쪽 패널을 못 고치면 늑대 승리", min: 20, max: 90, step: 5, unit: "s" },
  { key: "doorLockDurationMs", label: "🚪 도어락 지속시간", desc: "문이 잠겨있는 시간", min: 5, max: 30, step: 5, unit: "s" },
  { key: "candleSabotageDurationMs", label: "🕯️ 촛불 화재 진화 제한시간", desc: "시간 안에 촛불 두 개를 다 끄지 못하면 늑대 승리", min: 20, max: 90, step: 5, unit: "s" },
  { key: "pipeSabotageDurationMs", label: "🚰 배수관 수리 제한시간", desc: "시간 안에 두 밸브를 못 잠그면 늑대 승리", min: 20, max: 90, step: 5, unit: "s" },
];

// ---------- 특수 역할 (목자 / 선지자 / 거짓 선지자) ----------
export const SPECIAL_ROLE_MIN_PLAYERS = 8;
/** 중보자는 인원이 더 넉넉할 때만 추가로 등장한다 (목자·선지자 다음 3번째 양 진영 특수 역할) */
export const INTERCESSOR_MIN_PLAYERS = 10;

/** 늑대 진영(늑대 + 거짓 선지자) 여부 */
export function isWolfFaction(role: Role): boolean {
  return role === "wolf" || role === "falseProphet";
}
/** 양 진영(양 + 목자 + 선지자) 여부 */
export function isSheepFaction(role: Role): boolean {
  return !isWolfFaction(role);
}

export const ROLE_LABEL: Record<Role, string> = {
  sheep: "양",
  wolf: "늑대",
  shepherd: "목자",
  prophet: "선지자",
  falseProphet: "거짓 선지자",
  intercessor: "중보자",
};

/** 추방/게임 종료 시 노출되는 역할 공개 문구 */
export const ROLE_REVEAL_TEXT: Record<Role, string> = {
  sheep: "평범한 양이었습니다.",
  wolf: "늑대였습니다. \"우는 사자같이 두루 다니며 삼킬 자를 찾던\" 자였습니다.",
  shepherd: "성실한 목자였습니다. \"양들을 위하여 목숨을 버리는\" 자였습니다.",
  prophet: "진실한 선지자였습니다. \"내 음성을 듣는 자\"를 알아본 자였습니다.",
  falseProphet: "거짓 선지자였습니다... \"양의 옷을 입고 나아왔으나 속에는 노략질하는 이리\"였습니다.",
  intercessor: "말씀을 붙들고 기도한 중보자였습니다. \"의인의 간구는 역사하는 힘이 큰\" 기도였습니다.",
};

/** 역할별 근거 구절 — 역할 배정 화면 상단에 조작법 설명과 함께 노출 */
export const ROLE_VERSE: Record<Role, { verse: string; ref: string }> = {
  sheep: { verse: "내 양은 내 음성을 들으며 나는 그들을 알며", ref: "요한복음 10:27" },
  wolf: { verse: "우는 사자같이 두루 다니며 삼킬 자를 찾나니", ref: "베드로전서 5:8" },
  shepherd: { verse: "선한 목자는 양들을 위하여 목숨을 버리거니와", ref: "요한복음 10:11" },
  prophet: { verse: "내 양은 내 음성을 들으며 나는 그들을 알며", ref: "요한복음 10:27" },
  falseProphet: { verse: "양의 옷을 입고 나아오나 속에는 노략질하는 이리라", ref: "마태복음 7:15" },
  intercessor: { verse: "의인의 간구는 역사하는 힘이 큼이니라", ref: "야고보서 5:16" },
};

// ---------- 엔딩 연출: 승패에 따라 보여줄 말씀 구절 + 짧은 나레이션 ----------
export interface EndingVerse {
  verse: string;
  ref: string;
  narration: string;
}
export const ENDING_VERSES: Record<"sheep" | "wolf", EndingVerse> = {
  sheep: {
    verse: "여호와는 나의 목자시니 내게 부족함이 없으리로다",
    ref: "시편 23:1",
    narration: "목자의 음성을 따른 양떼가 마침내 아침을 맞았습니다.",
  },
  wolf: {
    verse: "삯꾼은... 이리가 오는 것을 보면 양을 버리고 달아나나니 이리가 양을 늑탈하고 흩어버리느니라",
    ref: "요한복음 10:12",
    narration: "노략질하는 이리를 끝내 가려내지 못한 채 밤이 깊어졌습니다.",
  },
};

/** 역할 배정 직후 공개되는 역할 설명 */
export const ROLE_INFO: Record<Role, { emoji: string; title: string; desc: string }> = {
  sheep: {
    emoji: "🐑",
    title: "당신은 양입니다",
    desc: "화살표 키로 이동해 미션 지점(노란 원)에서 스페이스바로 미션을 완료하세요. 늑대를 조심하세요.",
  },
  wolf: {
    emoji: "🐺",
    title: "당신은 늑대입니다",
    desc: "K키로 근처의 양을 처치하고, B키로 정전을 일으켜 혼란을 만드세요. V키로 환풍구를 타고 몰래 이동할 수 있어요. 들키면 안 됩니다.",
  },
  shepherd: {
    emoji: "🛡️",
    title: "당신은 목자입니다",
    desc: "화면 왼쪽 아래 패널에서 매 라운드 한 명을 지목해 늑대의 습격으로부터 보호할 수 있어요. 당신이 목자라는 사실은 끝까지 숨기세요 — 밝히면 늑대의 표적이 됩니다.",
  },
  prophet: {
    emoji: "📖",
    title: "당신은 선지자입니다",
    desc: "화면 왼쪽 아래 패널에서 매 라운드 한 명을 지목해 그가 늑대인지 확인할 수 있어요. 회의에서 공개할지는 신중히 결정하세요 — 거짓말쟁이로 몰릴 수도 있습니다.",
  },
  falseProphet: {
    emoji: "🐺📖",
    title: "당신은 거짓 선지자입니다",
    desc: "선지자처럼 조사할 수 있지만, 결과는 항상 반대로 나옵니다. 진짜 선지자와 다른 계시를 선포해 양들을 혼란에 빠뜨리세요.",
  },
  intercessor: {
    emoji: "🙏",
    title: "당신은 중보자입니다",
    desc: "누군가 쓰러지면, 화면 왼쪽 아래 패널에서 그를 위해 중보 기도를 드릴 수 있어요. 말씀 문제를 정확히 맞히면 그 자리에서 다시 살아납니다 — 단, 게임 중 단 한 번뿐이니 신중히 쓰세요.",
  },
};

// ---------- 중보자 전용: 중보 기도 시 응답으로 주어지는 말씀 문제 은행 ----------
export interface IntercessionQuestion {
  id: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

/**
 * 중보자가 쓰러진 사람을 위해 기도를 시작하면 이 은행에서 무작위로 한 문제를 뽑아 낸다.
 * 정답을 맞히면 그 자리에서 부활, 틀리면 이번 판의 중보 기도 기회(1회)를 소진한다.
 * 성경 사실 기반으로만 출제하고, 정답 선지 길이/위치로 유추되지 않도록 고르게 섞었다.
 */
export const INTERCESSION_QUIZ_BANK: IntercessionQuestion[] = [
  {
    id: "iq-1",
    question: "\"여호와는 나의 목자시니 내게 부족함이 없으리로다\"는 어느 시편일까요?",
    options: ["시편 1편", "시편 23편", "시편 91편", "시편 121편"],
    answerIndex: 1,
    explanation: "시편 23편 1절의 말씀입니다.",
  },
  {
    id: "iq-2",
    question: "다윗이 물맷돌로 쓰러뜨린 블레셋의 거인 장수 이름은?",
    options: ["아각", "골리앗", "오벧", "삼갈"],
    answerIndex: 1,
    explanation: "사무엘상 17장에 기록된 다윗과 골리앗의 싸움입니다.",
  },
  {
    id: "iq-3",
    question: "예수님께서 물 위를 걸으신 사건이 기록되지 않은 복음서는?",
    options: ["마태복음", "마가복음", "요한복음", "누가복음"],
    answerIndex: 3,
    explanation: "누가복음에는 물 위를 걸으신 기사가 기록되어 있지 않습니다.",
  },
  {
    id: "iq-4",
    question: "성령의 아홉 가지 열매(갈라디아서 5:22-23)에 포함되지 않는 것은?",
    options: ["희락", "지혜", "화평", "충성"],
    answerIndex: 1,
    explanation: "성령의 열매는 사랑, 희락, 화평, 오래 참음, 자비, 양선, 충성, 온유, 절제입니다.",
  },
  {
    id: "iq-5",
    question: "\"진리를 알지니 진리가 너희를 자유롭게 하리라\"는 어느 책에 나올까요?",
    options: ["로마서", "갈라디아서", "요한복음", "야고보서"],
    answerIndex: 2,
    explanation: "요한복음 8장 32절의 말씀입니다.",
  },
  {
    id: "iq-6",
    question: "노아의 방주가 최종적으로 머문 산의 이름은?",
    options: ["시내산", "아라랏산", "감람산", "호렙산"],
    answerIndex: 1,
    explanation: "창세기 8장 4절에 방주가 아라랏 산에 머물렀다고 기록되어 있습니다.",
  },
  {
    id: "iq-7",
    question: "죽은 나사로를 살리신 예수님의 기적이 기록된 복음서는?",
    options: ["마태복음", "마가복음", "누가복음", "요한복음"],
    answerIndex: 3,
    explanation: "요한복음 11장에 나사로를 살리신 사건이 기록되어 있습니다.",
  },
  {
    id: "iq-8",
    question: "\"두세 사람이 내 이름으로 모인 곳에는 나도 그들 중에 있느니라\"는 말씀은 어디에 있을까요?",
    options: ["마태복음 18장", "로마서 12장", "고린도전서 13장", "빌립보서 4장"],
    answerIndex: 0,
    explanation: "마태복음 18장 20절의 말씀입니다.",
  },
  {
    id: "iq-9",
    question: "예수님의 열두 제자 중 예수님을 은 삼십에 판 사람은?",
    options: ["도마", "가룟 유다", "빌립", "안드레"],
    answerIndex: 1,
    explanation: "마태복음 26장 15절에 가룟 유다가 은 삼십을 받고 예수님을 넘긴 사건이 기록되어 있습니다.",
  },
  {
    id: "iq-10",
    question: "요셉이 형들에게 팔려간 뒤 처음 종으로 살게 된 나라는 어디일까요?",
    options: ["애굽", "바벨론", "앗수르", "모압"],
    answerIndex: 0,
    explanation: "창세기 37장에 요셉이 애굽으로 팔려간 사건이 기록되어 있습니다.",
  },
];