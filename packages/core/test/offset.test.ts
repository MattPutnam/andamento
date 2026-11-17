import { describe, expect, it } from "vitest";
import {
  area,
  clipConvex,
  clipPolygonToConvex,
  createLayout,
  fishScale,
  hat,
  insetConvex,
  insetPolygon,
  isohedral,
  jigsaw,
  rectPolygon,
  roundedPolygon,
  signedArea,
  spectre,
  splitSelfIntersections,
  type Polygon,
} from "@andamento/core";

const L: Polygon = [
  { x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 0, y: 2 },
];

describe("insetPolygon", () => {
  it("matches insetConvex on convex shapes", () => {
    const hex: Polygon = Array.from({ length: 6 }, (_, k) => ({ x: 10 * Math.cos((k * Math.PI) / 3), y: 10 * Math.sin((k * Math.PI) / 3) }));
    for (const shape of [rectPolygon(0, 0, 10, 4), hex]) {
      for (const d of [0.5, 1.9, 3]) expect(area(insetPolygon(shape, d))).toBeCloseTo(area(insetConvex(shape, d)), 9);
    }
    expect(insetPolygon(rectPolygon(0, 0, 10, 4), 2.5)).toEqual([]);
  });

  it("keeps sharp mitred corners on an L shape", () => {
    const r = insetPolygon(L, 0.1);
    expect(r).toHaveLength(6);
    expect(area(r)).toBeCloseTo(1.8 * 0.8 + 0.8 * 1.0, 9);
    expect(r).toContainEqual({ x: expect.closeTo(0.9, 9), y: expect.closeTo(0.9, 9) });
  });

  it("widens notches", () => {
    // Shrinking the material makes a notch wider and deeper.
    const notched: Polygon = [
      { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 2.2, y: 4 }, { x: 2.2, y: 3 }, { x: 1.8, y: 3 }, { x: 1.8, y: 4 }, { x: 0, y: 4 },
    ];
    // [0.5, 3.5]² minus the notch, now [1.3, 2.7] × [2.5, 3.5].
    expect(area(insetPolygon(notched, 0.5))).toBeCloseTo(9 - 1.4 * 1, 9);
  });

  it("removes bumps narrower than the inset (collapsing edges)", () => {
    const bumped: Polygon = [
      { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 2.2, y: 4 }, { x: 2.2, y: 5 }, { x: 1.8, y: 5 }, { x: 1.8, y: 4 }, { x: 0, y: 4 },
    ];
    const r = insetPolygon(bumped, 0.5);
    expect(signedArea(r)).toBeGreaterThan(0);
    expect(area(r)).toBeCloseTo(9, 9);
    expect(r).toHaveLength(4);
  });

  it("keeps the larger piece when a neck pinches off", () => {
    // Two squares joined by a 0.4-wide bridge; insetting by 0.3 cuts the bridge.
    const dumbbell: Polygon = [
      { x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 1.3 }, { x: 4, y: 1.3 }, { x: 4, y: 0.5 }, { x: 6, y: 0.5 },
      { x: 6, y: 2.5 }, { x: 4, y: 2.5 }, { x: 4, y: 1.7 }, { x: 3, y: 1.7 }, { x: 3, y: 3 }, { x: 0, y: 3 },
    ];
    const r = insetPolygon(dumbbell, 0.3);
    expect(area(r)).toBeCloseTo(2.4 * 2.4, 9);
    expect(Math.max(...r.map((v) => v.x))).toBeCloseTo(2.7, 9);
  });

  it("returns [] when nothing is left", () => {
    expect(insetPolygon(L, 0.6)).toEqual([]);
  });
});

describe("roundedPolygon on concave corners", () => {
  it("fills concave corners and cuts convex ones", () => {
    const r = 0.2;
    // Five convex corners lose (1 - π/4)r², the one concave corner gains it.
    expect(area(roundedPolygon(L, r, Math.PI / 720))).toBeCloseTo(3 - 4 * (1 - Math.PI / 4) * r * r, 5);
  });
});

describe("clipPolygonToConvex", () => {
  // A U shape: two 1-wide arms joined along the bottom.
  const U: Polygon = [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 3 }, { x: 0, y: 3 },
  ];

  it("returns separate pieces when the clip cuts a shape apart", () => {
    // Keep only y < 1: the two arm tips, 1 × 1 each.
    const pieces = clipPolygonToConvex(U, rectPolygon(-1, -1, 5, 2));
    expect(pieces).toHaveLength(2);
    for (const p of pieces) expect(area(p)).toBeCloseTo(1, 9);
  });

  it("keeps shapes whole when they stay connected", () => {
    const pieces = clipPolygonToConvex(U, rectPolygon(-1, 0.5, 5, 10));
    expect(pieces).toHaveLength(1);
    expect(area(pieces[0]!)).toBeCloseTo(7 - 0.5 * 2, 9);
  });

  it("handles inside, outside and containing cases", () => {
    expect(clipPolygonToConvex(U, rectPolygon(-1, -1, 10, 10))).toHaveLength(1);
    expect(area(clipPolygonToConvex(U, rectPolygon(-1, -1, 10, 10))[0]!)).toBeCloseTo(7, 9);
    expect(clipPolygonToConvex(U, rectPolygon(5, 5, 1, 1))).toEqual([]);
    const inner = clipPolygonToConvex(U, rectPolygon(0.2, 2.2, 0.5, 0.5));
    expect(inner).toHaveLength(1);
    expect(area(inner[0]!)).toBeCloseTo(0.25, 9);
  });

  it("matches clipConvex area for many random cuts", () => {
    const star: Polygon = Array.from({ length: 14 }, (_, k) => {
      const r = k % 2 ? 1 : 2.5;
      return { x: r * Math.cos((k * Math.PI) / 7), y: r * Math.sin((k * Math.PI) / 7) };
    });
    for (let i = 0; i < 40; i++) {
      const box = rectPolygon(-3 + (i % 7) * 0.7, -3 + Math.floor(i / 7) * 0.9, 2.2, 1.7);
      const total = clipPolygonToConvex(star, box).reduce((s, p) => s + area(p), 0);
      expect(total).toBeCloseTo(area(clipConvex(star, box)), 9);
    }
  });
});

/** The original (pre-heap) inset, kept as a reference: recomputes every edge per event. */
function referenceInset(poly: Polygon, distance: number): Polygon {
  type Line = { p: { x: number; y: number }; u: { x: number; y: number }; n: { x: number; y: number } };
  const join = (l0: Line, l1: Line, t: number) => {
    const a = { x: l0.p.x + l0.n.x * t, y: l0.p.y + l0.n.y * t };
    const b = { x: l1.p.x + l1.n.x * t, y: l1.p.y + l1.n.y * t };
    const den = l0.u.x * l1.u.y - l0.u.y * l1.u.x;
    if (Math.abs(den) < 1e-12) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const s = ((b.x - a.x) * l1.u.y - (b.y - a.y) * l1.u.x) / den;
    return { x: a.x + l0.u.x * s, y: a.y + l0.u.y * s };
  };
  const edgeLength = (lines: Line[], k: number, t: number) => {
    const n = lines.length;
    const s = join(lines[(k - 1 + n) % n]!, lines[k]!, t);
    const e = join(lines[k]!, lines[(k + 1) % n]!, t);
    return (e.x - s.x) * lines[k]!.u.x + (e.y - s.y) * lines[k]!.u.y;
  };
  const p = signedArea(poly) < 0 ? [...poly].reverse() : poly;
  let lines: Line[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!, b = p[(i + 1) % p.length]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) continue;
    const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    lines.push({ p: a, u, n: { x: -u.y, y: u.x } });
  }
  let t = 0;
  while (lines.length >= 3) {
    let first = -1, firstT = Infinity;
    for (let k = 0; k < lines.length; k++) {
      const now = edgeLength(lines, k, t), then = edgeLength(lines, k, distance);
      if (then >= 0) continue;
      const tc = now <= 0 ? t : t + ((distance - t) * now) / (now - then);
      if (tc < firstT) { firstT = tc; first = k; }
    }
    if (first < 0) break;
    t = Math.min(distance, Math.max(t, firstT));
    lines = lines.filter((_, k) => k !== first);
  }
  if (lines.length < 3) return [];
  const outline = lines.map((l, k) => join(lines[(k - 1 + lines.length) % lines.length]!, l, distance));
  const pieces = splitSelfIntersections(outline).filter((q) => signedArea(q) > 0);
  if (pieces.length === 0) return [];
  return pieces.reduce((best, q) => (area(q) > area(best) ? q : best));
}

describe("insetPolygon matches the reference algorithm", () => {
  it("on curved, interlocking and aperiodic tiles", () => {
    const region = { x: 0, y: 0, width: 400, height: 300 };
    const shapes: Polygon[] = [];
    for (const tiling of [isohedral({ ih: 84, size: 60 }), isohedral({ ih: 1, size: 60 }), isohedral({ ih: 41, size: 60, amount: 0.3 }), jigsaw({ size: 60 }), fishScale({ size: 60 }), spectre({ size: 60 }), hat({ size: 60 })]) {
      const l = createLayout({ region, tiling, edges: "inside" });
      shapes.push(...l.cells.slice(0, 6).map((c) => c.original));
    }
    // Stars with many short edges.
    for (let n = 5; n <= 40; n += 7) {
      shapes.push(Array.from({ length: 2 * n }, (_, k) => {
        const r = k % 2 ? 10 : 25 + (k % 3);
        return { x: r * Math.cos((k * Math.PI) / n), y: r * Math.sin((k * Math.PI) / n) };
      }));
    }
    let compared = 0;
    for (const shape of shapes) {
      for (const d of [0.5, 2, 5, 9]) {
        const a = insetPolygon(shape, d);
        const b = referenceInset(shape, d);
        expect(area(a)).toBeCloseTo(area(b), 6);
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(150);
  });
});
