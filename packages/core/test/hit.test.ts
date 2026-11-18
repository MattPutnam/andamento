import { describe, expect, it } from "vitest";
import {
  cellAt,
  cellsInRect,
  createLayout,
  grid,
  hat,
  mulberry32,
  nearestCell,
  pointInPolygon,
  rectPolygon,
  roundedPolygon,
  screenToLayout,
  vec,
  voronoi,
  type Cell,
  type Layout,
  type Vec,
} from "@andamento/core";

const region = { x: 0, y: 0, width: 300, height: 200 };
// 3 x 2 grid of 100-unit cells, 10 apart.
const g = createLayout({ region, tiling: grid({ width: 100 }), gap: 10 });

const brute = (l: Layout, p: Vec) =>
  l.cells.find((c) => {
    const loops = [c.polygon, ...(c.holes ?? [])].map((q) => roundedPolygon(q, l.cornerRadius));
    return pointInPolygon(p, loops[0]!) && !loops.slice(1).some((h) => pointInPolygon(p, h));
  });
const dist = (c: Cell, p: Vec, l: Layout) => {
  let best = Infinity;
  for (const loop of [c.polygon, ...(c.holes ?? [])].map((q) => roundedPolygon(q, l.cornerRadius))) {
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i]!, b = loop[(i + 1) % loop.length]!;
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
    }
  }
  return best;
};

describe("cellAt", () => {
  it("finds the cell under a point, and nothing in the gaps", () => {
    expect(cellAt(g, vec(50, 50))).toBe(g.cells[0]);
    expect(cellAt(g, vec(250, 150))).toBe(g.cells[5]);
    expect(cellAt(g, vec(100, 50))).toBeUndefined(); // in the grout
    expect(cellAt(g, vec(-50, 50))).toBeUndefined();
  });

  it("with a tolerance, takes the nearest cell from the gap", () => {
    expect(cellAt(g, vec(97, 50), { tolerance: 5 })).toBe(g.cells[0]);
    expect(cellAt(g, vec(103, 50), { tolerance: 5 })).toBe(g.cells[1]);
    expect(cellAt(g, vec(100, 50), { tolerance: 2 })).toBeUndefined();
  });

  it("follows rounded corners and holes", () => {
    const rounded = createLayout({ region, tiling: grid({ width: 100 }), cornerRadius: 20 });
    expect(cellAt(rounded, vec(1, 1))).toBeUndefined(); // cut off by the corner arc
    expect(cellAt(rounded, vec(20, 20))).toBe(rounded.cells[0]);
    const holed = createLayout({ region, tiling: grid({ width: 1000 }), holes: [rectPolygon(100, 50, 50, 50)] });
    expect(cellAt(holed, vec(120, 70))).toBeUndefined();
    expect(cellAt(holed, vec(20, 70))).toBe(holed.cells[0]);
  });

  it("agrees with checking every cell, on irregular tilings", () => {
    const rand = mulberry32(7);
    for (const l of [
      createLayout({ region, tiling: voronoi({ size: 30, seed: 1 }), gap: 2, cornerRadius: 3 }),
      createLayout({ region, tiling: hat({ size: 20 }), gap: 1 }),
    ]) {
      for (let k = 0; k < 150; k++) {
        const p = vec(rand() * 340 - 20, rand() * 240 - 20);
        expect(cellAt(l, p)).toBe(brute(l, p));
        const n = nearestCell(l, p)!;
        const bestD = Math.min(...l.cells.map((c) => (brute(l, p) === c ? 0 : dist(c, p, l))));
        expect(brute(l, p) === n ? 0 : dist(n, p, l)).toBeCloseTo(bestD, 9);
      }
    }
  });

  it("is fast on big layouts", () => {
    const big = createLayout({ region: { x: 0, y: 0, width: 4000, height: 3000 }, tiling: voronoi({ size: 20, seed: 3 }), maxTiles: 40000 });
    expect(big.cells.length).toBeGreaterThan(20000);
    const rand = mulberry32(1);
    cellAt(big, vec(1, 1)); // builds the index
    const t = performance.now();
    for (let k = 0; k < 20000; k++) cellAt(big, vec(rand() * 4000, rand() * 3000), { tolerance: 3 });
    expect(performance.now() - t).toBeLessThan(1000);
  });
});

describe("nearestCell", () => {
  it("gives the containing cell, or the closest edge, within a limit", () => {
    expect(nearestCell(g, vec(50, 50))).toBe(g.cells[0]);
    expect(nearestCell(g, vec(-40, 50))).toBe(g.cells[0]);
    expect(nearestCell(g, vec(1000, 1000))).toBe(g.cells[5]);
    expect(nearestCell(g, vec(-40, 50), 10)).toBeUndefined();
  });
});

describe("cellsInRect", () => {
  it("finds cells meeting a rectangle, or wholly inside it", () => {
    const hit = cellsInRect(g, { x: 90, y: 90, width: 30, height: 30 });
    expect(hit.map((c) => c.index)).toEqual([0, 1, 3, 4]);
    // Within the gap only: nothing.
    expect(cellsInRect(g, { x: 96, y: 10, width: 8, height: 50 })).toEqual([]);
    expect(cellsInRect(g, { x: 0, y: 0, width: 200, height: 100 }, { contain: true }).map((c) => c.index)).toEqual([0, 1]);
    // Dragged up and to the left: negative sizes work too.
    expect(cellsInRect(g, { x: 120, y: 120, width: -30, height: -30 })).toEqual(hit);
  });

  it("catches a rectangle crossing a cell with no corners inside either", () => {
    // A thin bar right across the middle of cell 0.
    expect(cellsInRect(g, { x: -10, y: 40, width: 120, height: 2 }).map((c) => c.index)).toEqual([0, 1]);
  });
});

describe("screenToLayout", () => {
  it("maps screen points to layout units, letterboxed like SVG", () => {
    const box = { left: 10, top: 20, width: 600, height: 400 };
    expect(screenToLayout(g, box, 10, 20)).toEqual(vec(0, 0));
    expect(screenToLayout(g, box, 610, 420)).toEqual(vec(300, 200));
    // Twice as tall a box: the layout sits in the middle band.
    const tall = { left: 0, top: 0, width: 300, height: 400 };
    expect(screenToLayout(g, tall, 150, 100)).toEqual(vec(150, 0));
    expect(cellAt(g, screenToLayout(g, box, 110, 120))).toBe(g.cells[0]);
  });
});
