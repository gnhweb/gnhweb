import Phaser from "phaser";
import { RoomDef, HallwaySeg } from "./types";

/**
 * ──────────────────────────────────────────────────────────────────
 * 2단계 최적화: 정적 맵 렌더링 → RenderTexture 베이킹
 * ──────────────────────────────────────────────────────────────────
 * 변경 전: 방·복도마다 TileSprite + GeometryMask + Graphics 오브젝트를
 *          라이브로 유지 → 드로우콜 폭증, 스텐실 버퍼 전환 반복
 *
 * 변경 후: bakeStaticMap() 한 번 호출 → 모든 정적 요소(방 바닥, 복도,
 *          소품, 벽 bevel, 문 표시, 방 라벨)를 RenderTexture 1장에
 *          소프트웨어적으로 그린 뒤 Image 1개로 배치.
 *          게임 중 라이브 마스크 오브젝트 = 0개.
 *
 * 동적 요소(사보타지 패널, 도어락 오버레이, 플레이어 라벨)는
 * 여전히 MainScene.ts에서 라이브 오브젝트로 처리한다.
 * ──────────────────────────────────────────────────────────────────
 */

/** PERFORMANCE_GUIDELINES: 새 방/복도/소품을 추가할 때는 반드시
 *  이 파일의 베이킹 함수(bakeStaticMap)에 추가하고,
 *  게임 중 라이브 마스크 오브젝트를 절대 만들지 말 것.
 */

export interface RoomTheme {
  floorBase: number;
  floorAccent: number;
  trim: number;
}

// "The Skeld" 스타일 재설계(session 1) 이후의 ROOMS id 기준으로 정리한 테마 테이블.
// 예전 id(lobby1/art4/piano3/storage3/teacher1·2/edu1·2)는 더 이상 어떤 방과도 매치되지
// 않아 themeFor()가 조용히 DEFAULT_THEME로 폴백하고 있었다 — 특히 지도의 심장부인 hall이
// 무채색 기본 테마로만 그려지고 있던 게 최종 점검 중 발견돼 정리했다.
export const ROOM_THEMES: Record<string, RoomTheme> = {
  hall:     { floorBase: 0x33334a, floorAccent: 0x3c3c58, trim: 0xe0575c },
  control:  { floorBase: 0x4a2b2b, floorAccent: 0x552f2f, trim: 0xffcc33 },
  art1:     { floorBase: 0x392a4a, floorAccent: 0x433156, trim: 0xb197fc },
  art2:     { floorBase: 0x2a3a4a, floorAccent: 0x314056, trim: 0x74c0fc },
  art3:     { floorBase: 0x4a2a3c, floorAccent: 0x563156, trim: 0xff8fa3 },
  piano1:   { floorBase: 0x2d3a2b, floorAccent: 0x354230, trim: 0xe9d8a6 },
  piano2:   { floorBase: 0x2d3a2b, floorAccent: 0x354230, trim: 0xe9d8a6 },
  kitchen3: { floorBase: 0x4a3a29, floorAccent: 0x554330, trim: 0x69db7c },
  storage1: { floorBase: 0x30303c, floorAccent: 0x393948, trim: 0xffa94d },
  storage2: { floorBase: 0x30303c, floorAccent: 0x393948, trim: 0xffa94d },
  storage4: { floorBase: 0x30303c, floorAccent: 0x393948, trim: 0xff6666 },
  culture:  { floorBase: 0x293a3a, floorAccent: 0x304141, trim: 0xe599f7 },
  teacher:  { floorBase: 0x2c2a4a, floorAccent: 0x333056, trim: 0x91a7ff },
  kitchen5: { floorBase: 0x4a3a29, floorAccent: 0x554330, trim: 0x69db7c },
  edu:      { floorBase: 0x2a4a3a, floorAccent: 0x315041, trim: 0x63e6be },
  lounge:   { floorBase: 0x2a3a4a, floorAccent: 0x314056, trim: 0x74c0fc },
  avroom:   { floorBase: 0x4a2b2b, floorAccent: 0x552f2f, trim: 0xffcc33 },
  library:  { floorBase: 0x392a4a, floorAccent: 0x433156, trim: 0xb197fc },
};

const DEFAULT_THEME: RoomTheme = { floorBase: 0x2b2b3a, floorAccent: 0x313142, trim: 0x8fa2ff };

function themeFor(id: string): RoomTheme {
  return ROOM_THEMES[id] ?? DEFAULT_THEME;
}

// ─── 바닥 타일 무늬 ─────────────────────────────────────────────────
// 예전엔 모든 방이 색만 다르고 바닥 무늬(결)는 전부 같은 "나무 판자" 줄무늬 하나뿐이었다.
// 방 용도에 맞는 무늬를 추가로 매핑해서 방이 진짜 그 용도의 공간처럼 보이게 했다.
// 전부 _drawRoomFloorToGraphics()에서 낮은 알파의 오버레이로만 그려서(기존 plank 방식과
// 동일한 접근) bakeStaticMap()이 씬 시작 시 한 번만 굽고 끝 — 무늬가 늘어나도 런타임
// 프레임 비용은 그대로다.
type FloorPattern = "plank" | "checker" | "diamond" | "hazard";

const FLOOR_PATTERNS: Record<string, FloorPattern> = {
  kitchen3: "checker", // 주방 — 타일 바닥
  kitchen5: "checker",
  storage1: "diamond", // 창고 — 콘크리트/철망 바닥
  storage2: "diamond",
  storage4: "diamond",
  control: "hazard",   // 방재실 — 안전 경고 바닥
  avroom: "hazard",    // CCTV실 — 통제구역 바닥
};

function patternFor(id: string): FloorPattern {
  return FLOOR_PATTERNS[id] ?? "plank"; // 나머지(미술실/음악실/도서실/휴게실 등)는 기존 나무 결
}

// ─── 챔퍼(모서리 컷) ───────────────────────────────────────────────
export interface Chamfer { tl: number; tr: number; bl: number; br: number; }

const ROOM_SHAPES: Record<string, Chamfer> = {
  // hall은 4방향 모두에 문이 나 있는 지도의 심장부라 네 모서리를 균등하게 챔퍼해
  // "중심 허브"라는 인상을 시각적으로도 준다.
  hall:     { tl: 36, tr: 36, bl: 36, br: 36 },
  control:  { tl:  0, tr: 26, bl:  0, br: 26 },
  art1:     { tl:  0, tr: 34, bl:  0, br:  0 },
  art2:     { tl: 34, tr:  0, bl:  0, br:  0 },
  art3:     { tl:  0, tr:  0, bl:  0, br: 34 },
  piano1:   { tl:  0, tr: 30, bl:  0, br: 30 },
  piano2:   { tl: 30, tr:  0, bl: 30, br:  0 },
  kitchen3: { tl: 30, tr:  0, bl: 30, br:  0 },
  storage4: { tl:  0, tr: 20, bl:  0, br:  0 },
  culture:  { tl: 40, tr: 40, bl:  0, br: 40 },
  teacher:  { tl:  0, tr:  0, bl: 24, br: 24 },
  kitchen5: { tl:  0, tr: 40, bl:  0, br: 40 },
  edu:      { tl:  0, tr: 24, bl:  0, br: 24 },
  lounge:   { tl: 30, tr:  0, bl: 30, br:  0 },
  avroom:   { tl:  0, tr: 26, bl:  0, br: 26 },
  library:  { tl:  0, tr: 34, bl: 34, br:  0 },
};

function chamferFor(room: RoomDef): Chamfer {
  const c = ROOM_SHAPES[room.id];
  if (!c) return { tl: 0, tr: 0, bl: 0, br: 0 };
  const cap = Math.min(room.w, room.h) / 3;
  return {
    tl: Math.min(c.tl, cap), tr: Math.min(c.tr, cap),
    bl: Math.min(c.bl, cap), br: Math.min(c.br, cap),
  };
}

/** 챔퍼 폴리곤 좌표 배열 반환 */
function chamferedPoly(x: number, y: number, w: number, h: number, c: Chamfer): number[] {
  return [
    x + c.tl, y,
    x + w - c.tr, y,
    x + w, y + c.tr,
    x + w, y + h - c.br,
    x + w - c.br, y + h,
    x + c.bl, y + h,
    x, y + h - c.bl,
    x, y + c.tl,
  ];
}

// ─── 소품 정의 ─────────────────────────────────────────────────────
export type PropType =
  | "easel" | "piano" | "musicStand" | "mirrorBar" | "deskRow"
  | "boxStack" | "shelf" | "plant" | "reception" | "counter"
  | "stove" | "fridge" | "controlPanel" | "curtainStage"
  | "bookshelf" | "bench" | "sink" | "rug"
  | "paintPalette" | "canvasArt" | "paintBucket";

export interface PropDef {
  type: PropType;
  x: number;
  y: number;
  flip?: boolean;
}

export const ROOM_PROPS: Record<string, PropDef[]> = {
  // 지도 정중앙 랜드마크 — 방 가운데 큰 러그를 깔고, HIDE_SPOTS의 "안내 데스크 아래"
  // 은신처(hide-desk, hall 안쪽에 위치)와 그림이 맞도록 안내 데스크를 그 자리에 얹었다.
  // 벤치·화분은 4개 문 어디에도 걸리지 않도록 방 중앙~모서리 쪽에 배치.
  hall:     [{ type: "rug", x: 280, y: 185 }, { type: "reception", x: 505, y: 70 }, { type: "bench", x: 40, y: 340 }, { type: "bench", x: 40, y: 60 }, { type: "plant", x: 640, y: 350 }, { type: "plant", x: 640, y: 40 }],

  // 방재실(300×320, 문: right y250-320, bottom x70-210) — 관제 패널 2개뿐이던 걸
  // 대기 벤치·화분으로 채워 실제로 쓰는 방처럼 보이게 했다.
  control: [
    { type: "controlPanel", x: 30, y: 60 },
    { type: "controlPanel", x: 30, y: 180 },
    { type: "bench", x: 200, y: 60 },
    { type: "plant", x: 220, y: 200 },
  ],

  // 미술실 1 (380×280, 문: bottom x130-250, left y30-170, 우상단 챔퍼 34).
  // 예전 정의는 easel(60,300)·shelf(480,60)가 방 높이(280)·폭(380)을 벗어나 있어
  // 실제로는 안 보이거나 옆방에 겹쳐 그려지던 버그였다 — 전부 방 안쪽으로 재배치하고
  // 화구(팔레트·물감통)와 완성작(캔버스)을 더해 "미술실"임이 한눈에 보이게 꾸몄다.
  art1: [
    { type: "easel", x: 50, y: 40 },
    { type: "easel", x: 150, y: 40 },
    { type: "canvasArt", x: 270, y: 24 },
    { type: "shelf", x: 330, y: 110 },
    { type: "paintPalette", x: 190, y: 165 },
    { type: "paintBucket", x: 228, y: 172 },
    { type: "paintBucket", x: 165, y: 178 },
    { type: "plant", x: 40, y: 215 },
  ],

  // 음악실(380×300, 문: right y120-260만 뚫려 있음). 예전엔 musicStand(60,300)·
  // shelf(480,400)가 방 크기(380×300)를 넘어가 실제로는 안 보이던 소품이었다 —
  // 안쪽으로 재배치하고 피아노 한 대를 더해 "음악실"다운 구성으로 바꿨다.
  art2: [
    { type: "piano", x: 40, y: 210 },
    { type: "musicStand", x: 130, y: 220 },
    { type: "musicStand", x: 200, y: 220 },
    { type: "shelf", x: 300, y: 30 },
    { type: "bench", x: 40, y: 40 },
    { type: "plant", x: 150, y: 30 },
  ],

  // 무용실(380×300, 문: right y40-180, left y200-300). 러그가 방 경계를 살짝
  // 넘어가던 걸 고치고, 벽면 거울바를 하나 더 이어 붙여 발레 바(barre)처럼 보이게 했다.
  art3: [
    { type: "mirrorBar", x: 40, y: 20 },
    { type: "mirrorBar", x: 200, y: 20 },
    { type: "rug", x: 120, y: 140 },
    { type: "bench", x: 270, y: 230 },
    { type: "plant", x: 20, y: 255 },
  ],

  // 피아노실 1(340×300, 문: bottom x60-200, right y40-180). musicStand(300,380)이
  // 방 높이(300)를 넘어가 있던 걸 고쳤다.
  piano1: [
    { type: "piano", x: 60, y: 60 },
    { type: "musicStand", x: 250, y: 60 },
    { type: "musicStand", x: 280, y: 220 },
    { type: "bench", x: 40, y: 220 },
  ],

  // 피아노실 2(340×280, 문: left y100-240, bottom x70-210). musicStand(320,380)이
  // 방 높이(280)를 넘어가 있던 걸 고쳤다.
  piano2: [
    { type: "piano", x: 60, y: 60 },
    { type: "musicStand", x: 250, y: 60 },
    { type: "musicStand", x: 280, y: 180 },
    { type: "bench", x: 40, y: 200 },
  ],

  // 주방 1(440×300, 문 4개: left y80-220 / top x150-290 / right y130-270 / bottom
  // x250-390). fridge(480,40)·sink(40,380)이 방 크기를 넘어가 있던 걸 고치고,
  // 4개 문 통로를 다 비운 채로 모서리에 재배치했다.
  kitchen3: [
    { type: "counter", x: 40, y: 40 },
    { type: "stove", x: 340, y: 40 },
    { type: "fridge", x: 20, y: 230 },
    { type: "sink", x: 150, y: 230 },
  ],

  // 창고 1(360×300, 문: bottom x110-250, left y30-130). shelf(60,340)가 방 높이
  // (300)를 넘어가 있던 걸 고치고 박스를 하나 더해 창고답게 채웠다.
  storage1: [
    { type: "boxStack", x: 60, y: 60 },
    { type: "boxStack", x: 160, y: 60 },
    { type: "shelf", x: 280, y: 190 },
    { type: "boxStack", x: 60, y: 190 },
  ],

  // 창고 2(360×300, 문: right y180-280). shelf(300,340)가 방 높이(300)를 넘어가
  // 있던 걸 고쳤다.
  storage2: [
    { type: "boxStack", x: 60, y: 60 },
    { type: "boxStack", x: 160, y: 190 },
    { type: "shelf", x: 280, y: 40 },
  ],

  // 창고(380×280, 문 3개: top x130-250 / left·right y110-250). boxStack(400,60)이
  // 방 폭(380)을 넘어가 있던 걸 고치고 선반·박스를 더해 채웠다.
  storage4: [
    { type: "shelf", x: 60, y: 20 },
    { type: "boxStack", x: 280, y: 20 },
    { type: "boxStack", x: 280, y: 75 },
    { type: "shelf", x: 170, y: 190 },
    { type: "boxStack", x: 60, y: 190 },
  ],

  // 문화방(380×300, 문 4개: top x300-380 / bottom x150-290 / left y100-240 /
  // right y40-140). bench 2개가 방 높이(300)를 넘어가 있던 걸 고치고, 무대 앞에
  // 러그를 깔아 "공연 준비 공간" 느낌을 더했다.
  culture: [
    { type: "curtainStage", x: 0, y: 0 },
    { type: "rug", x: 60, y: 80 },
    { type: "bench", x: 40, y: 210 },
    { type: "bench", x: 150, y: 210 },
    { type: "plant", x: 250, y: 210 },
  ],

  // 관리실(어몽어스 Admin Table 역할, 320×280, 문: top x70-210) — 책상 줄 + 관제
  // 패널로 "인원 감지" 기능과 어울리게. 벤치·화분을 더해 채웠다.
  teacher: [
    { type: "deskRow", x: 90, y: 80 },
    { type: "controlPanel", x: 40, y: 190 },
    { type: "bench", x: 220, y: 190 },
    { type: "plant", x: 270, y: 30 },
  ],

  // 주방 2(380×280, 문: top x70-210). sink(40,380)가 방 높이(280)를 넘어가 있던
  // 걸 고쳤다.
  kitchen5: [
    { type: "counter", x: 40, y: 180 },
    { type: "stove", x: 200, y: 180 },
    { type: "fridge", x: 320, y: 40 },
    { type: "sink", x: 250, y: 40 },
  ],

  // 교육실(380×320, 문: right y50-190). 책상 2줄뿐이던 걸 책장·화분으로 채웠다.
  edu: [
    { type: "deskRow", x: 30, y: 60 },
    { type: "deskRow", x: 30, y: 200 },
    { type: "bookshelf", x: 300, y: 220 },
    { type: "plant", x: 200, y: 270 },
  ],

  // 휴게실(380×280, 문: top x50-190, left y100-240). rug(260,160)가 방 폭(380)을
  // 넘어가고 plant(420,40)는 방 밖(폭 380 초과)에 그려지던 버그를 고쳤다.
  lounge: [
    { type: "bench", x: 220, y: 60 },
    { type: "bench", x: 220, y: 200 },
    { type: "rug", x: 200, y: 100 },
    { type: "plant", x: 320, y: 40 },
    { type: "plant", x: 320, y: 200 },
  ],

  // CCTV실(320×280, 문: left y50-190, top x60-200) — 관제 패널뿐이던 걸 벤치·
  // 화분으로 채웠다.
  avroom: [
    { type: "controlPanel", x: 40, y: 40 },
    { type: "controlPanel", x: 40, y: 160 },
    { type: "bench", x: 200, y: 220 },
    { type: "plant", x: 260, y: 50 },
  ],

  // 도서실(420×300, 문: left y40-180, top x120-260). rug(300,260)가 방 폭·높이를
  // 모두 넘어가 있던 걸 고치고 책장 하나·독서용 벤치를 더했다.
  library: [
    { type: "bookshelf", x: 30, y: 30 },
    { type: "bookshelf", x: 30, y: 150 },
    { type: "rug", x: 180, y: 170 },
    { type: "bench", x: 320, y: 200 },
    { type: "plant", x: 380, y: 30 },
  ],
};

// ─── 소품 텍스처 생성 (씬당 1회) ─────────────────────────────────────
function drawShadow(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(x + w / 2, y + h - 3, w * 0.75, 7);
}

function ensurePropTexture(scene: Phaser.Scene, type: PropType): string {
  const key = `prop-${type}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  switch (type) {
    case "easel": { const W=40,H=56; drawShadow(g,0,0,W,H); g.lineStyle(3,0x6b4a2f,1); g.lineBetween(8,H-4,20,10); g.lineBetween(32,H-4,20,10); g.lineBetween(10,H-20,30,H-20); g.fillStyle(0xf5f0e6,1); g.fillRect(9,6,22,26); g.lineStyle(1.5,0x6b4a2f,1); g.strokeRect(9,6,22,26); g.fillStyle(0xd85a30,1); g.fillCircle(16,14,3); g.fillStyle(0x74c0fc,1); g.fillCircle(24,20,3); g.generateTexture(key,W,H); break; }
    case "piano": { const W=70,H=50; drawShadow(g,0,0,W,H); g.fillStyle(0x14141c,1); g.fillRoundedRect(2,4,W-4,H-16,4); g.fillStyle(0x1c1e30,1); g.fillRect(2,H-16,W-4,8); g.fillStyle(0xffffff,1); for(let i=0;i<9;i++)g.fillRect(5+i*7,H-15,5,7); g.fillStyle(0x14141c,1); for(let i=0;i<8;i++)if(i%7!==2&&i%7!==6)g.fillRect(8+i*7,H-15,3,4); g.generateTexture(key,W,H); break; }
    case "musicStand": { const W=20,H=50; drawShadow(g,0,0,W,H); g.lineStyle(3,0x555566,1); g.lineBetween(10,H-4,10,16); g.lineBetween(2,H-4,18,H-4); g.fillStyle(0x2b2b3a,1); g.fillRect(0,4,20,14); g.lineStyle(1,0xffe066,0.7); g.lineBetween(3,8,17,8); g.lineBetween(3,12,17,12); g.generateTexture(key,W,H); break; }
    case "mirrorBar": { const W=90,H=16; g.fillStyle(0xcdeeff,0.25); g.fillRoundedRect(0,0,W,H-6,3); g.fillStyle(0x8a5a2f,1); g.fillRect(0,H-5,W,4); g.generateTexture(key,W,H); break; }
    case "deskRow": { const W=110,H=30; for(let i=0;i<3;i++){const dx=i*38; drawShadow(g,dx,0,32,H); g.fillStyle(0x6b4a2f,1); g.fillRect(dx+2,8,30,14); g.fillStyle(0x4a3320,1); g.fillRect(dx+4,22,4,8); g.fillRect(dx+26,22,4,8);} g.generateTexture(key,W,H); break; }
    case "boxStack": { const W=44,H=44; drawShadow(g,0,0,W,H); g.fillStyle(0xa5702f,1); g.fillRect(6,18,32,24); g.fillStyle(0xc98a44,1); g.fillRect(2,2,28,22); g.lineStyle(1.5,0x6b4a1f,0.8); g.strokeRect(6,18,32,24); g.strokeRect(2,2,28,22); g.lineBetween(2,13,30,13); g.generateTexture(key,W,H); break; }
    case "shelf": { const W=34,H=70; g.fillStyle(0x4a3320,1); g.fillRect(0,0,W,H); g.fillStyle(0x6b4a2f,1); for(let i=0;i<4;i++)g.fillRect(2,4+i*17,W-4,4); g.fillStyle(0xd85a30,0.8); g.fillRect(6,10,8,6); g.fillStyle(0x74c0fc,0.8); g.fillRect(18,27,8,6); g.fillStyle(0x69db7c,0.8); g.fillRect(6,44,8,6); g.generateTexture(key,W,H); break; }
    case "plant": { const W=30,H=40; drawShadow(g,0,0,W,H); g.fillStyle(0x8a5a2f,1); g.fillRect(9,H-14,12,12); g.fillStyle(0x2f8f4f,1); g.fillCircle(15,H-20,10); g.fillCircle(9,H-26,7); g.fillCircle(21,H-26,7); g.generateTexture(key,W,H); break; }
    case "reception": { const W=90,H=50; drawShadow(g,0,0,W,H); g.fillStyle(0x4a3320,1); g.fillRoundedRect(0,14,W,H-14,4); g.fillStyle(0x6b4a2f,1); g.fillRect(0,10,W,8); g.fillStyle(0xffd700,1); g.fillCircle(W-14,22,5); g.generateTexture(key,W,H); break; }
    case "counter": { const W=90,H=36; g.fillStyle(0x3a3a48,1); g.fillRoundedRect(0,6,W,H-6,3); g.fillStyle(0x555566,1); g.fillRect(0,6,W,6); g.generateTexture(key,W,H); break; }
    case "stove": { const W=40,H=36; g.fillStyle(0x2b2b3a,1); g.fillRoundedRect(0,4,W,H-4,3); g.fillStyle(0x1c1e30,1); g.fillCircle(11,14,6); g.fillCircle(29,14,6); g.fillCircle(11,26,6); g.fillCircle(29,26,6); g.lineStyle(1,0x555566,1); g.strokeCircle(11,14,6); g.strokeCircle(29,14,6); g.generateTexture(key,W,H); break; }
    case "fridge": { const W=34,H=60; drawShadow(g,0,0,W,H); g.fillStyle(0xd7dde3,1); g.fillRoundedRect(2,2,W-4,H-8,4); g.lineStyle(1.5,0x9aa4ad,1); g.strokeRoundedRect(2,2,W-4,H-8,4); g.lineBetween(2,24,W-2,24); g.fillStyle(0x555566,1); g.fillRect(W-9,8,3,10); g.fillRect(W-9,30,3,10); g.generateTexture(key,W,H); break; }
    case "controlPanel": { const W=50,H=60; g.fillStyle(0x2b2b3a,1); g.fillRoundedRect(0,0,W,H,4); g.lineStyle(2,0xff6666,0.8); g.strokeRoundedRect(0,0,W,H,4); const cols=[0xff6666,0xffd700,0x69db7c]; let idx=0; for(let r=0;r<3;r++){for(let c=0;c<3;c++){g.fillStyle(cols[idx%cols.length],0.9); g.fillRect(8+c*12,8+r*14,8,8); idx++;}} g.generateTexture(key,W,H); break; }
    case "curtainStage": { const W=140,H=60; for(let i=0;i<5;i++){g.fillStyle(i%2===0?0x9c3232:0x7a2424,1); g.fillRect(i*6,0,6,H); g.fillRect(W-30+i*6,0,6,H);} g.fillStyle(0x3a3a48,1); g.fillRect(30,H-10,W-60,10); g.generateTexture(key,W,H); break; }
    case "bookshelf": { const W=40,H=66; g.fillStyle(0x4a3320,1); g.fillRect(0,0,W,H); const cols2=[0xd85a30,0x74c0fc,0x69db7c,0xffe066,0xe599f7]; for(let row=0;row<3;row++){g.fillStyle(0x6b4a2f,1); g.fillRect(2,4+row*20,W-4,3); for(let i=0;i<6;i++){g.fillStyle(cols2[(row+i)%cols2.length],0.9); g.fillRect(4+i*6,8+row*20,4,12);}} g.generateTexture(key,W,H); break; }
    case "bench": { const W=60,H=22; drawShadow(g,0,0,W,H); g.fillStyle(0x6b4a2f,1); g.fillRoundedRect(0,0,W,10,3); g.fillStyle(0x4a3320,1); g.fillRect(4,10,4,8); g.fillRect(W-8,10,4,8); g.generateTexture(key,W,H); break; }
    case "sink": { const W=50,H=30; g.fillStyle(0x8a949c,1); g.fillRoundedRect(0,6,W,H-6,3); g.fillStyle(0x555566,1); g.fillEllipse(W/2,16,24,12); g.lineStyle(2,0x9aa4ad,1); g.lineBetween(W/2,4,W/2,10); g.generateTexture(key,W,H); break; }
    case "rug": { g.generateTexture(key, 1, 1); break; }
    case "paintPalette": { const W=34,H=24; drawShadow(g,0,0,W,H); g.fillStyle(0x9c7a4a,1); g.fillEllipse(W/2,H/2-2,W/2,H/2-2); g.fillStyle(0x14141c,1); g.fillEllipse(W/2+6,H/2-2,5,4); const dots=[0xd85a30,0xffd700,0x74c0fc,0x69db7c,0xe599f7]; dots.forEach((c,i)=>{g.fillStyle(c,1); g.fillCircle(7+((i%3)*7),8+Math.floor(i/3)*9,3);}); g.generateTexture(key,W,H); break; }
    case "canvasArt": { const W=50,H=36; g.fillStyle(0x6b4a2f,1); g.fillRect(0,0,W,H); g.fillStyle(0xf5f0e6,1); g.fillRect(3,3,W-6,H-6); g.fillStyle(0x74c0fc,0.9); g.fillTriangle(6,H-6,20,10,34,H-6); g.fillStyle(0xd85a30,0.85); g.fillCircle(37,12,6); g.fillStyle(0x69db7c,0.6); g.fillRect(3,H-10,W-6,4); g.generateTexture(key,W,H); break; }
    case "paintBucket": { const W=18,H=20; drawShadow(g,0,0,W,H); g.fillStyle(0xb0b6bd,1); g.fillRect(2,6,W-4,H-8); g.fillStyle(0x8a949c,1); g.fillRect(2,6,W-4,3); const colors=[0xd85a30,0x74c0fc,0x69db7c,0xffd700]; g.fillStyle(colors[Math.floor(Math.random()*colors.length)],0.9); g.fillRect(4,4,W-8,4); g.generateTexture(key,W,H); break; }
  }
  g.destroy();
  return key;
}

// ─── 내부 헬퍼: Graphics에 직접 그리는 함수들 ────────────────────────
/** Graphics g에 방 바닥(챔퍼 + 결무늬 + 테두리)을 직접 그린다 */
function _drawRoomFloorToGraphics(g: Phaser.GameObjects.Graphics, room: RoomDef): void {
  const theme = themeFor(room.id);
  const c = chamferFor(room);
  const poly = chamferedPoly(room.x, room.y, room.w, room.h, c);

  // 바닥 기본색 (챔퍼 폴리곤 클리핑 없이 fillPoints로 직접)
  g.fillStyle(theme.floorBase, 1);
  g.fillPoints(poly.reduce<Phaser.Geom.Point[]>((acc, _, i) => {
    if (i % 2 === 0) acc.push(new Phaser.Geom.Point(poly[i], poly[i + 1]));
    return acc;
  }, []), true);

  // 바닥 무늬 — 전체 방 영역에 그린 후 폴리곤 바깥은 이미 배경색이라 상관없음
  // (RenderTexture에 굽기 때문에 마스크 없이도 챔퍼 폴리곤 안쪽처럼 자연스럽게 보임)
  const pattern = patternFor(room.id);
  if (pattern === "plank") {
    // 나무 판자 결 — 미술실/음악실/도서실 등 대부분의 방
    g.fillStyle(theme.floorAccent, 0.35);
    const stripH = 3;
    const stripStep = 26;
    for (let ly = room.y + 6; ly < room.y + room.h; ly += stripStep) {
      g.fillRect(room.x, ly, room.w, stripH);
    }
  } else if (pattern === "checker") {
    // 체커 타일 — 주방
    g.fillStyle(theme.floorAccent, 0.4);
    const TILE = 34;
    for (let ry = room.y; ry < room.y + room.h; ry += TILE) {
      const row = Math.round((ry - room.y) / TILE);
      for (let rx = room.x; rx < room.x + room.w; rx += TILE) {
        const col = Math.round((rx - room.x) / TILE);
        if ((row + col) % 2 !== 0) continue;
        const cw = Math.min(TILE, room.x + room.w - rx);
        const ch = Math.min(TILE, room.y + room.h - ry);
        g.fillRect(rx, ry, cw, ch);
      }
    }
  } else if (pattern === "diamond") {
    // 마름모 그리드 — 창고 (콘크리트/철망 바닥 느낌)
    g.lineStyle(1.5, theme.floorAccent, 0.4);
    const step = 30;
    const diag = room.w + room.h;
    for (let d = -room.h; d < diag; d += step) {
      g.lineBetween(room.x + d, room.y, room.x + d + room.h, room.y + room.h);
      g.lineBetween(room.x + d, room.y + room.h, room.x + d + room.h, room.y);
    }
  } else if (pattern === "hazard") {
    // 경고 대각선 스트라이프 — 방재실/CCTV실 (통제구역 느낌)
    g.fillStyle(theme.trim, 0.14);
    const step = 34;
    const diag = room.w + room.h;
    for (let d = -room.h; d < diag; d += step) {
      g.beginPath();
      g.moveTo(room.x + d, room.y);
      g.lineTo(room.x + d + 14, room.y);
      g.lineTo(room.x + d + 14 + room.h, room.y + room.h);
      g.lineTo(room.x + d + room.h, room.y + room.h);
      g.closePath();
      g.fillPath();
    }
  }

  // 트림(테두리) 선
  g.lineStyle(2, theme.trim, 0.45);
  const pts = poly.reduce<Phaser.Geom.Point[]>((acc, _, i) => {
    if (i % 2 === 0) acc.push(new Phaser.Geom.Point(poly[i], poly[i + 1]));
    return acc;
  }, []);
  g.strokePoints(pts, true);
}

/**
 * Graphics g에 복도 바닥을 직접 그린다.
 *
 * 이전엔 단색 채우기 + 대각선 해저드 스트라이프뿐이라 "복도"라는 느낌이 약했다.
 * 실제 타일 바닥처럼 보이도록 체커보드 명암 + 타일 그리드 선을 더했다. bakeStaticMap()이
 * 이 함수를 씬 시작 시 한 번만 호출해 RenderTexture에 구워버리므로(라이브 재계산 없음),
 * 타일 개수가 늘어나도 런타임 프레임 비용은 전혀 늘지 않는다.
 */
function _drawHallwayToGraphics(g: Phaser.GameObjects.Graphics, h: HallwaySeg): void {
  g.fillStyle(h.color, 1);
  g.fillRect(h.x, h.y, h.w, h.h);

  // 체커보드 타일 명암 — 타일 경계에 걸치는 칸은 복도 영역만큼만 잘라서 채운다.
  const TILE = 48;
  const light = Phaser.Display.Color.IntegerToColor(h.color).lighten(6).color;
  const dark = Phaser.Display.Color.IntegerToColor(h.color).darken(5).color;
  const gridStartX = Math.floor(h.x / TILE) * TILE;
  const gridStartY = Math.floor(h.y / TILE) * TILE;
  for (let ty = gridStartY; ty < h.y + h.h; ty += TILE) {
    const row = Math.round(ty / TILE);
    for (let tx = gridStartX; tx < h.x + h.w; tx += TILE) {
      const col = Math.round(tx / TILE);
      const cx = Math.max(tx, h.x);
      const cy = Math.max(ty, h.y);
      const cw = Math.min(tx + TILE, h.x + h.w) - cx;
      const ch = Math.min(ty + TILE, h.y + h.h) - cy;
      if (cw <= 0 || ch <= 0) continue;
      g.fillStyle((col + row) % 2 === 0 ? light : dark, 0.16);
      g.fillRect(cx, cy, cw, ch);
    }
  }

  // 타일 이음매(그리드) 선
  g.lineStyle(1, 0x05060f, 0.22);
  for (let tx = Math.ceil(h.x / TILE) * TILE; tx < h.x + h.w; tx += TILE) {
    g.lineBetween(tx, h.y, tx, h.y + h.h);
  }
  for (let ty = Math.ceil(h.y / TILE) * TILE; ty < h.y + h.h; ty += TILE) {
    g.lineBetween(h.x, ty, h.x + h.w, ty);
  }

  // 대각선 해저드 스트라이프(기존 느낌 유지, 타일 위에 은은하게)
  g.fillStyle(0xffd700, 0.05);
  const step = 46;
  const diag = h.w + h.h;
  for (let d = -h.h; d < diag; d += step) {
    g.beginPath();
    g.moveTo(h.x + d, h.y);
    g.lineTo(h.x + d + 18, h.y);
    g.lineTo(h.x + d + 18 + h.h, h.y + h.h);
    g.lineTo(h.x + d + h.h, h.y + h.h);
    g.closePath();
    g.fillPath();
  }
}

/** Graphics g에 벽 bevel 선(하이라이트 + 그림자)을 직접 그린다 */
export function drawWallBevelToGraphics(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number, w: number, h: number
): void {
  g.lineStyle(2, 0x5a5f8f, 0.55);
  g.lineBetween(x, y, x + w, y);
  g.lineStyle(2, 0x05060f, 0.7);
  g.lineBetween(x, y + h, x + w, y + h);
}

/** room의 소품들을 "그리기용 임시 GameObject" 배열로 만들어 반환한다.
 *  (RT에 즉시 stamp하지 않고 객체만 만들어 두면, 아래 bakeStaticMap의 타일링에서
 *   같은 객체를 여러 타일 RT에 재사용해서 그릴 수 있다) */
function _buildPropDrawables(scene: Phaser.Scene, room: RoomDef): Phaser.GameObjects.GameObject[] {
  const defs = ROOM_PROPS[room.id];
  if (!defs) return [];

  const out: Phaser.GameObjects.GameObject[] = [];
  defs.forEach((p) => {
    if (p.type === "rug") {
      const tempG = scene.make.graphics({ x: 0, y: 0 }, false);
      tempG.fillStyle(0x000000, 0.15);
      tempG.fillRoundedRect(room.x + p.x, room.y + p.y, 140, 90, 10);
      out.push(tempG);
    } else {
      const key = ensurePropTexture(scene, p.type);
      const frame = scene.textures.getFrame(key);
      if (!frame) return;
      const img = scene.make.image({ x: room.x + p.x, y: room.y + p.y, key }, false);
      img.setOrigin(0, 0);
      if (p.flip) img.setFlipX(true);
      out.push(img);
    }
  });
  return out;
}

/**
 * 기기 GPU가 실제로 지원하는 최대 텍스처 크기(GL_MAX_TEXTURE_SIZE)를 안전 마진을 두고 반환한다.
 *
 * 버그 진단(2026-08): 일부 저사양 Android 기기(예: 삼성 인터넷 브라우저가 깔린 보급형 모델)의
 * GPU는 GL_MAX_TEXTURE_SIZE가 4096으로 제한되어 있다. 우리 맵은 WORLD_W=4700 × WORLD_H=3300이라
 * 가로가 이 한계를 넘는데, 그 상태로 `scene.add.renderTexture(0,0,4700,3300)`을 호출하면 GPU가
 * 텍스처 할당에 조용히 실패하고, 그 텍스처를 프레임버퍼에 붙이는 순간 Phaser가
 * "Framebuffer status: Incomplete Attachment" 예외를 던지며 화면 생성이 통째로 중단된다
 * (= 캔버스가 배경색만 깔린 채 멈추거나 이 진단 오버레이가 뜨는 원인).
 * 이 함수가 반환하는 값보다 큰 RenderTexture는 만들지 않도록 bakeStaticMap()에서 타일링한다.
 */
function getSafeMaxTextureSize(scene: Phaser.Scene): number {
  const renderer = scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer & {
    gl?: WebGLRenderingContext | WebGL2RenderingContext;
  };
  const gl = renderer?.gl;
  if (!gl) return 2048; // WebGL 미지원(Canvas 폴백) 등 — 보수적인 기본값
  try {
    const raw = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    if (!raw || !Number.isFinite(raw)) return 2048;
    // 보고된 한계값 바로 근처에서도 실패하는 기기가 있어 여유를 좀 둔다.
    return Math.max(1024, Math.floor(raw) - 128);
  } catch {
    return 2048;
  }
}

// ─── 공개 API: 메인 베이킹 함수 ────────────────────────────────────
export interface BakeOptions {
  rooms: RoomDef[];
  hallways: HallwaySeg[];
  wallBevels: Array<{ x: number; y: number; w: number; h: number }>;
  worldW: number;
  worldH: number;
  /** 방 라벨 포함 여부 (기본 true) */
  includeLabels?: boolean;
  /** 문 표시(골드 바) 포함 여부 (기본 true) */
  includeDoors?: boolean;
  /** 추가 draw 콜백 — 인자로 받은 draw()로 그리면 타일 오프셋이 자동 적용된다 */
  extraDraw?: (draw: (obj: Phaser.GameObjects.GameObject, x?: number, y?: number) => void) => void;
}

/**
 * bakeStaticMap()
 *
 * 방 바닥 + 복도 + 소품 + 벽 bevel + 방 라벨 + 문 표시 + 기타 정적 요소를 미리 그려서
 * Image로 씬에 배치한다(매 프레임 라이브로 그리지 않기 위한 성능 최적화).
 *
 * 버그 수정(2026-08, "Framebuffer status: Incomplete Attachment" 크래시):
 * 예전에는 worldW × worldH(4700×3300) 크기의 RenderTexture를 통째로 1장만 만들었는데,
 * 이 크기가 기기 GPU의 GL_MAX_TEXTURE_SIZE(저사양 Android 기기는 종종 4096)를 넘으면
 * 텍스처 할당이 조용히 실패하고 프레임버퍼 부착 시점에 크래시했다. 이제는 기기가 실제로
 * 지원하는 최대 텍스처 크기를 확인해서, 그 크기를 넘지 않는 여러 개의 타일로 나눠 굽고
 * Image 여러 장으로 이어붙인다. 대부분의(4096 이상을 지원하는) 기기에서는 타일이 1개뿐이라
 * 기존과 동일하게 동작한다.
 */
export function bakeStaticMap(scene: Phaser.Scene, opts: BakeOptions): Phaser.GameObjects.Image[] {
  const {
    rooms, hallways, wallBevels, worldW, worldH,
    includeLabels = true,
    includeDoors = true,
    extraDraw,
  } = opts;

  const RT_KEY_PREFIX = "__staticMapRT__";
  // 씬 재시작 없이 재호출 방지 (같은 씬에서 두 번 호출될 경우, 이전 타일 텍스처를 정리)
  Object.keys(scene.textures.list)
    .filter((key) => key.startsWith(RT_KEY_PREFIX))
    .forEach((key) => scene.textures.remove(key));

  // ── 모든 정적 요소를 임시 GameObject로 "한 번만" 만들어 둔다.
  //    각 타일 RT에 이 객체들을 오프셋만 바꿔가며 반복해서 그린 뒤, 마지막에 한꺼번에 destroy한다. ──
  const drawables: Phaser.GameObjects.GameObject[] = [];

  // ① 복도 (방 아래에 깔림)
  const hallwayG = scene.make.graphics({ x: 0, y: 0 }, false);
  hallways.forEach((h) => _drawHallwayToGraphics(hallwayG, h));
  drawables.push(hallwayG);

  // ② 방 바닥 (복도 위)
  const floorG = scene.make.graphics({ x: 0, y: 0 }, false);
  rooms.forEach((room) => _drawRoomFloorToGraphics(floorG, room));
  drawables.push(floorG);

  // ③ 벽 bevel 선
  const bevelG = scene.make.graphics({ x: 0, y: 0 }, false);
  wallBevels.forEach(({ x, y, w, h }) => drawWallBevelToGraphics(bevelG, x, y, w, h));
  drawables.push(bevelG);

  // ④ 소품 (방 바닥 위)
  rooms.forEach((room) => drawables.push(..._buildPropDrawables(scene, room)));

  // ⑤ 문 표시 (골드 반투명 바)
  if (includeDoors) {
    const doorG = scene.make.graphics({ x: 0, y: 0 }, false);
    rooms.forEach((room) => {
      room.doors.forEach((door) => {
        doorG.fillStyle(0xffd700, 0.55);
        if (door.side === "top" || door.side === "bottom") {
          const y = door.side === "top" ? room.y : room.y + room.h;
          doorG.fillRect(door.at, y - 2, door.size, 4);
        } else {
          const x = door.side === "left" ? room.x : room.x + room.w;
          doorG.fillRect(x - 2, door.at, 4, door.size);
        }
      });
    });
    drawables.push(doorG);
  }

  // ⑥ 방 라벨
  if (includeLabels) {
    rooms.forEach((room) => {
      const txt = scene.make.text(
        { x: room.x + 10, y: room.y + 8, text: room.label,
          style: { fontSize: "12px", color: "#9aa" } },
        false
      );
      drawables.push(txt);
    });
  }

  // ── 타일 그리드 계산: 각 타일이 기기의 안전한 최대 텍스처 크기를 넘지 않도록 나눈다 ──
  const maxTex = getSafeMaxTextureSize(scene);
  const cols = Math.max(1, Math.ceil(worldW / maxTex));
  const rows = Math.max(1, Math.ceil(worldH / maxTex));
  const tileW = Math.ceil(worldW / cols);
  const tileH = Math.ceil(worldH / rows);

  const images: Phaser.GameObjects.Image[] = [];

  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const ox = tx * tileW;
      const oy = ty * tileH;
      const w = Math.min(tileW, worldW - ox);
      const h = Math.min(tileH, worldH - oy);
      if (w <= 0 || h <= 0) continue;

      const rt = scene.add.renderTexture(0, 0, w, h).setOrigin(0, 0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Phaser의 RenderTexture.draw()는
      // 넓은 유니온 타입(GameObject | GameObject[] | 문자열 키 | Texture ...)을 받는데, 우리는 항상
      // make.graphics/make.text/make.image로 만든 GameObject만 넘기므로 런타임에는 항상 안전하다.
      //
      // 버그 수정(2026-08): RenderTexture.draw(obj, x, y)의 x/y는 "오프셋"이 아니라 Group/Container가
      // 아닌 일반 GameObject에는 "정확한 그리기 좌표"로 쓰인다(Phaser 공식 문서: "For all other types
      // of object, the coordinates are exact"). 그런데 기존 코드는 x/y를 안 넘긴 호출(drawAtTile(obj))에
      // 기본값 0을 써버려서, room.x+p.x 같은 실제 월드 좌표로 만들어 둔 소품 Image·라벨 Text가 전부
      // 타일 좌상단(0,0) 한 점에 겹쳐 찍히고 있었다 — 즉 가구·아이콘·방 라벨이 화면상 실제로는 전혀
      // 안 보이던 원인. Graphics(바닥/복도/문/러그 등)는 애초에 (0,0)에서 만들고 도형 좌표 자체가
      // 절대좌표라 이 버그의 영향을 받지 않아 "바닥 무늬는 보이는데 가구만 안 보이는" 상태였다.
      // 수정: x/y를 명시하지 않으면 객체 자신의 x/y(만들 때 지정한 실제 월드 좌표)를 그대로 쓴다.
      const drawAtTile = (obj: Phaser.GameObjects.GameObject, x?: number, y?: number) => {
        const anyObj = obj as unknown as { x?: number; y?: number };
        const dx = x ?? anyObj.x ?? 0;
        const dy = y ?? anyObj.y ?? 0;
        rt.draw(obj as any, dx - ox, dy - oy);
      };

      drawables.forEach((obj) => drawAtTile(obj));
      // 추가 콜백(층 안내판, 기도실 표시 등) — draw()로 그리면 이 타일의 오프셋이 자동 적용된다
      extraDraw?.(drawAtTile);

      const key = `${RT_KEY_PREFIX}${tx}_${ty}`;
      rt.saveTexture(key);
      rt.destroy();

      images.push(scene.add.image(ox, oy, key).setOrigin(0, 0).setDepth(0));
    }
  }

  // 타일마다 재사용했던 임시 GameObject들은 이제 모두 정리
  drawables.forEach((obj) => obj.destroy());

  return images;
}

// ─── 하위호환 export (MainScene 외부에서 직접 쓰는 곳이 있을 경우를 위해 유지) ───
// 2단계 이후에는 MainScene이 bakeStaticMap()만 호출하므로 아래 함수들은
// 내부적으로만 사용된다. 외부에서 직접 호출하지 말 것.
/** @deprecated bakeStaticMap 사용 권장 */
export function drawRoomFloor(_scene: Phaser.Scene, _room: RoomDef): void {
  console.warn("[RoomDecor] drawRoomFloor는 deprecated. bakeStaticMap을 사용하세요.");
}
/** @deprecated bakeStaticMap 사용 권장 */
export function drawHallwayDeco(_scene: Phaser.Scene, _h: HallwaySeg): void {
  console.warn("[RoomDecor] drawHallwayDeco는 deprecated. bakeStaticMap을 사용하세요.");
}
/** @deprecated bakeStaticMap 사용 권장 */
export function drawProps(_scene: Phaser.Scene, _room: RoomDef): void {
  console.warn("[RoomDecor] drawProps는 deprecated. bakeStaticMap을 사용하세요.");
}