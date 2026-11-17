import type { ContentCells } from "./content";
import { createLayout, type Cell, type Layout, type LayoutOptions } from "./layout";

export interface FitOptions {
  /** Which cells count: "all" (default), "whole" (not cut by the region outline) or a test. */
  cells?: ContentCells;
  /**
   * "atLeast" (default): the largest tiles that still give at least `count` cells, so
   * every item has a tile. "nearest": whichever tile size gets closest to `count`.
   */
  mode?: "atLeast" | "nearest";
}

export interface FitResult {
  /** The input options with `tileScale` set. */
  options: LayoutOptions;
  layout: Layout;
  tileScale: number;
  /** Number of cells that count (by `cells`) in `layout`. */
  count: number;
}

/**
 * Find a tile size giving about `count` usable cells: scales the pattern (`tileScale`)
 * and searches, laying out a few dozen times. The tile count changes in steps, and not
 * always monotonically (tiles at the edge come and go), so for random and aperiodic
 * patterns, or "whole" cells, the result may land a little above `count`.
 */
export function fitCount(options: LayoutOptions, count: number, fit: FitOptions = {}): FitResult {
  if (!(count >= 1) || !Number.isFinite(count)) throw new RangeError(`fitCount needs a count of at least 1 (got ${count})`);
  const n = Math.floor(count);
  const { cells = "all", mode = "atLeast" } = fit;
  const accept = cells === "all" ? () => true : cells === "whole" ? (c: Cell) => !c.boundary : cells;

  type Probe = { k: number; layout?: Layout; count: number; error?: unknown };
  const probe = (k: number): Probe => {
    try {
      const layout = createLayout({ ...options, tileScale: k });
      return { k, layout, count: layout.cells.filter((c) => accept(c)).length };
    } catch (error) {
      // Too many tiles for maxTiles: count as "plenty", but remember why.
      if (error instanceof RangeError && /maxTiles|limit/.test(error.message)) return { k, count: Infinity, error };
      throw error;
    }
  };

  // Bracket: lo has at least n cells, hi fewer. Counts scale roughly with 1/k².
  let p = probe(options.tileScale ?? 1);
  let lo: Probe | undefined;
  let hi: Probe | undefined;
  for (let i = 0; i < 60 && !(lo && hi); i++) {
    if (p.count >= n) lo = !lo || p.k > lo.k ? p : lo;
    else hi = !hi || p.k < hi.k ? p : hi;
    if (lo && hi) break;
    const guess = p.count > 0 && Number.isFinite(p.count) ? p.k * Math.sqrt(p.count / n) : p.k;
    // Always move by at least 25% so the bracket grows even when the guess is off.
    const next = p.count >= n ? Math.max(guess, p.k * 1.25) : Math.min(guess, p.k / 1.25);
    p = probe(next);
  }
  if (!lo || !hi) {
    if (lo?.layout) return result(options, lo);
    throw new RangeError(`fitCount: couldn't find a tile size giving ${n} cells`);
  }

  // Bisect (in log scale) for the largest tiles that still give at least n cells.
  for (let i = 0; i < 30 && hi.k / lo.k > 1.0005; i++) {
    const mid = probe(Math.sqrt(lo.k * hi.k));
    if (mid.count >= n) lo = mid;
    else hi = mid;
  }
  if (!lo.layout) throw lo.error;
  const pick = mode === "nearest" && hi.count > 0 && n - hi.count < lo.count - n ? hi : lo;
  return result(options, pick);
}

function result(options: LayoutOptions, p: { k: number; layout?: Layout; count: number }): FitResult {
  return { options: { ...options, tileScale: p.k }, layout: p.layout!, tileScale: p.k, count: p.count };
}
