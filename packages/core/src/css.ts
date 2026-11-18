import { signedArea, type Polygon, type Rect, type Vec } from "./geometry";
import { roundedPolygon } from "./rounding";
import type { Cell, Layout } from "./layout";
import { safeArea, type SafeAreaOptions } from "./safe";

/**
 * CSS placement for one cell, as percentages of the layout bounds, so the result
 * scales with whatever size the container is rendered at.
 *
 * Apply to an absolutely positioned element inside a `position: relative`
 * container whose aspect ratio matches `layout.bounds`
 * (see `boundsAspectRatio`). Works with any framework, or none.
 */
export interface CellCss {
  left: string;
  top: string;
  width: string;
  height: string;
  /** A `polygon(...)` clip path relative to the element's own box. */
  clipPath: string;
}

const pct = (n: number, precision: number) => `${Number(n.toFixed(precision))}%`;

/**
 * `polygon(...)` for `poly`, expressed as percentages of `box`. With `holes`, it's an
 * even–odd polygon that visits each hole from the outline's first point and comes back,
 * so the connecting lines cancel out.
 */
export function cssPolygon(poly: Polygon, box: Rect, precision = 4, holes: Polygon[] = []): string {
  const pt = (v: { x: number; y: number }) =>
    `${pct(box.width ? ((v.x - box.x) / box.width) * 100 : 0, precision)} ` +
    `${pct(box.height ? ((v.y - box.y) / box.height) * 100 : 0, precision)}`;
  const pts = poly.map(pt);
  if (holes.length === 0 || poly.length === 0) return `polygon(${pts.join(", ")})`;
  const first = pt(poly[0]!);
  for (const h of holes) {
    if (h.length === 0) continue;
    pts.push(first, ...h.map(pt), pt(h[0]!));
  }
  pts.push(first);
  return `polygon(evenodd, ${pts.join(", ")})`;
}

/**
 * `poly` with points added along its edges to make exactly `n`, keeping every original
 * vertex, so any two shapes can be morphed point by point (CSS transitions only interpolate
 * `polygon()` values with the same number of points). The points run the same way round
 * for every shape and start at the corner nearest the top left of `box`, so a shape
 * morphs into another without twisting. A polygon with more than `n` points is returned
 * as it is.
 */
export function resamplePolygon(poly: Polygon, n: number, box: Rect): Polygon {
  if (poly.length < 3 || poly.length > n) return poly;
  // In box-relative units, so tall and wide tiles start and spread their points alike.
  const w = box.width || 1, h = box.height || 1;
  let pts = poly.map((p) => ({ u: (p.x - box.x) / w, v: (p.y - box.y) / h, p }));
  if (signedArea(poly) < 0) pts = pts.reverse();
  let start = 0;
  for (let i = 1; i < pts.length; i++) if (pts[i]!.u + pts[i]!.v < pts[start]!.u + pts[start]!.v - 1e-9) start = i;
  pts = [...pts.slice(start), ...pts.slice(0, start)];
  const m = pts.length;
  const lens = pts.map((a, i) => Math.hypot(pts[(i + 1) % m]!.u - a.u, pts[(i + 1) % m]!.v - a.v));
  const total = lens.reduce((s, l) => s + l, 0) || 1;
  // Each edge keeps its start point; the extra points go to edges by length (largest remainder).
  const extra = n - m;
  const share = lens.map((l) => (l / total) * extra);
  const count = share.map(Math.floor);
  let left = extra - count.reduce((s, c) => s + c, 0);
  const order = share.map((s, i) => [s - Math.floor(s), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; left > 0; k++, left--) count[order[k % m]![1]]! += 1;
  const out: Vec[] = [];
  for (let i = 0; i < m; i++) {
    const a = pts[i]!.p, b = pts[(i + 1) % m]!.p;
    out.push(a);
    for (let k = 1; k <= count[i]!; k++) {
      const t = k / (count[i]! + 1);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

/** Options for `cellCss`. */
export interface CellCssOptions {
  /**
   * Give every clip path exactly this many points (see `resamplePolygon`), so CSS can
   * animate one tile shape into another. Cells with holes keep their own.
   */
  points?: number;
}

/** CSS placement for `cell` within `layout`, including rounded corners if the layout has them. */
export function cellCss(cell: Cell, layout: Layout, precision = 4, options: CellCssOptions = {}): CellCss {
  const { bounds } = layout;
  const b = cell.bbox;
  return {
    left: pct(((b.x - bounds.x) / bounds.width) * 100, precision),
    top: pct(((b.y - bounds.y) / bounds.height) * 100, precision),
    width: pct((b.width / bounds.width) * 100, precision),
    height: pct((b.height / bounds.height) * 100, precision),
    clipPath: cssPolygon(
      options.points && !cell.holes?.length
        ? resamplePolygon(roundedPolygon(cell.polygon, layout.cornerRadius), options.points, b)
        : roundedPolygon(cell.polygon, layout.cornerRadius),
      b,
      precision,
      (cell.holes ?? []).map((h) => roundedPolygon(h, layout.cornerRadius)),
    ),
  };
}

/**
 * Placement, inside a cell's element (as positioned by `cellCss`), of a box covering the
 * whole layout bounds. Put the same content (an image with `object-fit: cover`, say) in
 * every cell at this placement and the cells together show it as one picture, each
 * through its own window.
 */
export function backdropCss(cell: Cell, layout: Layout, precision = 4): Omit<CellCss, "clipPath"> {
  const { bounds } = layout;
  const b = cell.bbox;
  const w = b.width || 1;
  const h = b.height || 1;
  return {
    left: pct(((bounds.x - b.x) / w) * 100, precision),
    top: pct(((bounds.y - b.y) / h) * 100, precision),
    width: pct((bounds.width / w) * 100, precision),
    height: pct((bounds.height / h) * 100, precision),
  };
}

/**
 * Placement, inside a cell's element (as positioned by `cellCss`), of the cell's safe area
 * (see `safeArea`): the largest rectangle that isn't clipped by the tile's shape.
 */
export function safeAreaCss(cell: Cell, layout: Layout, options: SafeAreaOptions = {}, precision = 4): Omit<CellCss, "clipPath"> {
  const b = cell.bbox;
  const s = safeArea(cell, layout, options);
  const w = b.width || 1;
  const h = b.height || 1;
  return {
    left: pct(((s.x - b.x) / w) * 100, precision),
    top: pct(((s.y - b.y) / h) * 100, precision),
    width: pct((s.width / w) * 100, precision),
    height: pct((s.height / h) * 100, precision),
  };
}

/** `polygon(...)` for the layout's region, with its holes, relative to the bounds. */
export function regionCss(layout: Layout, precision = 4): string {
  return cssPolygon(layout.region, layout.bounds, precision, layout.holes);
}

/** Value for the CSS `aspect-ratio` property of a container holding `layout`. */
export function boundsAspectRatio(layout: Layout): string {
  return `${layout.bounds.width} / ${layout.bounds.height}`;
}
