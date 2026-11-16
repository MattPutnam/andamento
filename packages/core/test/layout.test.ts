import { describe, expect, it } from "vitest";
import {
  area,
  basketweave,
  clipConvex,
  containsPolygon,
  createLayout,
  grid,
  herringbone,
  hexagonal,
  insetConvex,
  mondrian,
  rectPolygon,
  rectsOverlap,
  runningBond,
  type Layout,
  type TilingSpec,
} from "@andamento/core";

const wall = { x: 0, y: 0, width: 1000, height: 700 };
const wallArea = wall.width * wall.height;

function totalArea(l: Layout) {
  return l.cells.reduce((s, c) => s + c.area, 0);
}

function maxPairOverlap(l: Layout) {
  let worst = 0;
  const cs = l.cells;
  for (let i = 0; i < cs.length; i++) {
    for (let j = i + 1; j < cs.length; j++) {
      if (!rectsOverlap(cs[i]!.bbox, cs[j]!.bbox)) continue;
      const inter = clipConvex(cs[i]!.polygon, cs[j]!.polygon);
      if (inter.length) worst = Math.max(worst, area(inter));
    }
  }
  return worst;
}

const specs: [string, TilingSpec][] = [
  ["grid", grid({ width: 90, height: 60 })],
  ["runningBond", runningBond({ width: 120, height: 50 })],
  ["runningBond 1/3", runningBond({ width: 120, height: 50, offset: 1 / 3 })],
  ["herringbone 2:1", herringbone({ length: 120, width: 60 })],
  ["herringbone 3:1", herringbone({ length: 150, width: 50 })],
  ["basketweave", basketweave({ length: 100 })],
  ["basketweave x3", basketweave({ length: 120, strips: 3 })],
  ["hex pointy", hexagonal({ size: 60 })],
  ["hex flat", hexagonal({ size: 60, orientation: "flat" })],
  ["mondrian", mondrian({ minSize: 80, maxSize: 300, seed: 42 })],
];

describe.each(specs)("%s", (_name, tiling) => {
  for (const rotation of [0, 30, 45]) {
    it(`exactly covers the wall without overlaps (rotation ${rotation})`, () => {
      const l = createLayout({ region: wall, tiling, rotation });
      expect(l.cells.length).toBeGreaterThan(4);
      // Relative check: degenerate corner slivers (< 1e-7 of the wall's scale²) are dropped on purpose.
      expect(Math.abs(totalArea(l) - wallArea) / wallArea).toBeLessThan(1e-6);
      expect(maxPairOverlap(l)).toBeLessThan(1e-6);
    });
  }

  it("has unique ids and sequential indices", () => {
    const l = createLayout({ region: wall, tiling, gap: 8 });
    expect(new Set(l.cells.map((c) => c.id)).size).toBe(l.cells.length);
    expect(l.cells.map((c) => c.index)).toEqual(l.cells.map((_, i) => i));
  });

  it("separates neighbours by the gap", () => {
    const gap = 10;
    const l = createLayout({ region: wall, tiling, gap });
    // Growing every cell by slightly less than half the gap must not create overlaps.
    const grown = l.cells.map((c) => grow(c.polygon, gap / 2 - 0.01));
    for (let i = 0; i < grown.length; i++) {
      for (let j = i + 1; j < grown.length; j++) {
        const inter = clipConvex(grown[i]!, grown[j]!);
        expect(inter.length ? area(inter) : 0).toBeLessThan(1e-6);
      }
    }
  });

  it('"inside" keeps only whole tiles within the wall', () => {
    const l = createLayout({ region: wall, tiling, edges: "inside", gap: 6 });
    const outline = rectPolygon(0, 0, wall.width, wall.height);
    for (const c of l.cells) expect(containsPolygon(outline, c.polygon, 1e-6)).toBe(true);
    expect(l.cells.every((c) => !c.boundary)).toBe(true);
  });
});

/** Inverse of insetConvex for convex polygons (expand each edge outward). */
function grow(p: { x: number; y: number }[], d: number) {
  // Expanding = insetting the polygon by -d; emulate with a large clip box + half-planes.
  const n = p.length;
  const lines = p.map((a, i) => {
    const b = p[(i + 1) % n]!;
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    const nx = dy / len, ny = -dx / len; // outward
    return { a: { x: a.x + nx * d, y: a.y + ny * d }, dir: { x: dx, y: dy } };
  });
  return lines.map((l1, i) => {
    const l0 = lines[(i + n - 1) % n]!;
    const den = l0.dir.x * l1.dir.y - l0.dir.y * l1.dir.x;
    if (Math.abs(den) < 1e-12) return l1.a;
    const t = ((l1.a.x - l0.a.x) * l1.dir.y - (l1.a.y - l0.a.y) * l1.dir.x) / den;
    return { x: l0.a.x + l0.dir.x * t, y: l0.a.y + l0.dir.y * t };
  });
}

describe("layout options", () => {
  it("neighbours: centre of a 3x3 grid has 4", () => {
    const l = createLayout({ region: { x: 0, y: 0, width: 300, height: 300 }, tiling: grid({ width: 100 }), gap: 10 });
    expect(l.cells).toHaveLength(9);
    expect(l.cells[4]!.neighbors).toHaveLength(4);
    expect(l.cells[0]!.neighbors).toHaveLength(2);
  });

  it("reading order is top-to-bottom, left-to-right", () => {
    const l = createLayout({ region: { x: 0, y: 0, width: 300, height: 200 }, tiling: grid({ width: 100 }) });
    expect(l.cells.map((c) => [c.centroid.x, c.centroid.y])).toEqual([
      [50, 50], [150, 50], [250, 50], [50, 150], [150, 150], [250, 150],
    ]);
  });

  it("margin shrinks the usable area", () => {
    const l = createLayout({ region: wall, tiling: grid({ width: 50 }), margin: 20 });
    expect(totalArea(l)).toBeCloseTo((wall.width - 40) * (wall.height - 40), 3);
  });

  it("minFill drops slivers", () => {
    // 1000 wide / 300 → three full columns plus a 1/3-width sliver.
    const base = { region: wall, tiling: grid({ width: 300 }) };
    const all = createLayout(base);
    const filtered = createLayout({ ...base, minFill: 0.5 });
    expect(filtered.cells.length).toBeLessThan(all.cells.length);
    expect(filtered.cells.every((c) => c.area >= 0.5 * 300 * 300 - 1e-6)).toBe(true);
  });

  it("overflow keeps edge tiles uncut", () => {
    const l = createLayout({ region: wall, tiling: hexagonal({ size: 80 }), edges: "overflow" });
    const full = area(l.cells.find((c) => !c.boundary)!.polygon);
    for (const c of l.cells) expect(c.area).toBeCloseTo(full, 6);
    expect(l.cells.some((c) => c.boundary)).toBe(true);
  });

  it("mondrian is deterministic and respects minSize", () => {
    const opts = { region: wall, tiling: mondrian({ minSize: 80, maxSize: 260, seed: 7 }) };
    const a = createLayout(opts);
    const b = createLayout(opts);
    expect(a.cells.map((c) => c.id)).toEqual(b.cells.map((c) => c.id));
    for (const c of a.cells) {
      expect(c.bbox.width).toBeGreaterThanOrEqual(80 - 1e-9);
      expect(c.bbox.height).toBeGreaterThanOrEqual(80 - 1e-9);
    }
    const other = createLayout({ ...opts, tiling: mondrian({ minSize: 80, maxSize: 260, seed: 8 }) });
    expect(other.cells.map((c) => c.id)).not.toEqual(a.cells.map((c) => c.id));
  });

  it("accepts a convex polygon wall and rejects a concave one", () => {
    const tri = [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 300, y: 500 }];
    const l = createLayout({ region: tri, tiling: grid({ width: 40 }) });
    expect(totalArea(l)).toBeCloseTo(area(tri), 3);
    const concave = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 20 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
    expect(() => createLayout({ region: concave, tiling: grid({ width: 10 }) })).toThrow(RangeError);
  });

  it("guards against runaway tile counts and bad params", () => {
    expect(() => createLayout({ region: wall, tiling: grid({ width: 0.5 }) })).toThrow(/too small/);
    expect(() => createLayout({ region: wall, tiling: grid({ width: -1 }) })).toThrow(RangeError);
    expect(() => createLayout({ region: wall, tiling: herringbone({ length: 50, width: 50 }) })).toThrow(RangeError);
  });

  it("insetConvex collapses to empty when over-inset", () => {
    expect(insetConvex(rectPolygon(0, 0, 10, 10), 6)).toEqual([]);
    expect(area(insetConvex(rectPolygon(0, 0, 10, 10), 2))).toBeCloseTo(36);
  });
});

describe("cellCss", () => {
  it("places cells as percentages of the bounds", async () => {
    const { cellCss, boundsAspectRatio } = await import("@andamento/core");
    const l = createLayout({ region: { x: 100, y: 50, width: 400, height: 200 }, tiling: grid({ width: 100 }) });
    const c = l.cells.find((c) => c.index === 5)!; // second row, second column
    expect(cellCss(c, l)).toEqual({
      left: "25%",
      top: "50%",
      width: "25%",
      height: "50%",
      clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
    });
    expect(boundsAspectRatio(l)).toBe("400 / 200");
  });
});

describe("corner rounding", () => {
  it("rounds a square with arcs of the requested radius", async () => {
    const { roundCorners, roundedPolygon } = await import("@andamento/core");
    const sq = rectPolygon(0, 0, 10, 10);
    const corners = roundCorners(sq, 2);
    expect(corners.map((c) => c.radius)).toEqual([2, 2, 2, 2]);
    expect(corners[0]!.center.x).toBeCloseTo(2);
    expect(corners[0]!.center.y).toBeCloseTo(2);
    corners.forEach((c) => expect(Math.abs(c.sweep)).toBeCloseTo(Math.PI / 2));
    // Area of a rounded square: 100 - (4 - pi) * r^2, approximated by the flattened arcs.
    expect(area(roundedPolygon(sq, 2, Math.PI / 180))).toBeCloseTo(100 - (4 - Math.PI) * 4, 2);
    expect(roundedPolygon(sq, 0)).toBe(sq);
  });

  it("shrinks the radius to fit short edges", async () => {
    const { roundCorners } = await import("@andamento/core");
    const corners = roundCorners(rectPolygon(0, 0, 10, 4), 5);
    corners.forEach((c) => expect(c.radius).toBeCloseTo(2)); // half the short side
  });

  it("rounds hexagon corners and stays inside the tile", async () => {
    const { roundedPolygon } = await import("@andamento/core");
    const l = createLayout({ region: { x: 0, y: 0, width: 200, height: 200 }, tiling: hexagonal({ size: 30 }), edges: "inside", cornerRadius: 6 });
    expect(l.cornerRadius).toBe(6);
    const hex = l.cells[0]!.polygon;
    const r = roundedPolygon(hex, 6);
    expect(r.length).toBeGreaterThan(hex.length * 2);
    expect(containsPolygon(hex, r, 1e-6)).toBe(true);
    expect(area(r)).toBeLessThan(area(hex));
  });

  it("puts rounded corners in the CSS clip path", async () => {
    const { cellCss } = await import("@andamento/core");
    const l = createLayout({ region: { x: 0, y: 0, width: 200, height: 100 }, tiling: grid({ width: 100 }), cornerRadius: 10 });
    const clip = cellCss(l.cells[0]!, l).clipPath;
    expect(clip.split(",").length).toBeGreaterThan(20);
    expect(clip).not.toMatch(/[(,] ?0% 0%/); // the sharp corner is cut off
    expect(clip).toMatch(/^polygon\(0% 10%, /);
  });
});
