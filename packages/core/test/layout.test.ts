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
  triangular,
  rhombille,
  octagonSquare,
  trihexagonal,
  rhombitrihexagonal,
  cairo,
  hopscotch,
  pinwheel,
  flemishBond,
  chevron,
  voronoi,
  delaunay,
  ashlar,
  penrose,
  hat,
  HAT,
  spectre,
  SPECTRE,
  periodic,
  periodicDefinition,
  tiles,
  checkPeriodic,
  fishScale,
  jigsaw,
  pointInPolygon,
  isConvex,
  bbox,
  type Layout,
  type TilingSpec,
} from "@andamento/core";

const wall = { x: 0, y: 0, width: 1000, height: 700 };
const wallArea = wall.width * wall.height;

function totalArea(l: Layout) {
  return l.cells.reduce((s, c) => s + c.area, 0);
}

/** Overlap estimate for non-convex polygons: sample a grid over the shared bounding box. */
function sampledOverlap(p: { x: number; y: number }[], q: { x: number; y: number }[]) {
  const bp = bbox(p), bq = bbox(q);
  const x0 = Math.max(bp.x, bq.x), x1 = Math.min(bp.x + bp.width, bq.x + bq.width);
  const y0 = Math.max(bp.y, bq.y), y1 = Math.min(bp.y + bp.height, bq.y + bq.height);
  if (x1 <= x0 || y1 <= y0) return 0;
  const n = 40;
  let hits = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      // Irrational offsets keep samples off grid-aligned edges.
      const pt = { x: x0 + ((i + 0.5 + 0.1234567) / n) * (x1 - x0), y: y0 + ((j + 0.5 + 0.0987654) / n) * (y1 - y0) };
      if (pointInPolygon(pt, p) && pointInPolygon(pt, q)) hits++;
    }
  }
  return (hits / (n * n)) * (x1 - x0) * (y1 - y0);
}

function maxPairOverlap(l: Layout) {
  let worst = 0;
  const cs = l.cells;
  for (let i = 0; i < cs.length; i++) {
    for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i]!, b = cs[j]!;
      if (!rectsOverlap(a.bbox, b.bbox)) continue;
      if (isConvex(a.polygon) && isConvex(b.polygon)) {
        const inter = clipConvex(a.polygon, b.polygon);
        if (inter.length) worst = Math.max(worst, area(inter));
      } else {
        worst = Math.max(worst, sampledOverlap(a.polygon, b.polygon));
      }
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
  ["triangular", triangular({ size: 80 })],
  ["rhombille", rhombille({ size: 60 })],
  ["octagonSquare", octagonSquare({ size: 40 })],
  ["trihexagonal", trihexagonal({ size: 50 })],
  ["rhombitrihexagonal", rhombitrihexagonal({ size: 40 })],
  ["cairo", cairo({ size: 90 })],
  ["hopscotch", hopscotch({ large: 120, small: 50 })],
  ["pinwheel", pinwheel({ length: 120, width: 50 })],
  ["flemishBond", flemishBond({ length: 120, height: 50 })],
  ["chevron", chevron({ length: 140, width: 40 })],
  ["chevron 30°", chevron({ length: 140, width: 40, angle: 30 })],
  ["voronoi", voronoi({ size: 90, seed: 7 })],
  ["voronoi unrelaxed", voronoi({ size: 70, relax: 0 })],
  ["delaunay", delaunay({ size: 110, seed: 3 })],
  ["delaunay unrelaxed", delaunay({ size: 90, relax: 0 })],
  ["ashlar", ashlar({ height: 60, minLength: 50, maxLength: 160, seed: 5 })],
  ["penrose", penrose({ size: 60 })],
  ["fishScale", fishScale({ size: 120 })],
  ["jigsaw", jigsaw({ size: 110, seed: 2 })],
  ["penrose small", penrose({ size: 25 })],
  ["penrose kites", penrose({ size: 70, variant: "kitesAndDarts" })],
  ["hat", hat({ size: 90 })],
  ["spectre", spectre({ size: 90 })],
  ["periodic (L-trominoes)", periodic({ a: { x: 150, y: 0 }, b: { x: 50, y: 100 }, motif: [
    { polygon: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 50, y: 50 }, { x: 50, y: 100 }, { x: 0, y: 100 }] },
    { polygon: [{ x: 100, y: 0 }, { x: 150, y: 0 }, { x: 150, y: 100 }, { x: 50, y: 100 }, { x: 50, y: 50 }, { x: 100, y: 50 }] },
  ] })],
  ["ashlar varied", ashlar({ height: 60, minLength: 40, maxLength: 120, heightVariation: 0.5 })],
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
    // Every pair of cells whose boxes come within the gap must be at least `gap` apart.
    const cs = l.cells;
    let closest = Infinity;
    for (let i = 0; i < cs.length; i++) {
      for (let j = i + 1; j < cs.length; j++) {
        if (!rectsOverlap(cs[i]!.bbox, cs[j]!.bbox, gap)) continue;
        // Parts of one tile split by the region edge are separated by the outside, not a gap.
        if (cs[i]!.id.split("~")[0] === cs[j]!.id.split("~")[0]) continue;
        closest = Math.min(closest, polygonDistance(cs[i]!.polygon, cs[j]!.polygon));
      }
    }
    expect(closest).toBeGreaterThan(gap - 1e-6);
  });

  it('"inside" keeps only whole tiles within the wall', () => {
    const l = createLayout({ region: wall, tiling, edges: "inside", gap: 6 });
    const outline = rectPolygon(0, 0, wall.width, wall.height);
    for (const c of l.cells) expect(containsPolygon(outline, c.polygon, 1e-6)).toBe(true);
    expect(l.cells.every((c) => !c.boundary)).toBe(true);
  });
});

type P = { x: number; y: number };
function pointSegment(p: P, a: P, b: P) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
/** Minimum distance between two disjoint convex polygons. */
function polygonDistance(p: P[], q: P[]) {
  let d = Infinity;
  for (const [s, t] of [[p, q], [q, p]] as const) {
    for (const v of s) for (let i = 0; i < t.length; i++) d = Math.min(d, pointSegment(v, t[i]!, t[(i + 1) % t.length]!));
  }
  return d;
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

describe("new tiling shapes", () => {
  const region = { x: 0, y: 0, width: 1000, height: 700 };
  const shapesOf = (tiling: TilingSpec) => {
    const l = createLayout({ region, tiling, edges: "inside" });
    const out = new Map<number, number>();
    for (const c of l.cells) out.set(c.protoTile, c.polygon.length);
    return out;
  };
  const sides = (p: { x: number; y: number }[]) =>
    p.map((v, i) => Math.hypot(p[(i + 1) % p.length]!.x - v.x, p[(i + 1) % p.length]!.y - v.y));

  it("uses the expected polygons per prototile", () => {
    expect([...shapesOf(triangular({ size: 80 }))]).toEqual(expect.arrayContaining([[0, 3], [1, 3]]));
    expect(shapesOf(octagonSquare({ size: 40 })).get(0)).toBe(8);
    expect(shapesOf(octagonSquare({ size: 40 })).get(1)).toBe(4);
    const rth = shapesOf(rhombitrihexagonal({ size: 40 }));
    expect([rth.get(0), rth.get(1), rth.get(2)]).toEqual([6, 4, 3]);
    expect(shapesOf(cairo({ size: 90 })).get(0)).toBe(5);
  });

  it("gives every regular-polygon tiling equal edge lengths", () => {
    for (const tiling of [triangular({ size: 50 }), rhombille({ size: 50 }), octagonSquare({ size: 50 }), trihexagonal({ size: 50 }), rhombitrihexagonal({ size: 50 })]) {
      const l = createLayout({ region, tiling, edges: "inside" });
      for (const c of l.cells) for (const e of sides(c.polygon)) expect(e).toBeCloseTo(50, 6);
    }
  });

  it("makes Cairo pentagons equilateral", () => {
    const l = createLayout({ region, tiling: cairo({ size: 90 }), edges: "inside" });
    const e = sides(l.cells[0]!.polygon);
    for (const x of e) expect(x).toBeCloseTo(e[0]!, 6);
  });

  it("validates parameters", () => {
    expect(() => createLayout({ region, tiling: hopscotch({ large: 10, small: 20 }) })).toThrow(RangeError);
    expect(() => createLayout({ region, tiling: pinwheel({ length: 10, width: 20 }) })).toThrow(RangeError);
    expect(() => createLayout({ region, tiling: chevron({ length: 100, width: 20, angle: 90 }) })).toThrow(RangeError);
  });
});

describe("random patterns", () => {
  const region = { x: 0, y: 0, width: 1000, height: 700 };

  it("are deterministic per seed and change with it", () => {
    for (const make of [(seed: number) => voronoi({ size: 80, seed }), (seed: number) => delaunay({ size: 80, seed }), (seed: number) => ashlar({ height: 50, minLength: 40, maxLength: 140, seed })]) {
      const a = createLayout({ region, tiling: make(1) });
      const b = createLayout({ region, tiling: make(1) });
      const c = createLayout({ region, tiling: make(2) });
      expect(b.cells).toEqual(a.cells);
      expect(c.cells.map((x) => x.polygon)).not.toEqual(a.cells.map((x) => x.polygon));
    }
  });

  it("makes about one Voronoi cell per size² and links neighbours", () => {
    const l = createLayout({ region, tiling: voronoi({ size: 100 }) });
    expect(l.cells.length).toBe(70);
    const avg = l.cells.reduce((s, c) => s + c.neighbors.length, 0) / l.cells.length;
    expect(avg).toBeGreaterThan(4.5); // interior Voronoi cells average six neighbours
  });

  it("relaxation evens out Voronoi cell sizes", () => {
    const spread = (relax: number) => {
      const a = createLayout({ region, tiling: voronoi({ size: 80, relax, seed: 4 }) }).cells.map((c) => c.area);
      const mean = a.reduce((s, x) => s + x, 0) / a.length;
      return Math.sqrt(a.reduce((s, x) => s + (x - mean) ** 2, 0) / a.length) / mean;
    };
    expect(spread(4)).toBeLessThan(spread(0) * 0.7);
  });

  it("keeps ashlar stones within their length limits and joints staggered", () => {
    const l = createLayout({ region, tiling: ashlar({ height: 50, minLength: 40, maxLength: 140, seed: 9 }) });
    for (const c of l.cells) {
      expect(c.bbox.width).toBeGreaterThan(20 - 1e-9); // only the two-stone row ends may go below minLength, never below half
      expect(c.bbox.width).toBeLessThan(140 + 1e-9);
    }
  });

  it("never leaves a sliver course", () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const heightVariation of [0, 0.3, 0.8]) {
        const l = createLayout({ region: { x: 0, y: 0, width: 232, height: 142 }, tiling: ashlar({ height: 22, minLength: 20, maxLength: 70, heightVariation, seed }) });
        const heights = new Set(l.cells.map((c) => c.bbox.height));
        // Worst case is the remainder split over two courses: half of a short course.
        for (const h of heights) expect(h).toBeGreaterThan((22 * (1 - heightVariation)) / 2 - 1e-9);
      }
    }
  });

  it("validates parameters", () => {
    expect(() => createLayout({ region, tiling: ashlar({ height: 50, minLength: 100, maxLength: 50 }) })).toThrow(RangeError);
    expect(() => createLayout({ region, tiling: voronoi({ size: 1 }) })).toThrow(/too small/);
  });
});

describe("penrose", () => {
  const region = { x: 0, y: 0, width: 1000, height: 700 };
  const angle = (p: { x: number; y: number }[], i: number) => {
    const a = p[i]!, b = p[(i + 3) % 4]!, c = p[(i + 1) % 4]!;
    const u = { x: b.x - a.x, y: b.y - a.y }, w = { x: c.x - a.x, y: c.y - a.y };
    return (Math.acos((u.x * w.x + u.y * w.y) / (Math.hypot(u.x, u.y) * Math.hypot(w.x, w.y))) * 180) / Math.PI;
  };

  it("makes thick (72°/108°) and thin (36°/144°) rhombs with edge = size", () => {
    const l = createLayout({ region, tiling: penrose({ size: 40 }), edges: "inside" });
    expect(l.cells.length).toBeGreaterThan(100);
    for (const c of l.cells) {
      expect(c.polygon).toHaveLength(4);
      for (let i = 0; i < 4; i++) {
        const a = c.polygon[i]!, b = c.polygon[(i + 1) % 4]!;
        expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(40, 6);
      }
      const corner = Math.min(angle(c.polygon, 0), angle(c.polygon, 1));
      expect(corner).toBeCloseTo(c.protoTile === 0 ? 72 : 36, 6);
    }
  });

  it("has about φ thick rhombs per thin one", () => {
    const l = createLayout({ region, tiling: penrose({ size: 15 }), edges: "inside" });
    const thick = l.cells.filter((c) => c.protoTile === 0).length;
    const thin = l.cells.length - thick;
    expect(thick / thin).toBeCloseTo((1 + Math.sqrt(5)) / 2, 1);
  });

  it("puts the ten-fold star at the origin and follows rotation", () => {
    const origin = { x: 500, y: 350 };
    const l = createLayout({ region, tiling: penrose({ size: 50 }), origin });
    const atCentre = l.cells.filter((c) => c.polygon.some((v) => Math.hypot(v.x - origin.x, v.y - origin.y) < 1e-6));
    expect(atCentre.length).toBeGreaterThanOrEqual(5);
    const r = createLayout({ region, tiling: penrose({ size: 50 }), origin, rotation: 36 });
    expect(r.cells.length).toBeGreaterThan(0);
  });

  it("shows more of the same pattern when the region grows", () => {
    const tiling = penrose({ size: 20 });
    const small = createLayout({ region: { x: 0, y: 0, width: 300, height: 200 }, tiling, edges: "inside" });
    for (const width of [600, 1500, 4000]) {
      const big = createLayout({ region: { x: 0, y: 0, width, height: width / 1.5 }, tiling, edges: "inside" });
      const byId = new Map(big.cells.map((c) => [c.id, c]));
      for (const c of small.cells) {
        const same = byId.get(c.id);
        expect(same, c.id).toBeDefined();
        expect(same!.protoTile).toBe(c.protoTile);
        expect(same!.centroid.x).toBeCloseTo(c.centroid.x, 6);
        expect(same!.centroid.y).toBeCloseTo(c.centroid.y, 6);
      }
    }
  });
});

describe("non-convex tilings", () => {
  const region = { x: 0, y: 0, width: 1000, height: 700 };

  it("the sampled overlap check does catch overlaps", () => {
    const l = createLayout({ region, tiling: jigsaw({ size: 200 }) });
    const p = l.cells[5]!.polygon;
    const shifted = p.map((v) => ({ x: v.x + 30, y: v.y + 10 }));
    expect(sampledOverlap(p, shifted)).toBeGreaterThan(1000);
  });

  it("fish scales are all the same shape, each covering size²/2", () => {
    const l = createLayout({ region, tiling: fishScale({ size: 100 }), edges: "inside" });
    expect(l.cells.length).toBeGreaterThan(50);
    for (const c of l.cells) {
      expect(isConvex(c.polygon)).toBe(false);
      expect(c.polygon).toHaveLength(48);
      expect(c.area).toBeCloseTo(100 * 100 / 2, 6);
    }
  });

  it("jigsaw pieces fit the region exactly, interlock and have four neighbours inside", () => {
    const l = createLayout({ region, tiling: jigsaw({ size: 100, seed: 4 }) });
    expect(l.cells).toHaveLength(70); // 10 × 7
    expect(l.cells.every((c) => !c.boundary)).toBe(true);
    const inner = l.cells.filter((c) => c.bbox.x > 50 && c.bbox.y > 50 && c.bbox.x + c.bbox.width < 950 && c.bbox.y + c.bbox.height < 650);
    expect(inner.length).toBeGreaterThan(10);
    for (const c of inner) {
      expect(isConvex(c.polygon)).toBe(false);
      expect(c.neighbors).toHaveLength(4);
    }
  });

  it("keeps the gap around tabs", () => {
    const l = createLayout({ region, tiling: jigsaw({ size: 100 }), gap: 6 });
    // Necks are about 19 wide at size 100, so a 6 gap leaves every piece whole.
    expect(l.cells).toHaveLength(70);
    for (const c of l.cells) expect(c.area).toBeGreaterThan(5000);
  });
});

describe("penrose kites and darts", () => {
  const region = { x: 0, y: 0, width: 1000, height: 700 };
  const corners = (p: { x: number; y: number }[]) =>
    p.map((a, i) => {
      const b = p[(i + 3) % 4]!, c = p[(i + 1) % 4]!;
      const u = { x: b.x - a.x, y: b.y - a.y }, w = { x: c.x - a.x, y: c.y - a.y };
      const turn = (Math.atan2(u.x * w.y - u.y * w.x, u.x * w.x + u.y * w.y) * 180) / Math.PI;
      return turn;
    });

  it("makes kites (72/72/144/72) and darts (72/36/216/36) with long edge = size", () => {
    const l = createLayout({ region, tiling: penrose({ size: 50, variant: "kitesAndDarts" }), edges: "inside" });
    expect(l.cells.length).toBeGreaterThan(100);
    for (const c of l.cells) {
      expect(c.polygon).toHaveLength(4);
      const sides = c.polygon.map((a, i) => Math.hypot(c.polygon[(i + 1) % 4]!.x - a.x, c.polygon[(i + 1) % 4]!.y - a.y));
      expect(Math.max(...sides)).toBeCloseTo(50, 6);
      expect(Math.min(...sides)).toBeCloseTo(50 / ((1 + Math.sqrt(5)) / 2), 6);
      // Interior angles: the same sign as the polygon's orientation means convex.
      const turns = corners(c.polygon);
      const sign = Math.sign(turns.reduce((s, t) => s + Math.sign(t), 0));
      const interior = turns.map((t) => (Math.sign(t) === sign ? Math.abs(t) : 360 - Math.abs(t))).sort((a, b) => a - b);
      if (c.protoTile === 0) {
        expect(isConvex(c.polygon)).toBe(true);
        interior.forEach((a, i) => expect(a).toBeCloseTo([72, 72, 72, 144][i]!, 6));
      } else {
        expect(isConvex(c.polygon)).toBe(false);
        interior.forEach((a, i) => expect(a).toBeCloseTo([36, 36, 72, 216][i]!, 6));
      }
    }
  });

  it("has about φ kites per dart", () => {
    const l = createLayout({ region, tiling: penrose({ size: 15, variant: "kitesAndDarts" }), edges: "inside" });
    const kites = l.cells.filter((c) => c.protoTile === 0).length;
    expect(kites / (l.cells.length - kites)).toBeCloseTo((1 + Math.sqrt(5)) / 2, 1);
  });

  it("shows more of the same pattern when the region grows", () => {
    const tiling = penrose({ size: 20, variant: "kitesAndDarts" });
    const small = createLayout({ region: { x: 0, y: 0, width: 300, height: 200 }, tiling, edges: "inside" });
    const big = createLayout({ region: { x: 0, y: 0, width: 2000, height: 1300 }, tiling, edges: "inside" });
    const byId = new Map(big.cells.map((c) => [c.id, c]));
    for (const c of small.cells) {
      const same = byId.get(c.id);
      expect(same, c.id).toBeDefined();
      expect(same!.protoTile).toBe(c.protoTile);
      expect(same!.centroid.x).toBeCloseTo(c.centroid.x, 6);
    }
  });
});

describe("hat", () => {
  const region = { x: 0, y: 0, width: 1000, height: 700 };
  const sides = (p: { x: number; y: number }[]) =>
    p.map((a, i) => Math.hypot(p[(i + 1) % p.length]!.x - a.x, p[(i + 1) % p.length]!.y - a.y)).sort((a, b) => a - b);

  it("uses only congruent copies of the hat, some of them reflected", () => {
    const l = createLayout({ region, tiling: hat({ size: 60 }), edges: "inside" });
    expect(l.cells.length).toBeGreaterThan(100);
    const width = Math.max(...HAT.flatMap((a) => HAT.map((b) => Math.hypot(a.x - b.x, a.y - b.y))));
    const want = sides(HAT).map((x) => (x * 60) / width);
    for (const c of l.cells) {
      expect(c.polygon).toHaveLength(13);
      sides(c.polygon).forEach((x, i) => expect(x).toBeCloseTo(want[i]!, 6));
      expect(c.area).toBeCloseTo(l.cells[0]!.area, 6);
    }
    // Reflected hats are rare: about one in seven.
    const reflected = l.cells.filter((c) => c.protoTile === 4).length;
    expect(reflected / l.cells.length).toBeGreaterThan(0.08);
    expect(reflected / l.cells.length).toBeLessThan(0.2);
  });

  it("shows more of the same pattern when the region grows", () => {
    const small = createLayout({ region: { x: 0, y: 0, width: 300, height: 200 }, tiling: hat({ size: 20 }), edges: "inside" });
    const big = createLayout({ region: { x: 0, y: 0, width: 2400, height: 1600 }, tiling: hat({ size: 20 }), edges: "inside", maxTiles: 100000 });
    const byId = new Map(big.cells.map((c) => [c.id, c]));
    for (const c of small.cells) {
      const same = byId.get(c.id);
      expect(same, c.id).toBeDefined();
      expect(same!.protoTile).toBe(c.protoTile);
      expect(same!.centroid.x).toBeCloseTo(c.centroid.x, 6);
      expect(same!.centroid.y).toBeCloseTo(c.centroid.y, 6);
    }
  });
});

describe("spectre", () => {
  const region = { x: 0, y: 0, width: 1000, height: 700 };
  const sides = (p: { x: number; y: number }[]) =>
    p.map((a, i) => Math.hypot(p[(i + 1) % p.length]!.x - a.x, p[(i + 1) % p.length]!.y - a.y));
  const signedArea = (p: { x: number; y: number }[]) => p.reduce((s, a, i) => s + a.x * p[(i + 1) % p.length]!.y - p[(i + 1) % p.length]!.x * a.y, 0) / 2;

  it("uses only unreflected copies of Tile(1,1)", () => {
    const l = createLayout({ region, tiling: spectre({ size: 60 }), edges: "inside" });
    expect(l.cells.length).toBeGreaterThan(100);
    const width = Math.max(...SPECTRE.flatMap((a) => SPECTRE.map((b) => Math.hypot(a.x - b.x, a.y - b.y))));
    const unit = 60 / width;
    // Every edge has unit length; all tiles have the same handedness (checked on the
    // original pattern tiles, before the layout normalises orientation).
    for (const c of l.cells) {
      expect(c.polygon).toHaveLength(14);
      sides(c.polygon).forEach((x) => expect(x).toBeCloseTo(unit, 6));
      expect(c.area).toBeCloseTo(l.cells[0]!.area, 6);
    }
    // Chirality: the turn sequence of each tile (starting anywhere) matches the spectre's.
    const turns = (p: { x: number; y: number }[]) => {
      const q = signedArea(p) < 0 ? [...p].reverse() : p;
      return q.map((a, i) => {
        const b = q[(i + 1) % q.length]!, c = q[(i + 2) % q.length]!;
        return Math.round((Math.atan2((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x), (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y)) * 180) / Math.PI);
      });
    };
    const ref = turns(SPECTRE).join(",");
    const rotations = (t: number[]) => t.map((_, i) => [...t.slice(i), ...t.slice(0, i)].join(","));
    const mirrored = turns(SPECTRE.map((v) => ({ x: -v.x, y: v.y })));
    expect(rotations(mirrored)).not.toContain(ref); // the spectre really is chiral
    const handed = new Set(l.cells.map((c) => rotations(turns(c.polygon)).includes(ref)));
    expect(handed.size).toBe(1);
  });

  it("shows more of the same pattern when the region grows", () => {
    const small = createLayout({ region: { x: 0, y: 0, width: 300, height: 200 }, tiling: spectre({ size: 20 }), edges: "inside" });
    const big = createLayout({ region: { x: 0, y: 0, width: 2400, height: 1600 }, tiling: spectre({ size: 20 }), edges: "inside", maxTiles: 100000 });
    const byId = new Map(big.cells.map((c) => [c.id, c]));
    for (const c of small.cells) {
      const same = byId.get(c.id);
      expect(same, c.id).toBeDefined();
      expect(same!.protoTile).toBe(c.protoTile);
      expect(same!.centroid.x).toBeCloseTo(c.centroid.x, 6);
    }
  });
});

describe("tiles split by the region edge", () => {
  it("become separate cells sharing the tile's id", () => {
    const l = createLayout({ region: { x: 0, y: 0, width: 1000, height: 700 }, tiling: spectre({ size: 90 }), gap: 10 });
    const parts = l.cells.filter((c) => c.id.includes("~"));
    expect(parts.length).toBeGreaterThan(0);
    for (const p of parts) {
      const main = l.cells.find((c) => c.id === p.id.split("~")[0]);
      expect(main).toBeDefined();
      expect(main!.area).toBeGreaterThanOrEqual(p.area);
      expect(p.boundary).toBe(true);
      expect(isConvex(p.polygon) || p.polygon.length >= 3).toBe(true);
    }
  });
});

describe("patterns grown from a fixed centre", () => {
  // The region surrounds the pattern's centre, so it must grow in every direction.
  const region = { x: 0, y: 0, width: 1000, height: 700 };
  const origin = { x: 500, y: 350 };
  const cases: [string, TilingSpec][] = [
    ["hat", hat({ size: 45 })],
    ["spectre", spectre({ size: 45 })],
    ["penrose", penrose({ size: 30 })],
    ["penrose kites", penrose({ size: 40, variant: "kitesAndDarts" })],
  ];
  for (const [name, tiling] of cases) {
    for (const rotation of [0, 17]) {
      it(`${name} covers the region exactly (rotation ${rotation})`, () => {
        const l = createLayout({ region, tiling, origin, rotation });
        expect(Math.abs(totalArea(l) - wallArea) / wallArea).toBeLessThan(1e-6);
        expect(maxPairOverlap(l)).toBeLessThan(1e-6);
      });
    }
  }
});

describe("isohedral", () => {
  const region = { x: 0, y: 0, width: 600, height: 400 };

  it("tiles the region exactly for every type, straight and curved", async () => {
    const { isohedral, isohedralTypes } = await import("@andamento/core");
    expect(isohedralTypes).toHaveLength(81);
    const failures: string[] = [];
    for (const ih of isohedralTypes) {
      for (const edges of ["straight", "wave"] as const) {
        const l = createLayout({ region, tiling: isohedral({ ih, size: 90, edges }), rotation: 20 });
        const covered = Math.abs(totalArea(l) - 600 * 400) / (600 * 400);
        const overlap = maxPairOverlap(l);
        if (covered > 1e-6 || overlap > 1e-3) failures.push(`IH${ih} ${edges}: coverage ${covered.toExponential(1)}, overlap ${overlap.toFixed(3)}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("uses congruent tiles and stable lattice ids", async () => {
    const { isohedral } = await import("@andamento/core");
    const tiling = isohedral({ ih: 41, size: 60 });
    const l = createLayout({ region, tiling, edges: "inside" });
    for (const c of l.cells) expect(c.area).toBeCloseTo(l.cells[0]!.area, 6);
    const big = createLayout({ region: { x: 0, y: 0, width: 1200, height: 800 }, tiling, edges: "inside" });
    const ids = new Set(big.cells.map((c) => c.id));
    for (const c of l.cells) expect(ids.has(c.id)).toBe(true);
  });

  it("keeps curved tiles a full gap apart", async () => {
    const { isohedral } = await import("@andamento/core");
    for (const ih of [1, 28, 41, 84]) {
      const gap = 6;
      const l = createLayout({ region, tiling: isohedral({ ih, size: 90 }), gap, rotation: 10 });
      let closest = Infinity;
      for (let i = 0; i < l.cells.length; i++) {
        for (let j = i + 1; j < l.cells.length; j++) {
          const a = l.cells[i]!, b = l.cells[j]!;
          if (a.id.split("~")[0] === b.id.split("~")[0] || !rectsOverlap(a.bbox, b.bbox, gap)) continue;
          closest = Math.min(closest, polygonDistance(a.polygon, b.polygon));
        }
      }
      expect(closest, `IH${ih}`).toBeGreaterThan(gap - 1e-6);
    }
  });

  it("accepts custom curves and validates input", async () => {
    const { isohedral, isohedralInfo } = await import("@andamento/core");
    const info = isohedralInfo(1);
    expect(info.edgeKinds).toEqual(["J", "J", "J"]);
    const curve = [{ x: 0.3, y: 0.15 }, { x: 0.6, y: -0.1 }];
    const l = createLayout({ region, tiling: isohedral({ ih: 1, size: 80, edges: [curve, curve, []] }) });
    expect(Math.abs(totalArea(l) - 600 * 400) / (600 * 400)).toBeLessThan(1e-6);
    expect(() => createLayout({ region, tiling: isohedral({ ih: 19, size: 80 }) })).toThrow(RangeError);
    expect(() => createLayout({ region, tiling: isohedral({ ih: 1, size: 80, params: [1] }) })).toThrow(/parameters/);
    expect(() => createLayout({ region, tiling: isohedral({ ih: 1, size: 80, amount: 3 }) })).toThrow(/overlap/);
  });
});

describe("neighbours", () => {
  it("match a brute-force shared-edge check", async () => {
    const { sharesEdge, isohedral } = await import("@andamento/core");
    const region = { x: 0, y: 0, width: 700, height: 500 };
    for (const tiling of [
      grid({ width: 90, height: 60 }),
      runningBond({ width: 120, height: 50 }),
      herringbone({ length: 120, width: 60 }),
      hexagonal({ size: 50 }),
      penrose({ size: 60 }),
      fishScale({ size: 100 }),
      jigsaw({ size: 100 }),
      hat({ size: 70 }),
      isohedral({ ih: 84, size: 90 }),
      isohedral({ ih: 1, size: 90 }),
    ]) {
      const l = createLayout({ region, tiling, rotation: 13 });
      const tol = Math.max(1e-7 * 700 * 10, 1e-9);
      const byId = new Map(l.cells.map((c) => [c.id, c]));
      for (const c of l.cells) {
        if (c.id.includes("~")) continue;
        const expected = l.cells
          .filter((o) => o !== c && !o.id.includes("~") && o.original !== c.original && sharesEdge(c.original, o.original, tol))
          .map((o) => o.id)
          .sort();
        expect([...c.neighbors].filter((id) => !id.includes("~")).sort(), `${tiling.type} ${c.id}`).toEqual(expected);
        for (const n of c.neighbors) expect(byId.has(n)).toBe(true);
      }
    }
  });
});

describe("custom tilings", () => {
  // Two L-trominoes (non-convex) filling a 3 × 2 block, in units of 50.
  const u = 50;
  const L1 = [[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2]].map(([x, y]) => ({ x: x! * u, y: y! * u }));
  const L2 = [[2, 0], [3, 0], [3, 2], [1, 2], [1, 1], [2, 1]].map(([x, y]) => ({ x: x! * u, y: y! * u }));
  const trominoes = periodic({ a: { x: 3 * u, y: 0 }, b: { x: u, y: 2 * u }, motif: [{ polygon: L1 }, { polygon: L2, protoTile: 7 }] });

  it("periodic: a hand-made motif fills the region at any rotation", () => {
    for (const rotation of [0, 25]) {
      const l = createLayout({ region: wall, tiling: trominoes, rotation, gap: 4 });
      const exact = createLayout({ region: wall, tiling: trominoes, rotation });
      expect(Math.abs(totalArea(exact) - wallArea) / wallArea).toBeLessThan(1e-6);
      expect(maxPairOverlap(exact)).toBeLessThan(1e-6);
      expect(new Set(l.cells.map((c) => c.protoTile))).toEqual(new Set([0, 7]));
      expect(l.cells.some((c) => !isConvex(c.polygon))).toBe(true);
    }
  });

  it("periodic: reproduces a built-in pattern", () => {
    const viaPeriodic = createLayout({ region: wall, tiling: periodic({ a: { x: 90, y: 0 }, b: { x: 0, y: 60 }, motif: [{ polygon: rectPolygon(0, 0, 90, 60) }] }) });
    const builtIn = createLayout({ region: wall, tiling: grid({ width: 90, height: 60 }) });
    expect(viaPeriodic.cells.map((c) => [c.id, c.area])).toEqual(builtIn.cells.map((c) => [c.id, c.area]));
  });

  it("checkPeriodic accepts valid motifs and reports gaps, overlaps and self-intersections", () => {
    const good = checkPeriodic(trominoes);
    expect(good.ok).toBe(true);
    expect(good.motifArea).toBeCloseTo(good.cellArea, 9);

    const missing = checkPeriodic({ ...trominoes, motif: [{ polygon: L1 }] });
    expect(missing.ok).toBe(false);
    expect(missing.gaps).toBeCloseTo(0.5, 1);

    const doubled = checkPeriodic({ ...trominoes, motif: [...trominoes.motif, { polygon: L1 }] });
    expect(doubled.overlaps).toBeCloseTo(0.5, 1);

    const bowtie = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
    expect(checkPeriodic({ ...trominoes, motif: [...trominoes.motif, { polygon: bowtie }] }).selfIntersecting).toEqual([2]);

    // Built-in definitions pass too (a skewed lattice and a three-tile motif).
    expect(checkPeriodic(periodicDefinition(herringbone({ length: 120, width: 40 }))).ok).toBe(true);
    expect(checkPeriodic(periodicDefinition(rhombitrihexagonal({ size: 20 }))).ok).toBe(true);
  });

  it("tiles: explicit polygons go through the usual pipeline", () => {
    const l = createLayout({
      region: { x: 0, y: 0, width: 200, height: 100 },
      tiling: tiles({ tiles: [{ polygon: rectPolygon(0, 0, 120, 100), id: "big", protoTile: 2 }, { polygon: rectPolygon(120, 0, 120, 100) }] }),
      gap: 10,
    });
    expect(l.cells.map((c) => c.id)).toEqual(["big", "t1"]);
    expect(l.cells[0]!.protoTile).toBe(2);
    expect(l.cells[0]!.area).toBeCloseTo(110 * 90, 6); // gap 10: every side gives up 5
    expect(l.cells[1]!.boundary).toBe(true); // cut by the region edge at x = 200
    expect(l.cells[0]!.neighbors).toEqual(["t1"]);
  });
});
