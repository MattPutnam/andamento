import type { Polygon, Rect } from "./geometry";
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

/** `polygon(...)` for `poly`, expressed as percentages of `box`. */
export function cssPolygon(poly: Polygon, box: Rect, precision = 4): string {
  const pts = poly.map(
    (v) =>
      `${pct(box.width ? ((v.x - box.x) / box.width) * 100 : 0, precision)} ` +
      `${pct(box.height ? ((v.y - box.y) / box.height) * 100 : 0, precision)}`,
  );
  return `polygon(${pts.join(", ")})`;
}

export function cellCss(cell: Cell, bounds: Rect, precision = 4): CellCss {
  const b = cell.bbox;
  return {
    left: pct(((b.x - bounds.x) / bounds.width) * 100, precision),
    top: pct(((b.y - bounds.y) / bounds.height) * 100, precision),
    width: pct((b.width / bounds.width) * 100, precision),
    height: pct((b.height / bounds.height) * 100, precision),
    clipPath: cssPolygon(cell.polygon, b, precision),
  };
}

/** Value for the CSS `aspect-ratio` property of a container holding `layout`. */
export function boundsAspectRatio(layout: Layout): string {
  return `${layout.bounds.width} / ${layout.bounds.height}`;
}
