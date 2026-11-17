import { area, cleanPolygon, ensurePositive, signedArea, vec, type Polygon, type Vec } from "./geometry";

/*
 * Inward offset (inset) for simple polygons that may be non-convex.
 *
 * Every edge moves inward by `distance` and neighbouring offset edges are joined at
 * the intersection of their lines (a mitre join). That's exact at convex corners;
 * at concave corners it keeps a sharp corner, which is what makes neighbouring
 * tiles stay exactly `2 × distance` apart, edge for edge.
 *
 * Two things can go wrong as the edges move:
 * - An edge shrinks to nothing and then turns inside out. Edges are removed in the
 *   order they collapse (the "edge events" of a straight skeleton) and the offset
 *   is recomputed without them.
 * - A narrow neck pinches off, splitting the shape. The offset outline then crosses
 *   itself; it is cut into loops and the largest proper (positively oriented) piece
 *   is kept.
 */

interface Line {
  /** A point on the original edge and its unit direction / inward normal. */
  p: Vec;
  u: Vec;
  n: Vec;
}

/** Intersection of two edge lines after moving both inward by `t`. */
function join(l0: Line, l1: Line, t: number): Vec {
  const a = vec(l0.p.x + l0.n.x * t, l0.p.y + l0.n.y * t);
  const b = vec(l1.p.x + l1.n.x * t, l1.p.y + l1.n.y * t);
  const den = l0.u.x * l1.u.y - l0.u.y * l1.u.x;
  if (Math.abs(den) < 1e-12) {
    // Parallel: the same line continuing (or a hairpin); meet halfway.
    return vec((a.x + b.x) / 2, (a.y + b.y) / 2);
  }
  const s = ((b.x - a.x) * l1.u.y - (b.y - a.y) * l1.u.x) / den;
  return vec(a.x + l0.u.x * s, a.y + l0.u.y * s);
}

/** Signed length of edge k between its joins, at offset t. */
function edgeLength(lines: Line[], k: number, t: number): number {
  const n = lines.length;
  const start = join(lines[(k - 1 + n) % n]!, lines[k]!, t);
  const end = join(lines[k]!, lines[(k + 1) % n]!, t);
  return (end.x - start.x) * lines[k]!.u.x + (end.y - start.y) * lines[k]!.u.y;
}

/**
 * Shrink a simple polygon (convex or not) by moving every edge inward by `distance`.
 * Returns [] if nothing is left. If the shape splits, the largest piece is returned.
 */
export function insetPolygon(poly: Polygon, distance: number): Polygon {
  const p = cleanPolygon(ensurePositive(poly));
  if (p.length < 3) return [];
  if (distance <= 0) return p;

  let lines: Line[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!;
    const b = p[(i + 1) % p.length]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) continue;
    const u = vec((b.x - a.x) / len, (b.y - a.y) / len);
    lines.push({ p: a, u, n: vec(-u.y, u.x) });
  }

  // Edge events: repeatedly drop the edge that collapses first, until none does
  // before reaching `distance`. Lengths change linearly with t between events, so
  // each edge's collapse time follows from its lengths at two offsets.
  let t = 0;
  while (lines.length >= 3) {
    let first = -1;
    let firstT = Infinity;
    for (let k = 0; k < lines.length; k++) {
      const now = edgeLength(lines, k, t);
      const then = edgeLength(lines, k, distance);
      if (then >= 0) continue;
      const tc = now <= 0 ? t : t + ((distance - t) * now) / (now - then);
      if (tc < firstT) {
        firstT = tc;
        first = k;
      }
    }
    if (first < 0) break;
    t = Math.min(distance, Math.max(t, firstT));
    lines = lines.filter((_, k) => k !== first);
  }
  if (lines.length < 3) return [];

  const outline = lines.map((l, k) => join(lines[(k - 1 + lines.length) % lines.length]!, l, distance));
  const pieces = splitSelfIntersections(outline).filter((q) => signedArea(q) > 0);
  if (pieces.length === 0) return [];
  let best = pieces[0]!;
  for (const q of pieces) if (area(q) > area(best)) best = q;
  return dropStraightVertices(cleanPolygon(best));
}

/** Remove vertices that sit in the middle of a straight run. */
function dropStraightVertices(poly: Polygon): Polygon {
  const out = poly.filter((v, i) => {
    const a = poly[(i - 1 + poly.length) % poly.length]!;
    const b = poly[(i + 1) % poly.length]!;
    const ux = v.x - a.x, uy = v.y - a.y, wx = b.x - v.x, wy = b.y - v.y;
    const cross = ux * wy - uy * wx;
    return Math.abs(cross) > 1e-12 * Math.hypot(ux, uy) * Math.hypot(wx, wy) || ux * wx + uy * wy < 0;
  });
  return out.length >= 3 ? out : poly;
}

/**
 * Where segments a0–a1 and b0–b1 cross, if they do: a proper crossing point, or the
 * middle of the shared stretch when they lie along the same line and overlap (which
 * is how a pinched-off neck shows up on straight-sided shapes).
 */
function crossing(a0: Vec, a1: Vec, b0: Vec, b1: Vec): Vec | null {
  const d1x = a1.x - a0.x, d1y = a1.y - a0.y;
  const d2x = b1.x - b0.x, d2y = b1.y - b0.y;
  const den = d1x * d2y - d1y * d2x;
  const len1 = Math.hypot(d1x, d1y);
  const len2 = Math.hypot(d2x, d2y);
  if (Math.abs(den) <= 1e-12 * len1 * len2) {
    if (len1 === 0) return null;
    // Parallel. Collinear only if b0 lies on a's line.
    const off = ((b0.x - a0.x) * d1y - (b0.y - a0.y) * d1x) / len1;
    if (Math.abs(off) > 1e-9 * Math.max(len1, len2)) return null;
    const along = (v: Vec) => ((v.x - a0.x) * d1x + (v.y - a0.y) * d1y) / (len1 * len1);
    const lo = Math.max(0, Math.min(along(b0), along(b1)));
    const hi = Math.min(1, Math.max(along(b0), along(b1)));
    if (hi - lo <= 1e-9) return null;
    const m = (lo + hi) / 2;
    return vec(a0.x + d1x * m, a0.y + d1y * m);
  }
  const s = ((b0.x - a0.x) * d2y - (b0.y - a0.y) * d2x) / den;
  const r = ((b0.x - a0.x) * d1y - (b0.y - a0.y) * d1x) / den;
  const eps = 1e-12;
  if (s <= eps || s >= 1 - eps || r <= eps || r >= 1 - eps) return null;
  return vec(a0.x + d1x * s, a0.y + d1y * s);
}

/** Cut a closed outline at its self-crossings into simple loops. */
export function splitSelfIntersections(poly: Polygon): Polygon[] {
  const n = poly.length;
  // Sweep over edges sorted by their left end; only edges whose x-ranges overlap can cross.
  const order = Array.from({ length: n }, (_, i) => i);
  const x0 = order.map((i) => Math.min(poly[i]!.x, poly[(i + 1) % n]!.x));
  const x1 = order.map((i) => Math.max(poly[i]!.x, poly[(i + 1) % n]!.x));
  order.sort((a, b) => x0[a]! - x0[b]!);
  const eps = 1e-12 * (1 + Math.abs(x1[order[n - 1]!]!));
  for (let oa = 0; oa < n; oa++) {
    const a = order[oa]!;
    for (let ob = oa + 1; ob < n; ob++) {
      const b = order[ob]!;
      if (x0[b]! > x1[a]! + eps) break;
      const i = Math.min(a, b);
      const j = Math.max(a, b);
      if (j - i < 2 || (i === 0 && j === n - 1)) continue; // adjacent edges
      const x = crossing(poly[i]!, poly[(i + 1) % n]!, poly[j]!, poly[(j + 1) % n]!);
      if (!x) continue;
      // Loop 1 skips from edge i to edge j at the crossing; loop 2 is what it skipped.
      const one = [...poly.slice(0, i + 1), x, ...poly.slice(j + 1)];
      const two = [x, ...poly.slice(i + 1, j + 1)];
      return [...splitSelfIntersections(one), ...splitSelfIntersections(two)];
    }
  }
  return [poly];
}

/** Ray-casting point-in-polygon test (even–odd rule). */
export function pointInPolygon(pt: Vec, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
