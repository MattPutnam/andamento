import { describe, expect, it } from "vitest";
import {
  cellAt,
  createLayout,
  delaunay,
  edgeSize,
  grid,
  hat,
  hexagonal,
  imageSize,
  mulberry32,
  pointInPolygon,
  radialSize,
  rectPolygon,
  triangular,
  vec,
  voronoi,
  type Layout,
  type TilingSpec,
} from "@andamento/core";

const region = { x: 0, y: 0, width: 400, height: 300 };
const center = vec(200, 150);
const focus = radialSize({ center: center, radius: 200, inner: 0.25, outer: 1 });
const total = (l: Layout) => l.cells.reduce((s, c) => s + c.area, 0);
const meanArea = (l: Layout, pred: (d: number) => boolean) => {
  const cs = l.cells.filter((c) => !c.boundary && pred(Math.hypot(c.centroid.x - center.x, c.centroid.y - center.y)));
  return cs.reduce((s, c) => s + c.area, 0) / cs.length;
};

/** Every sample point is in exactly one cell: no gaps, no overlaps. */
function tilesExactly(l: Layout, samples = 3000) {
  const rand = mulberry32(5);
  for (let k = 0; k < samples; k++) {
    const p = vec(rand() * 400, rand() * 300);
    const n = l.cells.filter((c) => pointInPolygon(p, c.polygon)).length;
    if (n !== 1) return false;
  }
  return true;
}

describe("sizeAt", () => {
  it("nests a grid exactly where tiles should be smaller", () => {
    // 400 x 320: 10 x 8 tiles of 40, none cut by the edge.
    const l = createLayout({ region: { x: 0, y: 0, width: 400, height: 320 }, tiling: grid({ width: 40 }), sizeAt: (p) => (p.x < 200 ? 0.5 : 1) });
    for (const c of l.cells) {
      expect(c.polygon).toHaveLength(4);
      expect(c.area).toBeCloseTo(c.centroid.x < 200 ? 400 : 1600, 6);
    }
    // Left half: 10 x 16 tiles of 20; right half: 5 x 8 of 40.
    expect(l.cells).toHaveLength(160 + 40);
    expect(total(l)).toBeCloseTo(128000, 6);
  });

  it("makes tiles bigger too", () => {
    const l = createLayout({ region, tiling: grid({ width: 40 }), sizeAt: () => 2 });
    expect(l.cells[0]!.area).toBeCloseTo(6400, 6);
  });

  it("shrinks tiles round a point in any tiling, covering the region exactly", () => {
    const tilings: TilingSpec[] = [hexagonal({ size: 20 }), triangular({ size: 40 }), hat({ size: 20 })];
    for (const tiling of tilings) {
      const plain = createLayout({ region, tiling });
      const l = createLayout({ region, tiling, sizeAt: focus });
      expect(l.cells.length).toBeGreaterThan(plain.cells.length * 1.5);
      expect(total(l)).toBeCloseTo(total(plain), 6);
      expect(meanArea(l, (d) => d < 40)).toBeLessThan(meanArea(l, (d) => d > 200) / 4);
      expect(tilesExactly(l, 1500)).toBe(true);
      // No crumbs: cut pieces at the edge of a finer area are merged into neighbors.
      const smallest = Math.min(...l.cells.filter((c) => !c.boundary).map((c) => c.area));
      expect(smallest).toBeGreaterThan(meanArea(l, (d) => d < 40) * 0.15);
    }
  });

  it("varies Voronoi and Delaunay smoothly", () => {
    for (const tiling of [voronoi({ size: 40, seed: 2 }), delaunay({ size: 40, seed: 2 })]) {
      const l = createLayout({ region, tiling, sizeAt: focus });
      expect(total(l)).toBeCloseTo(120000, 6);
      expect(meanArea(l, (d) => d < 50)).toBeLessThan(meanArea(l, (d) => d > 180) / 4);
      // Not nested: no cell ids from finer levels.
      expect(l.cells.every((c) => !c.id.includes("@"))).toBe(true);
      expect(tilesExactly(l, 1500)).toBe(true);
    }
  });

  it("is deterministic and works with hit testing", () => {
    const a = createLayout({ region, tiling: hexagonal({ size: 20 }), sizeAt: focus });
    const b = createLayout({ region, tiling: hexagonal({ size: 20 }), sizeAt: focus });
    expect(a.cells.map((c) => c.id)).toEqual(b.cells.map((c) => c.id));
    expect(new Set(a.cells.map((c) => c.id)).size).toBe(a.cells.length);
    expect(cellAt(a, center)!.area).toBeLessThan(cellAt(a, vec(5, 5))!.area);
  });

  it("rejects bad fields and too many tiles", () => {
    expect(() => createLayout({ region, tiling: grid({ width: 40 }), sizeAt: () => 0 })).toThrow(/positive/);
    expect(() => createLayout({ region, tiling: grid({ width: 40 }), sizeAt: (p) => (p.x < 10 ? 0.001 : 1), maxTiles: 500 })).toThrow(/too small/);
  });
});

describe("size fields", () => {
  it("radialSize eases from inner to outer", () => {
    expect(focus(center)).toBeCloseTo(0.25);
    expect(focus(vec(400, 150))).toBeCloseTo(1);
    expect(focus(vec(300, 150))).toBeCloseTo(0.625);
  });

  it("edgeSize is small at the edges and holes", () => {
    const f = edgeSize(rectPolygon(0, 0, 400, 300), { distance: 50, edge: 0.2, holes: [rectPolygon(180, 130, 40, 40)] });
    expect(f(vec(0, 150))).toBeCloseTo(0.2);
    expect(f(vec(100, 100))).toBeCloseTo(1);
    expect(f(vec(175, 150))).toBeLessThan(0.3);
  });

  it("imageSize maps brightness, covering the box", () => {
    // 2 x 1 picture: black left, white right, over a 400 x 300 box (cropped at the sides).
    const data = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]);
    const f = imageSize({ width: 2, height: 1, data }, region, { dark: 0.3 });
    expect(f(vec(150, 150))).toBeCloseTo(0.3);
    expect(f(vec(250, 150))).toBeCloseTo(1);
    expect(imageSize({ width: 2, height: 1, data }, region, { invert: true })(vec(250, 150))).toBeCloseTo(0.25);
  });
});
