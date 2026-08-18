import { RoomDef, HallwaySeg } from "./types";

export interface WallRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 방(ROOMS)과 복도(HALLWAYS)를 합친 "걸어다닐 수 있는 영역"을 격자로 스캔해서,
 * 그 영역의 바깥 경계에만 얇은 벽을 자동으로 세운다.
 * - 문이 있는 자리는 방/복도가 서로 맞닿아 있어서 자동으로 벽이 생기지 않는다(뚫려 있음).
 * - 방/복도가 하나도 없는 빈 공간(사진에서 동그라미 친 부분들)은 전부 벽으로 막힌다.
 * - 맵 가장자리(월드 경계)도 자연스럽게 막힌다.
 *
 * 씬 생성 시 한 번만 계산하면 되는 순수 기하 연산이라 매 프레임 비용은 없다.
 */
export function buildOuterWalls(
  rooms: RoomDef[],
  hallways: HallwaySeg[],
  worldW: number,
  worldH: number,
  cell = 20,
  thickness = 10
): WallRect[] {
  const cols = Math.ceil(worldW / cell);
  const rows = Math.ceil(worldH / cell);
  const open = new Uint8Array(cols * rows);

  const markRect = (rx: number, ry: number, rw: number, rh: number) => {
    const x0 = Math.max(0, Math.floor(rx / cell));
    const y0 = Math.max(0, Math.floor(ry / cell));
    const x1 = Math.min(cols, Math.ceil((rx + rw) / cell));
    const y1 = Math.min(rows, Math.ceil((ry + rh) / cell));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) open[y * cols + x] = 1;
    }
  };
  rooms.forEach((r) => markRect(r.x, r.y, r.w, r.h));
  hallways.forEach((h) => markRect(h.x, h.y, h.w, h.h));

  const isOpen = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return false;
    return open[y * cols + x] === 1;
  };

  const walls: WallRect[] = [];

  // 세로 방향 경계(좌우로 열림/막힘이 갈리는 x선) — 같은 x선 위에서 연속된 구간을 하나로 합친다.
  for (let x = 0; x <= cols; x++) {
    let runStart = -1;
    for (let y = 0; y <= rows; y++) {
      const differs = y < rows && isOpen(x - 1, y) !== isOpen(x, y);
      if (differs) {
        if (runStart === -1) runStart = y;
      } else if (runStart !== -1) {
        walls.push({ x: x * cell - thickness / 2, y: runStart * cell, w: thickness, h: (y - runStart) * cell });
        runStart = -1;
      }
    }
  }

  // 가로 방향 경계(위아래로 열림/막힘이 갈리는 y선)
  for (let y = 0; y <= rows; y++) {
    let runStart = -1;
    for (let x = 0; x <= cols; x++) {
      const differs = x < cols && isOpen(x, y - 1) !== isOpen(x, y);
      if (differs) {
        if (runStart === -1) runStart = x;
      } else if (runStart !== -1) {
        walls.push({ x: runStart * cell, y: y * cell - thickness / 2, w: (x - runStart) * cell, h: thickness });
        runStart = -1;
      }
    }
  }

  return walls;
}