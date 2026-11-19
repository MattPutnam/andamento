import { bbox, type Polygon, type Rect, type Vec } from "./geometry";
import type { Cell, Layout } from "./layout";
import { shapeArea, shapeCentroid } from "./overlay";
import { roundedPolygon } from "./rounding";
import { cellShape, visibleShapes } from "./shape";

export interface SafeAreaOptions {
  /**
   * Width / height the area must have (an image or card of known shape, say). Omit for
   * the largest-area rectangle of any shape (for text and other content that reflows).
   */
  aspect?: number;
  /**
   * For a cell an `edges: "window"` layout cuts: "tile" (the default) fits the whole tile,
   * as if the region weren't there, so content near the edge is partly hidden like the
   * tile; "visible" fits the part that shows. Other cells are the same either way.
   */
  within?: "tile" | "visible";
}

/**
 * The largest axis-aligned rectangle that fits wholly inside a cell's shape (its outline,
 * holes and rounded corners), so content placed there isn't clipped. With `aspect`, the
 * largest rectangle of that shape. Among equally large positions it picks the one nearest
 * the cell's center. In layout coordinates; see `safeAreaCss` for CSS.
 *
 * Works for any shape, convex or not. Results are cached per cell.
 */
export function safeArea(cell: Cell, layout: Pick<Layout, "cornerRadius" | "view">, options: SafeAreaOptions = {}): Rect {
  const radius = layout.cornerRadius;
  const fixed = options.aspect !== undefined && options.aspect > 0 && Number.isFinite(options.aspect) ? options.aspect : undefined;
  const within = cell.tile && options.within === "visible" && layout.view ? "visible" : "tile";
  const key = `${radius}:${fixed ?? "free"}:${within}`;
  let cached = cache.get(cell);
  if (!cached) cache.set(cell, (cached = new Map()));
  const hit = cached.get(key);
  if (hit) return hit;
  let target: Target;
  if (within === "visible") {
    const piece = visibleShapes(cell, layout)[0]!;
    target = { outline: piece.outer, holes: piece.holes, rounded: true, bbox: bbox(piece.outer), centroid: shapeCentroid(piece), area: shapeArea(piece) };
  } else {
    const s = cellShape(cell);
    target = { outline: s.outline, holes: s.holes, rounded: false, bbox: s.bbox, centroid: s.centroid, area: s.area };
  }
  const result = compute(target, radius, fixed);
  cached.set(key, result);
  return result;
}

const cache = new WeakMap<Cell, Map<string, Rect>>();

/** The shape to fit in: an outline (sharp, or already rounded) with its holes. */
interface Target {
  outline: Polygon;
  holes: Polygon[];
  rounded: boolean;
  bbox: Rect;
  centroid: Vec;
  area: number;
}

function compute(cell: Target, radius: number, aspect: number | undefined): Rect {
  const b = cell.bbox;
  const r = cell.rounded ? 0 : radius;
  const outline = roundedPolygon(cell.outline, r);
  const holes = cell.holes.map((h) => roundedPolygon(h, r));
  const empty = { x: cell.centroid.x, y: cell.centroid.y, width: 0, height: 0 };
  if (outline.length < 3 || !(b.width > 0) || !(b.height > 0)) return empty;

  // An axis-aligned rectangle is its own answer.
  if (holes.length === 0 && outline.length === 4 && Math.abs(cell.area - b.width * b.height) <= 1e-9 * b.width * b.height) {
    if (aspect === undefined) return { ...b };
    const w = Math.min(b.width, b.height * aspect);
    const h = w / aspect;
    return { x: b.x + (b.width - w) / 2, y: b.y + (b.height - h) / 2, width: w, height: h };
  }

  const loops = [outline, ...holes];
  if (aspect !== undefined) return fitAspect(loops, cell, aspect, 1e-3).rect;
  // The search over aspects uses a coarser tolerance, then the winner is refined.
  const fit = (a: number) => fitAspect(loops, cell, a, 1e-2);

  // Any shape: search the aspect ratio for the largest area. A coarse scan around the
  // bounding box's shape, then golden-section refinement around the best sample.
  const mid = Math.log(b.width / b.height);
  const span = 2, steps = 8;
  const area = (la: number) => fit(Math.exp(la));
  let best = area(mid), bestLa = mid;
  for (let k = 0; k <= steps; k++) {
    const la = mid - span + (2 * span * k) / steps;
    const r = k === steps / 2 ? best : area(la);
    if (r.area > best.area) { best = r; bestLa = la; }
  }
  let lo = bestLa - (2 * span) / steps, hi = bestLa + (2 * span) / steps;
  const g = (Math.sqrt(5) - 1) / 2;
  let x1 = hi - g * (hi - lo), x2 = lo + g * (hi - lo);
  let f1 = area(x1), f2 = area(x2);
  for (let it = 0; it < 10; it++) {
    if (f1.area >= f2.area) { hi = x2; x2 = x1; f2 = f1; x1 = hi - g * (hi - lo); f1 = area(x1); }
    else { lo = x1; x1 = x2; f1 = f2; x2 = lo + g * (hi - lo); f2 = area(x2); }
  }
  if (f1.area > best.area) { best = f1; bestLa = x1; }
  if (f2.area > best.area) { best = f2; bestLa = x2; }
  return fitAspect(loops, cell, Math.exp(bestLa), 1e-3).rect;
}

/**
 * Largest rectangle of aspect `a`. Scaling x by 1/√a and y by √a turns it into the largest
 * square, i.e. the point farthest from the outline in the L∞ (chessboard) distance, which
 * a branch-and-bound over square cells finds (as polylabel does for circles).
 */
function fitAspect(loops: Polygon[], cell: { centroid: Vec }, a: number, tolerance: number): { rect: Rect; area: number } {
  const sx = 1 / Math.sqrt(a), sy = Math.sqrt(a);
  // Segments in scaled space, flat: ax, ay, bx, by.
  const segs: number[] = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const loop of loops) {
    for (let i = 0, n = loop.length; i < n; i++) {
      const p = loop[i]!, q = loop[(i + 1) % n]!;
      segs.push(p.x * sx, p.y * sy, q.x * sx, q.y * sy);
    }
  }
  for (const p of loops[0]!) {
    minX = Math.min(minX, p.x * sx); maxX = Math.max(maxX, p.x * sx);
    minY = Math.min(minY, p.y * sy); maxY = Math.max(maxY, p.y * sy);
  }
  const tx = cell.centroid.x * sx, ty = cell.centroid.y * sy;
  const size = Math.min(maxX - minX, maxY - minY);
  const precision = size * tolerance;
  // Prefer the center among near-equal positions; small enough not to move a unique best.
  const lambda = 1e-2;

  /** Signed L∞ distance to the outline: positive inside. */
  const dist = (x: number, y: number) => {
    let inside = false;
    let d = Infinity;
    for (let s = 0; s < segs.length; s += 4) {
      const ax = segs[s]!, ay = segs[s + 1]!, bx = segs[s + 2]!, by = segs[s + 3]!;
      if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
      d = Math.min(d, chebyshevToSegment(ax - x, ay - y, bx - ax, by - ay));
    }
    return inside ? d : -d;
  };
  const score = (x: number, y: number, d: number) => d - lambda * Math.hypot(x - tx, y - ty);

  type Node = { x: number; y: number; h: number; d: number; bound: number };
  const node = (x: number, y: number, h: number): Node => {
    const d = dist(x, y);
    const off = Math.max(0, Math.hypot(x - tx, y - ty) - h * Math.SQRT2);
    return { x, y, h, d, bound: d + h - lambda * off };
  };

  const heap = new MaxHeap<Node>((n) => n.bound);
  const w = maxX - minX, hgt = maxY - minY;
  const cellSize = size;
  for (let x = minX; x < maxX; x += cellSize) {
    for (let y = minY; y < maxY; y += cellSize) heap.push(node(x + cellSize / 2, y + cellSize / 2, cellSize / 2));
  }
  let best = { x: tx, y: ty, d: dist(tx, ty) };
  let bestScore = score(best.x, best.y, best.d);
  const bboxCenter = { x: minX + w / 2, y: minY + hgt / 2 };
  const bd = dist(bboxCenter.x, bboxCenter.y);
  if (score(bboxCenter.x, bboxCenter.y, bd) > bestScore) { best = { ...bboxCenter, d: bd }; bestScore = score(best.x, best.y, bd); }

  for (let guard = 0; heap.size > 0 && guard < 20000; guard++) {
    const n = heap.pop()!;
    const s = score(n.x, n.y, n.d);
    if (s > bestScore) { best = n; bestScore = s; }
    if (n.bound - bestScore <= precision) continue;
    const h = n.h / 2;
    heap.push(node(n.x - h, n.y - h, h));
    heap.push(node(n.x + h, n.y - h, h));
    heap.push(node(n.x - h, n.y + h, h));
    heap.push(node(n.x + h, n.y + h, h));
  }

  const t = Math.max(0, best.d);
  const cx = best.x / sx, cy = best.y / sy;
  const hw = t / sx, hh = t / sy;
  return { rect: { x: cx - hw, y: cy - hh, width: 2 * hw, height: 2 * hh }, area: 4 * t * t };
}

/** min over u in [0, 1] of max(|px + u dx|, |py + u dy|): the L∞ distance from the origin to a segment. */
function chebyshevToSegment(px: number, py: number, dx: number, dy: number): number {
  const at = (u: number) => Math.max(Math.abs(px + u * dx), Math.abs(py + u * dy));
  let d = Math.min(at(0), at(1));
  // The function is convex and piecewise linear; its kinks are where a coordinate is 0
  // or where |x| = |y|.
  const tryU = (num: number, den: number) => {
    if (den === 0) return;
    const u = num / den;
    if (u > 0 && u < 1) d = Math.min(d, at(u));
  };
  tryU(-px, dx);
  tryU(-py, dy);
  tryU(py - px, dx - dy);
  tryU(-px - py, dx + dy);
  return d;
}

class MaxHeap<T> {
  private items: T[] = [];
  constructor(private key: (t: T) => number) {}
  get size() { return this.items.length; }
  push(t: T) {
    const a = this.items;
    a.push(t);
    for (let i = a.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (this.key(a[p]!) >= this.key(a[i]!)) break;
      [a[p], a[i]] = [a[i]!, a[p]!];
      i = p;
    }
  }
  pop(): T | undefined {
    const a = this.items;
    if (a.length === 0) return undefined;
    const top = a[0]!;
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && this.key(a[l]!) > this.key(a[m]!)) m = l;
        if (r < a.length && this.key(a[r]!) > this.key(a[m]!)) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i]!, a[m]!];
        i = m;
      }
    }
    return top;
  }
}
