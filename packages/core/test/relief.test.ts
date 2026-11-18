import { describe, expect, it } from "vitest";
import {
  area,
  bevelFacets,
  centroid,
  createLayout,
  grid,
  hat,
  lightVector,
  pointInPolygon,
  rectPolygon,
  roundedPolygon,
  vec,
  voronoi,
  type Cell,
  type Layout,
} from "@andamento/core";

const one = (region: Layout["region"], extra: object = {}) => createLayout({ region, tiling: grid({ width: 1000 }), ...extra });
const total = (f: { polygon: { x: number; y: number }[] }[]) => f.reduce((s, x) => s + area(x.polygon), 0);
const inCell = (c: Cell, l: Layout, x: number, y: number) =>
  pointInPolygon(vec(x, y), roundedPolygon(c.polygon, l.cornerRadius)) &&
  !(c.holes ?? []).some((h) => pointInPolygon(vec(x, y), roundedPolygon(h, l.cornerRadius)));

describe("lightVector", () => {
  it("uses CSS angles: clockwise from the top", () => {
    expect(lightVector(0).y).toBeCloseTo(-1);
    expect(lightVector(90).x).toBeCloseTo(1);
    const tl = lightVector();
    expect(tl.x).toBeCloseTo(-Math.SQRT1_2);
    expect(tl.y).toBeCloseTo(-Math.SQRT1_2);
  });
});

describe("bevelFacets", () => {
  it("shades a square's sides by the light", () => {
    const l = one({ x: 0, y: 0, width: 10, height: 10 });
    const f = bevelFacets(l.cells[0]!, l, { width: 1 });
    expect(f).toHaveLength(4);
    expect(total(f)).toBeCloseTo(100 - 64, 6);
    const side = (pred: (c: { x: number; y: number }) => boolean) => f.find((x) => pred(centroid(x.polygon)))!.shade;
    expect(side((c) => c.y < 1)).toBeCloseTo(Math.SQRT1_2); // top: lit
    expect(side((c) => c.x < 1)).toBeCloseTo(Math.SQRT1_2); // left: lit
    expect(side((c) => c.y > 9)).toBeCloseTo(-Math.SQRT1_2); // bottom: dark
    expect(side((c) => c.x > 9)).toBeCloseTo(-Math.SQRT1_2); // right: dark
    // Light from straight above: the top is fully lit, the sides edge-on.
    const above = bevelFacets(l.cells[0]!, l, { width: 1, light: 0 });
    expect(Math.max(...above.map((x) => x.shade))).toBeCloseTo(1);
    expect(above.filter((x) => Math.abs(x.shade) < 1e-9)).toHaveLength(2);
    expect(bevelFacets(l.cells[0]!, l, { width: 0 })).toEqual([]);
  });

  it("copes with repeated points in an outline", () => {
    const l = one({ x: 0, y: 0, width: 10, height: 10 });
    const c = l.cells[0]!;
    const p = c.polygon;
    const doubled = { ...c, polygon: [p[0]!, p[0]!, p[1]!, p[2]!, p[2]!, p[3]!] };
    expect(total(bevelFacets(doubled, l, { width: 1 }))).toBeCloseTo(36, 6);
  });

  it("narrows the band on thin cells", () => {
    const l = one({ x: 0, y: 0, width: 10, height: 1 });
    const f = bevelFacets(l.cells[0]!, l, { width: 2 });
    // At most half the thickness: the band covers the whole strip, no more.
    expect(total(f)).toBeLessThanOrEqual(10 + 1e-6);
    expect(total(f)).toBeGreaterThan(9.9);
  });

  it("follows rounded corners, down to a sharp inner corner", () => {
    const k = 4 - Math.PI; // area a rounded corner removes, per unit radius squared
    const narrow = one({ x: 0, y: 0, width: 10, height: 10 }, { cornerRadius: 3 });
    expect(total(bevelFacets(narrow.cells[0]!, narrow, { width: 1 }))).toBeCloseTo(100 - 9 * k - (64 - 4 * k), 0);
    const wide = one({ x: 0, y: 0, width: 10, height: 10 }, { cornerRadius: 1 });
    expect(total(bevelFacets(wide.cells[0]!, wide, { width: 2 }))).toBeCloseTo(100 - k - 36, 1);
  });

  it("bevels holes, sloping down into them", () => {
    const l = one({ x: 0, y: 0, width: 100, height: 100 }, { holes: [rectPolygon(40, 40, 20, 20)] });
    const f = bevelFacets(l.cells[0]!, l, { width: 2 });
    expect(total(f)).toBeCloseTo(9600 - (9216 - 576), 4);
    // The face along the hole's top edge slopes down towards the hole: away from the light.
    const holeTop = f.find((x) => {
      const c = centroid(x.polygon);
      return c.y > 38 && c.y < 40 && c.x > 45 && c.x < 55;
    })!;
    expect(holeTop.shade).toBeCloseTo(-Math.SQRT1_2);
  });

  it("stays inside real tile shapes without overlapping", () => {
    const region = { x: 0, y: 0, width: 300, height: 200 };
    const layouts = [
      createLayout({ region, tiling: voronoi({ size: 40, seed: 2 }), gap: 2, cornerRadius: 3 }),
      createLayout({ region, tiling: hat({ size: 30 }), gap: 1, cornerRadius: 2 }),
      one([vec(0, 0), vec(60, 0), vec(60, 20), vec(20, 20), vec(20, 60), vec(0, 60)], { cornerRadius: 4 }),
    ];
    for (const l of layouts) {
      for (const c of l.cells.slice(0, 40)) {
        const f = bevelFacets(c, l, { width: 4 });
        const shapeArea = area(roundedPolygon(c.polygon, l.cornerRadius)) - (c.holes ?? []).reduce((s, h) => s + area(roundedPolygon(h, l.cornerRadius)), 0);
        expect(total(f)).toBeLessThanOrEqual(shapeArea * (1 + 1e-6));
        for (const x of f) {
          if (area(x.polygon) < 1e-6) continue;
          const m = centroid(x.polygon);
          expect(inCell(c, l, m.x, m.y), `${c.id}`).toBe(true);
        }
      }
    }
  });
});

describe("clipped outlines", () => {
  it("have no zero-width spikes where a tile edge runs along the region edge", () => {
    const l = createLayout({ region: { x: 0, y: 0, width: 240, height: 150 }, tiling: hat({ size: 30 }), gap: 2, margin: 4, cornerRadius: 3, origin: { x: 120, y: 75 } });
    for (const c of l.cells) {
      const p = c.polygon;
      for (let i = 0; i < p.length; i++) {
        const a = p[(i - 1 + p.length) % p.length]!, v = p[i]!, b = p[(i + 1) % p.length]!;
        const cross = (v.x - a.x) * (b.y - v.y) - (v.y - a.y) * (b.x - v.x);
        const back = (v.x - a.x) * (b.x - v.x) + (v.y - a.y) * (b.y - v.y) < 0;
        expect(Math.abs(cross) < 1e-9 && back, `${c.id} doubles back at ${i}`).toBe(false);
      }
      expect(bevelFacets(c, l, { width: 0.5 }).length, c.id).toBeGreaterThan(0);
    }
  });
});
