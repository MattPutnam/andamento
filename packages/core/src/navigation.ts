import type { Cell, Layout } from "./layout";

export type Direction = "up" | "down" | "left" | "right";

const DIRS: Record<Direction, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/**
 * The cell to move to from `from` in a direction, for arrow-key navigation over any tiling.
 *
 * Looks at cells whose centre lies ahead (within 60° of the direction first, then anywhere
 * ahead) and picks the nearest, with sideways distance counting double, so moving keeps to
 * a "row" or "column" where the tiling has one. `accept` limits it to some cells (those
 * with content, say). Returns undefined at the edge.
 */
export function cellInDirection(layout: Layout, from: Cell, direction: Direction, accept: (cell: Cell) => boolean = () => true): Cell | undefined {
  const [dx, dy] = DIRS[direction];
  const size = Math.sqrt(Math.max(from.area, 1e-12));
  const eps = 1e-6 * size;
  const cone = Math.tan(Math.PI / 3);
  let best: Cell | undefined, bestScore = Infinity;
  let fallback: Cell | undefined, fallbackScore = Infinity;
  for (const c of layout.cells) {
    if (c === from || !accept(c)) continue;
    const ox = c.centroid.x - from.centroid.x, oy = c.centroid.y - from.centroid.y;
    const along = ox * dx + oy * dy;
    if (along <= eps) continue;
    const across = Math.abs(ox * dy - oy * dx);
    const score = along + 2 * across;
    if (across <= along * cone) {
      if (score < bestScore - eps || (Math.abs(score - bestScore) <= eps && best && c.index < best.index)) { best = c; bestScore = score; }
    } else if (score < fallbackScore - eps || (Math.abs(score - fallbackScore) <= eps && fallback && c.index < fallback.index)) {
      fallback = c;
      fallbackScore = score;
    }
  }
  return best ?? fallback;
}
