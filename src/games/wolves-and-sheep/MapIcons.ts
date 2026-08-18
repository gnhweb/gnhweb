import Phaser from "phaser";
import { TaskType } from "./types";

/**
 * ──────────────────────────────────────────────────────────────────
 * 미션/기도/숨숨 마커 아이콘
 * ──────────────────────────────────────────────────────────────────
 * 예전엔 미션·기도실·비상벨·숨숨 지점이 전부 색깔만 다른 동그라미(circle)였다.
 * RoomDecor.ts의 소품(prop)들과 같은 방식(Graphics로 한 번 그려서 generateTexture로
 * 캐싱)으로 각 지점 성격에 맞는 작은 아이콘을 만들어 그 자리에 대신 쓴다.
 *
 * 성능 노트: 텍스처는 씬당 한 번만 생성되어 캐시되고(scene.textures.exists 체크),
 * 이후엔 Image 하나로 재사용된다 — 기존에 circle GameObject 하나 쓰던 자리에
 * image GameObject 하나가 들어가는 것뿐이라 라이브 오브젝트 개수와 드로우콜은
 * 기존과 동일하다. 프레임 비용 증가 없음.
 */

function shadow(g: Phaser.GameObjects.Graphics, cx: number, cy: number, rx: number, ry: number) {
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(cx, cy, rx, ry);
}

// ─── 미션(TaskType) 아이콘 ──────────────────────────────────────────
export function ensureTaskIconTexture(scene: Phaser.Scene, type: TaskType): string {
  const key = `icon-task-${type}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const W = 32, H = 32;
  const cx = W / 2, cy = H / 2;

  // 공통 배경 배지(짙은 원판 + 금색 테두리) — 어떤 타입이든 "여기 미션 있음"이 한눈에 보이게
  g.fillStyle(0x1c1e30, 0.92);
  g.fillCircle(cx, cy, 15);
  g.lineStyle(2, 0xffd700, 0.85);
  g.strokeCircle(cx, cy, 15);

  switch (type) {
    case "typing": // 방문록 타자 — 클립보드 + 펜
      g.fillStyle(0xf5f0e6, 1);
      g.fillRoundedRect(cx - 7, cy - 9, 14, 18, 2);
      g.fillStyle(0x6b4a2f, 1);
      g.fillRect(cx - 3, cy - 11, 6, 3);
      g.lineStyle(1.2, 0x8a8a99, 0.9);
      g.lineBetween(cx - 4, cy - 3, cx + 4, cy - 3);
      g.lineBetween(cx - 4, cy + 1, cx + 4, cy + 1);
      g.lineBetween(cx - 4, cy + 5, cx + 1, cy + 5);
      g.lineStyle(2, 0xd85a30, 1);
      g.lineBetween(cx + 5, cy - 8, cx + 8, cy - 11);
      break;
    case "offering": // 모금함 — 상자 + 동전 슬롯
      g.fillStyle(0x8a5a2f, 1);
      g.fillRoundedRect(cx - 9, cy - 4, 18, 12, 2);
      g.fillStyle(0x6b4320, 1);
      g.fillTriangle(cx - 9, cy - 4, cx + 9, cy - 4, cx, cy - 11);
      g.fillStyle(0xffd700, 1);
      g.fillRect(cx - 3, cy - 8, 6, 2);
      g.fillCircle(cx, cy + 8, 3);
      break;
    case "dragdrop": // 미술 도구 정리 — 팔레트
      g.fillStyle(0x9c7a4a, 1);
      g.fillEllipse(cx - 1, cy, 10, 8);
      g.fillStyle(0x1c1e30, 1);
      g.fillEllipse(cx + 5, cy, 3, 2.4);
      [0xd85a30, 0xffd700, 0x74c0fc, 0x69db7c].forEach((c, i) => {
        g.fillStyle(c, 1);
        g.fillCircle(cx - 5 + (i % 2) * 5, cy - 3 + Math.floor(i / 2) * 6, 1.8);
      });
      break;
    case "sort": // 악보/책 정리 — 겹친 종이 + 음표
      g.fillStyle(0xf5f0e6, 1);
      g.fillRect(cx - 7, cy - 8, 12, 15);
      g.fillStyle(0xe6ddc8, 1);
      g.fillRect(cx - 5, cy - 6, 12, 15);
      g.fillStyle(0x2b2b3a, 1);
      g.fillCircle(cx + 2, cy + 6, 2.2);
      g.fillRect(cx + 4, cy - 3, 1.6, 9);
      break;
    case "timing": // 건반 타이밍 — 메트로놈
      g.fillStyle(0x6b4a2f, 1);
      g.fillTriangle(cx - 7, cy + 9, cx + 7, cy + 9, cx, cy - 10);
      g.fillStyle(0xffd700, 1);
      g.fillRect(cx - 1, cy - 6, 2, 12);
      g.fillCircle(cx, cy - 6, 2);
      break;
    case "mixer": // 믹서기 — 그릇 + 거품기
      g.fillStyle(0xd7dde3, 1);
      g.fillEllipse(cx, cy + 4, 11, 7);
      g.fillStyle(0x9aa4ad, 1);
      g.fillEllipse(cx, cy + 2, 11, 5);
      g.lineStyle(2, 0x6b4a2f, 1);
      g.lineBetween(cx + 6, cy - 9, cx + 2, cy);
      break;
    case "memory": // 창고 물품 기억 — 물음표 박스
      g.fillStyle(0xc98a44, 1);
      g.fillRect(cx - 8, cy - 6, 16, 12);
      g.lineStyle(1.2, 0x6b4a1f, 0.8);
      g.strokeRect(cx - 8, cy - 6, 16, 12);
      g.fillStyle(0x2b2b3a, 1);
      g.fillCircle(cx, cy, 1.6);
      break;
    case "maze": // 박스 미로 — 미로 그리드
      g.lineStyle(2, 0xe0575c, 1);
      g.strokeRect(cx - 8, cy - 8, 16, 16);
      g.lineBetween(cx - 8, cy - 2, cx + 2, cy - 2);
      g.lineBetween(cx + 8, cy + 3, cx - 2, cy + 3);
      break;
    case "mash": // 배너 연타 — 깃발
      g.lineStyle(2, 0x8a8a99, 1);
      g.lineBetween(cx - 6, cy - 10, cx - 6, cy + 10);
      g.fillStyle(0xe0575c, 1);
      g.fillTriangle(cx - 6, cy - 9, cx - 6, cy - 1, cx + 8, cy - 5);
      break;
    case "wiring": // 배선 연결 — 플러그 + 케이블
      g.lineStyle(2.4, 0xffd700, 1);
      g.lineBetween(cx - 8, cy + 6, cx + 2, cy - 4);
      g.fillStyle(0x2dd4bf, 1);
      g.fillCircle(cx + 5, cy - 7, 3.4);
      g.fillStyle(0x1c1e30, 1);
      g.fillCircle(cx + 5, cy - 7, 1.4);
      break;
    case "match": // 카드 짝맞추기 — 겹친 카드 두 장
      g.fillStyle(0x2b2b3a, 1);
      g.fillRoundedRect(cx - 4, cy - 8, 11, 15, 2);
      g.lineStyle(1, 0x8a8a99, 0.9);
      g.strokeRoundedRect(cx - 4, cy - 8, 11, 15, 2);
      g.fillStyle(0xf5f0e6, 1);
      g.fillRoundedRect(cx - 8, cy - 5, 11, 15, 2);
      g.lineStyle(1, 0x1c1e30, 0.6);
      g.strokeRoundedRect(cx - 8, cy - 5, 11, 15, 2);
      g.fillStyle(0xd85a30, 1);
      g.fillCircle(cx - 3, cy + 3, 2.2);
      break;
    case "quiz": // OX 퀴즈 — O와 X
      g.lineStyle(2.2, 0x69db7c, 1);
      g.strokeCircle(cx - 5, cy, 4.5);
      g.lineStyle(2.2, 0xe0575c, 1);
      g.lineBetween(cx + 2, cy - 4, cx + 8, cy + 4);
      g.lineBetween(cx + 8, cy - 4, cx + 2, cy + 4);
      break;
    case "puzzle": // 번호표 퍼즐 — 숫자 타일 그리드
      [0, 1].forEach((row) =>
        [0, 1].forEach((col) => {
          g.fillStyle(row === 0 && col === 0 ? 0xffd700 : 0xd7dde3, 1);
          g.fillRoundedRect(cx - 9 + col * 10, cy - 9 + row * 10, 8, 8, 1.5);
        })
      );
      break;
    case "whack": // 그릇 씻기 — 반짝이는 접시
      g.fillStyle(0xd7dde3, 1);
      g.fillEllipse(cx, cy + 2, 12, 7);
      g.lineStyle(1.2, 0x9aa4ad, 0.9);
      g.strokeEllipse(cx, cy + 2, 12, 7);
      g.fillStyle(0xffffff, 0.95);
      g.fillTriangle(cx + 4, cy - 8, cx + 7, cy - 8, cx + 5.5, cy - 3);
      g.fillTriangle(cx - 2, cy - 9, cx, cy - 9, cx - 1, cy - 5);
      break;
    case "balance": // 균형 잡기 — 저울대
      g.lineStyle(2, 0xcdb27a, 1);
      g.lineBetween(cx - 9, cy - 2, cx + 9, cy - 2);
      g.lineBetween(cx, cy - 2, cx, cy + 8);
      g.fillStyle(0x8a5a2f, 1);
      g.fillRoundedRect(cx - 4, cy + 7, 8, 3, 1);
      g.lineStyle(1.4, 0xcdb27a, 0.9);
      g.strokeEllipse(cx - 9, cy + 1, 6, 3);
      g.strokeEllipse(cx + 9, cy + 1, 6, 3);
      break;
    case "water": // 화분 물주기 — 물뿌리개
      g.fillStyle(0x3aa0c9, 1);
      g.fillRoundedRect(cx - 8, cy - 2, 12, 9, 2);
      g.fillTriangle(cx + 4, cy - 1, cx + 11, cy - 6, cx + 11, cy + 1);
      g.fillStyle(0xbfe6f5, 0.9);
      g.fillCircle(cx + 12, cy - 7, 1.6);
      g.fillCircle(cx + 14, cy - 4, 1.2);
      break;
    case "lock": // 다이얼 자물쇠 — 자물쇠 몸통 + 고리
      g.lineStyle(2.4, 0xcdb27a, 1);
      g.strokeCircle(cx, cy - 5, 4.5);
      g.fillStyle(0x8a5a2f, 1);
      g.fillRoundedRect(cx - 7, cy - 3, 14, 11, 2);
      g.fillStyle(0x1c1e30, 1);
      g.fillCircle(cx, cy + 2, 1.8);
      break;
    case "bells": // 핸드벨 — 종 두 개
      [-5, 5].forEach((dx, i) => {
        g.fillStyle(i === 0 ? 0xd85a30 : 0x74c0fc, 1);
        g.fillTriangle(cx + dx - 4, cy + 6, cx + dx + 4, cy + 6, cx + dx, cy - 6);
        g.fillStyle(0xffd700, 1);
        g.fillCircle(cx + dx, cy + 7, 1.6);
      });
      break;
  }

  g.generateTexture(key, W, H);
  g.destroy();
  return key;
}

// ─── 기도실 / 비상벨 아이콘 ─────────────────────────────────────────
export function ensurePrayerIconTexture(scene: Phaser.Scene): string {
  const key = "icon-prayer";
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const W = 30, H = 34;
  const cx = W / 2;
  // 촛대 + 촛불 — 은은한 기도실 분위기
  shadow(g, cx, H - 6, 12, 3);
  g.fillStyle(0xcdb27a, 1);
  g.fillRoundedRect(cx - 5, H - 14, 10, 9, 2);
  g.fillStyle(0xf5f0e6, 1);
  g.fillRect(cx - 2, H - 22, 4, 10);
  g.fillStyle(0xffb238, 0.95);
  g.fillEllipse(cx, H - 24, 5, 8);
  g.fillStyle(0xffe6a8, 0.9);
  g.fillEllipse(cx, H - 25, 2.4, 4);
  g.generateTexture(key, W, H);
  g.destroy();
  return key;
}

export function ensureBellIconTexture(scene: Phaser.Scene): string {
  const key = "icon-bell";
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const W = 30, H = 30;
  const cx = W / 2;
  shadow(g, cx, H - 5, 11, 3);
  g.fillStyle(0xffcc33, 1);
  g.fillTriangle(cx - 9, H - 10, cx + 9, H - 10, cx, H - 24);
  g.fillEllipse(cx, H - 10, 20, 6);
  g.fillStyle(0xaa4444, 1);
  g.fillCircle(cx, H - 4, 3);
  g.lineStyle(1.2, 0x8a6a1a, 0.8);
  g.strokeEllipse(cx, H - 10, 20, 6);
  g.generateTexture(key, W, H);
  g.destroy();
  return key;
}

// ─── 숨숨 지점 아이콘 (5곳, id별로 라벨에 맞는 모양) ───────────────
export function ensureHideIconTexture(scene: Phaser.Scene, id: string): string {
  const key = `icon-hide-${id}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const W = 30, H = 30;
  const cx = W / 2, cy = H / 2;

  // 공통: 은신처다운 은은한 보라 링 배지
  g.fillStyle(0x2b1f3a, 0.55);
  g.fillCircle(cx, cy, 14);
  g.lineStyle(1.4, 0x9333ea, 0.6);
  g.strokeCircle(cx, cy, 14);

  switch (id) {
    case "hide-desk": // 안내 데스크 아래
      g.fillStyle(0x6b4a2f, 1);
      g.fillRect(cx - 9, cy - 2, 18, 3);
      g.fillStyle(0x4a3320, 1);
      g.fillRect(cx - 8, cy + 1, 3, 8);
      g.fillRect(cx + 5, cy + 1, 3, 8);
      break;
    case "hide-curtain": // 무용실 커튼 뒤
      for (let i = 0; i < 4; i++) {
        g.fillStyle(i % 2 === 0 ? 0x9c3232 : 0x7a2424, 1);
        g.fillRect(cx - 10 + i * 5, cy - 9, 5, 18);
      }
      break;
    case "hide-box": // 창고 박스 뒤
      g.fillStyle(0xc98a44, 1);
      g.fillRect(cx - 8, cy - 3, 16, 12);
      g.fillStyle(0xa5702f, 1);
      g.fillRect(cx - 8, cy - 8, 16, 6);
      g.lineStyle(1, 0x6b4a1f, 0.8);
      g.strokeRect(cx - 8, cy - 8, 16, 17);
      break;
    case "hide-pantry": // 주방 선반 뒤
      g.fillStyle(0x4a3320, 1);
      g.fillRect(cx - 9, cy - 9, 18, 3);
      g.fillRect(cx - 9, cy + 2, 18, 3);
      g.fillStyle(0xd85a30, 0.9);
      g.fillRect(cx - 6, cy - 6, 5, 4);
      g.fillStyle(0x69db7c, 0.9);
      g.fillRect(cx + 1, cy + 5, 5, 4);
      break;
    case "hide-lounge": // 휴게실 소파 뒤
    default:
      g.fillStyle(0x4a5a8a, 1);
      g.fillRoundedRect(cx - 10, cy - 2, 20, 9, 3);
      g.fillRoundedRect(cx - 10, cy - 8, 6, 8, 2);
      g.fillRoundedRect(cx + 4, cy - 8, 6, 8, 2);
      break;
  }

  g.generateTexture(key, W, H);
  g.destroy();
  return key;
}