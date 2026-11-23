import { describe, expect, it } from "vitest";
import { cellInDirection, createLayout, grid, hat, herringbone, hexagonal, navigationLane, noteMove, penrose, runningBond, voronoi, type Direction, type Layout } from "@andamento/core";

const region = { x: 0, y: 0, width: 300, height: 200 };
const at = (l: Layout, id: string) => l.cells.find((c) => c.id === id)!;

describe("cellInDirection", () => {
  const g = createLayout({ region, tiling: grid({ width: 100 }) }); // 3 x 2

  it("moves along rows and columns of a grid", () => {
    const [a, b, c, d] = g.cells;
    expect(cellInDirection(g, a!, "right")).toBe(b);
    expect(cellInDirection(g, b!, "right")).toBe(c);
    expect(cellInDirection(g, a!, "down")).toBe(d);
    expect(cellInDirection(g, d!, "up")).toBe(a);
    expect(cellInDirection(g, a!, "left")).toBeUndefined();
    expect(cellInDirection(g, a!, "up")).toBeUndefined();
  });

  it("only lands on accepted cells, skipping others", () => {
    const [a, , c] = g.cells;
    expect(cellInDirection(g, a!, "right", (x) => x !== g.cells[1])).toBe(c);
  });

  it("keeps to the row in a hexagon tiling", () => {
    const l = createLayout({ region, tiling: hexagonal({ size: 30 }), edges: "inside" });
    for (const c of l.cells) {
      // Wherever the row continues to the right, that's where "right" goes.
      const sameRow = l.cells.some((o) => o.centroid.x > c.centroid.x && Math.abs(o.centroid.y - c.centroid.y) < 1e-6);
      if (!sameRow) continue;
      expect(Math.abs(cellInDirection(l, c, "right")!.centroid.y - c.centroid.y)).toBeLessThan(1e-6);
    }
  });

  it("reaches every cell and always moves the right way", () => {
    const layouts = [
      g,
      createLayout({ region, tiling: hexagonal({ size: 30 }) }),
      createLayout({ region, tiling: herringbone({ length: 60, width: 20 }), rotation: 20 }),
      createLayout({ region, tiling: voronoi({ size: 40, seed: 4 }) }),
      createLayout({ region, tiling: hat({ size: 25 }) }),
    ];
    const dirs: [Direction, number, number][] = [["up", 0, -1], ["down", 0, 1], ["left", -1, 0], ["right", 1, 0]];
    for (const l of layouts) {
      const seen = new Set([l.cells[0]!.id]);
      const queue = [l.cells[0]!];
      while (queue.length) {
        const c = queue.pop()!;
        for (const [dir, dx, dy] of dirs) {
          const n = cellInDirection(l, c, dir);
          if (!n) continue;
          expect((n.centroid.x - c.centroid.x) * dx + (n.centroid.y - c.centroid.y) * dy).toBeGreaterThan(0);
          if (!seen.has(n.id)) { seen.add(n.id); queue.push(n); }
        }
      }
      expect(seen.size).toBe(l.cells.length);
    }
    expect(at(g, g.cells[0]!.id)).toBe(g.cells[0]);
  });

  const tilings = {
    "pointy hexagons": hexagonal({ size: 30, orientation: "pointy" }),
    "flat hexagons": hexagonal({ size: 30, orientation: "flat" }),
    "running bond": runningBond({ width: 60, height: 25 }),
    "herringbone": herringbone({ length: 60, width: 20 }),
    "penrose": penrose({ size: 30 }),
  };
  const dirs: Direction[] = ["up", "down", "left", "right"];

  it("never skips over a touching tile ahead", () => {
    for (const [name, tiling] of Object.entries(tilings)) {
      const l = createLayout({ region, tiling, edges: "inside" });
      const ids = new Map(l.cells.map((c) => [c.id, c]));
      for (const c of l.cells) {
        for (const dir of dirs) {
          const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
          const ahead = c.neighbors.map((id) => ids.get(id)!).filter((n) => {
            const along = (n.centroid.x - c.centroid.x) * dx + (n.centroid.y - c.centroid.y) * dy;
            const across = Math.abs((n.centroid.x - c.centroid.x) * dy - (n.centroid.y - c.centroid.y) * dx);
            return along > 1e-6 && across <= along * Math.tan(Math.PI / 3);
          });
          if (!ahead.length) continue;
          expect(ahead, `${name}: ${c.id} ${dir}`).toContain(cellInDirection(l, c, dir));
        }
      }
    }
  });

  it("goes up a hexagon column one row at a time, zigzagging rather than drifting", () => {
    const l = createLayout({ region: { x: 0, y: 0, width: 300, height: 400 }, tiling: hexagonal({ size: 20, orientation: "pointy" }), edges: "inside" });
    let c = l.cells.reduce((a, b) => (Math.abs(b.centroid.x - 150) + Math.abs(b.centroid.y - 380) < Math.abs(a.centroid.x - 150) + Math.abs(a.centroid.y - 380) ? b : a));
    const x0 = c.centroid.x;
    const rows = new Set(l.cells.map((x) => Math.round(x.centroid.y)));
    let steps = 0;
    for (;;) {
      const lane = navigationLane(l, c, "up");
      const n = cellInDirection(l, c, "up", { lane });
      if (!n) break;
      noteMove(l, n, "up", lane);
      expect(c.neighbors).toContain(n.id);
      expect(Math.abs(n.centroid.x - x0)).toBeLessThan(20);
      c = n;
      steps++;
    }
    expect(steps).toBe(rows.size - 1);
  });
});
