import { vec, type Polygon } from "./geometry";
import { pointInPolygon } from "./offset";

export type Box = { x: number; y: number; width: number; height: number };

/**
 * True if every sample point of `box` lies inside one of `tiles`. Samples are spaced a
 * quarter of `tileWidth` apart and offset by odd fractions, so they don't line up with
 * the lattice lines that monotile edges follow (a point exactly on an edge could be
 * reported as uncovered).
 */
export function coversBox(tiles: Polygon[], box: Box, tileWidth: number): boolean {
  const cell = tileWidth;
  const grid = new Map<string, Polygon[]>();
  for (const t of tiles) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of t) {
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
    }
    for (let i = Math.floor(x0 / cell); i <= Math.floor(x1 / cell); i++) {
      for (let j = Math.floor(y0 / cell); j <= Math.floor(y1 / cell); j++) {
        const k = `${i},${j}`;
        const list = grid.get(k);
        if (list) list.push(t);
        else grid.set(k, [t]);
      }
    }
  }
  const step = tileWidth / 4;
  const nx = Math.max(1, Math.ceil(box.width / step));
  const ny = Math.max(1, Math.ceil(box.height / step));
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j <= ny; j++) {
      const p = vec(box.x + ((i + 0.1234567) / (nx + 0.2469134)) * box.width, box.y + ((j + 0.0987654) / (ny + 0.1975308)) * box.height);
      const bucket = grid.get(`${Math.floor(p.x / cell)},${Math.floor(p.y / cell)}`);
      if (!bucket || !bucket.some((t) => pointInPolygon(p, t))) return false;
    }
  }
  return true;
}

export const grow = (b: Box, d: number): Box => ({ x: b.x - d, y: b.y - d, width: b.width + 2 * d, height: b.height + 2 * d });

export const boxesOverlap = (a: { x0: number; y0: number; x1: number; y1: number }, b: Box) =>
  a.x1 >= b.x && a.x0 <= b.x + b.width && a.y1 >= b.y && a.y0 <= b.y + b.height;
