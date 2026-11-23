import { describe, expect, it } from "vitest";
import {
  area,
  contentSlots,
  createLayout,
  fitCount,
  grid,
  hat,
  herringbone,
  hexagonal,
  isohedral,
  rectPolygon,
  type Layout,
  type LayoutOptions,
  type TilingSpec,
  type Vec,
} from "@andamento/core";
import {
  pointInPolygon,
} from "@andamento/core/internal";

const region = { x: 0, y: 0, width: 600, height: 400 };
const total = (l: Layout) => l.cells.reduce((s, c) => s + c.area, 0);
const featured = (l: Layout) => l.cells.filter((c) => c.featured !== undefined).sort((a, b) => a.featured! - b.featured!);
const inCell = (p: Vec, c: Layout["cells"][number]) => pointInPolygon(p, c.polygon) && !(c.holes ?? []).some((h) => pointInPolygon(p, h));

/** Every sample point of the region is in exactly one cell (gap 0). */
function checkCover(l: Layout, n = 40) {
  let bad = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const p = { x: ((i + 0.3183099) / n) * region.width, y: ((j + 0.2718282) / n) * region.height };
      if (l.cells.filter((c) => inCell(p, c)).length !== 1) bad++;
    }
  }
  expect(bad).toBe(0);
}

describe("featured tiles", () => {
  it("merges a 2 × 2 block of grid tiles, centerd, with the gap all round", () => {
    const l = createLayout({ region, tiling: grid({ width: 100 }), gap: 4, features: [{ tiles: 4 }] });
    const [f] = featured(l);
    expect(f!.merged).toHaveLength(4);
    expect(f!.polygon).toHaveLength(4);
    expect(f!.area).toBeCloseTo(196 * 196);
    expect([f!.centroid.x, f!.centroid.y]).toEqual([300, 200]);
    expect(f!.id).toBe("feature0");
    expect(l.cells).toHaveLength(24 - 4 + 1);
    // The merged tiles are gone, and their ids don't linger as neighbors.
    const ids = new Set(l.cells.map((c) => c.id));
    for (const id of f!.merged!) expect(ids.has(id)).toBe(false);
    for (const c of l.cells) for (const n of c.neighbors) expect(ids.has(n)).toBe(true);
    // A 2 × 2 block in a grid touches 8 tiles edge to edge.
    expect(f!.neighbors).toHaveLength(8);
  });

  it("keeps several features apart and grows each compactly", () => {
    const l = createLayout({ region, tiling: grid({ width: 100 }), features: [{ tiles: 4 }, { tiles: 4, at: { x: 80, y: 80 } }, { tiles: 2, at: { x: 590, y: 390 } }] });
    const fs = featured(l);
    expect(fs.map((f) => f.merged!.length)).toEqual([4, 4, 2]);
    expect(fs.map((f) => f.polygon.length)).toEqual([4, 4, 4]); // all rectangles
    expect(fs[1]!.bbox).toEqual({ x: 0, y: 0, width: 200, height: 200 });
    const all = fs.flatMap((f) => f.merged!);
    expect(new Set(all).size).toBe(all.length);
    checkCover(l);
  });

  const patterns: [string, TilingSpec, number][] = [
    ["hexagonal", hexagonal({ size: 40 }), 7],
    ["herringbone", herringbone({ length: 80, width: 40 }), 4],
    ["hat", hat({ size: 50 }), 5],
    ["isohedral curved", isohedral({ ih: 28, size: 70 }), 3],
  ];
  for (const [name, tiling, n] of patterns) {
    it(`${name}: merges ${n} tiles into one outline and still covers the region`, () => {
      const base: LayoutOptions = { region, tiling, rotation: 11 };
      const plain = createLayout(base);
      const l = createLayout({ ...base, features: [{ tiles: n }, { tiles: n, at: { x: 150, y: 120 } }] });
      const fs = featured(l);
      expect(fs).toHaveLength(2);
      for (const f of fs) {
        expect(f.merged).toHaveLength(n);
        const parts = plain.cells.filter((c) => f.merged!.includes(c.id));
        expect(f.area).toBeCloseTo(parts.reduce((s, c) => s + c.area, 0), 3);
      }
      expect(total(l)).toBeCloseTo(total(plain), 1);
      checkCover(l);
    });
  }

  it("merges explicit ids", () => {
    const plain = createLayout({ region, tiling: grid({ width: 100 }) });
    const ids = plain.cells.filter((c) => c.centroid.y === 50 && c.centroid.x < 350).map((c) => c.id);
    const l = createLayout({ region, tiling: grid({ width: 100 }), features: [{ ids: [...ids, "nope"] }] });
    expect(featured(l)[0]!.bbox).toEqual({ x: 0, y: 0, width: 300, height: 100 });
  });

  it("prefers whole tiles and is cut by the region edge like any tile", () => {
    // 650 wide: the last column is cut. A feature asked for at the right edge stays whole.
    const r = { x: 0, y: 0, width: 650, height: 400 };
    const l = createLayout({ region: r, tiling: grid({ width: 100 }), features: [{ tiles: 2, at: { x: 640, y: 50 } }] });
    const [f] = featured(l);
    expect(f!.boundary).toBe(false);
    expect(f!.bbox.x + f!.bbox.width).toBeLessThanOrEqual(600);
    // Given ids that include a cut tile, the merged cell is cut too.
    const cut = createLayout({ region: r, tiling: grid({ width: 100 }), features: [{ ids: ["5,0:0", "6,0:0"] }] });
    const g = featured(cut)[0]!;
    expect(g.merged).toEqual(["5,0:0", "6,0:0"]);
    expect(g.boundary).toBe(true);
    expect(g.area).toBeCloseTo(150 * 100);
  });

  it("works with holes", () => {
    const l = createLayout({ region, holes: [rectPolygon(250, 150, 100, 100)], tiling: grid({ width: 50 }), features: [{ tiles: 9 }] });
    const [f] = featured(l);
    expect(f!.merged).toHaveLength(9);
    expect(f!.boundary).toBe(false);
    expect(pointInPolygon({ x: 300, y: 200 }, f!.polygon)).toBe(false);
    expect(total(l)).toBeCloseTo(600 * 400 - 100 * 100, 3);
  });

  it("stops growing when it runs out of room", () => {
    const l = createLayout({ region: { x: 0, y: 0, width: 200, height: 100 }, tiling: grid({ width: 100 }), features: [{ tiles: 5 }] });
    expect(featured(l)[0]!.merged).toHaveLength(2);
    expect(l.cells).toHaveLength(1);
  });

  it("gives featured cells the first content, in feature order", () => {
    const l = createLayout({ region, tiling: grid({ width: 100 }), features: [{ tiles: 4 }, { tiles: 2, at: { x: 50, y: 350 } }] });
    const slots = contentSlots(l, 3);
    const byFeature = featured(l).map((f) => slots[f.index]);
    expect(byFeature).toEqual([0, 1]);
    // The third item goes to the first plain cell in reading order.
    expect(slots[l.cells.find((c) => c.featured === undefined)!.index]).toBe(2);
    expect(slots.filter((s) => s >= 0)).toHaveLength(3);
    // Too few items: the first feature still gets the first one.
    const one = contentSlots(l, 1);
    expect(one[featured(l)[0]!.index]).toBe(0);
    expect(one.filter((s) => s >= 0)).toHaveLength(1);
  });

  it("counts a featured cell once in fitCount", () => {
    const r = fitCount({ region, tiling: grid({ width: 10 }), features: [{ tiles: 4 }] }, 10);
    expect(r.count).toBeGreaterThanOrEqual(10);
    expect(r.layout.cells).toHaveLength(r.count);
    expect(featured(r.layout)).toHaveLength(1);
  });

  it("matches the plain layout when features is empty", () => {
    const a = createLayout({ region, tiling: hexagonal({ size: 33 }), gap: 2 });
    const b = createLayout({ region, tiling: hexagonal({ size: 33 }), gap: 2, features: [] });
    expect(b.cells).toEqual(a.cells);
    expect(area(a.region)).toBe(area(b.region));
  });
});
