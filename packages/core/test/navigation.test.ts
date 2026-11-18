import { describe, expect, it } from "vitest";
import { cellInDirection, createLayout, grid, hat, herringbone, hexagonal, voronoi, type Direction, type Layout } from "@andamento/core";

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
});
