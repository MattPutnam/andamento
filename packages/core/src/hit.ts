import { bbox, vec, type Polygon, type Rect, type Vec } from "./geometry";
import type { Cell, Layout } from "./layout";
import { inShapes } from "./overlay";
import { visibleShapes } from "./shape";

/**
 * Hit testing: which cell is under a point, or near it, or inside a rectangle. Uses each
 * cell's visible shape (gap, rounded corners and holes included) and a spatial index built
 * once per layout, so lookups stay fast for tens of thousands of cells.
 */

interface Index {
  /** Visible outlines per cell (by position in `layout.cells`): every piece's outline and holes, even–odd. */
  loops: Polygon[][];
  /** Bounding box of each cell's visible shape. */
  boxes: Rect[];
  x0: number;
  y0: number;
  size: number;
  cols: number;
  rows: number;
  /** Cell positions per bucket. */
  buckets: number[][];
}

const indexes = new WeakMap<Layout, Index>();

function index(layout: Layout): Index {
  const hit = indexes.get(layout);
  if (hit) return hit;
  const cells = layout.cells;
  const loops = cells.map((c) => visibleShapes(c, layout).flatMap((s) => [s.outer, ...s.holes]));
  const boxes = loops.map((ls) => (ls.length ? bbox(ls.flat()) : { x: 0, y: 0, width: 0, height: 0 }));
  // Cells may stick out of the bounds ("overflow"), so index their own extent.
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of boxes) {
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
  }
  if (!cells.length) { x0 = y0 = 0; x1 = y1 = 1; }
  // Buckets about the size of a typical cell.
  const mean = boxes.reduce((s, b) => s + b.width * b.height, 0) / Math.max(1, cells.length);
  const size = Math.max(Math.sqrt(mean), (x1 - x0 + y1 - y0) / 2048, 1e-9);
  const cols = Math.max(1, Math.ceil((x1 - x0) / size)), rows = Math.max(1, Math.ceil((y1 - y0) / size));
  const buckets: number[][] = Array.from({ length: cols * rows }, () => []);
  boxes.forEach((b, i) => {
    const [ca, ra, cb, rb] = span(b, x0, y0, size, cols, rows);
    for (let r = ra; r <= rb; r++) for (let q = ca; q <= cb; q++) buckets[r * cols + q]!.push(i);
  });
  const built = { loops, boxes, x0, y0, size, cols, rows, buckets };
  indexes.set(layout, built);
  return built;
}

/** Bucket columns and rows a rectangle covers (clamped to the grid). */
function span(r: Rect, x0: number, y0: number, size: number, cols: number, rows: number): [number, number, number, number] {
  const clamp = (v: number, n: number) => Math.min(n - 1, Math.max(0, v));
  return [
    clamp(Math.floor((r.x - x0) / size), cols),
    clamp(Math.floor((r.y - y0) / size), rows),
    clamp(Math.floor((r.x + r.width - x0) / size), cols),
    clamp(Math.floor((r.y + r.height - y0) / size), rows),
  ];
}

/** Cells whose bounding boxes might meet `r`, each once, in reading order. */
function candidates(ix: Index, r: Rect): number[] {
  const [ca, ra, cb, rb] = span(r, ix.x0, ix.y0, ix.size, ix.cols, ix.rows);
  const out = new Set<number>();
  for (let row = ra; row <= rb; row++) for (let q = ca; q <= cb; q++) for (const i of ix.buckets[row * ix.cols + q]!) out.add(i);
  return [...out].sort((a, b) => a - b);
}

const inLoops = (p: Vec, loops: Polygon[]) => inShapes(p, loops);

/** Distance from `p` to the nearest edge of any of `loops`. */
function edgeDistance(p: Vec, loops: Polygon[]): number {
  let best = Infinity;
  for (const loop of loops) {
    for (let i = 0, n = loop.length; i < n; i++) {
      const a = loop[i]!, b = loop[(i + 1) % n]!;
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
    }
  }
  return best;
}

export interface HitOptions {
  /**
   * Also count points this far outside a cell (in layout units): in the gap between
   * tiles, or just past a rounded corner. The nearest cell wins. Handy for touch. Default 0.
   */
  tolerance?: number;
}

/** The cell whose visible shape contains `point` (in layout units), or undefined. */
export function cellAt(layout: Layout, point: Vec, options: HitOptions = {}): Cell | undefined {
  const ix = index(layout);
  for (const i of candidates(ix, { x: point.x, y: point.y, width: 0, height: 0 })) {
    if (inLoops(point, ix.loops[i]!)) return layout.cells[i];
  }
  const tolerance = options.tolerance ?? 0;
  return tolerance > 0 ? nearestCell(layout, point, tolerance) : undefined;
}

/**
 * The cell nearest `point`: the one containing it, or else the one whose edge is closest.
 * With `maxDistance`, only cells within that distance count.
 */
export function nearestCell(layout: Layout, point: Vec, maxDistance = Infinity): Cell | undefined {
  const ix = index(layout);
  if (!layout.cells.length) return undefined;
  const at = cellAt(layout, point);
  if (at) return at;
  // Widen a square round the point bucket by bucket: once it reaches `reach` on every side,
  // any cell not yet seen is at least that far away.
  let best: number | undefined, bestD = Infinity;
  const seen = new Set<number>();
  const visit = (i: number) => {
    if (seen.has(i)) return;
    seen.add(i);
    const d = edgeDistance(point, ix.loops[i]!);
    if (d < bestD) { bestD = d; best = i; }
  };
  const inside = point.x >= ix.x0 && point.y >= ix.y0 && point.x <= ix.x0 + ix.cols * ix.size && point.y <= ix.y0 + ix.rows * ix.size;
  let done = false;
  if (inside) {
    for (let ring = 0; ring <= Math.max(ix.cols, ix.rows) + 1; ring++) {
      const reach = ring * ix.size;
      for (const i of candidates(ix, { x: point.x - reach, y: point.y - reach, width: 2 * reach, height: 2 * reach })) visit(i);
      if (reach >= Math.min(bestD, maxDistance)) { done = true; break; }
    }
  }
  // Points outside the indexed area (rare): check every cell.
  if (!done) layout.cells.forEach((_, i) => visit(i));
  return best !== undefined && bestD <= maxDistance ? layout.cells[best] : undefined;
}

/**
 * Cells meeting a rectangle (in layout units), in reading order: for marquee selection, or
 * finding what's in view. With `contain`, only cells wholly inside it.
 */
export function cellsInRect(layout: Layout, rect: Rect, options: { contain?: boolean } = {}): Cell[] {
  const ix = index(layout);
  const r = normalize(rect);
  const out: Cell[] = [];
  for (const i of candidates(ix, r)) {
    const c = layout.cells[i]!;
    const b = ix.boxes[i]!;
    if (b.x > r.x + r.width || b.x + b.width < r.x || b.y > r.y + r.height || b.y + b.height < r.y) continue;
    const loops = ix.loops[i]!;
    if (options.contain) {
      // Inside the rectangle when its outline is (holes lie within the outline).
      if (loops.every((l) => l.every((p) => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height))) out.push(c);
    } else if (meets(loops, r)) out.push(c);
  }
  return out;
}

function normalize(r: Rect): Rect {
  const x = Math.min(r.x, r.x + r.width), y = Math.min(r.y, r.y + r.height);
  return { x, y, width: Math.abs(r.width), height: Math.abs(r.height) };
}

/** A shape and a rectangle overlap: a point of one inside the other, or edges crossing. */
function meets(loops: Polygon[], r: Rect): boolean {
  const inRect = (p: Vec) => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
  if (loops.some((l) => l.some(inRect))) return true;
  const corners = [vec(r.x, r.y), vec(r.x + r.width, r.y), vec(r.x + r.width, r.y + r.height), vec(r.x, r.y + r.height)];
  if (corners.some((p) => inLoops(p, loops))) return true;
  // Edges crossing the rectangle's sides (e.g. a thin sliver passing through it).
  for (const loop of loops) {
    for (let i = 0, n = loop.length; i < n; i++) {
      const a = loop[i]!, b = loop[(i + 1) % n]!;
      for (let k = 0; k < 4; k++) if (segmentsCross(a, b, corners[k]!, corners[(k + 1) % 4]!)) return true;
    }
  }
  return false;
}

function segmentsCross(a: Vec, b: Vec, c: Vec, d: Vec): boolean {
  const o = (p: Vec, q: Vec, s: Vec) => Math.sign((q.x - p.x) * (s.y - p.y) - (q.y - p.y) * (s.x - p.x));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
}

/** The on-screen box of the element showing a layout (e.g. from `getBoundingClientRect()`). */
export interface ScreenBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Convert a screen point (e.g. a pointer event's `clientX`, `clientY`) to layout units,
 * given the box of the element the layout fills: a `<TileLayout>` container, an `<svg>`
 * with the layout's viewBox, or a canvas you drew it on. Like SVG's default
 * `preserveAspectRatio`, the layout is taken to be scaled to fit the box and centerd.
 */
export function screenToLayout(layout: Layout, box: ScreenBox, clientX: number, clientY: number): Vec {
  const b = layout.bounds;
  const scale = Math.min(box.width / (b.width || 1), box.height / (b.height || 1)) || 1;
  const ox = box.left + (box.width - b.width * scale) / 2;
  const oy = box.top + (box.height - b.height * scale) / 2;
  return vec(b.x + (clientX - ox) / scale, b.y + (clientY - oy) / scale);
}
