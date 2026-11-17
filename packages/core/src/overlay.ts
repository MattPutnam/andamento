import { area, centroid, signedArea, vec, type Polygon, type Vec } from "./geometry";
import { pointInPolygon } from "./offset";

/**
 * Polygon boolean operations by overlay.
 *
 * Every input outline is cut at every point where it meets another, giving a set of
 * pieces that don't cross. For each piece, a point just to its left and just to its
 * right is tested against what the result should contain (any combination of inside /
 * outside tests). Pieces with the result on exactly one side form the result's
 * boundary, oriented with the result on the left, and are chained into loops.
 *
 * This handles holes, shapes touching at a point, and edges that run along each other,
 * as long as features are much larger than the tolerance.
 */

/** A region with holes: `outer` is positively oriented, `holes` negatively. */
export interface Shape {
  outer: Polygon;
  holes: Polygon[];
}

type Seg = { ax: number; ay: number; bx: number; by: number };

/**
 * The boundary of `{ p : inside(p) }` among the given outlines, as shapes.
 * `scale` is the size of the scene; tolerances are relative to it.
 */
export function overlay(outlines: Polygon[], inside: (p: Vec) => boolean, scale: number): Shape[] {
  const eps = 1e-9 * scale;
  const delta = 1e-7 * scale;

  const segs: Seg[] = [];
  for (const poly of outlines) {
    for (let i = 0, n = poly.length; i < n; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % n]!;
      if (Math.hypot(b.x - a.x, b.y - a.y) > eps) segs.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y });
    }
  }

  // Cut points per segment, as (t, x, y).
  const cuts: number[][] = segs.map((s) => [0, s.ax, s.ay, 1, s.bx, s.by]);
  const addCut = (k: number, t: number, x: number, y: number) => cuts[k]!.push(t, x, y);

  /** If point (x, y) lies on segment k away from its ends, cut it there. */
  const touch = (k: number, x: number, y: number) => {
    const s = segs[k]!;
    const dx = s.bx - s.ax, dy = s.by - s.ay;
    const len = Math.hypot(dx, dy);
    const t = ((x - s.ax) * dx + (y - s.ay) * dy) / (len * len);
    if (t * len <= eps || (1 - t) * len <= eps) return false;
    if (Math.abs((x - s.ax) * dy - (y - s.ay) * dx) / len > eps) return false;
    addCut(k, t, x, y);
    return true;
  };

  // Sweep over segments sorted by left end; only overlapping x-ranges can meet.
  const order = segs.map((_, i) => i);
  const x0 = segs.map((s) => Math.min(s.ax, s.bx));
  const x1 = segs.map((s) => Math.max(s.ax, s.bx));
  order.sort((a, b) => x0[a]! - x0[b]!);
  for (let oi = 0; oi < order.length; oi++) {
    const i = order[oi]!;
    const p = segs[i]!;
    const pminY = Math.min(p.ay, p.by), pmaxY = Math.max(p.ay, p.by);
    for (let oj = oi + 1; oj < order.length; oj++) {
      const j = order[oj]!;
      if (x0[j]! > x1[i]! + eps) break;
      const q = segs[j]!;
      if (Math.min(q.ay, q.by) > pmaxY + eps || Math.max(q.ay, q.by) < pminY - eps) continue;
      // Ends lying on the other segment (T-junctions and overlapping runs).
      const t1 = touch(i, q.ax, q.ay);
      const t2 = touch(i, q.bx, q.by);
      const t3 = touch(j, p.ax, p.ay);
      const t4 = touch(j, p.bx, p.by);
      if (t1 || t2 || t3 || t4) continue;
      // A proper crossing.
      const d1x = p.bx - p.ax, d1y = p.by - p.ay;
      const d2x = q.bx - q.ax, d2y = q.by - q.ay;
      const den = d1x * d2y - d1y * d2x;
      if (den === 0) continue;
      const s = ((q.ax - p.ax) * d2y - (q.ay - p.ay) * d2x) / den;
      const r = ((q.ax - p.ax) * d1y - (q.ay - p.ay) * d1x) / den;
      const l1 = Math.hypot(d1x, d1y), l2 = Math.hypot(d2x, d2y);
      if (s * l1 <= eps || (1 - s) * l1 <= eps || r * l2 <= eps || (1 - r) * l2 <= eps) continue;
      const x = p.ax + d1x * s, y = p.ay + d1y * s;
      addCut(i, s, x, y);
      addCut(j, r, x, y);
    }
  }

  // Shared vertices: points closer than eps are the same vertex.
  const vx: number[] = [], vy: number[] = [];
  const grid = new Map<string, number[]>();
  const cell = eps * 4;
  const vertex = (x: number, y: number): number => {
    const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const v of grid.get(`${gx + dx},${gy + dy}`) ?? []) {
          if (Math.abs(vx[v]! - x) <= eps * 2 && Math.abs(vy[v]! - y) <= eps * 2) return v;
        }
      }
    }
    const id = vx.length;
    vx.push(x);
    vy.push(y);
    const key = `${gx},${gy}`;
    const list = grid.get(key);
    if (list) list.push(id);
    else grid.set(key, [id]);
    return id;
  };

  // Pieces between consecutive cuts, deduplicated (overlapping runs give the same piece twice).
  const seen = new Set<string>();
  const from: number[] = [], to: number[] = [];
  for (const c of cuts) {
    const idx = Array.from({ length: c.length / 3 }, (_, k) => k).sort((a, b) => c[a * 3]! - c[b * 3]!);
    let prev = vertex(c[idx[0]! * 3 + 1]!, c[idx[0]! * 3 + 2]!);
    for (let k = 1; k < idx.length; k++) {
      const v = vertex(c[idx[k]! * 3 + 1]!, c[idx[k]! * 3 + 2]!);
      if (v === prev) continue;
      const key = prev < v ? `${prev},${v}` : `${v},${prev}`;
      if (!seen.has(key)) {
        seen.add(key);
        const ax = vx[prev]!, ay = vy[prev]!, bx = vx[v]!, by = vy[v]!;
        const len = Math.hypot(bx - ax, by - ay);
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        // Left normal of (dx, dy) is (-dy, dx).
        const nx = (-(by - ay) / len) * delta, ny = ((bx - ax) / len) * delta;
        const left = inside(vec(mx + nx, my + ny));
        const right = inside(vec(mx - nx, my - ny));
        if (left && !right) { from.push(prev); to.push(v); }
        else if (right && !left) { from.push(v); to.push(prev); }
      }
      prev = v;
    }
  }

  // Chain boundary pieces into loops. Where several continue from one vertex (shapes
  // touching at a point), take the sharpest left turn, which keeps the loops separate.
  const outgoing = new Map<number, number[]>();
  from.forEach((v, e) => {
    const list = outgoing.get(v);
    if (list) list.push(e);
    else outgoing.set(v, [e]);
  });
  const used = new Uint8Array(from.length);
  const loops: Polygon[] = [];
  for (let e0 = 0; e0 < from.length; e0++) {
    if (used[e0]) continue;
    used[e0] = 1;
    const start = from[e0]!;
    const loop: Vec[] = [vec(vx[start]!, vy[start]!)];
    let e = e0;
    let closed = false;
    for (let guard = 0; guard <= from.length; guard++) {
      const v = to[e]!;
      if (v === start) { closed = true; break; }
      loop.push(vec(vx[v]!, vy[v]!));
      const inx = vx[v]! - vx[from[e]!]!, iny = vy[v]! - vy[from[e]!]!;
      let best = -1, bestTurn = -Infinity;
      for (const f of outgoing.get(v) ?? []) {
        if (used[f]) continue;
        const ox = vx[to[f]!]! - vx[v]!, oy = vy[to[f]!]! - vy[v]!;
        const turn = Math.atan2(inx * oy - iny * ox, inx * ox + iny * oy);
        if (turn > bestTurn) { bestTurn = turn; best = f; }
      }
      if (best < 0) break;
      used[best] = 1;
      e = best;
    }
    if (closed) {
      const clean = dropCollinear(loop, eps);
      if (clean.length >= 3 && Math.abs(signedArea(clean)) > eps * scale) loops.push(clean);
    }
  }

  // Positive loops are outlines, negative ones holes; each hole goes in the smallest
  // outline around it.
  const outers = loops.filter((l) => signedArea(l) > 0).sort((a, b) => area(a) - area(b));
  const shapes: Shape[] = outers.map((outer) => ({ outer, holes: [] }));
  for (const hole of loops.filter((l) => signedArea(l) < 0)) {
    // A point just inside the result next to the hole: left of its first edge.
    const a = hole[0]!, b = hole[1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const p = vec((a.x + b.x) / 2 - ((b.y - a.y) / len) * delta, (a.y + b.y) / 2 + ((b.x - a.x) / len) * delta);
    const home = shapes.find((s) => pointInPolygon(p, s.outer));
    if (home) home.holes.push(hole);
  }
  return shapes;
}

function dropCollinear(loop: Vec[], eps: number): Vec[] {
  let pts = loop;
  for (let changed = true; changed && pts.length >= 3; ) {
    changed = false;
    const out: Vec[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = out.length ? out[out.length - 1]! : pts[pts.length - 1]!;
      const v = pts[i]!;
      const b = pts[(i + 1) % pts.length]!;
      const ux = v.x - a.x, uy = v.y - a.y, wx = b.x - v.x, wy = b.y - v.y;
      const lw = Math.hypot(wx, wy) || 1;
      // v is on the straight line from a to b, going forward.
      if (Math.abs(ux * wy - uy * wx) / lw <= eps && ux * wx + uy * wy > 0) { changed = true; continue; }
      out.push(v);
    }
    pts = out;
  }
  return pts;
}

/** Even–odd membership in a set of non-overlapping loops (outlines and their holes). */
export function inShapes(p: Vec, loops: Polygon[]): boolean {
  let inside = false;
  for (const l of loops) if (pointInPolygon(p, l)) inside = !inside;
  return inside;
}

/** Area of a shape (outline minus holes). */
export const shapeArea = (s: Shape): number => area(s.outer) - s.holes.reduce((sum, h) => sum + area(h), 0);

/** Centroid of a shape, holes included. */
export function shapeCentroid(s: Shape): Vec {
  let ax = 0, ay = 0, aw = 0;
  for (const [loop, sign] of [[s.outer, 1], ...s.holes.map((h) => [h, -1] as const)] as const) {
    const a = area(loop);
    const c = centroid(loop);
    ax += c.x * a * sign;
    ay += c.y * a * sign;
    aw += a * sign;
  }
  return aw > 0 ? vec(ax / aw, ay / aw) : centroid(s.outer);
}
