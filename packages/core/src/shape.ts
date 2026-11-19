import { area, bbox, centroid, type Polygon, type Rect, type Vec } from "./geometry";
import type { Cell, Layout } from "./layout";
import { pointInPolygon } from "./offset";
import { inShapes, overlay, shapeArea, type Shape } from "./overlay";
import { roundedPolygon } from "./rounding";

/** The shape a renderer draws for a cell, before the layout's `view` hides any of it. */
export interface CellShape {
  /** Sharp-cornered outline: `cell.tile` for a window cell, else `cell.polygon`. */
  outline: Polygon;
  holes: Polygon[];
  /** Bounding box of `outline`: where a renderer places the cell's element. */
  bbox: Rect;
  centroid: Vec;
  area: number;
}

const shapes = new WeakMap<Cell, CellShape>();

/**
 * The shape to draw for a cell: the whole tile for a cell an `edges: "window"` layout cuts
 * (`cell.tile`), otherwise the cell's own polygon and holes. Renderers round, bevel and
 * place content in this, then hide what lies outside `layout.view` (see `visibleShapes`).
 */
export function cellShape(cell: Cell): CellShape {
  let s = shapes.get(cell);
  if (!s) {
    s = cell.tile
      ? { outline: cell.tile, holes: [], bbox: bbox(cell.tile), centroid: centroid(cell.tile), area: area(cell.tile) }
      : { outline: cell.polygon, holes: cell.holes ?? [], bbox: cell.bbox, centroid: cell.centroid, area: cell.area };
    shapes.set(cell, s);
  }
  return s;
}

const visible = new WeakMap<Cell, Map<number, Shape[]>>();

/**
 * What of a cell shows, with the layout's rounded corners: its rounded shape (see
 * `cellShape`), less whatever lies outside `layout.view` in a window layout, where the cut
 * is sharp. One shape for most cells; a window cell the region outline cuts in two has
 * more, largest first.
 */
export function visibleShapes(cell: Cell, layout: Pick<Layout, "cornerRadius" | "view">): Shape[] {
  const r = layout.cornerRadius;
  let byRadius = visible.get(cell);
  if (!byRadius) visible.set(cell, (byRadius = new Map()));
  const hit = byRadius.get(r);
  if (hit) return hit;
  const s = cellShape(cell);
  const outer = roundedPolygon(s.outline, r);
  let result: Shape[] = [{ outer, holes: s.holes.map((h) => roundedPolygon(h, r)) }];
  if (cell.tile && layout.view?.length) {
    // The rounded whole tile, cut (sharply) to the view.
    const loops = layout.view.flatMap((v) => [v.outer, ...v.holes]);
    const b = s.bbox;
    const scale = Math.max(b.width, b.height) || 1;
    const cut = overlay([outer, ...loops], (p) => pointInPolygon(p, outer) && inShapes(p, loops), scale)
      .filter((q) => shapeArea(q) > 1e-9 * scale * scale)
      .sort((p, q) => shapeArea(q) - shapeArea(p));
    if (cut.length) result = cut;
  }
  byRadius.set(r, result);
  return result;
}
