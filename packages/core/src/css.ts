import type { Polygon, Rect } from "./geometry";
import { roundedPolygon } from "./rounding";
import type { Cell, Layout } from "./layout";

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

/** CSS placement for `cell` within `layout`, including rounded corners if the layout has them. */
export function cellCss(cell: Cell, layout: Layout, precision = 4): CellCss {
  const { bounds } = layout;
  const b = cell.bbox;
  return {
    left: pct(((b.x - bounds.x) / bounds.width) * 100, precision),
    top: pct(((b.y - bounds.y) / bounds.height) * 100, precision),
    width: pct((b.width / bounds.width) * 100, precision),
    height: pct((b.height / bounds.height) * 100, precision),
    clipPath: cssPolygon(
      roundedPolygon(cell.polygon, layout.cornerRadius),
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

/** `polygon(...)` for the layout's region, with its holes, relative to the bounds. */
export function regionCss(layout: Layout, precision = 4): string {
  return cssPolygon(layout.region, layout.bounds, precision, layout.holes);
}

/** Value for the CSS `aspect-ratio` property of a container holding `layout`. */
export function boundsAspectRatio(layout: Layout): string {
  return `${layout.bounds.width} / ${layout.bounds.height}`;
}
