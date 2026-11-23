import type { Cell, Layout } from "./layout";

export type Direction = "up" | "down" | "left" | "right";

const DIRS: Record<Direction, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export interface DirectionOptions {
  /** Only land on cells this accepts (those with content, say). Others are passed over. */
  accept?: (cell: Cell) => boolean;
  /**
   * The cross-axis coordinate to keep to: x when moving up or down, y when moving left or
   * right. Pass the value from the start of a run of presses (see `navigationLane`) and
   * repeated moves zigzag along a column of a hexagon or brick tiling instead of drifting
   * to one side. Defaults to `from`'s center.
   */
  lane?: number;
}

const byId = new WeakMap<Layout, Map<string, Cell>>();
function cellsById(layout: Layout): Map<string, Cell> {
  let m = byId.get(layout);
  if (!m) byId.set(layout, (m = new Map(layout.cells.map((c) => [c.id, c]))));
  return m;
}

/**
 * The cell to move to from `from` in a direction, for arrow-key navigation over any tiling.
 *
 * Moves to a tile that shares an edge with `from` and lies ahead (its center within 60° of
 * the direction), so no row is ever skipped; among those it takes the one nearest the
 * `lane`. If no touching tile qualifies (at a hole, or because `accept` passes them over),
 * it looks further: the nearest accepted cell ahead, distance from the lane counting double.
 * Returns undefined at the edge.
 */
export function cellInDirection(
  layout: Layout,
  from: Cell,
  direction: Direction,
  options: DirectionOptions | ((cell: Cell) => boolean) = {},
): Cell | undefined {
  const { accept = () => true, lane: laneOption } = typeof options === "function" ? { accept: options } : options;
  const [dx, dy] = DIRS[direction];
  const size = Math.sqrt(Math.max(from.area, 1e-12));
  const eps = 1e-6 * size;
  const cone = Math.tan(Math.PI / 3);
  const cross = (c: Cell) => (dx ? c.centroid.y : c.centroid.x);
  const lane = laneOption ?? cross(from);
  const place = (c: Cell) => {
    const ox = c.centroid.x - from.centroid.x, oy = c.centroid.y - from.centroid.y;
    return { along: ox * dx + oy * dy, across: Math.abs(ox * dy - oy * dx), off: Math.abs(cross(c) - lane) };
  };
  const pick = (cells: Iterable<Cell>, score: (p: ReturnType<typeof place>) => number, inCone: boolean) => {
    let best: Cell | undefined, bestScore = Infinity;
    for (const c of cells) {
      if (c === from || !accept(c)) continue;
      const p = place(c);
      if (p.along <= eps || (inCone && p.across > p.along * cone)) continue;
      const s = score(p);
      if (s < bestScore - eps || (Math.abs(s - bestScore) <= eps && best && c.index < best.index)) { best = c; bestScore = s; }
    }
    return best;
  };

  // Touching tiles ahead: nearest the lane, then the most nearly straight ahead.
  const ids = cellsById(layout);
  const touching = from.neighbors.map((id) => ids.get(id)).filter((c): c is Cell => !!c);
  const near = (p: ReturnType<typeof place>) => p.off + 0.25 * p.across;
  // Further away, through cells `accept` passes over or across a hole.
  const far = (p: ReturnType<typeof place>) => p.along + 2 * p.off;
  return pick(touching, near, true) ?? pick(layout.cells, far, true) ?? pick(touching, near, false) ?? pick(layout.cells, far, false);
}

/** Where a run of arrow presses started, so `navigationLane` can keep to it. */
const runs = new WeakMap<Layout, { at: string; vertical: boolean; lane: number }>();

/**
 * The lane for a move from `from` (see `DirectionOptions.lane`): the one the last move
 * along the same axis used, if that move ended at `from`, else `from`'s own center. Call
 * `noteMove` after each move.
 */
export function navigationLane(layout: Layout, from: Cell, direction: Direction): number {
  const vertical = direction === "up" || direction === "down";
  const run = runs.get(layout);
  if (run && run.at === from.id && run.vertical === vertical) return run.lane;
  return vertical ? from.centroid.x : from.centroid.y;
}

/** Records a move made with `lane`, so the next press along the same axis keeps to it. */
export function noteMove(layout: Layout, to: Cell, direction: Direction, lane: number): void {
  runs.set(layout, { at: to.id, vertical: direction === "up" || direction === "down", lane });
}
