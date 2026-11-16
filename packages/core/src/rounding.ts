import { add, dot, length, scale, sub, type Polygon, type Vec } from "./geometry";

/**
 * One corner of a polygon after rounding: the outline runs straight to `start`,
 * follows a circular arc of `radius` around `center` to `end`, then continues.
 * When `radius` is 0 (a straight-through or degenerate corner), start, end and
 * center are all the original vertex.
 */
export interface RoundedCorner {
  vertex: Vec;
  start: Vec;
  end: Vec;
  center: Vec;
  radius: number;
  /** Signed arc angle in radians, from start to end around center (atan2 convention, y down). */
  sweep: number;
}

const unit = (v: Vec): Vec => {
  const l = length(v);
  return l > 0 ? scale(v, 1 / l) : v;
};

/**
 * Fit a circular arc of `radius` into every corner of `poly`.
 *
 * Each corner's radius is reduced where needed so an arc never uses more than
 * half of either adjacent edge, so short edges and sharp corners stay valid and
 * neighbouring arcs never overlap.
 */
export function roundCorners(poly: Polygon, radius: number): RoundedCorner[] {
  const n = poly.length;
  return poly.map((v, i) => {
    const prev = poly[(i - 1 + n) % n]!;
    const next = poly[(i + 1) % n]!;
    const flat: RoundedCorner = { vertex: v, start: v, end: v, center: v, radius: 0, sweep: 0 };
    if (radius <= 0 || n < 3) return flat;

    const toPrev = sub(prev, v);
    const toNext = sub(next, v);
    const lenPrev = length(toPrev);
    const lenNext = length(toNext);
    if (lenPrev === 0 || lenNext === 0) return flat;
    const u = scale(toPrev, 1 / lenPrev);
    const w = scale(toNext, 1 / lenNext);

    // Interior angle at the vertex; nothing to round on a straight line.
    const angle = Math.acos(Math.max(-1, Math.min(1, dot(u, w))));
    const half = angle / 2;
    if (half < 1e-9 || Math.PI - angle < 1e-9) return flat;

    // Distance from the vertex to where the arc meets each edge.
    let r = radius;
    let t = r / Math.tan(half);
    const limit = Math.min(lenPrev, lenNext) / 2;
    if (t > limit) {
      t = limit;
      r = t * Math.tan(half);
    }

    const start = add(v, scale(u, t));
    const end = add(v, scale(w, t));
    const center = add(v, scale(unit(add(u, w)), r / Math.sin(half)));
    const a0 = Math.atan2(start.y - center.y, start.x - center.x);
    const a1 = Math.atan2(end.y - center.y, end.x - center.x);
    let sweep = a1 - a0;
    // Corner arcs always turn by less than half a circle.
    if (sweep > Math.PI) sweep -= 2 * Math.PI;
    if (sweep < -Math.PI) sweep += 2 * Math.PI;
    return { vertex: v, start, end, center, radius: r, sweep };
  });
}

/**
 * `poly` with its corners rounded, as a plain polygon: each arc is approximated
 * by straight segments of at most `maxStep` radians (default 10°). Useful where
 * curves aren't available, such as CSS `clip-path: polygon()`.
 */
export function roundedPolygon(poly: Polygon, radius: number, maxStep = Math.PI / 18): Polygon {
  if (radius <= 0) return poly;
  const out: Polygon = [];
  for (const c of roundCorners(poly, radius)) {
    if (c.radius === 0) {
      out.push(c.vertex);
      continue;
    }
    const steps = Math.max(1, Math.ceil(Math.abs(c.sweep) / maxStep));
    const a0 = Math.atan2(c.start.y - c.center.y, c.start.x - c.center.x);
    out.push(c.start);
    for (let s = 1; s < steps; s++) {
      const a = a0 + (c.sweep * s) / steps;
      out.push({ x: c.center.x + c.radius * Math.cos(a), y: c.center.y + c.radius * Math.sin(a) });
    }
    out.push(c.end);
  }
  return out;
}
