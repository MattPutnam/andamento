import { area, cleanPolygon, ensurePositive, signedArea, vec, type Polygon, type Vec } from "./geometry";

/*
 * Inward offset (inset) for simple polygons that may be non-convex.
 *
 * Every edge moves inward by `distance` and neighboring offset edges are joined at
 * the intersection of their lines (a mitre join). That's exact at convex corners;
 * at concave corners it keeps a sharp corner, which is what makes neighboring
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

/**
 * Shrink a simple polygon (convex or not) by moving every edge inward by `distance`.
 * Returns [] if nothing is left. If the shape splits, the largest piece is returned.
 */
export function insetPolygon(poly: Polygon, distance: number): Polygon {
  const p = cleanPolygon(ensurePositive(poly));
  if (p.length < 3) return [];
  if (distance <= 0) return p;
  const pieces = offsetLoops(p, distance);
  if (pieces.length === 0) return [];
  let best = pieces[0]!;
  for (const q of pieces) if (area(q) > area(best)) best = q;
  return best;
}

/** Like `insetPolygon`, but every piece when a narrow neck pinches the shape apart. */
export function insetPolygonPieces(poly: Polygon, distance: number): Polygon[] {
  const p = cleanPolygon(ensurePositive(poly));
  if (p.length < 3) return [];
  if (distance <= 0) return [p];
  return offsetLoops(p, distance);
}

/**
 * Grow a simple polygon by moving every edge outward by `distance` (mitred corners;
 * pockets narrower than 2 × distance close up). Positively oriented.
 */
export function outsetPolygon(poly: Polygon, distance: number): Polygon {
  const p = cleanPolygon(ensurePositive(poly));
  if (p.length < 3) return [];
  if (distance <= 0) return p;
  // Offsetting toward the left of a clockwise outline moves it outward.
  const loops = offsetLoops([...p].reverse(), distance);
  let best: Polygon = [];
  for (const q of loops) if (area(q) > area(best)) best = q;
  return best.length ? [...best].reverse() : [];
}

/**
 * Move every edge of `p` (cleaned, either orientation) to its left by `distance`, and
 * return the resulting loops that keep `p`'s orientation.
 */
function offsetLoops(p: Polygon, distance: number): Polygon[] {
  const sign = Math.sign(signedArea(p));

  // Edge lines as flat arrays: a point on the edge, its unit direction and inward normal.
  const px: number[] = [], py: number[] = [], ux: number[] = [], uy: number[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!;
    const b = p[(i + 1) % p.length]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) continue;
    px.push(a.x);
    py.push(a.y);
    ux.push((b.x - a.x) / len);
    uy.push((b.y - a.y) / len);
  }
  const n = px.length;
  if (n < 3) return [];

  // Join of line i with the following line j at offset t (written to jx, jy). Parallel
  // lines (the same line continuing, or a hairpin) meet halfway.
  let jx = 0;
  let jy = 0;
  const join = (i: number, j: number, t: number) => {
    // Inward normal of a direction (x, y) is (-y, x).
    const ax = px[i]! - uy[i]! * t, ay = py[i]! + ux[i]! * t;
    const bx = px[j]! - uy[j]! * t, by = py[j]! + ux[j]! * t;
    const den = ux[i]! * uy[j]! - uy[i]! * ux[j]!;
    if (Math.abs(den) < 1e-12) {
      jx = (ax + bx) / 2;
      jy = (ay + by) / 2;
      return;
    }
    const s = ((bx - ax) * uy[j]! - (by - ay) * ux[j]!) / den;
    jx = ax + ux[i]! * s;
    jy = ay + uy[i]! * s;
  };

  // Doubly linked ring of the edges still present.
  const prev = Array.from({ length: n }, (_, k) => (k - 1 + n) % n);
  const next = Array.from({ length: n }, (_, k) => (k + 1) % n);
  const alive = new Array<boolean>(n).fill(true);
  const version = new Array<number>(n).fill(0);
  let count = n;

  /** Signed length of edge k between its current neighbors' joins, at offset t. */
  const lengthAt = (k: number, t: number) => {
    join(prev[k]!, k, t);
    const sx = jx, sy = jy;
    join(k, next[k]!, t);
    return (jx - sx) * ux[k]! + (jy - sy) * uy[k]!;
  };
  /** When edge k shrinks to nothing (Infinity if not before `distance`), from time t. */
  const collapseTime = (k: number, t: number) => {
    const now = lengthAt(k, t);
    const then = lengthAt(k, distance);
    if (then >= 0) return Infinity;
    return now <= 0 ? t : t + ((distance - t) * now) / (now - then);
  };

  // Edge events: drop edges in the order they collapse. Between events, lengths change
  // linearly with t, and a collapse only changes its two neighbors' collapse times, so
  // those are kept in a heap ordered by (time, edge index) and updated locally.
  type Event = { time: number; edge: number; version: number };
  const heap: Event[] = [];
  const before = (a: Event, b: Event) => a.time < b.time || (a.time === b.time && a.edge < b.edge);
  const push = (e: Event) => {
    heap.push(e);
    for (let i = heap.length - 1; i > 0; ) {
      const parent = (i - 1) >> 1;
      if (!before(heap[i]!, heap[parent]!)) break;
      [heap[i], heap[parent]] = [heap[parent]!, heap[i]!];
      i = parent;
    }
  };
  const pop = (): Event => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && before(heap[l]!, heap[m]!)) m = l;
        if (r < heap.length && before(heap[r]!, heap[m]!)) m = r;
        if (m === i) break;
        [heap[i], heap[m]] = [heap[m]!, heap[i]!];
        i = m;
      }
    }
    return top;
  };
  const schedule = (k: number, t: number) => {
    version[k]!++;
    const time = collapseTime(k, t);
    if (time < Infinity) push({ time, edge: k, version: version[k]! });
  };

  for (let k = 0; k < n; k++) schedule(k, 0);
  let t = 0;
  while (heap.length > 0 && count >= 3) {
    const e = pop();
    if (!alive[e.edge] || e.version !== version[e.edge]) continue; // stale
    t = Math.min(distance, Math.max(t, e.time));
    const k = e.edge;
    alive[k] = false;
    count--;
    const a = prev[k]!, b = next[k]!;
    next[a] = b;
    prev[b] = a;
    if (count >= 3) {
      schedule(a, t);
      schedule(b, t);
    }
  }
  if (count < 3) return [];

  const outline: Vec[] = [];
  let start = 0;
  while (!alive[start]) start++;
  let k = start;
  do {
    join(prev[k]!, k, distance);
    outline.push(vec(jx, jy));
    k = next[k]!;
  } while (k !== start);
  return splitSelfIntersections(outline)
    .filter((q) => signedArea(q) * sign > 0)
    .map((q) => dropStraightVertices(cleanPolygon(q)))
    .filter((q) => q.length >= 3);
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

/**
 * Intersection of a simple polygon (convex or not) with a convex `clip` polygon, as
 * separate pieces. Unlike `clipConvex`, a subject that the clip edge cuts into several
 * parts comes back as several clean polygons.
 *
 * The subject's outline is walked edge by edge; the stretches inside the clip region form
 * chains that enter and leave through the clip outline. Each piece is a chain followed by
 * a walk forward along the clip outline to wherever the next chain enters (both outlines
 * have the same orientation, so "forward" stays on the inside).
 */
export function clipPolygonToConvex(subject: Polygon, clip: Polygon): Polygon[] {
  const P = ensurePositive(subject);
  const C = ensurePositive(clip);
  const n = P.length;
  const m = C.length;
  if (n < 3 || m < 3) return [];
  let scale = 0;
  for (const v of C) scale = Math.max(scale, Math.abs(v.x), Math.abs(v.y));
  const eps = 1e-12 * Math.max(1, scale);

  // Inward normals of the clip edges.
  const normals = C.map((a, i) => {
    const b = C[(i + 1) % m]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return vec(-(b.y - a.y) / len, (b.x - a.x) / len);
  });

  /** Cyrus–Beck: the part [t0, t1] of segment a→b inside C, or null. */
  const clipSegment = (a: Vec, b: Vec): [number, number] | null => {
    let t0 = 0;
    let t1 = 1;
    for (let i = 0; i < m; i++) {
      const c = C[i]!;
      const nrm = normals[i]!;
      const num = nrm.x * (a.x - c.x) + nrm.y * (a.y - c.y) + eps;
      const den = nrm.x * (b.x - a.x) + nrm.y * (b.y - a.y);
      if (Math.abs(den) < 1e-15) {
        if (num < 0) return null;
      } else if (den > 0) {
        t0 = Math.max(t0, -num / den);
      } else {
        t1 = Math.min(t1, -num / den);
      }
      if (t0 > t1) return null;
    }
    return [t0, t1];
  };

  /** Position along the clip outline: edge index + fraction (0 ≤ s < m). */
  const outlinePos = (p: Vec): number => {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < m; i++) {
      const a = C[i]!;
      const b = C[(i + 1) % m]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      const d = Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
      if (d < bestD) {
        bestD = d;
        best = (i + t) % m;
      }
    }
    return best;
  };

  // Chains of inside stretches. A chain continues across a vertex when one edge's inside
  // part ends at the vertex and the next edge's starts there.
  type Chain = { points: Vec[]; open: boolean; close: boolean };
  const chains: Chain[] = [];
  const at = (a: Vec, b: Vec, t: number) => vec(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
  const tiny = 1e-12;
  let current: Chain | null = null;
  for (let i = 0; i < n; i++) {
    const a = P[i]!;
    const b = P[(i + 1) % n]!;
    const part = clipSegment(a, b);
    if (!part) {
      current = null;
      continue;
    }
    const [t0, t1] = part;
    if (current && t0 <= tiny) {
      current.points.push(at(a, b, t1));
    } else {
      current = { points: [at(a, b, t0), at(a, b, t1)], open: t0 > tiny, close: false };
      chains.push(current);
    }
    if (t1 < 1 - tiny) {
      current.close = true;
      current = null;
    }
  }
  if (chains.length === 0) {
    // No part of the outline is inside: either C lies within P, or they don't meet.
    return pointInPolygon(C[0]!, P) ? [C] : [];
  }
  // The walk started mid-chain if the last chain runs into the first one.
  if (chains.length > 1) {
    const last = chains[chains.length - 1]!;
    const first = chains[0]!;
    if (!last.close && !first.open) {
      first.points = [...last.points, ...first.points.slice(1)];
      first.open = last.open;
      chains.pop();
    }
  }
  if (chains.length === 1 && !chains[0]!.open && !chains[0]!.close) return [P];

  const entries = chains.map((c) => outlinePos(c.points[0]!));
  const exits = chains.map((c) => outlinePos(c.points[c.points.length - 1]!));
  const forward = (from: number, to: number) => ((to - from) % m + m) % m;

  const used = new Array<boolean>(chains.length).fill(false);
  const pieces: Polygon[] = [];
  for (let start = 0; start < chains.length; start++) {
    if (used[start]) continue;
    const piece: Vec[] = [];
    let k = start;
    for (let guard = 0; guard <= chains.length; guard++) {
      used[k] = true;
      piece.push(...chains[k]!.points);
      // Next chain to enter, walking forward along the clip outline from this exit.
      const s = exits[k]!;
      let next = -1;
      let bestGap = Infinity;
      for (let j = 0; j < chains.length; j++) {
        const gap = forward(s, entries[j]!);
        if (gap < bestGap - 1e-12) {
          bestGap = gap;
          next = j;
        }
      }
      // Clip corners passed on the way.
      for (let step = 1; step <= m; step++) {
        const corner = (Math.floor(s) + step) % m;
        if (forward(s, corner) > 0 && forward(s, corner) < bestGap) piece.push(C[corner]!);
        else break;
      }
      if (next === start || used[next]) break;
      k = next;
    }
    const clean = dropSpikes(cleanPolygon(piece), eps * 1e3);
    if (clean.length >= 3) pieces.push(clean);
  }
  return pieces;
}

/**
 * Remove zero-width spikes: points where the outline runs out along a line and straight
 * back (a tile edge lying along the clip edge can leave one). They have no area, but they
 * confuse anything that follows the outline, such as bevels.
 */
function dropSpikes(poly: Polygon, tol: number): Polygon {
  let pts = poly;
  for (let changed = true; changed && pts.length >= 3; ) {
    changed = false;
    for (let i = 0; i < pts.length && pts.length >= 3; i++) {
      const n = pts.length;
      const a = pts[(i - 1 + n) % n]!, v = pts[i]!, b = pts[(i + 1) % n]!;
      const ux = v.x - a.x, uy = v.y - a.y, wx = b.x - v.x, wy = b.y - v.y;
      const lu = Math.hypot(ux, uy), lw = Math.hypot(wx, wy);
      const flat = Math.abs(ux * wy - uy * wx) <= tol * Math.max(lu, lw, tol);
      if (lu <= tol || lw <= tol || (flat && ux * wx + uy * wy < 0)) {
        pts = [...pts.slice(0, i), ...pts.slice(i + 1)];
        changed = true;
        i--;
      }
    }
  }
  return pts.length >= 3 ? pts : [];
}
