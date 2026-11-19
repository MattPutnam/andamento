import { area, centroid, vec, type Vec } from "./geometry";
import { contentSlots, type ContentCells, type ContentPlacement } from "./content";
import { fitCount } from "./fit";
import { createLayout, type Cell, type Feature, type Layout, type LayoutOptions } from "./layout";

export interface WeightOptions {
  /** Which cells may hold items: "all" (default), "whole" (not cut by the outline) or a test. */
  cells?: ContentCells;
  /** Where items go when there are fewer than cells: "reading" (default), "center" or "spread". */
  placement?: ContentPlacement;
}

/** The tiles each item spans: its weight, rounded, and at least 1. */
export const tileSpans = (weights: readonly number[]): number[] =>
  weights.map((w) => (Number.isFinite(w) ? Math.max(1, Math.round(w)) : 1));

/**
 * Featured tiles for items of different importance. `weights` gives how many tiles each
 * item should span (1 for an ordinary item; rounded); each item over 1 gets a feature of
 * that many merged tiles, for it (`Feature.item`), centred where its tiles would be if every
 * item took its share of `layout`'s cells in order (so the reading order of the items is
 * kept). Bigger features come first, so they get room. `layout` should have no features
 * of its own. See `weightedLayout` for the whole job.
 */
export function weightedFeatures(layout: Layout, weights: readonly number[], options: WeightOptions = {}): Feature[] {
  const spans = tileSpans(weights);
  const total = spans.reduce((s, w) => s + w, 0);
  if (!spans.some((w) => w > 1)) return [];
  // The cells the items would fill, one tile at a time, in order.
  const slots = contentSlots(layout, total, options);
  const byTile: Cell[] = [];
  slots.forEach((slot, i) => {
    if (slot >= 0) byTile[slot] = layout.cells[i]!;
  });
  const features: Feature[] = [];
  let start = 0;
  spans.forEach((w, item) => {
    if (w > 1) {
      // Items past the last cell have nowhere to go, so get no feature.
      const cells = byTile.slice(start, start + w).filter(Boolean);
      if (cells.length) features.push({ tiles: w, at: middle(cells), item });
    }
    start += w;
  });
  return features.sort((a, b) => b.tiles! - a.tiles! || a.item! - b.item!);
}

/** Area-weighted centre of some cells. */
function middle(cells: Cell[]): Vec {
  let x = 0, y = 0, w = 0;
  for (const c of cells) {
    const a = c.area || area(c.polygon);
    const m = c.centroid ?? centroid(c.polygon);
    x += m.x * a; y += m.y * a; w += a;
  }
  return vec(x / (w || 1), y / (w || 1));
}

export interface WeightedLayoutOptions extends WeightOptions {
  /**
   * Size the tiles so the items fit, counting each item's weight in tiles (see `fitCount`):
   * `true` / "atLeast" for the largest tiles that fit everything, "nearest" for the closest
   * count.
   */
  fit?: boolean | "atLeast" | "nearest";
}

export interface WeightedLayoutResult {
  /** The options used: `tileScale` from `fit`, and `features` with the weighted ones added. */
  options: LayoutOptions;
  layout: Layout;
  /** The features made for the weighted items (also in `options.features`). */
  features: Feature[];
}

/**
 * A layout for items of different importance: `weights` gives how many tiles each item
 * spans (1 for ordinary items), and each heavier item gets a featured tile that big, where
 * it falls in the items' reading order (see `weightedFeatures`). With `fit`, the tiles are
 * sized so all the items fit. `contentSlots` and `matchSlots` on the result put each item
 * in its own featured cell. Features already in `options` are kept, before the weighted ones.
 */
export function weightedLayout(options: LayoutOptions, weights: readonly number[], settings: WeightedLayoutOptions = {}): WeightedLayoutResult {
  const { fit, ...content } = settings;
  const spans = tileSpans(weights);
  const total = spans.reduce((s, w) => s + w, 0);
  const plain: LayoutOptions = { ...options, features: undefined };
  let base: LayoutOptions = options;
  let baseLayout: Layout | undefined;
  if (fit && total >= 1) {
    const r = fitCount(plain, total, { cells: content.cells, mode: fit === "nearest" ? "nearest" : "atLeast" });
    base = { ...options, tileScale: r.tileScale };
    baseLayout = r.layout;
  }
  const features = spans.some((w) => w > 1) ? weightedFeatures(baseLayout ?? createLayout({ ...base, features: undefined }), weights, content) : [];
  const all = [...(options.features ?? []), ...features];
  const final: LayoutOptions = { ...base };
  if (all.length) final.features = all;
  else delete final.features;
  const layout = !features.length && baseLayout && !options.features?.length ? baseLayout : createLayout(final);
  return { options: final, layout, features };
}
