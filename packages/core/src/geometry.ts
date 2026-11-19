/**
 * Small, dependency-free 2D geometry kernel.
 *
 * Conventions:
 * - Coordinates are SVG-style (y grows downward), but all math is orientation-agnostic.
 * - Polygons are arrays of vertices without a repeated closing vertex.
 * - "Positive" orientation means a positive shoelace area. All internal polygons are
 *   normalized to positive orientation, so the interior is to the left of each edge
 *   in the shoelace sense and the inward normal of edge (dx, dy) is (-dy, dx).
 * - `clipConvex` needs a convex clip polygon (the subject can be any simple polygon);
 *   `insetConvex` needs a convex polygon and `containsPolygon` a convex `outer`. Non-convex tiles are inset
 *   with `insetPolygon` (offset.ts).
 */

export interface Vec {
  x: number;
  y: number;
}

export type Polygon = Vec[];

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const vec = (x: number, y: number): Vec => ({ x, y });

export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;
export const cross = (a: Vec, b: Vec): number => a.x * b.y - a.y * b.x;
export const length = (a: Vec): number => Math.hypot(a.x, a.y);

/** Polygon for an axis-aligned rectangle, in positive orientation. */
export function rectPolygon(x: number, y: number, width: number, height: number): Polygon {
  return [vec(x, y), vec(x + width, y), vec(x + width, y + height), vec(x, y + height)];
}

/** Shoelace signed area. Positive for the library's canonical orientation. */
export function signedArea(p: Polygon): number {
  let s = 0;
  for (let i = 0, n = p.length; i < n; i++) {
    const a = p[i]!;
    const b = p[(i + 1) % n]!;
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

export const area = (p: Polygon): number => Math.abs(signedArea(p));

export function ensurePositive(p: Polygon): Polygon {
  return signedArea(p) < 0 ? [...p].reverse() : p;
}

export function centroid(p: Polygon): Vec {
  const a = signedArea(p);
  if (Math.abs(a) < 1e-12) {
    // Degenerate: fall back to the vertex average.
    const s = p.reduce((acc, v) => add(acc, v), vec(0, 0));
    return scale(s, 1 / Math.max(p.length, 1));
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0, n = p.length; i < n; i++) {
    const v0 = p[i]!;
    const v1 = p[(i + 1) % n]!;
    const f = v0.x * v1.y - v1.x * v0.y;
    cx += (v0.x + v1.x) * f;
    cy += (v0.y + v1.y) * f;
  }
  return vec(cx / (6 * a), cy / (6 * a));
}

export function bbox(p: Polygon): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const v of p) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function rectsOverlap(a: Rect, b: Rect, tol = 0): boolean {
  return (
    a.x <= b.x + b.width + tol &&
    b.x <= a.x + a.width + tol &&
    a.y <= b.y + b.height + tol &&
    b.y <= a.y + a.height + tol
  );
}

/** Rotate by `radians` about the coordinate origin, then translate by `offset`. */
export function transform(p: Polygon, radians: number, offset: Vec): Polygon {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return p.map((v) => vec(v.x * c - v.y * s + offset.x, v.x * s + v.y * c + offset.y));
}

export function isConvex(p: Polygon, tol = 1e-9): boolean {
  const n = p.length;
  if (n < 3) return false;
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const a = p[i]!;
    const b = p[(i + 1) % n]!;
    const c = p[(i + 2) % n]!;
    const z = cross(sub(b, a), sub(c, b));
    if (Math.abs(z) <= tol) continue;
    const s = Math.sign(z);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return sign !== 0;
}

/**
 * Keep the part of `poly` where dot(normal, v - point) >= offset
 * (one pass of Sutherland–Hodgman).
 */
export function clipHalfPlane(poly: Polygon, point: Vec, normal: Vec, offset = 0): Polygon {
  const out: Polygon = [];
  const n = poly.length;
  if (n === 0) return out;
  const dist = (v: Vec) => dot(normal, sub(v, point)) - offset;
  let prev = poly[n - 1]!;
  let dPrev = dist(prev);
  for (let i = 0; i < n; i++) {
    const cur = poly[i]!;
    const dCur = dist(cur);
    if (dCur >= 0) {
      if (dPrev < 0) out.push(lerpAt(prev, cur, dPrev, dCur));
      out.push(cur);
    } else if (dPrev >= 0) {
      out.push(lerpAt(prev, cur, dPrev, dCur));
    }
    prev = cur;
    dPrev = dCur;
  }
  return out;
}

function lerpAt(a: Vec, b: Vec, da: number, db: number): Vec {
  const t = da / (da - db);
  return vec(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
}

function inwardNormal(a: Vec, b: Vec): Vec {
  const d = sub(b, a);
  const len = length(d);
  return len === 0 ? vec(0, 0) : vec(-d.y / len, d.x / len);
}

/** Remove consecutive duplicate vertices; return [] if the result has no area. */
export function cleanPolygon(p: Polygon, tol = 1e-9): Polygon {
  const out: Polygon = [];
  for (const v of p) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last.x - v.x) > tol || Math.abs(last.y - v.y) > tol) out.push(v);
  }
  while (out.length > 1) {
    const first = out[0]!;
    const last = out[out.length - 1]!;
    if (Math.abs(first.x - last.x) > tol || Math.abs(first.y - last.y) > tol) break;
    out.pop();
  }
  return out.length >= 3 && area(out) > tol * tol ? out : [];
}

/**
 * Intersection of `subject` (any simple polygon) with a convex `clip` polygon.
 * If a non-convex subject is cut into separate parts, they come back as one polygon
 * joined by zero-width strips along the clip edge; use `clipPolygonToConvex` to get
 * the parts separately.
 */
export function clipConvex(subject: Polygon, clip: Polygon): Polygon {
  const c = ensurePositive(clip);
  let out = subject;
  for (let i = 0, n = c.length; i < n && out.length > 0; i++) {
    const a = c[i]!;
    const b = c[(i + 1) % n]!;
    out = clipHalfPlane(out, a, inwardNormal(a, b));
  }
  return cleanPolygon(out);
}

/**
 * Shrink a convex polygon by moving every edge inward by `distance`.
 * Implemented as a half-plane intersection, so edges that collapse simply vanish
 * and an over-inset polygon returns [].
 */
export function insetConvex(poly: Polygon, distance: number): Polygon {
  const p = ensurePositive(poly);
  if (distance <= 0) return p;
  let out = p;
  for (let i = 0, n = p.length; i < n && out.length > 0; i++) {
    const a = p[i]!;
    const b = p[(i + 1) % n]!;
    out = clipHalfPlane(out, a, inwardNormal(a, b), distance);
  }
  return cleanPolygon(out);
}

/** True if every vertex of `inner` lies inside (or on) convex polygon `outer`. */
export function containsPolygon(outer: Polygon, inner: Polygon, tol = 1e-9): boolean {
  const o = ensurePositive(outer);
  for (let i = 0, n = o.length; i < n; i++) {
    const a = o[i]!;
    const nrm = inwardNormal(a, o[(i + 1) % n]!);
    for (const v of inner) if (dot(nrm, sub(v, a)) < -tol) return false;
  }
  return true;
}

/** Do two polygons share a boundary segment of positive length? */
export function sharesEdge(a: Polygon, b: Polygon, tol: number): boolean {
  for (let i = 0, n = a.length; i < n; i++) {
    const a0 = a[i]!;
    const a1 = a[(i + 1) % n]!;
    const d = sub(a1, a0);
    const len = length(d);
    if (len <= tol) continue;
    const u = scale(d, 1 / len);
    for (let j = 0, m = b.length; j < m; j++) {
      const b0 = b[j]!;
      const b1 = b[(j + 1) % m]!;
      // Both endpoints of b's edge must lie on a's edge line.
      if (Math.abs(cross(u, sub(b0, a0))) > tol || Math.abs(cross(u, sub(b1, a0))) > tol) continue;
      const t0 = dot(u, sub(b0, a0));
      const t1 = dot(u, sub(b1, a0));
      const lo = Math.max(0, Math.min(t0, t1));
      const hi = Math.min(len, Math.max(t0, t1));
      if (hi - lo > tol) return true;
    }
  }
  return false;
}

/** Convex hull (positive orientation) of a set of points. */
export function convexHull(points: Vec[]): Polygon {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const half = (list: Vec[]) => {
    const out: Vec[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(sub(out[out.length - 1]!, out[out.length - 2]!), sub(p, out[out.length - 1]!)) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return ensurePositive([...half(pts), ...half([...pts].reverse())]);
}
