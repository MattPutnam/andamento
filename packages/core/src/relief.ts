import { vec, type Polygon, type Vec } from "./geometry";
import type { Cell, Layout } from "./layout";
import { pointInPolygon } from "./offset";
import { roundCorners } from "./rounding";
import { cellShape, type CellShape } from "./shape";

/**
 * Where light comes from, as a unit vector pointing from the surface towards the light.
 * `angle` is in degrees clockwise from the top, like CSS angles: 0 from above, 90 from the
 * right, 315 (the default) from the top left.
 */
export function lightVector(angle = 315): Vec {
  const a = (angle * Math.PI) / 180;
  return vec(Math.sin(a), -Math.cos(a));
}

export interface BevelOptions {
  /** Width of the bevel, in layout units. Narrowed per cell where the shape is too thin. */
  width: number;
  /** Direction the light comes from: degrees clockwise from the top (default 315, top left). */
  light?: number;
}

/** One sloped face of a bevel. */
export interface BevelFacet {
  polygon: Polygon;
  /**
   * How much the face turns towards the light, from 1 (straight at it: draw a highlight)
   * through 0 to -1 (straight away: draw a shadow).
   */
  shade: number;
}

/**
 * The bevel round a cell's edges (outline, holes and rounded corners; the whole tile for a
 * window cell, see `cellShape`), as a band of
 * sloped faces `width` wide, each shaded by how it faces the light. Draw light faces with
 * translucent white and dark ones with translucent black over the cell, and the tile looks
 * raised, like a real tile or tessera. The band is narrowed where a cell is too thin for it.
 */
export function bevelFacets(cell: Cell, layout: Pick<Layout, "cornerRadius">, options: BevelOptions): BevelFacet[] {
  const want = Math.max(0, options.width);
  const shape = cellShape(cell);
  if (want === 0 || shape.outline.length < 3) return [];
  const loops = [shape.outline, ...shape.holes].map((p) => prepare(p, shape, layout.cornerRadius)).filter((l) => l.outer.length >= 3);
  if (loops.length === 0) return [];

  // Narrow the band until the inner outline is clean.
  let d = want;
  if (!valid(loops, d)) {
    let lo = 0, hi = want;
    for (let it = 0; it < 14; it++) {
      const mid = (lo + hi) / 2;
      if (valid(loops, mid)) lo = mid;
      else hi = mid;
    }
    d = lo;
  }
  if (d <= 0) return [];

  const light = lightVector(options.light);
  const facets: BevelFacet[] = [];
  for (const loop of loops) {
    const inner = innerLoop(loop, d);
    const { outer, normal } = loop;
    for (let i = 0, n = outer.length; i < n; i++) {
      const j = (i + 1) % n;
      const a = outer[i]!, b = outer[j]!;
      if (a.x === b.x && a.y === b.y) continue;
      // The face slopes down towards the outside: it faces the outward normal.
      const shade = -(normal[i]!.x * light.x + normal[i]!.y * light.y);
      facets.push({ polygon: [a, b, inner[j]!, inner[i]!], shade });
    }
  }
  return facets;
}

/**
 * A loop's outline points (as drawn, with rounded corners), the inward normal of the edge
 * from each point to the next, and how each point moves inwards as the band widens.
 */
interface Loop {
  outer: Vec[];
  normal: Vec[];
  /** Per point: a rounded-corner arc point (centre, radius, convex) or a sharp corner. */
  kind: ({ arc: true; center: Vec; radius: number; convex: boolean; vertex: Vec; n1: Vec; n2: Vec } | { arc: false; n1: Vec; n2: Vec })[];
}

function prepare(poly: Polygon, cell: CellShape, radius: number): Loop {
  const corners = roundCorners(poly, radius);
  const n = poly.length;
  // Which side of the loop is the tile: test a point just left of the longest edge.
  let li = 0, ll = -1;
  for (let i = 0; i < n; i++) {
    const a = poly[i]!, b = poly[(i + 1) % n]!;
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    if (l > ll) { ll = l; li = i; }
  }
  const a = poly[li]!, b = poly[(li + 1) % n]!;
  const eps = 1e-6 * Math.max(cell.bbox.width, cell.bbox.height, 1e-12);
  const left = vec(-(b.y - a.y) / ll, (b.x - a.x) / ll);
  const probe = vec((a.x + b.x) / 2 + left.x * eps, (a.y + b.y) / 2 + left.y * eps);
  const inside = pointInPolygon(probe, cell.outline) && !cell.holes.some((h) => pointInPolygon(probe, h));
  const side = inside ? 1 : -1;
  const inward = (p: Vec, q: Vec): Vec => {
    const l = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    return vec((-(q.y - p.y) / l) * side, ((q.x - p.x) / l) * side);
  };

  const outer: Vec[] = [];
  const kind: Loop["kind"] = [];
  for (let i = 0; i < n; i++) {
    const c = corners[i]!;
    // The nearest distinct neighbours: outlines can repeat a point.
    const same = (p: Vec, q: Vec) => Math.abs(p.x - q.x) <= eps * 1e-3 && Math.abs(p.y - q.y) <= eps * 1e-3;
    let prev = poly[(i - 1 + n) % n]!, next = poly[(i + 1) % n]!;
    for (let k = 2; k < n && same(prev, c.vertex); k++) prev = poly[(i - k + n) % n]!;
    for (let k = 2; k < n && same(next, c.vertex); k++) next = poly[(i + k) % n]!;
    const n1 = inward(prev, c.vertex), n2 = inward(c.vertex, next);
    if (c.radius === 0) {
      outer.push(c.vertex);
      kind.push({ arc: false, n1, n2 });
      continue;
    }
    // The same sampling as roundedPolygon, so the bevel lines up with the clip path.
    const steps = Math.max(1, Math.ceil(Math.abs(c.sweep) / (Math.PI / 18)));
    const a0 = Math.atan2(c.start.y - c.center.y, c.start.x - c.center.x);
    // Convex (seen from the tile) when the centre is on the tile side of the edge.
    const convex = (c.center.x - c.vertex.x) * n1.x + (c.center.y - c.vertex.y) * n1.y > 0;
    for (let s = 0; s <= steps; s++) {
      const p = s === 0 ? c.start : s === steps ? c.end : vec(c.center.x + c.radius * Math.cos(a0 + (c.sweep * s) / steps), c.center.y + c.radius * Math.sin(a0 + (c.sweep * s) / steps));
      outer.push(p);
      kind.push({ arc: true, center: c.center, radius: c.radius, convex, vertex: c.vertex, n1, n2 });
    }
  }
  const normal = outer.map((p, i) => inward(p, outer[(i + 1) % outer.length]!));
  // Drop repeated points (an arc meeting the next corner's arc at an edge's midpoint).
  const keep = outer.map((p, i) => {
    const q = outer[(i + 1) % outer.length]!;
    return Math.hypot(q.x - p.x, q.y - p.y) > eps * 1e-3;
  });
  return {
    outer: outer.filter((_, i) => keep[i]),
    normal: normal.filter((_, i) => keep[i]),
    kind: kind.filter((_, i) => keep[i]),
  };
}

/** Where the two edges at a sharp corner meet once both have moved in by `d`. */
const miter = (v: Vec, n1: Vec, n2: Vec, d: number): Vec => {
  const k = d / Math.max(1e-9, 1 + n1.x * n2.x + n1.y * n2.y);
  return vec(v.x + (n1.x + n2.x) * k, v.y + (n1.y + n2.y) * k);
};

function innerLoop(loop: Loop, d: number): Vec[] {
  return loop.outer.map((p, i) => {
    const k = loop.kind[i]!;
    if (!k.arc) return miter(p, k.n1, k.n2, d);
    // Arcs offset to concentric arcs; a convex one narrower than the band becomes the
    // sharp corner where the straight edges' offsets meet.
    const r = k.convex ? k.radius - d : k.radius + d;
    if (r <= 0) return miter(k.vertex, k.n1, k.n2, d);
    const ux = p.x - k.center.x, uy = p.y - k.center.y;
    const l = Math.hypot(ux, uy) || 1;
    return vec(k.center.x + (ux / l) * r, k.center.y + (uy / l) * r);
  });
}

/** The inner outlines at width `d` keep every edge's direction and don't cross. */
function valid(loops: Loop[], d: number): boolean {
  const segs: [Vec, Vec][] = [];
  for (const loop of loops) {
    const inner = innerLoop(loop, d);
    const n = inner.length;
    for (let i = 0; i < n; i++) {
      const a = loop.outer[i]!, b = loop.outer[(i + 1) % n]!;
      const p = inner[i]!, q = inner[(i + 1) % n]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      // An inner edge pointing backwards means the band folded over.
      if ((q.x - p.x) * (b.x - a.x) + (q.y - p.y) * (b.y - a.y) < -1e-9 * len * len) return false;
      if (Math.hypot(q.x - p.x, q.y - p.y) > 1e-9 * len) segs.push([p, q]);
    }
  }
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      if (crosses(segs[i]![0], segs[i]![1], segs[j]![0], segs[j]![1])) return false;
    }
  }
  return true;
}

/** Proper crossing: each segment's ends strictly on opposite sides of the other. */
function crosses(a: Vec, b: Vec, c: Vec, d: Vec): boolean {
  const o = (p: Vec, q: Vec, r: Vec) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const s1 = Math.hypot(b.x - a.x, b.y - a.y), s2 = Math.hypot(d.x - c.x, d.y - c.y);
  const tol = 1e-9 * s1 * s2;
  const d1 = o(a, b, c), d2 = o(a, b, d), d3 = o(c, d, a), d4 = o(c, d, b);
  return ((d1 > tol && d2 < -tol) || (d1 < -tol && d2 > tol)) && ((d3 > tol && d4 < -tol) || (d3 < -tol && d4 > tol));
}
