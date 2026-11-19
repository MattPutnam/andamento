import { area, bbox, centroid, clipHalfPlane, rectPolygon, vec, type Polygon, type Rect, type Vec } from "./geometry";
import { mergeSlivers } from "./density";
import { pointInPolygon } from "./offset";
import { partition } from "./overlay";
import { voronoiCells } from "./procedural";
import { mulberry32 } from "./random";
import type { GenerateContext, RawTile } from "./tilings";

/**
 * Andamento: tesserae laid in rows (courses) that follow guide curves, circle center points
 * or run along the region's outline, the way mosaicists lay them.
 */
export interface FlowSpec {
  type: "flow";
  /** Row height: the width of each tessera across its row. */
  size: number;
  /** Tessera length along its row, as a multiple of `size`. Defaults to 1.3. */
  length?: number;
  /** How much tessera lengths vary, 0 (all alike) to 0.9. Defaults to 0.3. */
  jitter?: number;
  /**
   * Curves for rows to follow, in layout units: a row runs along each, and further rows
   * parallel to it on both sides. Open polylines, or `closed` loops.
   */
  guides?: { points: Vec[]; closed?: boolean }[];
  /** Points for rows to circle, in layout units: a round tessera, ringed by row after row. */
  centers?: Vec[];
  /**
   * Rows also run along the region's outline (and round its holes), as in opus
   * vermiculatum. Defaults to true when there are no guides or centers.
   */
  followEdges?: boolean;
  /** Seed for the deterministic random generator. Defaults to 1. */
  seed?: number;
}

/** Where rows meet (the rows from two guides, say), they end against each other, as in real mosaics. */
export function generateFlow(spec: FlowSpec, ctx: GenerateContext): RawTile[] {
  const h = positive("flow.size", spec.size);
  const L = h * positive("flow.length", spec.length ?? 1.3);
  const jitter = Math.min(0.9, Math.max(0, spec.jitter ?? 0.3));
  const rng = mulberry32(spec.seed ?? 1);
  const unit = ctx.unit ?? 1;
  const toGen = (v: Vec) => vec(v.x / unit, v.y / unit);
  const guides = (spec.guides ?? []).filter((g) => g.points.length >= 2).map((g) => ({ points: g.points.map(toGen), closed: !!g.closed }));
  const centers = (spec.centers ?? []).map(toGen);
  const followEdges = spec.followEdges ?? (guides.length === 0 && centers.length === 0);
  const outline = ctx.outline ?? [ctx.region];

  const rb = bbox(ctx.region);
  const box: Rect = { x: rb.x - h, y: rb.y - h, width: rb.width + 2 * h, height: rb.height + 2 * h };
  const estimate = (box.width * box.height) / (h * L);
  if (estimate > ctx.maxTiles) {
    throw new RangeError(`Tiles are too small for this region (~${Math.round(estimate)} flow tesserae, limit ${ctx.maxTiles}). Increase the size or raise maxTiles.`);
  }
  const scale = Math.max(box.width, box.height);

  // The row field: how far a point is from where rows start. Rows on a guide or round a
  // center are centerd on it (hence + h/2); rows along the outline start at it.
  const lines: [Vec, Vec][] = [];
  const shifted: [Vec, Vec][] = [];
  for (const g of guides) {
    const n = g.points.length;
    for (let i = 0; i < (g.closed ? n : n - 1); i++) shifted.push([g.points[i]!, g.points[(i + 1) % n]!]);
  }
  if (followEdges) for (const loop of outline) loop.forEach((a, i) => lines.push([a, loop[(i + 1) % loop.length]!]));
  const distEdge = segmentDistance(lines, [], box);
  const distGuide = segmentDistance(shifted, centers, box);
  // Outside the area, the outline's rows don't continue: they start at the outline.
  const inArea = (p: Vec) => {
    let inside = false;
    for (const loop of outline) if (pointInPolygon(p, loop)) inside = !inside;
    return inside;
  };
  const raw = (p: Vec) => Math.min(followEdges && !inArea(p) ? 0 : distEdge(p), distGuide(p) + h / 2);

  // Sampled on a triangulated grid and interpolated linearly in each triangle, so its level
  // lines (the row boundaries) are exactly the polylines marching triangles gives.
  const g = h / 3;
  const cols = Math.ceil(box.width / g), rows = Math.ceil(box.height / g);
  const F = new Float64Array((cols + 1) * (rows + 1));
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) F[j * (cols + 1) + i] = raw(vec(box.x + i * g, box.y + j * g));
  const at = (i: number, j: number) => F[j * (cols + 1) + i]!;
  const phi = (p: Vec) => {
    const fx = Math.min(cols - 1e-9, Math.max(0, (p.x - box.x) / g)), fy = Math.min(rows - 1e-9, Math.max(0, (p.y - box.y) / g));
    const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
    const f00 = at(i, j), f10 = at(i + 1, j), f01 = at(i, j + 1), f11 = at(i + 1, j + 1);
    return u >= v ? f00 + u * (f10 - f00) + v * (f11 - f10) : f00 + v * (f01 - f00) + u * (f11 - f01);
  };
  // Row boundaries sit a little off whole multiples of h: outlines and guides on grid lines
  // would otherwise put level lines a hair from grid points, giving pieces too short to join.
  const eps = h * 0.0137;
  const band = (p: Vec) => Math.max(0, Math.floor((phi(p) - eps) / h));
  const top = Math.floor((Math.max(...F) - eps) / h);

  // Row boundaries (level lines between rows), and each row's center line.
  const boundaries: [Vec, Vec][] = [];
  for (let k = 1; k <= top; k++) boundaries.push(...contourSegments(F, cols, rows, box, g, k * h + eps));

  // Tesserae along each row: seeds spaced about L apart (varied by `jitter`) on its center line.
  const seeds: { p: Vec; row: number; normal?: Vec }[] = [];
  const step = () => L * (1 + jitter * (2 * rng() - 1));
  const lay = (line: Vec[], closed: boolean, row: number, along = false) => {
    // Level lines hugging a guide (where the field bottoms out) would seed it twice.
    const onGuide = (p: Vec) => !along && distGuide(p) < 0.25 * h;
    const pts = closed ? [...line, line[0]!] : line;
    const lens = [0];
    for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
    const total = lens[lens.length - 1]!;
    if (total <= 0) return;
    // Closed rows get a whole number of tesserae, so the ring closes evenly.
    const marks: number[] = [];
    if (closed) {
      const n = Math.max(1, Math.round(total / L));
      const start = rng() * (total / n);
      for (let k = 0; k < n; k++) marks.push(start + ((k + 0.5 * jitter * (2 * rng() - 1) * 0.5) * total) / n);
    } else for (let s = rng() * L * 0.5; s < total; s += step()) marks.push(s);
    let seg = 1;
    for (const m of marks) {
      while (seg < pts.length - 1 && lens[seg]! < m) seg++;
      const a = pts[seg - 1]!, b = pts[seg]!;
      const t = (m - lens[seg - 1]!) / (lens[seg]! - lens[seg - 1]! || 1);
      const p = vec(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
      if (p.x < box.x || p.y < box.y || p.x > box.x + box.width || p.y > box.y + box.height || band(p) !== row || onGuide(p)) continue;
      const dl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      seeds.push({ p, row, normal: along ? vec(-(b.y - a.y) / dl, (b.x - a.x) / dl) : undefined });
    }
  };
  for (const gd of guides) lay(gd.points, gd.closed, 0, true);
  for (const c of centers) if (band(c) === 0) seeds.push({ p: c, row: 0 });
  for (let k = 0; k <= top; k++) {
    for (const line of contourLines(F, cols, rows, box, g, (k + 0.5) * h)) lay(line.points, line.closed, k);
  }
  if (!seeds.length) return [];

  // Each row's cells: Voronoi among that row's seeds, cut to a slab across the row so the
  // cell edges that matter (the cuts between tesserae) are short.
  const byRow = new Map<number, number[]>();
  seeds.forEach((s, i) => {
    const list = byRow.get(s.row);
    if (list) list.push(i);
    else byRow.set(s.row, [i]);
  });
  const cells: { poly: Polygon; row: number; seed: number }[] = [];
  const boxPoly = rectPolygon(box.x, box.y, box.width, box.height);
  for (const [row, ids] of byRow) {
    const polys = ids.length === 1 ? [boxPoly] : voronoiCells(ids.map((i) => seeds[i]!.p), box);
    polys.forEach((poly, k) => {
      const s = seeds[ids[k]!]!;
      let n = s.normal;
      if (!n) {
        const dx = phi(vec(s.p.x + g, s.p.y)) - phi(vec(s.p.x - g, s.p.y));
        const dy = phi(vec(s.p.x, s.p.y + g)) - phi(vec(s.p.x, s.p.y - g));
        const len = Math.hypot(dx, dy);
        n = len > 1e-9 ? vec(dx / len, dy / len) : undefined;
      }
      let clipped = poly;
      if (n) {
        clipped = clipHalfPlane(clipped, s.p, n, -1.5 * h);
        clipped = clipHalfPlane(clipped, s.p, vec(-n.x, -n.y), -1.5 * h);
      }
      if (clipped.length >= 3) cells.push({ poly: clipped, row, seed: ids[k]! });
    });
  }

  // Cells by bucket, to find the one under a point.
  const bs = Math.max(L, h) * 2;
  const bc = Math.max(1, Math.ceil(box.width / bs)), br = Math.max(1, Math.ceil(box.height / bs));
  const buckets: number[][] = Array.from({ length: bc * br }, () => []);
  const clampC = (x: number) => Math.min(bc - 1, Math.max(0, Math.floor((x - box.x) / bs)));
  const clampR = (y: number) => Math.min(br - 1, Math.max(0, Math.floor((y - box.y) / bs)));
  cells.forEach((c, i) => {
    const b = bbox(c.poly);
    for (let r = clampR(b.y); r <= clampR(b.y + b.height); r++) for (let q = clampC(b.x); q <= clampC(b.x + b.width); q++) buckets[r * bc + q]!.push(i);
  });

  // A tessera is a cell's part within its own row; leftovers in a row that no cell of
  // that row reaches (where rows end) get their own label.
  const M = 1 << 20;
  const label = (p: Vec) => {
    if (p.x <= box.x || p.y <= box.y || p.x >= box.x + box.width || p.y >= box.y + box.height) return -1;
    const k = band(p);
    for (const i of buckets[clampR(p.y) * bc + clampC(p.x)]!) {
      const c = cells[i]!;
      if (c.row === k && pointInPolygon(p, c.poly)) return k * M + i + 1;
    }
    return k * M;
  };
  const candidates: Polygon[] = [boxPoly, ...boundaries.map(([a, b]) => [a, b]), ...cells.map((c) => c.poly)];
  const regions = partition(candidates, label, scale);

  const pieces: (RawTile & { nominal: number; group: number })[] = [];
  const nominal = h * L;
  for (const [l, shapes] of regions) {
    const row = Math.floor(l / M), cell = (l % M) - 1;
    shapes.forEach((s, j) => {
      const base = cell >= 0 ? `f${row}.${cells[cell]!.seed}` : `f${row}.o${Math.round(centroid(s.outer).x)},${Math.round(centroid(s.outer).y)}`;
      pieces.push({ id: j ? `${base}~${j}` : base, polygon: s.outer, protoTile: row % 2, nominal, group: row });
    });
  }
  // Leftover crumbs where rows meet join a neighbor.
  return mergeSlivers(pieces, scale, scale * 1e-7).filter((t) => area(t.polygon) > 0);
}

function positive(name: string, value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be a positive number (got ${value})`);
  return value;
}

/**
 * Distance to the nearest of some segments and points, through a bucket grid searched ring
 * by ring. Infinity when there are none.
 */
function segmentDistance(segs: [Vec, Vec][], points: Vec[], box: Rect): (p: Vec) => number {
  const items: [Vec, Vec][] = [...segs, ...points.map((p) => [p, p] as [Vec, Vec])];
  if (!items.length) return () => Infinity;
  const size = Math.max(Math.sqrt((box.width * box.height) / Math.max(16, items.length)), 1e-9);
  const cols = Math.max(1, Math.ceil(box.width / size)), rows = Math.max(1, Math.ceil(box.height / size));
  const buckets: number[][] = Array.from({ length: cols * rows }, () => []);
  const cx = (x: number) => Math.min(cols - 1, Math.max(0, Math.floor((x - box.x) / size)));
  const cy = (y: number) => Math.min(rows - 1, Math.max(0, Math.floor((y - box.y) / size)));
  items.forEach(([a, b], i) => {
    for (let r = cy(Math.min(a.y, b.y)); r <= cy(Math.max(a.y, b.y)); r++) for (let q = cx(Math.min(a.x, b.x)); q <= cx(Math.max(a.x, b.x)); q++) buckets[r * cols + q]!.push(i);
  });
  const d = (p: Vec, [a, b]: [Vec, Vec]) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
  };
  return (p) => {
    const c0 = cx(p.x), r0 = cy(p.y);
    // The point may be outside the box (items beyond it are clamped into edge buckets), so
    // the ring bound is measured from the clamped bucket.
    const out = Math.max(box.x - p.x, p.x - box.x - box.width, box.y - p.y, p.y - box.y - box.height, 0);
    let best = Infinity;
    const seen = new Set<number>();
    for (let ring = 0; ring <= Math.max(cols, rows); ring++) {
      for (let r = r0 - ring; r <= r0 + ring; r++) {
        if (r < 0 || r >= rows) continue;
        for (let q = c0 - ring; q <= c0 + ring; q++) {
          if (q < 0 || q >= cols || Math.max(Math.abs(r - r0), Math.abs(q - c0)) !== ring) continue;
          for (const i of buckets[r * cols + q]!) {
            if (seen.has(i)) continue;
            seen.add(i);
            best = Math.min(best, d(p, items[i]!));
          }
        }
      }
      if (ring * size - out >= best) break;
    }
    return best;
  };
}

/** Level-line segments of the grid field at `level`, by marching triangles. */
function contourSegments(F: Float64Array, cols: number, rows: number, box: Rect, g: number, level: number): [Vec, Vec][] {
  const out: [Vec, Vec][] = [];
  forEachCrossing(F, cols, rows, box, g, level, (a, b) => out.push([a.p, b.p]));
  return out;
}

/** Level lines of the grid field at `level`, chained into polylines (open or closed). */
function contourLines(F: Float64Array, cols: number, rows: number, box: Rect, g: number, level: number): { points: Vec[]; closed: boolean }[] {
  // Segments meet at grid-edge crossings; chain them through those.
  const next = new Map<string, { key: string; p: Vec }[]>();
  const pos = new Map<string, Vec>();
  forEachCrossing(F, cols, rows, box, g, level, (a, b) => {
    pos.set(a.key, a.p);
    pos.set(b.key, b.p);
    (next.get(a.key) ?? next.set(a.key, []).get(a.key)!).push(b);
    (next.get(b.key) ?? next.set(b.key, []).get(b.key)!).push(a);
  });
  const used = new Set<string>();
  const edge = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const lines: { points: Vec[]; closed: boolean }[] = [];
  const walk = (start: string) => {
    const keys = [start];
    for (;;) {
      const cur = keys[keys.length - 1]!;
      const n = (next.get(cur) ?? []).find((x) => !used.has(edge(cur, x.key)));
      if (!n) break;
      used.add(edge(cur, n.key));
      if (n.key === start) return { keys, closed: true };
      keys.push(n.key);
    }
    return { keys, closed: false };
  };
  // Open lines start at their ends (a crossing with one neighbor); then the loops.
  for (const [k, ns] of next) {
    if (ns.length !== 1 || ns.every((x) => used.has(edge(k, x.key)))) continue;
    const { keys } = walk(k);
    if (keys.length > 1) lines.push({ points: keys.map((x) => pos.get(x)!), closed: false });
  }
  for (const [k, ns] of next) {
    if (ns.every((x) => used.has(edge(k, x.key)))) continue;
    const { keys, closed } = walk(k);
    if (keys.length > 1) lines.push({ points: keys.map((x) => pos.get(x)!), closed });
  }
  return lines;
}

/** Calls `emit` for each triangle's level-line segment, with endpoints keyed by grid edge. */
function forEachCrossing(
  F: Float64Array,
  cols: number,
  rows: number,
  box: Rect,
  g: number,
  level: number,
  emit: (a: { key: string; p: Vec }, b: { key: string; p: Vec }) => void,
) {
  const id = (i: number, j: number) => j * (cols + 1) + i;
  const cross = (u: number, v: number) => {
    const fu = F[u]! - level, fv = F[v]! - level;
    const t = fu / (fu - fv);
    const ui = u % (cols + 1), uj = Math.floor(u / (cols + 1));
    const vi = v % (cols + 1), vj = Math.floor(v / (cols + 1));
    const x = box.x + (ui + (vi - ui) * t) * g, y = box.y + (uj + (vj - uj) * t) * g;
    return { key: u < v ? `${u},${v}` : `${v},${u}`, p: vec(x, y) };
  };
  const tri = (a: number, b: number, c: number) => {
    const sa = F[a]! > level, sb = F[b]! > level, sc = F[c]! > level;
    if (sa === sb && sb === sc) return;
    // The lone vertex on one side, and the two edges from it.
    if (sa !== sb && sa !== sc) emit(cross(a, b), cross(a, c));
    else if (sb !== sa && sb !== sc) emit(cross(b, a), cross(b, c));
    else emit(cross(c, a), cross(c, b));
  };
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      // Split along the diagonal from (i, j) to (i + 1, j + 1), as `phi` does.
      tri(id(i, j), id(i + 1, j), id(i + 1, j + 1));
      tri(id(i, j), id(i, j + 1), id(i + 1, j + 1));
    }
  }
}
