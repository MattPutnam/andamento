import { describe, expect, it } from "vitest";
import {
  area,
  cellCss,
  createLayout,
  fishScale,
  grid,
  hat,
  herringbone,
  hexagonal,
  isohedral,
  pointInPolygon,
  rectPolygon,
  voronoi,
  type Layout,
  type LayoutOptions,
  type Polygon,
  type TilingSpec,
  type Vec,
} from "@andamento/core";
import { cellPath } from "@andamento/svg";

const inCell = (p: Vec, c: Layout["cells"][number]) => pointInPolygon(p, c.polygon) && !(c.holes ?? []).some((h) => pointInPolygon(p, h));

/**
 * Sample points over the bounds (off any grid) and check each is covered by exactly one
 * cell where `wanted(p)` holds, and by none elsewhere.
 */
function checkCover(l: Layout, wanted: (p: Vec) => boolean, n = 50) {
  const b = l.bounds;
  let bad = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const p = { x: b.x + ((i + 0.3183099) / n) * b.width, y: b.y + ((j + 0.2718282) / n) * b.height };
      const hits = l.cells.filter((c) => inCell(p, c)).length;
      if (hits !== (wanted(p) ? 1 : 0)) bad++;
    }
  }
  expect(bad).toBe(0);
}
const totalArea = (l: Layout) => l.cells.reduce((s, c) => s + c.area, 0);

// An L-shaped wall.
const L: Polygon = [
  { x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 250 }, { x: 250, y: 250 }, { x: 250, y: 500 }, { x: 0, y: 500 },
];
const inL = (p: Vec) => pointInPolygon(p, L);

const patterns: [string, TilingSpec][] = [
  ["grid", grid({ width: 70 })],
  ["hexagonal", hexagonal({ size: 40 })],
  ["herringbone", herringbone({ length: 90, width: 45 })],
  ["fishScale", fishScale({ size: 60 })],
  ["voronoi", voronoi({ size: 50, seed: 4 })],
  ["hat", hat({ size: 50 })],
  ["isohedral curved", isohedral({ ih: 28, size: 70 })],
];

describe("non-convex regions", () => {
  for (const [name, tiling] of patterns) {
    it(`${name}: covers an L-shaped wall exactly`, () => {
      const l = createLayout({ region: L, tiling, rotation: 17 });
      expect(totalArea(l)).toBeCloseTo(area(L), 0);
      checkCover(l, inL);
      expect(l.cells.some((c) => c.boundary)).toBe(true);
    });
  }

  it("matches the convex fast path on a convex region", () => {
    const opts: LayoutOptions = { region: { x: 0, y: 0, width: 400, height: 300 }, tiling: hexagonal({ size: 37 }), gap: 3 };
    const fast = createLayout(opts);
    // A far-away hole forces the general path without changing anything.
    const general = createLayout({ ...opts, holes: [rectPolygon(1000, 1000, 1, 1)] });
    expect(general.cells.map((c) => c.id)).toEqual(fast.cells.map((c) => c.id));
    general.cells.forEach((c, i) => expect(c.area).toBeCloseTo(fast.cells[i]!.area, 6));
  });

  it("splits a region whose neck is narrower than twice the margin", () => {
    // Two 200 × 200 rooms joined by a 20-high corridor; margin 15 closes the corridor.
    const dumbbell: Polygon = [
      { x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 90 }, { x: 300, y: 90 }, { x: 300, y: 0 }, { x: 500, y: 0 },
      { x: 500, y: 200 }, { x: 300, y: 200 }, { x: 300, y: 110 }, { x: 200, y: 110 }, { x: 200, y: 200 }, { x: 0, y: 200 },
    ];
    const l = createLayout({ region: dumbbell, tiling: grid({ width: 10 }), margin: 15 });
    expect(totalArea(l)).toBeCloseTo(2 * 170 * 170, 3);
    expect(l.cells.some((c) => c.centroid.x < 200) && l.cells.some((c) => c.centroid.x > 300)).toBe(true);
    expect(l.cells.every((c) => c.centroid.x < 185 || c.centroid.x > 315)).toBe(true);
  });

  it("rejects a self-crossing region or hole", () => {
    const bowtie: Polygon = [{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 0 }, { x: 0, y: 100 }];
    expect(() => createLayout({ region: L, tiling: grid({ width: 50 }), holes: [bowtie] })).toThrow(/cross themselves/);
  });
});

describe("holes", () => {
  const wall = { x: 0, y: 0, width: 1000, height: 700 };
  const windowHole = { x: 500, y: 200, width: 200, height: 200 };
  const door = { x: 100, y: 450, width: 150, height: 250 }; // touches the bottom edge
  const inRect = (p: Vec, r: typeof wall) => p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height;

  for (const [name, tiling] of patterns) {
    it(`${name}: leaves a window and a door empty`, () => {
      const l = createLayout({ region: wall, holes: [windowHole, door], tiling });
      expect(totalArea(l)).toBeCloseTo(1000 * 700 - 200 * 200 - 150 * 250, 0);
      checkCover(l, (p) => !inRect(p, windowHole) && !inRect(p, door));
      expect(l.holes).toHaveLength(2);
    });
  }

  it("keeps the margin around holes too", () => {
    const l = createLayout({ region: wall, holes: [windowHole, door], tiling: grid({ width: 25 }), margin: 10 });
    expect(totalArea(l)).toBeCloseTo(980 * 680 - 220 * 220 - 170 * 250, 3);
  });

  it("handles overlapping holes and holes poking out of the region", () => {
    const holes = [rectPolygon(100, 100, 200, 200), rectPolygon(200, 200, 200, 200), rectPolygon(900, -50, 200, 200)];
    const l = createLayout({ region: wall, holes, tiling: hexagonal({ size: 30 }) });
    expect(totalArea(l)).toBeCloseTo(1000 * 700 - (200 * 200 * 2 - 100 * 100) - 100 * 150, 0);
    checkCover(l, (p) => !holes.some((h) => pointInPolygon(p, h)));
  });

  it("gives a cell a hole when a region hole sits inside one tile", () => {
    const l = createLayout({ region: { x: 0, y: 0, width: 300, height: 300 }, holes: [rectPolygon(130, 130, 40, 40)], tiling: grid({ width: 100 }) });
    const mid = l.cells.find((c) => c.id === l.cells[4]!.id)!;
    expect(mid.holes).toHaveLength(1);
    expect(mid.area).toBeCloseTo(100 * 100 - 40 * 40);
    expect(mid.centroid.x).toBeCloseTo(150);
    expect(l.cells.filter((c) => c.holes)).toHaveLength(1);
    expect(mid.boundary).toBe(true);
    // Renderers draw the hole: CSS with an even-odd polygon, SVG with a second subpath.
    expect(cellCss(mid, l).clipPath).toMatch(/^polygon\(evenodd, /);
    expect(cellPath(l, mid).match(/M/g)).toHaveLength(2);
    expect(cellCss(l.cells[0]!, l).clipPath).not.toContain("evenodd");
  });

  it("splits a tile a hole cuts in two", () => {
    // A thin vertical hole through the middle of the single 300-wide tile.
    const l = createLayout({ region: { x: 0, y: 0, width: 300, height: 300 }, holes: [rectPolygon(140, -10, 20, 320)], tiling: grid({ width: 300 }) });
    expect(l.cells).toHaveLength(2);
    expect(l.cells[1]!.id).toBe(`${l.cells[0]!.id}~1`);
    expect(totalArea(l)).toBeCloseTo(280 * 300);
  });

  it("edges: inside keeps only tiles clear of the holes", () => {
    const l = createLayout({ region: wall, holes: [windowHole, door], tiling: grid({ width: 50 }), edges: "inside" });
    expect(l.cells.every((c) => !c.boundary && c.area === 2500)).toBe(true);
    expect(l.cells).toHaveLength(14 * 20 - 16 - 3 * 5);
    checkCover(l, (p) => !inRect(p, windowHole) && !inRect(p, door));
  });

  it("edges: overflow keeps partly covered tiles whole and drops those inside a hole", () => {
    const l = createLayout({ region: wall, holes: [rectPolygon(510, 210, 180, 180)], tiling: grid({ width: 100 }), edges: "overflow" });
    expect(l.cells.every((c) => c.area === 10000)).toBe(true);
    // The 2 × 2 block of tiles over 500–700 × 200–400 is partly visible (the hole is inset 10).
    expect(l.cells).toHaveLength(70);
    const none = createLayout({ region: wall, holes: [rectPolygon(500, 200, 200, 200)], tiling: grid({ width: 100 }), edges: "overflow" });
    expect(none.cells).toHaveLength(66);
  });

  it("works with gap, rounding and neighbors", () => {
    const l = createLayout({ region: L, holes: [rectPolygon(80, 80, 100, 60)], tiling: herringbone({ length: 80, width: 40 }), gap: 4, cornerRadius: 3 });
    expect(l.cells.every((c) => c.neighbors.every((id) => l.cells.some((d) => d.id === id)))).toBe(true);
    expect(l.cells.some((c) => c.neighbors.length > 0)).toBe(true);
    for (const c of l.cells) expect(cellPath(l, c)).toMatch(/^M/);
  });

  it("stays fast with many tiles and holes", () => {
    const holes = Array.from({ length: 8 }, (_, i) => rectPolygon(60 + i * 115, 100 + (i % 3) * 170, 70, 120));
    const t = performance.now();
    const l = createLayout({ region: L.map((p) => ({ x: p.x * 2, y: p.y * 2 })), holes, tiling: hexagonal({ size: 8 }), gap: 1 });
    expect(l.cells.length).toBeGreaterThan(3000);
    expect(performance.now() - t).toBeLessThan(3000);
  });
});
