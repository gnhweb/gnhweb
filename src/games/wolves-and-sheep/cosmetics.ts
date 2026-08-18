import Phaser from "phaser";

/**
 * 코스메틱(모자/펫) 시스템.
 *
 * - 이미지 에셋 없이 BeanCharacter/RoomDecor와 동일한 방식(Graphics로 텍스처 생성)으로 그린다.
 * - 해금 기준은 일단 "이 기기에서 누적한 플레이 기록"(localStorage)만 본다 — 교회 앱의
 *   출석/참여 포인트 시스템과 연결하고 싶다면 loadCosmeticStats()의 반환값을 그 데이터 소스로
 *   바꿔치기만 하면 된다(이 파일의 나머지 로직은 그대로 재사용 가능).
 */

// ---------- 진행도(통계) ----------

export interface CosmeticStats {
  gamesPlayed: number;
  gamesWon: number;
  tasksCompleted: number;
}

const STATS_KEY = "wolves-sheep-cosmetic-stats-v1";
const EQUIP_KEY = "wolves-sheep-equipped-v1";

const DEFAULT_STATS: CosmeticStats = { gamesPlayed: 0, gamesWon: 0, tasksCompleted: 0 };

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

export function loadCosmeticStats(): CosmeticStats {
  if (typeof localStorage === "undefined") return DEFAULT_STATS;
  return safeParse(localStorage.getItem(STATS_KEY), DEFAULT_STATS);
}

function saveCosmeticStats(stats: CosmeticStats) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

/** 미션 하나 완료할 때마다 호출(자기 자신의 완료만 — GameManager.completeTask에서 사용) */
export function recordTaskCompletion(): CosmeticStats {
  const stats = loadCosmeticStats();
  stats.tasksCompleted += 1;
  saveCosmeticStats(stats);
  return stats;
}

/** 게임이 끝날 때마다(승/패 무관) 1회 호출 */
export function recordGameCompletion(won: boolean): CosmeticStats {
  const stats = loadCosmeticStats();
  stats.gamesPlayed += 1;
  if (won) stats.gamesWon += 1;
  saveCosmeticStats(stats);
  return stats;
}

// ---------- 장착 상태 ----------

export interface EquippedCosmetics {
  hat: string | null;
  pet: string | null;
}

export function loadEquipped(): EquippedCosmetics {
  if (typeof localStorage === "undefined") return { hat: null, pet: null };
  return safeParse(localStorage.getItem(EQUIP_KEY), { hat: null, pet: null } as EquippedCosmetics);
}

export function saveEquipped(equipped: EquippedCosmetics) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(EQUIP_KEY, JSON.stringify(equipped));
}

// ---------- 카탈로그 ----------

export type UnlockRule =
  | { type: "free" }
  | { type: "tasks"; amount: number }
  | { type: "games"; amount: number }
  | { type: "wins"; amount: number };

export interface CosmeticDef {
  id: string;
  name: string;
  /** 잠금 상태일 때 목록에 보여줄 이모지 (텍스처 로드 전에도 즉시 표시 가능) */
  emoji: string;
  unlock: UnlockRule;
  /** 미니맵 마커 등에 쓸 액센트 색 */
  accent: number;
  draw: (g: Phaser.GameObjects.Graphics) => void;
  w: number;
  h: number;
}

export function unlockLabel(rule: UnlockRule): string {
  switch (rule.type) {
    case "free":
      return "기본 지급";
    case "tasks":
      return `누적 미션 ${rule.amount}회 완료`;
    case "games":
      return `누적 게임 ${rule.amount}판 참여`;
    case "wins":
      return `누적 승리 ${rule.amount}회`;
  }
}

export function isUnlocked(rule: UnlockRule, stats: CosmeticStats): boolean {
  switch (rule.type) {
    case "free":
      return true;
    case "tasks":
      return stats.tasksCompleted >= rule.amount;
    case "games":
      return stats.gamesPlayed >= rule.amount;
    case "wins":
      return stats.gamesWon >= rule.amount;
  }
}

/** rule을 만족하기까지 얼마나 남았는지 0~1 진행률로 (해금됐으면 1) */
export function unlockProgress(rule: UnlockRule, stats: CosmeticStats): number {
  if (rule.type === "free") return 1;
  const have = rule.type === "tasks" ? stats.tasksCompleted : rule.type === "games" ? stats.gamesPlayed : stats.gamesWon;
  return Math.min(1, have / rule.amount);
}

const INK = 0x1c1e30;

export const HAT_CATALOG: CosmeticDef[] = [
  {
    id: "none",
    name: "맨머리",
    emoji: "🙂",
    unlock: { type: "free" },
    accent: 0xffffff,
    w: 1,
    h: 1,
    draw: () => {},
  },
  {
    id: "halo",
    name: "후광",
    emoji: "😇",
    unlock: { type: "free" },
    accent: 0xffe066,
    w: 26,
    h: 12,
    draw: (g) => {
      g.lineStyle(3, 0xffe066, 1);
      g.strokeEllipse(13, 6, 20, 8);
      g.lineStyle(1.5, 0xfff3bf, 0.9);
      g.strokeEllipse(13, 6, 20, 8);
    },
  },
  {
    id: "ribbon",
    name: "리본",
    emoji: "🎀",
    unlock: { type: "tasks", amount: 5 },
    accent: 0xff8fa3,
    w: 22,
    h: 16,
    draw: (g) => {
      g.fillStyle(0xff8fa3, 1);
      g.fillTriangle(11, 8, 1, 1, 1, 15);
      g.fillTriangle(11, 8, 21, 1, 21, 15);
      g.fillStyle(0xe8607c, 1);
      g.fillCircle(11, 8, 4);
      g.lineStyle(1.5, INK, 0.8);
      g.strokeCircle(11, 8, 4);
    },
  },
  {
    id: "star_band",
    name: "별머리띠",
    emoji: "⭐",
    unlock: { type: "tasks", amount: 15 },
    accent: 0xffd43b,
    w: 30,
    h: 16,
    draw: (g) => {
      g.fillStyle(0x495057, 1);
      g.fillRoundedRect(0, 8, 30, 5, 2.5);
      drawStar(g, 15, 6, 8, 3.5, 0xffd43b);
    },
  },
  {
    id: "flower_crown",
    name: "화관",
    emoji: "🌸",
    unlock: { type: "tasks", amount: 30 },
    accent: 0xff8fa3,
    w: 32,
    h: 16,
    draw: (g) => {
      g.fillStyle(0x69db7c, 1);
      g.fillRoundedRect(2, 9, 28, 4, 2);
      const cols = [0xff8fa3, 0xffe066, 0xb197fc, 0x74c0fc, 0xff8fa3];
      cols.forEach((c, i) => {
        const fx = 4 + i * 6.5;
        g.fillStyle(c, 1);
        g.fillCircle(fx, 7, 3.4);
        g.fillStyle(0xffe066, 1);
        g.fillCircle(fx, 7, 1.2);
      });
    },
  },
  {
    id: "party_hat",
    name: "고깔모자",
    emoji: "🎉",
    unlock: { type: "games", amount: 3 },
    accent: 0x74c0fc,
    w: 26,
    h: 26,
    draw: (g) => {
      g.fillStyle(0x74c0fc, 1);
      g.fillTriangle(13, 0, 2, 24, 24, 24);
      g.lineStyle(2, INK, 0.7);
      g.strokeTriangle(13, 0, 2, 24, 24, 24);
      g.fillStyle(0xffe066, 1);
      g.fillCircle(13, 0, 3);
      [8, 13, 18].forEach((y) => {
        g.fillStyle(0xffffff, 0.9);
        g.fillCircle(13 - (24 - y) * 0.22, y + 4, 1.6);
      });
    },
  },
  {
    id: "crown",
    name: "왕관",
    emoji: "👑",
    unlock: { type: "games", amount: 10 },
    accent: 0xffd700,
    w: 30,
    h: 20,
    draw: (g) => {
      g.fillStyle(0xffd700, 1);
      g.fillPoints(
        [
          new Phaser.Geom.Point(2, 20),
          new Phaser.Geom.Point(2, 10),
          new Phaser.Geom.Point(9, 15),
          new Phaser.Geom.Point(15, 4),
          new Phaser.Geom.Point(21, 15),
          new Phaser.Geom.Point(28, 10),
          new Phaser.Geom.Point(28, 20),
        ],
        true
      );
      g.lineStyle(1.5, 0xb8860b, 1);
      g.strokePoints(
        [
          new Phaser.Geom.Point(2, 20),
          new Phaser.Geom.Point(2, 10),
          new Phaser.Geom.Point(9, 15),
          new Phaser.Geom.Point(15, 4),
          new Phaser.Geom.Point(21, 15),
          new Phaser.Geom.Point(28, 10),
          new Phaser.Geom.Point(28, 20),
        ],
        true
      );
      g.fillStyle(0xff6b6b, 1);
      g.fillCircle(15, 12, 2.4);
    },
  },
  {
    id: "cat_ears",
    name: "고양이 귀",
    emoji: "🐱",
    unlock: { type: "wins", amount: 3 },
    accent: 0xffa94d,
    w: 30,
    h: 18,
    draw: (g) => {
      [4, 26].forEach((cx) => {
        g.fillStyle(0xffa94d, 1);
        g.fillTriangle(cx - 6, 18, cx, 2, cx + 6, 18);
        g.lineStyle(1.5, INK, 0.7);
        g.strokeTriangle(cx - 6, 18, cx, 2, cx + 6, 18);
        g.fillStyle(0xffd8bf, 1);
        g.fillTriangle(cx - 3, 15, cx, 7, cx + 3, 15);
      });
    },
  },
  {
    id: "shepherd_staff_hat",
    name: "목자 두건",
    emoji: "🧕",
    unlock: { type: "wins", amount: 10 },
    accent: 0x63e6be,
    w: 30,
    h: 22,
    draw: (g) => {
      g.fillStyle(0x63e6be, 1);
      g.fillRoundedRect(0, 4, 30, 14, { tl: 15, tr: 15, bl: 4, br: 4 });
      g.lineStyle(2, 0x2f9e79, 0.9);
      g.strokeRoundedRect(0, 4, 30, 14, { tl: 15, tr: 15, bl: 4, br: 4 });
      g.fillStyle(0x2f9e79, 1);
      g.fillRect(0, 14, 30, 4);
    },
  },
];

export const PET_CATALOG: CosmeticDef[] = [
  { id: "none", name: "펫 없음", emoji: "—", unlock: { type: "free" }, accent: 0xffffff, w: 1, h: 1, draw: () => {} },
  {
    id: "chick",
    name: "병아리",
    emoji: "🐤",
    unlock: { type: "tasks", amount: 8 },
    accent: 0xffe066,
    w: 18,
    h: 16,
    draw: (g) => {
      g.fillStyle(0xffe066, 1);
      g.fillCircle(9, 9, 7);
      g.fillStyle(0xff922b, 1);
      g.fillTriangle(9, 9, 15, 7, 15, 11);
      g.fillStyle(INK, 1);
      g.fillCircle(7, 6, 1.3);
    },
  },
  {
    id: "firefly",
    name: "반딧불이",
    emoji: "✨",
    unlock: { type: "tasks", amount: 20 },
    accent: 0xffe066,
    w: 14,
    h: 14,
    draw: (g) => {
      g.fillStyle(0xffe066, 0.35);
      g.fillCircle(7, 7, 7);
      g.fillStyle(0xfff3bf, 1);
      g.fillCircle(7, 7, 3.2);
    },
  },
  {
    id: "puppy",
    name: "강아지",
    emoji: "🐶",
    unlock: { type: "games", amount: 5 },
    accent: 0xc98a44,
    w: 20,
    h: 18,
    draw: (g) => {
      g.fillStyle(0xc98a44, 1);
      g.fillEllipse(10, 11, 13, 11);
      g.fillEllipse(3, 6, 6, 9);
      g.fillEllipse(17, 6, 6, 9);
      g.fillStyle(0x8a5a2f, 1);
      g.fillCircle(6, 10, 1.4);
      g.fillCircle(14, 10, 1.4);
      g.fillCircle(10, 14, 1.6);
    },
  },
  {
    id: "balloon",
    name: "풍선",
    emoji: "🎈",
    unlock: { type: "wins", amount: 5 },
    accent: 0xff8fa3,
    w: 16,
    h: 26,
    draw: (g) => {
      g.fillStyle(0xff8fa3, 1);
      g.fillEllipse(8, 8, 13, 15);
      g.lineStyle(1, 0xb8506a, 1);
      g.lineBetween(8, 15, 8, 26);
    },
  },
];

function drawStar(g: Phaser.GameObjects.Graphics, cx: number, cy: number, outerR: number, innerR: number, color: number) {
  const pts: Phaser.Geom.Point[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(new Phaser.Geom.Point(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  g.fillStyle(color, 1);
  g.fillPoints(pts, true);
}

export function findHat(id: string | null | undefined): CosmeticDef {
  return HAT_CATALOG.find((h) => h.id === id) ?? HAT_CATALOG[0];
}

export function findPet(id: string | null | undefined): CosmeticDef {
  return PET_CATALOG.find((p) => p.id === id) ?? PET_CATALOG[0];
}

/** 해당 코스메틱의 Phaser 텍스처를 (세션당 1회) 생성해 텍스처 키를 반환한다. */
export function ensureCosmeticTexture(scene: Phaser.Scene, def: CosmeticDef): string {
  const key = `cosmetic-${def.id}`;
  if (def.id === "none" || def.id.endsWith("-none")) return key; // 렌더링 스킵용, 텍스처 불필요
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  def.draw(g);
  g.generateTexture(key, def.w, def.h);
  g.destroy();
  return key;
}