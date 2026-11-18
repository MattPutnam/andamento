import { describe, expect, it } from "vitest";
import { contentSlots, createLayout, grid, herringbone, hexagonal, matchSlots, voronoi, type Layout } from "@andamento/core";

// 10 x 10 grid of 10-unit cells.
const square = createLayout({ region: { x: 0, y: 0, width: 100, height: 100 }, tiling: grid({ width: 10 }) });
const filled = (slots: number[]) => slots.map((s, i) => (s >= 0 ? i : -1)).filter((i) => i >= 0);

describe("contentSlots", () => {
  it("fills the first cells in reading order by default", () => {
    const slots = contentSlots(square, 3);
    expect(filled(slots)).toEqual([0, 1, 2]);
    expect(slots.slice(0, 4)).toEqual([0, 1, 2, -1]);
  });

  it("clamps the count and numbers every cell for Infinity", () => {
    expect(contentSlots(square, 500).filter((s) => s >= 0)).toHaveLength(100);
    expect(contentSlots(square, Infinity)[99]).toBe(99);
    expect(contentSlots(square, 0).every((s) => s === -1)).toBe(true);
    expect(contentSlots(square, -2).every((s) => s === -1)).toBe(true);
  });

  it("skips cut tiles with cells: whole", () => {
    // 105 wide: the last column is cut to 5 units.
    const layout = createLayout({ region: { x: 0, y: 0, width: 105, height: 100 }, tiling: grid({ width: 10 }) });
    const slots = contentSlots(layout, Infinity, { cells: "whole" });
    layout.cells.forEach((c) => expect(slots[c.index]! >= 0).toBe(!c.boundary));
    expect(slots.filter((s) => s >= 0)).toHaveLength(100);
    // The 11th whole tile is the first of the second row, not the cut tile ending row 1.
    const eleventh = layout.cells[slots.indexOf(10)]!;
    expect(eleventh.bbox.x).toBeCloseTo(0);
    expect(contentSlots(layout, Infinity, { cells: (c) => c.protoTile === 99 }).every((s) => s === -1)).toBe(true);
  });

  it("places items around the middle with placement: center", () => {
    const slots = contentSlots(square, 4, { placement: "center" });
    const chosen = filled(slots).map((i) => square.cells[i]!.centroid);
    expect(chosen.map((p) => [p.x, p.y])).toEqual([[45, 45], [55, 45], [45, 55], [55, 55]]);
    // Still in reading order across the chosen cells.
    expect(filled(slots).map((i) => slots[i])).toEqual([0, 1, 2, 3]);
  });

  it("spreads items evenly with placement: spread", () => {
    const slots = contentSlots(square, 4, { placement: "spread" });
    const chosen = filled(slots).map((i) => square.cells[i]!.centroid);
    // One per quadrant, near the quadrant centres (25, 25) etc.
    for (const q of [[25, 25], [75, 25], [25, 75], [75, 75]]) {
      expect(chosen.some((p) => Math.hypot(p.x - q[0]!, p.y - q[1]!) <= 8)).toBe(true);
    }
    expect(filled(slots).map((i) => slots[i])).toEqual([0, 1, 2, 3]);
  });

  it("spread picks distinct cells and is deterministic", () => {
    const layout = createLayout({ region: { x: 0, y: 0, width: 400, height: 300 }, tiling: voronoi({ size: 20, seed: 3 }) });
    for (const n of [1, 7, 50, layout.cells.length - 1]) {
      const a = contentSlots(layout, n, { placement: "spread" });
      expect(a.filter((s) => s >= 0).sort((x, y) => x - y)).toEqual(Array.from({ length: n }, (_, i) => i));
      expect(contentSlots(layout, n, { placement: "spread" })).toEqual(a);
    }
  });

  it("spread stays fast on large layouts", () => {
    const layout = createLayout({ region: { x: 0, y: 0, width: 2000, height: 1500 }, tiling: hexagonal({ size: 10 }), maxTiles: 50000 });
    const t = performance.now();
    contentSlots(layout, Math.floor(layout.cells.length / 2), { placement: "spread" });
    expect(performance.now() - t).toBeLessThan(2000);
  });
});

describe("backdropCss", () => {
  it("places a layout-sized box so every cell shows its own piece", async () => {
    const { backdropCss } = await import("@andamento/core");
    const l = createLayout({ region: { x: 0, y: 0, width: 400, height: 200 }, tiling: grid({ width: 100 }) });
    expect(backdropCss(l.cells[0]!, l)).toEqual({ left: "0%", top: "0%", width: "400%", height: "200%" });
    // Cell (2, 1): its box starts 200 right and 100 down, i.e. 2 and 1 cell-sizes.
    expect(backdropCss(l.cells.find((c) => c.bbox.x === 200 && c.bbox.y === 100)!, l)).toEqual({ left: "-200%", top: "-100%", width: "400%", height: "200%" });
  });
});

describe("matchSlots", () => {
  const cost = (l: Layout, slots: number[], aspects: number[]) =>
    l.cells.reduce((sum, c) => (slots[c.index]! >= 0 ? sum + Math.abs(Math.log(aspects[slots[c.index]!]!) - Math.log(c.bbox.width / c.bbox.height)) : sum), 0);
  const permutations = (xs: number[]): number[][] =>
    xs.length <= 1 ? [xs] : xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
  const combinations = (xs: number[], k: number): number[][] =>
    k === 0 ? [[]] : xs.flatMap((x, i) => combinations(xs.slice(i + 1), k - 1).map((c) => [x, ...c]));

  // Herringbone: horizontal bricks are wide (2:1), vertical ones tall (1:2).
  const bricks = createLayout({ region: { x: 0, y: 0, width: 400, height: 300 }, tiling: herringbone({ length: 80, width: 40 }), edges: "inside" });
  const wide = (i: number) => bricks.cells[i]!.bbox.width > bricks.cells[i]!.bbox.height;

  it("puts landscape items in wide tiles and portrait items in tall ones", () => {
    const aspects = [1.5, 0.66, 1.5, 0.66, 1.5, 0.66, 1.5, 0.66];
    const slots = matchSlots(bricks, aspects, { choose: "shape" });
    expect(slots.filter((s) => s >= 0)).toHaveLength(8);
    slots.forEach((item, i) => {
      if (item >= 0) expect(wide(i)).toBe(aspects[item]! > 1);
    });
  });

  it("uses the same tiles as contentSlots by default, arranged for the least crop", () => {
    const l = createLayout({ region: { x: 0, y: 0, width: 300, height: 200 }, tiling: voronoi({ size: 40, seed: 9 }) });
    const aspects = [0.5, 2.2, 1, 1.4, 0.8, 3];
    const plain = contentSlots(l, aspects.length);
    const matched = matchSlots(l, aspects);
    const used = (s: number[]) => s.map((v, i) => (v >= 0 ? i : -1)).filter((i) => i >= 0);
    expect(used(matched)).toEqual(used(plain));
    // Brute force over every arrangement of the items in those tiles.
    const tiles = used(plain);
    let best = Infinity;
    for (const p of permutations(aspects.map((_, i) => i))) {
      const s = new Array(l.cells.length).fill(-1);
      tiles.forEach((t, k) => (s[t] = p[k]));
      best = Math.min(best, cost(l, s, aspects));
    }
    expect(cost(l, matched, aspects)).toBeCloseTo(best, 9);
  });

  it("with choose: shape, finds the best tiles too", () => {
    const l = createLayout({ region: { x: 0, y: 0, width: 200, height: 140 }, tiling: voronoi({ size: 45, seed: 2 }) });
    const aspects = [0.4, 2.5, 1.1];
    const matched = matchSlots(l, aspects, { choose: "shape" });
    let best = Infinity;
    for (const tiles of combinations(l.cells.map((c) => c.index), 3)) {
      for (const p of permutations([0, 1, 2])) {
        const s = new Array(l.cells.length).fill(-1);
        tiles.forEach((t, k) => (s[t] = p[k]));
        best = Math.min(best, cost(l, s, aspects));
      }
    }
    expect(cost(l, matched, aspects)).toBeCloseTo(best, 9);
  });

  it("keeps featured tiles for the first items and respects contentCells", () => {
    const l = createLayout({ region: { x: 0, y: 0, width: 600, height: 400 }, tiling: grid({ width: 100 }), features: [{ tiles: 2 }] });
    const slots = matchSlots(l, [0.2, 1, 1]);
    const f = l.cells.find((c) => c.featured === 0)!;
    expect(slots[f.index]).toBe(0);
    const cut = createLayout({ region: { x: 0, y: 0, width: 250, height: 100 }, tiling: grid({ width: 100 }) });
    const s = matchSlots(cut, [0.5, 1, 1], { cells: "whole", choose: "shape" });
    cut.cells.forEach((c) => c.boundary && expect(s[c.index]).toBe(-1));
    // Two whole tiles for three items: the first two are kept.
    expect(s.filter((v) => v >= 0).sort()).toEqual([0, 1]);
  });

  it("treats bad aspects as square", () => {
    const s = matchSlots(square, [NaN, -1, 0, Infinity]);
    expect(s.filter((v) => v >= 0).sort()).toEqual([0, 1, 2, 3]);
  });

  it("stays fast choosing among many tiles", () => {
    const l = createLayout({ region: { x: 0, y: 0, width: 3000, height: 2000 }, tiling: herringbone({ length: 30, width: 15 }), maxTiles: 50000 });
    const aspects = Array.from({ length: 1000 }, (_, i) => [0.75, 1.33, 1.5, 0.66][i % 4]!);
    const t = performance.now();
    const s = matchSlots(l, aspects, { choose: "shape" });
    expect(performance.now() - t).toBeLessThan(3000);
    expect(s.filter((v) => v >= 0)).toHaveLength(1000);
  });
});
