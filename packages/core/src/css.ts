import { signedArea, type Polygon, type Rect, type Vec } from "./geometry";
import type { Cell, Layout } from "./layout";
import type { Shape } from "./overlay";
import { safeArea, type SafeAreaOptions } from "./safe";
import { roundCorners } from "./rounding";
import { ensurePositive } from "./geometry";
import { inShapes } from "./overlay";
import { cellShape, visibleShapes } from "./shape";

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

/**
 * `poly` with its corners rounded (by `radius`, or a radius per corner) as at least `n`
 * points, laid out the same way whatever the radius: each corner gets a fixed number of
 * points by how far the outline turns there (one per 10°, all on the vertex when it's sharp,
 * spread along the arc when it's rounded), and the rest go along the edges by the sharp
 * outline's edge lengths. So a tile morphs smoothly as its corner radius changes, as well as
 * into other shapes (see `resamplePolygon` for the start point and direction). Shapes with
 * too many corners for `n` (merged featured tiles, say) get more points: the next multiple
 * of 24 that fits, so most tiles share one count and can morph into each other.
 */
export function morphPolygon(poly: Polygon, radius: number | readonly number[], n: number, box: Rect): Polygon {
  const m = poly.length;
  if (m < 3) return poly;
  let pts = poly.map((p, i) => ({ p, r: typeof radius === "number" ? radius : (radius[i] ?? 0) }));
  if (signedArea(poly) < 0) pts = pts.reverse();
  const w = box.width || 1, h = box.height || 1;
  const key = (p: Vec) => (p.x - box.x) / w + (p.y - box.y) / h;
  let start = 0;
  for (let i = 1; i < m; i++) if (key(pts[i]!.p) < key(pts[start]!.p) - 1e-9) start = i;
  pts = [...pts.slice(start), ...pts.slice(0, start)];
  const sharp = pts.map((q) => q.p);
  const corners = roundCorners(sharp, pts.map((q) => q.r));
  // Points per corner: one per 10° the outline turns there, plus one (from the sharp shape,
  // so the same at any radius).
  const per = sharp.map((v, i) => {
    const a = sharp[(i - 1 + m) % m]!, b = sharp[(i + 1) % m]!;
    let turn = Math.atan2(b.y - v.y, b.x - v.x) - Math.atan2(v.y - a.y, v.x - a.x);
    turn = Math.abs(((turn + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
    return 1 + Math.ceil(turn / (Math.PI / 18) - 1e-6);
  });
  const onCorners = per.reduce((s, k) => s + k, 0);
  // At least one point along each edge, for morphing into shapes with corners there.
  if (onCorners + m > n) n = Math.ceil((onCorners + m) / 24) * 24;
  const lens = sharp.map((a, i) => Math.hypot(sharp[(i + 1) % m]!.x - a.x, sharp[(i + 1) % m]!.y - a.y));
  const total = lens.reduce((s, l) => s + l, 0) || 1;
  const extra = n - onCorners;
  const share = lens.map((l) => (l / total) * extra);
  const count = share.map(Math.floor);
  let left = extra - count.reduce((s, c) => s + c, 0);
  const order = share.map((s, i) => [s - Math.floor(s), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; left > 0; k++, left--) count[order[k % m]![1]]! += 1;
  const out: Vec[] = [];
  for (let i = 0; i < m; i++) {
    const c = corners[i]!;
    out.push(...arcPoints(c, per[i]!));
    // Along the straight part of the edge, from this corner's arc to the next one's.
    const a = c.end, b = corners[(i + 1) % m]!.start;
    for (let k = 1; k <= count[i]!; k++) {
      const t = k / (count[i]! + 1);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

/**
 * `pts` (a closed outline, positively oriented, as from `morphPolygon`) cut to `view`
 * without changing its point count: each run of points outside the view is laid along the
 * view's edge from where the outline leaves it to where it comes back, through the view's
 * corners on the way. Points inside stay put, so the result morphs as smoothly as `pts`.
 * Undefined when that can't describe the cut (nothing inside, or the outline leaving by one
 * loop of the view and coming back by another); draw the exact shape then.
 */
function cutToView(pts: Vec[], view: readonly Shape[]): Vec[] | undefined {
  // Outlines with the view on their left, as the tile's: outers positive, holes negative.
  const loops = view.flatMap((v) => [ensurePositive(v.outer), ...v.holes.map((h) => ensurePositive(h).slice().reverse())]);
  const n = pts.length;
  // Points on the view's edge count as inside: they're on the cut shape's outline either way.
  let lo = Infinity, hi = -Infinity;
  for (const p of pts) { lo = Math.min(lo, p.x, p.y); hi = Math.max(hi, p.x, p.y); }
  const eps = 1e-7 * (hi - lo || 1);
  const inside = pts.map((p) => inShapes(p, loops) || nearEdge(p, loops, eps));
  const first = inside.indexOf(true);
  if (first < 0) return undefined;
  if (inside.every(Boolean)) return pts;
  const out = pts.slice();
  // Walk the runs of outside points, starting just after an inside one.
  for (let k = 1; k <= n; ) {
    const i = (first + k) % n;
    if (inside[i]) { k++; continue; }
    let len = 0;
    while (!inside[(i + len) % n]) len++;
    const before = pts[(i - 1 + n) % n]!, after = pts[(i + len) % n]!;
    const exit = crossing(before, pts[i]!, loops), entry = crossing(after, pts[(i + len - 1) % n]!, loops);
    if (!exit || !entry || exit.loop !== entry.loop) return undefined;
    const path = viewPath(loops[exit.loop]!, exit, entry);
    placeAlong(path, len).forEach((p, j) => (out[(i + j) % n] = p));
    k += len;
  }
  return out;
}

function nearEdge(p: Vec, loops: Polygon[], eps: number): boolean {
  for (const loop of loops) {
    for (let e = 0, m = loop.length; e < m; e++) {
      const a = loop[e]!, b = loop[(e + 1) % m]!;
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      if (Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy) <= eps) return true;
    }
  }
  return false;
}

interface Crossing { loop: number; edge: number; t: number; point: Vec }

/** Where the segment from `from` (inside the view) towards `to` first meets the view's edge. */
function crossing(from: Vec, to: Vec, loops: Polygon[]): Crossing | undefined {
  let best: Crossing | undefined, bestU = Infinity;
  const dx = to.x - from.x, dy = to.y - from.y;
  loops.forEach((loop, l) => {
    for (let e = 0, m = loop.length; e < m; e++) {
      const a = loop[e]!, b = loop[(e + 1) % m]!;
      const ex = b.x - a.x, ey = b.y - a.y;
      const den = dx * ey - dy * ex;
      if (den === 0) continue;
      const u = ((a.x - from.x) * ey - (a.y - from.y) * ex) / den;
      const t = ((a.x - from.x) * dy - (a.y - from.y) * dx) / den;
      if (u >= -1e-9 && u <= 1 + 1e-9 && t >= -1e-9 && t <= 1 + 1e-9 && u < bestU) {
        bestU = u;
        best = { loop: l, edge: e, t, point: { x: from.x + dx * u, y: from.y + dy * u } };
      }
    }
  });
  return best;
}

/** The view's edge from `exit` forwards to `entry`, through the corners between. */
function viewPath(loop: Polygon, exit: Crossing, entry: Crossing): Vec[] {
  const path = [exit.point];
  if (exit.edge === entry.edge && entry.t >= exit.t) return [...path, entry.point];
  const m = loop.length;
  for (let e = exit.edge; ; e = (e + 1) % m) {
    path.push(loop[(e + 1) % m]!);
    if ((e + 1) % m === entry.edge) break;
  }
  return [...path, entry.point];
}

/**
 * `k` points along `path`: its ends and corners first (as many as fit), the rest spread
 * along its segments by length, so the cut keeps its sharp corners.
 */
function placeAlong(path: Vec[], k: number): Vec[] {
  if (k === 1) return [path[0]!];
  let keep = path;
  if (keep.length > k) {
    // Not enough points for every corner: keep the ends and as many corners as fit, evenly.
    keep = Array.from({ length: k }, (_, j) => path[Math.round((j * (path.length - 1)) / (k - 1))]!);
  }
  const segs = keep.length - 1;
  const lens = keep.slice(1).map((p, j) => Math.hypot(p.x - keep[j]!.x, p.y - keep[j]!.y));
  const total = lens.reduce((s, l) => s + l, 0) || 1;
  const extra = k - keep.length;
  const share = lens.map((l) => (l / total) * extra);
  const count = share.map(Math.floor);
  let left = extra - count.reduce((s, c) => s + c, 0);
  const order = share.map((s, j) => [s - Math.floor(s), j] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let q = 0; left > 0; q++, left--) count[order[q % segs]![1]]! += 1;
  const out: Vec[] = [];
  for (let j = 0; j < segs; j++) {
    const a = keep[j]!, b = keep[j + 1]!;
    out.push(a);
    for (let q = 1; q <= count[j]!; q++) {
      const t = q / (count[j]! + 1);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  out.push(keep[keep.length - 1]!);
  return out;
}

/** `k` points along a rounded corner's arc, start to end (all on the vertex when it's sharp). */
function arcPoints(c: ReturnType<typeof roundCorners>[number], k: number): Vec[] {
  if (c.radius === 0) return Array.from({ length: k }, () => c.vertex);
  if (k === 1) {
    const a = Math.atan2(c.start.y - c.center.y, c.start.x - c.center.x) + c.sweep / 2;
    return [{ x: c.center.x + c.radius * Math.cos(a), y: c.center.y + c.radius * Math.sin(a) }];
  }
  const a0 = Math.atan2(c.start.y - c.center.y, c.start.x - c.center.x);
  return Array.from({ length: k }, (_, s) => {
    const a = a0 + (c.sweep * s) / (k - 1);
    return { x: c.center.x + c.radius * Math.cos(a), y: c.center.y + c.radius * Math.sin(a) };
  });
}

/** Options for `cellCss`. */
export interface CellCssOptions {
  /**
   * Give every clip path this many points (see `morphPolygon`), so CSS can animate one tile
   * shape into another. Shapes with many corners (merged featured tiles) get more, in steps
   * of 24; cells with holes keep their own.
   */
  points?: number;
}

/**
 * `polygon(...)` for several shapes (outlines with holes) at once: an even–odd polygon
 * that visits each extra loop from the first outline's first point and comes back.
 */
export function cssShapes(shapes: readonly Shape[], box: Rect, precision = 4): string {
  if (shapes.length === 0) return "polygon(0 0)";
  const [first, ...rest] = shapes;
  return cssPolygon(first!.outer, box, precision, [...first!.holes, ...rest.flatMap((s) => [s.outer, ...s.holes])]);
}

/**
 * CSS placement for `cell` within `layout`, including rounded corners if the layout has
 * them. A window cell (see `cellShape`) is placed over its whole tile and clipped to the
 * part of it inside `layout.view`.
 */
export function cellCss(cell: Cell, layout: Layout, precision = 4, options: CellCssOptions = {}): CellCss {
  const { bounds } = layout;
  const b = cellShape(cell).bbox;
  const shapes = visibleShapes(cell, layout);
  const single = shapes.length === 1 && shapes[0]!.holes.length === 0;
  let morph: Polygon | undefined;
  if (options.points && single) {
    const s = cellShape(cell);
    morph = morphPolygon(s.outline, layout.cornerRadius, options.points, b);
    // A window cell: the whole tile's points, with those outside the view moved onto its edge.
    if (cell.tile && layout.view) morph = cutToView(morph, layout.view);
  }
  return {
    left: pct(((b.x - bounds.x) / bounds.width) * 100, precision),
    top: pct(((b.y - bounds.y) / bounds.height) * 100, precision),
    width: pct((b.width / bounds.width) * 100, precision),
    height: pct((b.height / bounds.height) * 100, precision),
    clipPath:
      morph ? cssPolygon(morph, b, precision) : cssShapes(shapes, b, precision),
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
  const b = cellShape(cell).bbox;
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
  const b = cellShape(cell).bbox;
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

/**
 * `polygon(...)` for the area tiles show in, relative to the bounds: `layout.view` in a
 * window layout, else the region with its holes.
 */
export function viewCss(layout: Layout, precision = 4): string {
  return layout.view ? cssShapes(layout.view, layout.bounds, precision) : regionCss(layout, precision);
}

/** Value for the CSS `aspect-ratio` property of a container holding `layout`. */
export function boundsAspectRatio(layout: Layout): string {
  return `${layout.bounds.width} / ${layout.bounds.height}`;
}
