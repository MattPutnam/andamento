import { centroid } from "./geometry";
import { cellShape } from "./shape";
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
 * Assign `count` content items to cells. Featured cells (see `LayoutOptions.features`)
 * take the first items, in feature order; the rest follow `placement`, in reading order.
 * Returns one entry per cell (by `cell.index`):
 * the index of the item it holds, or -1 for an empty cell. Pass `Infinity` to number
 * every cell that may hold content.
 */
export function contentSlots(layout: Layout, count: number, options: ContentOptions = {}): number[] {
  const { cells = "all", placement = "reading" } = options;
  const accept = cells === "all" ? () => true : cells === "whole" ? (c: Cell) => !c.boundary : cells;
  const out: number[] = new Array(layout.cells.length).fill(-1);
  const total = Math.max(0, Math.floor(count));
  // Featured cells come first, in `features` order (the first item goes to the first feature).
  const featured = layout.cells
    .filter((c) => c.featured !== undefined && accept(c))
    .sort((a, b) => a.featured! - b.featured! || a.index - b.index)
    .slice(0, total);
  featured.forEach((c, k) => (out[c.index] = k));

  // layout.cells is in reading order, so filtering keeps it.
  const eligible = layout.cells.filter((c) => out[c.index] === -1 && accept(c));
  const n = Math.max(0, Math.min(total - featured.length, eligible.length));

  let chosen: Cell[];
  if (n === eligible.length) chosen = eligible;
  else if (placement === "center") chosen = nearestToCenter(layout, eligible, n);
  else if (placement === "spread") chosen = spread(eligible, n);
  else chosen = eligible.slice(0, n);

  chosen.sort((a, b) => a.index - b.index).forEach((c, k) => (out[c.index] = featured.length + k));
  return out;
}

export interface MatchOptions extends ContentOptions {
  /**
   * Which cells get items:
   * - "placement" (default): the same cells as without matching (`placement`); matching
   *   only decides which item goes where among them.
   * - "shape": the cells whose shapes suit the items best, wherever they are (portrait
   *   photos into the vertical bricks of a herringbone, say). Ignores `placement`.
   */
  choose?: "placement" | "shape";
}

/**
 * Like `contentSlots`, but puts each item in a cell of similar shape, so content shown with
 * `object-fit: cover` loses as little as possible to cropping. `aspects` gives each item's
 * width / height (one per item, in item order); a cell's shape is its bounding box, which
 * is what content is laid out in.
 *
 * Featured cells still take the first items, in feature order. The rest are matched to
 * minimise the total crop (measured as the difference in log aspect ratio, which is optimal
 * to match by sorting both sides). Returns the item index per cell (by `cell.index`), or -1.
 */
export function matchSlots(layout: Layout, aspects: readonly number[], options: MatchOptions = {}): number[] {
  const { cells = "all", choose = "placement" } = options;
  const accept = cells === "all" ? () => true : cells === "whole" ? (c: Cell) => !c.boundary : cells;
  const logAspect = (a: number) => (a > 0 && Number.isFinite(a) ? Math.log(a) : 0);
  const cellLog = (c: Cell) => { const b = cellShape(c).bbox; return logAspect(b.width / (b.height || 1)); };

  // Featured cells and (for "placement") the cells to use come from contentSlots.
  const base = contentSlots(layout, aspects.length, options);
  const out: number[] = new Array(layout.cells.length).fill(-1);
  const featured = layout.cells.filter((c) => c.featured !== undefined && base[c.index]! >= 0 && base[c.index]! < aspects.length);
  let f = 0;
  for (const c of featured) {
    out[c.index] = base[c.index]!;
    f = Math.max(f, base[c.index]! + 1);
  }

  let pool: Cell[];
  if (choose === "shape") pool = layout.cells.filter((c) => out[c.index] === -1 && accept(c));
  else pool = layout.cells.filter((c) => out[c.index] === -1 && base[c.index]! >= 0);
  // Items beyond the cells available stay out, as with contentSlots: the first ones are kept.
  const k = Math.min(aspects.length - f, pool.length);
  if (k <= 0) return out;
  const items = Array.from({ length: k }, (_, i) => f + i).sort((a, b) => logAspect(aspects[a]!) - logAspect(aspects[b]!) || a - b);
  const sorted = [...pool].sort((a, b) => cellLog(a) - cellLog(b) || a.index - b.index);

  let picked: Cell[];
  if (k === sorted.length) picked = sorted;
  else picked = bestSubset(items.map((i) => logAspect(aspects[i]!)), sorted.map(cellLog)).map((j) => sorted[j]!);
  items.forEach((item, i) => (out[picked[i]!.index] = item));
  return out;
}

/**
 * Choose `a.length` of the (sorted) values `c` to pair, in order, with the (sorted) values
 * `a`, minimising the total |a - c|. Order-preserving pairings are optimal for this cost,
 * so a dynamic program over (items, cells) finds the best. Returns the chosen indices of `c`.
 */
function bestSubset(a: number[], c: number[]): number[] {
  const n = a.length, m = c.length;
  // take bit (i, j): item i-1 pairs with cell j-1 in the best solution of the subproblem.
  const take = new Uint8Array(Math.ceil((n * (m + 1)) / 8) + 1);
  const setBit = (i: number, j: number) => {
    const b = (i - 1) * (m + 1) + j;
    take[b >> 3]! |= 1 << (b & 7);
  };
  const bit = (i: number, j: number) => {
    const b = (i - 1) * (m + 1) + j;
    return (take[b >> 3]! >> (b & 7)) & 1;
  };
  let prev = new Float64Array(m + 1); // row i - 1 (row 0: no items, cost 0)
  let cur = new Float64Array(m + 1);
  for (let i = 1; i <= n; i++) {
    cur.fill(Infinity, 0, i);
    for (let j = i; j <= m; j++) {
      const skip = cur[j - 1]!;
      const pair = prev[j - 1]! + Math.abs(a[i - 1]! - c[j - 1]!);
      if (pair <= skip) {
        cur[j] = pair;
        setBit(i, j);
      } else cur[j] = skip;
    }
    [prev, cur] = [cur, prev];
  }
  const chosen: number[] = [];
  for (let i = n, j = m; i > 0; j--) {
    if (bit(i, j)) {
      chosen.push(j - 1);
      i--;
    }
  }
  return chosen.reverse();
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
