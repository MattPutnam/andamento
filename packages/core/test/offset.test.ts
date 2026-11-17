import { describe, expect, it } from "vitest";
import { area, insetConvex, insetPolygon, rectPolygon, roundedPolygon, signedArea, type Polygon } from "@andamento/core";

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
