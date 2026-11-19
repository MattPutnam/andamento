import { bbox, centroid, clipHalfPlane, rectPolygon, sub, vec, type Polygon, type Rect, type Vec } from "./geometry";
import { mulberry32 } from "./random";
import type { AshlarSpec, DelaunaySpec, GenerateContext, JigsawSpec, RawTile, VoronoiSpec } from "./tilings";

/*
 * Seeded, non-periodic generators. Like Mondrian they fill the bounding box of the
 * region (the layout then clips to the region itself) and ignore rotation and origin.
 */

function positive(name: string, value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive number (got ${value})`);
  }
  return value;
}

function checkCount(kind: string, count: number, ctx: GenerateContext) {
  if (count > ctx.maxTiles) {
    throw new RangeError(
      `Tiles are too small for this region (~${Math.round(count)} ${kind} cells, limit ${ctx.maxTiles}). ` +
        "Increase the size or raise maxTiles.",
    );
  }
}

/**
 * Random points in `box`, about one per `size × size` square; with `sizeAt`, about one per
 * `(size · sizeAt(p))²` instead (thinned from the densest rate), so cells shrink where it's small.
 */
function randomSites(box: Rect, size: number, rng: () => number, sizeAt?: (p: Vec) => number): Vec[] {
  if (!sizeAt) {
    const n = Math.max(1, Math.round((box.width * box.height) / (size * size)));
    return Array.from({ length: n }, () => vec(box.x + rng() * box.width, box.y + rng() * box.height));
  }
  const fmin = minOver(sizeAt, box);
  const n = Math.max(1, Math.round((box.width * box.height) / (size * fmin) ** 2));
  const out: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const p = vec(box.x + rng() * box.width, box.y + rng() * box.height);
    if (rng() < (fmin / Math.max(fmin, sizeAt(p))) ** 2) out.push(p);
  }
  return out.length ? out : [vec(box.x + box.width / 2, box.y + box.height / 2)];
}

/** Smallest value of a size factor over a box (sampled), clamped to (0, 1]. */
function minOver(sizeAt: (p: Vec) => number, box: Rect): number {
  let m = 1;
  for (let i = 0; i <= 32; i++) for (let j = 0; j <= 32; j++) m = Math.min(m, sizeAt(vec(box.x + (box.width * i) / 32, box.y + (box.height * j) / 32)));
  return Math.max(m, 1e-3);
}

/** Expected number of sites `randomSites` gives. */
function expectedSites(box: Rect, size: number, sizeAt?: (p: Vec) => number): number {
  if (!sizeAt) return (box.width * box.height) / (size * size);
  let sum = 0;
  for (let i = 0; i < 32; i++) {
    for (let j = 0; j < 32; j++) {
      const f = Math.max(1e-3, sizeAt(vec(box.x + (box.width * (i + 0.5)) / 32, box.y + (box.height * (j + 0.5)) / 32)));
      sum += 1 / (f * f);
    }
  }
  return ((box.width * box.height) / (size * size)) * (sum / 1024);
}

/**
 * Voronoi cells of `sites` within `box`: each cell is the box clipped by the
 * perpendicular bisectors towards nearby sites. Neighbors are visited ring by ring
 * through a bucket grid, stopping once no further site can cut the cell.
 */
export function voronoiCells(sites: Vec[], box: Rect): Polygon[] {
  const n = sites.length;
  const g = Math.max(1e-9, Math.sqrt((box.width * box.height) / Math.max(1, n)));
  const cols = Math.max(1, Math.ceil(box.width / g));
  const rows = Math.max(1, Math.ceil(box.height / g));
  const buckets: number[][] = Array.from({ length: cols * rows }, () => []);
  const colOf = (p: Vec) => Math.min(cols - 1, Math.max(0, Math.floor((p.x - box.x) / g)));
  const rowOf = (p: Vec) => Math.min(rows - 1, Math.max(0, Math.floor((p.y - box.y) / g)));
  sites.forEach((p, i) => buckets[rowOf(p) * cols + colOf(p)]!.push(i));

  const boxPoly = rectPolygon(box.x, box.y, box.width, box.height);
  return sites.map((p, i) => {
    let cell = boxPoly;
    const c0 = colOf(p);
    const r0 = rowOf(p);
    for (let ring = 0; ring <= Math.max(cols, rows); ring++) {
      // Sites in this ring are at least (ring - 1)·g away; a site further than twice the
      // cell's radius can't cut it.
      let radius = 0;
      for (const v of cell) radius = Math.max(radius, Math.hypot(v.x - p.x, v.y - p.y));
      if ((ring - 1) * g > 2 * radius) break;
      for (let r = r0 - ring; r <= r0 + ring; r++) {
        if (r < 0 || r >= rows) continue;
        for (let c = c0 - ring; c <= c0 + ring; c++) {
          if (c < 0 || c >= cols) continue;
          if (Math.max(Math.abs(r - r0), Math.abs(c - c0)) !== ring) continue;
          for (const j of buckets[r * cols + c]!) {
            if (j === i) continue;
            const q = sites[j]!;
            // Keep the side of the bisector nearer to p.
            const mid = vec((p.x + q.x) / 2, (p.y + q.y) / 2);
            cell = clipHalfPlane(cell, mid, sub(p, q));
          }
        }
      }
    }
    return cell;
  });
}

/**
 * Lloyd relaxation: move each free site to the centroid of its cell, `rounds` times. With
 * `sizeAt`, centroids are weighted by density (1 / size²), which evens out spacing locally
 * while keeping the change in size across the box.
 */
function relax(sites: Vec[], fixed: number, box: Rect, rounds: number, sizeAt?: (p: Vec) => number): Vec[] {
  let out = sites;
  for (let k = 0; k < rounds; k++) {
    const cells = voronoiCells(out, box);
    out = out.map((p, i) => (i < fixed || cells[i]!.length < 3 ? p : sizeAt ? weightedCentroid(cells[i]!, sizeAt) : centroid(cells[i]!)));
  }
  return out;
}

/** Centroid of a convex polygon with density 1 / sizeAt², by fan triangles. */
function weightedCentroid(poly: Polygon, sizeAt: (p: Vec) => number): Vec {
  let sx = 0, sy = 0, sw = 0;
  const a = poly[0]!;
  for (let i = 1; i + 1 < poly.length; i++) {
    const b = poly[i]!, c = poly[i + 1]!;
    const ar = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
    const m = vec((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3);
    const f = Math.max(1e-3, sizeAt(m));
    const w = ar / (f * f);
    sx += m.x * w; sy += m.y * w; sw += w;
  }
  return sw > 0 ? vec(sx / sw, sy / sw) : centroid(poly);
}

export function generateVoronoi(spec: VoronoiSpec, ctx: GenerateContext): RawTile[] {
  const size = positive("voronoi.size", spec.size);
  const box = bbox(ctx.region);
  checkCount("Voronoi", expectedSites(box, size, ctx.sizeAt), ctx);
  const rng = mulberry32(spec.seed ?? 1);
  const sites = relax(randomSites(box, size, rng, ctx.sizeAt), 0, box, Math.max(0, Math.round(spec.relax ?? 2)), ctx.sizeAt);
  return voronoiCells(sites, box)
    .map((polygon, i) => ({ id: `v${i}`, polygon, protoTile: 0 }))
    .filter((t) => t.polygon.length >= 3);
}

/** Bowyer–Watson Delaunay triangulation. Returns index triples into `pts`. */
export function delaunayTriangles(pts: Vec[]): [number, number, number][] {
  const box = bbox(pts);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const d = Math.max(box.width, box.height, 1) * 50;
  const all = [...pts, vec(cx - d, cy - d), vec(cx + d, cy - d), vec(cx, cy + d)];
  const n = pts.length;

  type Tri = { a: number; b: number; c: number; x: number; y: number; r2: number };
  const make = (a: number, b: number, c: number): Tri => {
    const A = all[a]!, B = all[b]!, C = all[c]!;
    const D = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
    const a2 = A.x * A.x + A.y * A.y, b2 = B.x * B.x + B.y * B.y, c2 = C.x * C.x + C.y * C.y;
    const x = (a2 * (B.y - C.y) + b2 * (C.y - A.y) + c2 * (A.y - B.y)) / D;
    const y = (a2 * (C.x - B.x) + b2 * (A.x - C.x) + c2 * (B.x - A.x)) / D;
    return { a, b, c, x, y, r2: (A.x - x) ** 2 + (A.y - y) ** 2 };
  };

  let tris: Tri[] = [make(n, n + 1, n + 2)];
  for (let i = 0; i < n; i++) {
    const p = all[i]!;
    const bad: Tri[] = [];
    const keep: Tri[] = [];
    for (const t of tris) ((p.x - t.x) ** 2 + (p.y - t.y) ** 2 < t.r2 ? bad : keep).push(t);
    // Boundary of the cavity: edges belonging to exactly one bad triangle.
    const edges = new Map<string, [number, number]>();
    for (const t of bad) {
      for (const [u, v] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]] as const) {
        const key = u < v ? `${u},${v}` : `${v},${u}`;
        if (edges.has(key)) edges.delete(key);
        else edges.set(key, [u, v]);
      }
    }
    for (const [u, v] of edges.values()) keep.push(make(u, v, i));
    tris = keep;
  }
  return tris.filter((t) => t.a < n && t.b < n && t.c < n).map((t) => [t.a, t.b, t.c]);
}

export function generateDelaunay(spec: DelaunaySpec, ctx: GenerateContext): RawTile[] {
  const size = positive("delaunay.size", spec.size);
  const box = bbox(ctx.region);
  // Roughly two triangles per site.
  checkCount("triangle", 2 * expectedSites(box, size, ctx.sizeAt), ctx);
  const rng = mulberry32(spec.seed ?? 1);

  // Fixed sites around the outside of the box, nudged outwards at random so the
  // triangulation covers the whole box and no four points are exactly cocircular.
  const pad = () => size * (0.05 + 0.1 * rng());
  const { x, y, width: w, height: h } = box;
  const ring: Vec[] = [vec(x - pad(), y - pad()), vec(x + w + pad(), y - pad()), vec(x + w + pad(), y + h + pad()), vec(x - pad(), y + h + pad())];
  // Points along the outside, closer together where tiles should be small.
  const local = (p: Vec) => size * Math.min(1, Math.max(0.05, ctx.sizeAt ? ctx.sizeAt(p) : 1));
  // Evenly spaced along each side, at the smallest size wanted along it.
  const along = (len: number, a: Vec, b: Vec) => {
    let step = Infinity;
    for (let t = 0; t <= 1; t += 0.125) step = Math.min(step, local(vec(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)));
    return Math.max(1, Math.round(len / step));
  };
  for (let k = 1, m = along(w, vec(x, y), vec(x + w, y)); k < m; k++) ring.push(vec(x + (w * k) / m, y - pad()));
  for (let k = 1, m = along(w, vec(x, y + h), vec(x + w, y + h)); k < m; k++) ring.push(vec(x + w - (w * k) / m, y + h + pad()));
  for (let k = 1, m = along(h, vec(x + w, y), vec(x + w, y + h)); k < m; k++) ring.push(vec(x + w + pad(), y + (h * k) / m));
  for (let k = 1, m = along(h, vec(x, y), vec(x, y + h)); k < m; k++) ring.push(vec(x - pad(), y + h - (h * k) / m));

  const outer: Rect = { x: x - size, y: y - size, width: w + 2 * size, height: h + 2 * size };
  const inner: Rect = { x: x + size / 4, y: y + size / 4, width: Math.max(0, w - size / 2), height: Math.max(0, h - size / 2) };
  const sites = relax([...ring, ...randomSites(inner, size, rng, ctx.sizeAt)], ring.length, outer, Math.max(0, Math.round(spec.relax ?? 2)), ctx.sizeAt);

  return delaunayTriangles(sites).map(([a, b, c], i) => ({
    id: `d${i}`,
    polygon: [sites[a]!, sites[b]!, sites[c]!],
    protoTile: 0,
  }));
}

export function generateAshlar(spec: AshlarSpec, ctx: GenerateContext): RawTile[] {
  const height = positive("ashlar.height", spec.height);
  const minL = positive("ashlar.minLength", spec.minLength);
  const maxL = positive("ashlar.maxLength", spec.maxLength);
  if (maxL < minL) throw new RangeError("ashlar.maxLength must be at least ashlar.minLength");
  const variation = Math.min(0.9, Math.max(0, spec.heightVariation ?? 0));
  const box = bbox(ctx.region);
  checkCount("ashlar", (box.width * box.height) / (height * minL), ctx);
  const rng = mulberry32(spec.seed ?? 1);
  const between = (lo: number, hi: number) => lo + rng() * (hi - lo);
  const minCourse = height * (1 - variation);
  const maxCourse = height * (1 + variation);

  const tiles: RawTile[] = [];
  const right = box.x + box.width;
  const bottom = box.y + box.height;
  let prevSeams: number[] = [];
  let y = box.y;
  for (let row = 0; y < bottom - 1e-9; row++) {
    let h = height * (1 + variation * (2 * rng() - 1));
    // Never leave less than a minimum course below: take the rest in one course if it
    // fits, otherwise split it evenly over two.
    const rest = bottom - y;
    if (rest - h < minCourse) h = rest <= maxCourse ? rest : rest / 2;

    const seams: number[] = [];
    let x = box.x;
    for (let k = 0; x < right - 1e-9; k++) {
      const rest = right - x;
      let len = 0;
      // Avoid lining up with a joint in the course above; a few tries is plenty.
      for (let attempt = 0; attempt < 6; attempt++) {
        if (rest <= maxL) len = rest;
        else if (rest < maxL + minL) len = between(Math.min(minL, rest / 2), rest - Math.min(minL, rest / 2));
        else len = between(minL, maxL);
        const seam = x + len;
        if (len === rest || prevSeams.every((s) => Math.abs(s - seam) > minL / 4)) break;
      }
      tiles.push({ id: `a${row}-${k}`, polygon: rectPolygon(x, y, len, h), protoTile: 0 });
      x += len;
      if (x < right - 1e-9) seams.push(x);
    }
    prevSeams = seams;
    y += h;
  }
  return tiles;
}

/**
 * Points of one jigsaw tab along the edge p → q (excluding p and q), bulging to the
 * left of the direction of travel when `side` is 1 and to the right when it is -1.
 * `unit` sets the tab's size; `at` (0–1) is where along the edge it sits.
 */
function tab(p: Vec, q: Vec, side: number, unit: number, at: number): Vec[] {
  const len = Math.hypot(q.x - p.x, q.y - p.y);
  const u = vec((q.x - p.x) / len, (q.y - p.y) / len);
  const n = vec(u.y * side, -u.x * side);
  const put = (along: number, out: number) => vec(p.x + u.x * along + n.x * out, p.y + u.y * along + n.y * out);
  const c = len * at; // tab center, along the edge
  const head = 0.2 * unit; // head center, out from the edge
  const r = 0.12 * unit;
  const neck = 0.9; // radians either side of "straight back at the edge" where the head meets the neck
  const pts: Vec[] = [put(c - 0.12 * unit, 0)];
  // Round the head the long way: from the neck on one side, out and around, to the other.
  const steps = 18;
  const start = -Math.PI / 2 - neck;
  const sweep = -(2 * Math.PI - 2 * neck);
  for (let k = 0; k <= steps; k++) {
    const a = start + (sweep * k) / steps;
    // Local frame: x along the edge, y outward (so -π/2 points back at the edge).
    pts.push(put(c + r * Math.cos(a), head + r * Math.sin(a)));
  }
  pts.push(put(c + 0.12 * unit, 0));
  return pts;
}

/**
 * A jigsaw puzzle: a grid sized to fit the region's bounding box exactly, with a tab
 * on every inner edge pointing randomly into one of the two pieces.
 */
export function generateJigsaw(spec: JigsawSpec, ctx: GenerateContext): RawTile[] {
  const size = positive("jigsaw.size", spec.size);
  const box = bbox(ctx.region);
  const cols = Math.max(1, Math.round(box.width / size));
  const rows = Math.max(1, Math.round(box.height / size));
  checkCount("jigsaw", cols * rows, ctx);
  const rng = mulberry32(spec.seed ?? 1);
  const cw = box.width / cols;
  const ch = box.height / rows;
  const unit = Math.min(cw, ch);
  const corner = (i: number, j: number) => vec(box.x + i * cw, box.y + j * ch);

  // Shared edges, each stored once in a fixed direction: horizontal edges left → right,
  // vertical edges top → bottom. Border edges stay straight.
  const edge = (p: Vec, q: Vec, inner: boolean): Vec[] => (inner ? tab(p, q, rng() < 0.5 ? 1 : -1, unit, 0.42 + 0.16 * rng()) : []);
  const horizontal: Vec[][][] = [];
  for (let j = 0; j <= rows; j++) {
    horizontal.push([]);
    for (let i = 0; i < cols; i++) horizontal[j]!.push(edge(corner(i, j), corner(i + 1, j), j > 0 && j < rows));
  }
  const vertical: Vec[][][] = [];
  for (let i = 0; i <= cols; i++) {
    vertical.push([]);
    for (let j = 0; j < rows; j++) vertical[i]!.push(edge(corner(i, j), corner(i, j + 1), i > 0 && i < cols));
  }

  const tiles: RawTile[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const polygon = [
        corner(i, j),
        ...horizontal[j]![i]!,
        corner(i + 1, j),
        ...vertical[i + 1]![j]!,
        corner(i + 1, j + 1),
        ...[...horizontal[j + 1]![i]!].reverse(),
        corner(i, j + 1),
        ...[...vertical[i]![j]!].reverse(),
      ];
      tiles.push({ id: `j${i},${j}`, polygon, protoTile: 0 });
    }
  }
  return tiles;
}
