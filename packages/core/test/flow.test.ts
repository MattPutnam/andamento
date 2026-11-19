import { describe, expect, it } from "vitest";
import { createLayout, flow, mulberry32, partition, pointInPolygon, rectPolygon, vec, type Layout, type Vec } from "@andamento/core";

const region = { x: 0, y: 0, width: 400, height: 300 };
const total = (l: Layout) => l.cells.reduce((s, c) => s + c.area, 0);

/** Random points each in exactly one cell: no gaps, no overlaps. */
function tilesExactly(l: Layout, box = region, samples = 2000) {
  const rand = mulberry32(9);
  for (let k = 0; k < samples; k++) {
    const p = vec(box.x + rand() * box.width, box.y + rand() * box.height);
    let n = 0;
    for (const c of l.cells) if (pointInPolygon(p, c.polygon) && !(c.holes ?? []).some((h) => pointInPolygon(p, h))) n++;
    const inHole = false;
    if (n !== (inHole ? 0 : 1)) return false;
  }
  return true;
}

/** How far a cell's corners spread across (radially from a point). */
const radialSpread = (cell: Layout["cells"][number], c: Vec) => {
  const d = cell.polygon.map((v) => Math.hypot(v.x - c.x, v.y - c.y));
  return Math.max(...d) - Math.min(...d);
};

describe("flow", () => {
  it("lays rows along the region's edges, covering it exactly", () => {
    const l = createLayout({ region, tiling: flow({ size: 10 }) });
    expect(total(l)).toBeCloseTo(120000, 1);
    expect(tilesExactly(l)).toBe(true);
    // Tesserae about size x 1.3 size.
    const areas = l.cells.filter((c) => !c.boundary).map((c) => c.area).sort((a, b) => a - b);
    expect(areas[areas.length >> 1]).toBeGreaterThan(100);
    expect(areas[areas.length >> 1]).toBeLessThan(160);
    // The outer row along the top edge: one row high, longer than high.
    const top = l.cells.filter((c) => c.bbox.y < 0.01 && c.centroid.x > 40 && c.centroid.x < 360);
    expect(top.length).toBeGreaterThan(20);
    for (const c of top) {
      expect(c.bbox.height).toBeCloseTo(10.137, 1);
      expect(c.bbox.width).toBeGreaterThan(c.bbox.height * 0.6);
    }
  });

  it("rings a center point with rows of tesserae", () => {
    const center = vec(200, 150);
    const l = createLayout({ region, tiling: flow({ size: 10, centers: [center] }) });
    expect(tilesExactly(l)).toBe(true);
    // A round tessera at the center.
    const middle = l.cells.find((c) => pointInPolygon(center, c.polygon))!;
    // (Its outline is a polygon, slightly inside the circle.)
    expect(middle.area / (Math.PI * 5.137 ** 2)).toBeGreaterThan(0.9);
    expect(middle.area / (Math.PI * 5.137 ** 2)).toBeLessThan(1.01);
    // Away from where rows meet the region's edge, each tessera spans one row across.
    const ring = l.cells.filter((c) => {
      const d = Math.hypot(c.centroid.x - center.x, c.centroid.y - center.y);
      return d > 30 && d < 120;
    });
    expect(ring.length).toBeGreaterThan(100);
    const spreads = ring.map((c) => radialSpread(c, center)).sort((a, b) => a - b);
    expect(spreads[spreads.length >> 1]).toBeLessThan(11.5);
    // Rows alternate protoTile 0 / 1, for coloring by row.
    expect(new Set(l.cells.map((c) => c.protoTile))).toEqual(new Set([0, 1]));
  });

  it("runs straight rows along a straight guide", () => {
    const l = createLayout({ region, tiling: flow({ size: 10, guides: [{ points: [vec(-50, 150), vec(450, 150)] }] }) });
    expect(tilesExactly(l)).toBe(true);
    // Rows are horizontal bands 10 high, the middle one centerd on the guide.
    for (const c of l.cells.filter((c) => c.centroid.y > 20 && c.centroid.y < 280)) {
      expect(c.bbox.height).toBeLessThan(10.5);
    }
    const onGuide = l.cells.filter((c) => pointInPolygon(vec(c.centroid.x, 150), c.polygon) && c.centroid.x > 20 && c.centroid.x < 380);
    for (const c of onGuide) expect(c.centroid.y).toBeCloseTo(150, 0);
  });

  it("follows holes and works with margins and gaps", () => {
    const l = createLayout({ region, tiling: flow({ size: 8 }), holes: [rectPolygon(150, 100, 100, 80)], margin: 4, gap: 1 });
    expect(l.cells.length).toBeGreaterThan(500);
    // Rows ring the hole: tesserae beside its top edge are flat.
    const above = l.cells.filter((c) => c.centroid.y < 100 && c.centroid.y > 85 && c.centroid.x > 170 && c.centroid.x < 230);
    expect(above.length).toBeGreaterThan(3);
    for (const c of above) expect(c.bbox.width).toBeGreaterThan(c.bbox.height);
  });

  it("is deterministic, varies with the seed, and checks its options", () => {
    const a = createLayout({ region, tiling: flow({ size: 12, centers: [vec(100, 100)] }) });
    const b = createLayout({ region, tiling: flow({ size: 12, centers: [vec(100, 100)] }) });
    const c = createLayout({ region, tiling: flow({ size: 12, centers: [vec(100, 100)], seed: 2 }) });
    expect(a.cells.map((x) => x.id)).toEqual(b.cells.map((x) => x.id));
    expect(a.cells.map((x) => x.centroid.x)).not.toEqual(c.cells.map((x) => x.centroid.x));
    expect(() => createLayout({ region, tiling: flow({ size: 0 }) })).toThrow(/positive/);
    expect(() => createLayout({ region, tiling: flow({ size: 1 }) })).toThrow(/too small/);
  });

  it("scales with tileScale like other tilings", () => {
    const l = createLayout({ region, tiling: flow({ size: 10, centers: [vec(200, 150)] }), tileScale: 2 });
    const middle = l.cells.find((c) => pointInPolygon(vec(200, 150), c.polygon))!;
    expect(middle.area / (Math.PI * 10.274 ** 2)).toBeGreaterThan(0.9);
    expect(middle.area / (Math.PI * 10.274 ** 2)).toBeLessThan(1.01);
  });
});

describe("partition", () => {
  it("splits the plane into labeled regions along the given lines", () => {
    // A square split into quadrants by two lines.
    const lines = [rectPolygon(0, 0, 10, 10), [vec(5, 0), vec(5, 10)], [vec(0, 5), vec(10, 5)]];
    const label = (p: Vec) => (p.x < 0 || p.y < 0 || p.x > 10 || p.y > 10 ? -1 : (p.x > 5 ? 1 : 0) + (p.y > 5 ? 2 : 0));
    const parts = partition(lines, label, 10);
    expect([...parts.keys()].sort()).toEqual([0, 1, 2, 3]);
    for (const shapes of parts.values()) {
      expect(shapes).toHaveLength(1);
      expect(Math.abs(shapes[0]!.outer.reduce((s, v, i, a) => s + (v.x * a[(i + 1) % a.length]!.y - a[(i + 1) % a.length]!.x * v.y), 0) / 2)).toBeCloseTo(25);
    }
  });
});
