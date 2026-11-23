import { describe, expect, it } from "vitest";
import { area, bevelFacets, cellAt, cellCss, cellShape, createLayout, grid, hexagonal, safeArea, safeAreaCss, viewCss, visibleShapes, type Cell, type LayoutOptions } from "@andamento/core";
import { shapeArea } from "@andamento/core/internal";

// A 100-unit grid in a 250-wide region: the third column is cut in half.
const base: LayoutOptions = { region: { x: 0, y: 0, width: 250, height: 200 }, tiling: grid({ width: 100 }), cornerRadius: 10 };
const windowed = createLayout({ ...base, edges: "window" });
const clipped = createLayout({ ...base, edges: "clip" });
const cut = (l = windowed) => l.cells.find((c) => c.boundary)!;

describe('edges: "window"', () => {
  it("keeps the clip mode's cells, adding the whole tile to cut ones", () => {
    expect(windowed.cells.map((c) => c.id)).toEqual(clipped.cells.map((c) => c.id));
    const c = cut();
    expect(c.bbox.width).toBeCloseTo(50); // the visible part
    expect(cellShape(c).bbox).toEqual({ x: 200, y: 0, width: 100, height: 100 });
    expect(windowed.cells.filter((x) => !x.boundary).every((x) => x.tile === undefined)).toBe(true);
    expect(clipped.cells.every((x) => x.tile === undefined)).toBe(true);
    expect(windowed.view).toHaveLength(1);
    expect(clipped.view).toBeUndefined();
  });

  it("places the tile whole and cuts it straight at the region edge", () => {
    const css = cellCss(cut(), windowed);
    expect(css.width).toBe("40%");
    // The cut corner is sharp: the clip path goes through it, half way across the tile.
    expect(css.clipPath).toContain("50% 0%");
    // Cut to the visible part in "clip" mode, the same corner is rounded away.
    expect(cellCss(cut(clipped), clipped).clipPath).not.toContain("100% 0%");
    expect(cellCss(cut(clipped), clipped).width).toBe("20%");
    expect(viewCss(windowed)).toBe(viewCss(clipped));
  });

  it("bevels and fits content to the whole tile", () => {
    const facets = bevelFacets(cut(), windowed, { width: 4 });
    expect(Math.max(...facets.flatMap((f) => f.polygon.map((p) => p.x)))).toBeCloseTo(300);
    const tile = safeArea(cut(), windowed);
    expect(tile.x + tile.width).toBeGreaterThan(280);
    expect(safeAreaCss(cut(), windowed).width).toMatch(/^9\d/);
    const seen = safeArea(cut(), windowed, { within: "visible" });
    expect(seen.x + seen.width).toBeLessThanOrEqual(250 + 1e-6);
    expect(seen.width).toBeGreaterThan(40);
    // Cells that aren't cut are the same either way.
    const whole = windowed.cells[0]!;
    expect(safeArea(whole, windowed, { within: "visible" })).toEqual(safeArea(whole, windowed));
  });

  it("hits only what shows", () => {
    expect(cellAt(windowed, { x: 245, y: 50 })).toBe(cut());
    expect(cellAt(windowed, { x: 260, y: 50 })).toBeUndefined();
    // The cut corner is sharp, so its very tip still hits.
    expect(cellAt(windowed, { x: 249.5, y: 0.5 })).toBe(cut());
    expect(cellAt(clipped, { x: 249.5, y: 0.5 })).toBeUndefined();
  });

  it("keeps a tile the region cuts in two as one cell", () => {
    // A notch from the bottom splits the middle tile of the bottom row.
    const notched: LayoutOptions = {
      region: [
        { x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 200 }, { x: 160, y: 200 },
        { x: 160, y: 90 }, { x: 140, y: 90 }, { x: 140, y: 200 }, { x: 0, y: 200 },
      ],
      tiling: grid({ width: 100 }),
    };
    expect(createLayout(notched).cells.some((c) => c.id.includes("~"))).toBe(true);
    const l = createLayout({ ...notched, edges: "window" });
    expect(l.cells.some((c) => c.id.includes("~"))).toBe(false);
    expect(l.cells).toHaveLength(6);
    const split = l.cells.find((c) => c.boundary && c.centroid.y > 100)!;
    expect(visibleShapes(split, l)).toHaveLength(2);
    expect(cellAt(l, { x: 120, y: 150 })).toBe(split);
    expect(cellAt(l, { x: 180, y: 150 })).toBe(split);
    expect(cellAt(l, { x: 150, y: 150 })).toBeUndefined();
    expect(cellCss(split, l, 4, { points: 72 }).clipPath).toMatch(/^polygon\(evenodd/);
  });

  it("respects margin, gap and minFill", () => {
    const l = createLayout({ ...base, edges: "window", margin: 5, gap: 4, minFill: 0.6 });
    // Half tiles are dropped by minFill.
    expect(l.cells).toHaveLength(4);
    const m = createLayout({ ...base, edges: "window", margin: 5, gap: 4 });
    const c = m.cells.find((x) => x.boundary && x.bbox.x > 150)!;
    expect(cellShape(c).bbox.width).toBeCloseTo(96);
    expect(Math.max(...m.view![0]!.outer.map((p) => p.x))).toBeCloseTo(245);
  });
});

describe("morphing the corner radius", () => {
  // Clip paths as point lists, for the same cell at two radii.
  const points = (radius: number, edges: "window" | "clip") => {
    const l = createLayout({ ...base, cornerRadius: radius, edges });
    return l.cells.map((c) => cellCss(c, l, 4, { points: 72 }).clipPath.slice(8, -1).split(", ").map((p) => p.split(" ").map(parseFloat)));
  };
  for (const edges of ["window", "clip"] as const) {
    it(`moves every point only a little from 0 to 0.5 (${edges})`, () => {
      const a = points(0, edges), b = points(0.5, edges);
      a.forEach((cell, i) => {
        expect(cell).toHaveLength(72);
        expect(b[i]).toHaveLength(72);
        // In % of a 100-unit tile box: about the 0.5 units the corners move.
        cell.forEach(([x, y], j) => expect(Math.hypot(x! - b[i]![j]![0]!, y! - b[i]![j]![1]!)).toBeLessThan(1.1));
      });
    });
  }
});

describe("window clip paths", () => {
  // Hexagons with a large radius: whole tiles are nearly circles, and so are the cut ones.
  const l = createLayout({ region: { x: 0, y: 0, width: 300, height: 200 }, tiling: hexagonal({ size: 30 }), cornerRadius: 20, edges: "window" });
  const toLayout = (c: Cell, css: string) => {
    const b = cellShape(c).bbox;
    return css.replace(/^polygon\((evenodd, )?/, "").slice(0, -1).split(", ").map((p) => {
      const [x, y] = p.split(" ").map(parseFloat);
      return { x: b.x + (x! / 100) * b.width, y: b.y + (y! / 100) * b.height };
    });
  };
  it("round the tile's corners outside the region too, morphing or not", () => {
    const cut = l.cells.filter((c) => c.boundary && visibleShapes(c, l).length === 1);
    expect(cut.length).toBeGreaterThan(5);
    for (const c of cut) {
      const exact = shapeArea(visibleShapes(c, l)[0]!);
      expect(area(toLayout(c, cellCss(c, l).clipPath))).toBeCloseTo(exact, 1);
      const morph = toLayout(c, cellCss(c, l, 4, { points: 72 }).clipPath);
      expect(morph).toHaveLength(72);
      // Within 0.5% of a whole tile (slivers lose a little to the coarser sampling).
      expect(Math.abs(area(morph) - exact) / cellShape(c).area).toBeLessThan(0.005);
      // Nothing outside the region.
      for (const p of morph) {
        expect(p.x).toBeGreaterThanOrEqual(-1e-3);
        expect(p.x).toBeLessThanOrEqual(300 + 1e-3);
        expect(p.y).toBeGreaterThanOrEqual(-1e-3);
        expect(p.y).toBeLessThanOrEqual(200 + 1e-3);
      }
    }
  });
});

describe("morph points for merged tiles", () => {
  it("give every corner enough points, adding points in steps of 24", () => {
    for (const tiles of [3, 7, 12]) {
      const l = createLayout({ region: { x: 0, y: 0, width: 240, height: 150 }, tiling: hexagonal({ size: 20 }), cornerRadius: 20, gap: 2, features: [{ tiles }] });
      const f = l.cells.find((c) => c.featured !== undefined)!;
      const css = cellCss(f, l, 4, { points: 72 }).clipPath;
      const b = cellShape(f).bbox;
      const pts = css.slice(8, -1).split(", ").map((p) => {
        const [x, y] = p.split(" ").map(parseFloat);
        return { x: b.x + (x! / 100) * b.width, y: b.y + (y! / 100) * b.height };
      });
      expect(pts.length % 24).toBe(0);
      expect(pts.length).toBeGreaterThan(72);
      // As close to the exact rounded shape (10° steps) as a plain hexagon is.
      expect(Math.abs(area(pts) - shapeArea(visibleShapes(f, l)[0]!)) / f.area).toBeLessThan(0.002);
      // Ordinary tiles keep 72, so they still morph into each other.
      const plain = l.cells.find((c) => c.featured === undefined && !c.boundary)!;
      expect(cellCss(plain, l, 4, { points: 72 }).clipPath.split(",").length).toBe(72);
    }
  });
});
