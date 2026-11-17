import { centroid } from "./geometry";
import type { Cell, Layout } from "./layout";

/**
 * Which cells may hold content:
 * - "all": every cell.
 * - "whole": only cells shown in full (not cut by the region outline; see `Cell.boundary`).
 * - a function: your own test.
 */
export type ContentCells = "all" | "whole" | ((cell: Cell) => boolean);

/**
 * Where content goes when there are fewer items than cells that may hold content:
 * - "reading": the first cells in reading order (content packs to the top left).
 * - "center": the cells nearest the middle of the region.
 * - "spread": cells spread evenly over the region.
 * Items always fill the chosen cells in reading order.
 */
export type ContentPlacement = "reading" | "center" | "spread";

export interface ContentOptions {
  cells?: ContentCells;
  placement?: ContentPlacement;
}

/**
 * Assign `count` content items to cells. Returns one entry per cell (by `cell.index`):
 * the index of the item it holds, or -1 for an empty cell. Pass `Infinity` to number
 * every cell that may hold content.
 */
export function contentSlots(layout: Layout, count: number, options: ContentOptions = {}): number[] {
  const { cells = "all", placement = "reading" } = options;
  const accept = cells === "all" ? () => true : cells === "whole" ? (c: Cell) => !c.boundary : cells;
  // layout.cells is in reading order, so filtering keeps it.
  const eligible = layout.cells.filter((c) => accept(c));
  const n = Math.max(0, Math.min(Math.floor(count), eligible.length));

  let chosen: Cell[];
  if (n === eligible.length) chosen = eligible;
  else if (placement === "center") chosen = nearestToCenter(layout, eligible, n);
  else if (placement === "spread") chosen = spread(eligible, n);
  else chosen = eligible.slice(0, n);

  const out: number[] = new Array(layout.cells.length).fill(-1);
  chosen.sort((a, b) => a.index - b.index).forEach((c, k) => (out[c.index] = k));
  return out;
}

function nearestToCenter(layout: Layout, cells: Cell[], n: number): Cell[] {
  const mid = centroid(layout.region);
  const d = (c: Cell) => (c.centroid.x - mid.x) ** 2 + (c.centroid.y - mid.y) ** 2;
  return cells
    .map((c) => ({ c, d: d(c) }))
    .sort((a, b) => a.d - b.d || a.c.index - b.c.index)
    .slice(0, n)
    .map((e) => e.c);
}

/**
 * `n` cells spread evenly: k-means on cell centres (seeded by farthest-point sampling, so
 * it's deterministic), then the cell nearest each cluster centre. The iteration count is
 * capped so very large layouts stay fast; the seeding alone is already well spread.
 */
function spread(cells: Cell[], n: number): Cell[] {
  if (n === 0) return [];
  const m = cells.length;
  const xs = Float64Array.from(cells, (c) => c.centroid.x);
  const ys = Float64Array.from(cells, (c) => c.centroid.y);
  const ws = Float64Array.from(cells, (c) => c.area);

  // Farthest-point seeding, starting from the cell nearest the overall (area-weighted) centre.
  let sx = 0, sy = 0, sw = 0;
  for (let i = 0; i < m; i++) { sx += xs[i]! * ws[i]!; sy += ys[i]! * ws[i]!; sw += ws[i]!; }
  sx /= sw || 1; sy /= sw || 1;
  const best = new Float64Array(m).fill(Infinity);
  const cx = new Float64Array(n);
  const cy = new Float64Array(n);
  let next = 0;
  for (let j = 0, bd = Infinity; j < m; j++) {
    const d = (xs[j]! - sx) ** 2 + (ys[j]! - sy) ** 2;
    if (d < bd) { bd = d; next = j; }
  }
  for (let k = 0; k < n; k++) {
    cx[k] = xs[next]!; cy[k] = ys[next]!;
    let far = -1, fi = 0;
    for (let j = 0; j < m; j++) {
      const d = (xs[j]! - cx[k]!) ** 2 + (ys[j]! - cy[k]!) ** 2;
      if (d < best[j]!) best[j] = d;
      if (best[j]! > far) { far = best[j]!; fi = j; }
    }
    next = fi;
  }

  // Lloyd iterations.
  const assign = new Int32Array(m);
  const iterations = Math.min(20, Math.floor(3e7 / (m * n)));
  for (let it = 0; it < iterations; it++) {
    for (let j = 0; j < m; j++) {
      let bd = Infinity, bk = 0;
      for (let k = 0; k < n; k++) {
        const d = (xs[j]! - cx[k]!) ** 2 + (ys[j]! - cy[k]!) ** 2;
        if (d < bd) { bd = d; bk = k; }
      }
      assign[j] = bk;
    }
    const ax = new Float64Array(n), ay = new Float64Array(n), aw = new Float64Array(n);
    for (let j = 0; j < m; j++) {
      const k = assign[j]!;
      ax[k] += xs[j]! * ws[j]!; ay[k] += ys[j]! * ws[j]!; aw[k] += ws[j]!;
    }
    let moved = false;
    for (let k = 0; k < n; k++) {
      if (aw[k]! === 0) continue;
      const nx = ax[k]! / aw[k]!, ny = ay[k]! / aw[k]!;
      if (nx !== cx[k] || ny !== cy[k]) moved = true;
      cx[k] = nx; cy[k] = ny;
    }
    if (!moved) break;
  }

  // The nearest still-free cell to each centre.
  const taken = new Uint8Array(m);
  const chosen: Cell[] = [];
  for (let k = 0; k < n; k++) {
    let bd = Infinity, bj = -1;
    for (let j = 0; j < m; j++) {
      if (taken[j]) continue;
      const d = (xs[j]! - cx[k]!) ** 2 + (ys[j]! - cy[k]!) ** 2;
      if (d < bd) { bd = d; bj = j; }
    }
    taken[bj] = 1;
    chosen.push(cells[bj]!);
  }
  return chosen;
}
